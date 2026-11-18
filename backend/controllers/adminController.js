import bcrypt from 'bcryptjs';
import { getCollection } from '../config/db.js';
import { invalidateUserSessions } from './authController.js';

export async function getPublicStats(req, res) {
  const usersCol = getCollection('users');
  const companiesCol = getCollection('companies');
  const jobsCol = getCollection('jobs');
  const appsCol = getCollection('applications');

  const [activeJobs, activeCompanies, totalCandidates, totalApplications] = await Promise.all([
    jobsCol.countDocuments({ status: 'Activa' }),
    companiesCol.countDocuments({ status: 'Activa' }),
    usersCol.countDocuments({ role: 'candidato', status: 'Activa' }),
    appsCol.countDocuments()
  ]);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    stats: {
      activeJobs,
      activeCompanies,
      totalCandidates,
      totalApplications
    }
  }));
}

export async function getStats(req, res, user) {
  if (!user || user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Acceso restringido a administradores.' }));
  }

  const usersCol = getCollection('users');
  const companiesCol = getCollection('companies');
  const jobsCol = getCollection('jobs');
  const appsCol = getCollection('applications');
  const reviewsCol = getCollection('reviews');
  const forumsCol = getCollection('forums');

  const [
    totalUsers,
    suspendedUsers,
    totalCandidates,
    totalEmployers,
    totalCompanies,
    activeCompanies,
    totalJobs,
    activeJobs,
    totalApplications,
    totalReviews,
    totalForums
  ] = await Promise.all([
    usersCol.countDocuments(),
    usersCol.countDocuments({ status: { $ne: 'Activa' } }),
    usersCol.countDocuments({ role: 'candidato' }),
    usersCol.countDocuments({ role: 'empleador' }),
    companiesCol.countDocuments(),
    companiesCol.countDocuments({ status: 'Activa' }),
    jobsCol.countDocuments(),
    jobsCol.countDocuments({ status: 'Activa' }),
    appsCol.countDocuments(),
    reviewsCol.countDocuments(),
    forumsCol.countDocuments()
  ]);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    stats: {
      totalUsers,
      suspendedUsers,
      totalCandidates,
      totalEmployers,
      totalCompanies,
      activeCompanies,
      totalJobs,
      activeJobs,
      totalApplications,
      totalReviews,
      totalForums
    }
  }));
}

export async function listUsers(req, res, user, queryParams) {
  if (!user || user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Acceso restringido a administradores.' }));
  }

  const usersCol = getCollection('users');
  const users = await usersCol.find().toArray();

  const safeUsers = users.map(u => {
    const copy = { ...u };
    delete copy.passwordHash;
    return copy;
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ users: safeUsers }));
}

export async function toggleUserStatus(req, res, user, targetUserId, body = {}) {
  if (!user || user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Acceso restringido a administradores.' }));
  }

  const usersCol = getCollection('users');
  const targetUser = await usersCol.findOne({ _id: targetUserId });

  if (!targetUser) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Usuario no encontrado.' }));
  }

  if (targetUser.role === 'admin') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No es posible suspender a una cuenta administradora.' }));
  }

  const requestedStatus = body?.status;
  const newStatus = requestedStatus || (targetUser.status === 'Activa' ? 'Suspendida' : 'Activa');
  const actionText = newStatus === 'Activa' ? 'Reactivación' : 'Suspensión';
  const customReason = body?.reason?.trim() || `Acción de ${actionText.toLowerCase()} administrativa de cuenta.`;

  await usersCol.updateOne({ _id: targetUserId }, { $set: { status: newStatus, statusUpdatedAt: new Date() } });

  if (newStatus !== 'Activa') {
    await invalidateUserSessions(targetUserId);
  }

  // Log in moderation logs
  const logsCol = getCollection('moderation_logs');
  await logsCol.insertOne({
    _id: `log-${Date.now()}`,
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    adminName: `${user.firstName} ${user.lastName}`,
    adminId: user._id,
    category: 'Usuarios',
    targetId: targetUser._id,
    targetName: `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`,
    action: actionText,
    newStatus,
    reason: customReason
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: `Estado de la cuenta actualizado a "${newStatus}".`,
    status: newStatus,
    reason: customReason
  }));
}

export async function getAuditLogs(req, res, user) {
  if (!user || user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Acceso restringido a administradores.' }));
  }

  const logsCol = getCollection('moderation_logs');
  const logs = await logsCol.find().sort({ date: -1 }).toArray();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ logs }));
}

