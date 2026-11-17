import bcrypt from 'bcryptjs';
import { getCollection, isConnectedToMongo } from '../config/db.js';

// In-memory active tokens & failed attempts tracker
const activeSessions = new Map();
const failedAttempts = new Map(); // email -> { count, lockedUntil }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\+]?[\d\s-]{7,25}$/;
const ALLOWED_EDUCATION_LEVELS = [
  'Grado Universitario',
  'Maestría / Posgrado',
  'Técnico Superior',
  'Diplomado / Especialización',
  'Bachillerato',
  'Certificación Profesional'
];

function validateCandidateTextField(value, { label, required = true, minLength = 2, maxLength = 100, minLetters = 2 }) {
  if (value === undefined || value === null) {
    if (required) return { error: `El campo "${label}" es obligatorio.` };
    return { value: '' };
  }
  if (typeof value !== 'string') {
    return { error: `El campo "${label}" tiene un formato inválido.` };
  }
  const clean = value.trim();
  if (!clean) {
    if (required) return { error: `El campo "${label}" es obligatorio y no puede quedar vacío.` };
    return { value: '' };
  }
  if (clean.length < minLength) {
    return { error: `El campo "${label}" debe tener al menos ${minLength} caracteres.` };
  }
  if (clean.length > maxLength) {
    return { error: `El campo "${label}" no debe superar los ${maxLength} caracteres.` };
  }
  const letters = (clean.match(/\p{L}/gu) || []).length;
  if (letters < minLetters) {
    return { error: `El campo "${label}" debe contener texto válido (no se permiten únicamente símbolos o números).` };
  }
  const nonSpace = clean.replace(/\s+/g, '');
  const alnum = (nonSpace.match(/[\p{L}\p{N}]/gu) || []).length;
  if (nonSpace.length >= 6 && alnum / nonSpace.length < 0.4) {
    return { error: `El campo "${label}" contiene demasiados símbolos. Ingresa una descripción o nombre válido.` };
  }
  return { value: clean };
}

