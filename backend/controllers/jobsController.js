import { getCollection } from '../config/db.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\+]?[\d\s-]{7,25}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const VALID_MODALITIES = ['Presencial', 'Híbrido', 'Remoto'];
export const VALID_CONTRACTS = ['Tiempo Completo', 'Medio Tiempo', 'Pasantía / Prácticas', 'Por Proyecto / Freelance', 'Temporal'];
export const VALID_EXPERIENCE = ['Sin experiencia', '1-2 años', '3-5 años', '+5 años'];
export const VALID_JOB_STATUSES = ['Activa', 'Pausada', 'Inactiva', 'Cerrada'];

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTodayDateStr() {
  return new Date().toISOString().split('T')[0];
}

function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr.trim())) return false;
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function normalizeStringList(val) {
  if (Array.isArray(val)) {
    return val.map(item => String(item).trim()).filter(Boolean).slice(0, 20);
  }
  if (typeof val === 'string') {
    return val.split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 20);
  }
  return null;
}

function parseStrictSalary(value, fieldLabel) {
  if (value === undefined || value === null || value === '' || typeof value === 'boolean' || typeof value === 'object') {
    return { error: `El ${fieldLabel} es obligatorio y debe ser un valor numérico válido.` };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { error: `El ${fieldLabel} debe contener únicamente valores numéricos válidos.` };
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: `El ${fieldLabel} debe ser una cantidad numérica positiva o igual a cero.` };
    }
    return { value: parsed };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return { error: `El ${fieldLabel} debe ser una cantidad numérica positiva o igual a cero.` };
    }
    return { value };
  }
  return { error: `El ${fieldLabel} debe ser un valor numérico válido.` };
}

