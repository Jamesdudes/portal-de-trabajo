import { getCollection } from '../config/db.js';

export async function listForums(req, res, queryParams) {
  const forumsCol = getCollection('forums');
  const filter = {};
  if (queryParams.category && queryParams.category !== 'Todas') {
    filter.category = queryParams.category;
  }
  const forums = await forumsCol.find(filter).toArray();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ forums }));
}

export async function createThread(req, res, user, body) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debes iniciar sesión para abrir un nuevo debate en el foro.' }));
  }

  const { title, category, content } = body || {};

  if (!title || title.trim().length < 8) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El título del debate debe contener al menos 8 caracteres.' }));
  }

  if (!content || content.trim().length < 15) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El contenido de la consulta debe contener al menos 15 caracteres.' }));
  }

  const forumsCol = getCollection('forums');
  const newThread = {
    _id: `forum-${Date.now()}`,
    title: title.trim(),
    category: category || 'Comunidad y Orientación',
    authorId: user._id,
    authorName: `${user.firstName} ${user.lastName}`,
    authorRole: user.role === 'candidato' ? 'Candidato Profesional' : (user.role === 'admin' ? 'Administrador' : 'Empleador'),
    createdAt: new Date().toISOString().split('T')[0],
    viewsCount: 1,
    status: 'Activo',
    content: content.trim(),
    replies: []
  };

  await forumsCol.insertOne(newThread);

  res.writeHead(201, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Hilo de foro publicado correctamente.',
    thread: newThread
  }));
}

export async function addReply(req, res, user, threadId, body) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debes iniciar sesión para responder en el foro.' }));
  }

  const { content } = body || {};

  if (!content || content.trim().length < 5) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La respuesta debe tener al menos 5 caracteres.' }));
  }

  const forumsCol = getCollection('forums');
  const thread = await forumsCol.findOne({ _id: threadId });

  if (!thread) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debate no encontrado.' }));
  }

  const newReply = {
    id: `rep-${Date.now()}`,
    authorName: `${user.firstName} ${user.lastName}`,
    authorRole: user.role === 'candidato' ? 'Candidato Profesional' : (user.role === 'admin' ? 'Administrador' : 'Empleador'),
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    content: content.trim()
  };

  await forumsCol.updateOne(
    { _id: threadId },
    {
      $push: { replies: newReply },
      $inc: { viewsCount: 1 }
    }
  );

  const updatedThread = await forumsCol.findOne({ _id: threadId });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Respuesta añadida.',
    thread: updatedThread
  }));
}
