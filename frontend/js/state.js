/**
 * Gestor de Estado Global en Vanilla JavaScript
 */

class AppState {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('pt_token') || null;
    this.currentScreen = 'P-01'; // Default: Inicio
    this.screenParams = {};
    this.listeners = [];
    this.themeListeners = [];
    this.theme = this.getInitialTheme();
    this.applyTheme(this.theme);
  }

  getInitialTheme() {
    if (this.token) {
      const saved = localStorage.getItem('pt_theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
    return 'light';
  }

  applyTheme(theme) {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme;
    }
  }

  setTheme(theme, persist = true) {
    const validTheme = theme === 'dark' ? 'dark' : 'light';
    this.theme = validTheme;
    if (persist) {
      localStorage.setItem('pt_theme', validTheme);
    }
    this.applyTheme(validTheme);
    for (const listener of this.themeListeners) {
      listener(validTheme);
    }
  }

  toggleTheme() {
    const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme, Boolean(this.token));
    return nextTheme;
  }

  subscribeTheme(callback) {
    this.themeListeners.push(callback);
    return () => {
      this.themeListeners = this.themeListeners.filter(l => l !== callback);
    };
  }

  setUser(user, token) {
    this.currentUser = user;
    if (token) {
      this.token = token;
      localStorage.setItem('pt_token', token);
    }
    const userTheme = user?.themePreference === 'dark' ? 'dark' : 'light';
    this.setTheme(userTheme, true);
    this.notify();
  }

  clearUser() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem('pt_token');
    localStorage.removeItem('pt_theme');
    this.setTheme('light', false);
    this.notify();
  }

  setScreen(screenCode, params = {}) {
    this.currentScreen = screenCode;
    this.screenParams = params;
    window.location.hash = `#${screenCode}`;
    this.notify();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

export const state = new AppState();
