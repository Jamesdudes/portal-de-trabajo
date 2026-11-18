import { getCollection } from '../config/db.js';

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const VALID_COMPANY_STATUSES = ['Activa', 'Suspendida', 'Inactiva'];

export async function listCompanies(req, res, user, queryParams = {}) {
  const companiesCol = getCollection('companies');
  const filter = {};

  const wantsAll = queryParams.all === 'true' || queryParams.all === '1';
  const requestedStatus = (queryParams.status || '').trim();

  if (user && user.role === 'admin') {
    if (requestedStatus && VALID_COMPANY_STATUSES.includes(requestedStatus)) {
      filter.status = requestedStatus;
    } else if (!wantsAll) {
      filter.status = 'Activa';
    }
  } else {
    if (wantsAll || (requestedStatus && requestedStatus !== 'Activa')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No autorizado para consultar empresas inactivas o suspendidas.' }));
    }
    filter.status = 'Activa';
  }

  const q = (queryParams.q || '').trim();
  if (q) {
    const safeQ = escapeRegex(q);
    filter.$or = [
      { name: { $regex: safeQ, $options: 'i' } },
      { industry: { $regex: safeQ, $options: 'i' } },
      { location: { $regex: safeQ, $options: 'i' } }
    ];
  }

  let companies = await companiesCol.find(filter).sort({ verified: -1, reviewCount: -1, createdAt: 1, name: 1 }).toArray();

  const shouldDedupe = queryParams.dedupe === 'true' || queryParams.dedupe === '1';
  if (shouldDedupe) {
    const byId = new Map();
    for (const c of companies) {
      if (c && c._id && !byId.has(c._id)) {
        byId.set(c._id, c);
      }
    }
    const byName = new Map();
    for (const c of byId.values()) {
      const normalizedName = typeof c.name === 'string' ? c.name.trim().toLowerCase() : '';
      if (!normalizedName) continue;
      if (!byName.has(normalizedName)) {
        byName.set(normalizedName, c);
      }
    }
    companies = Array.from(byName.values());
  }

  companies.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ companies, total: companies.length }));
}

export async function getCompanyById(req, res, user, companyId) {
  const companiesCol = getCollection('companies');
  const company = await companiesCol.findOne({ _id: companyId });

  if (!company) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Empresa no encontrada.' }));
  }

  const isPrivilegedOwner = user && (user.role === 'admin' || user.companyId === company._id);
  if (company.status !== 'Activa' && !isPrivilegedOwner) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Esta empresa no se encuentra disponible públicamente.' }));
  }

  const usersCol = getCollection('users');
  const repUser = await usersCol.findOne(
    { companyId: company._id, role: 'empleador' },
    { projection: { _id: 1, firstName: 1, lastName: 1, title: 1, email: 1, phone: 1 } }
  );

  const jobsCol = getCollection('jobs');
  const activeJobsCount = await jobsCol.countDocuments({ companyId: company._id, status: 'Activa' });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    company,
    representative: repUser || null,
    activeJobsCount
  }));
}

export async function createCompany(req, res, user, body) {
  if (!user || !['admin', 'empleador'].includes(user.role)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado para registrar empresas.' }));
  }

  if (user.role === 'empleador' && user.companyId) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Su cuenta de empleador ya tiene una empresa asociada.' }));
  }

  const { name, legalName, industry, size, location, website, description } = body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El nombre de la empresa es obligatorio (mínimo 2 caracteres).' }));
  }

  if (!industry || typeof industry !== 'string' || industry.trim().length < 2) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El sector o industria de la empresa es obligatorio.' }));
  }

  if (!location || typeof location !== 'string' || location.trim().length < 2) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La ubicación de la empresa es obligatoria.' }));
  }

  const cleanWebsite = typeof website === 'string' ? website.trim() : '';
  if (cleanWebsite && !/^https?:\/\//i.test(cleanWebsite)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El sitio web debe iniciar con http:// o https://.' }));
  }

  const cleanDescription = typeof description === 'string' ? description.trim() : '';
  if (cleanDescription && cleanDescription.length < 10) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La descripción institucional debe contener al menos 10 caracteres.' }));
  }

  const companiesCol = getCollection('companies');
  const newCompany = {
    _id: `comp-${Date.now()}`,
    name: name.trim(),
    legalName: (typeof legalName === 'string' && legalName.trim()) ? legalName.trim() : name.trim(),
    logo: '',
    logoFileId: null,
    banner: '',
    bannerFileId: null,
    industry: industry.trim(),
    size: (typeof size === 'string' && size.trim()) ? size.trim() : '10-50 empleados',
    location: location.trim(),
    website: cleanWebsite,
    description: cleanDescription || 'Empresa registrada en Portal de Trabajo.',
    verified: user.role === 'admin',
    averageRating: 0,
    reviewCount: 0,
    status: 'Activa',
    createdAt: new Date()
  };

  await companiesCol.insertOne(newCompany);

  if (user.role === 'empleador') {
    const usersCol = getCollection('users');
    await usersCol.updateOne({ _id: user._id }, { $set: { companyId: newCompany._id, updatedAt: new Date() } });
  }

  res.writeHead(201, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Empresa registrada exitosamente en MongoDB.',
    company: newCompany
  }));
}

