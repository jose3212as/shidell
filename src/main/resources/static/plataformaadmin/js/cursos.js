/* =========================================================
   SHIDELL ADMIN — CURSOS JS  (lógica por aula, no por sesión)
   ========================================================= */

let allCourses = [], allDocentes = [], editingCursoId = null;
let filterNivel = '', filterGrado = '', filterTurno = '', filterSeccion = '', searchCurso = '';

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Gestión de Cursos', 'Admin / Cursos');
  await Promise.all([loadDocentes(), loadCourses()]);
  setupCursoEvents();
});

/* ── Carga ─────────────────────────────────────────────── */
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
    renderAulas();
    updateCursoStats();
  } catch (e) { Toast.error('Error al cargar cursos', e.message); }
  finally { setLoading(false); }
}

/* ── Stats ─────────────────────────────────────────────── */
function updateCursoStats() {
  const aulas = buildAulas(allCourses);
  const el = document.getElementById('total-cursos');
  if (el) el.textContent = aulas.length;
  const manEl = document.getElementById('aulas-manana');
  if (manEl) manEl.textContent = aulas.filter(a => a.turno === 'MAÑANA').length;
  const tarEl = document.getElementById('cursos-con-docente');
  if (tarEl) tarEl.textContent = aulas.filter(a => a.turno === 'TARDE').length;
}

/* ── Agrupar por aula ──────────────────────────────────── */
function buildAulas(courses) {
  const map = new Map();
  for (const c of courses) {
    const key = `${c.nivel}|${c.grado}|${c.seccion}|${c.turno}`;
    if (!map.has(key)) map.set(key, { nivel: c.nivel, grado: c.grado, seccion: c.seccion, turno: c.turno, courses: [] });
    map.get(key).courses.push(c);
  }

  return [...map.values()].map(aula => {
    // Materias únicas (una por nombre)
    const materiasMap = new Map();
    for (const c of aula.courses) {
      if (!materiasMap.has(c.nombre)) materiasMap.set(c.nombre, c);
    }
    const materias = [...materiasMap.values()];

    // Docentes únicos asignados a este aula
    const docentesMap = new Map();
    for (const m of materias) {
      if (m.profesor) docentesMap.set(m.profesor.id, m.profesor);
    }

    // Profesor de Aula (primaria): el que dicta Comunicación o Matemática
    const profesorAula = aula.nivel === 'PRIMARIA'
      ? materias.find(m => m.nombre === 'Comunicación' && m.profesor)?.profesor
      : null;

    return {
      ...aula,
      materias,
      docentes: [...docentesMap.values()],
      profesorAula,
      sesiones: aula.courses.length
    };
  }).sort((a, b) => {
    const n = { PRIMARIA: 1, SECUNDARIA: 2 };
    return (n[a.nivel]||9)-(n[b.nivel]||9) || +a.grado - +b.grado
        || a.seccion.localeCompare(b.seccion) || a.turno.localeCompare(b.turno);
  });
}

