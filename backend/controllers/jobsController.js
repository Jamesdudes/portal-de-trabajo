
import { getCollection } from '../config/db.js';

const JOB_STATUSES = ['Activa', 'Pausada', 'Cerrada'];
const MODALITIES = ['Presencial', 'Remoto', 'Híbrido'];
const CONTRACT_TYPES = [
  'Tiempo Completo',
  'Medio Tiempo',
  'Pasantía / Prácticas',
  'Por Proyecto'
];

function sendError(res, status, error) {
  return res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    .end(JSON.stringify({ error }));
}

function isEmployerOfCompany(user, companyId) {
  return user?.role === 'admin' ||
    (user?.role === 'empleador' && String(user.companyId) === String(companyId));
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function validateJob(data, isUpdate = false) {
  const fields = [
    'title', 'location', 'modality', 'contractType',
    'experienceLevel', 'sector', 'description',
    'contactEmail'
  ];

  for (const field of fields) {
    if (!isUpdate || data[field] !== undefined) {
      if (typeof data[field] !== 'string' || !data[field].trim()) {
        return `El campo "${field}" es obligatorio.`;
      }
    }
  }

  if (data.title && data.title.trim().length < 3) {
    return 'El título debe tener al menos 3 caracteres.';
  }

  if (data.modality && !MODALITIES.includes(data.modality)) {
    return 'La modalidad seleccionada no es válida.';
  }

  if (data.contractType && !CONTRACT_TYPES.includes(data.contractType)) {
    return 'El tipo de contrato seleccionado no es válido.';
  }

  if (data.status && !JOB_STATUSES.includes(data.status)) {
    return 'El estado de la oferta no es válido.';
  }

  if (data.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail.trim())) {
    return 'El correo de contacto no es válido.';
  }

  for (const field of ['salaryMin', 'salaryMax']) {
    if (data[field] !== undefined &&
        (!Number.isFinite(Number(data[field])) || Number(data[field]) < 0)) {
      return 'Los salarios deben ser cantidades numéricas positivas.';
    }
  }

  if (data.salaryMin !== undefined && data.salaryMax !== undefined &&
      Number(data.salaryMax) < Number(data.salaryMin)) {
    return 'El salario máximo no puede ser menor al mínimo.';
  }

  return null;
}

function cleanJobData(data) {
  const result = {};

  const stringFields = [
    'title', 'location', 'modality', 'contractType',
    'experienceLevel', 'sector', 'description',
    'contactEmail', 'contactPhone', 'expiresAt'
  ];

  for (const field of stringFields) {
    if (data[field] !== undefined) {
      result[field] = String(data[field]).trim();
    }
  }

  for (const field of ['salaryMin', 'salaryMax']) {
    if (data[field] !== undefined) {
      result[field] = Number(data[field]);
    }
  }

  for (const field of ['responsibilities', 'requirements', 'benefits']) {
    if (data[field] !== undefined) {
      result[field] = normalizeList(data[field]);
    }
  }

  if (data.status !== undefined) {
    result.status = data.status;
  }

  return result;
}


export async function listJobs(req, res, user, query = {}) {
  try {
    const jobsCollection = getCollection('jobs');
    const filter = {};

    if (query.companyId) filter.companyId = String(query.companyId);
    if (query.status) filter.status = String(query.status);
    else if (query.all !== 'true' && query.all !== true) {
      filter.status = 'Activa';
    }

    if (query.modality) filter.modality = query.modality;
    if (query.contractType) filter.contractType = query.contractType;
    if (query.experienceLevel) filter.experienceLevel = query.experienceLevel;
    if (query.sector) filter.sector = query.sector;

    if (query.salaryMin !== undefined && query.salaryMin !== '') {
      const salary = Number(query.salaryMin);
      if (!Number.isFinite(salary)) {
        return sendError(res, 400, 'El filtro de salario no es válido.');
      }
      filter.salaryMax = { $gte: salary };
    }

    if (query.search || query.keyword) {
      const term = String(query.search || query.keyword).trim();
      if (term) {
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
          { title: regex },
          { description: regex },
          { companyName: regex },
          { sector: regex },
          { location: regex }
        ];
      }
    }

    const jobs = await jobsCollection.find(filter)
      .sort({ featured: -1, publishedAt: -1 })
      .toArray();

    return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ jobs, total: jobs.length }));
  } catch (error) {
    console.error('Error al listar ofertas:', error);
    return sendError(res, 500, 'No se pudieron obtener las ofertas laborales.');
  }
}


