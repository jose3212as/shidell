/* =========================================================
   SHIDELL ADMIN — CALIFICACIONES JS
   ========================================================= */

let estudiantesList = [];

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Calificaciones', 'Admin / Calificaciones');
  await loadEstudiantes();
  setupCalifEvents();
});

async function loadEstudiantes() {
  try {
    estudiantesList = await API.admin.usuarios('ESTUDIANTE');
    const sel = document.getElementById('est-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar estudiante...</option>' +
      estudiantesList.map(e =>
        `<option value="${e.id}">${escapeHtml(e.nombres||'')} ${escapeHtml(e.apellidos||'')} — ${e.nivel||''} ${e.grado||''}°${e.seccion||''}</option>`
      ).join('');
  } catch (e) { Toast.error('Error al cargar estudiantes'); }
}

function setupCalifEvents() {
  document.getElementById('est-select')?.addEventListener('change', e => {
    const id = e.target.value;
    if (id) loadCalificaciones(parseInt(id));
    else clearCalif();
  });
}

async function loadCalificaciones(id) {
  document.getElementById('calif-main').style.display = 'none';
  document.getElementById('calif-loading').style.display = 'flex';
  try {
    const data = await API.calificaciones.porEstudiante(id);
    renderCalificaciones(data);
  } catch (e) {
    Toast.error('Error al cargar calificaciones', e.message);
  } finally {
    document.getElementById('calif-loading').style.display = 'none';
    document.getElementById('calif-main').style.display = '';
  }
}

function renderCalificaciones(data) {
  // KPIs
  document.getElementById('calif-promedio').textContent  = data.promedioGeneral || '—';
  document.getElementById('calif-aprobados').textContent = data.cursosAprobados  || 0;
  document.getElementById('calif-total-ev').textContent  = data.evaluacionesTotales || 0;
  document.getElementById('calif-cursos').textContent    = data.cursosTotales    || 0;

  // Tabla de evaluaciones
  const tbody = document.getElementById('calif-tbody');
  const evaluaciones = data.evaluaciones || [];
  if (!evaluaciones.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="ph ph-exam"></i><h3>Sin calificaciones registradas</h3></div></td></tr>`;
  } else {
    tbody.innerHTML = evaluaciones.map((ev, i) => {
      const nota20 = ev.nota20 || 0;
      const pct = Math.round(nota20 / 20 * 100);
      const color = nota20 >= 18 ? 'var(--green)' : nota20 >= 14 ? 'var(--primary)' : nota20 >= 11 ? 'var(--yellow)' : 'var(--red)';
      const bdg = nota20 >= 18 ? 'badge-green' : nota20 >= 14 ? 'badge-primary' : nota20 >= 11 ? 'badge-yellow' : 'badge-red';
      return `
      <tr class="stagger-item" style="opacity:0;animation:fadeInUp 0.3s ease ${i*0.04}s forwards">
        <td><strong>${escapeHtml(ev.actividad||'')}</strong></td>
        <td>${ev.curso ? `<span class="text-sm">${escapeHtml(ev.curso.nombre||'')}</span>` : '—'}</td>
        <td>
          <div class="d-flex items-center gap-10">
            <strong style="color:${color};font-size:16px">${ev.nota20}</strong>
            <div class="progress-bar" style="flex:1;max-width:80px">
              <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>
        </td>
        <td><span class="badge ${bdg}">${ev.estado||''}</span></td>
        <td class="text-sm text-muted">${formatDateShort(ev.fecha)}</td>
      </tr>`;
    }).join('');
  }

  // Resumen por cursos
  const cursosEl = document.getElementById('calif-cursos-list');
  const cursos = data.cursos || [];
  cursosEl.innerHTML = cursos.map(c => {
    const prom = c.promedio || 0;
    const pct = Math.round(prom / 20 * 100);
    const color = prom >= 18 ? 'var(--green)' : prom >= 14 ? 'var(--primary)' : prom >= 11 ? 'var(--yellow)' : 'var(--red)';
    return `
    <div class="stat-row">
      <div class="d-flex items-center gap-10" style="flex:1">
        <div class="avatar avatar-sm" style="background:var(--primary-light);color:var(--primary)">${(c.nombre||'C')[0]}</div>
        <span class="text-sm">${escapeHtml(c.nombre||'')}</span>
      </div>
      <div class="d-flex items-center gap-10">
        <div class="progress-bar" style="width:80px">
          <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <strong style="color:${color};min-width:28px">${prom}</strong>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state" style="padding:20px"><p>Sin cursos</p></div>';
}

function clearCalif() {
  document.getElementById('calif-main').style.display = 'none';
  document.getElementById('calif-placeholder').style.display = 'flex';
}