/* ── Render ────────────────────────────────────────────── */
function renderAulas() {
  const grid = document.getElementById('cursos-grid');
  if (!grid) return;

  let aulas = buildAulas(allCourses);

  // Filtros
  if (filterNivel)   aulas = aulas.filter(a => a.nivel    === filterNivel);
  if (filterGrado)   aulas = aulas.filter(a => a.grado    == filterGrado);
  if (filterSeccion) aulas = aulas.filter(a => a.seccion  === filterSeccion);
  if (searchCurso) {
    const q = searchCurso.toLowerCase();
    aulas = aulas.filter(a =>
      `${a.nivel} ${a.grado} ${a.seccion} ${a.turno} ${a.docentes.map(d=>d.nombres+' '+d.apellidos).join(' ')}`.toLowerCase().includes(q)
    );
  }

  if (!aulas.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="ph ph-chalkboard"></i><h3>Sin aulas</h3>
      <p>No se encontraron aulas con los filtros seleccionados.</p>
    </div>`;
    return;
  }

  const NIVEL_CONF = {
    PRIMARIA:   { color:'#3b82f6', label:'Primaria',   icon:'ph-sun',  turnoLabel:'Mañana', grad:'linear-gradient(135deg,#3b82f615,#6366f110)' },
    SECUNDARIA: { color:'#8b5cf6', label:'Secundaria', icon:'ph-moon', turnoLabel:'Tarde',  grad:'linear-gradient(135deg,#8b5cf615,#ec489910)' },
  };

  grid.innerHTML = aulas.map((a, i) => {
    const conf = NIVEL_CONF[a.nivel] || NIVEL_CONF.PRIMARIA;
    const c    = conf.color;

    // Materias pills
    const matNames  = a.materias.map(m => m.nombre);
    const pillHtml  = matNames.slice(0, 6).map(n => `<span class="materia-pill">${escapeHtml(n)}</span>`).join('');
    const extraHtml = matNames.length > 6
      ? `<span class="materia-pill" style="color:var(--text-tertiary)">+${matNames.length-6} más</span>` : '';

    // Docente block
    let docenteHtml;
    if (a.nivel === 'PRIMARIA' && a.profesorAula) {
      const d = a.profesorAula;
      const ini = ((d.nombres||'?')[0]||'?').toUpperCase();
      const extra = a.docentes.filter(d2 => d2.id !== d.id).length;
      docenteHtml = `
        <div class="docente-row">
          <div class="docente-avatar" style="background:${c}22;color:${c}">${ini}</div>
          <div>
            <div class="docente-name">${escapeHtml(d.nombres||'')} ${escapeHtml(d.apellidos||'')}</div>
            <div class="docente-role">Profesor de Aula${extra ? ` · +${extra} especialista(s)` : ''}</div>
          </div>
        </div>`;
    } else if (a.docentes.length) {
      docenteHtml = a.docentes.slice(0, 3).map(d => {
        const ini = ((d.nombres||'?')[0]||'?').toUpperCase();
        return `<div class="docente-row" style="margin-bottom:4px">
          <div class="docente-avatar" style="background:${c}22;color:${c}">${ini}</div>
          <div><div class="docente-name">${escapeHtml(d.nombres||'')} ${escapeHtml(d.apellidos||'')}</div></div>
        </div>`;
      }).join('') + (a.docentes.length > 3
        ? `<div class="text-xs text-muted" style="padding-left:4px"><i class="ph ph-plus-circle"></i> ${a.docentes.length-3} más</div>` : '');
    } else {
      docenteHtml = `<div class="docente-row" style="opacity:.55">
        <div class="docente-avatar" style="background:var(--bg-secondary);color:var(--text-tertiary)"><i class="ph ph-user"></i></div>
        <div class="docente-name" style="color:var(--text-tertiary)">Sin docente asignado</div>
      </div>`;
    }

    return `
    <div class="aula-card" style="animation:fadeInUp 0.35s ease ${i*0.035}s both">
      <div class="aula-card-header" style="background:${conf.grad}">
        <div style="flex:1">
          <div class="aula-badge-nivel" style="background:${c}18;color:${c}">
            <i class="ph ${conf.icon}"></i> ${conf.label}
          </div>
          <div class="aula-title">${a.grado}° <span style="color:${c}">${a.seccion}</span></div>
          <div class="aula-meta">
            <span class="aula-meta-tag"><i class="ph ph-clock"></i> ${conf.turnoLabel}</span>
            <span class="aula-meta-tag"><i class="ph ph-books"></i> ${a.materias.length} materias</span>
            <span class="aula-meta-tag"><i class="ph ph-calendar"></i> ${a.sesiones} ses/sem</span>
          </div>
        </div>
        <button class="aula-detail-btn" title="Ver horario"
                onclick="openAulaDetail('${a.nivel}','${a.grado}','${a.seccion}','${a.turno}')">
          <i class="ph ph-calendar-blank"></i>
        </button>
      </div>
      <div class="aula-card-body">
        <div>
          <div class="aula-section-label">Materias</div>
          <div class="materias-wrap">${pillHtml}${extraHtml}</div>
        </div>
        <div>
          <div class="aula-section-label">${a.nivel === 'PRIMARIA' ? 'Profesor de Aula' : 'Docentes'}</div>
          ${docenteHtml}
        </div>
      </div>
    </div>`;
  }).join('');
}


/* ── Detalle del aula (modal con tabla de materias) ─────── */
function openAulaDetail(nivel, grado, seccion, turno) {
  const aulas = buildAulas(allCourses);
  const aula  = aulas.find(a => a.nivel===nivel && a.grado===grado && a.seccion===seccion && a.turno===turno);
  if (!aula) return;

  const nivelLabel = nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria';
  const turnoLabel  = turno === 'MAÑANA' ? 'Mañana' : 'Tarde';
  const DIAS = { 1:'Lunes', 2:'Martes', 3:'Miércoles', 4:'Jueves', 5:'Viernes' };

  // Sort sessions by dia + hora
  const sesiones = [...aula.courses].sort((a,b) =>
    (a.diaSemana||0)-(b.diaSemana||0) || (a.horaInicio||'').localeCompare(b.horaInicio||'')
  );

  const tableRows = sesiones.map(c => {
    const prof = c.profesor ? `${c.profesor.nombres||''} ${c.profesor.apellidos||''}`.trim() : '—';
    return `<tr>
      <td><span class="badge badge-gray badge-no-dot">${DIAS[c.diaSemana]||'—'}</span></td>
      <td class="text-sm">${c.horaInicio||'—'} – ${c.horaFin||'—'}</td>
      <td><strong class="text-sm">${escapeHtml(c.nombre||'')}</strong></td>
      <td class="text-sm text-secondary">${escapeHtml(prof)}</td>
      <td>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditCurso(${c.id})" title="Editar">
          <i class="ph ph-pencil-simple"></i>
        </button>
      </td>
    </tr>`;
  }).join('');

  // Inject into detail modal
  document.getElementById('detail-modal-title').textContent = `${nivelLabel} ${grado}°${seccion} — ${turnoLabel}`;
  document.getElementById('detail-table-body').innerHTML = tableRows;
  document.getElementById('aula-detail-modal').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('aula-detail-modal').classList.add('hidden');
}

/* ── Loading skeleton ──────────────────────────────────── */
function setLoading(on) {
  const grid = document.getElementById('cursos-grid');
  if (grid && on) grid.innerHTML = Array(6).fill(0).map(() =>
    `<div class="curso-card"><div class="skeleton" style="height:90px"></div>
     <div class="modal-body"><div class="skeleton skeleton-title"></div>
     <div class="skeleton skeleton-text"></div></div></div>`
  ).join('');
}

/* ── Eventos ─────────────────────────────────────────────── */
function setupCursoEvents() {
  // Search
  document.getElementById('curso-search')?.addEventListener('input', debounce(e => {
    searchCurso = e.target.value; renderAulas();
  }, 250));

  // Chip filters (nivel)
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterNivel = btn.dataset.filter || '';
      renderAulas();
    });
  });

  // Grado + sección dropdowns
  document.getElementById('filter-grado')?.addEventListener('change', e => { filterGrado = e.target.value; renderAulas(); });
  document.getElementById('filter-seccion')?.addEventListener('change', e => { filterSeccion = e.target.value; renderAulas(); });

  // Modal close on backdrop click
  document.getElementById('curso-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'curso-modal-overlay') closeCursoModal();
  });
  document.getElementById('aula-detail-modal')?.addEventListener('click', e => {
    if (e.target.id === 'aula-detail-modal') closeDetailModal();
  });

  // Form submit
  document.getElementById('curso-form')?.addEventListener('submit', handleCursoSubmit);

  // Enforce Nivel -> Turno logic
  document.getElementById('fc-nivel')?.addEventListener('change', e => {
    const nivel = e.target.value;
    const turnoSelect = document.getElementById('fc-turno');
    if (!turnoSelect) return;
    
    if (nivel === 'PRIMARIA') {
      turnoSelect.value = 'MAÑANA';
      turnoSelect.disabled = true;
    } else if (nivel === 'SECUNDARIA') {
      turnoSelect.value = 'TARDE';
      turnoSelect.disabled = true;
    } else {
      turnoSelect.disabled = false;
    }
  });
}

/* ── Modal editar sesión ────────────────────────────────── */
async function openEditCurso(id) {
  editingCursoId = id;
  document.getElementById('curso-form')?.reset();
  document.getElementById('curso-modal-title').textContent = 'Editar Sesión';
  document.getElementById('curso-modal-overlay').classList.remove('hidden');
  const c = allCourses.find(x => x.id === id);
  if (!c) return;
  document.getElementById('fc-nombre').value      = c.nombre    || '';
  document.getElementById('fc-nivel').value       = c.nivel     || '';
  document.getElementById('fc-grado').value       = c.grado     || '';
  document.getElementById('fc-seccion').value     = c.seccion   || '';
  
  const turnoEl = document.getElementById('fc-turno');
  if (turnoEl) {
    turnoEl.value = c.turno || '';
    // Apply logic instantly for the modal
    if (c.nivel === 'PRIMARIA') {
      turnoEl.value = 'MAÑANA';
      turnoEl.disabled = true;
    } else if (c.nivel === 'SECUNDARIA') {
      turnoEl.value = 'TARDE';
      turnoEl.disabled = true;
    } else {
      turnoEl.disabled = false;
    }
  }
  document.getElementById('fc-color').value       = c.color     || '';
  document.getElementById('fc-icono').value       = c.icono     || '';
  document.getElementById('fc-dia').value         = c.diaSemana || '';
  document.getElementById('fc-hora-inicio').value = c.horaInicio|| '';
  document.getElementById('fc-hora-fin').value    = c.horaFin   || '';
  if (c.profesor) document.getElementById('f-profesor').value = c.profesor.id;
}

function closeCursoModal() {
  document.getElementById('curso-modal-overlay').classList.add('hidden');
  editingCursoId = null;
}

async function handleCursoSubmit(e) {
  e.preventDefault();
  if (!editingCursoId) return;
  const btn = document.getElementById('btn-curso-submit');
  btn.disabled = true;

  const profesorId = document.getElementById('f-profesor').value;
  const data = {
    nombre:     document.getElementById('fc-nombre').value,
    nivel:      document.getElementById('fc-nivel').value,
    grado:      document.getElementById('fc-grado').value,
    seccion:    document.getElementById('fc-seccion').value,
    // Leer el turno de la UI, pero si está disabled, usar la lógica para estar seguros
    turno:      document.getElementById('fc-nivel').value === 'PRIMARIA' ? 'MAÑANA' : 
                document.getElementById('fc-nivel').value === 'SECUNDARIA' ? 'TARDE' :
                document.getElementById('fc-turno').value,
    color:      document.getElementById('fc-color').value,
    icono:      document.getElementById('fc-icono').value,
    diaSemana:  parseInt(document.getElementById('fc-dia').value) || null,
    horaInicio: document.getElementById('fc-hora-inicio').value,
    horaFin:    document.getElementById('fc-hora-fin').value,
    profesor:   profesorId ? { id: parseInt(profesorId) } : null,
  };

  try {
    await API.admin.editarCurso(editingCursoId, data);
    Toast.success('Sesión actualizada');
    closeCursoModal();
    await loadCourses();
  } catch (ex) {
    Toast.error('Error al guardar', ex.message);
  } finally {
    btn.disabled = false;
  }
}