export async function getJobById(req, res, user, jobId) {
  try {
    const job = await getCollection('jobs').findOne({ _id: String(jobId) });

    if (!job) return sendError(res, 404, 'La oferta laboral no existe.');

    return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ job }));
  } catch (error) {
    console.error('Error al consultar oferta:', error);
    return sendError(res, 500, 'No se pudo consultar la oferta laboral.');
  }
}


export async function createJob(req, res, user, body = {}) {
  try {
    if (!user || !['empleador', 'admin'].includes(user.role)) {
      return sendError(res, 403, 'No tienes permiso para publicar ofertas laborales.');
    }

    const validationError = validateJob(body);
    if (validationError) return sendError(res, 400, validationError);

    const companyId = user.role === 'admin'
      ? String(body.companyId || user.companyId || '')
      : String(user.companyId || '');

    if (!companyId) {
      return sendError(res, 400, 'La cuenta no tiene una empresa asociada.');
    }

    const company = await getCollection('companies').findOne({ _id: companyId });
    if (!company) return sendError(res, 404, 'No se encontró la empresa asociada.');

    const jobData = cleanJobData(body);
    const job = {
      _id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...jobData,
      companyId,
      companyName: company.name,
      companyLogo: company.logo || '',
      status: 'Activa',
      publishedAt: new Date().toISOString().slice(0, 10),
      featured: false
    };

    await getCollection('jobs').insertOne(job);

    return res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ message: 'Oferta laboral publicada exitosamente.', job }));
  } catch (error) {
    console.error('Error al crear oferta:', error);
    return sendError(res, 500, 'No se pudo publicar la oferta laboral.');
  }
}


export async function updateJob(req, res, user, jobId, body = {}) {
  try {
    const jobsCollection = getCollection('jobs');
    const job = await jobsCollection.findOne({ _id: String(jobId) });

    if (!job) return sendError(res, 404, 'La oferta laboral no existe.');

    if (!isEmployerOfCompany(user, job.companyId)) {
      return sendError(res, 403, 'No tienes permiso para modificar esta oferta.');
    }

    const validationError = validateJob(body, true);
    if (validationError) return sendError(res, 400, validationError);

    const updates = cleanJobData(body);

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, 'No se recibieron cambios para actualizar.');
    }

    await jobsCollection.updateOne(
      { _id: String(jobId) },
      { $set: updates }
    );

    const updatedJob = await jobsCollection.findOne({ _id: String(jobId) });

    return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({
        message: 'Oferta laboral actualizada correctamente.',
        job: updatedJob
      }));
  } catch (error) {
    console.error('Error al actualizar oferta:', error);
    return sendError(res, 500, 'No se pudo actualizar la oferta laboral.');
  }
}


export async function deleteJob(req, res, user, jobId, query = {}) {
  try {
    const jobsCollection = getCollection('jobs');
    const job = await jobsCollection.findOne({ _id: String(jobId) });

    if (!job) return sendError(res, 404, 'La oferta laboral no existe.');

    if (!isEmployerOfCompany(user, job.companyId)) {
      return sendError(res, 403, 'No tienes permiso para eliminar esta oferta.');
    }

    const hardDelete = query.hard === 'true' || query.hard === true;

    if (hardDelete) {
      const applications = await getCollection('applications')
        .countDocuments({ jobId: String(jobId) });

      if (applications > 0) {
        return sendError(
          res,
          409,
          'No se puede eliminar definitivamente una oferta que tiene postulaciones registradas.'
        );
      }

      await jobsCollection.deleteOne({ _id: String(jobId) });

      return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({ message: 'Oferta eliminada definitivamente.' }));
    }

    await jobsCollection.updateOne(
      { _id: String(jobId) },
      { $set: { status: 'Cerrada' } }
    );

    return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ message: 'Oferta cerrada correctamente.' }));
  } catch (error) {
    console.error('Error al eliminar oferta:', error);
    return sendError(res, 500, 'No se pudo eliminar la oferta laboral.');
  }
}
