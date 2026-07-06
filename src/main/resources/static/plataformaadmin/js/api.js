/* =========================================================
   SHIDELL ADMIN — API LAYER
   Capa centralizada de fetch para todos los endpoints
   ========================================================= */

const API = (() => {
  const BASE = CONFIG.API_BASE;

  async function request(method, endpoint, body = null, isForm = false) {
    const opts = {
      method,
      headers: isForm ? {} : { 'Content-Type': 'application/json' }
    };
    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    if (user?.sessionToken) opts.headers.Authorization = `Bearer ${user.sessionToken}`;
    if (body) opts.body = isForm ? body : JSON.stringify(body);

    const res = await fetch(BASE + endpoint, opts);
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try { const d = await res.json(); msg = d.error || d.message || msg; } catch {}
      
      if (res.status === 401 || res.status === 403 || msg.toLowerCase().includes('sesión') || msg.toLowerCase().includes('expirad')) {
        if (typeof Auth !== 'undefined') Auth.clearUser();
        window.location.href = '/login.html';
      }
      
      throw new Error(msg);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json') && res.status !== 204) return res.json();
    return null;
  }

  return {
    get:    (ep)       => request('GET',    ep),
    post:   (ep, body) => request('POST',   ep, body),
    put:    (ep, body) => request('PUT',    ep, body),
    delete: (ep)       => request('DELETE', ep),
    postForm:(ep,form) => request('POST',   ep, form, true),

    // ── Admin ───────────────────────────────────────────
    admin: {
      stats:         ()       => request('GET',    '/admin/stats'),
      usuarios:      (rol)    => request('GET',    `/admin/usuarios${rol ? `?rol=${rol}` : ''}`),
      usuario:       (id)     => request('GET',    `/admin/usuarios/${id}`),
      crearUsuario:  (data)   => request('POST',   '/admin/usuarios', data),
      editarUsuario: (id, d)  => request('PUT',    `/admin/usuarios/${id}`, d),
      eliminarUsuario:(id)    => request('DELETE', `/admin/usuarios/${id}`),
      asignarPadre:  (eId,pId)=> request('PUT',    `/admin/usuarios/${eId}/asignar-padre/${pId}`),
      desvincularPadre:(eId)  => request('DELETE', `/admin/usuarios/${eId}/asignar-padre`),
      hijosDePadre:  (pId)    => request('GET',    `/admin/padres/${pId}/hijos`),
      cursos:        ()       => request('GET',    '/admin/cursos'),
      editarCurso:   (id, d)  => request('PUT',    `/admin/cursos/${id}`, d),
      clonar:        (d)      => request('POST',   '/admin/cursos/clonar', d),
    },

    // ── Docente ──────────────────────────────────────────
    docente: {
      cursos:      (id)         => request('GET', `/docente/${id}/cursos`),
      dashboard:   (id)         => request('GET', `/docente/${id}/dashboard`),
      estudiantes: (cursoId)    => request('GET', `/docente/curso/${cursoId}/estudiantes`),
      asistencia:  (cursoId,fecha) => request('GET', `/docente/curso/${cursoId}/asistencia${fecha?`?fecha=${fecha}`:''}`),
      diasAsistencia:(cursoId)  => request('GET', `/docente/curso/${cursoId}/asistencia/dias`),
    },

    // ── Calificaciones ───────────────────────────────────
    calificaciones: {
      porEstudiante: (id) => request('GET', `/calificaciones/estudiante/${id}`),
    },

    // ── Progreso ─────────────────────────────────────────
    progreso: {
      estudiante: (id) => request('GET', `/progreso/estudiante/${id}`),
    },

    // ── Notificaciones ───────────────────────────────────
    notificaciones: {
      porUsuario: (id) => request('GET', `/notificaciones/usuario/${id}`),
      marcarLeida:(id) => request('PUT', `/notificaciones/${id}/leer`),
    },

    // ── Cursos (público) ─────────────────────────────────
    cursos: {
      todos:           ()          => request('GET', '/cursos'),
      porSeccion:      (n,g,s,t)   => request('GET', `/cursos/seccion?nivel=${n}&grado=${g}&seccion=${s}${t ? `&turno=${t}` : ''}`),
      estudianteDetalle:(id)       => request('GET', `/cursos/estudiante/${id}/detalle`),
    },

    // ── Auth ─────────────────────────────────────────────
    auth: {
      login: (email, password) => request('POST', '/auth/login', { email, password }),
    }
  };
})();
