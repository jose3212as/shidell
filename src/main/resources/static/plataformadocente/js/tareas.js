/* tareas.js — Portal Docente: Tareas & Materiales (Tab-based) */
(function(){
'use strict';
if(window.__shidellAuthFetch)return;
window.__shidellAuthFetch=true;
const _f=window.fetch.bind(window);
window.fetch=(input,init={})=>{
    let u=null;try{u=JSON.parse(localStorage.getItem('shidell_user')||'null')}catch{}
    if(!u?.sessionToken)return _f(input,init);
    const h=new Headers(init.headers||{});
    if(!h.has('Authorization'))h.set('Authorization',`Bearer ${u.sessionToken}`);
    return _f(input,{...init,headers:h});
};
})();

document.addEventListener('DOMContentLoaded',()=>{
const API=location.hostname==='localhost'||location.hostname==='127.0.0.1'?'':'http://localhost:8080';
const $=id=>document.getElementById(id);
const state={docente:null,cursos:[],tareas:[],materiales:[],dashboard:null,editingTaskId:null,lastSub:null};

// DOM refs
const taskFormPanel=$('task-form-panel'), taskForm=$('task-form');
const courseSelect=$('task-course'), matCourseSelect=$('material-course');
const materialForm=$('material-form'), matFileInput=$('material-file');
const matFileLabel=$('material-file-label'), matTableBody=$('materials-table-body');
const fileInput=$('task-file'), fileLabel=$('file-name-label');
const tableBody=$('tasks-table-body'), statusEl=$('server-status');
const filterCourse=$('filter-course'), filterPriority=$('filter-priority'), filterSearch=$('filter-search');

// ── Tabs ──
document.querySelectorAll('.tasks-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
        document.querySelectorAll('.tasks-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        const target=tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(c=>c.style.display='none');
        const el=$(`tab-content-${target}`);
        if(el){el.style.display='';el.style.animation='none';el.offsetHeight;el.style.animation='';}
    });
});

// ── File inputs ──
matFileInput?.addEventListener('change',()=>{
    matFileLabel.textContent=matFileInput.files[0]?.name||'Seleccionar archivo...';
    matFileLabel.style.color=matFileInput.files[0]?'var(--primary)':'var(--text-secondary)';
});
fileInput?.addEventListener('change',()=>{
    fileLabel.textContent=fileInput.files[0]?.name||'Seleccionar PDF...';
    fileLabel.style.color=fileInput.files[0]?'var(--primary)':'var(--text-secondary)';
});

// ── Buttons ──
$('btn-new-task')?.addEventListener('click',()=>openNewTaskForm());
$('btn-new-task-hero')?.addEventListener('click',()=>openNewTaskForm());
$('btn-new-material-hero')?.addEventListener('click',()=>{
    document.querySelectorAll('.tasks-tab').forEach(t=>t.classList.remove('active'));
    $('tab-materiales')?.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c=>c.style.display='none');
    $('tab-content-materiales').style.display='';
    $('material-title')?.focus();
});
$('btn-cancel-task')?.addEventListener('click',()=>closeTaskForm());
$('btn-logout')?.addEventListener('click',e=>{e.preventDefault();localStorage.removeItem('shidell_user');location.href='/login.html';});
filterCourse?.addEventListener('change',applyFilters);
filterPriority?.addEventListener('change',applyFilters);
filterSearch?.addEventListener('input',applyFilters);

// ── Task form submit ──
taskForm.onsubmit=async e=>{
    e.preventDefault();
    if(!state.docente?.id)return;
    const cid=courseSelect.value;
    if(!cid){showToast('Selecciona un curso',true);return;}
    const fd=new FormData();
    fd.append('titulo',$('task-title').value.trim());
    fd.append('descripcion',$('task-description').value.trim());
    fd.append('cursoId',cid);
    fd.append('fechaInicio',$('task-start-date').value);
    fd.append('fechaVencimiento',$('task-deadline').value);
    fd.append('prioridad',$('task-priority').value);
    if(fileInput.files[0])fd.append('archivo',fileInput.files[0]);
    const btn=taskForm.querySelector('button[type="submit"]');
    btn.disabled=true;btn.textContent='Guardando...';
    try{
        const url=state.editingTaskId?`${API}/api/docente/tareas/${state.editingTaskId}`:`${API}/api/docente/tareas`;
        await api(url,{method:state.editingTaskId?'PUT':'POST',body:fd});
        showToast(state.editingTaskId?'Tarea actualizada':'Tarea creada correctamente');
        closeTaskForm();await cargarTareas();
    }catch(err){showToast(err.message||'Error al guardar',true);}
    finally{btn.disabled=false;btn.innerHTML='<i class="ph ph-paper-plane-tilt"></i> Guardar y publicar';}
};

