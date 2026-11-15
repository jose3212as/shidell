/* =========================================================
   SHIDELL ADMIN — ASISTENCIA JS
   ========================================================= */

let cursosList = [];
let selectedCursoId = null;
let selectedFecha = '';
let currentRoster = [];
let currentMeta = null;

const ESTADOS_ASISTENCIA = [
  { key: 'PRESENTE',    label: 'Presente', icon: 'ph-check-circle', badge: 'badge-green' },
  { key: 'TARDE',       label: 'Tarde',    icon: 'ph-clock',        badge: 'badge-yellow' },
  { key: 'AUSENTE',     label: 'Ausente',  icon: 'ph-x-circle',     badge: 'badge-red' },
  { key: 'JUSTIFICADO', label: 'Justif.',  icon: 'ph-file-text',    badge: 'badge-cyan' }
];

function getTodayLocalIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Asistencia', 'Admin / Asistencia');
  selectedFecha = getTodayLocalIso();
  const picker = document.getElementById('fecha-picker');
  if (picker) {
    picker.value = selectedFecha;
    picker.max = selectedFecha;
  }
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
      cursosList.map(c => {
        const dia = CONFIG.DIAS_SEMANA?.[c.diaSemana] ? ` · ${CONFIG.DIAS_SEMANA[c.diaSemana]}` : '';
        const hora = c.horaInicio ? ` ${c.horaInicio}` : '';
        return `<option value="${c.id}">${escapeHtml(c.nombre)} — ${escapeHtml(c.nivel || '')} ${escapeHtml(c.grado || '')}°${escapeHtml(c.seccion || '')}${c.turno ? ` (${escapeHtml(c.turno)})` : ''}${dia}${hora}</option>`;
      }).join('');
  } catch (e) {
    Toast.error('Error al cargar cursos', e?.message || '');
  }
}

function setupEvents() {
  document.getElementById('curso-select')?.addEventListener('change', e => {
    selectedCursoId = e.target.value ? parseInt(e.target.value, 10) : null;
    if (selectedCursoId) {
      loadAsistencia();
    } else {
      clearTable();
    }
  });

  document.getElementById('fecha-picker')?.addEventListener('change', e => {
    selectedFecha = e.target.value || getTodayLocalIso();
    if (selectedCursoId) {
      loadAsistencia();
    }
  });

  document.getElementById('btn-confirmar-todos')?.addEventListener('click', confirmarTodosPresentes);
}

async function loadAsistencia() {
  if (!selectedCursoId) return;
  setTableLoading(true);
  try {
    const data = await API.docente.asistencia(selectedCursoId, selectedFecha);
    currentMeta = data || {};
    currentRoster = Array.isArray(data?.estudiantes) ? data.estudiantes : [];
    renderContextBanner(currentMeta, currentRoster);
    renderAsistencia(currentMeta, currentRoster);
  } catch (e) {
    Toast.error('Error al cargar asistencia', e?.message || '');
    clearTable();
  }
}