function isValidRealCalendarDate(str) {
  if (typeof str !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const maxYear = new Date().getUTCFullYear() + 5;
  if (year < 1950 || year > maxYear || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month && dt.getUTCDate() === day;
}

function formatCalendarDisplayDate(isoDate) {
  if (!isoDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }
  return isoDate;
}

function validateAndNormalizeCandidateDates(item, currentLabel) {
  const hasStructuredDates = item.startDate !== undefined || item.endDate !== undefined || item.current !== undefined;
  if (!hasStructuredDates) {
    const rawPeriod = typeof item.period === 'string' ? item.period.trim() : '';
    if (!rawPeriod || rawPeriod.length < 2 || rawPeriod.length > 50) {
      return { error: 'El periodo o fechas del registro son obligatorios (entre 2 y 50 caracteres).' };
    }
    if (!/[\p{L}\p{N}]/u.test(rawPeriod)) {
      return { error: 'El periodo debe contener fechas o texto válido.' };
    }
    return { period: rawPeriod };
  }

  const startRaw = typeof item.startDate === 'string' ? item.startDate.trim() : '';
  const endRaw = typeof item.endDate === 'string' ? item.endDate.trim() : '';
  const isCurrent = Boolean(item.current);

  if (!startRaw) {
    return { error: 'La fecha de inicio es obligatoria.' };
  }

  const isLegacyShortStart = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(startRaw);
  const isFullStart = isValidRealCalendarDate(startRaw);
  if (!isFullStart && !isLegacyShortStart) {
    return { error: 'La fecha de inicio no es una fecha de calendario válida.' };
  }
  if (isLegacyShortStart) {
    const startYear = parseInt(startRaw.slice(0, 4), 10);
    if (startYear < 1950 || startYear > new Date().getUTCFullYear() + 5) {
      return { error: 'La fecha de inicio debe estar dentro de un rango de años válido.' };
    }
  }

  if (isCurrent) {
    const formattedStart = formatCalendarDisplayDate(startRaw);
    return {
      startDate: startRaw,
      endDate: '',
      current: true,
      period: `${formattedStart} - ${currentLabel}`
    };
  }

  if (!endRaw) {
    return { error: 'La fecha de finalización es obligatoria si el periodo ya finalizó.' };
  }
  const isLegacyShortEnd = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(endRaw);
  const isFullEnd = isValidRealCalendarDate(endRaw);
  if (!isFullEnd && !isLegacyShortEnd) {
    return { error: 'La fecha de finalización no es una fecha de calendario válida.' };
  }
  if (isFullStart && isFullEnd && endRaw < startRaw) {
    return { error: 'La fecha de finalización no puede ser anterior a la fecha de inicio.' };
  }
  if (!isFullStart && endRaw < startRaw) {
    return { error: 'La fecha de finalización no puede ser anterior a la fecha de inicio.' };
  }

  return {
    startDate: startRaw,
    endDate: endRaw,
    current: false,
    period: `${formatCalendarDisplayDate(startRaw)} - ${formatCalendarDisplayDate(endRaw)}`
  };
}

function validateExperienceArray(experience) {
  if (experience.length > 50) {
    return { error: 'Se permite un máximo de 50 registros de experiencia laboral.' };
  }
  const cleaned = [];
  for (const rawItem of experience) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return { error: 'Cada registro de experiencia laboral debe ser un objeto válido.' };
    }
    const posCheck = validateCandidateTextField(rawItem.position ?? rawItem.role, {
      label: 'Cargo / Puesto Desempeñado',
      required: true,
      minLength: 2,
      maxLength: 100,
      minLetters: 2
    });
    if (posCheck.error) return { error: posCheck.error };

    const compCheck = validateCandidateTextField(rawItem.company, {
      label: 'Empresa u Organización',
      required: true,
      minLength: 2,
      maxLength: 100,
      minLetters: 2
    });
    if (compCheck.error) return { error: compCheck.error };

    const locCheck = validateCandidateTextField(rawItem.location, {
      label: 'Ubicación',
      required: false,
      minLength: 2,
      maxLength: 100,
      minLetters: 2
    });
    if (locCheck.error) return { error: locCheck.error };

    const descCheck = validateCandidateTextField(rawItem.description, {
      label: 'Descripción de Responsabilidades y Logros',
      required: true,
      minLength: 10,
      maxLength: 1000,
      minLetters: 5
    });
    if (descCheck.error) return { error: descCheck.error };

    const dateCheck = validateAndNormalizeCandidateDates(rawItem, 'Actualidad');
    if (dateCheck.error) return { error: dateCheck.error };

    cleaned.push({
      ...(rawItem.id ? { id: String(rawItem.id) } : {}),
      position: posCheck.value,
      company: compCheck.value,
      location: locCheck.value,
      ...dateCheck,
      description: descCheck.value
    });
  }
  return { items: cleaned };
}

