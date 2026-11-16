import { api } from './api.js';
import { state } from './state.js';
import { icons } from './icons.js';
import { phoneHelper, renderPhoneInputHtml } from './phoneInput.js';

window.phoneHelper = phoneHelper;

// DOM Containers
const appContent = document.getElementById('app-content');
const navLinksEl = document.getElementById('nav-links');
const navAuthEl = document.getElementById('nav-auth');
const modalContainer = document.getElementById('modal-container');

let currentDbStatus = null;
let currentViewedJob = null;
let currentCompanyData = null;
let adminActiveTab = 'usuarios';
let allAdminCompanies = [];
let allAdminJobs = [];

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCompanyLogo(logoUrl, companyName, size = 48, radius = 8) {
  const safeName = escapeHtml(companyName || 'Empresa');
  if (logoUrl && (String(logoUrl).startsWith('/api/files/') || /^https?:\/\//i.test(String(logoUrl)))) {
    return `<img src="${escapeHtml(logoUrl)}" alt="${safeName}" style="width: ${size}px; height: ${size}px; border-radius: ${radius}px; object-fit: cover; border: 1px solid var(--color-border); flex-shrink: 0;" />`;
  }
  return `<div style="width: ${size}px; height: ${size}px; border-radius: ${radius}px; background: var(--color-bg-subtle); border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: center; color: var(--color-primary-text); flex-shrink: 0;" aria-label="${safeName}">${icons.building(Math.round(size * 0.5))}</div>`;
}

function applyRoleBodyTheme() {
  const code = state.currentScreen;
  const user = state.currentUser;
  document.body.classList.remove('theme-publico', 'theme-candidato', 'theme-empleador', 'theme-admin');

  if (['U-01', 'U-02', 'U-03'].includes(code) || (user && user.role === 'candidato' && !['P-01', 'P-02', 'P-03', 'P-04', 'R-01', 'R-02', 'R-03', 'U-04'].includes(code))) {
    document.body.classList.add('theme-candidato');
  } else if (['E-01', 'E-02', 'E-03'].includes(code) || (user && user.role === 'empleador' && !['P-01', 'P-02', 'P-03', 'P-04', 'R-01', 'R-02', 'R-03', 'U-04'].includes(code))) {
    document.body.classList.add('theme-empleador');
  } else if (code === 'A-01' || code === 'DOC' || (user && user.role === 'admin' && !['P-01', 'P-02', 'P-03', 'P-04', 'R-01', 'R-02', 'R-03', 'U-04'].includes(code))) {
    document.body.classList.add('theme-admin');
  } else {
    document.body.classList.add('theme-publico');
  }
}

window.toggleMobileNav = (forceClose) => {
  const collapse = document.getElementById('nav-collapse');
  const btn = document.getElementById('mobile-menu-btn');
  if (!collapse || !btn) return;
  const isOpen = forceClose !== undefined ? !forceClose : collapse.classList.contains('is-open');
  if (isOpen) {
    collapse.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  } else {
    collapse.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
  }
};

function renderAccountThemeSettingsCard(user, btnClass = 'btn-primary') {
  const currentTheme = state.theme;
  return `
    <div class="card">
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
        ${icons.moon(18)} Preferencia de Tema (Modo Oscuro / Claro)
      </h3>
      <p style="font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: 1rem;">
        Personaliza tu experiencia visual. La selección se guarda automáticamente en tu cuenta en MongoDB y se conserva en todos tus dispositivos.
      </p>
      <div class="theme-selector-grid">
        <button type="button" class="theme-choice-btn ${currentTheme === 'light' ? 'active' : ''}" onclick="window.handleChangeAccountTheme('light')">
          ${icons.sun(16)} Modo Claro
        </button>
        <button type="button" class="theme-choice-btn ${currentTheme === 'dark' ? 'active' : ''}" onclick="window.handleChangeAccountTheme('dark')">
          ${icons.moon(16)} Modo Oscuro
        </button>
      </div>
    </div>
  `;
}

window.handleChangeAccountTheme = async (theme) => {
  try {
    const res = await api.updateProfile({ themePreference: theme });
    if (res.user) {
      state.setUser(res.user);
    } else {
      state.setTheme(theme, true);
    }
    state.showToast(`Tema actualizado a modo ${theme === 'dark' ? 'oscuro' : 'claro'}.`, 'success');
    renderScreen();
  } catch (err) {
    state.showToast(err.message || 'No se pudo guardar la preferencia de tema.', 'error');
  }
};

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
  let initialScreen = window.location.hash.replace('#', '') || 'P-01';

  window.addEventListener('pt:unauthorized', (e) => {
    if (state.currentUser || state.token) {
      state.clearUser();
      state.showToast(e.detail?.message || 'Tu sesión ha expirado o fue suspendida.', 'error');
      if (!['P-01', 'P-02', 'P-03', 'P-04', 'U-04', 'R-01', 'R-02', 'R-03'].includes(state.currentScreen)) {
        state.setScreen('P-01');
      }
    }
  });

  // Check MongoDB Connection Status on startup for internal telemetry
  try {
    currentDbStatus = await api.getStatus();
  } catch (err) {
    console.warn('[DB Status] Error al obtener estado de base de datos:', err);
  }

  // Restore authenticated session if token exists and DB is reachable
  if (state.token && currentDbStatus?.isMongoConnected !== false) {
    try {
      const res = await api.getMe();
      state.setUser(res.user);
      if (res.user?.mustChangePassword) {
        setTimeout(() => window.openMustChangePasswordModal(), 300);
      }
    } catch (e) {
      state.clearUser();
    }
  }

  // Restricción: Estructura (DOC) es exclusiva para rol admin
  if ((initialScreen === 'DOC' || initialScreen === 'ESTRUCTURA') && (!state.currentUser || state.currentUser.role !== 'admin')) {
    initialScreen = state.currentUser ? (state.currentUser.role === 'candidato' ? 'U-01' : (state.currentUser.role === 'empleador' ? 'E-02' : 'P-01')) : 'P-01';
  }

  // Subscribe state changes
  state.subscribe(() => {
    applyRoleBodyTheme();
    renderNavbar();
    renderScreen();
  });

  applyRoleBodyTheme();
  renderNavbar();
  state.setScreen(initialScreen);
});

// Window hashchange listener
window.addEventListener('hashchange', () => {
  const hashScreen = window.location.hash.replace('#', '');
  if (hashScreen && hashScreen !== state.currentScreen) {
    const user = state.currentUser;
    if ((hashScreen === 'DOC' || hashScreen === 'ESTRUCTURA') && (!user || user.role !== 'admin')) {
      state.showToast('Acceso restringido: La sección de Estructura es exclusiva para administradores.', 'error');
      const target = user ? (user.role === 'candidato' ? 'U-01' : (user.role === 'empleador' ? 'E-02' : 'P-01')) : 'P-01';
      window.location.hash = `#${target}`;
      state.setScreen(target);
      return;
    }
    state.setScreen(hashScreen);
  }
});

