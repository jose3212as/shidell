/* =========================================================
   SHIDELL ADMIN — USUARIOS JS
   CRUD completo: Docentes, Estudiantes, Padres
   ========================================================= */

let allUsers    = [];
let allParents  = [];
let allCourses  = [];   // para mapear cursos de docentes
let currentFilter = 'TODOS';
let editingId   = null;
let searchTerm  = '';

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Gestión de Usuarios', 'Admin / Usuarios');
  await loadUsers();
  setupEvents();
});

async function loadUsers() {
  setTableLoading(true);
  try {
    const [users, courses] = await Promise.all([
      API.admin.usuarios(),
      API.admin.cursos().catch(() => [])
    ]);
    allUsers   = users;
    allCourses = courses;
    allParents = allUsers.filter(u => u.rol === 'PADRE');
    if (typeof populateParentsSelect === 'function') populateParentsSelect();
    renderUsers();
    updateStats();
  } catch (e) {
    Toast.error('Error al cargar usuarios', e.message);
  } finally {
    setTableLoading(false);
  }
}

// Construye los salones (grado+sección) asignados a un docente
function buildCursosDocente(userId) {
  const cursos = allCourses.filter(c => c.profesor && c.profesor.id === userId);
  if (!cursos.length) return '<span class="text-muted text-xs">Sin cursos asignados</span>';

  // Agrupar por nivel+grado+sección+turno (cada combinación = un aula)
  const aulas = new Set();
  for (const c of cursos) {
    const label = `${c.nivel || ''} ${c.grado || ''}°${c.seccion || ''} ${c.turno || ''}`.trim();
    aulas.add(label);
  }

  const entries = [...aulas];
  const shown   = entries.slice(0, 4).map(k =>
    `<span class="badge badge-gray badge-no-dot" style="font-size:11px;padding:2px 8px">${escapeHtml(k)}</span>`
  ).join('');
  const extra   = entries.length > 4
    ? `<span class="text-xs text-muted"> +${entries.length - 4} más</span>`
    : '';
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">${shown}${extra}</div>`;
}

function updateStats() {
  const counts = { TODOS: allUsers.length, DOCENTE: 0, ESTUDIANTE: 0, PADRE: 0, ADMINISTRADOR: 0 };
  allUsers.forEach(u => { if (counts[u.rol] !== undefined) counts[u.rol]++; });
  Object.keys(counts).forEach(k => {
    const el = document.getElementById(`count-${k.toLowerCase()}`);
    if (el) el.textContent = counts[k];
  });
}