export async function updateCompany(req, res, user, companyId, body) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debe iniciar sesión para modificar una empresa.' }));
  }

  if (user.role !== 'admin' && (user.role !== 'empleador' || user.companyId !== companyId)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo el representante autorizado de esta empresa o un administrador puede editar su perfil.' }));
  }

  const companiesCol = getCollection('companies');
  const company = await companiesCol.findOne({ _id: companyId });
  if (!company) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Empresa no encontrada.' }));
  }

  const { name, legalName, industry, size, location, website, description, logo, banner, status, verified } = body || {};
  const updateFields = { updatedAt: new Date() };

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El nombre de la empresa debe tener al menos 2 caracteres.' }));
    }
    updateFields.name = name.trim();
  }

  if (legalName !== undefined) {
    if (typeof legalName !== 'string' || legalName.trim().length < 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La razón social no puede quedar vacía.' }));
    }
    updateFields.legalName = legalName.trim();
  }

  if (industry !== undefined) {
    if (typeof industry !== 'string' || industry.trim().length < 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El sector o industria debe tener al menos 2 caracteres.' }));
    }
    updateFields.industry = industry.trim();
  }

  if (size !== undefined && typeof size === 'string' && size.trim()) {
    updateFields.size = size.trim();
  }

  if (location !== undefined) {
    if (typeof location !== 'string' || location.trim().length < 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La ubicación de la empresa es obligatoria.' }));
    }
    updateFields.location = location.trim();
  }

  if (website !== undefined && typeof website === 'string') {
    const cleanWeb = website.trim();
    if (cleanWeb && !/^https?:\/\//i.test(cleanWeb)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El sitio web debe comenzar con http:// o https://.' }));
    }
    updateFields.website = cleanWeb;
  }

  if (description !== undefined) {
    if (typeof description !== 'string' || description.trim().length < 10) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La reseña institucional debe tener al menos 10 caracteres.' }));
    }
    updateFields.description = description.trim();
  }

  if (logo !== undefined && typeof logo === 'string') {
    const cleanLogo = logo.trim();
    if (cleanLogo && !cleanLogo.startsWith('/api/files/') && !/^https?:\/\//i.test(cleanLogo)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El logotipo debe ser una URL http(s) o una ruta interna /api/files/...' }));
    }
    updateFields.logo = cleanLogo;
    if (!cleanLogo.startsWith('/api/files/')) {
      updateFields.logoFileId = null;
    }
  }

  if (banner !== undefined && typeof banner === 'string') {
    const cleanBanner = banner.trim();
    if (cleanBanner && !cleanBanner.startsWith('/api/files/') && !/^https?:\/\//i.test(cleanBanner)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La portada debe ser una URL http(s) o una ruta interna /api/files/...' }));
    }
    updateFields.banner = cleanBanner;
    if (!cleanBanner.startsWith('/api/files/')) {
      updateFields.bannerFileId = null;
    }
  }

  if (user.role === 'admin') {
    if (status !== undefined) {
      if (!VALID_COMPANY_STATUSES.includes(status)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Estado de empresa inválido. Permitidos: ${VALID_COMPANY_STATUSES.join(', ')}` }));
      }
      updateFields.status = status;
    }
    if (typeof verified === 'boolean') {
      updateFields.verified = verified;
    }
  }

  await companiesCol.updateOne({ _id: companyId }, { $set: updateFields });
  const updatedCompany = await companiesCol.findOne({ _id: companyId });

  // Propagate name/logo updates to jobs and applications
  const jobSync = {};
  if (updateFields.name !== undefined) jobSync.companyName = updatedCompany.name;
  if (updateFields.logo !== undefined) jobSync.companyLogo = updatedCompany.logo;
  if (Object.keys(jobSync).length > 0) {
    await getCollection('jobs').updateMany({ companyId }, { $set: jobSync });
    await getCollection('applications').updateMany({ companyId }, { $set: jobSync });
  }

  // If admin suspended/inactivated company, close active jobs
  if (updateFields.status && updateFields.status !== 'Activa') {
    await getCollection('jobs').updateMany(
      { companyId, status: 'Activa' },
      { $set: { status: 'Pausada', updatedAt: new Date() } }
    );
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Perfil corporativo actualizado exitosamente.',
    company: updatedCompany
  }));
}

export async function deleteCompany(req, res, user, companyId) {
  if (!user || user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo los administradores pueden eliminar o desactivar empresas.' }));
  }

  const companiesCol = getCollection('companies');
  const company = await companiesCol.findOne({ _id: companyId });
  if (!company) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Empresa no encontrada.' }));
  }

  const jobsCount = await getCollection('jobs').countDocuments({ companyId });
  const appsCount = await getCollection('applications').countDocuments({ companyId });

  if (jobsCount > 0 || appsCount > 0) {
    await companiesCol.updateOne({ _id: companyId }, { $set: { status: 'Inactiva', updatedAt: new Date() } });
    await getCollection('jobs').updateMany({ companyId, status: 'Activa' }, { $set: { status: 'Cerrada', updatedAt: new Date() } });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      message: 'La empresa tiene historial de ofertas o postulaciones; fue marcada como Inactiva y sus vacantes activas fueron cerradas.',
      softDeleted: true
    }));
  }

  await companiesCol.deleteOne({ _id: companyId });
  await getCollection('users').updateMany({ companyId }, { $unset: { companyId: '' } });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Empresa eliminada definitivamente de MongoDB.',
    softDeleted: false
  }));
}
