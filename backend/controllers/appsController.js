import { ObjectId } from 'mongodb';
import { getCollection } from '../config/db.js';

async function applyPrivacyToApplications(apps) {
  if (!Array.isArray(apps) || apps.length === 0) return apps;

  const usersCol = getCollection('users');
  const candidateIds = [...new Set(apps.map(a => a.candidateId).filter(Boolean))];
  const candidates = candidateIds.length > 0
    ? await usersCol
      .find({ _id: { $in: candidateIds } }, { projection: { _id: 1, privacy: 1 } })
      .toArray()
    : [];

  const privacyByCandidate = new Map(
    candidates.map(c => [
      c._id,
      c.privacy || { showPhoneToCompanies: true, showEmailToCompanies: true, isProfilePublic: true }
    ])
  );

  return apps.map(app => {
    const privacy = privacyByCandidate.get(app.candidateId) || {
      showPhoneToCompanies: true,
      showEmailToCompanies: true,
      isProfilePublic: true
    };
    const showEmail = privacy.showEmailToCompanies !== false;
    const showPhone = privacy.showPhoneToCompanies !== false;
    const isProfilePublic = privacy.isProfilePublic !== false;

    return {
      ...app,
      candidateEmail: showEmail ? app.candidateEmail : null,
      candidatePhone: showPhone ? app.candidatePhone : null,
      candidateTitle: isProfilePublic ? app.candidateTitle : 'Perfil privado',
      emailHidden: !showEmail,
      phoneHidden: !showPhone,
      isProfilePublic
    };
  });
}

export async function listApplications(req, res, user, queryParams) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado.' }));
  }

  let filter = {};

  if (user.role === 'candidato') {
    filter = { candidateId: user._id };
  } else if (user.role === 'empleador') {
    if (!user.companyId) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Su cuenta de empleador no tiene una empresa asociada.' }));
    }
    filter = { companyId: user.companyId };
  }

  if (queryParams?.jobId && String(queryParams.jobId).trim()) {
    filter.jobId = String(queryParams.jobId).trim();
  }
  if (queryParams?.status && String(queryParams.status).trim()) {
    filter.status = String(queryParams.status).trim();
  }

  const appsCol = getCollection('applications');
  const apps = await appsCol.find(filter).sort({ appliedAt: -1 }).toArray();

  const responseApps = ['empleador', 'admin'].includes(user.role)
    ? await applyPrivacyToApplications(apps)
    : apps;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ applications: responseApps }));
}

export async function applyToJob(req, res, user, body) {
  if (!user || user.role !== 'candidato') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo los candidatos registrados pueden postularse a ofertas.' }));
  }

  const { jobId, coverNote, cvFileId: requestedCvFileId } = body || {};

  if (!jobId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El identificador de la oferta es requerido.' }));
  }

  const hasRequestedCvFileId =
    requestedCvFileId !== undefined &&
    requestedCvFileId !== null &&
    String(requestedCvFileId).trim() !== '';

  if (hasRequestedCvFileId && (typeof requestedCvFileId !== 'string' || !ObjectId.isValid(requestedCvFileId.trim()))) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El identificador del currículum proporcionado no es válido.' }));
  }

  const usersCol = getCollection('users');
  const freshUser = await usersCol.findOne({ _id: user._id });
  if (!freshUser || ['Bloqueada', 'Suspendida', 'Inactiva'].includes(freshUser.status)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Su cuenta no se encuentra activa para enviar postulaciones.' }));
  }

  const targetCvFileId = hasRequestedCvFileId
    ? requestedCvFileId.trim()
    : (freshUser.cv && freshUser.cv.fileId ? String(freshUser.cv.fileId).trim() : '');

  if (!targetCvFileId || !ObjectId.isValid(targetCvFileId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: 'Debes subir un Currículum Vitae real (PDF o DOCX) en tu perfil antes de postularte a una oferta.'
    }));
  }

  const filesCol = getCollection('uploads.files');
  const fileDoc = await filesCol.findOne({ _id: new ObjectId(targetCvFileId) });

  if (!fileDoc) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El archivo de currículum especificado no existe en MongoDB GridFS.' }));
  }

  if (fileDoc.metadata?.ownerId !== user._id || fileDoc.metadata?.fileType !== 'cv') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No tienes permiso para asociar un currículum que no te pertenece.' }));
  }

  const verifiedCvFileId = targetCvFileId;
  const verifiedCvFileName = fileDoc.metadata?.originalName || fileDoc.filename;

  const jobsCol = getCollection('jobs');
  const job = await jobsCol.findOne({ _id: jobId });

  if (!job) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La oferta de empleo no existe.' }));
  }

  if (job.status !== 'Activa') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Esta oferta ya no se encuentra activa para postulaciones.' }));
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (job.expiresAt && job.expiresAt < todayStr) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Esta oferta laboral ha vencido y ya no acepta postulaciones.' }));
  }

  const appsCol = getCollection('applications');
  // Anti-duplicate check
  const existing = await appsCol.findOne({ jobId: job._id, candidateId: user._id });
  if (existing) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Ya has enviado una postulación a esta vacante.' }));
  }

  const cleanCoverNote = typeof coverNote === 'string' ? coverNote.trim().slice(0, 500) : '';

  const newApp = {
    _id: `app-${Date.now()}`,
    jobId: job._id,
    jobTitle: job.title,
    companyId: job.companyId,
    companyName: job.companyName,
    companyLogo: job.companyLogo || '',
    candidateId: freshUser._id,
    candidateName: `${freshUser.firstName} ${freshUser.lastName}`,
    candidateEmail: freshUser.email,
    candidatePhone: freshUser.phone || '',
    candidateTitle: freshUser.title || 'Candidato Profesional',
    appliedAt: todayStr,
    status: 'Enviada',
    cvFileName: verifiedCvFileName,
    cvFileId: verifiedCvFileId,
    coverNote: cleanCoverNote,
    history: [
      {
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'Enviada',
        note: 'Postulación enviada a través de la plataforma Portal de Trabajo.'
      }
    ]
  };

  await appsCol.insertOne(newApp);

  res.writeHead(201, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Postulación enviada con éxito.',
    application: newApp
  }));
}

export async function updateApplicationStatus(req, res, user, appId, body) {
  if (!user || !['empleador', 'admin'].includes(user.role)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo empleadores o administradores pueden actualizar el estado de una postulación.' }));
  }

  const { status, note } = body || {};
  const validStatuses = ['Enviada', 'En proceso', 'Finalista', 'Contratado', 'Descartado'];

  if (!status || !validStatuses.includes(status)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Estado inválido. Opciones válidas: ${validStatuses.join(', ')}` }));
  }

  const appsCol = getCollection('applications');
  const app = await appsCol.findOne({ _id: appId });

  if (!app) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Postulación no encontrada.' }));
  }

  if (user.role === 'empleador' && (!user.companyId || app.companyId !== user.companyId)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo puede gestionar postulaciones pertenecientes a su empresa.' }));
  }

  const cleanNote = typeof note === 'string' && note.trim()
    ? note.trim().slice(0, 500)
    : `Estado actualizado a "${status}" por ${user.firstName} ${user.lastName}.`;

  const newHistoryEntry = {
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    status,
    note: cleanNote
  };

  await appsCol.updateOne(
    { _id: appId },
    {
      $set: { status, updatedAt: new Date() },
      $push: { history: newHistoryEntry }
    }
  );

  const updated = await appsCol.findOne({ _id: appId });
  const [sanitizedApplication] = await applyPrivacyToApplications([updated]);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Estado de postulación actualizado.',
    application: sanitizedApplication
  }));
}