// ── Material form submit ──
materialForm.onsubmit=async e=>{
    e.preventDefault();
    if(!state.docente?.id)return;
    const cid=matCourseSelect.value;
    if(!cid){showToast('Selecciona un curso',true);return;}
    const fd=new FormData();
    fd.append('cursoId',cid);
    fd.append('titulo',$('material-title').value.trim());
    fd.append('descripcion',$('material-description').value.trim());
    if(matFileInput.files[0])fd.append('archivo',matFileInput.files[0]);
    const btn=materialForm.querySelector('button[type="submit"]');
    btn.disabled=true;btn.textContent='Publicando...';
    try{
        await api(`${API}/api/docente/${state.docente.id}/materiales`,{method:'POST',body:fd});
        showToast('Material publicado');materialForm.reset();
        matFileLabel.textContent='Seleccionar archivo...';
        await cargarMateriales();
    }catch(err){showToast(err.message||'Error al publicar',true);}
    finally{btn.disabled=false;btn.innerHTML='<i class="ph ph-upload-simple"></i> Publicar material';}
};

// ── Grade form submit ──
$('grade-form').onsubmit=async e=>{
    e.preventDefault();
    const id=$('grade-submission-id').value;
    const nota=encodeURIComponent($('grade-value').value);
    const com=encodeURIComponent($('grade-comment').value);
    try{
        await api(`${API}/api/entregas/${id}/calificar?nota=${nota}&comentario=${com}`,{method:'PUT'});
        showToast('Entrega calificada');closeGradeModal();
        if(state.lastSub)await openSubmissionsModal(state.lastSub.id,state.lastSub.titulo);
    }catch(err){showToast(err.message||'Error al calificar',true);}
};

// ── Init ──
init();

async function init(){
    setStatus('Conectando...');
    try{
        const email=getEmail();
        const doc=await api(`${API}/api/docente/buscar?email=${encodeURIComponent(email)}`);
        if(!doc?.id||doc.rol?.toUpperCase()!=='DOCENTE')throw new Error('Sesión inválida');
        state.docente=doc;renderTeacher(doc);
        const cursos=await api(`${API}/api/docente/${doc.id}/cursos`);
        state.cursos=dedup(Array.isArray(cursos)?cursos:[]);
        state.dashboard=await api(`${API}/api/docente/${doc.id}/dashboard`).catch(()=>null);
        renderCourseOptions();
        await Promise.all([cargarTareas(),cargarMateriales()]);
        updateMetrics();
        setStatus(`Conectado como ${fullName(doc)}`);
    }catch(err){
        setStatus('Error de conexión');
        renderEmpty(tableBody,6,err.message||'Error');
        renderEmpty(matTableBody,4,'Error');
    }
}

async function cargarTareas(){
    renderEmpty(tableBody,6,'Cargando tareas...');
    if(!state.cursos.length){renderEmpty(tableBody,6,'Sin cursos asignados.');return;}
    try{
        const all=await Promise.all(state.cursos.map(async c=>{
            const t=await api(`${API}/api/docente/curso/${c.id}/tareas`);
            return(Array.isArray(t)?t:[]).map(x=>({...x,curso:x.curso||c}));
        }));
        state.tareas=dedupId(all.flat()).sort((a,b)=>(b.id||0)-(a.id||0));
        updateMetrics();applyFilters();
    }catch(err){renderEmpty(tableBody,6,err.message||'Error');}
}

