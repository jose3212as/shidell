/* =========================================================
   SHIDELL ADMIN — CALIFICACIONES JS
   ========================================================= */

let estudiantesList = [];

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Calificaciones', 'Admin / Calificaciones');
  await loadEstudiantes();
  setupCalifEvents();
});

/* ── Helpers de color / logro ───────────────────────────── */
function colorPorNota(n) {
  if (n >= 18) return '#10b981'; // green
  if (n >= 14) return '#6366f1'; // primary
  if (n >= 11) return '#f59e0b'; // yellow
  return '#ef4444';              // red
}
function nivelLogro(n) {
  if (n >= 18) return { label: 'Logro destacado', cls: 'badge-green',   bg: '#10b98122', color: '#10b981' };
  if (n >= 14) return { label: 'Logro esperado',  cls: 'badge-primary', bg: '#6366f122', color: '#6366f1' };
  if (n >= 11) return { label: 'En proceso',      cls: 'badge-yellow',  bg: '#f59e0b22', color: '#f59e0b' };
  return             { label: 'En inicio',        cls: 'badge-red',     bg: '#ef444422', color: '#ef4444' };
}

/* ── Carga estudiantes ────────────────────────────────────── */
async function loadEstudiantes() {
  try {
    estudiantesList = await API.admin.usuarios('ESTUDIANTE');
    renderEstudiantesSelect();
  } catch { Toast.error('Error al cargar estudiantes'); }
}

function renderEstudiantesSelect() {
  const sel = document.getElementById('est-select');
  if (!sel) return;
  
  const fNivel = document.getElementById('filter-nivel')?.value || '';
  const fGrado = document.getElementById('filter-grado')?.value || '';
  
  const filtered = estudiantesList.filter(e => {
    if (fNivel && e.nivel !== fNivel) return false;
    if (fGrado && e.grado !== fGrado) return false;
    return true;
  });
  
  sel.innerHTML = '<option value="">— Selecciona un estudiante —</option>' +
    filtered.map(e =>
      `<option value="${e.id}">${escapeHtml(e.nombres||'')} ${escapeHtml(e.apellidos||'')} — ${e.nivel||''} ${e.grado||''}°${e.seccion||''}</option>`
    ).join('');
    
  // Limpiar vista al cambiar el filtro
  clearCalif();
}

/* ── Eventos ─────────────────────────────────────────────── */
function setupCalifEvents() {
  document.getElementById('est-select')?.addEventListener('change', e => {
    const id = parseInt(e.target.value);
    if (id) { showStudentPills(id); loadCalificaciones(id); }
    else clearCalif();
  });
  
  document.getElementById('filter-nivel')?.addEventListener('change', renderEstudiantesSelect);
  document.getElementById('filter-grado')?.addEventListener('change', renderEstudiantesSelect);
}

/* ── Pills del estudiante (en el hero) ───────────────────── */
function showStudentPills(id) {
  const est  = estudiantesList.find(e => e.id === id);
  const wrap = document.getElementById('student-pills');
  if (!wrap) return;
  if (!est)  { wrap.innerHTML = ''; return; }
  const pills = [
    est.nivel   && `<span class="hero-pill"><i class="ph ph-graduation-cap"></i>${est.nivel.charAt(0)+est.nivel.slice(1).toLowerCase()}</span>`,
    est.grado   && `<span class="hero-pill"><i class="ph ph-list-numbers"></i>${est.grado}° grado</span>`,
    est.seccion && `<span class="hero-pill"><i class="ph ph-tag"></i>Sección ${est.seccion}</span>`,
    est.turno   && `<span class="hero-pill"><i class="ph ph-${est.turno==='TARDE'?'moon':'sun'}"></i>${est.turno.charAt(0)+est.turno.slice(1).toLowerCase()}</span>`,
  ].filter(Boolean);
  wrap.innerHTML = pills.join('');
}

/* ── Cargar y renderizar calificaciones ───────────────────── */
async function loadCalificaciones(id) {
  document.getElementById('calif-placeholder').style.display = 'none';
  document.getElementById('calif-main').style.display        = 'none';
  document.getElementById('calif-loading').style.display     = 'flex';
  document.getElementById('hero-ring').style.display         = 'none';
  try {
    const data = await API.calificaciones.porEstudiante(id);
    renderCalificaciones(data);
  } catch (e) {
    Toast.error('Error al cargar calificaciones', e.message);
    document.getElementById('calif-placeholder').style.display = 'flex';
  } finally {
    document.getElementById('calif-loading').style.display = 'none';
  }
}

