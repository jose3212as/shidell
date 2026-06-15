/* =========================================================
   SHIDELL ADMIN — USUARIOS JS
   CRUD completo: Docentes, Estudiantes, Padres
   ========================================================= */

let allUsers = [];
let allParents = [];
let currentFilter = 'TODOS';
let editingId = null;
let searchTerm = '';

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Gestión de Usuarios', 'Admin / Usuarios');
  await loadUsers();
  setupEvents();
});

async function loadUsers() {
  setTableLoading(true);
  try {
    allUsers  = await API.admin.usuarios();
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
      `${u.nombres} ${u.apellidos} ${u.email} ${u.rol}`.toLowerCase().includes(q)
    );
  }
  return list;
}

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  const list = filterUsers();
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <i class="ph ph-users"></i><h3>Sin usuarios</h3>
        <p>No se encontraron usuarios con los filtros actuales.</p>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const fullName = `${escapeHtml(u.nombres||'')} ${escapeHtml(u.apellidos||'')}`.trim();
    const seccion = (u.nivel && u.grado && u.seccion) ? `${u.nivel} ${u.grado}°${u.seccion}` : '—';
    const turno = u.turno || '—';
    const padre = u.padre ? `${u.padre.nombres||''} ${u.padre.apellidos||''}`.trim() : null;
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
      <td>${rolBadge(u.rol)}</td>
      <td><span class="text-sm">${seccion}</span></td>
      <td><span class="text-sm">${turno}</span></td>
      <td>${padre ? `<span class="text-sm text-secondary">${escapeHtml(padre)}</span>` : '<span class="text-muted text-xs">—</span>'}</td>
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
          <button class="btn btn-ghost btn-icon btn-sm" title="Eliminar" onclick="confirmDelete(${u.id},'${fullName}')">
            <i class="ph ph-trash" style="color:var(--red)"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function setTableLoading(on) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  if (on) tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:40px"><div class="spinner spinner-lg" style="margin:0 auto"></div></td></tr>`;
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
    document.getElementById('f-email').value     = u.email || '';
    document.getElementById('f-rol').value       = u.rol || '';
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
  editingId = null;
}

function resetForm() {
  document.getElementById('user-form')?.reset();
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
