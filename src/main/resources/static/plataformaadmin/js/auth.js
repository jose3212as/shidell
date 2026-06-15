/* =========================================================
   SHIDELL ADMIN — AUTH GUARD & SESSION
   Compatible con login.html que guarda en localStorage
   con claves: 'shidell_user' y 'shidell_admin'
   ========================================================= */

const Auth = (() => {
  // El login.html usa estas claves en localStorage
  const KEY_USER  = 'shidell_user';
  const KEY_ADMIN = 'shidell_admin';

  function getUser() {
    try {
      // Primero intenta la clave de admin, luego la genérica
      const admin = localStorage.getItem(KEY_ADMIN);
      if (admin) return JSON.parse(admin);
      const user = localStorage.getItem(KEY_USER);
      if (user) return JSON.parse(user);
      return null;
    } catch { return null; }
  }

  function setUser(u) {
    localStorage.setItem(KEY_USER,  JSON.stringify(u));
    localStorage.setItem(KEY_ADMIN, JSON.stringify(u));
  }

  function clearUser() {
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_ADMIN);
  }

  function isAdmin() {
    const u = getUser();
    return u && u.sessionToken && (u.rol === 'ADMINISTRADOR' || u.rol === 'ADMIN');
  }

  function guard() {
    if (!isAdmin()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    clearUser();
    window.location.href = '/login.html';
  }

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Credenciales incorrectas');
    const user = await res.json();
    if (user.rol !== 'ADMINISTRADOR' && user.rol !== 'ADMIN') {
      throw new Error('Acceso denegado: solo administradores.');
    }
    setUser(user);
    return user;
  }

  return { getUser, setUser, clearUser, isAdmin, guard, logout, login };
})();

(function instalarAuthFetchAdmin() {
  if (window.__shidellAuthFetch) return;
  window.__shidellAuthFetch = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const user = Auth.getUser();
    if (!user?.sessionToken) return originalFetch(input, init);
    const headers = new Headers(init.headers || {});
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${user.sessionToken}`);
    return originalFetch(input, { ...init, headers });
  };
})();