async function cargarMateriales(){
    renderEmpty(matTableBody,4,'Cargando materiales...');
    if(!state.cursos.length){renderEmpty(matTableBody,4,'Sin cursos asignados.');return;}
    try{
        const all=await Promise.all(state.cursos.map(async c=>{
            const m=await api(`${API}/api/docente/curso/${c.id}/materiales`);
            return(Array.isArray(m)?m:[]).map(x=>({...x,curso:x.curso||c}));
        }));
        state.materiales=dedupId(all.flat()).sort((a,b)=>new Date(b.fechaPublicacion||0)-new Date(a.fechaPublicacion||0));
        updateMetrics();renderMaterials(state.materiales);
    }catch(err){renderEmpty(matTableBody,4,err.message||'Error');}
}

function renderCourseOptions(){
    const opts=['<option value="">Selecciona un curso...</option>']
        .concat(state.cursos.map(c=>`<option value="${c.id}">${esc(courseName(c))}</option>`)).join('');
    courseSelect.innerHTML=opts;matCourseSelect.innerHTML=opts;
    if(filterCourse){
        filterCourse.innerHTML=['<option value="">Todos los cursos</option>']
            .concat(state.cursos.map(c=>`<option value="${c.id}">${esc(courseName(c))}</option>`)).join('');
    }
}

function renderTeacher(d){
    const n=fullName(d);
    $('user-name-label').textContent=n;
    $('user-role-label').textContent='Docente';
    $('teacher-context').textContent=`${n} · ${d.email||''}`;
    $('teacher-welcome').textContent=`Hola, Prof. ${n.split(' ')[0]||'Docente'}`;
}

function updateMetrics(){
    const pending=state.tareas.filter(t=>norm(t.estado)!=='completada').length;
    $('metric-courses').textContent=state.dashboard?.metricas?.cursos??state.cursos.length;
    $('metric-tasks').textContent=state.tareas.length;
    $('metric-materials').textContent=state.materiales.length;
    $('metric-pending').textContent=pending;
    $('tasks-count-label').textContent=state.tareas.length;
    $('materials-count-label').textContent=state.materiales.length;
}

function applyFilters(){
    const cid=filterCourse?.value||'';
    const pri=filterPriority?.value||'';
    const term=norm(filterSearch?.value||'');
    const filtered=state.tareas.filter(t=>{
        const sc=!cid||String(t.curso?.id)===cid;
        const sp=!pri||t.prioridad===pri;
        const hay=norm(`${t.titulo||''} ${t.descripcion||''} ${courseName(t.curso)}`);
        return sc&&sp&&(!term||hay.includes(term));
    });
    renderTasks(filtered);
}

function renderTasks(tareas){
    if(!tareas.length){renderEmpty(tableBody,6,'No hay tareas que mostrar.');return;}
    tableBody.innerHTML=tareas.map(t=>{
        const pc=t.prioridad==='Alta'?'status-pill warning':t.prioridad==='Baja'?'status-pill':'status-pill success';
        const pdf=t.pdfUrl?`${API}${t.pdfUrl}`:'';
        return `<tr>
            <td><div class="task-title-cell"><strong>${esc(t.titulo||'Sin título')}</strong><small>${esc(t.descripcion||'')}</small></div></td>
            <td>${esc(courseName(t.curso))}</td>
            <td><div style="font-size:10px;color:var(--text-tertiary)">Inicia: ${esc(fmtDate(t.fechaInicio))}</div><div style="font-weight:600;color:var(--red)">Cierra: ${esc(fmtDate(t.fechaVencimiento))}</div></td>
            <td><span class="${pc}">${esc(t.prioridad||'Media')}</span></td>
            <td><span class="status-pill" style="background:#e2e8f0">${esc(t.estado||'Pendiente')}</span></td>
            <td><div class="row-actions">
                ${pdf?`<a class="icon-link" href="${pdf}" target="_blank" title="PDF"><i class="ph ph-file-pdf"></i></a>`:''}
                <button class="btn-secondary mini-btn btn-edit" data-id="${t.id}">Editar</button>
                <button class="btn-primary mini-btn btn-subs" data-id="${t.id}">Entregas</button>
            </div></td>
        </tr>`;
    }).join('');
    tableBody.querySelectorAll('.btn-edit').forEach(b=>b.addEventListener('click',()=>prepEdit(b.dataset.id)));
    tableBody.querySelectorAll('.btn-subs').forEach(b=>{
        const t=state.tareas.find(x=>String(x.id)===b.dataset.id);
        if(t)b.addEventListener('click',()=>openSubmissionsModal(t.id,t.titulo));
    });
}

