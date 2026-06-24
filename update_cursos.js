const fs = require('fs');
const fileHtml = 'c:/Users/carlo/Desktop/proyectoshidel/shidell/src/main/resources/static/plataformaadmin/html/cursos.html';
const fileJs = 'c:/Users/carlo/Desktop/proyectoshidel/shidell/src/main/resources/static/plataformaadmin/js/cursos.js';

let html = fs.readFileSync(fileHtml, 'utf8');

const targetHtml = `      <!-- Toolbar -->
      <div class="toolbar mb-20">
        <div class="toolbar-search">
          <i class="ph ph-magnifying-glass"></i>
          <input type="text" placeholder="Buscar curso, sección, turno o docente..." id="curso-search">
        </div>
      </div>`;

const replaceHtml = `      <!-- Toolbar -->
      <div class="toolbar mb-20" style="display:flex; gap:12px; flex-wrap:wrap;">
        <div class="toolbar-search" style="flex:1; min-width:250px;">
          <i class="ph ph-magnifying-glass"></i>
          <input type="text" placeholder="Buscar curso, sección, turno o docente..." id="curso-search">
        </div>
        <select id="filter-nivel" class="form-control form-select" style="width:150px; padding:8px 12px; border-radius:12px; border:1px solid var(--border-color); font-size:14px; outline:none;">
          <option value="">Nivel (Todos)</option>
          <option value="PRIMARIA">Primaria</option>
          <option value="SECUNDARIA">Secundaria</option>
        </select>
        <select id="filter-grado" class="form-control form-select" style="width:150px; padding:8px 12px; border-radius:12px; border:1px solid var(--border-color); font-size:14px; outline:none;">
          <option value="">Grado (Todos)</option>
          <option value="1">1°</option><option value="2">2°</option>
          <option value="3">3°</option><option value="4">4°</option>
          <option value="5">5°</option><option value="6">6°</option>
        </select>
        <select id="filter-turno" class="form-control form-select" style="width:150px; padding:8px 12px; border-radius:12px; border:1px solid var(--border-color); font-size:14px; outline:none;">
          <option value="">Turno (Todos)</option>
          <option value="MAÑANA">Mañana</option>
          <option value="TARDE">Tarde</option>
        </select>
      </div>`;

if(html.includes(targetHtml)) {
    html = html.replace(targetHtml, replaceHtml);
    fs.writeFileSync(fileHtml, html);
    console.log("HTML replaced successfully");
} else {
    // try to split by \r\n and \n differences just in case
    html = html.replace(targetHtml.replace(/\n/g, '\r\n'), replaceHtml.replace(/\n/g, '\r\n'));
    fs.writeFileSync(fileHtml, html);
    console.log("HTML replaced successfully with CRLF");
}

let js = fs.readFileSync(fileJs, 'utf8');

// Replace the top variables
const targetVars = `let allCourses = [], allDocentes = [], editingCursoId = null, searchCurso = '';`;
const replaceVars = `let allCourses = [], allDocentes = [], editingCursoId = null, searchCurso = '';
let filterNivel = '', filterGrado = '', filterTurno = '';`;

if (js.includes(targetVars)) {
    js = js.replace(targetVars, replaceVars);
}

// Replace setupCursoEvents
const targetSetup = `function setupCursoEvents() {
  document.getElementById('curso-search')?.addEventListener('input', debounce(e => {
    searchCurso = e.target.value; renderCourses();
  }, 250));
  document.getElementById('curso-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'curso-modal-overlay') closeCursoModal();
  });
  document.getElementById('curso-form')?.addEventListener('submit', handleCursoSubmit);
}`;

const replaceSetup = `function setupCursoEvents() {
  document.getElementById('curso-search')?.addEventListener('input', debounce(e => {
    searchCurso = e.target.value; renderCourses();
  }, 250));
  
  document.getElementById('filter-nivel')?.addEventListener('change', e => {
    filterNivel = e.target.value; renderCourses();
  });
  document.getElementById('filter-grado')?.addEventListener('change', e => {
    filterGrado = e.target.value; renderCourses();
  });
  document.getElementById('filter-turno')?.addEventListener('change', e => {
    filterTurno = e.target.value; renderCourses();
  });

  document.getElementById('curso-modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'curso-modal-overlay') closeCursoModal();
  });
  document.getElementById('curso-form')?.addEventListener('submit', handleCursoSubmit);
}`;

if (js.includes(targetSetup)) {
    js = js.replace(targetSetup, replaceSetup);
} else {
    js = js.replace(targetSetup.replace(/\n/g, '\r\n'), replaceSetup.replace(/\n/g, '\r\n'));
}

// Replace renderCourses
const targetRender = `function renderCourses() {
  const grid = document.getElementById('cursos-grid');
  if (!grid) return;
  let list = sortCourses(allCourses);
  if (searchCurso) {
    const q = searchCurso.toLowerCase();
    list = list.filter(c => \`\${c.nombre} \${c.nivel} \${c.grado} \${c.seccion} \${c.turno} \${c.profesor?.nombres||''} \${c.profesor?.apellidos||''}\`.toLowerCase().includes(q));
  }`;

const replaceRender = `function renderCourses() {
  const grid = document.getElementById('cursos-grid');
  if (!grid) return;
  let list = sortCourses(allCourses);
  
  // Aplicar filtros
  if (filterNivel) {
    list = list.filter(c => c.nivel === filterNivel);
  }
  if (filterGrado) {
    list = list.filter(c => c.grado == filterGrado);
  }
  if (filterTurno) {
    list = list.filter(c => c.turno === filterTurno);
  }

  if (searchCurso) {
    const q = searchCurso.toLowerCase();
    list = list.filter(c => \`\${c.nombre} \${c.nivel} \${c.grado} \${c.seccion} \${c.turno} \${c.profesor?.nombres||''} \${c.profesor?.apellidos||''}\`.toLowerCase().includes(q));
  }`;

if (js.includes(targetRender)) {
    js = js.replace(targetRender, replaceRender);
} else {
    js = js.replace(targetRender.replace(/\n/g, '\r\n'), replaceRender.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(fileJs, js);
console.log("JS replaced successfully.");