function validateEducationArray(education) {
  if (education.length > 50) {
    return { error: 'Se permite un máximo de 50 registros de formación académica.' };
  }
  const cleaned = [];
  for (const rawItem of education) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return { error: 'Cada registro de formación académica debe ser un objeto válido.' };
    }
    const degCheck = validateCandidateTextField(rawItem.degree, {
      label: 'Título Obtenido o en Curso',
      required: true,
      minLength: 2,
      maxLength: 100,
      minLetters: 2
    });
    if (degCheck.error) return { error: degCheck.error };

    const instCheck = validateCandidateTextField(rawItem.institution, {
      label: 'Institución Educativa',
      required: true,
      minLength: 2,
      maxLength: 120,
      minLetters: 2
    });
    if (instCheck.error) return { error: instCheck.error };

    let cleanLevel = '';
    if (rawItem.level !== undefined && rawItem.level !== '') {
      cleanLevel = String(rawItem.level).trim();
      if (!ALLOWED_EDUCATION_LEVELS.includes(cleanLevel)) {
        return { error: 'El nivel de estudio seleccionado no es válido.' };
      }
    } else if (rawItem.startDate === undefined && rawItem.period !== undefined) {
      cleanLevel = '';
    } else if (!rawItem.id) {
      return { error: 'El nivel de estudio es obligatorio.' };
    }

    const dateCheck = validateAndNormalizeCandidateDates(rawItem, 'En curso');
    if (dateCheck.error) return { error: dateCheck.error };

    cleaned.push({
      ...(rawItem.id ? { id: String(rawItem.id) } : {}),
      degree: degCheck.value,
      institution: instCheck.value,
      ...(cleanLevel ? { level: cleanLevel } : {}),
      ...(rawItem.fieldOfStudy ? { fieldOfStudy: String(rawItem.fieldOfStudy).trim() } : {}),
      ...(rawItem.description ? { description: String(rawItem.description).trim() } : {}),
      ...dateCheck
    });
  }
  return { items: cleaned };
}

const ALLOWED_LANGUAGE_LEVELS = [
  'Nativo / Lengua Materna',
  'Avanzado Profesional (C1/C2)',
  'Intermedio Alto (B2)',
  'Intermedio (B1)',
  'Básico (A1/A2)',
  // Compatibilidad con registros semilla existentes
  'Nativo',
  'Profesional (B2)',
  'Avanzado (C1)'
];

function validateLanguagesArray(languages) {
  if (languages.length > 30) {
    return { error: 'Se permite un máximo de 30 idiomas registrados.' };
  }
  const cleaned = [];
  for (const rawItem of languages) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return { error: 'Cada idioma registrado debe ser un objeto válido.' };
    }
    const rawLang = typeof rawItem.language === 'string' ? rawItem.language.trim() : '';
    if (!rawLang) {
      return { error: 'El nombre del idioma es obligatorio.' };
    }
    if (rawLang.length < 2 || rawLang.length > 50) {
      return { error: 'El nombre del idioma debe tener entre 2 y 50 caracteres.' };
    }
    if (/\p{N}/u.test(rawLang)) {
      return { error: 'El nombre del idioma no debe contener números.' };
    }
    const letters = (rawLang.match(/\p{L}/gu) || []).length;
    if (letters < 2 || !/^[\p{L}](?:[\p{L}\s'()-]*[\p{L})])?$/u.test(rawLang)) {
      return { error: 'Ingresa un nombre de idioma válido (solo letras, espacios, tildes o guiones).' };
    }

    const rawLevel = typeof rawItem.level === 'string' ? rawItem.level.trim() : '';
    if (!rawLevel || !ALLOWED_LANGUAGE_LEVELS.includes(rawLevel)) {
      return { error: 'Selecciona un nivel de dominio válido.' };
    }

    cleaned.push({ language: rawLang, level: rawLevel });
  }
  return { items: cleaned };
}

function isValidHttpUrl(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed || trimmed.length > 300 || !/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return Boolean(parsed.hostname && (parsed.hostname.includes('.') || parsed.hostname === 'localhost'));
  } catch {
    return false;
  }
}

