import { ObjectId } from 'mongodb';
import { getGridFSBucket, getCollection } from '../config/db.js';
import { sanitizeUser, refreshUserSession } from './authController.js';

// MIME and Magic Bytes Definitions
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

const ALLOWED_DOC_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc']
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DOC_SIZE = 10 * 1024 * 1024;   // 10 MB

function validateMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (mimeType === 'image/webp') {
    // RIFF....WEBP
    return (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    );
  }
  if (mimeType === 'application/pdf') {
    return buffer.slice(0, 4).toString() === '%PDF';
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // PK zip header for docx
    return buffer[0] === 0x50 && buffer[1] === 0x4B;
  }
  if (mimeType === 'application/msword') {
    return (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) ||
           (buffer[0] === 0x50 && buffer[1] === 0x4B);
  }
  return false;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Carga de archivos a MongoDB GridFS
 * Soporta fotografías de perfil, portadas/banners, logos empresariales y currículums (PDF/DOCX)
 */
export async function uploadFile(req, res, user, body) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debes iniciar sesión para subir archivos.' }));
  }

  const { fileName, mimeType, base64Data, fileType, companyId } = body || {};

  if (!fileName || !mimeType || !base64Data || !fileType) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Faltan parámetros obligatorios (fileName, mimeType, base64Data, fileType).' }));
  }

  const validFileTypes = ['avatar', 'banner', 'cv', 'companyLogo', 'companyBanner'];
  if (!validFileTypes.includes(fileType)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Tipo de archivo inválido. Permitidos: ${validFileTypes.join(', ')}.` }));
  }

  // Decode buffer
  let buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Datos base64 corruptos o ilegibles.' }));
  }

  if (buffer.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El archivo está vacío (0 bytes).' }));
  }

  // Type-specific validations
  const isImage = ['avatar', 'banner', 'companyLogo', 'companyBanner'].includes(fileType);
  const isDoc = fileType === 'cv';

  if (isImage) {
    if (buffer.length > MAX_IMAGE_SIZE) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `La imagen excede el límite máximo permitido de 5 MB (tamaño actual: ${formatBytes(buffer.length)}).` }));
    }

    const cleanMime = mimeType.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES[cleanMime]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Formato de imagen no permitido. Solo se aceptan archivos JPG, PNG y WEBP.' }));
    }

    if (!validateMagicBytes(buffer, cleanMime)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El contenido del archivo no coincide con una imagen real válida (JPG, PNG o WEBP).' }));
    }
  } else if (isDoc) {
    if (buffer.length > MAX_DOC_SIZE) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `El currículum excede el límite máximo de 10 MB (tamaño actual: ${formatBytes(buffer.length)}).` }));
    }

    const cleanMime = mimeType.toLowerCase();
    if (!ALLOWED_DOC_TYPES[cleanMime]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Formato de currículum no permitido. Solo se aceptan documentos PDF y DOCX.' }));
    }

    if (!validateMagicBytes(buffer, cleanMime)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'El contenido del archivo no coincide con un documento PDF o DOCX legítimo.' }));
    }
  }

  const bucket = getGridFSBucket('uploads');
  const usersCol = getCollection('users');
  const companiesCol = getCollection('companies');

  // Remove previous file of this type from GridFS to avoid orphan chunks
  let prevFileId = null;
  if (['avatar', 'banner', 'cv'].includes(fileType)) {
    const freshUser = await usersCol.findOne({ _id: user._id });
    if (fileType === 'avatar' && freshUser.avatarFileId) prevFileId = freshUser.avatarFileId;
    if (fileType === 'banner' && freshUser.bannerFileId) prevFileId = freshUser.bannerFileId;
    if (fileType === 'cv' && freshUser.cv && freshUser.cv.fileId) prevFileId = freshUser.cv.fileId;
  } else if (['companyLogo', 'companyBanner'].includes(fileType)) {
    if (!['empleador', 'admin'].includes(user.role)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Solo cuentas de empresa o administradores pueden subir archivos corporativos.' }));
    }
    const targetCompId = user.role === 'admin' ? (companyId || user.companyId) : user.companyId;
    if (!targetCompId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Su cuenta no tiene una empresa asociada para cargar archivos corporativos.' }));
    }
    const freshComp = await companiesCol.findOne({ _id: targetCompId });
    if (!freshComp) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'La empresa asociada no existe en la base de datos.' }));
    }
    if (fileType === 'companyLogo' && freshComp.logoFileId) prevFileId = freshComp.logoFileId;
    if (fileType === 'companyBanner' && freshComp.bannerFileId) prevFileId = freshComp.bannerFileId;
  }

  if (prevFileId && ObjectId.isValid(prevFileId)) {
    try {
      await bucket.delete(new ObjectId(prevFileId));
    } catch (e) {
      // Ignore if already deleted
    }
  }

  // Upload to GridFS
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const resolvedCompanyId = ['companyLogo', 'companyBanner'].includes(fileType)
    ? (user.role === 'admin' ? (companyId || user.companyId) : user.companyId)
    : undefined;

  const uploadStream = bucket.openUploadStream(safeFileName, {
    metadata: {
      ownerId: user._id,
      ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
      fileType,
      mimeType,
      originalName: fileName,
      size: buffer.length,
      uploadedAt: new Date()
    }
  });

  await new Promise((resolve, reject) => {
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
    uploadStream.end(buffer);
  });

  const newFileId = uploadStream.id.toString();
  const fileUrl = `/api/files/${newFileId}`;
  const downloadUrl = `/api/files/${newFileId}/download`;

  let updatedUser = null;
  let updatedCompany = null;

  // Persist relation in MongoDB
  if (fileType === 'avatar') {
    await usersCol.updateOne(
      { _id: user._id },
      { $set: { avatar: fileUrl, avatarFileId: newFileId, updatedAt: new Date() } }
    );
    updatedUser = await usersCol.findOne({ _id: user._id });
  } else if (fileType === 'banner') {
    await usersCol.updateOne(
      { _id: user._id },
      { $set: { banner: fileUrl, bannerFileId: newFileId, updatedAt: new Date() } }
    );
    updatedUser = await usersCol.findOne({ _id: user._id });
  } else if (fileType === 'cv') {
    const cvMeta = {
      fileId: newFileId,
      fileName,
      fileSize: formatBytes(buffer.length),
      mimeType,
      uploadDate: new Date().toISOString().split('T')[0],
      url: downloadUrl,
      viewUrl: fileUrl
    };
    await usersCol.updateOne(
      { _id: user._id },
      { $set: { cv: cvMeta, updatedAt: new Date() } }
    );
    updatedUser = await usersCol.findOne({ _id: user._id });
  } else if (fileType === 'companyLogo') {
    const targetCompId = resolvedCompanyId;
    if (targetCompId) {
      await companiesCol.updateOne(
        { _id: targetCompId },
        { $set: { logo: fileUrl, logoFileId: newFileId, updatedAt: new Date() } }
      );
      await getCollection('jobs').updateMany({ companyId: targetCompId }, { $set: { companyLogo: fileUrl } });
      await getCollection('applications').updateMany({ companyId: targetCompId }, { $set: { companyLogo: fileUrl } });
      updatedCompany = await companiesCol.findOne({ _id: targetCompId });
    }
  } else if (fileType === 'companyBanner') {
    const targetCompId = resolvedCompanyId;
    if (targetCompId) {
      await companiesCol.updateOne(
        { _id: targetCompId },
        { $set: { banner: fileUrl, bannerFileId: newFileId, updatedAt: new Date() } }
      );
      updatedCompany = await companiesCol.findOne({ _id: targetCompId });
    }
  }

  if (updatedUser) {
    await refreshUserSession(user._id, updatedUser);
  }

  res.writeHead(201, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Archivo cargado y guardado exitosamente en MongoDB GridFS.',
    fileId: newFileId,
    url: fileUrl,
    downloadUrl,
    fileName,
    fileSize: formatBytes(buffer.length),
    ...(updatedUser ? { user: sanitizeUser(updatedUser) } : {}),
    ...(updatedCompany ? { company: updatedCompany } : {})
  }));
}

/**
 * Consulta y descarga de archivos desde MongoDB GridFS
 */
export async function getFile(req, res, user, fileId, isDownload = false) {
  if (!fileId || !ObjectId.isValid(fileId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Identificador de archivo inválido.' }));
  }

  const filesCol = getCollection('uploads.files');
  const fileDoc = await filesCol.findOne({ _id: new ObjectId(fileId) });

  const ownerId = fileDoc?.metadata?.ownerId;
  const fileType = fileDoc?.metadata?.fileType;
  const isCorporateAsset = Boolean(fileDoc && ['companyLogo', 'companyBanner'].includes(fileType));

  // Exigir autenticación antes de revelar existencia si no es un recurso corporativo público válido
  if (!isCorporateAsset && !user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debe iniciar sesión para acceder a este archivo.' }));
  }

  if (!fileDoc) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Archivo no encontrado en la base de datos.' }));
  }

  if (!isCorporateAsset) {
    const isOwner = Boolean(ownerId && ownerId === user._id);
    if (!isOwner) {
      if (fileType === 'cv') {
        if (user.role !== 'empleador' || !user.companyId) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'No tienes permiso para acceder a este currículum.' }));
        }
        const appsCol = getCollection('applications');
        const hasApplication = await appsCol.findOne({
          companyId: user.companyId,
          $or: [
            { cvFileId: fileId },
            ...(ownerId ? [{ candidateId: ownerId }] : [])
          ]
        });
        if (!hasApplication) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Solo puedes consultar currículums de candidatos que hayan aplicado a ofertas de tu empresa.' }));
        }
      } else {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'No tienes permiso para acceder a este archivo.' }));
      }
    }
  }

  const mimeType = fileDoc.metadata?.mimeType || 'application/octet-stream';
  const originalName = fileDoc.metadata?.originalName || fileDoc.filename;
  const dispositionType = isDownload ? 'attachment' : 'inline';

  const responseHeaders = {
    'Content-Type': mimeType,
    'Content-Length': fileDoc.length,
    'Content-Disposition': `${dispositionType}; filename="${encodeURIComponent(originalName)}"`,
    'Cache-Control': isCorporateAsset ? 'public, max-age=300' : 'private, no-store'
  };

  const bucket = getGridFSBucket('uploads');
  const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));
  const isWritableStream = Boolean(
    res &&
    typeof res.write === 'function' &&
    typeof res.on === 'function' &&
    typeof res.once === 'function' &&
    typeof res.emit === 'function'
  );

  await new Promise((resolve) => {
    let settled = false;
    const finishOnce = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    if (isWritableStream) {
      downloadStream.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Error al transmitir archivo desde GridFS.' }));
        } else if (!res.writableEnded && typeof res.destroy === 'function') {
          res.destroy(err);
        }
        finishOnce();
      });

      res.on('error', () => {
        if (typeof downloadStream.destroy === 'function') {
          downloadStream.destroy();
        }
        finishOnce();
      });

      res.on('finish', finishOnce);
      res.on('close', finishOnce);

      if (!res.headersSent) {
        res.writeHead(200, responseHeaders);
      }
      downloadStream.pipe(res);
    } else {
      const chunks = [];
      downloadStream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      downloadStream.on('end', () => {
        res.writeHead(200, responseHeaders);
        res.end(Buffer.concat(chunks));
        finishOnce();
      });
      downloadStream.on('error', () => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al transmitir archivo desde GridFS.' }));
        finishOnce();
      });
    }
  });
}

/**
 * Eliminación de archivos de MongoDB GridFS y desvinculación
 */
export async function deleteFile(req, res, user, fileId) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No autorizado.' }));
  }

  if (!fileId || !ObjectId.isValid(fileId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Identificador de archivo inválido.' }));
  }

  const filesCol = getCollection('uploads.files');
  const fileDoc = await filesCol.findOne({ _id: new ObjectId(fileId) });

  if (!fileDoc) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El archivo ya no existe en el almacenamiento.' }));
  }

  // Owner, same company for corporate assets, or admin permission
  const isOwner = fileDoc.metadata?.ownerId === user._id;
  const isAdmin = user.role === 'admin';
  const isSameCompanyCorporate =
    ['companyLogo', 'companyBanner'].includes(fileDoc.metadata?.fileType) &&
    user.role === 'empleador' &&
    Boolean(user.companyId && fileDoc.metadata?.companyId === user.companyId);

  if (!isOwner && !isAdmin && !isSameCompanyCorporate) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'No tienes permiso para eliminar este archivo.' }));
  }

  const bucket = getGridFSBucket('uploads');
  await bucket.delete(new ObjectId(fileId));

  const fileType = fileDoc.metadata?.fileType;
  const ownerId = fileDoc.metadata?.ownerId;
  const targetCompanyId = fileDoc.metadata?.companyId || (!isAdmin ? user.companyId : null);
  const usersCol = getCollection('users');
  const companiesCol = getCollection('companies');

  let updatedUser = null;
  let updatedCompany = null;

  if (fileType === 'avatar' && ownerId) {
    await usersCol.updateOne(
      { _id: ownerId },
      { $set: { avatar: '', avatarFileId: null, updatedAt: new Date() } }
    );
    const updatedOwner = await usersCol.findOne({ _id: ownerId });
    await refreshUserSession(ownerId, updatedOwner);
    if (ownerId === user._id) updatedUser = updatedOwner;
  } else if (fileType === 'banner' && ownerId) {
    await usersCol.updateOne(
      { _id: ownerId },
      { $set: { banner: '', bannerFileId: null, updatedAt: new Date() } }
    );
    const updatedOwner = await usersCol.findOne({ _id: ownerId });
    await refreshUserSession(ownerId, updatedOwner);
    if (ownerId === user._id) updatedUser = updatedOwner;
  } else if (fileType === 'cv' && ownerId) {
    await usersCol.updateOne(
      { _id: ownerId },
      { $unset: { cv: '' }, $set: { updatedAt: new Date() } }
    );
    const updatedOwner = await usersCol.findOne({ _id: ownerId });
    await refreshUserSession(ownerId, updatedOwner);
    if (ownerId === user._id) updatedUser = updatedOwner;
  } else if (fileType === 'companyLogo' && targetCompanyId) {
    await companiesCol.updateOne(
      { _id: targetCompanyId },
      { $set: { logo: '', logoFileId: null, updatedAt: new Date() } }
    );
    await getCollection('jobs').updateMany({ companyId: targetCompanyId }, { $set: { companyLogo: '' } });
    await getCollection('applications').updateMany({ companyId: targetCompanyId }, { $set: { companyLogo: '' } });
    updatedCompany = await companiesCol.findOne({ _id: targetCompanyId });
  } else if (fileType === 'companyBanner' && targetCompanyId) {
    await companiesCol.updateOne(
      { _id: targetCompanyId },
      { $set: { banner: '', bannerFileId: null, updatedAt: new Date() } }
    );
    updatedCompany = await companiesCol.findOne({ _id: targetCompanyId });
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Archivo eliminado con éxito de MongoDB GridFS.',
    fileId,
    ...(updatedUser ? { user: sanitizeUser(updatedUser) } : {}),
    ...(updatedCompany ? { company: updatedCompany } : {})
  }));
}
