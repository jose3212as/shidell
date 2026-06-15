/* =========================================================
   SHIDELL ADMIN — CURSOS JS
   ========================================================= */

let allCourses = [], allDocentes = [], editingCursoId = null, searchCurso = '';

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Gestión de Cursos', 'Admin / Cursos');
  await Promise.all([loadDocentes(), loadCourses()]);
  setupCursoEvents();
});

async function loadDocentes() {
  try {
    const users = await API.admin.usuarios('DOCENTE');
    allDocentes = users;
    const sel = document.getElementById('f-profesor');
    if (sel) {
      sel.innerHTML = '<option value="">Sin asignar</option>' +
        allDocentes.map(d => `<option value="${d.id}">${escapeHtml(d.nombres||'')} ${escapeHtml(d.apellidos||'')}</option>`).join('');
    }
  } catch {}
}

async function loadCourses() {
  setLoading(true);
  try {
    allCourses = await API.admin.cursos();
    renderCourses();
    updateCursoStats();
  } catch (e) { Toast.error('Error al cargar cursos', e.message); }
  finally { setLoading(false); }
}

function updateCursoStats() {
  const el = document.getElementById('total-cursos');
  if (el) el.textContent = allCourses.length;
  const docEl = document.getElementById('cursos-con-docente');
  if (docEl) docEl.textContent = allCourses.filter(c => c.profesor).length;
}