export async function listJobs(req, res, user, queryParams = {}) {
  const jobsCol = getCollection('jobs');
  const filter = {};

  const keyword = (queryParams.q || queryParams.keyword || '').trim();
  const location = (queryParams.location || '').trim();
  const modality = (queryParams.modality || '').trim();
  const contractType = (queryParams.contractType || '').trim();
  const experienceLevel = (queryParams.experienceLevel || '').trim();
  const sector = (queryParams.sector || '').trim();
  const companyId = (queryParams.companyId || '').trim();
  const status = (queryParams.status || '').trim();
  const wantsAll = queryParams.all === 'true' || queryParams.all === '1';

  const isAdmin = Boolean(user && user.role === 'admin');
  const isEmployer = Boolean(user && user.role === 'empleador' && user.companyId);

  if (wantsAll || (status && status !== 'Activa')) {
    if (!isAdmin && !isEmployer) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No autorizado para consultar ofertas cerradas, pausadas o inactivas.' }));
    }
    if (isEmployer && !isAdmin) {
      if (companyId && companyId !== user.companyId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Solo puede consultar ofertas no activas pertenecientes a su propia empresa.' }));
      }
      filter.companyId = user.companyId;
    } else if (companyId) {
      filter.companyId = companyId;
    }
    if (status) {
      if (!VALID_JOB_STATUSES.includes(status)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Estado de oferta inválido. Permitidos: ${VALID_JOB_STATUSES.join(', ')}` }));
      }
      filter.status = status;
    }
  } else {
    filter.status = 'Activa';
    if (companyId) {
      filter.companyId = companyId;
    }
    // Exclude expired active jobs for public & candidate views unless employer/admin inspecting company
    if (!isAdmin && !(isEmployer && companyId && companyId === user.companyId)) {
      const todayStr = getTodayDateStr();
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { expiresAt: { $gte: todayStr } },
          { expiresAt: { $exists: false } },
          { expiresAt: '' }
        ]
      });
    }
  }

  if (keyword) {
    const safeKeyword = escapeRegex(keyword);
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { title: { $regex: safeKeyword, $options: 'i' } },
        { description: { $regex: safeKeyword, $options: 'i' } },
        { companyName: { $regex: safeKeyword, $options: 'i' } },
        { sector: { $regex: safeKeyword, $options: 'i' } }
      ]
    });
  }

  if (location) {
    filter.location = { $regex: escapeRegex(location), $options: 'i' };
  }

  if (modality && modality !== 'Todas') {
    filter.modality = modality;
  }

  if (contractType && contractType !== 'Todos') {
    filter.contractType = contractType;
  }

  if (experienceLevel && experienceLevel !== 'Todas') {
    filter.experienceLevel = experienceLevel;
  }

  if (sector && sector !== 'Todos') {
    filter.sector = { $regex: escapeRegex(sector), $options: 'i' };
  }

  if (queryParams.salaryMin !== undefined && String(queryParams.salaryMin).trim() !== '') {
    const sMinFilter = Number(queryParams.salaryMin);
    if (Number.isFinite(sMinFilter) && sMinFilter >= 0) {
      filter.salaryMax = { $gte: sMinFilter };
    }
  }

  const jobs = await jobsCol.find(filter).sort({ publishedAt: -1 }).toArray();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ jobs, total: jobs.length }));
}

export async function getJobById(req, res, user, jobId) {
  const jobsCol = getCollection('jobs');
  const job = await jobsCol.findOne({ _id: jobId });

  if (!job) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Oferta laboral no encontrada.' }));
  }

  const isPrivilegedOwner = user && (
    user.role === 'admin' ||
    (user.role === 'empleador' && user.companyId && job.companyId === user.companyId)
  );

  if (job.status !== 'Activa' && !isPrivilegedOwner) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Esta oferta laboral no se encuentra activa o disponible públicamente.' }));
  }

  const companiesCol = getCollection('companies');
  const company = await companiesCol.findOne({ _id: job.companyId });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ job, company }));
}

export async function createJob(req, res, user, body) {
  if (!user || !['empleador', 'admin'].includes(user.role)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo empleadores o administradores pueden publicar ofertas laborales.' }));
  }

  const {
    title,
    modality,
    contractType,
    experienceLevel,
    sector,
    salaryMin,
    salaryMax,
    location,
    description,
    responsibilities,
    requirements,
    benefits,
    contactEmail,
    contactPhone,
    expiresAt
  } = body || {};

  if (!title || typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 150) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El título de la oferta es obligatorio (entre 5 y 150 caracteres).' }));
  }

  if (!description || typeof description !== 'string' || description.trim().length < 20 || description.trim().length > 5000) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La descripción de la oferta debe tener entre 20 y 5000 caracteres.' }));
  }

  const cleanLocation = location !== undefined ? String(location).trim() : 'San Salvador, El Salvador';
  if (cleanLocation.length < 2) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La ubicación de la oferta es obligatoria.' }));
  }

  const cleanModality = modality || 'Presencial';
  if (!VALID_MODALITIES.includes(cleanModality)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Modalidad inválida. Permitidas: ${VALID_MODALITIES.join(', ')}` }));
  }

  const cleanContract = contractType || 'Tiempo Completo';
  if (!VALID_CONTRACTS.includes(cleanContract)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Tipo de contrato inválido. Permitidos: ${VALID_CONTRACTS.join(', ')}` }));
  }

  const cleanExperience = experienceLevel || '1-2 años';
  if (!VALID_EXPERIENCE.includes(cleanExperience)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Nivel de experiencia inválido. Permitidos: ${VALID_EXPERIENCE.join(', ')}` }));
  }

  const minCheck = parseStrictSalary(salaryMin, 'salario mínimo');
  if (minCheck.error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: minCheck.error }));
  }
  const maxCheck = parseStrictSalary(salaryMax, 'salario máximo');
  if (maxCheck.error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: maxCheck.error }));
  }

  const sMin = minCheck.value;
  const sMax = maxCheck.value;
  if (sMax < sMin) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El salario máximo no puede ser menor al salario mínimo.' }));
  }

  if (contactEmail && !EMAIL_REGEX.test(String(contactEmail).trim())) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El correo electrónico de contacto no tiene un formato válido.' }));
  }

  if (contactPhone && !PHONE_REGEX.test(String(contactPhone).trim())) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El teléfono de contacto debe tener un formato válido (ej. 503-7123-4567 o 7123-4567).' }));
  }

  const todayStr = getTodayDateStr();
  let cleanExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  if (expiresAt !== undefined && String(expiresAt).trim() !== '') {
    const trimmedDate = String(expiresAt).trim();
    if (!isValidDateString(trimmedDate)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La fecha de vencimiento debe tener el formato válido AAAA-MM-DD.' }));
    }
    if (trimmedDate < todayStr) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La fecha de vencimiento no puede ser anterior a la fecha actual.' }));
    }
    cleanExpiresAt = trimmedDate;
  }

  const targetCompanyId = user.role === 'admin' ? (body?.companyId || user.companyId) : user.companyId;
  if (!targetCompanyId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No existe una empresa asociada a su cuenta para publicar ofertas laborales.' }));
  }

  const companiesCol = getCollection('companies');
  const company = await companiesCol.findOne({ _id: targetCompanyId });
  if (!company) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La empresa asociada a su cuenta no fue encontrada en la base de datos.' }));
  }
  if (company.status !== 'Activa') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La empresa se encuentra suspendida o inactiva y no puede publicar nuevas ofertas.' }));
  }

  const jobsCol = getCollection('jobs');
  const existingDuplicate = await jobsCol.findOne({
    companyId: company._id,
    title: title.trim(),
    status: 'Activa'
  });

  if (existingDuplicate) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: 'Ya existe una oferta activa con este mismo título para su empresa. Puede editar la existente.'
    }));
  }

  const normalizedResp = normalizeStringList(responsibilities);
  const normalizedReq = normalizeStringList(requirements);
  const normalizedBen = normalizeStringList(benefits);

  const newJob = {
    _id: `job-${Date.now()}`,
    title: title.trim(),
    companyId: company._id,
    companyName: company.name,
    companyLogo: company.logo || '',
    location: cleanLocation,
    modality: cleanModality,
    contractType: cleanContract,
    experienceLevel: cleanExperience,
    sector: (sector && String(sector).trim()) || company.industry || 'Tecnología / Software',
    salaryMin: sMin,
    salaryMax: sMax,
    description: description.trim(),
    responsibilities: normalizedResp || [],
    requirements: normalizedReq || [],
    benefits: normalizedBen || [],
    contactEmail: contactEmail ? String(contactEmail).trim() : user.email,
    contactPhone: contactPhone ? String(contactPhone).trim() : (user.phone || ''),
    status: 'Activa',
    publishedAt: todayStr,
    expiresAt: cleanExpiresAt,
    featured: false,
    createdAt: new Date()
  };

  await jobsCol.insertOne(newJob);

  res.writeHead(201, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Oferta laboral publicada exitosamente.',
    job: newJob
  }));
}

