/* =========================================================
   SHIDELL ADMIN — REPORTES JS
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {
  initShared('Reportes', 'Admin / Reportes y Analytics');
  await loadReporteGeneral();
});

async function loadReporteGeneral() {
  try {
    const [stats, usuarios, cursos] = await Promise.all([
      API.admin.stats(),
      API.admin.usuarios(),
      API.admin.cursos(),
    ]);

    // KPIs
    const el = id => document.getElementById(id);
    if (el('r-usuarios'))    el('r-usuarios').textContent    = stats.totalUsuarios || 0;
    if (el('r-estudiantes')) el('r-estudiantes').textContent = stats.totalEstudiantes || 0;
    if (el('r-docentes'))    el('r-docentes').textContent    = stats.totalDocentes || 0;
    if (el('r-cursos'))      el('r-cursos').textContent      = stats.totalCursos || 0;

    // Distribución por rol
    renderDistribucionRol(usuarios);
    // Distribución por nivel/grado
    renderDistribucionGrado(usuarios.filter(u => u.rol === 'ESTUDIANTE'));
    // Tabla de docentes
    renderDocentesCursos(usuarios.filter(u => u.rol === 'DOCENTE'), cursos);

    // Guardar para exportar
    window._reporteData = { usuarios, cursos, stats };
  } catch (e) {
    Toast.error('Error al cargar reporte', e.message);
  }
}

function renderDistribucionRol(usuarios) {
  const roles = { ADMINISTRADOR:0, DOCENTE:0, ESTUDIANTE:0, PADRE:0 };
  usuarios.forEach(u => { if (roles[u.rol] !== undefined) roles[u.rol]++; });
  const total = usuarios.length || 1;
  const colors = { ADMINISTRADOR:'var(--primary)', DOCENTE:'var(--purple)', ESTUDIANTE:'var(--cyan)', PADRE:'var(--green)' };

  const el = document.getElementById('dist-rol');
  if (!el) return;
  el.innerHTML = Object.entries(roles).map(([rol, count]) => {
    const pct = Math.round(count / total * 100);
    return `
    <div class="stat-row">
      <div class="d-flex items-center gap-10">
        <div style="width:10px;height:10px;border-radius:50%;background:${colors[rol]};flex-shrink:0"></div>
        <span class="text-sm">${CONFIG.ROLE_LABELS[rol]||rol}</span>
      </div>
      <div class="d-flex items-center gap-12">
        <div class="progress-bar" style="width:100px">
          <div class="progress-fill" style="width:${pct}%;background:${colors[rol]}"></div>
        </div>
        <strong style="min-width:28px;text-align:right">${count}</strong>
        <span class="text-xs text-muted">(${pct}%)</span>
      </div>
    </div>`;
  }).join('');
}

function renderDistribucionGrado(estudiantes) {
  const grupos = {};
  estudiantes.forEach(e => {
    const key = e.nivel && e.grado && e.seccion ? `${e.nivel} ${e.grado}°${e.seccion}` : 'Sin sección';
    grupos[key] = (grupos[key] || 0) + 1;
  });

  const el = document.getElementById('dist-grado');
  if (!el) return;
  const entries = Object.entries(grupos).sort((a,b) => b[1]-a[1]);
  if (!entries.length) {
    el.innerHTML = '<div class="empty-state" style="padding:20px"><p>Sin estudiantes con sección asignada</p></div>';
    return;
  }
  const max = Math.max(...entries.map(e=>e[1]));
  el.innerHTML = entries.map(([key, count]) => {
    const pct = Math.round(count / max * 100);
    return `
    <div class="stat-row">
      <span class="text-sm" style="min-width:160px">${key}</span>
      <div class="d-flex items-center gap-12" style="flex:1">
        <div class="progress-bar" style="flex:1">
          <div class="progress-fill" style="width:${pct}%;background:var(--cyan)"></div>
        </div>
        <strong>${count}</strong>
      </div>
    </div>`;
  }).join('');
}

function renderDocentesCursos(docentes, cursos) {
  const tbody = document.getElementById('docentes-tbody');
  if (!tbody) return;
  if (!docentes.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="ph ph-chalkboard-teacher"></i><h3>Sin docentes</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = docentes.map(d => {
    const misCursos = cursos.filter(c => c.profesor?.id === d.id);
    return `
    <tr>
      <td>
        <div class="d-flex items-center gap-12">
          ${avatarEl(d)}
          <div>
            <strong>${escapeHtml(d.nombres||'')} ${escapeHtml(d.apellidos||'')}</strong>
            <div class="text-xs text-muted">${escapeHtml(d.email||'')}</div>
          </div>
        </div>
      </td>
      <td><strong>${misCursos.length}</strong></td>
      <td>
        <div class="d-flex gap-4 flex-wrap">
          ${misCursos.slice(0,3).map(c => `<span class="badge badge-gray badge-no-dot">${escapeHtml(c.nombre)}</span>`).join('')}
          ${misCursos.length > 3 ? `<span class="badge badge-gray badge-no-dot">+${misCursos.length-3}</span>` : ''}
        </div>
      </td>
      <td><span class="badge ${misCursos.length ? 'badge-green' : 'badge-gray'}">${misCursos.length ? 'Activo' : 'Sin cursos'}</span></td>
    </tr>`;
  }).join('');
}

function exportarCSV() {
  const data = window._reporteData;
  if (!data) return;
  const rows = [['ID','Nombres','Apellidos','Email','Rol','Nivel','Grado','Sección']];
  data.usuarios.forEach(u => rows.push([u.id, u.nombres, u.apellidos, u.email, u.rol, u.nivel||'', u.grado||'', u.seccion||'']));
  const csv = rows.map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
  a.download = `shidell_usuarios_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  Toast.success('Exportado correctamente', 'Archivo CSV descargado');
}
