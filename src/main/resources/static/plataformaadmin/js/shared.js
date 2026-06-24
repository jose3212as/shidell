/* =========================================================
   SHIDELL ADMIN — SHARED UI
   Sidebar, Topbar, Toasts, Notificaciones, Helpers
   ========================================================= */

/* ─── Toast System ──────────────────────────────────────── */
const Toast = (() => {
  let container;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(title, msg = '', type = 'success', duration = 3500) {
    const icons = { success:'ph-check-circle', error:'ph-warning-circle', warning:'ph-warning', info:'ph-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <i class="ph-fill ${icons[type]} toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()"><i class="ph ph-x"></i></button>`;
    getContainer().appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  return {
    success: (t, m) => typeof AppAlerts !== 'undefined' ? AppAlerts.mostrarToast(t, 'success') : show(t, m, 'success'),
    error:   (t, m) => typeof AppAlerts !== 'undefined' ? AppAlerts.mostrarError(t, m) : show(t, m, 'error'),
    warning: (t, m) => typeof AppAlerts !== 'undefined' ? AppAlerts.mostrarToast(t, 'warning') : show(t, m, 'warning'),
    info:    (t, m) => typeof AppAlerts !== 'undefined' ? AppAlerts.mostrarToast(t, 'info') : show(t, m, 'info')
  };
})();

/* ─── Confirm Dialog ────────────────────────────────────── */
function showConfirm(title, msg, onConfirm) {
  let ov = document.getElementById('confirm-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'confirm-overlay';
    ov.className = 'confirm-overlay hidden';
    ov.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-icon"><i class="ph-fill ph-warning"></i></div>
        <div class="confirm-title" id="confirm-title"></div>
        <div class="confirm-msg"   id="confirm-msg"></div>
        <div class="confirm-actions">
          <button class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
          <button class="btn btn-danger"    id="confirm-ok">Eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  ov.querySelector('#confirm-title').textContent = title;
  ov.querySelector('#confirm-msg').textContent   = msg;
  ov.classList.remove('hidden');

  const ok = ov.querySelector('#confirm-ok');
  const cancel = ov.querySelector('#confirm-cancel');
  const close = () => ov.classList.add('hidden');
  ok.onclick = () => { close(); onConfirm(); };
  cancel.onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
}

/* ─── Sidebar Builder ───────────────────────────────────── */
function buildSidebar() {
  const path = window.location.pathname;
  const active = (page) => path.includes(page) ? 'active' : '';
  const user = Auth.getUser();
  const initials = user ? (user.nombres || 'A').charAt(0).toUpperCase() : 'A';
  const fullName = user ? `${user.nombres || ''} ${user.apellidos || ''}`.trim() : 'Administrador';

  return `
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon"><i class="ph-fill ph-graduation-cap"></i></div>
      <div class="sidebar-logo-text">
        <h2>Shidell</h2>
        <span>Admin Panel</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">Principal</div>
      <a href="dashboard.html"      class="nav-item ${active('dashboard')}">
        <i class="ph ph-squares-four"></i><span>Dashboard</span>
      </a>

      <div class="nav-section">Gestión</div>
      <a href="usuarios.html"       class="nav-item ${active('usuarios')}">
        <i class="ph ph-users-three"></i><span>Usuarios</span>
      </a>
      <a href="cursos.html"         class="nav-item ${active('cursos')}">
        <i class="ph ph-book-open"></i><span>Cursos</span>
      </a>

      <div class="nav-section">Académico</div>
      <a href="asistencia.html"     class="nav-item ${active('asistencia')}">
        <i class="ph ph-calendar-check"></i><span>Asistencia</span>
      </a>
      <a href="calificaciones.html" class="nav-item ${active('calificaciones')}">
        <i class="ph ph-exam"></i><span>Calificaciones</span>
      </a>
      <a href="reportes.html"       class="nav-item ${active('reportes')}">
        <i class="ph ph-chart-line-up"></i><span>Reportes</span>
      </a>

      <div class="nav-section">Sistema</div>
      <a href="configuracion.html"  class="nav-item ${active('configuracion')}">
        <i class="ph ph-gear"></i><span>Configuración</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user" onclick="Auth.logout()">
        <div class="sidebar-user-avatar">${initials}</div>
        <div class="sidebar-user-info">
          <strong>${fullName}</strong>
          <span>Cerrar sesión</span>
        </div>
        <i class="ph ph-sign-out sidebar-user-arrow"></i>
      </div>
    </div>
  </aside>`;
}

/* ─── Topbar Builder ────────────────────────────────────── */
function buildTopbar(pageTitle = '', breadcrumb = '') {
  const user = Auth.getUser();
  const initials = user ? (user.nombres || 'A').charAt(0).toUpperCase() : 'A';
  return `
  <header class="topbar" id="topbar">
    <div class="topbar-left">
      <div>
        <div class="topbar-page-title">${pageTitle}</div>
        ${breadcrumb ? `<div class="topbar-breadcrumb">${breadcrumb}</div>` : ''}
      </div>
    </div>
    <div class="topbar-right">
      <div class="topbar-search">
        <i class="ph ph-magnifying-glass"></i>
        <input type="text" placeholder="Buscar..." id="global-search">
      </div>
      <button class="topbar-btn" id="notif-btn" title="Notificaciones">
        <i class="ph ph-bell"></i>
        <span class="badge-dot" id="notif-dot" style="display:none"></span>
      </button>
      <div class="top-user-info">
        <div class="user-dropdown">
          <div class="topbar-avatar avatar" id="topbar-avatar" title="Perfil" style="background:transparent; color:var(--text-secondary); border:none; border-radius:50%; width:auto; height:auto;">
            <i class="ph-fill ph-user-circle" style="font-size:36px;"></i>
          </div>
          <div class="user-info-text">
            <span class="user-dropdown-name" id="topbar-name">${user ? (user.nombres || 'Admin') : 'Admin'}</span>
            <span class="user-dropdown-role" id="topbar-role">${user && user.rol ? user.rol : 'Administrador'}</span>
          </div>
          <i class="ph ph-caret-down dropdown-icon"></i>
          <div class="dropdown-menu">
            <a onclick="Auth.logout()" class="dropdown-item">
              <i class="ph ph-sign-out"></i><span>Cerrar sesión</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </header>`;
}

/* ─── Inicialización compartida ─────────────────────────── */
function initShared(pageTitle, breadcrumb = 'Admin / Shidell') {
  Auth.guard();

  // Inyectar sidebar y topbar
  const shell = document.getElementById('app-shell');
  if (!shell) return;
  const main = document.getElementById('main-content');
  if (!main) return;

  shell.insertAdjacentHTML('afterbegin', buildSidebar());
  main.insertAdjacentHTML('afterbegin', buildTopbar(pageTitle, breadcrumb));

  // Topbar scroll
  const topbar = document.getElementById('topbar');
  main.addEventListener('scroll', () => {
    topbar?.classList.toggle('scrolled', main.scrollTop > 20);
  });

  // Notificaciones
  initNotifPanel();
}

/* ─── Panel de notificaciones ───────────────────────────── */
function initNotifPanel() {
  const btn = document.getElementById('notif-btn');
  if (!btn) return;

  let panel = null;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'notif-panel hidden';
      panel.id = 'notif-panel';
      panel.innerHTML = `
        <div class="notif-panel-header">
          <h4>Notificaciones</h4>
          <button class="notif-mark-all">Marcar todas leídas</button>
        </div>
        <div class="notif-list" id="notif-list">
          <div class="empty-state" style="padding:30px">
            <i class="ph ph-bell-slash"></i>
            <h3>Sin notificaciones</h3>
          </div>
        </div>`;
      document.body.appendChild(panel);

      // Cargar notificaciones reales
      const user = Auth.getUser();
      if (user) {
        try {
          const notifs = await API.notificaciones.porUsuario(user.id);
          renderNotifs(notifs);
        } catch {}
      }
    }
    panel.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (panel && !panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });
}

function renderNotifs(notifs) {
  const list = document.getElementById('notif-list');
  if (!list) return;
  const unread = notifs.filter(n => !n.leida);
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = unread.length ? 'block' : 'none';

  if (!notifs.length) return;
  list.innerHTML = notifs.slice(0, 10).map(n => `
    <div class="notif-item ${n.leida ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
      <div class="notif-icon" style="background:var(--primary-light);color:var(--primary)">
        <i class="ph ph-bell"></i>
      </div>
      <div class="notif-body">
        <div class="notif-title">${n.titulo || 'Notificación'}</div>
        <div class="notif-text">${n.mensaje || ''}</div>
        <div class="notif-time">${formatDate(n.fecha)}</div>
      </div>
      ${!n.leida ? '<div class="notif-dot"></div>' : ''}
    </div>`).join('');
}

async function markNotifRead(id) {
  try { await API.notificaciones.marcarLeida(id); } catch {}
}

/* ─── Helpers globales ──────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const diff = Date.now() - d.getTime();
  if (diff < 60000)   return 'Hace un momento';
  if (diff < 3600000) return `Hace ${Math.floor(diff/60000)} min`;
  if (diff < 86400000)return `Hace ${Math.floor(diff/3600000)} h`;
  return d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
}

function rolBadge(rol) {
  const cls = CONFIG.ROLE_BADGE[rol] || 'badge-gray';
  const label = CONFIG.ROLE_LABELS[rol] || rol;
  return `<span class="badge ${cls}">${label}</span>`;
}

function avatarEl(user, size = '') {
  const initials = ((user.nombres||'')[0]||(user.email||'?')[0]).toUpperCase();
  const bg = CONFIG.ROLE_AVATAR_BG[user.rol] || 'linear-gradient(135deg,#6366f1,#8b5cf6)';
  return `<div class="avatar ${size}" style="background:${bg}">${initials}</div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function debounce(fn, wait = 300) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