function validateCertificationsArray(certifications) {
  if (certifications.length > 50) {
    return { error: 'Se permite un máximo de 50 certificaciones registradas.' };
  }
  const currentYear = new Date().getUTCFullYear();
  const cleaned = [];
  for (const rawItem of certifications) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return { error: 'Cada certificación debe ser un objeto válido.' };
    }
    const nameCheck = validateCandidateTextField(rawItem.name, {
      label: 'Nombre de la Certificación',
      required: true,
      minLength: 2,
      maxLength: 120,
      minLetters: 2
    });
    if (nameCheck.error) return { error: nameCheck.error };

    const issuerCheck = validateCandidateTextField(rawItem.issuer ?? rawItem.issuingOrganization, {
      label: 'Entidad Emisora',
      required: true,
      minLength: 2,
      maxLength: 100,
      minLetters: 2
    });
    if (issuerCheck.error) return { error: issuerCheck.error };

    const rawYear = rawItem.year ?? rawItem.issueDate;
    const yearStr = rawYear !== undefined && rawYear !== null ? String(rawYear).trim() : '';
    if (!yearStr) {
      return { error: 'El año de emisión de la certificación es obligatorio.' };
    }
    if (!/^\d{4}$/.test(yearStr)) {
      return { error: 'El año de emisión debe ser numérico de 4 dígitos (ej. 2024), sin letras ni símbolos.' };
    }
    const yearNum = parseInt(yearStr, 10);
    if (yearNum < 1950 || yearNum > currentYear) {
      return { error: `El año de emisión debe estar entre 1950 y ${currentYear} (no se permiten años futuros).` };
    }

    const rawUrl = rawItem.url ?? rawItem.credentialUrl;
    const cleanUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (cleanUrl && !isValidHttpUrl(cleanUrl)) {
      return { error: 'La URL de credencial debe ser una dirección HTTP o HTTPS válida (ej. https://...).' };
    }

    cleaned.push({
      ...(rawItem.id ? { id: String(rawItem.id) } : {}),
      name: nameCheck.value,
      issuer: issuerCheck.value,
      year: yearStr,
      url: cleanUrl
    });
  }
  return { items: cleaned };
}

export async function login(req, res, body) {
  const { email, password } = body || {};

  if (!email || !password) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El correo electrónico y la contraseña son obligatorios.' }));
  }

  const cleanEmail = String(email).trim().toLowerCase();

  // Check lockout
  const attempt = failedAttempts.get(cleanEmail);
  if (attempt && attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
    const remainingSec = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: `Cuenta bloqueada temporalmente por 5 intentos fallidos. Intente nuevamente en ${remainingSec} segundos.`
    }));
  }

  const usersCol = getCollection('users');
  const user = await usersCol.findOne({ email: cleanEmail });

  if (!user) {
    recordFailedAttempt(cleanEmail);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Credenciales inválidas. Correo o contraseña incorrectos.' }));
  }

  if (user.status === 'Bloqueada' || user.status === 'Suspendida' || user.status === 'Inactiva') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Su cuenta ha sido suspendida o deshabilitada por la administración.' }));
  }

  const passwordValid = bcrypt.compareSync(password, user.passwordHash);
  if (!passwordValid) {
    recordFailedAttempt(cleanEmail);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Credenciales inválidas. Correo o contraseña incorrectos.' }));
  }

  // Clear failed attempts on success
  failedAttempts.delete(cleanEmail);

  // Generate session token
  const token = 'token-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  const safeUser = sanitizeUser(user);
  activeSessions.set(token, safeUser);
  if (isConnectedToMongo()) {
    await getCollection('sessions').insertOne({
      _id: token,
      userId: user._id,
      createdAt: new Date()
    });
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Inicio de sesión exitoso.',
    token,
    user: safeUser
  }));
}

