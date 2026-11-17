
import { getCollection } from '../config/db.js';

const APPLICATION_STATUSES = [
  'Enviada',
  'En proceso',
  'Finalista',
  'Contratado',
  'Descartado'
];

function sendError(res, status, error) {
  return res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  }).end(JSON.stringify({ error }));
}

function sendSuccess(res, status, data) {
  return res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  }).end(JSON.stringify(data));
}

function getCandidateName(user) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim();
}

function getCurrentDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentDateTime() {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}

export async function listApplications(req, res, user, query = {}) {
  try {
    if (!user) {
      return sendError(res, 401, 'Debes iniciar sesión para consultar las postulaciones.');
    }

    const filter = {};

    if (user.role === 'candidato') {
      filter.candidateId = String(user._id);
    } else if (user.role === 'empleador') {
      if (!user.companyId) {
        return sendError(res, 403, 'Tu cuenta no tiene una empresa asociada.');
      }
      filter.companyId = String(user.companyId);
    } else if (user.role !== 'admin') {
      return sendError(res, 403, 'No tienes permiso para consultar postulaciones.');
    }

    if (query.jobId) filter.jobId = String(query.jobId);
    if (query.status) {
      if (!APPLICATION_STATUSES.includes(query.status)) {
        return sendError(res, 400, 'El estado indicado no es válido.');
      }
      filter.status = query.status;
    }

    const applications = await getCollection('applications')
      .find(filter)
      .sort({ appliedAt: -1 })
      .toArray();

    return sendSuccess(res, 200, {
      applications,
      total: applications.length
    });
  } catch (error) {
    console.error('Error al listar postulaciones:', error);
    return sendError(res, 500, 'No se pudieron obtener las postulaciones.');
  }
}

export async function applyToJob(req, res, user, body = {}) {
  try {
    if (!user) {
      return sendError(res, 401, 'Debes iniciar sesión para postularte.');
    }

    if (user.role !== 'candidato') {
      return sendError(res, 403, 'Solo los candidatos pueden postularse a ofertas laborales.');
    }

    const jobId = String(body.jobId || '').trim();
    const cvFileId = String(body.cvFileId || '').trim();
    const coverNote = typeof body.coverNote === 'string'
      ? body.coverNote.trim()
      : '';

    if (!jobId) {
      return sendError(res, 400, 'Debes seleccionar una oferta laboral.');
    }

    if (!cvFileId) {
      return sendError(res, 400, 'Debes tener un currículum registrado para postularte.');
    }

    if (coverNote.length > 2000) {
      return sendError(res, 400, 'La carta de presentación no debe superar los 2000 caracteres.');
    }

    const job = await getCollection('jobs').findOne({ _id: jobId });

    if (!job) {
      return sendError(res, 404, 'La oferta laboral no existe.');
    }

    if (job.status !== 'Activa') {
      return sendError(res, 400, 'Esta oferta laboral ya no está disponible.');
    }

    if (job.expiresAt && job.expiresAt < getCurrentDate()) {
      return sendError(res, 400, 'El plazo para postularse a esta oferta ha finalizado.');
    }

    const existingApplication = await getCollection('applications').findOne({
      jobId,
      candidateId: String(user._id)
    });

    if (existingApplication) {
      return sendError(res, 409, 'Ya te has postulado a esta oferta laboral.');
    }

    const candidate = await getCollection('users').findOne({
      _id: String(user._id)
    });

    if (!candidate) {
      return sendError(res, 404, 'No se encontró tu perfil de candidato.');
    }

    if (!candidate.cv || String(candidate.cv.fileId) !== cvFileId) {
      return sendError(res, 400, 'El currículum seleccionado no coincide con tu perfil.');
    }

    const application = {
      _id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      jobId,
      jobTitle: job.title,
      companyId: String(job.companyId),
      companyName: job.companyName || '',
      companyLogo: job.companyLogo || '',
      candidateId: String(candidate._id),
      candidateName: getCandidateName(candidate),
      candidateEmail: candidate.email,
      candidatePhone: candidate.privacy?.showPhoneToCompanies === false ? '' : candidate.phone || '',
      candidateTitle: candidate.title || '',
      appliedAt: getCurrentDate(),
      status: 'Enviada',
      cvFileName: candidate.cv.fileName || '',
      cvFileId,
      coverNote,
      history: [
        {
          date: getCurrentDateTime(),
          status: 'Enviada',
          note: 'Postulación recibida.'
        }
      ]
    };

    await getCollection('applications').insertOne(application);

    return sendSuccess(res, 201, {
      message: 'Postulación registrada exitosamente.',
      application
    });
  } catch (error) {
    console.error('Error al registrar postulación:', error);
    return sendError(res, 500, 'No se pudo registrar la postulación.');
  }
}

export async function updateApplicationStatus(req, res, user, applicationId, body = {}) {
  try {
    if (!user) {
      return sendError(res, 401, 'Debes iniciar sesión para actualizar una postulación.');
    }

    if (!['empleador', 'admin'].includes(user.role)) {
      return sendError(res, 403, 'No tienes permiso para actualizar postulaciones.');
    }

    const application = await getCollection('applications').findOne({
      _id: String(applicationId)
    });

    if (!application) {
      return sendError(res, 404, 'La postulación no existe.');
    }

    if (
      user.role === 'empleador' &&
      String(user.companyId) !== String(application.companyId)
    ) {
      return sendError(res, 403, 'No tienes permiso para modificar esta postulación.');
    }

    const status = String(body.status || '').trim();
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!APPLICATION_STATUSES.includes(status)) {
      return sendError(res, 400, 'El estado seleccionado no es válido.');
    }

    if (note.length > 500) {
      return sendError(res, 400, 'La nota no debe superar los 500 caracteres.');
    }

    const historyEntry = {
      date: getCurrentDateTime(),
      status,
      note: note || `Fase actualizada a ${status}.`
    };

    await getCollection('applications').updateOne(
      { _id: String(applicationId) },
      {
        $set: { status },
        $push: { history: historyEntry }
      }
    );

    const updatedApplication = await getCollection('applications').findOne({
      _id: String(applicationId)
    });

    return sendSuccess(res, 200, {
      message: 'Estado de postulación actualizado correctamente.',
      application: updatedApplication
    });
  } catch (error) {
    console.error('Error al actualizar postulación:', error);
    return sendError(res, 500, 'No se pudo actualizar el estado de la postulación.');
  }
}
