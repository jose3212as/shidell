/* =========================================================
   SHIDELL ADMIN — DASHBOARD JS
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Dashboard', 'Inicio / Resumen general');
  await Promise.all([loadStats(), loadRecentUsers(), loadRecentCourses()]);
});

/* ── Stats desde el backend ───────────────────────────────── */
async function loadStats() {
  try {
    const s = await API.admin.stats();

    // KPI cards
    animateCount('kpi-estudiantes', s.totalEstudiantes || 0);
    animateCount('kpi-docentes',    s.totalDocentes    || 0);
    animateCount('kpi-padres',      s.totalPadres      || 0);
    animateCount('kpi-primaria',    s.aulasPrimaria    || 0);
    animateCount('kpi-secundaria',  s.aulasSecundaria  || 0);
    animateCount('kpi-mensajes',    s.totalMensajes    || 0);

    // Welcome banner mini-stats
    animateCount('ws-estudiantes', s.totalEstudiantes || 0);
    animateCount('ws-docentes',    s.totalDocentes    || 0);
    animateCount('ws-aulas',       s.totalAulas       || 0);
  } catch (e) {
    console.error('Error cargando stats:', e);
  }
}

/* ── Animación de contador ───────────────────────────────── */
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 900, fps = 60;
  const frames = Math.floor(dur / (1000 / fps));
  let frame = 0;
  const timer = setInterval(() => {
    frame++;
    const ease = 1 - Math.pow(1 - frame / frames, 3);
    el.textContent = Math.round(target * ease);
    if (frame >= frames) { el.textContent = target; clearInterval(timer); }
  }, 1000 / fps);
}

/* ── Usuarios recientes ─────────────────────────────────── */
async function loadRecentUsers() {
  const tbody = document.getElementById('recent-users-body');
  if (!tbody) return;
  try {
    const users = await API.admin.usuarios();
    // Solo roles reales (excluir ARCHIVADO)
    const active = users.filter(u => u.rol !== 'ARCHIVADO');
    const recent = active.sort((a, b) => b.id - a.id).slice(0, 8);
    tbody.innerHTML = recent.map(u => `
      <tr class="stagger-item" style="animation:fadeInUp 0.4s ease forwards;opacity:0">
        <td>
          <div class="d-flex items-center gap-12">
            ${avatarEl(u, 'avatar-sm')}
            <div>
              <strong>${escapeHtml(u.nombres)} ${escapeHtml(u.apellidos)}</strong>
              <div class="text-xs text-muted">${escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td>${rolBadge(u.rol)}</td>
        <td>
          ${u.nivel
            ? `<span class="text-sm">${u.nivel} ${u.grado}° ${u.seccion} ${u.turno || ''}</span>`
            : '<span class="text-muted text-xs">—</span>'}
        </td>
        <td>
          <a href="usuarios.html" class="btn btn-ghost btn-sm btn-icon">
            <i class="ph ph-arrow-right"></i>
          </a>
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:20px">Error al cargar usuarios</td></tr>`;
  }
}

/* ── Cursos / malla ──────────────────────────────────────── */
async function loadRecentCourses() {
  const grid = document.getElementById('courses-grid');
  if (!grid) return;
  try {
    const cursos = await API.admin.cursos();
    if (!cursos.length) {
      grid.innerHTML = `<div class="empty-state"><i class="ph ph-book"></i><h3>Sin cursos registrados</h3></div>`;
      return;
    }
    const ordenados = [...cursos].sort((a, b) =>
      String(a.nivel || '').localeCompare(String(b.nivel || '')) ||
      Number(a.grado || 0) - Number(b.grado || 0) ||
      String(a.seccion || '').localeCompare(String(b.seccion || '')) ||
      Number(a.diaSemana || 0) - Number(b.diaSemana || 0)
    );
    grid.innerHTML = ordenados.slice(0, 6).map((c, i) => {
      const color = CONFIG.COLOR_MAP[c.color] || '#6366f1';
      const prof = c.profesor ? `${c.profesor.nombres||''} ${c.profesor.apellidos||''}`.trim() : 'Sin docente';
      return `
      <div class="course-mini-card stagger-item" style="animation:fadeInUp 0.4s ease ${i*0.08}s forwards;opacity:0">
        <div class="course-mini-icon" style="background:${color}22;color:${color}">
          <i class="ph ${c.icono || 'ph-book-open'}"></i>
        </div>
        <div class="course-mini-info">
          <strong>${escapeHtml(c.nombre)}</strong>
          <span>${escapeHtml(prof)}</span>
          <div class="course-mini-meta">
            ${c.nivel ? `<span class="badge badge-gray badge-no-dot">${c.nivel} ${c.grado}°${c.seccion}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><i class="ph ph-warning"></i><h3>Error al cargar</h3></div>`;
  }
}