function renderContextBanner(meta, estudiantes) {
  const banner = document.getElementById('asistencia-context-banner');
  const titleEl = document.getElementById('att-context-title');
  const descEl = document.getElementById('att-context-desc');
  const btnTodos = document.getElementById('btn-confirmar-todos');
  if (!banner || !titleEl || !descEl) return;

  const diaNombre = CONFIG.DIAS_SEMANA?.[meta.diaSemana] || 'Día según horario';
  const horario = meta.horaInicio && meta.horaFin ? `${meta.horaInicio} – ${meta.horaFin}` : 'Horario flexible';
  const grupo = [meta.nivel, meta.grado ? `${meta.grado}°` : '', meta.seccion, meta.turno ? `(${meta.turno})` : '']
    .filter(Boolean)
    .join(' ');
  const esFutura = Boolean(meta.esFechaFutura);
  const esFeriado = Boolean(meta.esFeriado);
  const guardados = estudiantes.filter(e => Boolean(e.registrado)).length;

  banner.style.display = 'flex';
  banner.classList.toggle('is-warning', esFutura || esFeriado);

  titleEl.innerHTML = `
    <span>${escapeHtml(meta.cursoNombre || 'Curso')}</span>
    ${grupo ? `<span class="badge badge-purple">${escapeHtml(grupo)}</span>` : ''}
    <span class="badge">${escapeHtml(diaNombre)} · ${escapeHtml(horario)}</span>
    <span class="badge badge-cyan">${guardados}/${estudiantes.length} guardados</span>
  `;

  if (esFutura) {
    descEl.innerHTML = 'Esta fecha aún es futura. Puedes previsualizar la nómina, pero no se permite registrar asistencia adelantada.';
  } else if (esFeriado) {
    descEl.innerHTML = `Calendario escolar marca <strong>${escapeHtml(meta.feriadoNombre || 'Feriado nacional')}</strong>. Los alumnos no tienen asistencia obligatoria hoy; si regularizas un caso administrativo se guardará manualmente.`;
  } else {
    descEl.innerHTML = 'Si no hay registro guardado para un alumno en una fecha lectiva, el sistema lo computa automáticamente como <strong>Presente (por defecto)</strong>. Como administrador puedes marcar o corregir asistencias de hoy o fechas pasadas en cualquier horario; marcar <strong>Ausente</strong> o <strong>Tarde</strong> alerta automáticamente al apoderado.';
  }

  if (btnTodos) {
    const pendientes = estudiantes.length - guardados;
    const mostrarBtn = estudiantes.length > 0 && !esFutura;
    btnTodos.style.display = mostrarBtn ? 'inline-flex' : 'none';
    btnTodos.disabled = !mostrarBtn || pendientes === 0;
    btnTodos.innerHTML = pendientes === 0
      ? '<i class="ph ph-check-circle"></i><span>Lista guardada</span>'
      : `<i class="ph ph-checks"></i><span>Confirmar ${pendientes} pendiente(s) Presente</span>`;
  }
}

