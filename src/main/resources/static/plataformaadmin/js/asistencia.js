/* =========================================================
   SHIDELL ADMIN — ASISTENCIA JS
   ========================================================= */

let cursosList = [], selectedCursoId = null, selectedFecha = '';

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Asistencia', 'Admin / Asistencia');
  selectedFecha = new Date().toISOString().split('T')[0];
  document.getElementById('fecha-picker').value = selectedFecha;
  await loadCursos();
  setupEvents();
});

async function loadCursos() {
  try {
    cursosList = await API.admin.cursos();
    const sel = document.getElementById('curso-select');
    if (!sel) return;
    if (!cursosList.length) {
      sel.innerHTML = '<option value="">Sin cursos disponibles</option>';
      return;
    }
    sel.innerHTML = '<option value="">Seleccionar curso...</option>' +
      cursosList.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} — ${c.nivel||''} ${c.grado||''}°${c.seccion||''}</option>`).join('');
  } catch (e) { Toast.error('Error al cargar cursos'); }
}

function setupEvents() {
  document.getElementById('curso-select')?.addEventListener('change', e => {
    selectedCursoId = e.target.value ? parseInt(e.target.value) : null;
    if (selectedCursoId) loadAsistencia();
    else clearTable();
  });
  document.getElementById('fecha-picker')?.addEventListener('change', e => {
    selectedFecha = e.target.value;
    if (selectedCursoId) loadAsistencia();
  });
}

async function loadAsistencia() {
  if (!selectedCursoId) return;
  setTableLoading(true);
  try {
    const data = await API.docente.asistencia(selectedCursoId, selectedFecha);
    renderAsistencia(data);
  } catch (e) {
    Toast.error('Error al cargar asistencia', e.message);
    clearTable();
  }
}

function renderAsistencia(data) {
  const tbody = document.getElementById('asistencia-tbody');
  if (!tbody) return;
  const estudiantes = data.estudiantes || [];
  if (!estudiantes.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="ph ph-users"></i><h3>Sin estudiantes en este curso</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = estudiantes.map((est, i) => {
    const a = est.asistencia;
    const estado = a ? a.estado : null;
    const badgeMap = { PRESENTE:'badge-green', AUSENTE:'badge-red', TARDE:'badge-yellow', JUSTIFICADO:'badge-cyan' };
    const badgeCls = badgeMap[estado] || 'badge-gray';
    return `
    <tr class="stagger-item" style="opacity:0;animation:fadeInUp 0.3s ease ${i*0.04}s forwards">
      <td>${i+1}</td>
      <td>
        <div class="d-flex items-center gap-12">
          ${avatarEl(est, 'avatar-sm')}
          <div>
            <strong>${escapeHtml(est.nombres||'')} ${escapeHtml(est.apellidos||'')}</strong>
            <div class="text-xs text-muted">${escapeHtml(est.email||'')}</div>
          </div>
        </div>
      </td>
      <td>${estado ? `<span class="badge ${badgeCls}">${estado}</span>` : '<span class="badge badge-gray">Sin registro</span>'}</td>
      <td>${a?.fecha ? formatDateShort(a.fecha) : '—'}</td>
      <td>
        <div class="d-flex gap-6">
          ${['PRESENTE','TARDE','AUSENTE','JUSTIFICADO'].map(s => `
            <button class="btn btn-sm ${estado===s?'btn-primary':'btn-secondary'}" 
              onclick="registrarAsistencia(${est.id},'${s}')" title="${s}">
              ${s==='PRESENTE'?'✓':s==='TARDE'?'⌚':s==='AUSENTE'?'✗':'J'}
            </button>`).join('')}
        </div>
      </td>
    </tr>`;
  }).join('');

  updateAsistenciaStats(estudiantes);
}

function updateAsistenciaStats(estudiantes) {
  const counts = { PRESENTE:0, AUSENTE:0, TARDE:0, JUSTIFICADO:0, total: estudiantes.length };
  estudiantes.forEach(e => { if (e.asistencia?.estado) counts[e.asistencia.estado]++; });
  const pct = counts.total ? Math.round((counts.PRESENTE + counts.TARDE) / counts.total * 100) : 0;
  const el = id => document.getElementById(id);
  if (el('stat-total'))     el('stat-total').textContent     = counts.total;
  if (el('stat-presente'))  el('stat-presente').textContent  = counts.PRESENTE;
  if (el('stat-ausente'))   el('stat-ausente').textContent   = counts.AUSENTE;
  if (el('stat-tarde'))     el('stat-tarde').textContent     = counts.TARDE;
  if (el('stat-pct'))       el('stat-pct').textContent       = pct + '%';
}

async function registrarAsistencia(estudianteId, estado) {
  if (!selectedCursoId) return;
  try {
    await API.postForm(`/docente/asistencia?cursoId=${selectedCursoId}&estudianteId=${estudianteId}&estado=${estado}`);
    Toast.success('Asistencia registrada');
    loadAsistencia();
  } catch (e) { Toast.error('Error al registrar', e.message); }
}

function setTableLoading(on) {
  const tbody = document.getElementById('asistencia-tbody');
  if (tbody && on) tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:40px"><div class="spinner spinner-lg" style="margin:0 auto"></div></td></tr>`;
}

function clearTable() {
  const tbody = document.getElementById('asistencia-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="ph ph-calendar-check"></i><h3>Selecciona un curso y fecha</h3></div></td></tr>`;
}