function renderCourses() {
  const grid = document.getElementById('cursos-grid');
  if (!grid) return;
  let list = allCourses;
  if (searchCurso) {
    const q = searchCurso.toLowerCase();
    list = list.filter(c => `${c.nombre} ${c.nivel} ${c.grado} ${c.seccion}`.toLowerCase().includes(q));
  }
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="ph ph-book-open"></i><h3>Sin cursos</h3>
      <p>Crea el primer curso del sistema.</p>
      <button class="btn btn-primary" onclick="openCreateCurso()"><i class="ph ph-plus"></i>Nuevo curso</button>
    </div>`;
    return;
  }
  grid.innerHTML = list.map((c, i) => {
    const color = CONFIG.COLOR_MAP[c.color] || '#6366f1';
    const prof = c.profesor ? `${c.profesor.nombres||''} ${c.profesor.apellidos||''}`.trim() : null;
    const dia = c.diaSemana ? CONFIG.DIAS_SEMANA[c.diaSemana] || '' : '';
    const horario = c.horaInicio ? `${c.horaInicio}–${c.horaFin||''}` : '';
    return `
    <div class="curso-card stagger-item" style="animation:fadeInUp 0.4s ease ${i*0.06}s forwards;opacity:0">
      <div class="curso-card-top" style="background:${color}18;border-bottom:2px solid ${color}40">
        <div class="curso-icon" style="background:${color}22;color:${color}">
          <i class="ph ${c.icono||'ph-book-open'}"></i>
        </div>
        <div class="curso-actions">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditCurso(${c.id})" title="Editar">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="confirmDeleteCurso(${c.id},'${escapeHtml(c.nombre)}')" title="Eliminar">
            <i class="ph ph-trash" style="color:var(--red)"></i>
          </button>
        </div>
      </div>
      <div class="curso-card-body">
        <h3 class="curso-name">${escapeHtml(c.nombre||'Sin nombre')}</h3>
        <div class="d-flex gap-8 mt-8 flex-wrap">
          ${c.nivel ? `<span class="badge badge-gray badge-no-dot">${c.nivel} ${c.grado||''}°${c.seccion||''}</span>` : ''}
          ${dia ? `<span class="badge badge-gray badge-no-dot"><i class="ph ph-calendar"></i>${dia}</span>` : ''}
          ${horario ? `<span class="badge badge-gray badge-no-dot"><i class="ph ph-clock"></i>${horario}</span>` : ''}
        </div>
        <div class="curso-prof mt-12">
          ${prof ? `
            <div class="d-flex items-center gap-8">
              <div class="avatar avatar-sm" style="background:var(--purple-light);color:var(--purple)">${prof[0]}</div>
              <span class="text-sm">${escapeHtml(prof)}</span>
            </div>` : `<span class="text-xs text-muted">Sin docente asignado</span>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function setLoading(on) {
  const grid = document.getElementById('cursos-grid');
  if (grid && on) grid.innerHTML = Array(4).fill(0).map(() =>
    `<div class="curso-card"><div class="skeleton" style="height:100px"></div><div class="modal-body"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div></div></div>`
  ).join('');
}

function setupCursoEvents() {
  document.getElementById('curso-search')?.addEventListener('input', debounce(e => {
    searchCurso = e.target.value; renderCourses();
  }, 250));
  document.getElementById('curso-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'curso-modal-overlay') closeCursoModal();
  });
  document.getElementById('curso-form')?.addEventListener('submit', handleCursoSubmit);
}

/* ── Modal ──────────────────────────────────────────────── */
function openCreateCurso() {
  editingCursoId = null;
  document.getElementById('curso-form')?.reset();
  document.getElementById('curso-modal-title').textContent = 'Nuevo Curso';
  document.getElementById('curso-modal-overlay').classList.remove('hidden');
}

async function openEditCurso(id) {
  editingCursoId = id;
  document.getElementById('curso-form')?.reset();
  document.getElementById('curso-modal-title').textContent = 'Editar Curso';
  document.getElementById('curso-modal-overlay').classList.remove('hidden');
  const c = allCourses.find(x => x.id === id);
  if (!c) return;
  document.getElementById('fc-nombre').value    = c.nombre    || '';
  document.getElementById('fc-nivel').value     = c.nivel     || '';
  document.getElementById('fc-grado').value     = c.grado     || '';
  document.getElementById('fc-seccion').value   = c.seccion   || '';
  document.getElementById('fc-color').value     = c.color     || '';
  document.getElementById('fc-icono').value     = c.icono     || '';
  document.getElementById('fc-dia').value       = c.diaSemana || '';
  document.getElementById('fc-hora-inicio').value= c.horaInicio|| '';
  document.getElementById('fc-hora-fin').value  = c.horaFin   || '';
  if (c.profesor) document.getElementById('f-profesor').value = c.profesor.id;
}

function closeCursoModal() {
  document.getElementById('curso-modal-overlay')?.classList.add('hidden');
}

async function handleCursoSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-curso-submit');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Guardando...';

  const profId = document.getElementById('f-profesor').value;
  const data = {
    nombre:    document.getElementById('fc-nombre').value.trim(),
    nivel:     document.getElementById('fc-nivel').value || null,
    grado:     document.getElementById('fc-grado').value || null,
    seccion:   document.getElementById('fc-seccion').value || null,
    color:     document.getElementById('fc-color').value || null,
    icono:     document.getElementById('fc-icono').value || null,
    diaSemana: parseInt(document.getElementById('fc-dia').value) || null,
    horaInicio:document.getElementById('fc-hora-inicio').value || null,
    horaFin:   document.getElementById('fc-hora-fin').value || null,
    profesor:  profId ? { id: parseInt(profId) } : null,
  };

  try {
    if (editingCursoId) {
      await API.admin.editarCurso(editingCursoId, data);
      Toast.success('Curso actualizado');
    } else {
      await API.admin.crearCurso(data);
      Toast.success('Curso creado');
    }
    closeCursoModal();
    await loadCourses();
  } catch (e) {
    Toast.error('Error al guardar', e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-floppy-disk"></i>' + (editingCursoId ? 'Actualizar' : 'Crear curso');
  }
}

function confirmDeleteCurso(id, name) {
  showConfirm('¿Eliminar curso?', `Se eliminará "${name}" y todos sus datos.`, async () => {
    try {
      await API.admin.eliminarCurso(id);
      Toast.success('Curso eliminado');
      await loadCourses();
    } catch (e) { Toast.error('Error al eliminar', e.message); }
  });
}