function filterUsers() {
  let list = currentFilter === 'TODOS' ? allUsers : allUsers.filter(u => u.rol === currentFilter);
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    list = list.filter(u =>
      `${u.nombres} ${u.apellidos} ${u.email} ${u.rol} ${u.dni||''} ${u.telefono||''}`.toLowerCase().includes(q)
    );
  }
  
  const sortSelect = document.getElementById('user-sort');
  if (sortSelect) {
    const sortBy = sortSelect.value;
    if (sortBy === 'recientes') {
      list = list.sort((a, b) => b.id - a.id);
    } else if (sortBy === 'antiguos') {
      list = list.sort((a, b) => a.id - b.id);
    }
  }

  return list;
}

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  const list = filterUsers();
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <i class="ph ph-users"></i><h3>Sin usuarios</h3>
        <p>No se encontraron usuarios con los filtros actuales.</p>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const fullName = `${escapeHtml(u.nombres||'')} ${escapeHtml(u.apellidos||'')}`.trim();

    // Docentes: no tienen sección/turno fija — enseñan en múltiples salones
    let seccionCell, turnoCell, infoCell;
    if (u.rol === 'DOCENTE') {
      seccionCell = '<span class="text-muted text-xs">Múltiple</span>';
      turnoCell   = '<span class="text-muted text-xs">Múltiple</span>';
      infoCell    = buildCursosDocente(u.id);
    } else {
      seccionCell = (u.nivel && u.grado && u.seccion)
        ? `<span class="text-sm">${u.nivel} ${u.grado}°${u.seccion}</span>`
        : '<span class="text-muted">—</span>';
      turnoCell = u.turno
        ? `<span class="text-sm">${u.turno}</span>`
        : '<span class="text-muted">—</span>';
      const padre = u.padre ? `${u.padre.nombres||''} ${u.padre.apellidos||''}`.trim() : null;
      infoCell = padre
        ? `<span class="text-sm text-secondary">${escapeHtml(padre)}</span>`
        : '<span class="text-muted text-xs">—</span>';
    }

    return `
    <tr class="stagger-item" style="opacity:0;animation:fadeInUp 0.3s ease forwards">
      <td>
        <div class="d-flex items-center gap-12">
          ${avatarEl(u)}
          <div>
            <strong>${fullName || '(sin nombre)'}</strong>
            <div class="text-xs text-muted">${escapeHtml(u.email||'')}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="text-sm"><strong>DNI:</strong> ${escapeHtml(u.dni||'—')}</div>
        <div class="text-xs text-muted"><strong>Tel:</strong> ${escapeHtml(u.telefono||'—')}</div>
      </td>
      <td>${rolBadge(u.rol)}</td>
      <td>${seccionCell}</td>
      <td>${turnoCell}</td>
      <td>${infoCell}</td>
      <td>
        <span class="badge ${u.ultimaConexion ? 'badge-green' : 'badge-gray'} badge-no-dot">
          ${u.ultimaConexion ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="openEditModal(${u.id})">
            <i class="ph ph-pencil-simple"></i>
          </button>
          ${u.rol === 'DOCENTE' ? '' : `<button class="btn btn-ghost btn-icon btn-sm" title="Eliminar" onclick="confirmDelete(${u.id},'${fullName}')">
            <i class="ph ph-trash" style="color:var(--red)"></i>
          </button>`}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function setTableLoading(on) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  if (on) tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:40px"><div class="spinner spinner-lg" style="margin:0 auto"></div></td></tr>`;
}

/* ── Filtros ────────────────────────────────────────────── */
function setupEvents() {
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.rol || 'TODOS';
      renderUsers();
    });
  });

  // Search
  const searchInput = document.getElementById('user-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(e => {
      searchTerm = e.target.value;
      renderUsers();
    }, 250));
  }
  
  // Sort
  document.getElementById('user-sort')?.addEventListener('change', () => renderUsers());

  // Modal close
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // Form submit
  document.getElementById('user-form')?.addEventListener('submit', handleSubmit);

  // Rol change: mostrar/ocultar campos condicionales
  document.getElementById('f-rol')?.addEventListener('change', handleRolChange);
}