function renderMaterials(mats){
    if(!mats.length){renderEmpty(matTableBody,4,'Aún no has publicado materiales.');return;}
    matTableBody.innerHTML=mats.map(m=>{
        const url=m.archivoUrl?`${API}${m.archivoUrl}`:'';
        return `<tr>
            <td><strong>${esc(m.titulo||'Material')}</strong><div style="font-size:12px;color:var(--text-tertiary);max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.descripcion||'')}</div></td>
            <td>${esc(courseName(m.curso))}</td>
            <td>${esc(fmtDateTime(m.fechaPublicacion))}</td>
            <td>${url?`<a href="${url}" target="_blank" style="color:var(--primary)"><i class="ph ph-download-simple"></i> Descargar</a>`:'Sin archivo'}</td>
        </tr>`;
    }).join('');
}

// ── Form helpers ──
function openNewTaskForm(){
    state.editingTaskId=null;taskForm.reset();
    fileLabel.textContent='Seleccionar PDF...';
    const title=$('task-form-panel-title');
    if(title)title.innerHTML='<i class="ph ph-plus-circle"></i> Crear Nueva Actividad';
    const btn=taskForm.querySelector('button[type="submit"]');
    btn.innerHTML='<i class="ph ph-paper-plane-tilt"></i> Guardar y publicar';
    taskFormPanel.style.display='block';
    taskFormPanel.scrollIntoView({behavior:'smooth',block:'start'});
}

function closeTaskForm(){
    state.editingTaskId=null;taskForm.reset();fileInput.value='';
    fileLabel.textContent='Seleccionar PDF...';
    taskFormPanel.style.display='none';
}

function prepEdit(id){
    const t=state.tareas.find(x=>String(x.id)===String(id));if(!t)return;
    state.editingTaskId=t.id;
    const title=$('task-form-panel-title');
    if(title)title.innerHTML='<i class="ph ph-pencil-simple"></i> Editando tarea';
    $('task-title').value=t.titulo||'';
    $('task-description').value=t.descripcion||'';
    courseSelect.value=t.curso?.id||'';
    $('task-start-date').value=t.fechaInicio||'';
    $('task-deadline').value=t.fechaVencimiento||'';
    $('task-priority').value=t.prioridad||'Media';
    fileInput.value='';fileLabel.textContent=t.pdfUrl?'Archivo actual guardado':'Seleccionar PDF...';
    const btn=taskForm.querySelector('button[type="submit"]');
    btn.innerHTML='<i class="ph ph-check"></i> Actualizar cambios';
    taskFormPanel.style.display='block';
    taskFormPanel.scrollIntoView({behavior:'smooth',block:'start'});
}

// ── Submissions modal ──
window.openSubmissionsModal=async(tareaId,titulo)=>{
    const modal=$('modal-submissions');state.lastSub={id:tareaId,titulo};
    $('modal-task-title').textContent=`Entregas: ${titulo||'Tarea'}`;
    modal.style.display='flex';
    const list=$('submissions-list');
    list.innerHTML='<p style="text-align:center;padding:20px">Cargando entregas...</p>';
    try{
        const entregas=await api(`${API}/api/entregas/tarea/${tareaId}`);
        if(!Array.isArray(entregas)||!entregas.length){
            list.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-tertiary)"><i class="ph ph-warning-circle" style="font-size:48px"></i><p>No hay entregas todavía.</p></div>';
            return;
        }
        list.innerHTML=`<table class="data-table"><thead><tr><th>Estudiante</th><th>Fecha</th><th>Archivo</th><th>Nota</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${entregas.map(renderEntregaRow).join('')}</tbody></table>`;
        list.querySelectorAll('.btn-grade').forEach(b=>b.addEventListener('click',()=>openGradeModal(b.dataset.id,b.dataset.nota,b.dataset.comentario)));
    }catch(err){list.innerHTML=`<p style="color:red;text-align:center">${esc(err.message||'Error')}</p>`;}
};

