import { getCollection } from '../config/db.js';

export async function listArticles(req, res, queryParams) {
  const articlesCol = getCollection('articles');
  const filter = {};
  if (queryParams.category && queryParams.category !== 'Todos') {
    filter.category = queryParams.category;
  }
  const articles = await articlesCol.find(filter).toArray();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ articles }));
}

export async function getArticleById(req, res, articleId) {
  const articlesCol = getCollection('articles');
  const article = await articlesCol.findOne({ _id: articleId });

  if (!article) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Artículo no encontrado.' }));
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ article }));
}