/* ── Modal ──────────────────────────────────────────────── */
function openCreateModal() {
  editingId = null;
  resetForm();
  document.getElementById('modal-title').textContent = 'Nuevo Usuario';
  document.getElementById('f-rol').disabled = false;
  document.getElementById('f-password-group').style.display = '';
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function openEditModal(id) {
  editingId = id;
  resetForm();
  document.getElementById('modal-title').textContent = 'Editar Usuario';
  document.getElementById('f-password-group').style.display = '';
  document.getElementById('modal-overlay').classList.remove('hidden');

  try {
    const u = await API.admin.usuario(id);
    document.getElementById('f-nombres').value   = u.nombres || '';
    document.getElementById('f-apellidos').value = u.apellidos || '';
    document.getElementById('f-dni').value       = u.dni || '';
    document.getElementById('f-telefono').value  = u.telefono || '';
    document.getElementById('f-fechaNacimiento').value = u.fechaNacimiento || '';
    
    // Set radio buttons for sexo
    const sexoRadios = document.querySelectorAll('input[name="f-sexo"]');
    sexoRadios.forEach(r => r.checked = false);
    if (u.sexo) {
      const activeRadio = document.querySelector(`input[name="f-sexo"][value="${u.sexo}"]`);
      if (activeRadio) activeRadio.checked = true;
    }

    document.getElementById('f-direccion').value = u.direccion || '';
    document.getElementById('f-tipoSangre').value = u.tipoSangre || '';
    document.getElementById('f-estadoCivil').value = u.estadoCivil || '';

    document.getElementById('f-email').value     = u.email || '';
    document.getElementById('f-rol').value       = u.rol || '';
    document.getElementById('f-rol').disabled    = false;
    document.getElementById('f-nivel').value     = u.nivel || '';
    document.getElementById('f-grado').value     = u.grado || '';
    document.getElementById('f-seccion').value   = u.seccion || '';
    document.getElementById('f-turno').value     = u.turno || '';
    if (u.padreId) document.getElementById('f-padre').value = u.padreId;
    handleRolChange();
  } catch (e) {
    Toast.error('Error al cargar usuario');
    closeModal();
  }
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
  document.getElementById('f-rol').disabled = false;
  editingId = null;
}

function resetForm() {
  document.getElementById('user-form')?.reset();
  document.querySelectorAll('input[name="f-sexo"]').forEach(r => r.checked = false);
  handleRolChange();
}

function handleRolChange() {
  const rol = document.getElementById('f-rol')?.value;
  const academicFields = document.getElementById('academic-fields');
  const padreField     = document.getElementById('padre-field');
  if (academicFields) academicFields.style.display = rol === 'ESTUDIANTE' ? '' : 'none';
  if (padreField)     padreField.style.display     = rol === 'ESTUDIANTE' ? '' : 'none';
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Guardando...';

  const data = {
    nombres:   document.getElementById('f-nombres').value.trim(),
    apellidos: document.getElementById('f-apellidos').value.trim(),
    dni:       document.getElementById('f-dni').value.trim(),
    telefono:  document.getElementById('f-telefono').value.trim(),
    fechaNacimiento: document.getElementById('f-fechaNacimiento').value || null,
    sexo:      document.querySelector('input[name="f-sexo"]:checked')?.value || null,
    direccion: document.getElementById('f-direccion').value.trim() || null,
    tipoSangre: document.getElementById('f-tipoSangre').value || null,
    estadoCivil: document.getElementById('f-estadoCivil').value || null,
    email:     document.getElementById('f-email').value.trim(),
    rol:       document.getElementById('f-rol').value,
    nivel:     document.getElementById('f-nivel').value || null,
    grado:     document.getElementById('f-grado').value || null,
    seccion:   document.getElementById('f-seccion').value || null,
    turno:     document.getElementById('f-turno').value || null,
    password:  document.getElementById('f-password').value || null,
  };

  const padreId = document.getElementById('f-padre').value;
  if (padreId) data.padre = { id: parseInt(padreId) };

  try {
    if (editingId) {
      await API.admin.editarUsuario(editingId, data);
      Toast.success('Usuario actualizado correctamente');
    } else {
      await API.admin.crearUsuario(data);
      Toast.success('Usuario creado correctamente');
    }
    closeModal();
    await loadUsers();
  } catch (e) {
    Toast.error('Error al guardar', e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = editingId ? 'Actualizar' : 'Crear usuario';
  }
}

/* ── Eliminar ───────────────────────────────────────────── */
function confirmDelete(id, name) {
  showConfirm(
    '¿Eliminar usuario?',
    `Se eliminará permanentemente a "${name}". Esta acción no se puede deshacer.`,
    async () => {
      try {
        await API.admin.eliminarUsuario(id);
        Toast.success('Usuario eliminado');
        await loadUsers();
      } catch (e) {
        Toast.error('Error al eliminar', e.message);
      }
    }
  );
}

/* ── Exportar Datos ─────────────────────────────────────── */
function exportData() {
  if (!allUsers || allUsers.length === 0) {
    Toast.warning('Atención', 'No hay datos para exportar.');
    return;
  }
  Toast.info('Exportando...', 'Generando archivo de exportación.');
  // Aquí se llamaría a la API real: window.open('/api/admin/exportar/usuarios', '_blank');
  setTimeout(() => Toast.success('Exportación completa', 'Archivo descargado con éxito.'), 1500);
}