export async function register(req, res, body) {
  const {
    email,
    password,
    role,
    firstName,
    lastName,
    phone,
    title,
    location,
    companyName,
    companyIndustry,
    companySize
  } = body || {};

  // Validations
  if (!email || !EMAIL_REGEX.test(email)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debe ingresar un correo electrónico válido.' }));
  }

  if (!password || password.length < 6) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La contraseña debe contener al menos 6 caracteres.' }));
  }

  if (!role || !['candidato', 'empleador'].includes(role)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Rol inválido. Solo se permite registro como candidato o empleador.' }));
  }

  if (!firstName || !lastName) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Los nombres y apellidos son requeridos.' }));
  }

  if (phone && !PHONE_REGEX.test(phone.trim())) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El número de teléfono debe contener números y guiones en un formato válido (ej. 503-7123-4567 o 7123-4567).' }));
  }

  if (role === 'empleador' && (!companyName || typeof companyName !== 'string' || companyName.trim().length < 2)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El nombre o razón social de la empresa es obligatorio (mínimo 2 caracteres).' }));
  }

  const cleanEmail = email.trim().toLowerCase();
  const usersCol = getCollection('users');
  const existing = await usersCol.findOne({ email: cleanEmail });

  if (existing) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Ya existe una cuenta registrada con este correo electrónico.' }));
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = `usr-${role.slice(0, 4)}-${Date.now()}`;

  let companyId = null;
  if (role === 'empleador') {
    const companiesCol = getCollection('companies');
    companyId = `comp-${Date.now()}`;
    const cleanCompanyName = companyName.trim();
    await companiesCol.insertOne({
      _id: companyId,
      name: cleanCompanyName,
      legalName: `${cleanCompanyName} S.A. de C.V.`,
      logo: '',
      logoFileId: null,
      banner: '',
      bannerFileId: null,
      industry: (companyIndustry && companyIndustry.trim()) || 'Tecnología',
      size: (companySize && companySize.trim()) || '10-50 empleados',
      location: (location && location.trim()) || 'San Salvador, El Salvador',
      website: '',
      description: 'Empresa registrada en la plataforma Portal de Trabajo.',
      verified: false,
      averageRating: 0,
      reviewCount: 0,
      status: 'Activa',
      createdAt: new Date()
    });
  }

  const newUser = {
    _id: userId,
    email: cleanEmail,
    passwordHash,
    role,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    avatar: '',
    phone: phone ? phone.trim() : '503-7000-0000',
    title: title ? title.trim() : (role === 'candidato' ? 'Profesional / Especialista' : 'Representante de Selección'),
    location: location ? location.trim() : 'San Salvador, El Salvador',
    bio: '',
    status: 'Activa',
    profileViews: 1,
    themePreference: 'light',
    ...(companyId ? { companyId } : {}),
    ...(role === 'candidato' ? {
      experience: [],
      education: [],
      skills: ['Comunicación Asertiva', 'Gestión de Proyectos', 'Resolución de Problemas'],
      languages: [{ language: 'Español', level: 'Nativo' }],
      certifications: [],
      links: { portfolio: '', linkedin: '', github: '', website: '' },
      privacy: { showPhoneToCompanies: true, showEmailToCompanies: true, isProfilePublic: true },
      cv: null
    } : {}),
    createdAt: new Date()
  };

  await usersCol.insertOne(newUser);

  const token = 'token-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  const safeUser = sanitizeUser(newUser);
  activeSessions.set(token, safeUser);
  if (isConnectedToMongo()) {
    await getCollection('sessions').insertOne({
      _id: token,
      userId: newUser._id,
      createdAt: new Date()
    });
  }

  res.writeHead(201, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Registro completado con éxito.',
    token,
    user: safeUser
  }));
}

export async function getCurrentUser(req, res, user) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autenticado.' }));
  }

  // Fetch fresh user data from DB
  const usersCol = getCollection('users');
  const freshUser = await usersCol.findOne({ _id: user._id });

  if (!freshUser) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Usuario no encontrado.' }));
  }

  if (['Bloqueada', 'Suspendida', 'Inactiva'].includes(freshUser.status)) {
    await invalidateUserSessions(user._id);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Su cuenta ha sido suspendida o deshabilitada por la administración.' }));
  }

  await refreshUserSession(user._id, freshUser);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ user: sanitizeUser(freshUser) }));
}

