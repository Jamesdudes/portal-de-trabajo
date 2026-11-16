/**
 * Cliente de API REST nativo en JavaScript Vanilla (fetch)
 * Se comunica con el backend Node.js
 */

const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('pt_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function toQueryString(params = {}) {
  const cleaned = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      cleaned[k] = v;
    }
  }
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `?${qs}` : '';
}

function handleUnauthorizedIfTokenPresent(res, endpoint, message) {
  if (
    res.status === 401 &&
    localStorage.getItem('pt_token') &&
    !String(endpoint).startsWith('/auth/login')
  ) {
    localStorage.removeItem('pt_token');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pt:unauthorized', {
        detail: { endpoint, message: message || 'Su sesión ha expirado o fue revocada.' }
      }));
    }
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const { silent = false, ...fetchOptions } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(fetchOptions.headers || {})
  };

  try {
    const res = await fetch(url, { ...fetchOptions, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || `Error en la solicitud (${res.status})`;
      handleUnauthorizedIfTokenPresent(res, endpoint, msg);
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    if (!silent) {
      console.error(`[API Error] ${endpoint}:`, err);
    }
    throw err;
  }
}

export const api = {
  // Diagnóstico y estadísticas públicas
  getStatus: (reconnect = false) => request(reconnect ? '/status?reconnect=1' : '/status'),
  getPublicStats: (options = {}) => request('/stats/public', options),

  // Autenticación
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  register: (payload) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getMe: () => request('/auth/me'),
  updateProfile: (profileData) => request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData)
  }),

  // Empresas (E-01, U-04, A-01)
  getCompanies: (params = {}) => request(`/companies${toQueryString(params)}`),
  getCompany: (id) => request(`/companies/${id}`),
  createCompany: (payload) => request('/companies', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateCompany: (id, payload) => request(`/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  deleteCompany: (id) => request(`/companies/${id}`, {
    method: 'DELETE'
  }),

  // Ofertas de Empleo (P-01, P-02, P-03, E-02)
  getJobs: (params = {}) => request(`/jobs${toQueryString(params)}`),
  getJob: (id) => request(`/jobs/${id}`),
  createJob: (payload) => request('/jobs', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateJob: (id, payload) => request(`/jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  deleteJob: (id, hard = false) => request(`/jobs/${id}${hard ? '?hard=true' : ''}`, {
    method: 'DELETE'
  }),

  // Postulaciones (U-02, E-03)
  getApplications: (params = {}) => request(`/applications${toQueryString(params)}`),
  applyToJob: (payload) => request('/applications', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateApplicationStatus: (appId, status, note) => request(`/applications/${appId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, note })
  }),

  // Alertas (U-03)
  getAlerts: () => request('/alerts'),
  createAlert: (payload) => request('/alerts', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  toggleAlert: (id) => request(`/alerts/${id}/toggle`, {
    method: 'PATCH'
  }),
  deleteAlert: (id) => request(`/alerts/${id}`, {
    method: 'DELETE'
  }),

  // Valoraciones de Empresas (U-04)
  getReviews: (params = {}) => request(`/reviews${toQueryString(params)}`),
  createReview: (payload) => request('/reviews', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Foros (R-03)
  getForums: (params = {}) => request(`/forums${toQueryString(params)}`),
  createThread: (payload) => request('/forums', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  addReply: (threadId, content) => request(`/forums/${threadId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ content })
  }),

  // Artículos y Recursos (R-01, R-02)
  getArticles: (params = {}) => request(`/articles${toQueryString(params)}`),
  getArticle: (id) => request(`/articles/${id}`),

  // Administración (A-01)
  getStats: () => request('/admin/stats'),
  getUsers: () => request('/admin/users'),
  toggleUserStatus: (userId, body = {}) => request(`/admin/users/${userId}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  }),
  suspendUser: (userId, reason) => request(`/admin/users/${userId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  activateUser: (userId, reason) => request(`/admin/users/${userId}/activate`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  getAuditLogs: () => request('/admin/logs'),
  moderateItem: (payload) => request('/admin/moderate', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  adminUpdateUser: (userId, payload) => request(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  adminResetPassword: (userId) => request(`/admin/users/${userId}/reset-password`, {
    method: 'POST'
  }),
  changePassword: (payload) => request('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  getStructure: () => request('/admin/structure'),

  // Carga y Gestión de Archivos en MongoDB GridFS
  uploadFile: (payload) => request('/files/upload', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  deleteFile: (fileId) => request(`/files/${fileId}`, {
    method: 'DELETE'
  }),
  fetchProtectedFileBlob: async (fileIdOrUrl, isDownload = false) => {
    const cleanId = String(fileIdOrUrl).replace(/^\/api\/files\//, '').replace(/\/download$/, '');
    const endpoint = `${API_BASE}/files/${cleanId}${isDownload ? '/download' : ''}`;
    const res = await fetch(endpoint, {
      headers: {
        ...getAuthHeader()
      }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error || `No autorizado o error al acceder al archivo (${res.status}).`;
      handleUnauthorizedIfTokenPresent(res, `/files/${cleanId}`, msg);
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const fileName = match ? decodeURIComponent(match[1]) : 'archivo';
    return { blob, fileName, mimeType: blob.type };
  }
};
