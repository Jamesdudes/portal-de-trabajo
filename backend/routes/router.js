import url from 'url';
import {
  login,
  register,
  getCurrentUser,
  updateProfile,
  changePassword,
  authenticateRequest
} from '../controllers/authController.js';
import {
  listJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob
} from '../controllers/jobsController.js';
import {
  listCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany
} from '../controllers/companiesController.js';
import {
  listApplications,
  applyToJob,
  updateApplicationStatus
} from '../controllers/appsController.js';
import {
  listAlerts,
  createAlert,
  toggleAlert,
  deleteAlert
} from '../controllers/alertsController.js';
import {
  listReviews,
  createReview
} from '../controllers/reviewsController.js';
import {
  listForums,
  createThread,
  addReply
} from '../controllers/forumsController.js';
import {
  listArticles,
  getArticleById
} from '../controllers/articlesController.js';
import {
  getPublicStats,
  getStats,
  listUsers,
  toggleUserStatus,
  updateUser,
  resetUserPassword,
  getAuditLogs,
  moderateItem
} from '../controllers/adminController.js';
import {
  uploadFile,
  getFile,
  deleteFile
} from '../controllers/filesController.js';
import { connectDB, isConnectedToMongo, getMongoStatus } from '../config/db.js';

export async function handleApiRoute(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();
    const query = parsedUrl.query;

    // Authenticate optional user
    const user = await authenticateRequest(req);

    // Parse JSON body if present
    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        body = await parseJsonBody(req);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'JSON inválido en el cuerpo de la solicitud.' }));
      }
    }

  // Diagnostics & DB Status endpoint
  if (pathname === '/api/status' && method === 'GET') {
    if (query.reconnect === '1' && !isConnectedToMongo()) {
      await connectDB().catch(() => {});
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const dbStatus = getMongoStatus();
    return res.end(JSON.stringify({
      status: 'online',
      nodeVersion: process.version,
      ...dbStatus,
      time: new Date().toISOString()
    }));
  }

  // --- Auth endpoints ---
  if (pathname === '/api/auth/login' && method === 'POST') {
    return await login(req, res, body);
  }
  if (pathname === '/api/auth/register' && method === 'POST') {
    return await register(req, res, body);
  }
  if (pathname === '/api/auth/me' && method === 'GET') {
    return await getCurrentUser(req, res, user);
  }
  if (pathname === '/api/auth/profile' && method === 'PUT') {
    return await updateProfile(req, res, user, body);
  }
  if (pathname === '/api/auth/change-password' && method === 'PUT') {
    return await changePassword(req, res, user, body);
  }

  if (pathname === '/api/stats/public' && method === 'GET') {
    return await getPublicStats(req, res);
  }

  // --- Companies endpoints ---
  if (pathname === '/api/companies' && method === 'GET') {
    return await listCompanies(req, res, user, query);
  }
  if (pathname === '/api/companies' && method === 'POST') {
    return await createCompany(req, res, user, body);
  }
  const companyMatch = pathname.match(/^\/api\/companies\/([a-zA-Z0-9_-]+)$/);
  if (companyMatch) {
    const companyId = companyMatch[1];
    if (method === 'GET') return await getCompanyById(req, res, user, companyId);
    if (method === 'PUT') return await updateCompany(req, res, user, companyId, body);
    if (method === 'DELETE') return await deleteCompany(req, res, user, companyId);
  }

  // --- Jobs endpoints ---
  if (pathname === '/api/jobs' && method === 'GET') {
    return await listJobs(req, res, user, query);
  }
  if (pathname === '/api/jobs' && method === 'POST') {
    return await createJob(req, res, user, body);
  }

  const jobMatch = pathname.match(/^\/api\/jobs\/([a-zA-Z0-9_-]+)$/);
  if (jobMatch) {
    const jobId = jobMatch[1];
    if (method === 'GET') return await getJobById(req, res, user, jobId);
    if (method === 'PUT') return await updateJob(req, res, user, jobId, body);
    if (method === 'DELETE') return await deleteJob(req, res, user, jobId, query);
  }

  // --- Applications endpoints ---
  if (pathname === '/api/applications' && method === 'GET') {
    return await listApplications(req, res, user, query);
  }
  if (pathname === '/api/applications' && method === 'POST') {
    return await applyToJob(req, res, user, body);
  }
  const appMatch = pathname.match(/^\/api\/applications\/([a-zA-Z0-9_-]+)\/status$/);
  if (appMatch && method === 'PUT') {
    return await updateApplicationStatus(req, res, user, appMatch[1], body);
  }

  // --- Alerts endpoints ---
  if (pathname === '/api/alerts' && method === 'GET') {
    return await listAlerts(req, res, user);
  }
  if (pathname === '/api/alerts' && method === 'POST') {
    return await createAlert(req, res, user, body);
  }
  const alertToggleMatch = pathname.match(/^\/api\/alerts\/([a-zA-Z0-9_-]+)\/toggle$/);
  if (alertToggleMatch && method === 'PATCH') {
    return await toggleAlert(req, res, user, alertToggleMatch[1]);
  }
  const alertDeleteMatch = pathname.match(/^\/api\/alerts\/([a-zA-Z0-9_-]+)$/);
  if (alertDeleteMatch && method === 'DELETE') {
    return await deleteAlert(req, res, user, alertDeleteMatch[1]);
  }

  // --- Reviews endpoints ---
  if (pathname === '/api/reviews' && method === 'GET') {
    return await listReviews(req, res, query);
  }
  if (pathname === '/api/reviews' && method === 'POST') {
    return await createReview(req, res, user, body);
  }

  // --- Forums endpoints ---
  if (pathname === '/api/forums' && method === 'GET') {
    return await listForums(req, res, query);
  }
  if (pathname === '/api/forums' && method === 'POST') {
    return await createThread(req, res, user, body);
  }
  const forumReplyMatch = pathname.match(/^\/api\/forums\/([a-zA-Z0-9_-]+)\/replies$/);
  if (forumReplyMatch && method === 'POST') {
    return await addReply(req, res, user, forumReplyMatch[1], body);
  }

  // --- Articles endpoints ---
  if (pathname === '/api/articles' && method === 'GET') {
    return await listArticles(req, res, query);
  }
  const articleMatch = pathname.match(/^\/api\/articles\/([a-zA-Z0-9_-]+)$/);
  if (articleMatch && method === 'GET') {
    return await getArticleById(req, res, articleMatch[1]);
  }

  // --- Admin endpoints ---
  if (pathname === '/api/admin/stats' && method === 'GET') {
    return await getStats(req, res, user);
  }
  if (pathname === '/api/admin/users' && method === 'GET') {
    return await listUsers(req, res, user, query);
  }
  const userToggleMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)\/(toggle|suspend|activate)$/);
  if (userToggleMatch && ['PATCH', 'POST'].includes(method)) {
    const action = userToggleMatch[2];
    const targetStatus = action === 'suspend' ? 'Suspendida' : (action === 'activate' ? 'Activa' : body?.status);
    return await toggleUserStatus(req, res, user, userToggleMatch[1], { ...body, status: targetStatus });
  }
  if (pathname === '/api/admin/logs' && method === 'GET') {
    return await getAuditLogs(req, res, user);
  }
  if (pathname === '/api/admin/moderate' && method === 'POST') {
    return await moderateItem(req, res, user, body);
  }
  const adminUserEditMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
  if (adminUserEditMatch && method === 'PUT') {
    return await updateUser(req, res, user, adminUserEditMatch[1], body);
  }
  const adminResetPwdMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)\/reset-password$/);
  if (adminResetPwdMatch && method === 'POST') {
    return await resetUserPassword(req, res, user, adminResetPwdMatch[1]);
  }
  if (pathname === '/api/admin/structure' && method === 'GET') {
    if (!user || user.role !== 'admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Acceso restringido a administradores.' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      title: 'Portal de Trabajo | Estructura y Arquitectura del Sistema',
      architecture: 'HTML5 Semántico, CSS3 Puro, JavaScript Vanilla, Node.js HTTP Nativo, MongoDB Driver Oficial 7.0',
      database: 'portal_trabajo',
      storage: 'GridFS (uploads.files / uploads.chunks)',
      collections: ['users', 'companies', 'jobs', 'applications', 'alerts', 'reviews', 'forums', 'articles', 'moderation_logs', 'sessions'],
      modules: {
        public: ['P-01', 'P-02', 'P-03', 'P-04', 'U-04', 'R-01', 'R-02', 'R-03'],
        candidate: ['U-01', 'U-02', 'U-03'],
        employer: ['E-01', 'E-02', 'E-03'],
        admin: ['A-01', 'DOC']
      }
    }));
  }

  // --- GridFS File endpoints ---
  if (pathname === '/api/files/upload' && method === 'POST') {
    return await uploadFile(req, res, user, body);
  }
  const fileDownloadMatch = pathname.match(/^\/api\/files\/([a-fA-F0-9]{24})\/download$/);
  if (fileDownloadMatch && method === 'GET') {
    return await getFile(req, res, user, fileDownloadMatch[1], true);
  }
  const fileMatch = pathname.match(/^\/api\/files\/([a-fA-F0-9]{24})$/);
  if (fileMatch) {
    if (method === 'GET') return await getFile(req, res, user, fileMatch[1], false);
    if (method === 'DELETE') return await deleteFile(req, res, user, fileMatch[1]);
  }

  // Fallback 404 for unhandled API routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: `Ruta API no encontrada: ${method} ${pathname}` }));
} catch (error) {
  console.error('[API ERROR]:', error.message);
  const isDbError = error.message && error.message.includes('[ERROR DE BASE DE DATOS]');
  res.writeHead(isDbError ? 503 : 500, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    error: error.message || 'Error interno del servidor',
    code: isDbError ? 'MONGODB_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR',
    status: 'error'
  }));
}
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 16 * 1024 * 1024) { // 16MB limit for file uploads
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