window.closeSubmissionsModal=()=>{$('modal-submissions').style.display='none';state.lastSub=null;};

function renderEntregaRow(e){
    const est=e.estudiante||{};
    const sc=e.estado==='CALIFICADO'?'status-pill success':'status-pill warning';
    const url=e.archivoUrl?`${API}${e.archivoUrl}`:'';
    return `<tr>
        <td><div style="font-weight:600">${esc(fullName(est))}</div><small style="color:var(--text-tertiary)">${esc(est.email||'')}</small></td>
        <td>${esc(fmtDateTime(e.fechaEntrega))}</td>
        <td>${url?`<a href="${url}" target="_blank" style="color:var(--primary)"><i class="ph ph-download-simple"></i> Descargar</a>`:'Sin archivo'}</td>
        <td style="font-weight:700;color:var(--primary);font-size:16px">${e.nota!=null?esc(e.nota):'--'}</td>
        <td><span class="${sc}">${esc(e.estado||'PENDIENTE')}</span></td>
        <td><button class="btn-secondary mini-btn btn-grade" data-id="${e.id}" data-nota="${esc(e.nota??'')}" data-comentario="${esc(e.comentarioProfesor||'')}">Calificar</button></td>
    </tr>`;
}

// ── Grade modal ──
window.openGradeModal=function(id,nota='',com=''){
    $('grade-submission-id').value=id;$('grade-value').value=nota||'';$('grade-comment').value=com||'';
    $('modal-grade').style.display='flex';
};
window.closeGradeModal=function(){$('modal-grade').style.display='none';};

// ── API ──
async function api(url,opts={}){
    const r=await fetch(url,opts);
    if(!r.ok){
        if (r.status === 401 || r.status === 404) {
            localStorage.removeItem('shidell_user');
            location.href = '/login.html';
            return null;
        }
        const t=await r.text().catch(()=>'');throw new Error(t||`HTTP ${r.status}`);
    }
    const t=await r.text();return t?JSON.parse(t):null;
}

// ── Utils ──
function getEmail(){
    try{const u=JSON.parse(localStorage.getItem('shidell_user')||'null');return u?.rol?.toUpperCase()==='DOCENTE'&&u.email?u.email:'profesor@shidell.edu';}catch{return 'profesor@shidell.edu';}
}
function dedup(cursos){
    const m=new Map();cursos.forEach(c=>{const k=[norm(fix(c.nombre)),c.nivel,c.grado,c.seccion].join('|');if(!m.has(k)||Number(c.id)<Number(m.get(k).id))m.set(k,c);});
    return Array.from(m.values()).sort((a,b)=>fix(a.nombre).localeCompare(fix(b.nombre),'es'));
}
function dedupId(items){return Array.from(new Map(items.filter(i=>i?.id!=null).map(i=>[i.id,i])).values());}
function courseName(c={}){const n=fix(c.nombre||'Curso');const g=c.grado?`${c.grado}°`:'';const s=c.seccion||'';return[n,[g,s].filter(Boolean).join(' ')].filter(Boolean).join(' - ');}
function fullName(u={}){return fix(`${u.nombres||''} ${u.apellidos||''}`).trim()||'Docente';}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function fix(v){let t=String(v??'');for(let i=0;i<2&&/Ã|Â/.test(t);i++){try{const f=decodeURIComponent(escape(t));if(!f||f===t)break;t=f;}catch{break;}}return t.replace(/Â/g,'');}
function fmtDate(v){if(!v)return'--';const d=new Date(`${v}T00:00:00`);return isNaN(d)?v:d.toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'});}
function fmtDateTime(v){if(!v)return'--';const d=new Date(v);return isNaN(d)?v:d.toLocaleString('es-PE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function renderEmpty(t,c,msg){t.innerHTML=`<tr><td colspan="${c}" style="text-align:center;padding:28px">${esc(msg)}</td></tr>`;}
function setStatus(t){if(statusEl)statusEl.textContent=`Estado: ${t}`;}
function showToast(msg,err=false){const t=$('feedback-toast');t.textContent=msg;t.style.background=err?'#ef4444':'#22c55e';t.style.display='flex';clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.style.display='none',3200);}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

});