export async function updateProfile(req, res, user, body) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado.' }));
  }

  // Restricción: Los datos personales solo pueden ser editados por su propio titular
  if (body?.targetUserId && body.targetUserId !== user._id) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: 'Por motivos de privacidad y seguridad, los datos personales de los usuarios únicamente pueden ser modificados por su respectivo titular.'
    }));
  }

  const {
    firstName,
    lastName,
    avatar,
    phone,
    title,
    location,
    bio,
    experience,
    education,
    skills,
    languages,
    certifications,
    links,
    privacy,
    themePreference,
    cv
  } = body || {};

  const updateFields = {};

  if (firstName && typeof firstName === 'string') updateFields.firstName = firstName.trim();
  if (lastName && typeof lastName === 'string') updateFields.lastName = lastName.trim();
  if (avatar !== undefined && typeof avatar === 'string') {
    const cleanAvatar = avatar.trim();
    const isAllowedAvatar =
      cleanAvatar === '' ||
      cleanAvatar.startsWith('/api/files/') ||
      /^https?:\/\//i.test(cleanAvatar);
    if (!isAllowedAvatar) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La fotografía de perfil debe ser una URL http(s) válida o una ruta interna /api/files/...' }));
    }
    updateFields.avatar = cleanAvatar;
    if (!cleanAvatar.startsWith('/api/files/')) {
      updateFields.avatarFileId = null;
    }
  }

  if (phone !== undefined) {
    const cleanPhone = String(phone).trim();
    if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El número de teléfono debe incluir números y guiones válidos (ej. 503-7123-4567 o 7123-4567).' }));
    }
    updateFields.phone = cleanPhone;
  }

  if (title !== undefined) updateFields.title = String(title).trim();
  if (location !== undefined) updateFields.location = String(location).trim();
  if (typeof bio === 'string') updateFields.bio = bio.trim();

  // LinkedIn-style structured candidate fields
  if (experience !== undefined) {
    if (!Array.isArray(experience)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El listado de experiencia laboral debe tener formato de arreglo.' }));
    }
    const expCheck = validateExperienceArray(experience);
    if (expCheck.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: expCheck.error }));
    }
    updateFields.experience = expCheck.items;
  }
  if (education !== undefined) {
    if (!Array.isArray(education)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El listado de formación académica debe tener formato de arreglo.' }));
    }
    const eduCheck = validateEducationArray(education);
    if (eduCheck.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: eduCheck.error }));
    }
    updateFields.education = eduCheck.items;
  }
  if (Array.isArray(skills)) updateFields.skills = skills.map(s => String(s).trim()).filter(Boolean);
  if (languages !== undefined) {
    if (!Array.isArray(languages)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El listado de idiomas debe tener formato de arreglo.' }));
    }
    const langCheck = validateLanguagesArray(languages);
    if (langCheck.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: langCheck.error }));
    }
    updateFields.languages = langCheck.items;
  }
  if (certifications !== undefined) {
    if (!Array.isArray(certifications)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El listado de certificaciones debe tener formato de arreglo.' }));
    }
    const certCheck = validateCertificationsArray(certifications);
    if (certCheck.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: certCheck.error }));
    }
    updateFields.certifications = certCheck.items;
  }
  if (links && typeof links === 'object') updateFields.links = links;
  if (privacy && typeof privacy === 'object') {
    const currentPrivacy = user.privacy || {
      showPhoneToCompanies: true,
      showEmailToCompanies: true,
      isProfilePublic: true
    };
    updateFields.privacy = {
      showPhoneToCompanies: typeof privacy.showPhoneToCompanies === 'boolean'
        ? privacy.showPhoneToCompanies
        : currentPrivacy.showPhoneToCompanies !== false,
      showEmailToCompanies: typeof privacy.showEmailToCompanies === 'boolean'
        ? privacy.showEmailToCompanies
        : currentPrivacy.showEmailToCompanies !== false,
      isProfilePublic: typeof privacy.isProfilePublic === 'boolean'
        ? privacy.isProfilePublic
        : currentPrivacy.isProfilePublic !== false
    };
  }

  if (themePreference !== undefined) {
    if (themePreference !== 'light' && themePreference !== 'dark') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Preferencia de tema inválida. Valores permitidos: light, dark.' }));
    }
    updateFields.themePreference = themePreference;
  }

  const usersCol = getCollection('users');
  if (Object.keys(updateFields).length > 0) {
    updateFields.updatedAt = new Date();
    await usersCol.updateOne({ _id: user._id }, { $set: updateFields });
  }

  const updatedUser = await usersCol.findOne({ _id: user._id });
  const safeUser = sanitizeUser(updatedUser);

  // Update session
  await refreshUserSession(user._id, updatedUser);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Perfil actualizado con éxito.',
    user: safeUser
  }));
}