export async function updateJob(req, res, user, jobId, body) {
  if (!user || !['empleador', 'admin'].includes(user.role)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado para editar ofertas.' }));
  }

  const jobsCol = getCollection('jobs');
  const job = await jobsCol.findOne({ _id: jobId });
  if (!job) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Oferta no encontrada.' }));
  }

  if (user.role === 'empleador' && (!user.companyId || job.companyId !== user.companyId)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo puede modificar ofertas creadas por su propia empresa.' }));
  }

  const updateFields = { updatedAt: new Date() };

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length < 5 || body.title.trim().length > 150) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El título de la oferta debe tener entre 5 y 150 caracteres.' }));
    }
    updateFields.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.trim().length < 20 || body.description.trim().length > 5000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La descripción debe tener entre 20 y 5000 caracteres.' }));
    }
    updateFields.description = body.description.trim();
  }

  if (body.location !== undefined) {
    if (typeof body.location !== 'string' || body.location.trim().length < 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La ubicación de la oferta es obligatoria.' }));
    }
    updateFields.location = body.location.trim();
  }

  if (body.modality !== undefined) {
    if (!VALID_MODALITIES.includes(body.modality)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Modalidad inválida. Permitidas: ${VALID_MODALITIES.join(', ')}` }));
    }
    updateFields.modality = body.modality;
  }

  if (body.contractType !== undefined) {
    if (!VALID_CONTRACTS.includes(body.contractType)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Tipo de contrato inválido. Permitidos: ${VALID_CONTRACTS.join(', ')}` }));
    }
    updateFields.contractType = body.contractType;
  }

  if (body.experienceLevel !== undefined) {
    if (!VALID_EXPERIENCE.includes(body.experienceLevel)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Nivel de experiencia inválido. Permitidos: ${VALID_EXPERIENCE.join(', ')}` }));
    }
    updateFields.experienceLevel = body.experienceLevel;
  }

  if (body.sector !== undefined) {
    if (typeof body.sector !== 'string' || body.sector.trim().length < 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El sector debe tener al menos 2 caracteres.' }));
    }
    updateFields.sector = body.sector.trim();
  }

  if (body.status !== undefined) {
    if (!VALID_JOB_STATUSES.includes(body.status)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Estado inválido. Permitidos: ${VALID_JOB_STATUSES.join(', ')}` }));
    }
    updateFields.status = body.status;
  }

  if (body.salaryMin !== undefined) {
    const minCheck = parseStrictSalary(body.salaryMin, 'salario mínimo');
    if (minCheck.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: minCheck.error }));
    }
    updateFields.salaryMin = minCheck.value;
  }
  if (body.salaryMax !== undefined) {
    const maxCheck = parseStrictSalary(body.salaryMax, 'salario máximo');
    if (maxCheck.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: maxCheck.error }));
    }
    updateFields.salaryMax = maxCheck.value;
  }

  const finalMin = updateFields.salaryMin !== undefined ? updateFields.salaryMin : job.salaryMin;
  const finalMax = updateFields.salaryMax !== undefined ? updateFields.salaryMax : job.salaryMax;
  if (typeof finalMin === 'number' && typeof finalMax === 'number' && finalMax < finalMin) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El salario máximo no puede ser menor al salario mínimo.' }));
  }

  if (body.expiresAt !== undefined && String(body.expiresAt).trim() !== '') {
    const trimmedDate = String(body.expiresAt).trim();
    if (!isValidDateString(trimmedDate)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La fecha de vencimiento debe tener el formato válido AAAA-MM-DD.' }));
    }
    const targetStatus = updateFields.status || job.status;
    if (targetStatus === 'Activa' && trimmedDate < getTodayDateStr()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La fecha de vencimiento para una oferta activa no puede estar en el pasado.' }));
    }
    updateFields.expiresAt = trimmedDate;
  }

  if (body.contactEmail !== undefined) {
    const cleanEmail = String(body.contactEmail).trim();
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El correo electrónico de contacto no tiene un formato válido.' }));
    }
    updateFields.contactEmail = cleanEmail;
  }

  if (body.contactPhone !== undefined) {
    const cleanPhone = String(body.contactPhone).trim();
    if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El teléfono de contacto debe tener un formato válido.' }));
    }
    updateFields.contactPhone = cleanPhone;
  }

  const normalizedResp = normalizeStringList(body.responsibilities);
  if (normalizedResp !== null) updateFields.responsibilities = normalizedResp;
  const normalizedReq = normalizeStringList(body.requirements);
  if (normalizedReq !== null) updateFields.requirements = normalizedReq;
  const normalizedBen = normalizeStringList(body.benefits);
  if (normalizedBen !== null) updateFields.benefits = normalizedBen;

  // Duplicate active title guard when activating or renaming
  const resultingStatus = updateFields.status || job.status;
  const resultingTitle = updateFields.title || job.title;
  if (resultingStatus === 'Activa') {
    const dup = await jobsCol.findOne({
      _id: { $ne: jobId },
      companyId: job.companyId,
      title: resultingTitle,
      status: 'Activa'
    });
    if (dup) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Ya existe otra oferta activa con ese mismo título en su empresa.' }));
    }
  }

  await jobsCol.updateOne({ _id: jobId }, { $set: updateFields });
  const updated = await jobsCol.findOne({ _id: jobId });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Oferta actualizada exitosamente.',
    job: updated
  }));
}

export async function deleteJob(req, res, user, jobId, queryParams = {}) {
  if (!user || !['empleador', 'admin'].includes(user.role)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado para eliminar ofertas.' }));
  }

  const jobsCol = getCollection('jobs');
  const job = await jobsCol.findOne({ _id: jobId });
  if (!job) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Oferta no encontrada.' }));
  }

  if (user.role === 'empleador' && (!user.companyId || job.companyId !== user.companyId)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo puede eliminar ofertas de su empresa.' }));
  }

  const isHardDelete = queryParams.hard === 'true' || queryParams.hard === '1';
  if (isHardDelete) {
    const appsCol = getCollection('applications');
    const appsCount = await appsCol.countDocuments({ jobId });
    if (appsCount > 0) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'No es posible eliminar definitivamente una oferta con postulaciones registradas. Puede cerrarla o pausarla.'
      }));
    }

    await jobsCol.deleteOne({ _id: jobId });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Oferta laboral eliminada definitivamente de MongoDB.', deleted: true }));
  }

  // Soft close to preserve application histories
  await jobsCol.updateOne({ _id: jobId }, { $set: { status: 'Cerrada', updatedAt: new Date() } });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ message: 'Oferta laboral marcada como cerrada.', deleted: false }));
}