export async function moderateItem(req, res, user, body) {
  if (!user || user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Acceso restringido a administradores.' }));
  }

  const { category, targetId, targetName, action, reason } = body || {};

  if (!category || !targetId || !action) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Faltan parámetros requeridos de moderación.' }));
  }

  const logsCol = getCollection('moderation_logs');
  const logEntry = {
    _id: `log-${Date.now()}`,
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    adminName: `${user.firstName} ${user.lastName}`,
    category,
    targetId,
    targetName: targetName || targetId,
    action,
    reason: reason || 'Acción de moderación administrativa ejecutada.'
  };

  await logsCol.insertOne(logEntry);

  // If moderating job or company
  if (category === 'Ofertas') {
    const jobsCol = getCollection('jobs');
    const statusMap = { 'Aprobado': 'Activa', 'Pausado': 'Pausada', 'Rechazado': 'Cerrada', 'Cerrado': 'Cerrada' };
    if (statusMap[action]) {
      await jobsCol.updateOne({ _id: targetId }, { $set: { status: statusMap[action], updatedAt: new Date() } });
    }
  } else if (category === 'Empresas') {
    const companiesCol = getCollection('companies');
    if (action === 'Verificar') {
      await companiesCol.updateOne({ _id: targetId }, { $set: { verified: true, updatedAt: new Date() } });
    } else if (action === 'Quitar Verificación') {
      await companiesCol.updateOne({ _id: targetId }, { $set: { verified: false, updatedAt: new Date() } });
    } else if (action === 'Suspender' || action === 'Inactivar') {
      await companiesCol.updateOne({ _id: targetId }, { $set: { status: 'Suspendida', updatedAt: new Date() } });
      await getCollection('jobs').updateMany({ companyId: targetId, status: 'Activa' }, { $set: { status: 'Pausada', updatedAt: new Date() } });
    } else if (action === 'Activar' || action === 'Aprobado') {
      await companiesCol.updateOne({ _id: targetId }, { $set: { status: 'Activa', updatedAt: new Date() } });
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Acción de moderación registrada.',
    log: logEntry
  }));
}

export async function updateUser(req, res, user, targetUserId, body) {
  if (!user || user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Acceso restringido a administradores.' }));
  }

  const usersCol = getCollection('users');
  const targetUser = await usersCol.findOne({ _id: targetUserId });
  if (!targetUser) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Usuario no encontrado.' }));
  }

  if (targetUser.role === 'admin' && targetUser._id !== user._id) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No está permitido modificar cuentas de otros administradores.' }));
  }

  const { firstName, lastName, email, role, title, phone, location, status } = body || {};
  const updateFields = {};

  if (firstName && typeof firstName === 'string') updateFields.firstName = firstName.trim();
  if (lastName && typeof lastName === 'string') updateFields.lastName = lastName.trim();
  if (email && typeof email === 'string') updateFields.email = email.trim().toLowerCase();
  if (role && ['candidato', 'empleador', 'admin'].includes(role)) {
    if (targetUser.role === 'admin' && role !== 'admin') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No se puede cambiar el rol de un administrador.' }));
    }
    updateFields.role = role;
  }
  if (title !== undefined) updateFields.title = String(title).trim();
  if (phone !== undefined) updateFields.phone = String(phone).trim();
  if (location !== undefined) updateFields.location = String(location).trim();
  if (status && ['Activa', 'Suspendida', 'Inactiva'].includes(status)) {
    if (targetUser.role === 'admin' && status !== 'Activa') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No se puede suspender a un administrador.' }));
    }
    updateFields.status = status;
    if (status !== 'Activa') {
      await invalidateUserSessions(targetUserId);
    }
  }

  updateFields.updatedAt = new Date();
  await usersCol.updateOne({ _id: targetUserId }, { $set: updateFields });

  const updated = await usersCol.findOne({ _id: targetUserId });
  const safeUser = { ...updated };
  delete safeUser.passwordHash;

  await getCollection('moderation_logs').insertOne({
    _id: `log-${Date.now()}`,
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    adminName: `${user.firstName} ${user.lastName}`,
    adminId: user._id,
    category: 'Usuarios',
    targetId: targetUser._id,
    targetName: `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`,
    action: 'Edición de Perfil',
    reason: 'Modificación administrativa de datos de usuario.'
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ message: 'Usuario actualizado correctamente.', user: safeUser }));
}

export async function resetUserPassword(req, res, user, targetUserId) {
  if (!user || user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Acceso restringido a administradores.' }));
  }

  const usersCol = getCollection('users');
  const targetUser = await usersCol.findOne({ _id: targetUserId });
  if (!targetUser) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Usuario no encontrado.' }));
  }

  if (targetUser.role === 'admin' && targetUser._id !== user._id) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No se puede restablecer la contraseña de otro administrador.' }));
  }

  const tempPassword = `Temp-${Math.random().toString(36).substring(2, 8)}-${Math.floor(100 + Math.random() * 900)}`;
  const passwordHash = bcrypt.hashSync(tempPassword, 10);

  await usersCol.updateOne({ _id: targetUserId }, {
    $set: {
      passwordHash,
      mustChangePassword: true,
      passwordResetAt: new Date()
    }
  });

  await invalidateUserSessions(targetUserId);

  await getCollection('moderation_logs').insertOne({
    _id: `log-${Date.now()}`,
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    adminName: `${user.firstName} ${user.lastName}`,
    adminId: user._id,
    category: 'Usuarios',
    targetId: targetUser._id,
    targetName: `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`,
    action: 'Restablecimiento de Contraseña',
    reason: 'Generación de contraseña temporal segura con obligación de cambio.'
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Contraseña restablecida exitosamente.',
    temporaryPassword: tempPassword
  }));
}