export async function refreshUserSession(userId, updatedUserDoc) {
  if (!userId || !updatedUserDoc) return;
  if (['Bloqueada', 'Suspendida', 'Inactiva'].includes(updatedUserDoc.status)) {
    await invalidateUserSessions(userId);
    return;
  }
  const safeUser = sanitizeUser(updatedUserDoc);
  for (const [token, sessionUser] of activeSessions.entries()) {
    if (sessionUser._id === userId) {
      activeSessions.set(token, safeUser);
    }
  }
}

export async function invalidateUserSessions(userId) {
  if (!userId) return;
  for (const [token, sessionUser] of activeSessions.entries()) {
    if (sessionUser._id === userId) {
      activeSessions.delete(token);
    }
  }
  if (isConnectedToMongo()) {
    await getCollection('sessions').deleteMany({ userId });
  }
}

export async function authenticateRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  let sessionUser = activeSessions.get(token) || null;
  if (!sessionUser && isConnectedToMongo()) {
    const dbSession = await getCollection('sessions').findOne({ _id: token });
    if (dbSession && dbSession.userId) {
      sessionUser = { _id: dbSession.userId };
    }
  }

  if (!sessionUser) return null;

  if (isConnectedToMongo()) {
    const freshUser = await getCollection('users').findOne({ _id: sessionUser._id });
    if (!freshUser || ['Bloqueada', 'Suspendida', 'Inactiva'].includes(freshUser.status)) {
      await invalidateUserSessions(sessionUser._id);
      return null;
    }
    const safeUser = sanitizeUser(freshUser);
    activeSessions.set(token, safeUser);
    return safeUser;
  }

  if (['Bloqueada', 'Suspendida', 'Inactiva'].includes(sessionUser.status)) {
    activeSessions.delete(token);
    return null;
  }

  return sessionUser;
}

function recordFailedAttempt(email) {
  const current = failedAttempts.get(email) || { count: 0, lockedUntil: 0 };
  current.count += 1;
  if (current.count >= 5) {
    current.lockedUntil = Date.now() + 60 * 1000; // 1 minute lockout
  }
  failedAttempts.set(email, current);
}

export function sanitizeUser(user) {
  const clone = { ...user };
  delete clone.passwordHash;
  clone.themePreference = clone.themePreference === 'dark' ? 'dark' : 'light';
  clone.mustChangePassword = Boolean(clone.mustChangePassword);
  return clone;
}

export async function changePassword(req, res, user, body) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado.' }));
  }

  const { currentPassword, newPassword } = body || {};
  if (!newPassword || newPassword.length < 6) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' }));
  }

  const usersCol = getCollection('users');
  const freshUser = await usersCol.findOne({ _id: user._id });
  if (!freshUser) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Usuario no encontrado.' }));
  }

  if (!freshUser.mustChangePassword && currentPassword) {
    const valid = bcrypt.compareSync(currentPassword, freshUser.passwordHash);
    if (!valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La contraseña actual es incorrecta.' }));
    }
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await usersCol.updateOne({ _id: user._id }, {
    $set: {
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date()
    }
  });

  await refreshUserSession(user._id, await usersCol.findOne({ _id: user._id }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ message: 'Contraseña actualizada correctamente.' }));
}

