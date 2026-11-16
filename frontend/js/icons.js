/**
 * Biblioteca de Iconografía SVG Profesional (Estilo Lucide)
 * 
 */

function createSvg(content, size = 18, className = '', fill = 'none') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon ${className}">${content}</svg>`;
}

export const icons = {
  // Navegación y módulos principales
  home: (size = 18, className = '') =>
    createSvg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', size, className),

  search: (size = 18, className = '') =>
    createSvg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', size, className),

  briefcase: (size = 18, className = '') =>
    createSvg('<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>', size, className),

  building: (size = 18, className = '') =>
    createSvg('<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>', size, className),

  bookOpen: (size = 18, className = '') =>
    createSvg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', size, className),

  messagesSquare: (size = 18, className = '') =>
    createSvg('<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>', size, className),

  user: (size = 18, className = '') =>
    createSvg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', size, className),

  fileText: (size = 18, className = '') =>
    createSvg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>', size, className),

  bell: (size = 18, className = '') =>
    createSvg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', size, className),

  shield: (size = 18, className = '') =>
    createSvg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>', size, className),

  // Metadatos y detalles de tarjeta
  mapPin: (size = 15, className = '') =>
    createSvg('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', size, className),

  dollarSign: (size = 15, className = '') =>
    createSvg('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', size, className),

  calendar: (size = 15, className = '') =>
    createSvg('<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>', size, className),

  clock: (size = 15, className = '') =>
    createSvg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', size, className),

  globe: (size = 15, className = '') =>
    createSvg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>', size, className),

  // Acciones y estados
  check: (size = 16, className = '') =>
    createSvg('<polyline points="20 6 9 17 4 12"/>', size, className),

  checkCircle: (size = 16, className = '') =>
    createSvg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', size, className),

  x: (size = 18, className = '') =>
    createSvg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', size, className),

  trash: (size = 15, className = '') =>
    createSvg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', size, className),

  edit: (size = 15, className = '') =>
    createSvg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>', size, className),

  arrowRight: (size = 16, className = '') =>
    createSvg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', size, className),

  arrowLeft: (size = 16, className = '') =>
    createSvg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', size, className),

  plus: (size = 16, className = '') =>
    createSvg('<path d="M5 12h14"/><path d="M12 5v14"/>', size, className),

  filter: (size = 16, className = '') =>
    createSvg('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', size, className),

  database: (size = 16, className = '') =>
    createSvg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>', size, className),

  server: (size = 16, className = '') =>
    createSvg('<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>', size, className),

  alertTriangle: (size = 16, className = '') =>
    createSvg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>', size, className),

  logIn: (size = 16, className = '') =>
    createSvg('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>', size, className),

  logOut: (size = 16, className = '') =>
    createSvg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>', size, className),

  upload: (size = 16, className = '') =>
    createSvg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>', size, className),

  send: (size = 16, className = '') =>
    createSvg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', size, className),

  lock: (size = 16, className = '') =>
    createSvg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', size, className),

  unlock: (size = 16, className = '') =>
    createSvg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>', size, className),

  pause: (size = 15, className = '') =>
    createSvg('<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>', size, className),

  play: (size = 15, className = '') =>
    createSvg('<polygon points="5 3 19 12 5 21 5 3"/>', size, className),

  key: (size = 16, className = '') =>
    createSvg('<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>', size, className),

  copy: (size = 16, className = '') =>
    createSvg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', size, className),

  // Estrellas de calificación en SVG
  star: (size = 16, filled = false, className = '') => {
    const fill = filled ? '#f59e0b' : 'none';
    const stroke = filled ? '#f59e0b' : '#94a3b8';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon svg-star ${className}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  },

  starRating: (rating = 5, size = 16) => {
    const r = Math.round(rating);
    let html = '<span class="star-rating-group" style="display: inline-flex; align-items: center; gap: 2px;">';
    for (let i = 1; i <= 5; i++) {
      html += icons.star(size, i <= r);
    }
    html += '</span>';
    return html;
  },

  phone: (size = 16, className = '') =>
    createSvg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', size, className),

  mail: (size = 16, className = '') =>
    createSvg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', size, className),

  graduationCap: (size = 16, className = '') =>
    createSvg('<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>', size, className),

  award: (size = 16, className = '') =>
    createSvg('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>', size, className),

  externalLink: (size = 16, className = '') =>
    createSvg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>', size, className),

  eye: (size = 16, className = '') =>
    createSvg('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', size, className),

  eyeOff: (size = 16, className = '') =>
    createSvg('<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>', size, className),

  layers: (size = 16, className = '') =>
    createSvg('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>', size, className),

  camera: (size = 16, className = '') =>
    createSvg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>', size, className),

  download: (size = 16, className = '') =>
    createSvg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>', size, className),

  sun: (size = 16, className = '') =>
    createSvg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>', size, className),

  moon: (size = 16, className = '') =>
    createSvg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', size, className)
};