// Render Top Navigation based on active role with SVG Icons
function renderNavbar() {
  const user = state.currentUser;
  const current = state.currentScreen;
  const navbarEl = document.querySelector('header.navbar');
  if (navbarEl) {
    navbarEl.classList.toggle('is-authenticated', Boolean(user));
  }

  // Base navigation links
  let links = [
    { code: 'P-01', label: 'Inicio', icon: icons.home(16, 'inline-left') },
    { code: 'P-02', label: 'Buscar Empleo', icon: icons.search(16, 'inline-left') },
    { code: 'U-04', label: 'Empresas', icon: icons.building(16, 'inline-left') },
    { code: 'R-01', label: 'Recursos', icon: icons.bookOpen(16, 'inline-left') },
    { code: 'R-03', label: 'Foro', icon: icons.messagesSquare(16, 'inline-left') }
  ];

  // Role-specific navigation links (limpios y organizados para evitar duplicidad)
  if (user) {
    if (user.role === 'candidato') {
      links.push(
        { code: 'U-02', label: 'Postulaciones', icon: icons.fileText(16, 'inline-left') },
        { code: 'U-03', label: 'Alertas', icon: icons.bell(16, 'inline-left') }
      );
    } else if (user.role === 'empleador') {
      links.push(
        { code: 'E-02', label: 'Mis Ofertas', icon: icons.briefcase(16, 'inline-left') },
        { code: 'E-03', label: 'Candidatos', icon: icons.user(16, 'inline-left') }
      );
    } else if (user.role === 'admin') {
      links.push(
        { code: 'A-01', label: 'Panel Admin', icon: icons.shield(16, 'inline-left') },
        { code: 'DOC', label: 'Estructura', icon: icons.layers(16, 'inline-left') }
      );
    }
  }

  navLinksEl.innerHTML = links.map(link => `
    <li>
      <a href="#${link.code}" class="${current === link.code ? 'active' : ''}" onclick="event.preventDefault(); window.navigateTo('${link.code}');">
        ${link.icon}${link.label}
      </a>
    </li>
  `).join('');

  // Auth area con acceso interactivo al perfil de cuenta
  if (user) {
    const isCandidate = user.role === 'candidato';
    const isEmployer = user.role === 'empleador';
    const isAdmin = user.role === 'admin';

    let accountTitle = 'Mi Perfil (Editar datos personales, profesionales y preferencias)';
    let roleBadgeText = 'CANDIDATO';
    let roleBadgeClass = 'candidato';
    let accountIcon = icons.user(14);
    let isAccountActive = current === 'U-01';

    if (isEmployer) {
      accountTitle = 'Mi Empresa / Cuenta de Empresa (Editar datos corporativos, logotipo y portada)';
      roleBadgeText = 'EMPRESA';
      roleBadgeClass = 'empresa';
      accountIcon = icons.building(14);
      isAccountActive = current === 'E-01' && (!state.screenParams?.companyId || state.screenParams?.companyId === user.companyId);
    } else if (isAdmin) {
      accountTitle = 'Panel de Administración y Configuración';
      roleBadgeText = 'ADMIN';
      roleBadgeClass = 'admin';
      accountIcon = icons.shield(14);
      isAccountActive = current === 'A-01';
    }

    navAuthEl.innerHTML = `
      <button type="button" class="user-menu user-account-btn ${isAccountActive ? 'active' : ''}" onclick="window.handleUserAccountClick()" title="${escapeHtml(accountTitle)}" aria-label="${escapeHtml(accountTitle)}">
        <span class="role-badge ${roleBadgeClass}">${roleBadgeText}</span>
        <span class="user-menu-name">${escapeHtml(`${user.firstName} ${user.lastName}`)}</span>
        <span class="user-account-icon" aria-hidden="true">${accountIcon}</span>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="window.logoutUser()">
        ${icons.logOut(14, 'inline-left')}Cerrar Sesión
      </button>
    `;
  } else {
    navAuthEl.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="window.openLoginModal()">
        ${icons.logIn(14, 'inline-left')}Iniciar Sesión
      </button>
      <button class="btn btn-primary btn-sm" onclick="window.navigateTo('P-04')">
        ${icons.user(14, 'inline-left')}Registrarse
      </button>
    `;
  }
}

// Global click handler for user account profile in navbar
window.handleUserAccountClick = () => {
  const user = state.currentUser;
  if (!user) return;
  if (user.role === 'candidato') {
    window.navigateTo('U-01');
  } else if (user.role === 'empleador') {
    window.navigateTo('E-01', user.companyId ? { companyId: user.companyId } : {});
  } else if (user.role === 'admin') {
    window.navigateTo('A-01');
  }
};

// Global router navigation helper
window.navigateTo = (screenCode, params = {}) => {
  window.toggleMobileNav(true);
  if ((screenCode === 'DOC' || screenCode === 'ESTRUCTURA') && (!state.currentUser || state.currentUser.role !== 'admin')) {
    state.showToast('Acceso restringido: La sección de Estructura es exclusiva para administradores.', 'error');
    const user = state.currentUser;
    const target = user ? (user.role === 'candidato' ? 'U-01' : (user.role === 'empleador' ? 'E-02' : 'P-01')) : 'P-01';
    state.setScreen(target);
    return;
  }
  state.setScreen(screenCode, params);
};

window.retryDbConnectionP01 = async () => {
  try {
    await api.getStatus(true);
    state.showToast('Estado de conexión actualizado.', 'success');
    renderP01();
  } catch (err) {
    state.showToast('MongoDB continúa inaccesible.', 'error');
    renderP01();
  }
};

window.logoutUser = () => {
  state.clearUser();
  state.showToast('Sesión cerrada correctamente.', 'info');
  state.setScreen('P-01');
};

// Dispatch screen rendering
async function renderScreen() {
  revokeCandidateMediaUrls();
  if (activePreviewBlobUrl) {
    URL.revokeObjectURL(activePreviewBlobUrl);
    activePreviewBlobUrl = null;
  }
  const code = state.currentScreen;
  appContent.innerHTML = `
    <div class="container" style="text-align: center; padding: 4rem 0;">
      <div style="color: var(--color-text-muted); font-size: 0.95rem;">
        ${icons.server(20, 'inline-left')} Consultando registros...
      </div>
    </div>
  `;

  try {
    switch (code) {
      case 'P-01': return await renderP01();
      case 'P-02': return await renderP02();
      case 'P-03': return await renderP03();
      case 'P-04': return await renderP04();
      case 'U-01': return await renderU01();
      case 'U-02': return await renderU02();
      case 'U-03': return await renderU03();
      case 'U-04': return await renderU04();
      case 'E-01': return await renderE01();
      case 'E-02': return await renderE02();
      case 'E-03': return await renderE03();
      case 'R-01': return await renderR01();
      case 'R-02': return await renderR02();
      case 'R-03': return await renderR03();
      case 'A-01': return await renderA01();
      case 'DOC':
      case 'ESTRUCTURA':
        if (!state.currentUser || state.currentUser.role !== 'admin') {
          state.showToast('Acceso restringido: La sección de Estructura es exclusiva para administradores.', 'error');
          const fallback = state.currentUser
            ? (state.currentUser.role === 'candidato' ? 'U-01' : (state.currentUser.role === 'empleador' ? 'E-02' : 'P-01'))
            : 'P-01';
          state.setScreen(fallback);
          return;
        }
        return await renderDOC();
      default: return await renderP01();
    }
  } catch (err) {
    appContent.innerHTML = `
      <div class="container">
        <div class="card" style="border-left: 4px solid var(--color-danger);">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            ${icons.alertTriangle(20, 'text-danger')}
            <h3 style="font-size: 1.15rem; font-weight: 700;">Error al cargar pantalla [${escapeHtml(code)}]</h3>
          </div>
          <p style="color: var(--color-text-muted); margin-bottom: 1rem;">${escapeHtml(err?.message || 'Error inesperado.')}</p>
          <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('P-01')">
            ${icons.home(14, 'inline-left')}Volver al Inicio
          </button>
        </div>
      </div>
    `;
  }
}

/* ==========================================================================
   PANTALLA P-01: INICIO Y BÚSQUEDA PRINCIPAL
   ========================================================================== */
async function renderP01() {
  currentDbStatus = await api.getStatus().catch(() => currentDbStatus);
  const dbUnavailable = currentDbStatus && currentDbStatus.isMongoConnected === false;

  let jobsData = { jobs: [], total: 0 };
  let pubStatsRes = null;

  if (!dbUnavailable) {
    [jobsData, pubStatsRes] = await Promise.all([
      api.getJobs({}),
      api.getPublicStats({ silent: true }).catch(() => null)
    ]);
  }

  const allJobs = jobsData.jobs || [];
  const featuredJobs = allJobs.slice(0, 4);
  const pubStats = pubStatsRes?.stats || null;

  appContent.innerHTML = `
    <div class="container">
      <section class="hero-section">
        <span class="brand-badge" style="margin-bottom: 0.75rem; display: inline-block;">PORTAL DE EMPLEO PROFESIONAL</span>
        <h1>Encuentra tu Próxima Oportunidad Laboral</h1>
        <p>Conectamos talento profesional y especializado con empresas líderes del mercado. Explora vacantes, gestiona tus postulaciones y da el siguiente paso en tu carrera.</p>
        
        <div class="search-box-card">
          <div class="search-input-group">
            <input type="text" id="p01-search-q" placeholder="Puesto, competencia o palabra clave (ej. JavaScript, QA, UI/UX)..." />
          </div>
          <div class="search-input-group" style="max-width: 220px;">
            <select id="p01-search-modality">
              <option value="">Todas las modalidades</option>
              <option value="Remoto">Remoto</option>
              <option value="Híbrido">Híbrido</option>
              <option value="Presencial">Presencial</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="window.handleP01Search()">
            ${icons.search(16, 'inline-left')}Buscar Vacantes
          </button>
        </div>
      </section>

      <!-- Real Metrics from MongoDB -->
      <div class="grid-cols-4" style="margin-bottom: 2.5rem;">
        <div class="stat-box">
          <div class="stat-value">${pubStats ? pubStats.activeJobs : (jobsData.total ?? 0)}</div>
          <div class="stat-label">Ofertas Activas</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${pubStats ? pubStats.activeCompanies : 0}</div>
          <div class="stat-label">Empresas Registradas</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${pubStats ? pubStats.totalCandidates : 0}</div>
          <div class="stat-label">Candidatos Activos</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${pubStats ? pubStats.totalApplications : 0}</div>
          <div class="stat-label">Postulaciones Enviadas</div>
        </div>
      </div>

      <!-- Featured Jobs -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.25rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 700; color: var(--color-text-main);">Ofertas Laborales Disponibles</h2>
          <p style="color: var(--color-text-muted); font-size: 0.9rem;">Posiciones activas registradas en la base de datos institucional.</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('P-02')">
          Ver todas las ofertas ${icons.arrowRight(14, 'inline-right')}
        </button>
      </div>

      ${dbUnavailable ? `
        <div class="card" style="border-left: 4px solid var(--color-warning); margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--color-text-main);">
                ${icons.alertTriangle(17, 'inline-left')}Base de datos MongoDB no conectada
              </h3>
              <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0;">
                No hay conexión activa con MongoDB (${escapeHtml(currentDbStatus?.mongoUri || '127.0.0.1:27017')}). Inicia el servicio <code>mongod</code> para visualizar vacantes y métricas en tiempo real.
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.retryDbConnectionP01()">
              ${icons.server(14, 'inline-left')}Reintentar conexión
            </button>
          </div>
        </div>
      ` : featuredJobs.length === 0 ? `
        <div class="card" style="text-align: center; padding: 2.5rem;">
          <p style="color: var(--color-text-muted);">No hay vacantes activas registradas en este momento.</p>
        </div>
      ` : `
        <div class="grid-cols-2">
          ${featuredJobs.map(job => `
            <div class="card" style="cursor: pointer;" onclick="window.navigateTo('P-03', { jobId: '${escapeHtml(job._id)}' })">
              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                ${renderCompanyLogo(job.companyLogo, job.companyName, 48, 8)}
                <div style="flex: 1; min-width: 0;">
                  <h3 class="card-title">${escapeHtml(job.title)}</h3>
                  <div class="card-meta">
                    <span style="font-weight: 600; color: var(--color-text-body);">${escapeHtml(job.companyName)}</span>
                    <span>${icons.mapPin(13, 'inline-left')}${escapeHtml(job.location)}</span>
                    <span>${icons.dollarSign(13, 'inline-left')}$${job.salaryMin} - $${job.salaryMax} USD</span>
                  </div>
                  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <span class="tag primary">${escapeHtml(job.modality)}</span>
                    <span class="tag">${escapeHtml(job.contractType)}</span>
                    <span class="tag">${escapeHtml(job.experienceLevel)}</span>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

window.handleP01Search = () => {
  const q = document.getElementById('p01-search-q').value;
  const modality = document.getElementById('p01-search-modality').value;
  window.navigateTo('P-02', { q, modality });
};

/* ==========================================================================
   PANTALLA P-02: BÚSQUEDA Y FILTROS DE EMPLEO
   ========================================================================== */
async function renderP02() {
  const query = state.screenParams || {};
  const res = await api.getJobs(query);
  const jobs = res.jobs || [];

  const advFields = ['modality', 'contractType', 'experienceLevel', 'sector', 'salaryMin'];
  const activeAdvCount = advFields.filter(key => query[key] !== undefined && query[key] !== null && String(query[key]).trim() !== '').length;
  const advOpen = activeAdvCount > 0;

  appContent.innerHTML = `
    <div class="container">
      <div style="margin-bottom: 1.5rem;">
        <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main);">Búsqueda y Filtros de Empleo</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">Consulta y filtrado de vacantes activas registradas en MongoDB (${res.total} resultados).</p>
      </div>

      <!-- Filters Bar -->
      <div class="card" style="margin-bottom: 2rem; padding: 1.25rem;">
        <form onsubmit="event.preventDefault(); window.applyP02Filters();">
          <div class="p02-search-main">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="p02-q">Palabra clave o empresa</label>
              <input type="text" id="p02-q" class="form-control" value="${escapeHtml(query.q || '')}" placeholder="Ej. JavaScript, C++, QA..." />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="p02-location">Ubicación</label>
              <input type="text" id="p02-location" class="form-control" value="${escapeHtml(query.location || '')}" placeholder="Ej. San Salvador, Remoto..." />
            </div>
            <div class="p02-search-actions">
              <button type="submit" class="btn btn-primary" style="height: 38px;">
                ${icons.filter(15, 'inline-left')}Filtrar
              </button>
              <button
                type="button"
                id="p02-toggle-adv-btn"
                class="btn btn-secondary p02-toggle-btn"
                style="height: 38px;"
                aria-expanded="${advOpen ? 'true' : 'false'}"
                aria-controls="p02-advanced-filters"
                onclick="window.toggleP02AdvancedFilters()"
              >
                ${icons.layers(15, 'inline-left')}Filtros adicionales${activeAdvCount > 0 ? ` (${activeAdvCount})` : ''}
              </button>
              <button type="button" class="btn btn-secondary" style="height: 38px;" onclick="window.navigateTo('P-02')" title="Limpiar todos los filtros">
                Limpiar
              </button>
            </div>
          </div>

          <div id="p02-advanced-filters" class="p02-advanced-panel${advOpen ? ' is-open' : ''}">
            <div class="p02-advanced-grid">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="p02-modality">Modalidad</label>
                <select id="p02-modality" class="form-control">
                  <option value="">Todas</option>
                  <option value="Remoto" ${query.modality === 'Remoto' ? 'selected' : ''}>Remoto</option>
                  <option value="Híbrido" ${query.modality === 'Híbrido' ? 'selected' : ''}>Híbrido</option>
                  <option value="Presencial" ${query.modality === 'Presencial' ? 'selected' : ''}>Presencial</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="p02-contractType">Tipo de contrato</label>
                <select id="p02-contractType" class="form-control">
                  <option value="">Todos</option>
                  <option value="Tiempo Completo" ${query.contractType === 'Tiempo Completo' ? 'selected' : ''}>Tiempo Completo</option>
                  <option value="Medio Tiempo" ${query.contractType === 'Medio Tiempo' ? 'selected' : ''}>Medio Tiempo</option>
                  <option value="Pasantía / Prácticas" ${query.contractType === 'Pasantía / Prácticas' ? 'selected' : ''}>Pasantía / Prácticas</option>
                  <option value="Por Proyecto / Freelance" ${query.contractType === 'Por Proyecto / Freelance' ? 'selected' : ''}>Por Proyecto / Freelance</option>
                  <option value="Temporal" ${query.contractType === 'Temporal' ? 'selected' : ''}>Temporal</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="p02-experienceLevel">Experiencia</label>
                <select id="p02-experienceLevel" class="form-control">
                  <option value="">Todas</option>
                  <option value="Sin experiencia" ${query.experienceLevel === 'Sin experiencia' ? 'selected' : ''}>Sin experiencia</option>
                  <option value="1-2 años" ${query.experienceLevel === '1-2 años' ? 'selected' : ''}>1-2 años</option>
                  <option value="3-5 años" ${query.experienceLevel === '3-5 años' ? 'selected' : ''}>3-5 años</option>
                  <option value="+5 años" ${query.experienceLevel === '+5 años' ? 'selected' : ''}>+5 años</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="p02-sector">Sector</label>
                <input type="text" id="p02-sector" class="form-control" value="${escapeHtml(query.sector || '')}" placeholder="Ej. Tecnología, Finanzas..." />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="p02-salaryMin">Salario mínimo ($ USD)</label>
                <input type="number" id="p02-salaryMin" class="form-control" min="0" max="50000" step="1" value="${escapeHtml(query.salaryMin || '')}" placeholder="Ej. 800" />
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Job Results List -->
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${jobs.length === 0 ? `
          <div class="card" style="text-align: center; padding: 3rem;">
            <div style="color: var(--color-text-muted); margin-bottom: 0.5rem;">${icons.search(24)}</div>
            <p style="color: var(--color-text-muted); font-size: 1.05rem;">No se encontraron ofertas coincidentes con los criterios indicados.</p>
            <button class="btn btn-secondary btn-sm" style="margin-top: 1rem;" onclick="window.navigateTo('P-02')">Restablecer Filtros</button>
          </div>
        ` : jobs.map(j => `
          <div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <div style="display: flex; gap: 1.25rem; align-items: center; flex: 1; min-width: 280px;">
              ${renderCompanyLogo(j.companyLogo, j.companyName, 52, 8)}
              <div>
                <h3 class="card-title" style="margin-bottom: 0.2rem;">${escapeHtml(j.title)}</h3>
                <div class="card-meta" style="margin-bottom: 0.4rem;">
                  <a href="#E-01" onclick="event.preventDefault(); window.navigateTo('E-01', { companyId: '${escapeHtml(j.companyId)}' });" style="font-weight: 600; color: var(--color-primary-text); text-decoration: none;">${escapeHtml(j.companyName)}</a>
                  <span>${icons.mapPin(13, 'inline-left')}${escapeHtml(j.location)}</span>
                  <span>${icons.dollarSign(13, 'inline-left')}$${j.salaryMin} - $${j.salaryMax} USD</span>
                  <span>${icons.calendar(13, 'inline-left')}Publicada: ${escapeHtml(j.publishedAt)}</span>
                </div>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                  <span class="tag primary">${escapeHtml(j.modality)}</span>
                  <span class="tag">${escapeHtml(j.contractType)}</span>
                  <span class="tag">${escapeHtml(j.experienceLevel)}</span>
                  <span class="tag">${escapeHtml(j.sector)}</span>
                </div>
              </div>
            </div>
            <div>
              <button class="btn btn-primary btn-sm" onclick="window.navigateTo('P-03', { jobId: '${escapeHtml(j._id)}' })">
                Ver Detalles ${icons.arrowRight(14, 'inline-right')}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.toggleP02AdvancedFilters = () => {
  const panel = document.getElementById('p02-advanced-filters');
  const btn = document.getElementById('p02-toggle-adv-btn');
  if (!panel || !btn) return;
  const isOpen = panel.classList.toggle('is-open');
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
};

window.applyP02Filters = () => {
  const q = document.getElementById('p02-q').value.trim();
  const location = document.getElementById('p02-location').value.trim();
  const modality = document.getElementById('p02-modality').value;
  const contractType = document.getElementById('p02-contractType').value;
  const experienceLevel = document.getElementById('p02-experienceLevel').value;
  const sector = document.getElementById('p02-sector').value.trim();
  const salaryMin = document.getElementById('p02-salaryMin').value.trim();

  if (salaryMin && (!/^\d+(\.\d+)?$/.test(salaryMin) || Number(salaryMin) < 0)) {
    const panel = document.getElementById('p02-advanced-filters');
    const btn = document.getElementById('p02-toggle-adv-btn');
    if (panel) panel.classList.add('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    state.showToast('El salario mínimo de filtro debe ser una cantidad numérica positiva.', 'error');
    return;
  }

  window.navigateTo('P-02', { q, location, modality, contractType, experienceLevel, sector, salaryMin });
};

/* ==========================================================================
   PANTALLA P-03: DETALLE DE OFERTA LABORAL Y POSTULACIÓN
   ========================================================================== */
async function renderP03() {
  const jobId = state.screenParams.jobId || 'job-101';
  const data = await api.getJob(jobId);
  const job = data.job;
  const company = data.company || {};
  currentViewedJob = job;

  const todayStr = new Date().toISOString().split('T')[0];
  const isExpired = Boolean(job.expiresAt && job.expiresAt < todayStr);
  const isInactive = job.status !== 'Activa';

  let alreadyApplied = false;
  if (state.currentUser && state.currentUser.role === 'candidato') {
    try {
      const appsRes = await api.getApplications({ jobId: job._id });
      alreadyApplied = Array.isArray(appsRes.applications) && appsRes.applications.length > 0;
    } catch (e) {
      // Ignore silently if check fails
    }
  }

  const ratingLabel = company.averageRating
    ? `${Number(company.averageRating).toFixed(1)} / 5.0 (${company.reviewCount || 0})`
    : 'Sin valoraciones aún';

  appContent.innerHTML = `
    <div class="container">
      <div style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('P-02')">
          ${icons.arrowLeft(14, 'inline-left')}Volver a resultados
        </button>
        ${(isInactive || isExpired) ? `
          <span class="tag warning">${icons.alertTriangle(13, 'inline-left')}${isExpired ? 'Convocatoria Vencida' : `Estado: ${escapeHtml(job.status)}`}</span>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
        <!-- Left: Job Specification -->
        <div>
          <div class="card" style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
              <div>
                <h1 style="font-size: 1.6rem; font-weight: 800; color: var(--color-text-main); margin-bottom: 0.35rem;">${escapeHtml(job.title)}</h1>
                <div class="card-meta">
                  <span style="font-weight: 600; color: var(--color-text-secondary); font-size: 1rem;">${escapeHtml(job.companyName)}</span>
                  <span>${icons.mapPin(13, 'inline-left')}${escapeHtml(job.location)}</span>
                  <span>${icons.clock(13, 'inline-left')}Vence: ${escapeHtml(job.expiresAt || 'Sin fecha límite')}</span>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                  <span class="tag primary">${escapeHtml(job.modality)}</span>
                  <span class="tag">${escapeHtml(job.contractType)}</span>
                  <span class="tag">${escapeHtml(job.experienceLevel)}</span>
                  <span class="tag">${escapeHtml(job.sector)}</span>
                  <span class="tag success">${icons.dollarSign(13, 'inline-left')}Rango: $${job.salaryMin} - $${job.salaryMax} USD</span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
                ${alreadyApplied ? `
                  <button class="btn btn-secondary" disabled>
                    ${icons.checkCircle(14, 'inline-left')}Ya te postulaste
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('U-02')">
                    Ver estado de postulación
                  </button>
                ` : (isInactive || isExpired ? `
                  <button class="btn btn-secondary" disabled>
                    ${icons.lock(14, 'inline-left')}${isExpired ? 'Oferta Vencida' : `Oferta ${escapeHtml(job.status)}`}
                  </button>
                ` : `
                  <button class="btn btn-primary" onclick="window.openApplicationModal('${escapeHtml(job._id)}')">
                    ${icons.send(14, 'inline-left')}Postularme a esta Vacante
                  </button>
                `)}
              </div>
            </div>
          </div>

          <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.75rem;">Descripción del Puesto</h3>
            <p style="color: var(--color-text-body); line-height: 1.6; margin-bottom: 1.25rem; white-space: pre-line;">${escapeHtml(job.description)}</p>

            ${(job.responsibilities && job.responsibilities.length) ? `
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem;">Responsabilidades Principales:</h4>
              <ul style="margin-left: 1.25rem; color: var(--color-text-body); margin-bottom: 1.25rem; line-height: 1.6;">
                ${job.responsibilities.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
              </ul>
            ` : ''}

            ${(job.requirements && job.requirements.length) ? `
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem;">Requisitos Solicitados:</h4>
              <ul style="margin-left: 1.25rem; color: var(--color-text-body); margin-bottom: 1.25rem; line-height: 1.6;">
                ${job.requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
              </ul>
            ` : ''}

            ${(job.benefits && job.benefits.length) ? `
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem;">Prestaciones y Beneficios:</h4>
              <ul style="margin-left: 1.25rem; color: var(--color-text-body); line-height: 1.6;">
                ${job.benefits.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        </div>

        <!-- Right: Organization & Contact -->
        <div>
          <div class="card" style="margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
              ${renderCompanyLogo(company.logo || job.companyLogo, company.name || job.companyName, 54, 8)}
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 700;">${escapeHtml(company.name || job.companyName)}</h3>
                <span style="font-size: 0.8rem; color: var(--color-text-muted);">${escapeHtml(company.industry || job.sector)}</span>
              </div>
            </div>
            <p style="font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.5; margin-bottom: 1rem;">
              ${escapeHtml(company.description || 'Organización registrada en el Portal de Trabajo.')}
            </p>
            <div style="border-top: 1px solid var(--color-border); padding-top: 0.75rem; font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.45rem;">
                <span style="color: var(--color-text-muted);">Ubicación:</span>
                <span style="font-weight: 600;">${escapeHtml(company.location || job.location)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.45rem; align-items: center;">
                <span style="color: var(--color-text-muted);">Calificación:</span>
                <span style="font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
                  ${icons.star(14, Boolean(company.averageRating))} ${escapeHtml(ratingLabel)}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.45rem;">
                <span style="color: var(--color-text-muted);">Contacto:</span>
                <span style="font-weight: 600;">${escapeHtml(job.contactEmail || 'No especificado')}</span>
              </div>
              ${job.contactPhone ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.45rem;">
                  <span style="color: var(--color-text-muted);">Teléfono:</span>
                  <span style="font-weight: 600;">${escapeHtml(job.contactPhone)}</span>
                </div>
              ` : ''}
            </div>
            ${company._id || job.companyId ? `
              <button class="btn btn-secondary btn-block btn-sm" style="margin-top: 1rem;" onclick="window.navigateTo('E-01', { companyId: '${escapeHtml(company._id || job.companyId)}' })">
                ${icons.building(14, 'inline-left')}Ver Perfil Corporativo
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

window.openApplicationModal = (jobId) => {
  const user = state.currentUser;
  if (!user) {
    state.showToast('Debe iniciar sesión como Candidato para postularse.', 'error');
    window.openLoginModal();
    return;
  }
  if (user.role !== 'candidato') {
    state.showToast('Solo los usuarios con rol Candidato pueden enviar solicitudes laborales.', 'error');
    return;
  }

  const jobTitle = (currentViewedJob && currentViewedJob._id === jobId)
    ? currentViewedJob.title
    : 'Oferta Seleccionada';

  const hasValidCv = Boolean(user.cv && user.cv.fileId);

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Confirmación de Postulación</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 1rem;">
            Está postulándose al puesto: <strong style="color: var(--color-text-main);">${escapeHtml(jobTitle)}</strong>
          </p>
          ${!hasValidCv ? `
            <div style="padding: 1rem; background-color: var(--color-warning-bg); border: 1px solid var(--color-warning-border); border-radius: var(--radius-sm); color: var(--color-warning-text); margin-bottom: 1rem;">
              <div style="font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.35rem;">
                ${icons.alertTriangle(16)} Currículum Vitae Requerido
              </div>
              <p style="font-size: 0.85rem; margin-bottom: 0.75rem;">
                Para postularse a una vacante debe subir primero un archivo real de Currículum Vitae (PDF o DOCX) desde su perfil profesional.
              </p>
              <button type="button" class="btn btn-candidato btn-sm" onclick="window.closeModal(); window.navigateTo('U-01');">
                ${icons.upload(14, 'inline-left')}Ir a Mi Perfil para subir CV
              </button>
            </div>
          ` : `
            <div class="form-group">
              <label class="form-label">Currículum Vitae adjunto desde MongoDB GridFS:</label>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.75rem; background-color: var(--color-bg-muted); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.88rem; font-weight: 600; color: var(--color-text-main);">
                <span style="display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
                  ${icons.fileText(16, 'text-primary')}
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(user.cv.fileName)}</span>
                </span>
                <span style="font-size: 0.78rem; color: var(--color-text-muted); white-space: nowrap;">${escapeHtml(user.cv.fileSize || '')}</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Nota o Carta de Presentación (Opcional, máx. 500 caracteres):</label>
              <textarea id="app-cover-note" class="form-control" maxlength="500" placeholder="Explique brevemente su experiencia relevante para este cargo..."></textarea>
            </div>
          `}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.closeModal()">Cancelar</button>
          ${hasValidCv ? `
            <button class="btn btn-primary" onclick="window.submitApplication('${escapeHtml(jobId)}')">
              ${icons.send(14, 'inline-left')}Enviar Postulación
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
};

window.submitApplication = async (jobId) => {
  const coverNote = document.getElementById('app-cover-note')?.value.trim() || '';
  const cvFileId = state.currentUser?.cv?.fileId || null;
  if (!cvFileId) {
    state.showToast('Debes subir tu Currículum Vitae en formato PDF o DOCX antes de postularte.', 'error');
    return;
  }

  try {
    await api.applyToJob({
      jobId,
      coverNote,
      cvFileId
    });
    window.closeModal();
    state.showToast('Postulación registrada exitosamente en el sistema.', 'success');
    window.navigateTo('U-02');
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

/* ==========================================================================
   PANTALLA P-04: REGISTRO E INICIO DE SESIÓN
   ========================================================================== */
async function renderP04() {
  appContent.innerHTML = `
    <div class="container" style="max-width: 540px;">
      <div class="card" style="box-shadow: var(--shadow-lg);">
        <div class="tabs-nav" style="justify-content: center;">
          <button class="tab-btn active" id="tab-login-btn" onclick="window.switchAuthTab('login')">
            ${icons.logIn(15, 'inline-left')}Iniciar Sesión
          </button>
          <button class="tab-btn" id="tab-reg-btn" onclick="window.switchAuthTab('register')">
            ${icons.user(15, 'inline-left')}Crear Cuenta
          </button>
        </div>

        <!-- Login Form -->
        <div id="auth-login-box">
          <form onsubmit="event.preventDefault(); window.handleLogin();">
            <div class="form-group">
              <label class="form-label">Correo Electrónico</label>
              <input type="email" id="login-email" class="form-control" required maxlength="100" placeholder="nombre@correo.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input type="password" id="login-password" class="form-control" required minlength="6" maxlength="100" placeholder="••••••••" />
            </div>
            <button type="submit" class="btn btn-primary btn-block" style="margin-top: 1.25rem;">
              ${icons.logIn(15, 'inline-left')}Ingresar a la Plataforma
            </button>
          </form>
        </div>

        <!-- Register Form -->
        <div id="auth-reg-box" style="display: none;">
          <form onsubmit="event.preventDefault(); window.handleRegister();">
            <div class="form-group">
              <label class="form-label">Tipo de Cuenta</label>
              <select id="reg-role" class="form-control" onchange="window.handleRoleChange(this.value)">
                <option value="candidato">Candidato (Profesional en búsqueda de empleo)</option>
                <option value="empleador">Empresa / Empleador</option>
              </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Nombres</label>
                <input type="text" id="reg-firstName" class="form-control" required minlength="2" maxlength="60" placeholder="Carlos" />
              </div>
              <div class="form-group">
                <label class="form-label">Apellidos</label>
                <input type="text" id="reg-lastName" class="form-control" required minlength="2" maxlength="60" placeholder="Pérez" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Correo Electrónico</label>
              <input type="email" id="reg-email" class="form-control" required maxlength="100" placeholder="carlos.perez@correo.com" />
            </div>
            ${phoneHelper.renderPhoneInputHtml('reg-phone', '', 'Teléfono de Contacto', false)}
            <div id="reg-company-fields" style="display: none; border-top: 1px dashed var(--color-border); padding-top: 0.75rem; margin-top: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Razón Social o Nombre de la Empresa *</label>
                <input type="text" id="reg-companyName" class="form-control" minlength="2" maxlength="100" placeholder="Acme Software El Salvador" />
              </div>
              <div class="form-group">
                <label class="form-label">Sector o Industria</label>
                <input type="text" id="reg-companyIndustry" class="form-control" maxlength="80" placeholder="Tecnología / Fintech" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña (Mínimo 6 caracteres)</label>
              <input type="password" id="reg-password" class="form-control" minlength="6" maxlength="100" required placeholder="••••••••" />
            </div>
            <button type="submit" class="btn btn-primary btn-block" style="margin-top: 1rem;">
              ${icons.user(15, 'inline-left')}Completar Registro
            </button>
          </form>
        </div>

      </div>
    </div>
  `;
  setTimeout(() => {
    phoneHelper.setupPhoneInput('reg-phone');
  }, 50);
}

window.switchAuthTab = (tab) => {
  const loginBox = document.getElementById('auth-login-box');
  const regBox = document.getElementById('auth-reg-box');
  const loginBtn = document.getElementById('tab-login-btn');
  const regBtn = document.getElementById('tab-reg-btn');

  if (tab === 'login') {
    loginBox.style.display = 'block';
    regBox.style.display = 'none';
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
  } else {
    loginBox.style.display = 'none';
    regBox.style.display = 'block';
    loginBtn.classList.remove('active');
    regBtn.classList.add('active');
    phoneHelper.setupPhoneInput('reg-phone');
  }
};

window.handleRoleChange = (role) => {
  const compFields = document.getElementById('reg-company-fields');
  const compNameInput = document.getElementById('reg-companyName');
  const isEmployer = role === 'empleador';
  if (compFields) {
    compFields.style.display = isEmployer ? 'block' : 'none';
  }
  if (compNameInput) {
    compNameInput.required = isEmployer;
  }
};

window.handleLogin = async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await api.login(email, password);
    state.setUser(res.user, res.token);
    state.showToast(`Bienvenido de nuevo, ${res.user.firstName}.`, 'success');
    window.closeModal();

    if (res.user.mustChangePassword) {
      window.openMustChangePasswordModal();
      return;
    }

    if (res.user.role === 'admin') window.navigateTo('A-01');
    else if (res.user.role === 'empleador') window.navigateTo('E-02');
    else window.navigateTo('U-01');
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleRegister = async () => {
  const role = document.getElementById('reg-role').value;
  const firstName = document.getElementById('reg-firstName').value.trim();
  const lastName = document.getElementById('reg-lastName').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = phoneHelper.getValue('reg-phone');
  const password = document.getElementById('reg-password').value;

  const PHONE_REGEX = /^[\+]?[\d\s-]{7,25}$/;
  if (phone && !PHONE_REGEX.test(phone)) {
    state.showToast('El teléfono debe tener un formato válido con números y guiones (ej. 503-7123-4567 o 7123-4567).', 'error');
    return;
  }

  const payload = { role, firstName, lastName, email, phone, password };

  if (role === 'empleador') {
    payload.companyName = document.getElementById('reg-companyName').value.trim();
    payload.companyIndustry = document.getElementById('reg-companyIndustry').value.trim();
    if (!payload.companyName || payload.companyName.length < 2) {
      state.showToast('El nombre o razón social de la empresa es obligatorio (mínimo 2 caracteres).', 'error');
      return;
    }
  }

  try {
    const res = await api.register(payload);
    state.setUser(res.user, res.token);
    state.showToast('Cuenta registrada exitosamente en el Portal de Trabajo.', 'success');
    window.closeModal();
    if (role === 'empleador') window.navigateTo('E-01');
    else window.navigateTo('U-01');
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.openLoginModal = () => {
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3>Iniciar Sesión</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); window.handleModalLogin();">
            <div class="form-group">
              <label class="form-label">Correo Electrónico</label>
              <input type="email" id="modal-email" class="form-control" required placeholder="nombre@correo.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input type="password" id="modal-password" class="form-control" required placeholder="••••••••" />
            </div>
            <button type="submit" class="btn btn-primary btn-block" style="margin-top: 1.25rem;">
              ${icons.logIn(15, 'inline-left')}Ingresar
            </button>
          </form>
          <div style="text-align: center; margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted);">
            ¿No tienes una cuenta aún? <a href="#P-04" onclick="window.closeModal(); window.navigateTo('P-04');" style="color: var(--color-primary-text); font-weight: 600;">Regístrate aquí</a>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.handleModalLogin = async () => {
  const email = document.getElementById('modal-email').value.trim();
  const password = document.getElementById('modal-password').value;

  try {
    const res = await api.login(email, password);
    state.setUser(res.user, res.token);
    state.showToast(`Bienvenido de nuevo, ${res.user.firstName}.`, 'success');
    window.closeModal();

    if (res.user.role === 'admin') window.navigateTo('A-01');
    else if (res.user.role === 'empleador') window.navigateTo('E-02');
    else window.navigateTo('U-01');
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

let activePreviewBlobUrl = null;
let activeAvatarBlobUrl = null;
let activeBannerBlobUrl = null;

function revokeCandidateMediaUrls() {
  if (activeAvatarBlobUrl) {
    URL.revokeObjectURL(activeAvatarBlobUrl);
    activeAvatarBlobUrl = null;
  }
  if (activeBannerBlobUrl) {
    URL.revokeObjectURL(activeBannerBlobUrl);
    activeBannerBlobUrl = null;
  }
}

window.closeModal = () => {
  if (activePreviewBlobUrl) {
    URL.revokeObjectURL(activePreviewBlobUrl);
    activePreviewBlobUrl = null;
  }
  modalContainer.innerHTML = '';
};

window.handleDownloadProtectedFile = async (fileId, fileName = 'documento') => {
  try {
    const { blob, fileName: serverFileName } = await api.fetchProtectedFileBlob(fileId, true);
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || serverFileName || 'documento';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleViewProtectedFile = async (fileId, fileName = 'Documento') => {
  try {
    const { blob, mimeType } = await api.fetchProtectedFileBlob(fileId, false);
    if (activePreviewBlobUrl) {
      URL.revokeObjectURL(activePreviewBlobUrl);
    }
    const blobUrl = URL.createObjectURL(blob);
    activePreviewBlobUrl = blobUrl;

    const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    const isImage = mimeType.startsWith('image/');

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 820px; width: 95%;">
          <div class="modal-header">
            <h3 style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</h3>
            <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
              ${icons.x(18)}
            </button>
          </div>
          <div class="modal-body">
            ${isPdf ? `
              <iframe src="${blobUrl}" title="${fileName}" style="width: 100%; height: 65vh; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: #ffffff;"></iframe>
            ` : (isImage ? `
              <div style="text-align: center;">
                <img src="${blobUrl}" alt="${fileName}" style="max-width: 100%; max-height: 65vh; border-radius: var(--radius-sm);" />
              </div>
            ` : `
              <div style="padding: 2rem; text-align: center; background: var(--color-bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                <div style="margin-bottom: 0.75rem; color: var(--color-primary-text);">${icons.fileText(36)}</div>
                <p style="margin-bottom: 1rem; color: var(--color-text-body);">La vista previa directa en navegador no está disponible para este formato (${mimeType || 'documento'}). Puede descargarlo para abrirlo localmente.</p>
                <button type="button" class="btn btn-primary btn-sm" onclick="window.handleDownloadProtectedFile('${fileId}', '${fileName.replace(/'/g, "\\'")}')">
                  ${icons.download(14, 'inline-left')}Descargar Archivo
                </button>
              </div>
            `)}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.handleDownloadProtectedFile('${fileId}', '${fileName.replace(/'/g, "\\'")}')">
              ${icons.download(13, 'inline-left')}Descargar
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.closeModal()">Cerrar</button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

async function loadProtectedCandidateMedia(user) {
  revokeCandidateMediaUrls();
  if (!user) return;
  if (user.avatar && String(user.avatar).startsWith('/api/files/')) {
    try {
      const { blob } = await api.fetchProtectedFileBlob(user.avatar, false);
      const avatarEl = document.getElementById('u01-avatar-img');
      const placeholderEl = document.getElementById('u01-avatar-placeholder');
      if (avatarEl && state.currentScreen === 'U-01') {
        activeAvatarBlobUrl = URL.createObjectURL(blob);
        avatarEl.src = activeAvatarBlobUrl;
        avatarEl.style.display = 'block';
        if (placeholderEl) placeholderEl.style.display = 'none';
      }
    } catch (e) {
      // Neutral placeholder kept silently
    }
  }
  if (user.banner && String(user.banner).startsWith('/api/files/')) {
    try {
      const { blob } = await api.fetchProtectedFileBlob(user.banner, false);
      const coverEl = document.getElementById('u01-cover-banner');
      if (coverEl && state.currentScreen === 'U-01') {
        activeBannerBlobUrl = URL.createObjectURL(blob);
        coverEl.style.backgroundImage = `url('${activeBannerBlobUrl}')`;
        coverEl.style.backgroundSize = 'cover';
        coverEl.style.backgroundPosition = 'center';
      }
    } catch (e) {
      // Fallback gradient kept silently
    }
  }
}

/* ==========================================================================
   PANTALLA U-01: PERFIL DEL CANDIDATO Y CARGA DE CV
   ========================================================================== */
async function renderU01() {
  const user = state.currentUser;
  if (!user || user.role !== 'candidato') {
    appContent.innerHTML = `<div class="container"><div class="card"><p>Acceso restringido para cuentas de tipo Candidato.</p></div></div>`;
    return;
  }

  const [appsRes, alertsRes] = await Promise.all([
    api.getApplications().catch(() => ({ applications: [] })),
    api.getAlerts().catch(() => ({ alerts: [] }))
  ]);
  const myApps = appsRes.applications || [];
  const myAlerts = alertsRes.alerts || [];
  const activeAppsCount = myApps.filter(a => ['Enviada', 'En proceso', 'Finalista'].includes(a.status)).length;
  const activeAlertsCount = myAlerts.filter(a => a.active).length;

  const cv = (user.cv && user.cv.fileId) ? user.cv : null;
  const experience = Array.isArray(user.experience) ? user.experience : [];
  const education = Array.isArray(user.education) ? user.education : [];
  const skills = Array.isArray(user.skills) ? user.skills : [];
  const languages = Array.isArray(user.languages) ? user.languages : [{ language: 'Español', level: 'Nativo' }];
  const certifications = Array.isArray(user.certifications) ? user.certifications : [];
  const links = user.links || { portfolio: '', linkedin: '', github: '', website: '' };
  const privacy = user.privacy || { showPhoneToCompanies: true, showEmailToCompanies: true, isProfilePublic: true };

  appContent.innerHTML = `
    <div class="container">
      <!-- Real Candidate Dashboard Summary -->
      <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
        <div class="stat-box" style="cursor: pointer;" onclick="window.navigateTo('U-02')">
          <div class="stat-value" style="color: var(--color-role-candidate-text);">${myApps.length}</div>
          <div class="stat-label">Mis Postulaciones</div>
        </div>
        <div class="stat-box" style="cursor: pointer;" onclick="window.navigateTo('U-02')">
          <div class="stat-value" style="color: var(--color-role-candidate-text);">${activeAppsCount}</div>
          <div class="stat-label">Procesos Activos</div>
        </div>
        <div class="stat-box" style="cursor: pointer;" onclick="window.navigateTo('U-03')">
          <div class="stat-value" style="color: var(--color-role-candidate-text);">${activeAlertsCount} / ${myAlerts.length}</div>
          <div class="stat-label">Alertas Activas</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="font-size: 1.25rem; color: ${cv ? 'var(--color-success-text)' : 'var(--color-warning-text)'};">
            ${cv ? 'Cargado (GridFS)' : 'Pendiente'}
          </div>
          <div class="stat-label">Estado de CV</div>
        </div>
      </div>

      <!-- Candidate LinkedIn-Style Header Card (Role Color: Green) -->
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 2rem; border-top: none;">
        <div id="u01-cover-banner" class="profile-cover candidate-cover" style="${user.banner && !String(user.banner).startsWith('/api/files/') ? `background-image: url('${escapeHtml(user.banner)}'); background-size: cover; background-position: center;` : ''}">
          <div style="position: absolute; right: 1rem; bottom: 1rem; display: flex; gap: 0.5rem; z-index: 5;">
            <label class="btn btn-secondary btn-sm" style="background: var(--color-bg-surface); color: var(--color-text-main); opacity: 0.94; backdrop-filter: blur(4px); cursor: pointer; box-shadow: var(--shadow-sm);">
              ${icons.upload(13, 'inline-left')}Cambiar Portada
              <input type="file" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="window.handleUploadCandidateBanner(event)" />
            </label>
            ${user.banner ? `
              <button class="btn btn-secondary btn-sm" style="background: var(--color-bg-surface); color: var(--color-text-main); opacity: 0.94; backdrop-filter: blur(4px);" onclick="window.handleDeleteCandidateBanner()" title="Restablecer portada por defecto">
                ${icons.trash(13)}
              </button>
            ` : ''}
          </div>
        </div>
        <div style="padding: 1.5rem 2rem 2rem;">
          <div class="profile-avatar-wrapper">
            <div style="position: relative; display: inline-block;">
              ${user.avatar && !String(user.avatar).startsWith('/api/files/')
                ? `<img id="u01-avatar-img" class="profile-avatar-img" src="${escapeHtml(user.avatar)}" alt="${escapeHtml(`${user.firstName} ${user.lastName}`)}" />`
                : user.avatar && String(user.avatar).startsWith('/api/files/')
                  ? `<div id="u01-avatar-placeholder" class="profile-avatar-img profile-avatar-placeholder" aria-label="Fotografía de perfil">${icons.user(40)}</div><img id="u01-avatar-img" class="profile-avatar-img" style="display: none;" alt="${escapeHtml(`${user.firstName} ${user.lastName}`)}" />`
                  : `<div id="u01-avatar-placeholder" class="profile-avatar-img profile-avatar-placeholder" aria-label="Sin fotografía de perfil">${icons.user(40)}</div>`
              }
              <label class="btn btn-secondary btn-sm" style="position: absolute; bottom: 0; right: 0; border-radius: 50%; width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; background: var(--color-bg-surface); color: var(--color-text-main); cursor: pointer; box-shadow: var(--shadow-md);" title="${user.avatar ? 'Cambiar fotografía de perfil' : 'Subir fotografía de perfil'}" aria-label="${user.avatar ? 'Cambiar fotografía de perfil' : 'Subir fotografía de perfil'}">
                ${icons.camera(15)}
                <input type="file" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="window.handleUploadCandidateAvatar(event)" />
              </label>
              ${user.avatar ? `
                <button type="button" class="btn btn-secondary btn-sm" style="position: absolute; bottom: 0; left: 0; border-radius: 50%; width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: var(--color-bg-surface); color: var(--color-danger-text); cursor: pointer; box-shadow: var(--shadow-md);" onclick="window.handleDeleteCandidateAvatar()" title="Eliminar fotografía de perfil" aria-label="Eliminar fotografía de perfil">
                  ${icons.trash(14)}
                </button>
              ` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <label class="btn btn-candidato btn-sm" style="cursor: pointer;">
                ${icons.upload(14, 'inline-left')}Cargar CV (PDF / DOCX)
                <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display: none;" onchange="window.handleUploadCV(event)" />
              </label>
              <button class="btn btn-secondary btn-sm" onclick="window.openAddExperienceModal()">
                ${icons.plus(14, 'inline-left')}Añadir Puesto
              </button>
            </div>
          </div>

          <div style="margin-top: 0.75rem;">
            <div style="display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap;">
              <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--color-text-main); margin: 0;">${user.firstName} ${user.lastName}</h1>
              <span class="role-badge candidato">Candidato Profesional</span>
            </div>
            <p style="font-size: 1.1rem; color: var(--color-text-body); font-weight: 500; margin: 0.35rem 0 1rem;">
              ${user.title || 'Profesional / Especialista en Búsqueda Activa'}
            </p>

            <!-- Meta Contact Chips -->
            <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1rem;">
              <span class="profile-chip">
                ${icons.mapPin(14)} ${user.location || 'San Salvador, El Salvador'}
              </span>
              <span class="profile-chip">
                ${icons.phone(14)} ${user.phone || '503-7000-0000'}
              </span>
              <span class="profile-chip">
                ${icons.mail(14)} ${user.email}
              </span>
              ${links.linkedin ? `
                <a href="${links.linkedin.startsWith('http') ? links.linkedin : 'https://' + links.linkedin}" target="_blank" rel="noopener noreferrer" class="profile-chip" style="text-decoration: none; color: var(--color-linkedin-chip);">
                  ${icons.externalLink(14)} LinkedIn
                </a>
              ` : ''}
              ${links.github ? `
                <a href="${links.github.startsWith('http') ? links.github : 'https://' + links.github}" target="_blank" rel="noopener noreferrer" class="profile-chip" style="text-decoration: none; color: var(--color-github-chip);">
                  ${icons.externalLink(14)} GitHub
                </a>
              ` : ''}
              ${links.portfolio ? `
                <a href="${links.portfolio.startsWith('http') ? links.portfolio : 'https://' + links.portfolio}" target="_blank" rel="noopener noreferrer" class="profile-chip" style="text-decoration: none; color: var(--color-primary-text);">
                  ${icons.globe(14)} Portafolio
                </a>
              ` : ''}
              <span class="profile-chip" style="${privacy.isProfilePublic ? 'background-color: var(--color-success-bg); color: var(--color-success-text); border-color: var(--color-success-border);' : 'background-color: var(--color-warning-bg); color: var(--color-warning-text); border-color: var(--color-warning-border);'}">
                ${privacy.isProfilePublic ? icons.eye(14) : icons.eyeOff(14)} ${privacy.isProfilePublic ? 'Perfil Visible' : 'Perfil Privado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main 2-Column Content Grid -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.75rem;">
        
        <!-- Left Column: Professional Trajectory & Sections -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- 1. Resumen Profesional ("Acerca de mí") -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem;">
              <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
                ${icons.user(18)} Acerca de mí (Resumen Profesional)
              </h3>
              <button class="btn btn-secondary btn-sm" onclick="window.openEditBioModal()">
                ${icons.edit(14, 'inline-left')}Editar Síntesis
              </button>
            </div>
            <p style="font-size: 0.95rem; color: var(--color-text-body); line-height: 1.7; white-space: pre-line;">
              ${user.bio || 'Añade una síntesis clara y profesional de tu trayectoria laboral, especialidades técnicas, logros destacados y valor agregado que ofreces a los equipos de trabajo.'}
            </p>
          </div>

          <!-- 2. Experiencia Laboral (Múltiples Registros) -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem;">
              <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
                ${icons.briefcase(18)} Experiencia Laboral
              </h3>
              <button class="btn btn-secondary btn-sm" onclick="window.openAddExperienceModal()">
                ${icons.plus(14, 'inline-left')}Agregar Experiencia
              </button>
            </div>

            ${experience.length === 0 ? `
              <div style="text-align: center; padding: 2rem; background-color: var(--color-bg-subtle); border-radius: var(--radius-sm); border: 1px dashed var(--color-border);">
                <div style="color: var(--color-text-muted); margin-bottom: 0.5rem;">${icons.briefcase(28)}</div>
                <p style="color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 1rem;">No has registrado experiencia laboral aún.</p>
                <button class="btn btn-candidato btn-sm" onclick="window.openAddExperienceModal()">
                  ${icons.plus(14, 'inline-left')}Añadir Puesto Laboral
                </button>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column;">
                ${experience.map((exp, idx) => `
                  <div class="profile-timeline-item">
                    <div class="profile-timeline-bullet"></div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                      <div>
                        <div style="font-size: 1.05rem; font-weight: 700; color: var(--color-text-main);">${escapeHtml(exp.position || exp.role || '')}</div>
                        <div style="font-size: 0.92rem; font-weight: 600; color: var(--color-primary-text); margin-top: 0.15rem;">
                          ${escapeHtml(exp.company || '')} ${exp.location ? `• <span style="color: var(--color-text-muted); font-weight: normal;">${escapeHtml(exp.location)}</span>` : ''}
                        </div>
                        <div style="font-size: 0.82rem; color: var(--color-text-muted); margin-top: 0.25rem; display: flex; align-items: center; gap: 0.35rem;">
                          ${icons.calendar(13)} ${escapeHtml(formatRecordPeriod(exp, 'Actualidad'))}
                        </div>
                        ${exp.description ? `
                          <p style="font-size: 0.88rem; color: var(--color-text-muted); line-height: 1.5; margin-top: 0.6rem;">${escapeHtml(exp.description)}</p>
                        ` : ''}
                      </div>
                      <button class="btn btn-secondary btn-sm" title="Eliminar este puesto" style="color: var(--color-danger); padding: 0.3rem 0.5rem;" onclick="window.handleDeleteExperience(${idx})">
                        ${icons.trash(14)}
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- 3. Formación Académica (Múltiples Registros Generales) -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem;">
              <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
                ${icons.graduationCap(18)} Formación Académica
              </h3>
              <button class="btn btn-secondary btn-sm" onclick="window.openAddEducationModal()">
                ${icons.plus(14, 'inline-left')}Agregar Formación
              </button>
            </div>

            ${education.length === 0 ? `
              <div style="text-align: center; padding: 2rem; background-color: var(--color-bg-subtle); border-radius: var(--radius-sm); border: 1px dashed var(--color-border);">
                <div style="color: var(--color-text-muted); margin-bottom: 0.5rem;">${icons.graduationCap(28)}</div>
                <p style="color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 1rem;">No has registrado estudios o grados académicos.</p>
                <button class="btn btn-candidato btn-sm" onclick="window.openAddEducationModal()">
                  ${icons.plus(14, 'inline-left')}Añadir Formación Académica
                </button>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column;">
                ${education.map((edu, idx) => `
                  <div class="profile-timeline-item">
                    <div class="profile-timeline-bullet"></div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                      <div>
                        <div style="font-size: 1.05rem; font-weight: 700; color: var(--color-text-main);">${escapeHtml(edu.degree || '')}</div>
                        <div style="font-size: 0.92rem; font-weight: 600; color: var(--color-text-body); margin-top: 0.15rem;">
                          ${escapeHtml(edu.institution || '')} ${edu.level ? `• <span class="tag primary" style="font-size: 0.75rem;">${escapeHtml(edu.level)}</span>` : ''}
                        </div>
                        <div style="font-size: 0.82rem; color: var(--color-text-muted); margin-top: 0.25rem; display: flex; align-items: center; gap: 0.35rem;">
                          ${icons.calendar(13)} ${escapeHtml(formatRecordPeriod(edu, 'En curso'))}
                        </div>
                      </div>
                      <button class="btn btn-secondary btn-sm" title="Eliminar formación" style="color: var(--color-danger); padding: 0.3rem 0.5rem;" onclick="window.handleDeleteEducation(${idx})">
                        ${icons.trash(14)}
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- 4. Idiomas y Dominio -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem;">
              <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
                ${icons.globe(18)} Idiomas
              </h3>
              <button class="btn btn-secondary btn-sm" onclick="window.openAddLanguageModal()">
                ${icons.plus(14, 'inline-left')}Agregar Idioma
              </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
              ${languages.map((lang, idx) => `
                <div style="border: 1px solid var(--color-border); padding: 0.75rem 1rem; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; background-color: var(--color-bg-subtle);">
                  <div>
                    <div style="font-weight: 700; color: var(--color-text-main); font-size: 0.95rem;">${escapeHtml(lang.language || '')}</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.15rem;">${escapeHtml(lang.level || '')}</div>
                  </div>
                  <button style="border: none; background: none; color: var(--color-danger); cursor: pointer; padding: 0.25rem;" onclick="window.handleDeleteLanguage(${idx})" title="Eliminar idioma">
                    ${icons.trash(14)}
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 5. Certificaciones Profesionales -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem;">
              <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
                ${icons.award(18)} Certificaciones y Credenciales
              </h3>
              <button class="btn btn-secondary btn-sm" onclick="window.openAddCertModal()">
                ${icons.plus(14, 'inline-left')}Agregar Certificación
              </button>
            </div>

            ${certifications.length === 0 ? `
              <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0;">No has registrado certificaciones aún. Añade diplomas o certificaciones de la industria para aumentar tu visibilidad ante reclutadores.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${certifications.map((cert, idx) => {
                  const certIssuer = cert.issuer || cert.issuingOrganization || '';
                  const certYear = cert.year || cert.issueDate || '';
                  const rawCertUrl = String(cert.url || cert.credentialUrl || '').trim();
                  const safeCertUrl = /^https?:\/\//i.test(rawCertUrl) ? rawCertUrl : '';
                  return `
                  <div style="border: 1px solid var(--color-border); padding: 0.85rem 1rem; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; background-color: var(--color-bg-subtle);">
                    <div>
                      <div style="font-weight: 700; color: var(--color-text-main); font-size: 0.95rem;">${escapeHtml(cert.name || '')}</div>
                      <div style="font-size: 0.84rem; color: var(--color-text-muted); margin-top: 0.15rem;">
                        ${escapeHtml(certIssuer)} ${certYear ? `• Año: ${escapeHtml(String(certYear))}` : ''}
                      </div>
                      ${safeCertUrl ? `
                        <a href="${escapeHtml(safeCertUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; color: var(--color-primary-text); display: inline-flex; align-items: center; gap: 0.25rem; margin-top: 0.25rem; text-decoration: none;">
                          ${icons.externalLink(12)} Ver credencial
                        </a>
                      ` : ''}
                    </div>
                    <button style="border: none; background: none; color: var(--color-danger); cursor: pointer; padding: 0.25rem;" onclick="window.handleDeleteCert(${idx})" title="Eliminar certificación">
                      ${icons.trash(14)}
                    </button>
                  </div>
                `;
                }).join('')}
              </div>
            `}
          </div>

        </div>

        <!-- Right Column: Settings, CV, Competencies & Privacy -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Currículum Vitae Activo (MongoDB GridFS) -->
          <div class="card">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
              ${icons.fileText(18)} Currículum Vitae (GridFS)
            </h3>
            
            ${cv && cv.fileId ? `
              <div style="padding: 1.25rem; background-color: var(--color-bg-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div style="color: var(--color-role-candidate-text); background: var(--color-role-candidate-bg); padding: 0.5rem; border-radius: 8px;">
                    ${icons.fileText(28)}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.92rem; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${cv.fileName}">
                      ${cv.fileName}
                    </div>
                    <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 0.2rem;">
                      ${cv.fileSize || 'Doc'} • Subido: ${cv.uploadDate || 'Reciente'}
                    </div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <button type="button" class="btn btn-secondary btn-sm" style="text-align: center;" onclick="window.handleViewProtectedFile('${cv.fileId}', '${(cv.fileName || 'Curriculum.pdf').replace(/'/g, "\\'")}')">
                    ${icons.externalLink(13, 'inline-left')}Abrir
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" style="text-align: center;" onclick="window.handleDownloadProtectedFile('${cv.fileId}', '${(cv.fileName || 'Curriculum.pdf').replace(/'/g, "\\'")}')">
                    ${icons.download(13, 'inline-left')}Descargar
                  </button>
                </div>

                <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                  <label class="btn btn-secondary btn-sm btn-block" style="cursor: pointer;">
                    ${icons.upload(13, 'inline-left')}Reemplazar CV
                    <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display: none;" onchange="window.handleUploadCV(event)" />
                  </label>
                  <button class="btn btn-secondary btn-sm" style="color: var(--color-danger);" onclick="window.handleDeleteCV()" title="Eliminar este currículum de la base de datos">
                    ${icons.trash(13)}
                  </button>
                </div>
              </div>
            ` : `
              <div style="padding: 1.5rem 1rem; background-color: var(--color-bg-subtle); border: 2px dashed var(--color-border); border-radius: var(--radius-sm); text-align: center; margin-bottom: 1rem;">
                <div style="color: var(--color-role-candidate-text); margin-bottom: 0.5rem;">${icons.upload(32)}</div>
                <div style="font-weight: 700; font-size: 0.92rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">
                  Ningún currículum cargado
                </div>
                <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.75rem;">
                  Sube tu CV en formato PDF o DOCX (hasta 10 MB) para postular a las ofertas de empleo.
                </p>
                <label class="btn btn-candidato btn-sm" style="cursor: pointer; display: inline-flex;">
                  ${icons.upload(14, 'inline-left')}Seleccionar Archivo
                  <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display: none;" onchange="window.handleUploadCV(event)" />
                </label>
              </div>
            `}
          </div>

          <!-- Competencias y Habilidades Técnicas (Tags Interactivos) -->
          <div class="card">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
              ${icons.checkCircle(18)} Competencias y Habilidades
            </h3>
            <p style="font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: 0.75rem;">
              Haz clic en la <strong>×</strong> para remover una competencia o escribe una nueva para añadirla.
            </p>
            <div style="display: flex; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 1rem;" id="skills-list-container">
              ${skills.map(s => `
                <span class="tag primary skill-tag-removable" style="padding: 0.35rem 0.65rem; font-size: 0.82rem;">
                  ${s}
                  <button type="button" style="border: none; background: none; color: var(--color-primary-text); cursor: pointer; font-weight: bold; margin-left: 0.35rem; padding: 0; line-height: 1;" onclick="window.handleRemoveSkill('${s.replace(/'/g, "\\'")}')" title="Eliminar ${s}">×</button>
                </span>
              `).join('')}
            </div>

            <!-- Add Skill Input -->
            <form onsubmit="event.preventDefault(); window.handleAddSkill();" style="display: flex; gap: 0.5rem;">
              <input type="text" id="new-skill-input" class="form-control" style="font-size: 0.85rem; padding: 0.45rem 0.65rem;" placeholder="Ej. Docker, SQL, UI/UX..." maxlength="40" required />
              <button type="submit" class="btn btn-candidato btn-sm" style="white-space: nowrap;">
                ${icons.plus(13)} Añadir
              </button>
            </form>
          </div>

          <!-- Formulario de Edición: Datos Personales y de Contacto -->
          <div class="card">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
              ${icons.user(18)} Datos de Contacto y Perfil
            </h3>
            <form onsubmit="event.preventDefault(); window.handleSavePersonalData();">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;">
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.82rem;">Nombres</label>
                  <input type="text" id="u01-firstName" class="form-control" value="${user.firstName || ''}" required minlength="2" maxlength="60" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.82rem;">Apellidos</label>
                  <input type="text" id="u01-lastName" class="form-control" value="${user.lastName || ''}" required minlength="2" maxlength="60" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem;">Titular Profesional</label>
                <input type="text" id="u01-title" class="form-control" value="${user.title || ''}" maxlength="100" placeholder="Ej. Ingeniero de Software Full-Stack" />
              </div>

              ${phoneHelper.renderPhoneInputHtml('u01-phone', user.phone || '', 'Teléfono de Contacto', true)}

              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem;">Ubicación</label>
                <input type="text" id="u01-location" class="form-control" value="${user.location || ''}" maxlength="100" placeholder="Ciudad, País" />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem;">Enlace a Portafolio o Web</label>
                <input type="text" id="u01-portfolio" class="form-control" value="${links.portfolio || ''}" placeholder="https://miportafolio.com" />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem;">Perfil de LinkedIn</label>
                <input type="text" id="u01-linkedin" class="form-control" value="${links.linkedin || ''}" placeholder="linkedin.com/in/usuario" />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem;">Perfil de GitHub</label>
                <input type="text" id="u01-github" class="form-control" value="${links.github || ''}" placeholder="github.com/usuario" />
              </div>

              <button type="submit" class="btn btn-candidato btn-block btn-sm" style="margin-top: 0.5rem;">
                ${icons.check(14, 'inline-left')}Guardar Información de Contacto
              </button>
            </form>
          </div>

          <!-- Opciones de Privacidad y Visibilidad -->
          <div class="card">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.85rem; color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
              ${icons.shield(18)} Privacidad y Visibilidad
            </h3>
            <p style="font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: 1rem;">
              Configura qué datos son visibles para los reclutadores y empresas que buscan talento en la plataforma.
            </p>

            <form onsubmit="event.preventDefault(); window.handleSavePrivacy();">
              <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; font-size: 0.85rem;">
                <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="privacy-phone" ${privacy.showPhoneToCompanies !== false ? 'checked' : ''} style="margin-top: 0.2rem;" />
                  <span>Mostrar número de teléfono a empresas y reclutadores registrados.</span>
                </label>
                <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="privacy-email" ${privacy.showEmailToCompanies !== false ? 'checked' : ''} style="margin-top: 0.2rem;" />
                  <span>Mostrar correo electrónico a reclutadores verificados.</span>
                </label>
                <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="privacy-public" ${privacy.isProfilePublic !== false ? 'checked' : ''} style="margin-top: 0.2rem;" />
                  <span>Perfil visible en búsquedas de talento de reclutadores.</span>
                </label>
              </div>

              <button type="submit" class="btn btn-secondary btn-block btn-sm">
                ${icons.check(14, 'inline-left')}Guardar Preferencias de Privacidad
              </button>
            </form>
          </div>

          <!-- Configuración de Tema (Modo Oscuro / Claro) -->
          ${renderAccountThemeSettingsCard(user)}

        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    phoneHelper.setupPhoneInput('u01-phone');
    loadProtectedCandidateMedia(user);
  }, 50);
}

// -------------------------------------------------------------
// Candidate Profile Action Handlers (GridFS & Contact)
// -------------------------------------------------------------

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve({
        base64,
        mimeType: file.type || 'application/octet-stream',
        name: file.name,
        size: file.size
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.handleUploadCandidateAvatar = async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    state.showToast('Solo se permiten imágenes en formato JPG, PNG o WEBP.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    state.showToast('La fotografía no debe superar 5 MB.', 'error');
    return;
  }

  try {
    state.showToast('Cargando fotografía a MongoDB GridFS...', 'info');
    const { base64, mimeType, name } = await readFileAsBase64(file);
    const res = await api.uploadFile({
      fileName: name,
      mimeType,
      base64Data: base64,
      fileType: 'avatar'
    });
    if (res.user) state.setUser(res.user);
    state.showToast('Fotografía de perfil guardada exitosamente.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleDeleteCandidateAvatar = async () => {
  const user = state.currentUser;
  if (!user || (!user.avatarFileId && !user.avatar)) return;
  try {
    let res = null;
    if (user.avatarFileId) {
      res = await api.deleteFile(user.avatarFileId);
    } else {
      res = await api.updateProfile({ avatar: '' });
    }
    state.showToast('Fotografía eliminada del perfil.', 'success');
    if (res?.user) {
      state.setUser(res.user);
    } else {
      const meRes = await api.getMe();
      state.setUser(meRes.user);
    }
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleUploadCandidateBanner = async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    state.showToast('Solo se permiten imágenes JPG, PNG o WEBP para la portada.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    state.showToast('La imagen de portada no debe superar 5 MB.', 'error');
    return;
  }

  try {
    state.showToast('Subiendo portada a MongoDB GridFS...', 'info');
    const { base64, mimeType, name } = await readFileAsBase64(file);
    const res = await api.uploadFile({
      fileName: name,
      mimeType,
      base64Data: base64,
      fileType: 'banner'
    });
    if (res.user) state.setUser(res.user);
    state.showToast('Portada de perfil actualizada.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleDeleteCandidateBanner = async () => {
  if (!state.currentUser.bannerFileId) return;
  try {
    const res = await api.deleteFile(state.currentUser.bannerFileId);
    state.showToast('Portada eliminada.', 'success');
    if (res.user) {
      state.setUser(res.user);
    } else {
      const meRes = await api.getMe();
      state.setUser(meRes.user);
    }
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleUploadCV = async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const validExts = ['.pdf', '.docx'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!validExts.includes(ext)) {
    state.showToast('Solo se permiten documentos en formato PDF o DOCX.', 'error');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    state.showToast('El archivo de currículum no debe exceder 10 MB.', 'error');
    return;
  }

  try {
    state.showToast('Cargando currículum a MongoDB GridFS...', 'info');
    const { base64, mimeType, name } = await readFileAsBase64(file);
    const effectiveMime = ext === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const res = await api.uploadFile({
      fileName: name,
      mimeType: effectiveMime,
      base64Data: base64,
      fileType: 'cv'
    });
    if (res.user) state.setUser(res.user);
    state.showToast(`Currículum "${name}" guardado exitosamente en GridFS.`, 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleDeleteCV = async () => {
  const cvId = state.currentUser?.cv?.fileId;
  if (!cvId) return;
  if (!confirm('¿Deseas eliminar tu archivo de Currículum Vitae actual?')) return;

  try {
    const res = await api.deleteFile(cvId);
    state.showToast('Currículum eliminado de la base de datos.', 'success');
    if (res.user) {
      state.setUser(res.user);
    } else {
      const meRes = await api.getMe();
      state.setUser(meRes.user);
    }
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleSavePersonalData = async () => {
  const firstName = document.getElementById('u01-firstName').value.trim();
  const lastName = document.getElementById('u01-lastName').value.trim();
  const title = document.getElementById('u01-title').value.trim();
  const phone = phoneHelper.getValue('u01-phone');
  const location = document.getElementById('u01-location').value.trim();
  const portfolio = document.getElementById('u01-portfolio').value.trim();
  const linkedin = document.getElementById('u01-linkedin').value.trim();
  const github = document.getElementById('u01-github').value.trim();

  const currentLinks = state.currentUser.links || {};
  const updatedLinks = {
    ...currentLinks,
    portfolio,
    linkedin,
    github
  };

  try {
    const res = await api.updateProfile({
      firstName,
      lastName,
      title,
      phone,
      location,
      links: updatedLinks
    });
    state.setUser(res.user);
    state.showToast('Datos de contacto y perfil guardados en MongoDB.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.openEditBioModal = () => {
  const currentBio = state.currentUser.bio || '';
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Editar Resumen Profesional</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); window.handleSaveBio();">
            <div class="form-group">
              <label class="form-label">Acerca de mí (Trayectoria, metas y especialidad)</label>
              <textarea id="modal-bio-input" class="form-control" style="min-height: 140px;" maxlength="1500" required>${currentBio}</textarea>
              <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem; display: block;">
                Máximo 1500 caracteres. Este texto será lo primero que leerán los reclutadores.
              </span>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm">${icons.check(14, 'inline-left')}Guardar Resumen</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.handleSaveBio = async () => {
  const bio = document.getElementById('modal-bio-input').value.trim();
  try {
    const res = await api.updateProfile({ bio });
    state.setUser(res.user);
    window.closeModal();
    state.showToast('Resumen profesional actualizado en la base de datos.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

function validateCandidateTextFieldClient(value, { label, required = true, minLength = 2, maxLength = 100, minLetters = 2 }) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) {
    if (required) return { error: `El campo ${label} es obligatorio.` };
    return { value: '' };
  }
  if (clean.length < minLength) {
    return { error: `Debe tener al menos ${minLength} caracteres.` };
  }
  if (clean.length > maxLength) {
    return { error: `No debe superar los ${maxLength} caracteres.` };
  }
  const letters = (clean.match(/\p{L}/gu) || []).length;
  if (letters < minLetters) {
    return { error: 'Ingresa texto válido (no se permiten únicamente símbolos o números).' };
  }
  const nonSpace = clean.replace(/\s+/g, '');
  const alnum = (nonSpace.match(/[\p{L}\p{N}]/gu) || []).length;
  if (nonSpace.length >= 6 && alnum / nonSpace.length < 0.4) {
    return { error: 'El texto contiene demasiados símbolos. Ingresa información real y legible.' };
  }
  return { value: clean };
}

function isValidRealCalendarDateClient(str) {
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

function formatCalendarDisplayDateClient(isoDate) {
  if (!isoDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }
  return isoDate;
}

function formatRecordPeriod(record, currentLabel) {
  if (!record) return '';
  if (record.period) return record.period;
  const start = formatCalendarDisplayDateClient(record.startDate || '');
  if (record.current) return start ? `${start} - ${currentLabel}` : currentLabel;
  const end = formatCalendarDisplayDateClient(record.endDate || '');
  if (start && end) return `${start} - ${end}`;
  return start || end || '';
}

function clearModalFieldErrors(fieldIds) {
  fieldIds.forEach(id => {
    const input = document.getElementById(id);
    const errEl = document.getElementById(`${id}-error`);
    if (input) input.classList.remove('is-invalid');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('visible');
    }
  });
}

function setModalFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errEl = document.getElementById(`${fieldId}-error`);
  if (input) input.classList.add('is-invalid');
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.add('visible');
  }
}

window.syncModalEndDateMin = (startId, endId) => {
  const startEl = document.getElementById(startId);
  const endEl = document.getElementById(endId);
  if (!startEl || !endEl) return;
  if (startEl.value && isValidRealCalendarDateClient(startEl.value)) {
    endEl.min = startEl.value;
  } else {
    endEl.min = '1950-01-01';
  }
};

window.toggleExperienceCurrent = () => {
  const currentEl = document.getElementById('exp-current');
  const endEl = document.getElementById('exp-endDate');
  const endErr = document.getElementById('exp-endDate-error');
  if (!currentEl || !endEl) return;
  if (currentEl.checked) {
    endEl.value = '';
    endEl.disabled = true;
    endEl.classList.remove('is-invalid');
    if (endErr) {
      endErr.textContent = '';
      endErr.classList.remove('visible');
    }
  } else {
    endEl.disabled = false;
  }
};

window.toggleEducationCurrent = () => {
  const currentEl = document.getElementById('edu-current');
  const endEl = document.getElementById('edu-endDate');
  const endErr = document.getElementById('edu-endDate-error');
  if (!currentEl || !endEl) return;
  if (currentEl.checked) {
    endEl.value = '';
    endEl.disabled = true;
    endEl.classList.remove('is-invalid');
    if (endErr) {
      endErr.textContent = '';
      endErr.classList.remove('visible');
    }
  } else {
    endEl.disabled = false;
  }
};

window.openAddExperienceModal = () => {
  const maxDate = `${new Date().getFullYear() + 5}-12-31`;
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 520px;">
        <div class="modal-header">
          <h3>Agregar Experiencia Laboral</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form novalidate onsubmit="event.preventDefault(); window.handleSaveExperience();">
            <div class="form-group">
              <label class="form-label" for="exp-position">Cargo / Puesto Desempeñado *</label>
              <input type="text" id="exp-position" class="form-control" placeholder="Ej. Desarrollador Web Full Stack, Analista de Datos" required maxlength="100" />
              <div id="exp-position-error" class="field-error" role="alert"></div>
            </div>
            <div class="form-group">
              <label class="form-label" for="exp-company">Empresa u Organización *</label>
              <input type="text" id="exp-company" class="form-control" placeholder="Ej. Soluciones Digitales S.A., TechCorp" required maxlength="100" />
              <div id="exp-company-error" class="field-error" role="alert"></div>
            </div>
            <div class="form-group">
              <label class="form-label" for="exp-location">Ubicación</label>
              <input type="text" id="exp-location" class="form-control" placeholder="Ej. San Salvador (Remoto / Presencial)" maxlength="100" />
              <div id="exp-location-error" class="field-error" role="alert"></div>
            </div>
            <div class="grid-form-2">
              <div class="form-group">
                <label class="form-label" for="exp-startDate">Fecha de inicio *</label>
                <input type="date" id="exp-startDate" class="form-control" min="1950-01-01" max="${maxDate}" onchange="window.syncModalEndDateMin('exp-startDate', 'exp-endDate')" required />
                <div id="exp-startDate-error" class="field-error" role="alert"></div>
              </div>
              <div class="form-group">
                <label class="form-label" for="exp-endDate">Fecha de finalización</label>
                <input type="date" id="exp-endDate" class="form-control" min="1950-01-01" max="${maxDate}" />
                <div id="exp-endDate-error" class="field-error" role="alert"></div>
              </div>
            </div>
            <div class="form-group" style="margin-top: -0.25rem;">
              <label style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--color-text-body); cursor: pointer;">
                <input type="checkbox" id="exp-current" onchange="window.toggleExperienceCurrent()" />
                <span>Actualmente trabajo aquí</span>
              </label>
            </div>
            <div class="form-group">
              <label class="form-label" for="exp-description">Descripción de Responsabilidades y Logros *</label>
              <textarea id="exp-description" class="form-control" placeholder="Describe brevemente tus logros principales, tecnologías utilizadas y aportes al equipo..." required maxlength="1000"></textarea>
              <div id="exp-description-error" class="field-error" role="alert"></div>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm">${icons.plus(14, 'inline-left')}Guardar Experiencia</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.handleSaveExperience = async () => {
  const fieldIds = ['exp-position', 'exp-company', 'exp-location', 'exp-startDate', 'exp-endDate', 'exp-description'];
  clearModalFieldErrors(fieldIds);

  const rawPosition = document.getElementById('exp-position').value;
  const rawCompany = document.getElementById('exp-company').value;
  const rawLocation = document.getElementById('exp-location').value;
  const startDate = document.getElementById('exp-startDate').value.trim();
  const isCurrent = document.getElementById('exp-current').checked;
  const endDate = isCurrent ? '' : document.getElementById('exp-endDate').value.trim();
  const rawDescription = document.getElementById('exp-description').value;

  let firstInvalidId = null;
  const registerErr = (id, msg) => {
    setModalFieldError(id, msg);
    if (!firstInvalidId) firstInvalidId = id;
  };

  const posCheck = validateCandidateTextFieldClient(rawPosition, { label: 'Cargo / Puesto Desempeñado', required: true, minLength: 2, maxLength: 100, minLetters: 2 });
  if (posCheck.error) registerErr('exp-position', posCheck.error);

  const compCheck = validateCandidateTextFieldClient(rawCompany, { label: 'Empresa u Organización', required: true, minLength: 2, maxLength: 100, minLetters: 2 });
  if (compCheck.error) registerErr('exp-company', compCheck.error);

  const locCheck = validateCandidateTextFieldClient(rawLocation, { label: 'Ubicación', required: false, minLength: 2, maxLength: 100, minLetters: 2 });
  if (locCheck.error) registerErr('exp-location', locCheck.error);

  let startValid = false;
  if (!startDate) {
    registerErr('exp-startDate', 'La fecha de inicio es obligatoria.');
  } else if (!isValidRealCalendarDateClient(startDate)) {
    registerErr('exp-startDate', 'Ingresa una fecha de inicio válida.');
  } else {
    startValid = true;
  }

  if (!isCurrent) {
    if (!endDate) {
      registerErr('exp-endDate', 'Ingresa la fecha de finalización o marca "Actualmente trabajo aquí".');
    } else if (!isValidRealCalendarDateClient(endDate)) {
      registerErr('exp-endDate', 'Ingresa una fecha de finalización válida.');
    } else if (startValid && endDate < startDate) {
      registerErr('exp-endDate', 'La fecha de finalización no puede ser anterior a la fecha de inicio.');
    }
  }

  const descCheck = validateCandidateTextFieldClient(rawDescription, { label: 'Descripción de Responsabilidades y Logros', required: true, minLength: 10, maxLength: 1000, minLetters: 5 });
  if (descCheck.error) registerErr('exp-description', descCheck.error);

  if (firstInvalidId) {
    const firstEl = document.getElementById(firstInvalidId);
    if (firstEl) firstEl.focus();
    return;
  }

  const period = isCurrent
    ? `${formatCalendarDisplayDateClient(startDate)} - Actualidad`
    : `${formatCalendarDisplayDateClient(startDate)} - ${formatCalendarDisplayDateClient(endDate)}`;

  const currentExp = Array.isArray(state.currentUser.experience) ? [...state.currentUser.experience] : [];
  currentExp.unshift({
    position: posCheck.value,
    company: compCheck.value,
    location: locCheck.value,
    startDate,
    endDate,
    current: isCurrent,
    period,
    description: descCheck.value
  });

  try {
    const res = await api.updateProfile({ experience: currentExp });
    state.setUser(res.user);
    window.closeModal();
    state.showToast('Puesto laboral agregado con éxito.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleDeleteExperience = async (idx) => {
  if (!confirm('¿Confirma que desea eliminar este registro de experiencia laboral?')) return;
  const currentExp = Array.isArray(state.currentUser.experience) ? [...state.currentUser.experience] : [];
  currentExp.splice(idx, 1);

  try {
    const res = await api.updateProfile({ experience: currentExp });
    state.setUser(res.user);
    state.showToast('Registro de experiencia eliminado.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.openAddEducationModal = () => {
  const maxDate = `${new Date().getFullYear() + 5}-12-31`;
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 520px;">
        <div class="modal-header">
          <h3>Agregar Formación Académica</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form novalidate onsubmit="event.preventDefault(); window.handleSaveEducation();">
            <div class="form-group">
              <label class="form-label" for="edu-degree">Título Obtenido o en Curso *</label>
              <input type="text" id="edu-degree" class="form-control" placeholder="Ej. Licenciatura en Administración, Técnico en Redes, Ingeniería" required maxlength="100" />
              <div id="edu-degree-error" class="field-error" role="alert"></div>
            </div>
            <div class="form-group">
              <label class="form-label" for="edu-institution">Institución Educativa *</label>
              <input type="text" id="edu-institution" class="form-control" placeholder="Ej. Instituto Tecnológico, Universidad, Academia Digital" required maxlength="120" />
              <div id="edu-institution-error" class="field-error" role="alert"></div>
            </div>
            <div class="form-group">
              <label class="form-label" for="edu-level">Nivel de Estudio *</label>
              <select id="edu-level" class="form-control">
                <option value="Grado Universitario">Grado Universitario / Licenciatura</option>
                <option value="Maestría / Posgrado">Maestría / Posgrado</option>
                <option value="Técnico Superior">Técnico Superior</option>
                <option value="Diplomado / Especialización">Diplomado / Especialización</option>
                <option value="Bachillerato">Bachillerato / Educación Media</option>
                <option value="Certificación Profesional">Certificación Profesional</option>
              </select>
              <div id="edu-level-error" class="field-error" role="alert"></div>
            </div>
            <div class="grid-form-2">
              <div class="form-group">
                <label class="form-label" for="edu-startDate">Fecha de inicio *</label>
                <input type="date" id="edu-startDate" class="form-control" min="1950-01-01" max="${maxDate}" onchange="window.syncModalEndDateMin('edu-startDate', 'edu-endDate')" required />
                <div id="edu-startDate-error" class="field-error" role="alert"></div>
              </div>
              <div class="form-group">
                <label class="form-label" for="edu-endDate">Fecha de finalización</label>
                <input type="date" id="edu-endDate" class="form-control" min="1950-01-01" max="${maxDate}" />
                <div id="edu-endDate-error" class="field-error" role="alert"></div>
              </div>
            </div>
            <div class="form-group" style="margin-top: -0.25rem;">
              <label style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--color-text-body); cursor: pointer;">
                <input type="checkbox" id="edu-current" onchange="window.toggleEducationCurrent()" />
                <span>Mis estudios continúan en curso</span>
              </label>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm">${icons.plus(14, 'inline-left')}Guardar Formación</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.handleSaveEducation = async () => {
  const fieldIds = ['edu-degree', 'edu-institution', 'edu-level', 'edu-startDate', 'edu-endDate'];
  clearModalFieldErrors(fieldIds);

  const rawDegree = document.getElementById('edu-degree').value;
  const rawInstitution = document.getElementById('edu-institution').value;
  const level = document.getElementById('edu-level').value;
  const startDate = document.getElementById('edu-startDate').value.trim();
  const isCurrent = document.getElementById('edu-current').checked;
  const endDate = isCurrent ? '' : document.getElementById('edu-endDate').value.trim();

  let firstInvalidId = null;
  const registerErr = (id, msg) => {
    setModalFieldError(id, msg);
    if (!firstInvalidId) firstInvalidId = id;
  };

  const degCheck = validateCandidateTextFieldClient(rawDegree, { label: 'Título Obtenido o en Curso', required: true, minLength: 2, maxLength: 100, minLetters: 2 });
  if (degCheck.error) registerErr('edu-degree', degCheck.error);

  const instCheck = validateCandidateTextFieldClient(rawInstitution, { label: 'Institución Educativa', required: true, minLength: 2, maxLength: 120, minLetters: 2 });
  if (instCheck.error) registerErr('edu-institution', instCheck.error);

  if (!level) {
    registerErr('edu-level', 'Selecciona un nivel de estudio válido.');
  }

  let startValid = false;
  if (!startDate) {
    registerErr('edu-startDate', 'La fecha de inicio es obligatoria.');
  } else if (!isValidRealCalendarDateClient(startDate)) {
    registerErr('edu-startDate', 'Ingresa una fecha de inicio válida.');
  } else {
    startValid = true;
  }

  if (!isCurrent) {
    if (!endDate) {
      registerErr('edu-endDate', 'Ingresa la fecha de finalización o marca "Mis estudios continúan en curso".');
    } else if (!isValidRealCalendarDateClient(endDate)) {
      registerErr('edu-endDate', 'Ingresa una fecha de finalización válida.');
    } else if (startValid && endDate < startDate) {
      registerErr('edu-endDate', 'La fecha de finalización no puede ser anterior a la fecha de inicio.');
    }
  }

  if (firstInvalidId) {
    const firstEl = document.getElementById(firstInvalidId);
    if (firstEl) firstEl.focus();
    return;
  }

  const period = isCurrent
    ? `${formatCalendarDisplayDateClient(startDate)} - En curso`
    : `${formatCalendarDisplayDateClient(startDate)} - ${formatCalendarDisplayDateClient(endDate)}`;

  const currentEdu = Array.isArray(state.currentUser.education) ? [...state.currentUser.education] : [];
  currentEdu.unshift({
    degree: degCheck.value,
    institution: instCheck.value,
    level,
    startDate,
    endDate,
    current: isCurrent,
    period
  });

  try {
    const res = await api.updateProfile({ education: currentEdu });
    state.setUser(res.user);
    window.closeModal();
    state.showToast('Formación académica guardada correctamente.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleDeleteEducation = async (idx) => {
  if (!confirm('¿Confirma que desea eliminar este registro educativo?')) return;
  const currentEdu = Array.isArray(state.currentUser.education) ? [...state.currentUser.education] : [];
  currentEdu.splice(idx, 1);

  try {
    const res = await api.updateProfile({ education: currentEdu });
    state.setUser(res.user);
    state.showToast('Registro de formación eliminado.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

function isValidHttpUrlClient(str) {
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

window.openAddLanguageModal = () => {
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3>Agregar Idioma</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form novalidate onsubmit="event.preventDefault(); window.handleSaveLanguage();">
            <div class="form-group">
              <label class="form-label" for="lang-name">Idioma *</label>
              <input type="text" id="lang-name" class="form-control" placeholder="Ej. Inglés, Francés, Alemán, Portugués" required maxlength="50" />
              <div id="lang-name-error" class="field-error" role="alert"></div>
            </div>
            <div class="form-group">
              <label class="form-label" for="lang-level">Nivel de Dominio *</label>
              <select id="lang-level" class="form-control">
                <option value="Nativo / Lengua Materna">Nativo / Lengua Materna</option>
                <option value="Avanzado Profesional (C1/C2)">Avanzado Profesional (C1/C2)</option>
                <option value="Intermedio Alto (B2)">Intermedio Alto (B2)</option>
                <option value="Intermedio (B1)">Intermedio (B1)</option>
                <option value="Básico (A1/A2)">Básico (A1/A2)</option>
              </select>
              <div id="lang-level-error" class="field-error" role="alert"></div>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm">${icons.plus(14, 'inline-left')}Guardar Idioma</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.handleSaveLanguage = async () => {
  const fieldIds = ['lang-name', 'lang-level'];
  clearModalFieldErrors(fieldIds);

  const language = document.getElementById('lang-name').value.trim();
  const level = document.getElementById('lang-level').value.trim();

  let firstInvalidId = null;
  const registerErr = (id, msg) => {
    setModalFieldError(id, msg);
    if (!firstInvalidId) firstInvalidId = id;
  };

  if (!language) {
    registerErr('lang-name', 'El nombre del idioma es obligatorio.');
  } else if (language.length < 2 || language.length > 50) {
    registerErr('lang-name', 'El nombre del idioma debe tener entre 2 y 50 caracteres.');
  } else if (/\p{N}/u.test(language)) {
    registerErr('lang-name', 'El nombre del idioma no debe contener números.');
  } else {
    const letters = (language.match(/\p{L}/gu) || []).length;
    if (letters < 2 || !/^[\p{L}](?:[\p{L}\s'()-]*[\p{L})])?$/u.test(language)) {
      registerErr('lang-name', 'Ingresa un nombre de idioma válido (solo letras, espacios, tildes o guiones).');
    }
  }

  if (!level) {
    registerErr('lang-level', 'Selecciona un nivel de dominio válido.');
  }

  if (firstInvalidId) {
    const firstEl = document.getElementById(firstInvalidId);
    if (firstEl) firstEl.focus();
    return;
  }

  const currentLanguages = Array.isArray(state.currentUser.languages) ? [...state.currentUser.languages] : [];
  currentLanguages.push({ language, level });

  try {
    const res = await api.updateProfile({ languages: currentLanguages });
    state.setUser(res.user);
    window.closeModal();
    state.showToast('Idioma registrado exitosamente.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleDeleteLanguage = async (idx) => {
  const currentLanguages = Array.isArray(state.currentUser.languages) ? [...state.currentUser.languages] : [];
  currentLanguages.splice(idx, 1);

  try {
    const res = await api.updateProfile({ languages: currentLanguages });
    state.setUser(res.user);
    state.showToast('Idioma eliminado.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.openAddCertModal = () => {
  const currentYear = new Date().getFullYear();
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Agregar Certificación Profesional</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form novalidate onsubmit="event.preventDefault(); window.handleSaveCert();">
            <div class="form-group">
              <label class="form-label" for="cert-name">Nombre de la Certificación *</label>
              <input type="text" id="cert-name" class="form-control" placeholder="Ej. AWS Certified Solutions Architect, Scrum Master" required maxlength="120" />
              <div id="cert-name-error" class="field-error" role="alert"></div>
            </div>
            <div class="form-group">
              <label class="form-label" for="cert-issuer">Entidad Emisora *</label>
              <input type="text" id="cert-issuer" class="form-control" placeholder="Ej. Amazon Web Services, Scrum.org, Google Cloud" required maxlength="100" />
              <div id="cert-issuer-error" class="field-error" role="alert"></div>
            </div>
            <div class="grid-form-2">
              <div class="form-group">
                <label class="form-label" for="cert-year">Año de Emisión *</label>
                <input type="number" id="cert-year" class="form-control" placeholder="Ej. 2024" min="1950" max="${currentYear}" step="1" required />
                <div id="cert-year-error" class="field-error" role="alert"></div>
              </div>
              <div class="form-group">
                <label class="form-label" for="cert-url">URL de Credencial (Opcional)</label>
                <input type="url" id="cert-url" class="form-control" placeholder="https://..." maxlength="300" />
                <div id="cert-url-error" class="field-error" role="alert"></div>
              </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm">${icons.plus(14, 'inline-left')}Guardar Certificación</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.handleSaveCert = async () => {
  const fieldIds = ['cert-name', 'cert-issuer', 'cert-year', 'cert-url'];
  clearModalFieldErrors(fieldIds);

  const rawName = document.getElementById('cert-name').value;
  const rawIssuer = document.getElementById('cert-issuer').value;
  const rawYear = document.getElementById('cert-year').value.trim();
  const url = document.getElementById('cert-url').value.trim();
  const currentYear = new Date().getFullYear();

  let firstInvalidId = null;
  const registerErr = (id, msg) => {
    setModalFieldError(id, msg);
    if (!firstInvalidId) firstInvalidId = id;
  };

  const nameCheck = validateCandidateTextFieldClient(rawName, { label: 'Nombre de la Certificación', required: true, minLength: 2, maxLength: 120, minLetters: 2 });
  if (nameCheck.error) registerErr('cert-name', nameCheck.error);

  const issuerCheck = validateCandidateTextFieldClient(rawIssuer, { label: 'Entidad Emisora', required: true, minLength: 2, maxLength: 100, minLetters: 2 });
  if (issuerCheck.error) registerErr('cert-issuer', issuerCheck.error);

  if (!rawYear) {
    registerErr('cert-year', 'El año de emisión es obligatorio.');
  } else if (!/^\d{4}$/.test(rawYear)) {
    registerErr('cert-year', 'Ingresa un año numérico válido de 4 dígitos (ej. 2024).');
  } else {
    const yearNum = parseInt(rawYear, 10);
    if (yearNum < 1950 || yearNum > currentYear) {
      registerErr('cert-year', `El año de emisión debe estar entre 1950 y ${currentYear} (no se permiten años futuros).`);
    }
  }

  if (url && !isValidHttpUrlClient(url)) {
    registerErr('cert-url', 'Ingresa una URL válida que inicie con http:// o https://.');
  }

  if (firstInvalidId) {
    const firstEl = document.getElementById(firstInvalidId);
    if (firstEl) firstEl.focus();
    return;
  }

  const currentCerts = Array.isArray(state.currentUser.certifications) ? [...state.currentUser.certifications] : [];
  currentCerts.unshift({ name: nameCheck.value, issuer: issuerCheck.value, year: rawYear, url });

  try {
    const res = await api.updateProfile({ certifications: currentCerts });
    state.setUser(res.user);
    window.closeModal();
    state.showToast('Certificación profesional guardada.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleDeleteCert = async (idx) => {
  const currentCerts = Array.isArray(state.currentUser.certifications) ? [...state.currentUser.certifications] : [];
  currentCerts.splice(idx, 1);

  try {
    const res = await api.updateProfile({ certifications: currentCerts });
    state.setUser(res.user);
    state.showToast('Certificación eliminada.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleAddSkill = async () => {
  const input = document.getElementById('new-skill-input');
  if (!input) return;
  const newSkill = input.value.trim();
  if (!newSkill) return;

  const currentSkills = Array.isArray(state.currentUser.skills) ? [...state.currentUser.skills] : [];
  if (currentSkills.some(s => s.toLowerCase() === newSkill.toLowerCase())) {
    state.showToast('La competencia ya se encuentra en tu lista.', 'error');
    return;
  }

  currentSkills.push(newSkill);
  try {
    const res = await api.updateProfile({ skills: currentSkills });
    state.setUser(res.user);
    input.value = '';
    state.showToast(`Competencia "${newSkill}" añadida a tu perfil.`, 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleRemoveSkill = async (skillToRemove) => {
  const currentSkills = Array.isArray(state.currentUser.skills) ? [...state.currentUser.skills] : [];
  const updatedSkills = currentSkills.filter(s => s !== skillToRemove);

  try {
    const res = await api.updateProfile({ skills: updatedSkills });
    state.setUser(res.user);
    state.showToast(`Competencia "${skillToRemove}" removida.`, 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleSavePrivacy = async () => {
  const showPhoneToCompanies = document.getElementById('privacy-phone').checked;
  const showEmailToCompanies = document.getElementById('privacy-email').checked;
  const isProfilePublic = document.getElementById('privacy-public').checked;

  try {
    const res = await api.updateProfile({
      privacy: {
        showPhoneToCompanies,
        showEmailToCompanies,
        isProfilePublic
      }
    });
    state.setUser(res.user);
    state.showToast('Preferencias de privacidad guardadas en MongoDB.', 'success');
    renderU01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

let u02AppsCache = [];

async function renderU02() {
  const user = state.currentUser;
  if (!user || user.role !== 'candidato') {
    appContent.innerHTML = `<div class="container"><div class="card"><p>Acceso restringido para candidatos.</p></div></div>`;
    return;
  }

  const statusFilter = state.screenParams.status || '';
  const res = await api.getApplications(statusFilter ? { status: statusFilter } : {});
  const applications = res.applications || [];
  u02AppsCache = applications;

  const totalCount = applications.length;
  const inProgressCount = applications.filter(a => ['En proceso', 'Finalista'].includes(a.status)).length;
  const hiredCount = applications.filter(a => a.status === 'Contratado').length;
  const discardedCount = applications.filter(a => a.status === 'Descartado').length;

  appContent.innerHTML = `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main);">Mis Postulaciones Laborales</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem;">Historial y estado de postulaciones registradas en MongoDB.</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="u02-status-filter" class="form-control" style="width: auto; font-size: 0.85rem;" onchange="window.navigateTo('U-02', { status: this.value })">
            <option value="">Todos los estados</option>
            <option value="Enviada" ${statusFilter === 'Enviada' ? 'selected' : ''}>Enviada</option>
            <option value="En proceso" ${statusFilter === 'En proceso' ? 'selected' : ''}>En proceso</option>
            <option value="Finalista" ${statusFilter === 'Finalista' ? 'selected' : ''}>Finalista</option>
            <option value="Contratado" ${statusFilter === 'Contratado' ? 'selected' : ''}>Contratado</option>
            <option value="Descartado" ${statusFilter === 'Descartado' ? 'selected' : ''}>Descartado</option>
          </select>
          <button class="btn btn-candidato btn-sm" onclick="window.navigateTo('P-02')">
            ${icons.search(14, 'inline-left')}Explorar Vacantes
          </button>
        </div>
      </div>

      <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-candidate-text);">${totalCount}</div>
          <div class="stat-label">${statusFilter ? 'Coincidentes' : 'Total Postulaciones'}</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-candidate-text);">${inProgressCount}</div>
          <div class="stat-label">En Proceso / Finalista</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-success-text);">${hiredCount}</div>
          <div class="stat-label">Contrataciones</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-text-muted);">${discardedCount}</div>
          <div class="stat-label">Descartadas</div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Oferta Laboral</th>
              <th>Empresa</th>
              <th>CV Adjunto</th>
              <th>Fecha de Envío</th>
              <th>Estado Actual</th>
              <th>Última Nota Registrada</th>
              <th>Historial</th>
            </tr>
          </thead>
          <tbody>
            ${applications.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--color-text-muted);">
                  No registra postulaciones coincidentes con los filtros seleccionados.
                </td>
              </tr>
            ` : applications.map(app => {
              const lastHistory = app.history && app.history.length ? app.history[app.history.length - 1] : { note: 'Enviada' };
              let statusTag = 'tag';
              if (app.status === 'Enviada') statusTag = 'tag';
              if (app.status === 'En proceso') statusTag = 'tag primary';
              if (app.status === 'Finalista' || app.status === 'Contratado') statusTag = 'tag success';
              if (app.status === 'Descartado') statusTag = 'tag warning';

              return `
                <tr>
                  <td>
                    <a href="#P-03" onclick="event.preventDefault(); window.navigateTo('P-03', { jobId: '${escapeHtml(app.jobId)}' });" style="font-weight: 600; color: var(--color-primary-text); text-decoration: none;">
                      ${escapeHtml(app.jobTitle)}
                    </a>
                  </td>
                  <td>
                    <a href="#E-01" onclick="event.preventDefault(); window.navigateTo('E-01', { companyId: '${escapeHtml(app.companyId)}' });" style="color: var(--color-text-secondary); text-decoration: none;">
                      ${escapeHtml(app.companyName)}
                    </a>
                  </td>
                  <td style="font-size: 0.82rem; color: var(--color-text-muted);">
                    ${escapeHtml(app.cvFileName || 'CV')}
                  </td>
                  <td>${escapeHtml(app.appliedAt)}</td>
                  <td><span class="${statusTag}">${escapeHtml(app.status)}</span></td>
                  <td style="font-size: 0.82rem; color: var(--color-text-muted); max-width: 250px;">${escapeHtml(lastHistory.note)}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.viewAppTimeline('${escapeHtml(app._id)}')">
                      ${icons.clock(13, 'inline-left')}Ver Línea
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.viewAppTimeline = (appId) => {
  const app = u02AppsCache.find(a => a._id === appId);
  if (!app) return;
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Historial de Postulación</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 1rem;">
            <h4 style="font-size: 1rem; font-weight: 700;">${escapeHtml(app.jobTitle)}</h4>
            <span style="font-size: 0.85rem; color: var(--color-text-muted);">${escapeHtml(app.companyName)} • CV: ${escapeHtml(app.cvFileName || 'Adjunto')}</span>
          </div>

          ${app.coverNote ? `
            <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: var(--color-bg-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
              <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 0.25rem;">Tu Carta / Nota de Presentación:</div>
              <div style="font-size: 0.88rem; color: var(--color-text-body); white-space: pre-line;">${escapeHtml(app.coverNote)}</div>
            </div>
          ` : ''}

          <h5 style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 0.75rem;">Etapas y Respuestas Registradas:</h5>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${(app.history || []).map(h => `
              <div style="padding: 0.75rem; background-color: var(--color-bg-subtle); border-left: 3px solid var(--color-role-candidate); border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.2rem;">
                  <strong style="color: var(--color-text-secondary);">${escapeHtml(h.status)}</strong>
                  <span>${escapeHtml(h.date)}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--color-text-body);">${escapeHtml(h.note)}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.closeModal()">Cerrar</button>
        </div>
      </div>
    </div>
  `;
};

/* ==========================================================================
   PANTALLA U-03: MIS ALERTAS DE EMPLEO
   ========================================================================== */
async function renderU03() {
  const user = state.currentUser;
  if (!user || user.role !== 'candidato') {
    appContent.innerHTML = `<div class="container"><div class="card"><p>Acceso restringido para candidatos.</p></div></div>`;
    return;
  }

  const res = await api.getAlerts();
  const alerts = res.alerts || [];

  appContent.innerHTML = `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem;">
        <div>
          <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main);">Alertas de Empleo Personalizadas</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem;">Criterios de búsqueda automática para notificaciones de nuevas vacantes.</p>
        </div>
        <button class="btn btn-candidato btn-sm" onclick="window.openCreateAlertModal()">
          ${icons.plus(15, 'inline-left')}Nueva Alerta
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${alerts.length === 0 ? `
          <div class="card" style="text-align: center; padding: 3rem;">
            <div style="color: var(--color-text-muted); margin-bottom: 0.5rem;">${icons.bell(24)}</div>
            <p style="color: var(--color-text-muted);">No tiene alertas de empleo configuradas actualmente.</p>
          </div>
        ` : alerts.map(a => `
          <div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <div>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--color-text-main);">${a.keyword}</h3>
                <span class="${a.active ? 'tag success' : 'tag'}">${a.active ? 'Activa' : 'Pausada'}</span>
              </div>
              <div class="card-meta">
                <span>${icons.mapPin(13, 'inline-left')}${a.location}</span>
                <span>${icons.clock(13, 'inline-left')}Frecuencia: ${a.frequency}</span>
                <span>${icons.search(13, 'inline-left')}${a.matchedCount} ofertas coincidentes</span>
                <span>${icons.calendar(13, 'inline-left')}Creada: ${a.createdAt}</span>
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-secondary btn-sm" onclick="window.toggleAlertStatus('${a._id}')">
                ${a.active ? icons.pause(13, 'inline-left') + 'Pausar' : icons.play(13, 'inline-left') + 'Activar'}
              </button>
              <button class="btn btn-danger btn-sm" onclick="window.deleteAlertItem('${a._id}')">
                ${icons.trash(13, 'inline-left')}Eliminar
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.openCreateAlertModal = () => {
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Configurar Criterio de Alerta</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); window.submitCreateAlert();">
            <div class="form-group">
              <label class="form-label">Palabra Clave o Cargo Buscado</label>
              <input type="text" id="alert-keyword" class="form-control" required minlength="3" maxlength="80" placeholder="Ej. Desarrollador Web, QA Tester, Diseñador" />
            </div>
            <div class="form-group">
              <label class="form-label">Ubicación Deseada</label>
              <input type="text" id="alert-location" class="form-control" maxlength="80" placeholder="Ej. San Salvador, Santa Ana o Remoto" />
            </div>
            <div class="form-group">
              <label class="form-label">Frecuencia de Notificación</label>
              <select id="alert-frequency" class="form-control">
                <option value="Diaria">Diaria</option>
                <option value="Semanal">Semanal</option>
              </select>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary">
                ${icons.check(14, 'inline-left')}Guardar Alerta
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitCreateAlert = async () => {
  const keyword = document.getElementById('alert-keyword').value.trim();
  const location = document.getElementById('alert-location').value.trim();
  const frequency = document.getElementById('alert-frequency').value;

  try {
    await api.createAlert({ keyword, location, frequency });
    window.closeModal();
    state.showToast('Alerta de empleo guardada.', 'success');
    renderU03();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.toggleAlertStatus = async (alertId) => {
  try {
    const res = await api.toggleAlert(alertId);
    state.showToast(res.message, 'success');
    renderU03();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.deleteAlertItem = async (alertId) => {
  if (!confirm('¿Confirma la eliminación de esta alerta?')) return;
  try {
    await api.deleteAlert(alertId);
    state.showToast('Alerta eliminada.', 'info');
    renderU03();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

/* ==========================================================================
   PANTALLA U-04: VALORACIONES DE EMPRESAS
   ========================================================================== */
async function renderU04() {
  const reviewsRes = await api.getReviews();
  const reviews = reviewsRes.reviews || [];

  appContent.innerHTML = `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem;">
        <div>
          <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main);">Opiniones y Valoraciones Corporativas</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem;">Evaluaciones emitidas por estudiantes y profesionales sobre el clima laboral y crecimiento institucional.</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.openCreateReviewModal()">
          ${icons.plus(15, 'inline-left')}Emitir Valoración
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${reviews.map(r => `
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <div>
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text-main);">${escapeHtml(r.title || '')}</h3>
                <div class="card-meta">
                  <span style="font-weight: 600; color: var(--color-text-secondary);">${escapeHtml(r.companyName || '')}</span>
                  <span>${icons.user(13, 'inline-left')}${escapeHtml(r.candidateName || '')} (${escapeHtml(r.candidateRole || '')})</span>
                  <span>${icons.calendar(13, 'inline-left')}${escapeHtml(r.date || '')}</span>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                  ${icons.starRating(r.rating, 15)}
                  <span style="font-weight: 700; font-size: 0.9rem; color: var(--color-warning-text); margin-left: 0.25rem;">${r.rating}.0</span>
                </div>
              </div>
            </div>

            <p style="color: var(--color-text-body); line-height: 1.6; margin-bottom: 1rem;">"${escapeHtml(r.comment || '')}"</p>

            ${r.scores ? `
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; background-color: var(--color-bg-subtle); border: 1px solid var(--color-border-subtle); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.8rem;">
                <div><span style="color: var(--color-text-muted);">Cultura:</span> <strong>${r.scores.culture} / 5</strong></div>
                <div><span style="color: var(--color-text-muted);">Salario:</span> <strong>${r.scores.salary} / 5</strong></div>
                <div><span style="color: var(--color-text-muted);">Crecimiento:</span> <strong>${r.scores.growth} / 5</strong></div>
                <div><span style="color: var(--color-text-muted);">Balance:</span> <strong>${r.scores.workLife} / 5</strong></div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.openCreateReviewModal = async () => {
  const user = state.currentUser;
  if (!user || user.role !== 'candidato') {
    state.showToast('Debe iniciar sesión como Candidato para emitir una valoración.', 'error');
    window.openLoginModal();
    return;
  }

  let companies = [];
  try {
    const compRes = await api.getCompanies({ dedupe: 'true' });
    const rawCompanies = Array.isArray(compRes.companies) ? compRes.companies : [];
    const seenIds = new Set();
    const seenNames = new Set();
    for (const company of rawCompanies) {
      if (!company || !company._id) continue;
      const idKey = String(company._id).trim();
      const nameKey = typeof company.name === 'string' ? company.name.trim().toLowerCase() : '';
      if (!idKey || !nameKey) continue;
      if (seenIds.has(idKey) || seenNames.has(nameKey)) continue;
      seenIds.add(idKey);
      seenNames.add(nameKey);
      companies.push(company);
    }
    companies.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
  } catch (err) {
    state.showToast(err.message || 'No se pudieron cargar las empresas registradas.', 'error');
    return;
  }

  if (companies.length === 0) {
    state.showToast('No existen empresas activas disponibles para valorar.', 'error');
    return;
  }

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Emitir Valoración Institucional</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); window.submitCreateReview();">
            <div class="form-group">
              <label class="form-label" for="rev-companyId">Empresa</label>
              <select id="rev-companyId" class="form-control" required>
                ${companies.map(c => `<option value="${escapeHtml(c._id)}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="rev-rating">Calificación General (1 a 5 estrellas)</label>
              <select id="rev-rating" class="form-control">
                <option value="5">5 estrellas - Excelente</option>
                <option value="4">4 estrellas - Muy Buena</option>
                <option value="3">3 estrellas - Regular / Promedio</option>
                <option value="2">2 estrellas - Deficiente</option>
                <option value="1">1 estrella - No Recomendada</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="rev-title">Título del Resumen</label>
              <input type="text" id="rev-title" class="form-control" required minlength="5" maxlength="100" placeholder="Ej. Excelente cultura de trabajo y mentoría técnica" />
            </div>
            <div class="form-group">
              <label class="form-label" for="rev-comment">Comentario Descriptivo (Mínimo 15 caracteres)</label>
              <textarea id="rev-comment" class="form-control" required minlength="15" maxlength="1500" placeholder="Comparta su experiencia sobre el aprendizaje y desarrollo en esta organización..."></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary">
                ${icons.check(14, 'inline-left')}Publicar Valoración
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitCreateReview = async () => {
  const companyId = (document.getElementById('rev-companyId').value || '').trim();
  const rating = Number(document.getElementById('rev-rating').value);
  const title = document.getElementById('rev-title').value.trim();
  const comment = document.getElementById('rev-comment').value.trim();

  if (!companyId) {
    state.showToast('Selecciona una empresa válida.', 'error');
    return;
  }

  try {
    await api.createReview({ companyId, rating, title, comment });
    window.closeModal();
    state.showToast('Valoración registrada exitosamente.', 'success');
    renderU04();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

/* ==========================================================================
   PANTALLA E-01: PERFIL CORPORATIVO DE EMPRESA
   ========================================================================== */
async function renderE01() {
  const user = state.currentUser;
  let companyId = state.screenParams?.companyId || (user && user.companyId) || '';

  if (!companyId) {
    const compList = await api.getCompanies().catch(() => ({ companies: [] }));
    if (compList.companies && compList.companies.length > 0) {
      companyId = compList.companies[0]._id;
    }
  }

  if (!companyId) {
    if (user && user.role === 'empleador') {
      appContent.innerHTML = `
        <div class="container" style="max-width: 680px;">
          <div class="card employer-card-top" style="text-align: center; padding: 2.5rem;">
            <div style="color: var(--color-role-employer-text); margin-bottom: 0.75rem;">${icons.building(36)}</div>
            <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Complete el Perfil de su Empresa</h2>
            <p style="color: var(--color-text-muted); margin-bottom: 1.25rem;">Aún no tiene una organización vinculada a su cuenta de empleador. Regístrela para comenzar a publicar ofertas.</p>
            <button class="btn btn-empleador" onclick="window.openCreateCompanyModal()">
              ${icons.plus(15, 'inline-left')}Registrar Empresa Ahora
            </button>
          </div>
        </div>
      `;
    } else {
      appContent.innerHTML = `<div class="container"><div class="card"><p>No se encontraron empresas registradas para mostrar.</p></div></div>`;
    }
    return;
  }

  const canEdit = Boolean(
    user && (user.role === 'admin' || (user.role === 'empleador' && user.companyId === companyId))
  );

  const [compRes, jobsRes, appsRes] = await Promise.all([
    api.getCompany(companyId),
    api.getJobs(canEdit ? { all: true, companyId } : { companyId }),
    canEdit && user.role === 'empleador'
      ? api.getApplications().catch(() => ({ applications: [] }))
      : Promise.resolve({ applications: [] })
  ]);

  const company = compRes.company;
  const rep = compRes.representative;
  currentCompanyData = company;
  const companyJobs = jobsRes.jobs || [];
  const companyApps = appsRes.applications || [];

  const activeJobsCount = companyJobs.filter(j => j.status === 'Activa').length;
  const inProcessApps = companyApps.filter(a => ['En proceso', 'Finalista'].includes(a.status)).length;
  const ratingText = company.averageRating
    ? `${Number(company.averageRating).toFixed(1)} / 5.0 (${company.reviewCount || 0} valoraciones)`
    : `Sin valoraciones aún (${company.reviewCount || 0})`;

  appContent.innerHTML = `
    <div class="container">
      ${canEdit && user.role === 'empleador' ? `
        <!-- Real Employer Dashboard KPI Strip -->
        <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
          <div class="stat-box" style="cursor: pointer;" onclick="window.navigateTo('E-02')">
            <div class="stat-value" style="color: var(--color-role-employer-text);">${activeJobsCount}</div>
            <div class="stat-label">Ofertas Activas</div>
          </div>
          <div class="stat-box" style="cursor: pointer;" onclick="window.navigateTo('E-02')">
            <div class="stat-value" style="color: var(--color-role-employer-text);">${companyJobs.length}</div>
            <div class="stat-label">Total Vacantes</div>
          </div>
          <div class="stat-box" style="cursor: pointer;" onclick="window.navigateTo('E-03')">
            <div class="stat-value" style="color: var(--color-role-employer-text);">${companyApps.length}</div>
            <div class="stat-label">Postulaciones Recibidas</div>
          </div>
          <div class="stat-box" style="cursor: pointer;" onclick="window.navigateTo('E-03')">
            <div class="stat-value" style="color: var(--color-role-employer-text);">${inProcessApps}</div>
            <div class="stat-label">Candidatos en Proceso</div>
          </div>
        </div>
      ` : ''}

      <div class="card employer-card-top" style="padding: 0; overflow: hidden; margin-bottom: 2rem;">
        <div class="profile-cover company-cover" style="${company.banner ? `background-image: url('${escapeHtml(company.banner)}'); background-size: cover; background-position: center;` : ''}">
          ${canEdit ? `
            <div style="position: absolute; right: 1rem; bottom: 1rem; display: flex; gap: 0.5rem; z-index: 5;">
              <label class="btn btn-secondary btn-sm" style="background: var(--color-bg-surface); color: var(--color-text-main); opacity: 0.94; cursor: pointer; box-shadow: var(--shadow-sm);">
                ${icons.upload(13, 'inline-left')}Cambiar Portada
                <input type="file" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="window.handleUploadCompanyAsset(event, 'companyBanner', '${escapeHtml(company._id)}')" />
              </label>
              ${company.bannerFileId ? `
                <button class="btn btn-secondary btn-sm" style="background: var(--color-bg-surface); color: var(--color-danger); opacity: 0.94;" onclick="window.handleDeleteCompanyAsset('${escapeHtml(company.bannerFileId)}', 'Portada corporativa')" title="Eliminar portada">
                  ${icons.trash(13)}
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <div style="padding: 1.5rem 2rem 2rem;">
          <div style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
            <div style="position: relative; display: inline-block;">
              ${renderCompanyLogo(company.logo, company.name, 84, 12)}
              ${canEdit ? `
                <label class="btn btn-secondary btn-sm" style="position: absolute; bottom: -6px; right: -6px; border-radius: 50%; width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: var(--color-bg-surface); cursor: pointer; box-shadow: var(--shadow-md);" title="Cambiar logotipo corporativo">
                  ${icons.camera(14)}
                  <input type="file" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="window.handleUploadCompanyAsset(event, 'companyLogo', '${escapeHtml(company._id)}')" />
                </label>
              ` : ''}
            </div>

            <div style="flex: 1; min-width: 240px;">
              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main); margin: 0;">${escapeHtml(company.name)}</h1>
                ${company.verified ? `<span class="tag success">${icons.checkCircle(13, 'inline-left')}Empresa Verificada</span>` : ''}
                <span class="tag ${company.status === 'Activa' ? 'primary' : 'danger'}">${escapeHtml(company.status || 'Activa')}</span>
                <span class="role-badge empleador">Perfil Corporativo</span>
              </div>
              ${company.legalName && company.legalName !== company.name ? `
                <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.2rem;">Razón social: ${escapeHtml(company.legalName)}</div>
              ` : ''}
              <div class="card-meta" style="margin-top: 0.5rem;">
                <span>${icons.mapPin(13, 'inline-left')}${escapeHtml(company.location || 'Sin ubicación')}</span>
                <span>${icons.building(13, 'inline-left')}${escapeHtml(company.size || 'Sin tamaño')} • ${escapeHtml(company.industry || 'General')}</span>
                ${company.website ? `
                  <a href="${escapeHtml(company.website.startsWith('http') ? company.website : 'https://' + company.website)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary-text); text-decoration: none;">
                    ${icons.globe(13, 'inline-left')}${escapeHtml(company.website)}
                  </a>
                ` : ''}
                <span style="color: var(--color-warning-text); font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                  ${icons.star(13, Boolean(company.averageRating))} ${escapeHtml(ratingText)}
                </span>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              ${canEdit && company.logoFileId ? `
                <button class="btn btn-secondary btn-sm" style="color: var(--color-danger);" onclick="window.handleDeleteCompanyAsset('${escapeHtml(company.logoFileId)}', 'Logotipo corporativo')">
                  ${icons.trash(13, 'inline-left')}Quitar Logo
                </button>
              ` : ''}
              ${canEdit ? `
                <button class="btn btn-secondary btn-sm" onclick="window.openEditCompanyModal()">
                  ${icons.edit(14, 'inline-left')}Editar Perfil Corporativo
                </button>
              ` : ''}
              ${user && user.role === 'empleador' && user.companyId === company._id ? `
                <button class="btn btn-empleador btn-sm" onclick="window.navigateTo('E-02')">
                  ${icons.briefcase(14, 'inline-left')}Gestionar Ofertas
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
        <div>
          <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.75rem;">Reseña Institucional</h3>
            <p style="color: var(--color-text-body); line-height: 1.6; white-space: pre-line;">
              ${escapeHtml(company.description || 'Sin descripción corporativa registrada aún.')}
            </p>
          </div>

          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--color-text-main); margin-bottom: 1rem;">
            ${canEdit ? 'Vacantes de la Organización' : 'Vacantes Activas de la Organización'} (${companyJobs.length})
          </h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${companyJobs.length === 0 ? `
              <div class="card" style="text-align: center; padding: 2rem;">
                <p style="color: var(--color-text-muted);">Esta empresa no tiene vacantes registradas actualmente.</p>
              </div>
            ` : companyJobs.map(j => `
              <div class="card" style="cursor: pointer;" onclick="window.navigateTo('P-03', { jobId: '${escapeHtml(j._id)}' })">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                  <div>
                    <h4 class="card-title">${escapeHtml(j.title)}</h4>
                    <div class="card-meta">
                      <span>${icons.mapPin(13, 'inline-left')}${escapeHtml(j.location)}</span>
                      <span>${icons.dollarSign(13, 'inline-left')}$${j.salaryMin} - $${j.salaryMax} USD</span>
                      <span>${icons.calendar(13, 'inline-left')}Vence: ${escapeHtml(j.expiresAt || 'N/A')}</span>
                    </div>
                  </div>
                  <div style="display: flex; gap: 0.4rem;">
                    <span class="tag primary">${escapeHtml(j.modality)}</span>
                    ${canEdit ? `<span class="tag ${j.status === 'Activa' ? 'success' : 'warning'}">${escapeHtml(j.status)}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <div class="card" style="margin-bottom: 1.5rem;">
            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">Representante de Talento</h4>
            ${rep ? `
              <div style="font-size: 0.88rem; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 0.5rem;">
                <div><strong style="color: var(--color-text-main);">Contacto:</strong> ${escapeHtml(`${rep.firstName} ${rep.lastName}`)}</div>
                <div><strong style="color: var(--color-text-main);">Cargo:</strong> ${escapeHtml(rep.title || 'Reclutamiento y Selección')}</div>
                <div><strong style="color: var(--color-text-main);">Correo:</strong> ${escapeHtml(rep.email)}</div>
                <div><strong style="color: var(--color-text-main);">Teléfono:</strong> ${escapeHtml(rep.phone || 'No especificado')}</div>
              </div>
            ` : `
              <p style="font-size: 0.86rem; color: var(--color-text-muted);">No hay información de representante registrada para esta empresa.</p>
            `}
          </div>
          ${renderAccountThemeSettingsCard(user, 'btn-empleador')}
        </div>
      </div>
    </div>
  `;
}

window.openCreateCompanyModal = () => {
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>Registrar Perfil de Empresa</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); window.submitCreateCompany();">
            <div class="form-group">
              <label class="form-label">Nombre Comercial</label>
              <input type="text" id="new-comp-name" class="form-control" required minlength="2" maxlength="100" />
            </div>
            <div class="form-group">
              <label class="form-label">Razón Social</label>
              <input type="text" id="new-comp-legalName" class="form-control" maxlength="120" />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Industria / Sector</label>
                <input type="text" id="new-comp-industry" class="form-control" required minlength="2" maxlength="80" />
              </div>
              <div class="form-group">
                <label class="form-label">Tamaño de Empresa</label>
                <select id="new-comp-size" class="form-control">
                  <option value="1-10 empleados">1-10 empleados</option>
                  <option value="10-50 empleados">10-50 empleados</option>
                  <option value="50-150 empleados">50-150 empleados</option>
                  <option value="150-500 empleados">150-500 empleados</option>
                  <option value="+500 empleados">+500 empleados</option>
                </select>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Ubicación</label>
                <input type="text" id="new-comp-location" class="form-control" required minlength="2" maxlength="100" />
              </div>
              <div class="form-group">
                <label class="form-label">Sitio Web (Opcional)</label>
                <input type="url" id="new-comp-website" class="form-control" placeholder="https://empresa.com" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Reseña Institucional</label>
              <textarea id="new-comp-description" class="form-control" minlength="10" maxlength="1500" placeholder="Describe brevemente la actividad y cultura de la empresa..."></textarea>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-empleador btn-sm">${icons.check(14, 'inline-left')}Registrar Empresa</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitCreateCompany = async () => {
  const payload = {
    name: document.getElementById('new-comp-name').value.trim(),
    legalName: document.getElementById('new-comp-legalName').value.trim(),
    industry: document.getElementById('new-comp-industry').value.trim(),
    size: document.getElementById('new-comp-size').value,
    location: document.getElementById('new-comp-location').value.trim(),
    website: document.getElementById('new-comp-website').value.trim(),
    description: document.getElementById('new-comp-description').value.trim()
  };

  try {
    const res = await api.createCompany(payload);
    const meRes = await api.getMe().catch(() => null);
    if (meRes?.user) state.setUser(meRes.user);
    window.closeModal();
    state.showToast('Empresa registrada en MongoDB.', 'success');
    window.navigateTo('E-01', { companyId: res.company._id });
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.openEditCompanyModal = () => {
  const c = currentCompanyData;
  if (!c) return;
  const sizes = ['1-10 empleados', '10-50 empleados', '50-150 empleados', '150-500 empleados', '+500 empleados'];

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 580px;">
        <div class="modal-header">
          <h3>Editar Perfil Corporativo</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); window.submitEditCompany('${escapeHtml(c._id)}');">
            <div class="form-group">
              <label class="form-label">Nombre Comercial</label>
              <input type="text" id="comp-edit-name" class="form-control" required minlength="2" maxlength="100" value="${escapeHtml(c.name || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Razón Social</label>
              <input type="text" id="comp-edit-legalName" class="form-control" required minlength="2" maxlength="120" value="${escapeHtml(c.legalName || c.name || '')}" />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Industria / Sector</label>
                <input type="text" id="comp-edit-industry" class="form-control" required minlength="2" maxlength="80" value="${escapeHtml(c.industry || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Tamaño de la Organización</label>
                <select id="comp-edit-size" class="form-control">
                  ${sizes.map(s => `<option value="${s}" ${c.size === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Ubicación</label>
                <input type="text" id="comp-edit-location" class="form-control" required minlength="2" maxlength="100" value="${escapeHtml(c.location || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Sitio Web</label>
                <input type="text" id="comp-edit-website" class="form-control" value="${escapeHtml(c.website || '')}" placeholder="https://empresa.com" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Reseña Institucional (mínimo 10 caracteres)</label>
              <textarea id="comp-edit-description" class="form-control" style="min-height: 110px;" required minlength="10" maxlength="1500">${escapeHtml(c.description || '')}</textarea>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-empleador btn-sm">${icons.check(14, 'inline-left')}Guardar Cambios</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitEditCompany = async (companyId) => {
  const payload = {
    name: document.getElementById('comp-edit-name').value.trim(),
    legalName: document.getElementById('comp-edit-legalName').value.trim(),
    industry: document.getElementById('comp-edit-industry').value.trim(),
    size: document.getElementById('comp-edit-size').value,
    location: document.getElementById('comp-edit-location').value.trim(),
    website: document.getElementById('comp-edit-website').value.trim(),
    description: document.getElementById('comp-edit-description').value.trim()
  };

  try {
    await api.updateCompany(companyId, payload);
    window.closeModal();
    state.showToast('Perfil corporativo actualizado correctamente en MongoDB.', 'success');
    renderE01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleUploadCompanyAsset = async (event, fileType, companyId) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    state.showToast('Solo se permiten imágenes en formato JPG, PNG o WEBP.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    state.showToast('La imagen no debe superar 5 MB.', 'error');
    return;
  }

  try {
    state.showToast('Subiendo imagen corporativa a MongoDB GridFS...', 'info');
    const { base64, mimeType, name } = await readFileAsBase64(file);
    await api.uploadFile({
      fileName: name,
      mimeType,
      base64Data: base64,
      fileType,
      companyId
    });
    state.showToast('Imagen corporativa guardada exitosamente en GridFS.', 'success');
    renderE01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleDeleteCompanyAsset = async (fileId, label) => {
  if (!fileId) return;
  if (!confirm(`¿Confirma que desea eliminar ${label}?`)) return;
  try {
    await api.deleteFile(fileId);
    state.showToast(`${label} eliminado de MongoDB GridFS.`, 'info');
    renderE01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

/* ==========================================================================
   PANTALLA E-02: PUBLICACIÓN Y GESTIÓN DE OFERTAS
   ========================================================================== */
let e02JobsCache = [];

async function renderE02() {
  const user = state.currentUser;
  if (!user || !['empleador', 'admin'].includes(user.role)) {
    appContent.innerHTML = `<div class="container"><div class="card"><p>Acceso restringido para cuentas corporativas y administradores.</p></div></div>`;
    return;
  }

  const statusFilter = state.screenParams?.status || '';
  const jobsRes = await api.getJobs({ all: true });
  const allCompanyJobs = user.role === 'admin'
    ? (jobsRes.jobs || [])
    : (user.companyId ? (jobsRes.jobs || []).filter(j => j.companyId === user.companyId) : []);

  e02JobsCache = allCompanyJobs;
  const visibleJobs = statusFilter ? allCompanyJobs.filter(j => j.status === statusFilter) : allCompanyJobs;

  const activeCount = allCompanyJobs.filter(j => j.status === 'Activa').length;
  const pausedCount = allCompanyJobs.filter(j => j.status === 'Pausada').length;
  const closedCount = allCompanyJobs.filter(j => ['Cerrada', 'Inactiva'].includes(j.status)).length;

  appContent.innerHTML = `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main);">Gestión de Ofertas Laborales</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem;">Publicación, edición, pausa, reactivación y cierre de convocatorias laborales en MongoDB.</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="e02-status-filter" class="form-control" style="width: auto; font-size: 0.85rem;" onchange="window.navigateTo('E-02', { status: this.value })">
            <option value="">Todas (${allCompanyJobs.length})</option>
            <option value="Activa" ${statusFilter === 'Activa' ? 'selected' : ''}>Activas (${activeCount})</option>
            <option value="Pausada" ${statusFilter === 'Pausada' ? 'selected' : ''}>Pausadas (${pausedCount})</option>
            <option value="Cerrada" ${statusFilter === 'Cerrada' ? 'selected' : ''}>Cerradas</option>
            <option value="Inactiva" ${statusFilter === 'Inactiva' ? 'selected' : ''}>Inactivas</option>
          </select>
          <button class="btn btn-empleador" onclick="window.openCreateJobModal()">
            ${icons.plus(15, 'inline-left')}Publicar Nueva Oferta
          </button>
        </div>
      </div>

      <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-employer-text);">${allCompanyJobs.length}</div>
          <div class="stat-label">Total Ofertas</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-success-text);">${activeCount}</div>
          <div class="stat-label">Activas</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-warning-text);">${pausedCount}</div>
          <div class="stat-label">Pausadas</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-text-muted);">${closedCount}</div>
          <div class="stat-label">Cerradas / Inactivas</div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Título del Cargo</th>
              <th>Modalidad / Experiencia</th>
              <th>Rango Salarial</th>
              <th>Estado</th>
              <th>Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${visibleJobs.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--color-text-muted);">
                  No hay ofertas registradas con los criterios actuales.
                </td>
              </tr>
            ` : visibleJobs.map(job => `
              <tr>
                <td>
                  <div style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(job.title)}</div>
                  <div style="font-size: 0.78rem; color: var(--color-text-muted);">${escapeHtml(job.sector || '')} • ${escapeHtml(job.contractType || '')}</div>
                </td>
                <td>
                  <span class="tag primary">${escapeHtml(job.modality)}</span>
                  <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 0.25rem;">${escapeHtml(job.experienceLevel || '')}</div>
                </td>
                <td>$${job.salaryMin} - $${job.salaryMax} USD</td>
                <td>
                  <span class="${job.status === 'Activa' ? 'tag success' : (job.status === 'Pausada' ? 'tag warning' : 'tag danger')}">${escapeHtml(job.status)}</span>
                </td>
                <td>${escapeHtml(job.expiresAt || 'Sin fecha')}</td>
                <td>
                  <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('P-03', { jobId: '${escapeHtml(job._id)}' })" title="Ver publicación">
                      ${icons.eye(13, 'inline-left')}Ver
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.openEditJobModal('${escapeHtml(job._id)}')" title="Editar oferta">
                      ${icons.edit(13, 'inline-left')}Editar
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('E-03', { jobId: '${escapeHtml(job._id)}' })" title="Ver postulantes">
                      ${icons.user(13, 'inline-left')}Aplicantes
                    </button>
                    ${job.status === 'Activa' ? `
                      <button class="btn btn-secondary btn-sm" onclick="window.changeJobStatus('${escapeHtml(job._id)}', 'Pausada')" title="Pausar oferta">
                        ${icons.pause(13, 'inline-left')}Pausar
                      </button>
                      <button class="btn btn-secondary btn-sm" style="color: var(--color-warning-text);" onclick="window.changeJobStatus('${escapeHtml(job._id)}', 'Cerrada')" title="Cerrar oferta">
                        ${icons.lock(13, 'inline-left')}Cerrar
                      </button>
                    ` : `
                      <button class="btn btn-secondary btn-sm" style="color: var(--color-success-text);" onclick="window.changeJobStatus('${escapeHtml(job._id)}', 'Activa')" title="Reactivar oferta">
                        ${icons.play(13, 'inline-left')}Reactivar
                      </button>
                    `}
                    <button class="btn btn-danger btn-sm" onclick="window.hardDeleteJobOffer('${escapeHtml(job._id)}')" title="Eliminar definitivamente si no tiene postulaciones">
                      ${icons.trash(13)}
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderJobFormFields(job = null) {
  const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const user = state.currentUser || {};
  const isEdit = Boolean(job);

  const modalities = ['Híbrido', 'Remoto', 'Presencial'];
  const contracts = ['Tiempo Completo', 'Medio Tiempo', 'Pasantía / Prácticas', 'Por Proyecto / Freelance', 'Temporal'];
  const experiences = ['Sin experiencia', '1-2 años', '3-5 años', '+5 años'];
  const statuses = ['Activa', 'Pausada', 'Cerrada', 'Inactiva'];

  return `
    <div class="form-group">
      <label class="form-label">Título del Puesto *</label>
      <input type="text" id="job-title" class="form-control" required minlength="5" maxlength="150" value="${escapeHtml(job?.title || '')}" placeholder="Ej. Desarrollador Web Fullstack" />
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <div class="form-group">
        <label class="form-label">Modalidad *</label>
        <select id="job-modality" class="form-control">
          ${modalities.map(m => `<option value="${m}" ${(job?.modality || 'Híbrido') === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de Contrato *</label>
        <select id="job-contractType" class="form-control">
          ${contracts.map(c => `<option value="${c}" ${(job?.contractType || 'Tiempo Completo') === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <div class="form-group">
        <label class="form-label">Nivel de Experiencia *</label>
        <select id="job-experienceLevel" class="form-control">
          ${experiences.map(ex => `<option value="${ex}" ${(job?.experienceLevel || '1-2 años') === ex ? 'selected' : ''}>${ex}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Sector / Área</label>
        <input type="text" id="job-sector" class="form-control" maxlength="80" value="${escapeHtml(job?.sector || 'Tecnología / Software')}" placeholder="Ej. Tecnología, Finanzas, Marketing" />
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
      <div class="form-group">
        <label class="form-label">Salario Mín. ($ USD) *</label>
        <input type="number" id="job-salaryMin" class="form-control" value="${job ? job.salaryMin : 1000}" min="0" max="50000" step="1" onkeypress="return (event.charCode >= 48 && event.charCode <= 57)" required />
      </div>
      <div class="form-group">
        <label class="form-label">Salario Máx. ($ USD) *</label>
        <input type="number" id="job-salaryMax" class="form-control" value="${job ? job.salaryMax : 1500}" min="0" max="50000" step="1" onkeypress="return (event.charCode >= 48 && event.charCode <= 57)" required />
      </div>
      <div class="form-group">
        <label class="form-label">Fecha de Vencimiento *</label>
        <input type="date" id="job-expiresAt" class="form-control" value="${escapeHtml(job?.expiresAt || defaultExpiry)}" required />
      </div>
    </div>
    <div style="display: grid; grid-template-columns: ${isEdit ? '1fr 1fr' : '1fr'}; gap: 0.75rem;">
      <div class="form-group">
        <label class="form-label">Ubicación *</label>
        <input type="text" id="job-location" class="form-control" value="${escapeHtml(job?.location || 'San Salvador, El Salvador')}" required minlength="2" maxlength="100" />
      </div>
      ${isEdit ? `
        <div class="form-group">
          <label class="form-label">Estado de la Oferta</label>
          <select id="job-status" class="form-control">
            ${statuses.map(st => `<option value="${st}" ${job.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </div>
      ` : ''}
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
      <div class="form-group">
        <label class="form-label">Correo de Contacto</label>
        <input type="email" id="job-contactEmail" class="form-control" value="${escapeHtml(job?.contactEmail || user.email || '')}" maxlength="100" />
      </div>
      <div>
        ${phoneHelper.renderPhoneInputHtml('job-contactPhone', job?.contactPhone || user.phone || '', 'Teléfono de Contacto', false)}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción del Puesto (Mínimo 20 caracteres) *</label>
      <textarea id="job-description" class="form-control" required minlength="20" maxlength="5000" placeholder="Detalle los objetivos del cargo, herramientas empleadas y expectativas...">${escapeHtml(job?.description || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Responsabilidades Principales (una por línea)</label>
      <textarea id="job-responsibilities" class="form-control" style="min-height: 75px;" placeholder="Ej. Diseñar APIs REST escalables&#10;Revisar código en equipo">${escapeHtml((job?.responsibilities || []).join('\n'))}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Requisitos Solicitados (uno por línea)</label>
      <textarea id="job-requirements" class="form-control" style="min-height: 75px;" placeholder="Ej. 2+ años con JavaScript y Node.js&#10;Conocimientos de MongoDB">${escapeHtml((job?.requirements || []).join('\n'))}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Prestaciones y Beneficios (uno por línea)</label>
      <textarea id="job-benefits" class="form-control" style="min-height: 75px;" placeholder="Ej. Seguro médico privado&#10;Modalidad flexible">${escapeHtml((job?.benefits || []).join('\n'))}</textarea>
    </div>
  `;
}

function collectJobFormPayload(isEdit = false) {
  const title = document.getElementById('job-title').value.trim();
  const modality = document.getElementById('job-modality').value;
  const contractType = document.getElementById('job-contractType').value;
  const experienceLevel = document.getElementById('job-experienceLevel').value;
  const sector = document.getElementById('job-sector').value.trim();
  const salaryMinVal = document.getElementById('job-salaryMin').value.trim();
  const salaryMaxVal = document.getElementById('job-salaryMax').value.trim();
  const expiresAt = document.getElementById('job-expiresAt').value.trim();
  const location = document.getElementById('job-location').value.trim();
  const contactEmail = document.getElementById('job-contactEmail').value.trim();
  const contactPhone = phoneHelper.getValue('job-contactPhone');
  const description = document.getElementById('job-description').value.trim();
  const responsibilities = document.getElementById('job-responsibilities').value;
  const requirements = document.getElementById('job-requirements').value;
  const benefits = document.getElementById('job-benefits').value;

  if (!salaryMinVal || !salaryMaxVal || !/^\d+(\.\d+)?$/.test(salaryMinVal) || !/^\d+(\.\d+)?$/.test(salaryMaxVal)) {
    state.showToast('Los salarios son obligatorios y deben ser cantidades numéricas positivas sin letras ni símbolos.', 'error');
    return null;
  }

  const salaryMin = Number(salaryMinVal);
  const salaryMax = Number(salaryMaxVal);
  if (salaryMax < salaryMin) {
    state.showToast('El salario máximo no puede ser menor al salario mínimo.', 'error');
    return null;
  }

  const PHONE_REGEX = /^[\+]?[\d\s-]{7,25}$/;
  if (contactPhone && !PHONE_REGEX.test(contactPhone)) {
    state.showToast('El teléfono de contacto debe tener un formato válido con números y guiones.', 'error');
    return null;
  }

  const payload = {
    title,
    modality,
    contractType,
    experienceLevel,
    sector,
    salaryMin,
    salaryMax,
    expiresAt,
    location,
    contactEmail,
    contactPhone,
    description,
    responsibilities,
    requirements,
    benefits
  };

  if (isEdit) {
    const statusEl = document.getElementById('job-status');
    if (statusEl) payload.status = statusEl.value;
  }

  return payload;
}

window.openCreateJobModal = () => {
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 680px;">
        <div class="modal-header">
          <h3>Publicar Nueva Oferta Laboral</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body" style="max-height: 78vh; overflow-y: auto;">
          <form onsubmit="event.preventDefault(); window.submitCreateJob();">
            ${renderJobFormFields(null)}
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-empleador">
                ${icons.check(14, 'inline-left')}Publicar Oferta
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  setTimeout(() => phoneHelper.setupPhoneInput('job-contactPhone'), 30);
};

window.submitCreateJob = async () => {
  const payload = collectJobFormPayload(false);
  if (!payload) return;

  try {
    await api.createJob(payload);
    window.closeModal();
    state.showToast('Oferta laboral publicada exitosamente.', 'success');
    renderE02();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.openEditJobModal = async (jobId) => {
  let job = e02JobsCache.find(j => j._id === jobId);
  if (!job) {
    const res = await api.getJob(jobId).catch(() => null);
    job = res?.job;
  }
  if (!job) {
    state.showToast('No se encontró la oferta seleccionada.', 'error');
    return;
  }

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 680px;">
        <div class="modal-header">
          <h3>Editar Oferta Laboral</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body" style="max-height: 78vh; overflow-y: auto;">
          <form onsubmit="event.preventDefault(); window.submitEditJob('${escapeHtml(job._id)}');">
            ${renderJobFormFields(job)}
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-empleador">
                ${icons.check(14, 'inline-left')}Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  setTimeout(() => phoneHelper.setupPhoneInput('job-contactPhone'), 30);
};

window.submitEditJob = async (jobId) => {
  const payload = collectJobFormPayload(true);
  if (!payload) return;

  try {
    await api.updateJob(jobId, payload);
    window.closeModal();
    state.showToast('Oferta laboral actualizada en MongoDB.', 'success');
    renderE02();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.changeJobStatus = async (jobId, newStatus) => {
  const verb = newStatus === 'Activa' ? 'reactivar' : (newStatus === 'Pausada' ? 'pausar' : 'cerrar');
  if (!confirm(`¿Confirma que desea ${verb} esta oferta laboral?`)) return;

  try {
    await api.updateJob(jobId, { status: newStatus });
    state.showToast(`Estado de la oferta actualizado a "${newStatus}".`, 'success');
    renderE02();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.hardDeleteJobOffer = async (jobId) => {
  if (!confirm('¿Desea eliminar definitivamente esta oferta laboral de MongoDB? Si ya tiene postulaciones registradas, se bloqueará la eliminación física para proteger el historial.')) return;
  try {
    const res = await api.deleteJob(jobId, true);
    state.showToast(res.message || 'Oferta eliminada.', 'info');
    renderE02();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

/* ==========================================================================
   PANTALLA E-03: GESTIÓN DE CANDIDATOS Y FASES
   ========================================================================== */
let e03AppsCache = [];
let pendingStageSelectEl = null;
let pendingStagePrevValue = '';

async function renderE03() {
  const user = state.currentUser;
  if (!user || !['empleador', 'admin'].includes(user.role)) {
    appContent.innerHTML = `<div class="container"><div class="card"><p>Acceso restringido para cuentas corporativas.</p></div></div>`;
    return;
  }

  const jobIdFilter = state.screenParams?.jobId || '';
  const statusFilter = state.screenParams?.status || '';

  const [appsRes, jobsRes] = await Promise.all([
    api.getApplications({ jobId: jobIdFilter, status: statusFilter }),
    api.getJobs({ all: true })
  ]);

  const applications = appsRes.applications || [];
  e03AppsCache = applications;
  const companyJobs = user.role === 'admin'
    ? (jobsRes.jobs || [])
    : (user.companyId ? (jobsRes.jobs || []).filter(j => j.companyId === user.companyId) : []);

  const submittedCount = applications.filter(a => a.status === 'Enviada').length;
  const inProcessCount = applications.filter(a => a.status === 'En proceso').length;
  const finalistHiredCount = applications.filter(a => ['Finalista', 'Contratado'].includes(a.status)).length;

  appContent.innerHTML = `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main);">Gestión de Candidatos y Fases de Selección</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem;">Seguimiento por etapas de postulantes a vacantes de la empresa.</p>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <select id="e03-job-filter" class="form-control" style="width: auto; max-width: 240px; font-size: 0.85rem;" onchange="window.applyE03Filters()">
            <option value="">Todas las ofertas</option>
            ${companyJobs.map(j => `<option value="${escapeHtml(j._id)}" ${jobIdFilter === j._id ? 'selected' : ''}>${escapeHtml(j.title)}</option>`).join('')}
          </select>
          <select id="e03-status-filter" class="form-control" style="width: auto; font-size: 0.85rem;" onchange="window.applyE03Filters()">
            <option value="">Todos los estados</option>
            <option value="Enviada" ${statusFilter === 'Enviada' ? 'selected' : ''}>Enviada</option>
            <option value="En proceso" ${statusFilter === 'En proceso' ? 'selected' : ''}>En proceso</option>
            <option value="Finalista" ${statusFilter === 'Finalista' ? 'selected' : ''}>Finalista</option>
            <option value="Contratado" ${statusFilter === 'Contratado' ? 'selected' : ''}>Contratado</option>
            <option value="Descartado" ${statusFilter === 'Descartado' ? 'selected' : ''}>Descartado</option>
          </select>
        </div>
      </div>

      <div class="grid-cols-4" style="margin-bottom: 1.5rem;">
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-employer-text);">${applications.length}</div>
          <div class="stat-label">Postulaciones Listadas</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-employer-text);">${submittedCount}</div>
          <div class="stat-label">Recibidas (Enviadas)</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-employer-text);">${inProcessCount}</div>
          <div class="stat-label">En Proceso</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-success-text);">${finalistHiredCount}</div>
          <div class="stat-label">Finalistas / Contratados</div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Candidato</th>
              <th>Oferta Aplicada</th>
              <th>Documento CV</th>
              <th>Fecha</th>
              <th>Fase Actual</th>
              <th>Actualizar Estado</th>
            </tr>
          </thead>
          <tbody>
            ${applications.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--color-text-muted);">
                  No hay solicitudes registradas con los filtros seleccionados.
                </td>
              </tr>
            ` : applications.map(app => `
              <tr>
                <td>
                  <div style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(app.candidateName)}</div>
                  <div style="font-size: 0.78rem; color: var(--color-primary-text);">${escapeHtml(app.candidateTitle || '')}</div>
                  <div style="font-size: 0.78rem; color: var(--color-text-muted);">
                    ${app.emailHidden ? 'Correo oculto por privacidad' : escapeHtml(app.candidateEmail || 'Sin correo')}
                  </div>
                  ${app.phoneHidden ? `
                    <div style="font-size: 0.75rem; color: var(--color-text-subtle);">Teléfono oculto por privacidad</div>
                  ` : (app.candidatePhone ? `
                    <div style="font-size: 0.75rem; color: var(--color-text-muted);">${escapeHtml(app.candidatePhone)}</div>
                  ` : '')}
                  ${app.isProfilePublic === false ? `
                    <span class="tag warning" style="margin-top: 0.25rem; font-size: 0.7rem;">Perfil Privado</span>
                  ` : ''}
                  ${app.coverNote ? `
                    <div style="margin-top: 0.35rem;">
                      <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;" onclick="window.viewCandidateCoverNote('${escapeHtml(app._id)}')">
                        ${icons.fileText(11, 'inline-left')}Ver Nota
                      </button>
                    </div>
                  ` : ''}
                </td>
                <td style="font-size: 0.88rem;">${escapeHtml(app.jobTitle)}</td>
                <td>
                  <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <div style="font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); display: flex; align-items: center; gap: 0.25rem;">
                      ${icons.fileText(14)} <span style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(app.cvFileName || 'Curriculum.pdf')}">${escapeHtml(app.cvFileName || 'Curriculum.pdf')}</span>
                    </div>
                    ${app.cvFileId ? `
                      <div style="display: flex; gap: 0.35rem;">
                        <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;" onclick="window.handleViewProtectedFile('${escapeHtml(app.cvFileId)}', '${escapeHtml(app.cvFileName || 'Curriculum.pdf').replace(/'/g, "\\'")}')">
                          ${icons.externalLink(12, 'inline-left')}Ver CV
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.45rem; font-size: 0.75rem;" onclick="window.handleDownloadProtectedFile('${escapeHtml(app.cvFileId)}', '${escapeHtml(app.cvFileName || 'Curriculum.pdf').replace(/'/g, "\\'")}')">
                          ${icons.download(12, 'inline-left')}Descargar
                        </button>
                      </div>
                    ` : `
                      <span style="font-size: 0.72rem; color: var(--color-text-muted);">Sin archivo GridFS</span>
                    `}
                  </div>
                </td>
                <td>${escapeHtml(app.appliedAt)}</td>
                <td>
                  <span class="tag ${app.status === 'Contratado' || app.status === 'Finalista' ? 'success' : (app.status === 'Descartado' ? 'warning' : 'primary')}">
                    ${escapeHtml(app.status)}
                  </span>
                </td>
                <td>
                  <select class="form-control" style="font-size: 0.82rem; padding: 0.25rem 0.5rem; width: auto;" data-prev-status="${escapeHtml(app.status)}" onchange="window.openStageChangeModal('${escapeHtml(app._id)}', this)">
                    <option value="Enviada" ${app.status === 'Enviada' ? 'selected' : ''}>Enviada</option>
                    <option value="En proceso" ${app.status === 'En proceso' ? 'selected' : ''}>En proceso</option>
                    <option value="Finalista" ${app.status === 'Finalista' ? 'selected' : ''}>Finalista</option>
                    <option value="Contratado" ${app.status === 'Contratado' ? 'selected' : ''}>Contratado</option>
                    <option value="Descartado" ${app.status === 'Descartado' ? 'selected' : ''}>Descartado</option>
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.applyE03Filters = () => {
  const jobId = document.getElementById('e03-job-filter')?.value || '';
  const status = document.getElementById('e03-status-filter')?.value || '';
  window.navigateTo('E-03', { jobId, status });
};

window.viewCandidateCoverNote = (appId) => {
  const app = e03AppsCache.find(a => a._id === appId);
  if (!app) return;
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Carta / Nota de Presentación</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <div style="font-size: 0.88rem; color: var(--color-text-muted); margin-bottom: 0.75rem;">
            Candidato: <strong style="color: var(--color-text-main);">${escapeHtml(app.candidateName)}</strong> • Puesto: ${escapeHtml(app.jobTitle)}
          </div>
          <div style="padding: 1rem; background: var(--color-bg-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-sm); white-space: pre-line; line-height: 1.6; color: var(--color-text-body);">
            ${escapeHtml(app.coverNote || 'Sin carta de presentación.')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cerrar</button>
        </div>
      </div>
    </div>
  `;
};

window.openStageChangeModal = (appId, selectEl) => {
  const prevStatus = selectEl.getAttribute('data-prev-status') || 'Enviada';
  const newStatus = selectEl.value;
  if (newStatus === prevStatus) return;

  pendingStageSelectEl = selectEl;
  pendingStagePrevValue = prevStatus;

  const app = e03AppsCache.find(a => a._id === appId);

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3>Actualizar Fase de Selección</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.cancelStageChangeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 1rem;">
            Cambiar postulación de <strong style="color: var(--color-text-main);">${escapeHtml(app?.candidateName || 'Candidato')}</strong> de <strong>${escapeHtml(prevStatus)}</strong> a <span class="tag primary">${escapeHtml(newStatus)}</span>
          </p>
          <form onsubmit="event.preventDefault(); window.submitStageChangeModal('${escapeHtml(appId)}', '${escapeHtml(newStatus)}');">
            <div class="form-group">
              <label class="form-label">Observación o retroalimentación para el candidato (máx. 500 caracteres):</label>
              <textarea id="stage-change-note" class="form-control" maxlength="500" placeholder="Ej. Programar entrevista técnica para el próximo martes...">${escapeHtml(`Estado actualizado a ${newStatus}`)}</textarea>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.cancelStageChangeModal()">Cancelar</button>
              <button type="submit" class="btn btn-empleador btn-sm">${icons.check(14, 'inline-left')}Confirmar Cambio</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.cancelStageChangeModal = () => {
  if (pendingStageSelectEl && pendingStagePrevValue) {
    pendingStageSelectEl.value = pendingStagePrevValue;
  }
  pendingStageSelectEl = null;
  pendingStagePrevValue = '';
  window.closeModal();
};

window.submitStageChangeModal = async (appId, newStatus) => {
  const note = document.getElementById('stage-change-note')?.value.trim() || `Fase actualizada a ${newStatus}`;
  try {
    await api.updateApplicationStatus(appId, newStatus, note);
    pendingStageSelectEl = null;
    pendingStagePrevValue = '';
    window.closeModal();
    state.showToast(`Estado de postulación actualizado a "${newStatus}".`, 'success');
    renderE03();
  } catch (err) {
    if (pendingStageSelectEl && pendingStagePrevValue) {
      pendingStageSelectEl.value = pendingStagePrevValue;
    }
    pendingStageSelectEl = null;
    pendingStagePrevValue = '';
    window.closeModal();
    state.showToast(err.message, 'error');
  }
};

/* ==========================================================================
   PANTALLA R-01: RECURSOS DE ORIENTACIÓN PROFESIONAL
   ========================================================================== */
async function renderR01() {
  const res = await api.getArticles();
  const articles = res.articles || [];

  appContent.innerHTML = `
    <div class="container">
      <div style="margin-bottom: 2rem; text-align: center;">
        <h1 style="font-size: 2rem; font-weight: 800; color: var(--color-text-main); margin-bottom: 0.5rem;">Orientación Profesional y Empleabilidad</h1>
        <p style="color: var(--color-text-muted); font-size: 1.05rem; max-width: 600px; margin: 0 auto;">
          Guías sobre estructuración de currículum técnico, preparación de entrevistas y desarrollo de carrera en software.
        </p>
      </div>

      <div class="grid-cols-2">
        ${articles.map(art => `
          <div class="card" style="cursor: pointer;" onclick="window.navigateTo('R-02', { articleId: '${art._id}' })">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="tag primary">${art.category}</span>
              <span style="font-size: 0.8rem; color: var(--color-text-muted); display: inline-flex; align-items: center; gap: 0.25rem;">
                ${icons.clock(12)} ${art.readTime}
              </span>
            </div>
            <h3 class="card-title" style="margin-bottom: 0.5rem;">${art.title}</h3>
            <p style="color: var(--color-text-muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem;">${art.summary}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--color-text-muted);">
              <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
                ${icons.user(13)} ${art.author}
              </span>
              <span style="color: var(--color-primary-text); font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
                Leer guía ${icons.arrowRight(13)}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ==========================================================================
   PANTALLA R-02: DETALLE DE ARTÍCULO / GUÍA
   ========================================================================== */
async function renderR02() {
  const articleId = state.screenParams.articleId || 'art-1';
  const data = await api.getArticle(articleId);
  const art = data.article;

  appContent.innerHTML = `
    <div class="container" style="max-width: 800px;">
      <div style="margin-bottom: 1.5rem;">
        <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('R-01')">
          ${icons.arrowLeft(14, 'inline-left')}Volver a recursos
        </button>
      </div>

      <article class="card" style="padding: 2.5rem;">
        <span class="tag primary" style="margin-bottom: 0.75rem;">${art.category}</span>
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--color-text-main); line-height: 1.3; margin-bottom: 0.75rem;">${art.title}</h1>
        <div class="card-meta" style="margin-bottom: 1.75rem;">
          <span style="display: inline-flex; align-items: center; gap: 0.25rem;">${icons.user(13)} Autor: <strong>${art.author}</strong></span>
          <span style="display: inline-flex; align-items: center; gap: 0.25rem;">${icons.calendar(13)} Fecha: ${art.date}</span>
          <span style="display: inline-flex; align-items: center; gap: 0.25rem;">${icons.clock(13)} ${art.readTime}</span>
        </div>

        <div style="font-size: 1.02rem; line-height: 1.7; color: var(--color-text-body); margin-bottom: 2rem;">
          ${(art.content || []).map(p => `<p style="margin-bottom: 1.25rem;">${p}</p>`).join('')}
        </div>

        ${art.keyTakeaways ? `
          <div style="background-color: var(--color-primary-light); border-left: 4px solid var(--color-primary); padding: 1.25rem; border-radius: 4px;">
            <h4 style="font-weight: 700; color: var(--color-primary-text); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
              ${icons.checkCircle(16)} Puntos Clave de Aplicación:
            </h4>
            <ul style="margin-left: 1.25rem; color: var(--color-primary-heading); line-height: 1.6;">
              ${art.keyTakeaways.map(k => `<li>${k}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </article>
    </div>
  `;
}

/* ==========================================================================
   PANTALLA R-03: FOROS DE DISCUSIÓN Y PREGUNTAS
   ========================================================================== */
async function renderR03() {
  const res = await api.getForums();
  const forums = res.forums || [];

  appContent.innerHTML = `
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem;">
        <div>
          <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main);">Foros de Discusión Estudiantil</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem;">Comunidad académica para resolver inquietudes técnicas y laborales.</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.openCreateThreadModal()">
          ${icons.plus(15, 'inline-left')}Abrir Consulta
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${forums.map(f => `
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <div>
                <span class="tag primary" style="margin-bottom: 0.35rem;">${f.category}</span>
                <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--color-text-main);">${f.title}</h3>
                <div class="card-meta">
                  <span style="display: inline-flex; align-items: center; gap: 0.25rem;">${icons.user(13)} Por: <strong>${f.authorName}</strong> (${f.authorRole})</span>
                  <span style="display: inline-flex; align-items: center; gap: 0.25rem;">${icons.calendar(13)} ${f.createdAt}</span>
                  <span style="display: inline-flex; align-items: center; gap: 0.25rem;">${icons.messagesSquare(13)} ${f.replies ? f.replies.length : 0} respuestas</span>
                </div>
              </div>
            </div>

            <p style="color: var(--color-text-body); line-height: 1.6; margin-bottom: 1.25rem;">${f.content}</p>

            <!-- Thread replies -->
            ${f.replies && f.replies.length ? `
              <div style="border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1rem;">
                <h5 style="font-size: 0.85rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 0.75rem;">Respuestas en el Hilo:</h5>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                  ${f.replies.map(rep => `
                    <div style="background-color: var(--color-bg-subtle); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                      <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                        <strong style="color: var(--color-text-secondary);">${rep.authorName} <span style="font-weight: 400; color: var(--color-text-muted);">(${rep.authorRole})</span></strong>
                        <span style="color: var(--color-text-muted);">${rep.date}</span>
                      </div>
                      <div style="font-size: 0.88rem; color: var(--color-text-body);">${rep.content}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Add reply input -->
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
              <input type="text" id="reply-input-${f._id}" class="form-control" maxlength="2000" placeholder="Escriba una respuesta técnica o comentario..." />
              <button class="btn btn-secondary btn-sm" onclick="window.submitReply('${f._id}')">
                ${icons.send(14, 'inline-left')}Responder
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.openCreateThreadModal = () => {
  const user = state.currentUser;
  if (!user) {
    state.showToast('Debe iniciar sesión para abrir un debate en el foro.', 'error');
    window.openLoginModal();
    return;
  }

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Abrir Nuevo Debate</h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); window.submitCreateThread();">
            <div class="form-group">
              <label class="form-label">Título del Debate</label>
              <input type="text" id="forum-title" class="form-control" required minlength="8" maxlength="150" placeholder="Ej. Recomendaciones sobre pruebas técnicas en Node.js" />
            </div>
            <div class="form-group">
              <label class="form-label">Categoría</label>
              <select id="forum-category" class="form-control">
                <option value="Desarrollo de Software">Desarrollo de Software</option>
                <option value="Primer Empleo & Pasantías">Primer Empleo & Pasantías</option>
                <option value="Salarios y Negociación">Salarios y Negociación</option>
                <option value="Comunidad y Consejos">Comunidad y Consejos</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Pregunta o Planteamiento (Mínimo 15 caracteres)</label>
              <textarea id="forum-content" class="form-control" required minlength="15" maxlength="3000" placeholder="Describa el tema o duda técnica para recibir orientación de la comunidad..."></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary">
                ${icons.check(14, 'inline-left')}Publicar Debate
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitCreateThread = async () => {
  const title = document.getElementById('forum-title').value.trim();
  const category = document.getElementById('forum-category').value;
  const content = document.getElementById('forum-content').value.trim();

  try {
    await api.createThread({ title, category, content });
    window.closeModal();
    state.showToast('Debate publicado exitosamente.', 'success');
    renderR03();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.submitReply = async (threadId) => {
  const input = document.getElementById(`reply-input-${threadId}`);
  if (!input || !input.value.trim()) return;

  try {
    await api.addReply(threadId, input.value.trim());
    state.showToast('Respuesta registrada en el hilo.', 'success');
    renderR03();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

/* ==========================================================================
   PANTALLA A-01: PANEL DE CONTROL Y AUDITORÍA ADMINISTRATIVA
   ========================================================================== */
let allAdminUsers = [];

async function renderA01() {
  const user = state.currentUser;
  if (!user || user.role !== 'admin') {
    appContent.innerHTML = `<div class="container"><div class="card"><p>Acceso restringido a cuentas de Administrador.</p></div></div>`;
    return;
  }

  const [statsData, usersData, companiesData, jobsData, logsData, statusData] = await Promise.all([
    api.getStats().catch(() => ({ stats: {} })),
    api.getUsers().catch(() => ({ users: [] })),
    api.getCompanies({ all: true }).catch(() => ({ companies: [] })),
    api.getJobs({ all: true }).catch(() => ({ jobs: [] })),
    api.getAuditLogs().catch(() => ({ logs: [] })),
    api.getStatus().catch(() => ({ isMongoConnected: false, databaseName: 'portal_trabajo' }))
  ]);

  const stats = statsData.stats || {};
  allAdminUsers = usersData.users || [];
  allAdminCompanies = companiesData.companies || [];
  allAdminJobs = jobsData.jobs || [];
  const logs = logsData.logs || [];
  const dbStatus = statusData || {};

  appContent.innerHTML = `
    <div class="container">
      <!-- Admin Header (Role Color: Orange) -->
      <div style="margin-bottom: 1.5rem;">
        <span class="role-badge admin" style="margin-bottom: 0.5rem;">Panel A-01</span>
        <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--color-text-main);">Panel de Control y Auditoría Administrativa</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">Supervisión general, gestión de usuarios, empresas, ofertas laborales y bitácora inmutable.</p>
      </div>

      <!-- System & MongoDB Status Card (Exclusive to Admin) -->
      <div class="card admin-card-top" style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="color: var(--color-role-admin-text); background: var(--color-role-admin-bg); padding: 0.5rem; border-radius: 8px;">
              ${icons.database(22)}
            </div>
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text-main); margin: 0;">Diagnóstico del Servidor y Base de Datos</h3>
              <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0.2rem 0 0;">Información técnica y estado de persistencia de datos.</p>
            </div>
          </div>
          <div>
            <span class="tag ${dbStatus.isMongoConnected ? 'success' : 'danger'}" style="font-size: 0.82rem; padding: 0.35rem 0.75rem;">
              ${dbStatus.isMongoConnected ? icons.checkCircle(13, 'inline-left') + 'MongoDB Operativo' : icons.alertTriangle(13, 'inline-left') + 'MongoDB Desconectado'}
            </span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.88rem;">
          <div style="background: var(--color-bg-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">Base de Datos</div>
            <div style="font-weight: 700; color: var(--color-text-main); margin-top: 0.25rem;">${escapeHtml(dbStatus.databaseName || 'portal_trabajo')}</div>
          </div>
          <div style="background: var(--color-bg-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">Motor y Driver</div>
            <div style="font-weight: 700; color: var(--color-text-main); margin-top: 0.25rem;">MongoDB • Driver Oficial</div>
          </div>
          <div style="background: var(--color-bg-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">Almacenamiento Binario</div>
            <div style="font-weight: 700; color: var(--color-text-main); margin-top: 0.25rem;">GridFS (uploads.files / chunks)</div>
          </div>
          <div style="background: var(--color-bg-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">Arquitectura Backend</div>
            <div style="font-weight: 700; color: var(--color-text-main); margin-top: 0.25rem;">Node.js Nativo HTTP (Sin Express)</div>
          </div>
        </div>
      </div>

      <!-- Real Metrics Grid from Database -->
      <div class="grid-cols-4" style="margin-bottom: 2rem;">
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-admin-text);">${stats.totalUsers ?? allAdminUsers.length}</div>
          <div class="stat-label">Usuarios (${stats.suspendedUsers ?? 0} susp.)</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-admin-text);">${stats.activeJobs ?? 0} / ${stats.totalJobs ?? allAdminJobs.length}</div>
          <div class="stat-label">Ofertas Activas / Total</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-admin-text);">${stats.activeCompanies ?? 0} / ${stats.totalCompanies ?? allAdminCompanies.length}</div>
          <div class="stat-label">Empresas Activas / Total</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: var(--color-role-admin-text);">${stats.totalApplications ?? 0}</div>
          <div class="stat-label">Postulaciones Totales</div>
        </div>
      </div>

      <!-- Administrative Sections Tabs -->
      <div class="tabs-nav" style="margin-bottom: 1.5rem;">
        <button class="tab-btn ${adminActiveTab === 'usuarios' ? 'active' : ''}" onclick="window.switchAdminTab('usuarios')">
          ${icons.user(14, 'inline-left')}Gestión de usuarios (${allAdminUsers.length})
        </button>
        <button class="tab-btn ${adminActiveTab === 'empresas' ? 'active' : ''}" onclick="window.switchAdminTab('empresas')">
          ${icons.building(14, 'inline-left')}Empresas (${allAdminCompanies.length})
        </button>
        <button class="tab-btn ${adminActiveTab === 'ofertas' ? 'active' : ''}" onclick="window.switchAdminTab('ofertas')">
          ${icons.briefcase(14, 'inline-left')}Ofertas (${allAdminJobs.length})
        </button>
        <button class="tab-btn ${adminActiveTab === 'bitacora' ? 'active' : ''}" onclick="window.switchAdminTab('bitacora')">
          ${icons.shield(14, 'inline-left')}Bitácora (${logs.length})
        </button>
        <button class="tab-btn ${adminActiveTab === 'configuracion' ? 'active' : ''}" onclick="window.switchAdminTab('configuracion')">
          ${icons.moon(14, 'inline-left')}Configuración
        </button>
      </div>

      <!-- TAB 1: Gestión de usuarios -->
      <div id="admin-panel-usuarios" class="card" style="display: ${adminActiveTab === 'usuarios' ? 'block' : 'none'}; margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text-main); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
              ${icons.user(18)} Gestión de usuarios
            </h3>
            <p style="font-size: 0.82rem; color: var(--color-text-muted); margin: 0.2rem 0 0;">Consulta y búsqueda de usuarios registrados, edición de datos de perfil, activación, suspensión y restablecimiento de contraseña temporal.</p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            <input type="text" id="admin-user-search" class="form-control" style="max-width: 240px; font-size: 0.84rem;" placeholder="Buscar por nombre o correo..." oninput="window.filterAdminUsers()" />
            <select id="admin-role-filter" class="form-control" style="width: auto; font-size: 0.84rem;" onchange="window.filterAdminUsers()">
              <option value="all">Todos los roles</option>
              <option value="candidato">Candidatos</option>
              <option value="empleador">Empresas</option>
              <option value="admin">Administradores</option>
            </select>
            <select id="admin-status-filter" class="form-control" style="width: auto; font-size: 0.84rem;" onchange="window.filterAdminUsers()">
              <option value="all">Todos los estados</option>
              <option value="Activa">Activas</option>
              <option value="Suspendida">Suspendidas</option>
              <option value="Inactiva">Inactivas</option>
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo Electrónico</th>
                <th>Rol</th>
                <th>Estado</th>
                <th style="min-width: 280px;">Acciones</th>
              </tr>
            </thead>
            <tbody id="admin-users-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- TAB 2: Empresas -->
      <div id="admin-panel-empresas" class="card" style="display: ${adminActiveTab === 'empresas' ? 'block' : 'none'}; margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text-main); margin: 0;">Supervisión de Empresas Registradas</h3>
            <p style="font-size: 0.82rem; color: var(--color-text-muted); margin: 0.2rem 0 0;">Verificación, suspensión/reactivación y administración de organizaciones en MongoDB.</p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <input type="text" id="admin-company-search" class="form-control" style="max-width: 220px; font-size: 0.84rem;" placeholder="Buscar empresa..." oninput="window.filterAdminCompanies()" />
            <select id="admin-company-status-filter" class="form-control" style="width: auto; font-size: 0.84rem;" onchange="window.filterAdminCompanies()">
              <option value="all">Todos los estados</option>
              <option value="Activa">Activas</option>
              <option value="Suspendida">Suspendidas</option>
              <option value="Inactiva">Inactivas</option>
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Industria y Ubicación</th>
                <th>Verificación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="admin-companies-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- TAB 3: Ofertas -->
      <div id="admin-panel-ofertas" class="card" style="display: ${adminActiveTab === 'ofertas' ? 'block' : 'none'}; margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text-main); margin: 0;">Moderación de Ofertas Laborales</h3>
            <p style="font-size: 0.82rem; color: var(--color-text-muted); margin: 0.2rem 0 0;">Control de vacantes publicadas en la plataforma (Activar, Pausar, Cerrar o Eliminar).</p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <input type="text" id="admin-job-search" class="form-control" style="max-width: 220px; font-size: 0.84rem;" placeholder="Buscar oferta o empresa..." oninput="window.filterAdminJobs()" />
            <select id="admin-job-status-filter" class="form-control" style="width: auto; font-size: 0.84rem;" onchange="window.filterAdminJobs()">
              <option value="all">Todos los estados</option>
              <option value="Activa">Activas</option>
              <option value="Pausada">Pausadas</option>
              <option value="Cerrada">Cerradas</option>
              <option value="Inactiva">Inactivas</option>
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Oferta Laboral</th>
                <th>Empresa</th>
                <th>Rango Salarial</th>
                <th>Estado</th>
                <th>Vencimiento</th>
                <th>Moderación</th>
              </tr>
            </thead>
            <tbody id="admin-jobs-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- TAB 4: Audit Log Table -->
      <div id="admin-panel-bitacora" class="card" style="display: ${adminActiveTab === 'bitacora' ? 'block' : 'none'};">
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem;">Bitácora de Auditoría de Moderación (Inmutable en MongoDB)</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Administrador</th>
                <th>Categoría</th>
                <th>Elemento / Registro</th>
                <th>Acción</th>
                <th>Motivo Registrado</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; color: var(--color-text-muted);">No hay acciones registradas en la bitácora aún.</td></tr>
              ` : logs.map(log => `
                <tr>
                  <td>${escapeHtml(log.date)}</td>
                  <td style="font-weight: 600;">${escapeHtml(log.adminName)}</td>
                  <td><span class="tag">${escapeHtml(log.category)}</span></td>
                  <td>${escapeHtml(log.targetName)}</td>
                  <td><span class="tag ${log.action === 'Suspensión' || log.action === 'Suspender' || log.action === 'Cerrado' ? 'danger' : 'primary'}">${escapeHtml(log.action)}</span></td>
                  <td style="font-size: 0.82rem; color: var(--color-text-muted);">${escapeHtml(log.reason)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 5: Configuración de Administrador -->
      <div id="admin-panel-configuracion" style="display: ${adminActiveTab === 'configuracion' ? 'block' : 'none'};">
        ${renderAccountThemeSettingsCard(user, 'btn-admin')}
      </div>
    </div>
  `;

  window.renderAdminUsersList(allAdminUsers);
  window.renderAdminCompaniesList(allAdminCompanies);
  window.renderAdminJobsList(allAdminJobs);
}

window.switchAdminTab = (tabName) => {
  adminActiveTab = tabName;
  renderA01();
};

window.filterAdminUsers = () => {
  const search = (document.getElementById('admin-user-search')?.value || '').toLowerCase().trim();
  const role = document.getElementById('admin-role-filter')?.value || 'all';
  const status = document.getElementById('admin-status-filter')?.value || 'all';

  const filtered = allAdminUsers.filter(u => {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchesSearch = !search || fullName.includes(search) || email.includes(search);
    const matchesRole = role === 'all' || u.role === role;
    const matchesStatus = status === 'all' || u.status === status;
    return matchesSearch && matchesRole && matchesStatus;
  });

  window.renderAdminUsersList(filtered);
};

window.renderAdminUsersList = (users) => {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  const currentAdmin = state.currentUser;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No se encontraron usuarios con los filtros especificados.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isProtectedAdmin = u.role === 'admin' && u._id !== currentAdmin?._id;
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Sin nombre';

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(fullName)}</div>
          ${u.title ? `<div style="font-size: 0.78rem; color: var(--color-text-muted);">${escapeHtml(u.title)}</div>` : ''}
        </td>
        <td>
          <span style="font-size: 0.88rem;">${escapeHtml(u.email || '')}</span>
        </td>
        <td><span class="role-badge ${escapeHtml(u.role)}">${escapeHtml(u.role)}</span></td>
        <td><span class="${u.status === 'Activa' ? 'tag success' : 'tag danger'}">${escapeHtml(u.status || 'Activa')}</span></td>
        <td>
          ${isProtectedAdmin ? `
            <span class="tag" style="font-size: 0.75rem; background: var(--color-role-admin-bg); color: var(--color-role-admin-text); border: 1px solid var(--color-role-admin-border);">
              ${icons.shield(12, 'inline-left')}Admin Protegido
            </span>
          ` : `
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="window.openAdminEditUserModal('${escapeHtml(u._id)}')" title="Editar datos del usuario">
                ${icons.edit(13, 'inline-left')}Editar
              </button>
              ${u.status === 'Activa' ? `
                <button class="btn btn-secondary btn-sm" style="color: var(--color-danger);" onclick="window.openSuspendUserModal('${escapeHtml(u._id)}', '${escapeHtml(fullName).replace(/'/g, "\\'")}')" title="Suspender cuenta de usuario">
                  ${icons.lock(13, 'inline-left')}Suspender
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm" style="color: var(--color-success);" onclick="window.handleActivateUser('${escapeHtml(u._id)}', '${escapeHtml(fullName).replace(/'/g, "\\'")}')" title="Reactivar cuenta de usuario">
                  ${icons.unlock(13, 'inline-left')}Activar
                </button>
              `}
              <button class="btn btn-secondary btn-sm" style="color: var(--color-role-admin-text); border-color: rgba(234, 88, 12, 0.4);" onclick="window.handleAdminResetPassword('${escapeHtml(u._id)}', '${escapeHtml(fullName).replace(/'/g, "\\'")}')" title="Restablecer contraseña">
                ${icons.key(13, 'inline-left')}Restablecer clave
              </button>
            </div>
          `}
        </td>
      </tr>
    `;
  }).join('');
};

window.filterAdminCompanies = () => {
  const search = (document.getElementById('admin-company-search')?.value || '').toLowerCase().trim();
  const status = document.getElementById('admin-company-status-filter')?.value || 'all';
  const filtered = allAdminCompanies.filter(c => {
    const matchesSearch = !search || `${c.name || ''} ${c.industry || ''} ${c.location || ''}`.toLowerCase().includes(search);
    const matchesStatus = status === 'all' || (c.status || 'Activa') === status;
    return matchesSearch && matchesStatus;
  });
  window.renderAdminCompaniesList(filtered);
};

window.renderAdminCompaniesList = (companies) => {
  const tbody = document.getElementById('admin-companies-tbody');
  if (!tbody) return;

  if (companies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No se encontraron empresas con los filtros indicados.</td></tr>`;
    return;
  }

  tbody.innerHTML = companies.map(c => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          ${renderCompanyLogo(c.logo, c.name, 36, 6)}
          <div>
            <div style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(c.name)}</div>
            <div style="font-size: 0.76rem; color: var(--color-text-muted);">${escapeHtml(c.legalName || '')}</div>
          </div>
        </div>
      </td>
      <td style="font-size: 0.84rem;">
        <div>${escapeHtml(c.industry || 'General')}</div>
        <div style="color: var(--color-text-muted); font-size: 0.78rem;">${escapeHtml(c.location || '')}</div>
      </td>
      <td>
        <span class="tag ${c.verified ? 'success' : ''}">${c.verified ? 'Verificada' : 'No verificada'}</span>
      </td>
      <td>
        <span class="tag ${c.status === 'Activa' ? 'success' : 'danger'}">${escapeHtml(c.status || 'Activa')}</span>
      </td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('E-01', { companyId: '${escapeHtml(c._id)}' })">
            ${icons.eye(13, 'inline-left')}Perfil
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.handleAdminModerateCompany('${escapeHtml(c._id)}', '${escapeHtml(c.name).replace(/'/g, "\\'")}', '${c.verified ? 'Quitar Verificación' : 'Verificar'}')">
            ${c.verified ? 'Quitar Verif.' : 'Verificar'}
          </button>
          <button class="btn btn-secondary btn-sm" style="color: ${c.status === 'Activa' ? 'var(--color-danger)' : 'var(--color-success)'};" onclick="window.handleAdminModerateCompany('${escapeHtml(c._id)}', '${escapeHtml(c.name).replace(/'/g, "\\'")}', '${c.status === 'Activa' ? 'Suspender' : 'Activar'}')">
            ${c.status === 'Activa' ? 'Suspender' : 'Activar'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="window.handleAdminDeleteCompany('${escapeHtml(c._id)}', '${escapeHtml(c.name).replace(/'/g, "\\'")}')">
            ${icons.trash(13)}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
};

window.handleAdminModerateCompany = async (companyId, companyName, action) => {
  if (!confirm(`¿Confirma ejecutar la acción "${action}" sobre la empresa "${companyName}"?`)) return;
  try {
    await api.moderateItem({
      category: 'Empresas',
      targetId: companyId,
      targetName: companyName,
      action,
      reason: `Acción administrativa (${action}) sobre perfil corporativo.`
    });
    state.showToast(`Empresa "${companyName}" actualizada (${action}).`, 'success');
    renderA01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleAdminDeleteCompany = async (companyId, companyName) => {
  if (!confirm(`¿Confirma eliminar o inactivar la empresa "${companyName}"?`)) return;
  try {
    const res = await api.deleteCompany(companyId);
    state.showToast(res.message || 'Empresa procesada.', 'info');
    renderA01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.filterAdminJobs = () => {
  const search = (document.getElementById('admin-job-search')?.value || '').toLowerCase().trim();
  const status = document.getElementById('admin-job-status-filter')?.value || 'all';
  const filtered = allAdminJobs.filter(j => {
    const matchesSearch = !search || `${j.title || ''} ${j.companyName || ''} ${j.sector || ''}`.toLowerCase().includes(search);
    const matchesStatus = status === 'all' || j.status === status;
    return matchesSearch && matchesStatus;
  });
  window.renderAdminJobsList(filtered);
};

window.renderAdminJobsList = (jobs) => {
  const tbody = document.getElementById('admin-jobs-tbody');
  if (!tbody) return;

  if (jobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No se encontraron ofertas con los filtros indicados.</td></tr>`;
    return;
  }

  tbody.innerHTML = jobs.map(j => `
    <tr>
      <td>
        <div style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(j.title)}</div>
        <div style="font-size: 0.76rem; color: var(--color-text-muted);">${escapeHtml(j.modality || '')} • ${escapeHtml(j.sector || '')}</div>
      </td>
      <td>${escapeHtml(j.companyName)}</td>
      <td>$${j.salaryMin} - $${j.salaryMax} USD</td>
      <td><span class="tag ${j.status === 'Activa' ? 'success' : (j.status === 'Pausada' ? 'warning' : 'danger')}">${escapeHtml(j.status)}</span></td>
      <td>${escapeHtml(j.expiresAt || 'N/A')}</td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('P-03', { jobId: '${escapeHtml(j._id)}' })">
            ${icons.eye(13, 'inline-left')}Ver
          </button>
          ${j.status !== 'Activa' ? `
            <button class="btn btn-secondary btn-sm" style="color: var(--color-success);" onclick="window.handleAdminModerateJob('${escapeHtml(j._id)}', '${escapeHtml(j.title).replace(/'/g, "\\'")}', 'Aprobado')">
              Activar
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="window.handleAdminModerateJob('${escapeHtml(j._id)}', '${escapeHtml(j.title).replace(/'/g, "\\'")}', 'Pausado')">
              Pausar
            </button>
            <button class="btn btn-secondary btn-sm" style="color: var(--color-danger);" onclick="window.handleAdminModerateJob('${escapeHtml(j._id)}', '${escapeHtml(j.title).replace(/'/g, "\\'")}', 'Cerrado')">
              Cerrar
            </button>
          `}
          <button class="btn btn-danger btn-sm" onclick="window.handleAdminDeleteJob('${escapeHtml(j._id)}')">
            ${icons.trash(13)}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
};

window.handleAdminModerateJob = async (jobId, jobTitle, action) => {
  if (!confirm(`¿Confirma aplicar "${action}" a la oferta "${jobTitle}"?`)) return;
  try {
    await api.moderateItem({
      category: 'Ofertas',
      targetId: jobId,
      targetName: jobTitle,
      action,
      reason: `Moderación administrativa (${action}) sobre oferta laboral.`
    });
    state.showToast(`Oferta "${jobTitle}" actualizada (${action}).`, 'success');
    renderA01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleAdminDeleteJob = async (jobId) => {
  if (!confirm('¿Desea eliminar definitivamente esta oferta laboral de MongoDB?')) return;
  try {
    const res = await api.deleteJob(jobId, true);
    state.showToast(res.message || 'Oferta eliminada.', 'info');
    renderA01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.openSuspendUserModal = (userId, userName) => {
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3 style="color: var(--color-danger); display: flex; align-items: center; gap: 0.5rem;">
            ${icons.lock(18)} Suspender Cuenta de Usuario
          </h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.9rem; color: var(--color-text-body); margin-bottom: 1rem;">
            Estás a punto de suspender la cuenta de <strong>${escapeHtml(userName)}</strong>. El usuario no podrá iniciar sesión hasta que sea reactivado.
          </p>
          <form onsubmit="event.preventDefault(); window.confirmSuspendUser('${escapeHtml(userId)}');">
            <div class="form-group">
              <label class="form-label">Motivo Obligatorio de Suspensión (Mínimo 5 caracteres)</label>
              <textarea id="suspend-reason-input" class="form-control" style="min-height: 90px;" placeholder="Ej. Violación de términos por publicación de ofertas engañosas..." required minlength="5" maxlength="500"></textarea>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0; background: none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-sm" style="background: var(--color-danger-solid); color: #ffffff;">
                ${icons.lock(13, 'inline-left')}Confirmar Suspensión
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.confirmSuspendUser = async (userId) => {
  const reason = document.getElementById('suspend-reason-input')?.value?.trim();
  if (!reason || reason.length < 5) {
    state.showToast('El motivo de suspensión es obligatorio y debe tener al menos 5 caracteres.', 'error');
    return;
  }

  try {
    const res = await api.suspendUser(userId, reason);
    state.showToast(res.message, 'success');
    window.closeModal();
    renderA01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleActivateUser = async (userId, userName) => {
  if (!confirm(`¿Confirma que desea reactivar la cuenta de "${userName}"?`)) return;

  try {
    const res = await api.activateUser(userId, 'Reactivación administrativa de la cuenta por revisión de cumplimiento.');
    state.showToast(res.message, 'success');
    renderA01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.openAdminEditUserModal = (userId) => {
  const targetUser = allAdminUsers.find(u => u._id === userId);
  if (!targetUser) {
    state.showToast('Usuario no encontrado en la lista.', 'error');
    return;
  }

  const isCurrentAdmin = targetUser.role === 'admin';
  const fullName = `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim();

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 580px; border-top: 4px solid var(--color-role-admin-text);">
        <div class="modal-header">
          <h3 style="color: var(--color-role-admin-text); display: flex; align-items: center; gap: 0.5rem; font-size: 1.15rem;">
            ${icons.edit(18)} Editar Datos del Usuario
          </h3>
          <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal()" aria-label="Cerrar modal">
            ${icons.x(18)}
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1.25rem;">
            Modificación de perfil para <strong>${escapeHtml(fullName)}</strong> (${escapeHtml(targetUser.email)}). Los cambios se persistirán en MongoDB y se registrarán en la bitácora inmutable de auditoría.
          </p>
          <form onsubmit="event.preventDefault(); window.submitAdminEditUser('${escapeHtml(userId)}');">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Nombres <span style="color: var(--color-danger); font-size: 0.8rem;">*</span></label>
                <input type="text" id="admin-edit-firstName" class="form-control" required maxlength="60" value="${escapeHtml(targetUser.firstName || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Apellidos <span style="color: var(--color-danger); font-size: 0.8rem;">*</span></label>
                <input type="text" id="admin-edit-lastName" class="form-control" required maxlength="60" value="${escapeHtml(targetUser.lastName || '')}" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Correo Electrónico <span style="color: var(--color-danger); font-size: 0.8rem;">*</span></label>
                <input type="email" id="admin-edit-email" class="form-control" required maxlength="100" value="${escapeHtml(targetUser.email || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Rol en Plataforma</label>
                <select id="admin-edit-role" class="form-control" ${isCurrentAdmin ? 'disabled' : ''}>
                  <option value="candidato" ${targetUser.role === 'candidato' ? 'selected' : ''}>Candidato</option>
                  <option value="empleador" ${targetUser.role === 'empleador' ? 'selected' : ''}>Empresa / Empleador</option>
                  ${isCurrentAdmin ? '<option value="admin" selected>Administrador</option>' : ''}
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Título / Cargo Profesional</label>
                <input type="text" id="admin-edit-title" class="form-control" maxlength="100" value="${escapeHtml(targetUser.title || '')}" placeholder="Ej. Ingeniero de Software" />
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" id="admin-edit-phone" class="form-control" maxlength="25" value="${escapeHtml(targetUser.phone || '')}" placeholder="503-7000-0000" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Ubicación</label>
                <input type="text" id="admin-edit-location" class="form-control" maxlength="100" value="${escapeHtml(targetUser.location || '')}" placeholder="San Salvador, El Salvador" />
              </div>
              <div class="form-group">
                <label class="form-label">Estado de Cuenta</label>
                <select id="admin-edit-status" class="form-control" ${isCurrentAdmin ? 'disabled' : ''}>
                  <option value="Activa" ${targetUser.status === 'Activa' ? 'selected' : ''}>Activa</option>
                  <option value="Suspendida" ${targetUser.status === 'Suspendida' ? 'selected' : ''}>Suspendida</option>
                  <option value="Inactiva" ${targetUser.status === 'Inactiva' ? 'selected' : ''}>Inactiva</option>
                </select>
              </div>
            </div>

            <div class="modal-footer" style="padding: 1.25rem 0 0; background: none; display: flex; justify-content: flex-end; gap: 0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-admin btn-sm">
                ${icons.check(13, 'inline-left')}Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitAdminEditUser = async (userId) => {
  const firstName = document.getElementById('admin-edit-firstName')?.value?.trim();
  const lastName = document.getElementById('admin-edit-lastName')?.value?.trim();
  const email = document.getElementById('admin-edit-email')?.value?.trim();
  const roleSelect = document.getElementById('admin-edit-role');
  const role = roleSelect ? roleSelect.value : undefined;
  const title = document.getElementById('admin-edit-title')?.value?.trim();
  const phone = document.getElementById('admin-edit-phone')?.value?.trim();
  const location = document.getElementById('admin-edit-location')?.value?.trim();
  const statusSelect = document.getElementById('admin-edit-status');
  const status = statusSelect ? statusSelect.value : undefined;

  if (!firstName || !lastName) {
    state.showToast('Nombres y apellidos son requeridos.', 'error');
    return;
  }
  if (!email) {
    state.showToast('El correo electrónico es requerido.', 'error');
    return;
  }

  const payload = {
    firstName,
    lastName,
    email,
    title,
    phone,
    location
  };
  if (role) payload.role = role;
  if (status) payload.status = status;

  try {
    const res = await api.adminUpdateUser(userId, payload);
    state.showToast(res.message || 'Usuario actualizado correctamente.', 'success');
    window.closeModal();
    renderA01();
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.handleAdminResetPassword = async (userId, userName) => {
  if (!confirm(`¿Confirma que desea restablecer la contraseña de "${userName}"?\n\n• Se generará una contraseña temporal segura.\n• Se revocarán de inmediato todas sus sesiones activas.\n• Se le obligará a crear una nueva contraseña en su próximo inicio de sesión.`)) {
    return;
  }

  try {
    const res = await api.adminResetPassword(userId);
    const tempPassword = res.temporaryPassword;

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 520px; border-top: 4px solid var(--color-role-admin-text);">
          <div class="modal-header">
            <h3 style="color: var(--color-role-admin-text); display: flex; align-items: center; gap: 0.5rem; font-size: 1.2rem;">
              ${icons.key(20)} Contraseña Temporal Generada
            </h3>
            <button style="border: none; background: none; cursor: pointer; color: var(--color-text-muted);" onclick="window.closeModal(); renderA01();" aria-label="Cerrar modal">
              ${icons.x(18)}
            </button>
          </div>
          <div class="modal-body">
            <div style="background: rgba(234, 88, 12, 0.12); border: 1px solid var(--color-role-admin-border); border-left: 4px solid var(--color-role-admin-text); padding: 0.85rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
              <strong style="color: var(--color-role-admin-text); font-size: 0.9rem; display: flex; align-items: center; gap: 0.35rem;">
                ${icons.alertTriangle(15)} ¡ADVERTENCIA DE SEGURIDAD!
              </strong>
              <p style="font-size: 0.84rem; color: var(--color-text-main); margin: 0.35rem 0 0; line-height: 1.45;">
                Esta contraseña temporal se muestra <strong>una única vez</strong> por razones de seguridad. Cópiela de inmediato y entréguesela de forma segura al usuario <strong>${escapeHtml(userName)}</strong>.
              </p>
            </div>

            <div style="background: var(--color-bg-subtle); border: 2px dashed var(--color-role-admin-border); padding: 1rem 1.25rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
              <div style="overflow: hidden;">
                <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700; margin-bottom: 0.25rem;">
                  Contraseña Temporal de Acceso
                </div>
                <code id="admin-temp-pwd-code" style="font-family: monospace; font-size: 1.25rem; font-weight: 800; color: var(--color-role-admin-text); letter-spacing: 1px;">
                  ${escapeHtml(tempPassword)}
                </code>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-temp-pwd" onclick="window.copyTempPassword('${escapeHtml(tempPassword)}')" style="white-space: nowrap;">
                ${icons.copy(14, 'inline-left')}Copiar
              </button>
            </div>

            <div style="font-size: 0.83rem; color: var(--color-text-muted); background: var(--color-bg-surface); border: 1px solid var(--color-border); padding: 0.85rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
              <div style="font-weight: 600; color: var(--color-text-main); margin-bottom: 0.35rem;">Protocolo de seguridad aplicado:</div>
              <ul style="margin: 0; padding-left: 1.2rem; line-height: 1.55;">
                <li>Las sesiones activas anteriores del usuario han sido <strong>revocadas de inmediato</strong>.</li>
                <li>El usuario deberá ingresar con esta clave temporal y el sistema le <strong>exigirá cambiarla</strong> en su próximo inicio de sesión.</li>
                <li>La contraseña anterior ha sido sobrescrita mediante <strong>hash seguro (bcrypt)</strong> y no puede recuperarse.</li>
                <li>Esta acción administrativa ha quedado registrada en la <strong>bitácora de auditoría</strong> de MongoDB.</li>
              </ul>
            </div>

            <button type="button" class="btn btn-admin btn-block" onclick="window.closeModal(); renderA01();">
              ${icons.check(14, 'inline-left')}Entendido y Cerrar
            </button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

window.copyTempPassword = (text) => {
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      state.showToast('Contraseña temporal copiada al portapapeles.', 'success');
      const btn = document.getElementById('btn-copy-temp-pwd');
      if (btn) btn.innerHTML = `${icons.check(14, 'inline-left')}¡Copiada!`;
    }).catch(() => {
      state.showToast('Seleccione y copie la contraseña manualmente.', 'info');
    });
  } else {
    state.showToast('Seleccione y copie la contraseña manualmente.', 'info');
  }
};

window.openMustChangePasswordModal = () => {
  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content" style="max-width: 480px; border-top: 4px solid var(--color-warning);">
        <div class="modal-header">
          <h3 style="color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem; font-size: 1.15rem;">
            ${icons.lock(18)} Actualización Obligatoria de Contraseña
          </h3>
        </div>
        <div class="modal-body">
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.85rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
            <p style="font-size: 0.85rem; color: var(--color-text-main); margin: 0; line-height: 1.5;">
              <strong>Atención:</strong> Su contraseña ha sido restablecida temporalmente por un administrador. Por motivos de seguridad, debe establecer una nueva contraseña personal y definitiva para continuar navegando en la plataforma.
            </p>
          </div>
          <form onsubmit="event.preventDefault(); window.submitMustChangePassword();">
            <div class="form-group">
              <label class="form-label">Nueva Contraseña (mínimo 6 caracteres) <span style="color: var(--color-danger); font-size: 0.8rem;">*</span></label>
              <input type="password" id="must-new-password" class="form-control" required minlength="6" maxlength="100" placeholder="••••••••" />
            </div>
            <div class="form-group">
              <label class="form-label">Confirmar Nueva Contraseña <span style="color: var(--color-danger); font-size: 0.8rem;">*</span></label>
              <input type="password" id="must-confirm-password" class="form-control" required minlength="6" maxlength="100" placeholder="••••••••" />
            </div>
            <button type="submit" class="btn btn-primary btn-block" style="margin-top: 1.25rem;">
              ${icons.check(14, 'inline-left')}Guardar Nueva Contraseña y Continuar
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitMustChangePassword = async () => {
  const newPassword = document.getElementById('must-new-password')?.value;
  const confirmPassword = document.getElementById('must-confirm-password')?.value;

  if (!newPassword || newPassword.length < 6) {
    state.showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    state.showToast('Las contraseñas no coinciden.', 'error');
    return;
  }

  try {
    await api.changePassword({ newPassword });
    state.showToast('Contraseña actualizada correctamente. ¡Bienvenido!', 'success');
    window.closeModal();

    // Refresh user state
    const me = await api.getMe().catch(() => null);
    if (me?.user) {
      state.setUser(me.user, state.token);
      if (me.user.role === 'admin') window.navigateTo('A-01');
      else if (me.user.role === 'empleador') window.navigateTo('E-02');
      else window.navigateTo('U-01');
    } else {
      renderScreen();
    }
  } catch (err) {
    state.showToast(err.message, 'error');
  }
};

/* ==========================================================================
   PANTALLA DOC: ESTRUCTURA Y ARQUITECTURA (EXCLUSIVO ADMINISTRADOR)
   ========================================================================== */
async function renderDOC() {
  const user = state.currentUser;
  if (!user || user.role !== 'admin') {
    state.showToast('Acceso restringido: La sección de Estructura es exclusiva para administradores.', 'error');
    const target = user ? (user.role === 'candidato' ? 'U-01' : (user.role === 'empleador' ? 'E-02' : 'P-01')) : 'P-01';
    state.setScreen(target);
    return;
  }

  const [statusRes, structureRes] = await Promise.all([
    api.getStatus().catch(() => ({})),
    api.getStructure().catch(() => null)
  ]);

  if (!structureRes) {
    state.showToast('No tienes permisos para acceder a la estructura del sistema.', 'error');
    state.setScreen('P-01');
    return;
  }

  appContent.innerHTML = `
    <div class="container">
      <div class="card" style="margin-bottom: 2rem; border-top: 4px solid var(--color-primary);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span class="brand-badge" style="margin-bottom: 0.5rem; display: inline-block;">ESPECIFICACIÓN DE ESTRUCTURA Y ARQUITECTURA (EXCLUSIVO ADMIN)</span>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--color-text-main);">${escapeHtml(structureRes.title || 'Portal de Trabajo | Estructura del Sistema')}</h1>
            <p style="color: var(--color-text-muted); font-size: 0.95rem; margin-top: 0.25rem;">
              Plataforma Empresarial de Selección de Talento, Publicación de Ofertas y Gestión Curricular
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.navigateTo('A-01')">
            ${icons.shield(14, 'inline-left')}Volver al Panel Admin
          </button>
        </div>

        <div class="doc-grid-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border); font-size: 0.88rem;">
          <div>
            <span style="color: var(--color-text-muted); display: block;">Motor de Persistencia:</span>
            <strong>MongoDB 7.0 (${escapeHtml(structureRes.database || 'portal_trabajo')})</strong>
          </div>
          <div>
            <span style="color: var(--color-text-muted); display: block;">Almacenamiento & Seguridad:</span>
            <strong>${escapeHtml(structureRes.storage || 'GridFS')} • RBAC + Bcryptjs</strong>
          </div>
          <div>
            <span style="color: var(--color-text-muted); display: block;">Estado de Conexión:</span>
            <strong style="color: ${statusRes.isMongoConnected ? 'var(--color-success-text)' : 'var(--color-warning)'};">
              ${statusRes.isMongoConnected ? icons.checkCircle(14, 'inline-left') + 'MongoDB Activo' : icons.alertTriangle(14, 'inline-left') + 'Sin Conexión MongoDB'}
            </strong>
          </div>
        </div>

        <div style="margin-top: 1rem; padding: 0.85rem 1rem; background-color: var(--color-bg-subtle); border-radius: var(--radius-sm); font-size: 0.88rem; border: 1px solid var(--color-border);">
          <strong style="color: var(--color-text-main);">Directrices de Diseño del Sistema:</strong>
          <p style="margin: 0.35rem 0 0; color: var(--color-text-muted); line-height: 1.6;">
            ${escapeHtml(structureRes.architecture || 'HTML5 Semántico, CSS3 Puro, JavaScript Vanilla, Node.js HTTP Nativo, MongoDB Driver Oficial')}. Colecciones activas (${(structureRes.collections || []).length}): ${(structureRes.collections || []).map(c => `<code>${escapeHtml(c)}</code>`).join(', ')}.
          </p>
        </div>
      </div>

      <!-- Compliance Summary -->
      <div class="card" style="margin-bottom: 2rem;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Cumplimiento de Especificaciones Tecnológicas</h3>
        <div class="grid-cols-2" style="gap: 1.25rem; font-size: 0.88rem;">
          <div style="border: 1px solid var(--color-border); padding: 1rem; border-radius: var(--radius-sm);">
            <strong style="color: var(--color-primary-text); display: block; margin-bottom: 0.5rem;">Frontend (Estándares Web Nativos):</strong>
            <ul style="margin-left: 1.25rem; color: var(--color-text-body); line-height: 1.6;">
              <li><strong>HTML5 Semántico:</strong> Marcado nativo y accesible sin frameworks.</li>
              <li><strong>CSS3 Puro:</strong> Sistema de diseño con variables, Flexbox y Grid sin Tailwind ni Bootstrap.</li>
              <li><strong>JavaScript Vanilla:</strong> Módulos ES6 nativos, API Fetch y manejo reactivo de estado.</li>
              <li><strong>Iconografía SVG:</strong> Trazados vectoriales profesionales en línea, cero emojis.</li>
            </ul>
          </div>

          <div style="border: 1px solid var(--color-border); padding: 1rem; border-radius: var(--radius-sm);">
            <strong style="color: var(--color-primary-text); display: block; margin-bottom: 0.5rem;">Backend & Base de Datos:</strong>
            <ul style="margin-left: 1.25rem; color: var(--color-text-body); line-height: 1.6;">
              <li><strong>Node.js Nativo:</strong> Enrutamiento y servidor con módulo http estándar sin Express.</li>
              <li><strong>Driver Oficial de MongoDB:</strong> Operaciones CRUD nativas sobre colecciones reales.</li>
              <li><strong>Cifrado y Seguridad:</strong> Contraseñas con hash unidireccional y sesiones con Bearer tokens.</li>
              <li><strong>Validaciones de Formulario:</strong> Formato telefónico con guiones (503-XXXX-XXXX) y salarios no negativos.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Screen Table -->
      <div class="card">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Catálogo de Pantallas y Estructura del Sistema</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Módulo</th>
                <th>Rol Autorizado</th>
                <th>Operaciones Principales</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>P-01</strong></td><td>Inicio y Búsqueda Principal</td><td>Público / Todos</td><td>Hero comercial, métricas del mercado laboral y vacantes destacadas.</td></tr>
              <tr><td><strong>P-02</strong></td><td>Búsqueda y Filtros de Empleo</td><td>Público / Todos</td><td>Filtros combinados de modalidad, contrato, jornada y nivel de experiencia.</td></tr>
              <tr><td><strong>P-03</strong></td><td>Detalle de Oferta y Postulación</td><td>Público / Candidato</td><td>Detalles, responsabilidades, prestaciones y postulación con CV en PDF.</td></tr>
              <tr><td><strong>P-04</strong></td><td>Registro e Inicio de Sesión</td><td>Público</td><td>Autenticación segura por roles (Candidato, Empleador, Administrador).</td></tr>
              <tr><td><strong>U-01</strong></td><td>Perfil del Candidato (Estilo LinkedIn)</td><td>Candidato</td><td>Experiencia, formación, competencias, idiomas, certificaciones y privacidad.</td></tr>
              <tr><td><strong>U-02</strong></td><td>Mis Postulaciones y Seguimiento</td><td>Candidato</td><td>Historial de solicitudes y notas de retroalimentación de selección.</td></tr>
              <tr><td><strong>U-03</strong></td><td>Alertas de Empleo</td><td>Candidato</td><td>Creación, activación, pausa y eliminación de criterios de notificación.</td></tr>
              <tr><td><strong>U-04</strong></td><td>Valoraciones de Empresas</td><td>Público / Candidato</td><td>Opiniones, calificación por estrellas y evaluación de clima laboral.</td></tr>
              <tr><td><strong>E-01</strong></td><td>Perfil Corporativo</td><td>Público / Empleador</td><td>Descripción institucional y listado de vacantes de la empresa.</td></tr>
              <tr><td><strong>E-02</strong></td><td>Publicación de Ofertas</td><td>Empleador / Admin</td><td>Gestión de vacantes con validación numérica y salarial estricta.</td></tr>
              <tr><td><strong>E-03</strong></td><td>Gestión de Candidatos</td><td>Empleador / Admin</td><td>Flujo de selección por fases (Enviada, En proceso, Finalista, Contratado).</td></tr>
              <tr><td><strong>R-01</strong></td><td>Orientación Profesional</td><td>Público / Todos</td><td>Artículos de inserción laboral, desarrollo de habilidades y empleabilidad.</td></tr>
              <tr><td><strong>R-02</strong></td><td>Detalle de Artículo</td><td>Público / Todos</td><td>Lectura completa con guías de método STAR y redacción de CV.</td></tr>
              <tr><td><strong>R-03</strong></td><td>Foros de Discusión</td><td>Público / Todos</td><td>Hilos de debate y retroalimentación de la comunidad profesional.</td></tr>
              <tr><td><strong>A-01</strong></td><td>Panel Administrativo</td><td>Administrador</td><td>Supervisión de métricas, bloqueo de usuarios y bitácora de auditoría.</td></tr>
              <tr><td><strong>DOC</strong></td><td>Estructura y Arquitectura</td><td><span class="role-badge admin">Exclusivo Admin</span></td><td>Especificación de arquitectura técnica, esquemas y catálogo de módulos.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