function renderAsistencia(meta, estudiantes) {
  const tbody = document.getElementById('asistencia-tbody');
  if (!tbody) return;

  if (!estudiantes.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="ph ph-users"></i><h3>Sin estudiantes en este curso</h3><p>Verifica que existan alumnos matriculados en esta sección.</p></div></td></tr>`;
    resetStats();
    return;
  }

  const fechaTexto = formatDateShort(meta.fecha || selectedFecha);
  const esFutura = Boolean(meta.esFechaFutura);

  tbody.innerHTML = estudiantes.map((est, i) => {
    const estId = est.estudianteId ?? est.id;
    const estado = (est.estado || 'PRESENTE').toUpperCase();
    const registrado = Boolean(est.registrado);
    const metaEstado = ESTADOS_ASISTENCIA.find(s => s.key === estado) || ESTADOS_ASISTENCIA[0];
    const badgeCls = registrado ? metaEstado.badge : 'badge-green';
    const estadoLabel = registrado ? estado : 'PRESENTE (defecto)';

    const botones = ESTADOS_ASISTENCIA.map(s => {
      const activo = registrado && estado === s.key;
      const disabledAttr = esFutura ? 'disabled title="No disponible en fechas futuras"' : `title="Marcar ${s.key}"`;
      return `
        <button type="button"
          class="att-btn ${activo ? 'is-active' : ''}"
          data-est-id="${estId}"
          data-estado="${s.key}"
          onclick="registrarAsistencia(${estId}, '${s.key}', this)"
          ${disabledAttr}>
          <i class="ph ${s.icon}"></i>
          <span>${s.label}</span>
        </button>`;
    }).join('');

    return `
    <tr class="stagger-item" data-estudiante-id="${estId}" style="opacity:0;animation:fadeInUp 0.25s ease ${Math.min(i, 12) * 0.03}s forwards">
      <td>${i + 1}</td>
      <td>
        <div class="d-flex items-center gap-12">
          ${avatarEl({ nombres: est.nombres, apellidos: est.apellidos, email: est.email, rol: 'ESTUDIANTE' }, 'avatar-sm')}
          <div>
            <strong>${escapeHtml(est.apellidos || '')}${est.apellidos && est.nombres ? ', ' : ''}${escapeHtml(est.nombres || '')}</strong>
            <div class="text-xs text-muted">${escapeHtml(est.email || '')}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${badgeCls}">${escapeHtml(estadoLabel)}</span></td>
      <td>
        <div class="att-origin-stack">
          <span class="att-origin-pill ${registrado ? 'is-saved' : 'is-default'}">
            <i class="ph ${registrado ? 'ph-check' : 'ph-clock-countdown'}"></i>
            ${registrado ? 'Guardado en BD' : 'Por defecto'}
          </span>
          <span class="text-xs text-muted">${escapeHtml(fechaTexto)}</span>
        </div>
      </td>
      <td>
        <div class="att-actions-row">${botones}</div>
      </td>
    </tr>`;
  }).join('');

  updateAsistenciaStats(estudiantes);
}

function updateAsistenciaStats(estudiantes) {
  const counts = { PRESENTE: 0, TARDE: 0, AUSENTE: 0, JUSTIFICADO: 0, total: estudiantes.length };
  estudiantes.forEach(e => {
    const key = (e.estado || 'PRESENTE').toUpperCase();
    if (key in counts) counts[key]++;
  });
  // Tardanzas y justificaciones también cuentan como asistencia válida al igual que en ProgresoService
  const validas = counts.PRESENTE + counts.TARDE + counts.JUSTIFICADO;
  const pct = counts.total ? Math.round((validas / counts.total) * 100) : 0;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('stat-total', counts.total);
  set('stat-presente', counts.PRESENTE);
  set('stat-tarde', counts.TARDE);
  set('stat-ausente', counts.AUSENTE);
  set('stat-justificado', counts.JUSTIFICADO);
  set('stat-pct', `${pct}%`);
}

function resetStats() {
  ['stat-total', 'stat-presente', 'stat-tarde', 'stat-ausente', 'stat-justificado', 'stat-pct']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
}

async function registrarAsistencia(estudianteId, estado, triggerBtn) {
  if (!selectedCursoId || !estudianteId) return;
  const row = triggerBtn?.closest('tr');
  const rowBtns = row ? Array.from(row.querySelectorAll('.att-btn')) : [];
  rowBtns.forEach(b => { b.disabled = true; });

  try {
    await API.postForm(
      `/docente/asistencia?cursoId=${selectedCursoId}&estudianteId=${estudianteId}&estado=${encodeURIComponent(estado)}&fecha=${encodeURIComponent(selectedFecha)}`
    );
    Toast.success(`Asistencia guardada: ${estado}`);
    await loadAsistencia();
  } catch (e) {
    Toast.error('Error al registrar', e?.message || 'No se pudo guardar la asistencia');
    rowBtns.forEach(b => { b.disabled = Boolean(currentMeta?.esFechaFutura); });
  }
}

async function confirmarTodosPresentes() {
  if (!selectedCursoId || !currentRoster.length || currentMeta?.esFechaFutura) return;
  const btn = document.getElementById('btn-confirmar-todos');
  if (btn) btn.disabled = true;

  try {
    const registros = currentRoster.map(est => ({
      estudianteId: est.estudianteId ?? est.id,
      estado: est.registrado ? (est.estado || 'PRESENTE') : 'PRESENTE'
    }));
    await API.post(
      `/docente/curso/${selectedCursoId}/asistencia?fecha=${encodeURIComponent(selectedFecha)}`,
      registros
    );
    Toast.success(`Asistencia confirmada para ${registros.length} estudiantes`);
    await loadAsistencia();
  } catch (e) {
    Toast.error('Error al guardar lista', e?.message || 'No se pudo confirmar la asistencia');
  } finally {
    if (btn) btn.disabled = Boolean(currentMeta?.esFechaFutura);
  }
}

function setTableLoading(on) {
  const tbody = document.getElementById('asistencia-tbody');
  if (tbody && on) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:40px"><div class="spinner spinner-lg" style="margin:0 auto"></div></td></tr>`;
  }
}

function clearTable() {
  currentRoster = [];
  currentMeta = null;
  const banner = document.getElementById('asistencia-context-banner');
  if (banner) banner.style.display = 'none';
  const btnTodos = document.getElementById('btn-confirmar-todos');
  if (btnTodos) btnTodos.style.display = 'none';
  resetStats();
  const tbody = document.getElementById('asistencia-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="ph ph-calendar-check"></i><h3>Selecciona un curso y fecha</h3><p>Los estudiantes sin marca en una fecha lectiva figuran como <strong>Presente por defecto</strong>.</p></div></td></tr>`;
  }
}
