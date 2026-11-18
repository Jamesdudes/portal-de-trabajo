import { getCollection } from '../config/db.js';

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function countMatchingJobs(keyword, location) {
  const jobsCol = getCollection('jobs');
  const filter = { status: 'Activa' };
  if (keyword && keyword.trim()) {
    const safeKw = escapeRegex(keyword.trim());
    filter.$or = [
      { title: { $regex: safeKw, $options: 'i' } },
      { description: { $regex: safeKw, $options: 'i' } },
      { sector: { $regex: safeKw, $options: 'i' } }
    ];
  }
  if (location && location.trim() && location.trim() !== 'Todas las ubicaciones') {
    filter.location = { $regex: escapeRegex(location.trim()), $options: 'i' };
  }
  return jobsCol.countDocuments(filter);
}

export async function listAlerts(req, res, user) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autenticado.' }));
  }

  const alertsCol = getCollection('alerts');
  const userAlerts = await alertsCol.find({ candidateId: user._id }).toArray();

  const enriched = await Promise.all(
    userAlerts.map(async (a) => ({
      ...a,
      matchedCount: await countMatchingJobs(a.keyword, a.location)
    }))
  );

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ alerts: enriched }));
}

export async function createAlert(req, res, user, body) {
  if (!user || user.role !== 'candidato') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo los candidatos pueden crear alertas de empleo.' }));
  }

  const { keyword, location, frequency } = body || {};

  if (!keyword || keyword.trim().length < 3) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La palabra clave de búsqueda es requerida (mínimo 3 caracteres).' }));
  }

  const alertsCol = getCollection('alerts');
  const count = await alertsCol.countDocuments({ candidateId: user._id });
  if (count >= 10) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Límite alcanzado: máximo 10 alertas activas por candidato.' }));
  }

  const cleanKeyword = keyword.trim();
  const cleanLocation = (location || 'Todas las ubicaciones').trim();
  const realMatchedCount = await countMatchingJobs(cleanKeyword, cleanLocation);

  const newAlert = {
    _id: `alert-${Date.now()}`,
    candidateId: user._id,
    keyword: cleanKeyword,
    location: cleanLocation,
    frequency: ['Diaria', 'Semanal'].includes(frequency) ? frequency : 'Diaria',
    active: true,
    createdAt: new Date().toISOString().split('T')[0],
    matchedCount: realMatchedCount
  };

  await alertsCol.insertOne(newAlert);

  res.writeHead(201, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Alerta de empleo configurada con éxito.',
    alert: newAlert
  }));
}

export async function toggleAlert(req, res, user, alertId) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autenticado.' }));
  }

  const alertsCol = getCollection('alerts');
  const alert = await alertsCol.findOne({ _id: alertId });

  if (!alert) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Alerta no encontrada.' }));
  }

  if (alert.candidateId !== user._id && user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado para modificar esta alerta.' }));
  }

  const newStatus = !alert.active;
  await alertsCol.updateOne({ _id: alertId }, { $set: { active: newStatus } });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: `Alerta ${newStatus ? 'activada' : 'pausada'} con éxito.`,
    active: newStatus
  }));
}

export async function deleteAlert(req, res, user, alertId) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autenticado.' }));
  }

  const alertsCol = getCollection('alerts');
  const alert = await alertsCol.findOne({ _id: alertId });

  if (!alert) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Alerta no encontrada.' }));
  }

  if (alert.candidateId !== user._id && user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado.' }));
  }

  await alertsCol.deleteOne({ _id: alertId });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ message: 'Alerta eliminada correctamente.' }));
}
