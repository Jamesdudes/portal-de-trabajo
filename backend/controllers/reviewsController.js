import { getCollection } from '../config/db.js';

export async function listReviews(req, res, queryParams) {
  const reviewsCol = getCollection('reviews');
  const filter = {};
  if (queryParams.companyId) {
    filter.companyId = queryParams.companyId;
  }
  // Visitors see Aprobada
  if (!queryParams.all) {
    filter.status = 'Aprobada';
  }

  const reviews = await reviewsCol.find(filter).toArray();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ reviews, total: reviews.length }));
}

export async function createReview(req, res, user, body) {
  if (!user || user.role !== 'candidato') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo candidatos pueden enviar valoraciones de empresas.' }));
  }

  const { companyId, rating, title, comment, candidateRole, scores } = body || {};

  const cleanCompanyId = typeof companyId === 'string' ? companyId.trim() : '';
  if (!cleanCompanyId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debe seleccionar una empresa válida para valorar.' }));
  }

  const numRating = Number(rating);
  if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La calificación general debe estar entre 1 y 5 estrellas.' }));
  }

  if (typeof title !== 'string' || title.trim().length < 5) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El título de la valoración debe contener al menos 5 caracteres.' }));
  }

  if (typeof comment !== 'string' || comment.trim().length < 15) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'El comentario debe contener al menos 15 caracteres descriptivos.' }));
  }

  const companiesCol = getCollection('companies');
  const company = await companiesCol.findOne({ _id: cleanCompanyId });

  if (!company) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'La empresa seleccionada no existe.' }));
  }

  if (company.status !== 'Activa') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Solo se permiten valoraciones para empresas activas.' }));
  }

  const reviewsCol = getCollection('reviews');
  // Check if candidate already reviewed this company (identified by MongoDB company._id)
  const existing = await reviewsCol.findOne({ companyId: company._id, candidateId: user._id });
  if (existing) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Ya has emitido una valoración para esta empresa anteriormente.' }));
  }

  const newReview = {
    _id: `rev-${Date.now()}`,
    companyId: company._id,
    companyName: company.name,
    candidateId: user._id,
    candidateName: `${user.firstName} ${user.lastName}`,
    candidateRole: candidateRole ? candidateRole.trim() : (user.title || 'Candidato Profesional'),
    rating: numRating,
    title: title.trim(),
    comment: comment.trim(),
    date: new Date().toISOString().split('T')[0],
    status: 'Aprobada',
    scores: scores || {
      culture: numRating,
      salary: numRating,
      growth: numRating,
      workLife: numRating
    }
  };

  await reviewsCol.insertOne(newReview);

  // Recalculate company rating
  const allCompanyReviews = await reviewsCol.find({ companyId: company._id, status: 'Aprobada' }).toArray();
  const avg = allCompanyReviews.length
    ? Number((allCompanyReviews.reduce((sum, r) => sum + r.rating, 0) / allCompanyReviews.length).toFixed(1))
    : numRating;

  await companiesCol.updateOne(
    { _id: company._id },
    {
      $set: {
        averageRating: avg,
        reviewCount: allCompanyReviews.length
      }
    }
  );

  res.writeHead(201, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    message: 'Valoración publicada exitosamente.',
    review: newReview
  }));
}