/* ── Render principal ────────────────────────────────────── */
function renderCalificaciones(data) {
  const promedio = parseFloat(data.promedioGeneral) || 0;
  const logro    = nivelLogro(promedio);
  const color    = colorPorNota(promedio);
  const circ     = 2 * Math.PI * 46; // r = 46

  // ─ Anillo en el hero
  const ring = document.getElementById('hero-ring');
  if (ring) {
    ring.style.display = 'flex';
    const fill = document.getElementById('ring-fill');
    if (fill) {
      fill.style.stroke = color;
      fill.style.strokeDashoffset = circ * (1 - Math.min(promedio / 20, 1));
    }
    const num = document.getElementById('ring-number');
    if (num) { num.textContent = promedio || '—'; num.style.color = color; }
    const badge = document.getElementById('ring-badge');
    if (badge) badge.innerHTML = `<span class="hero-pill" style="background:${logro.bg};border-color:${logro.color}40;color:${logro.color}">${logro.label}</span>`;
  }

  // ─ KPIs
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('calif-promedio',  promedio || '—');
  set('calif-aprobados', data.cursosAprobados    || 0);
  set('calif-total-ev',  data.evaluacionesTotales || 0);
  set('calif-cursos',    data.cursosTotales       || 0);

  // Color promedio en KPI
  const kpiVal = document.querySelector('#kpi-strip .kpi-strip-val');
  if (kpiVal) kpiVal.style.color = color;

  // badge header tabla
  const hBadge = document.getElementById('logro-badge-header');
  if (hBadge) hBadge.innerHTML = `<span class="badge ${logro.cls}">${logro.label}</span>`;

  const evalSub = document.getElementById('eval-subtitle');
  if (evalSub) evalSub.textContent = `${data.evaluacionesTotales || 0} actividades calificadas`;

  // ─ Tabla
  renderTabla(data.evaluaciones || []);

  // ─ Resumen cursos
  renderCursos(data.cursos || []);

  // ─ Mostrar contenido
  document.getElementById('calif-main').style.display = '';
}

/* ── Tabla de evaluaciones ───────────────────────────────── */
function renderTabla(evs) {
  const tbody = document.getElementById('calif-tbody');
  if (!evs.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="calif-empty" style="min-height:180px">
        <div class="calif-empty-icon"><i class="ph ph-clipboard-text"></i></div>
        <h3>Sin evaluaciones registradas</h3>
        <p>No hay calificaciones para este estudiante aún</p>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = evs.map((ev, i) => {
    const nota  = parseFloat(ev.nota20) || 0;
    const pct   = Math.round(nota / 20 * 100);
    const color = colorPorNota(nota);
    const logro = nivelLogro(nota);
    return `
    <tr class="eval-row stagger-item" style="opacity:0;animation:fadeInUp .3s ease ${i*0.032}s forwards">
      <td>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${escapeHtml(ev.actividad||'')}</div>
      </td>
      <td>
        ${ev.curso
          ? `<span class="badge badge-gray badge-no-dot" style="font-size:11px">${escapeHtml(ev.curso.nombre||'')}</span>`
          : '<span class="text-muted text-xs">—</span>'}
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="nota-chip" style="background:${logro.bg};color:${color}">${nota}</div>
          <div style="flex:1;display:flex;align-items:center;gap:7px">
            <div class="mini-bar-track">
              <div class="mini-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <span style="font-size:11px;color:var(--text-tertiary);white-space:nowrap">${pct}%</span>
          </div>
        </div>
      </td>
      <td><span class="badge ${logro.cls}" style="font-size:11px">${ev.estado||''}</span></td>
      <td><span class="text-xs text-muted">${formatDateShort(ev.fecha)}</span></td>
    </tr>`;
  }).join('');
}

/* ── Resumen por curso (barras horizontales) ─────────────── */
function renderCursos(cursos) {
  const el = document.getElementById('calif-cursos-list');
  if (!cursos.length) {
    el.innerHTML = `<div class="calif-empty" style="min-height:120px;padding:20px">
      <p>Sin cursos</p>
    </div>`;
    return;
  }
  const sorted = [...cursos].sort((a, b) => (b.promedio||0) - (a.promedio||0));
  el.innerHTML = sorted.map((c, i) => {
    const prom  = parseFloat(c.promedio) || 0;
    const pct   = Math.round(prom / 20 * 100);
    const color = colorPorNota(prom);
    const letra = (c.nombre || 'C')[0].toUpperCase();
    return `
    <div class="course-bar-card" style="animation:fadeInUp .3s ease ${i*0.04}s both">
      <div class="course-bar-header">
        <div class="course-bar-name">
          <div class="course-bar-letter" style="background:${color}20;color:${color}">${letra}</div>
          <span>${escapeHtml(c.nombre||'')}</span>
        </div>
        <span class="course-bar-score" style="color:${color}">${prom}</span>
      </div>
      <div class="course-bar-track">
        <div class="course-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${color}bb,${color})"></div>
      </div>
    </div>`;
  }).join('');
}

/* ── Limpiar vista ────────────────────────────────────────── */
function clearCalif() {
  document.getElementById('calif-main').style.display        = 'none';
  document.getElementById('calif-loading').style.display     = 'none';
  document.getElementById('calif-placeholder').style.display = 'flex';
  document.getElementById('hero-ring').style.display         = 'none';
  document.getElementById('student-pills').innerHTML         = '';
}
