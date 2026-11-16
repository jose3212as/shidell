    const TOTAL_SEMANAS = 36;
    let usuario = {};
    let cursoActual = null;
    let cursoId = null;
    let selectedTareaId = null;
    let tareasEstudiante = [];

    document.addEventListener('DOMContentLoaded', async () => {
        cursoId = new URLSearchParams(window.location.search).get('id');
        usuario = await resolverUsuario();
        setUserName();
        setupTabs();
        setupModal();
        await loadCurso();
    });

    async function resolverUsuario() {
        let u = await window.shidellSession?.obtenerUsuario()
            || JSON.parse(localStorage.getItem('shidell_user') || 'null');
        if (!u?.id) {
            try { const r = await fetch('/api/auth/me'); if (r.ok) u = await r.json(); } catch(e) {}
        }
        return u || {};
    }

    function setUserName() {
        const nombre = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim() || 'Estudiante';
        document.querySelectorAll('.user-name').forEach(el => el.textContent = nombre);
    }

    function setupTabs() {
        document.querySelectorAll('.cd-tab-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.cd-tab-item').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.setAttribute('aria-selected', String(isActive));
                });
                document.querySelectorAll('.cd-tab-content-panel').forEach(p => {
                    p.classList.toggle('active', p.id === `tab-${tab}`);
                });
            });
        });
    }

    function setupModal() {
        const modal = document.getElementById('task-modal');
        const closeBtn = document.getElementById('modal-task-close');
        const cancelBtn = document.getElementById('modal-task-cancel');
        const submitBtn = document.getElementById('modal-task-submit');
        const fileInput = document.getElementById('task-file-input');
        const label = document.getElementById('file-dropzone-label');

        const closeModal = () => {
            modal.classList.remove('show');
            fileInput.value = '';
            document.getElementById('task-comment-input').value = '';
            label.textContent = 'Haz clic o arrastra tu archivo aquí';
            selectedTareaId = null;
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        fileInput.onchange = () => {
            if (fileInput.files.length) {
                label.textContent = `Archivo: ${fileInput.files[0].name}`;
            }
        };

        submitBtn.onclick = async () => {
            if (!selectedTareaId) return;
            if (!fileInput.files.length) {
                if (window.Swal) {
                    Swal.fire({ icon: 'warning', title: 'Archivo requerido', text: 'Por favor selecciona un archivo para entregar tu tarea.' });
                } else {
                    alert('Por favor selecciona un archivo para entregar tu tarea.');
                }
                return;
            }

            const formData = new FormData();
            formData.append('tareaId', selectedTareaId);
            formData.append('estudianteId', usuario?.id || 1);
            formData.append('comentario', document.getElementById('task-comment-input').value.trim());
            formData.append('archivo', fileInput.files[0]);

            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            try {
                const res = await fetch('/api/entregas', { method: 'POST', body: formData });
                if (res.ok) {
                    closeModal();
                    if (window.ShidellFun?.celebrar) window.ShidellFun.celebrar();
                    if (window.Swal) {
                        Swal.fire({ icon: 'success', title: '¡Tarea entregada!', text: 'Tu trabajo fue enviado exitosamente.' });
                    } else {
                        alert('¡Tarea entregada con éxito!');
                    }
                    await loadTareas();
                    renderContenidoWeeks(cursoActual);
                } else {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'No se pudo subir la entrega');
                }
            } catch (err) {
                const msg = window.ShidellErrors
                    ? window.ShidellErrors.humanizar(err, 'No pudimos enviar tu tarea ahora. Intenta otra vez.')
                    : (err?.message || 'No pudimos enviar tu tarea ahora.');
                if (window.AppAlerts?.mostrarError) {
                    window.AppAlerts.mostrarError(msg);
                } else if (window.Swal) {
                    Swal.fire({ icon: 'error', title: '¡Ups!', text: msg });
                } else {
                    alert(msg);
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Entrega';
            }
        };
    }

    function abrirModalTarea(tareaId) {
        if (!tareaId) return;
        const extra = cursoId ? `&cursoId=${encodeURIComponent(cursoId)}` : '';
        window.location.href = `tareadetalle.html?id=${encodeURIComponent(tareaId)}${extra}`;
    }

    async function loadCurso() {
        try {
            if (cursoId && !isNaN(Number(cursoId))) {
                try {
                    const r = await fetch(`/api/cursos/${cursoId}/detalle`);
                    if (r.ok) cursoActual = normalizarCurso(await r.json());
                } catch(e) {}
            }

            if (!cursoActual) {
                const url = usuario?.id ? `/api/cursos/estudiante/${usuario.id}/detalle` : '/api/cursos';
                let r = await fetch(url);
                if (!r.ok && usuario?.id) r = await fetch('/api/cursos');
                if (!r.ok) throw new Error('No se pudo cargar');
                const data = await r.json();
                const lista = (data.cursos || (Array.isArray(data) ? data : [])).map(normalizarCurso);
                if (!lista.length) { 
                    document.getElementById('course-title').textContent = 'Sin cursos asignados'; 
                    document.getElementById('bc-course').textContent = 'Sin curso';
                    return; 
                }
                cursoActual = (cursoId && lista.find(c => String(c.id) === String(cursoId))) || lista[0];
                cursoId = cursoActual.id;
            }

            // Renderizar encabezados
            document.getElementById('course-title').textContent = cursoActual.nombre;
            document.getElementById('bc-course').textContent = cursoActual.nombre;

            // Renderizar tareas primero para unificar datos de entrega y actividades
            await loadTareas();
            await loadEvaluacionesCurso();

            // Renderizar pestañas de contenido y foro
            renderContenidoWeeks(cursoActual);
            renderForoWeeks(cursoActual);

        } catch(e) {
            console.error(e);
            document.getElementById('course-title').textContent = 'Error al cargar el curso';
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. PESTAÑA CONTENIDO: Todas las semanas con materiales/tareas
    // ─────────────────────────────────────────────────────────────
    function renderContenidoWeeks(curso) {
        const container = document.getElementById('weeks-list');
        const clases = obtenerListaClases(curso);
        const semActual = obtenerSemanaActual(curso);

        let html = '';
        clases.forEach((cl, index) => {
            const isCurrent = Number(cl.semana) === semActual || (semActual === 1 && index === 0);
            html += buildContenidoWeekRow(cl.semana, cl, isCurrent, curso);
        });

        html += renderEmptyFillerRows();
        container.innerHTML = html;
        bindAccordionToggles(container);
    }

    function buildContenidoWeekRow(num, cl, isOpen, curso) {
        const tituloTema = obtenerTituloSemana(cl);
        const desc = cl.descripcion || '';
        const contenido = getContenidoSemana(curso, cl);

        let subitemsHtml = '';

        // Materiales subidos por el profesor
        if (contenido.materiales && contenido.materiales.length > 0) {
            contenido.materiales.forEach(m => {
                const ext = getFileExtension(m.nombre || m.archivoUrl || '');
                const iconName = ext === 'pdf' ? 'file-text' : (ext.includes('ppt') ? 'presentation-chart' : (ext.includes('doc') ? 'file-doc' : 'folder'));
                const nombreDoc = m.nombre || m.titulo || 'Documento';
                const fechaPub = m.fechaPublicacion ? formatFecha(m.fechaPublicacion) : '';
                const descDoc = m.descripcion ? `${m.descripcion} · ` : '';

                subitemsHtml += `
                <div class="cd-subitem-row">
                    <div class="cd-subitem-icon"><img src="../icons/regular/${iconName}.svg" class="icon-img" alt="doc" onerror="this.onerror=null;this.src='../icons/regular/folder.svg';"></div>
                    <div class="cd-subitem-info">
                        <span class="cd-subitem-title">${esc(nombreDoc)}</span>
                        <span class="cd-subitem-subtitle">${esc(descDoc)}${fechaPub}</span>
                    </div>
                    ${m.archivoUrl ? `
                    <a href="${esc(m.archivoUrl)}" target="_blank" download class="cd-subitem-action-btn">
                        <img src="../icons/regular/download-simple.svg" class="icon-img" alt=""> Descargar
                    </a>` : ''}
                </div>`;
            });
        }

        // Tareas de esta semana
        if (contenido.actividades && contenido.actividades.length > 0) {
            contenido.actividades.forEach(a => {
                const tareaEst = tareasEstudiante.find(t => String(t.id) === String(a.id));
                const estado = (tareaEst?.status || tareaEst?.estado || a.estado || 'Pendiente').toLowerCase();
                const completed = estado.includes('entreg') || estado.includes('calific');
                const onclickAction = a.id ? `onclick="abrirModalTarea(${a.id})"` : '';

                subitemsHtml += `
                <div class="cd-subitem-row" style="cursor:pointer;" ${onclickAction}>
                    <div class="cd-subitem-icon"><img src="../icons/regular/clipboard-text.svg" class="icon-img" alt="tarea"></div>
                    <div class="cd-subitem-info">
                        <span class="cd-subitem-title">${esc(a.titulo || 'Tarea')}</span>
                        <span class="cd-subitem-subtitle">Vence: ${formatFechaLarga(a.fechaVencimiento || a.fecha)}</span>
                    </div>
                    <span class="cd-task-status-badge ${completed ? 'entregado' : 'pendiente'}">${completed ? 'Entregado' : 'Entregar'}</span>
                </div>`;
            });
        }

        const hasTasks = contenido.actividades && contenido.actividades.length > 0;
        const hasMaterials = contenido.materiales && contenido.materiales.length > 0;
        const hasContent = subitemsHtml.trim() !== '' || desc.trim() !== '';
        const shouldBeOpen = isOpen || hasTasks || hasMaterials;
        const bodyHtml = hasContent ? `
            <div class="cd-week-body-content">
                ${desc ? `<p class="cd-week-desc-text">${esc(desc)}</p>` : ''}
                ${subitemsHtml}
            </div>` : `
            <div class="cd-week-body-content">
                <div class="cd-subitem-empty">No hay actividades ni materiales en esta semana.</div>
            </div>`;

        return `
        <div class="cd-week-accordion-row ${shouldBeOpen ? 'open' : ''}">
            <button type="button" class="cd-week-header-btn">
                <span class="cd-week-chevron"><img src="../icons/regular/caret-right.svg" class="icon-img" alt=""></span>
                <span class="cd-week-title">Semana ${num}: ${esc(tituloTema)}</span>
            </button>
            ${bodyHtml}
        </div>`;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PESTAÑA TAREAS: Todas las semanas con tarjetas de tareas
    // ─────────────────────────────────────────────────────────────
    async function loadTareas() {
        const container = document.getElementById('tasks-weeks-list');
        const badge = document.getElementById('badge-tasks');
        if (!usuario?.id) return;

        try {
            const r = await fetch(`/api/tareas/estudiante/${usuario.id}`);
            const data = r.ok ? await r.json() : {};
            const rawTareas = Array.isArray(data.tareas) ? data.tareas : [];
            const allTareas = rawTareas.map(item => item?.tarea ? { ...item.tarea, entrega: item.entrega || null, status: item.status || item.tarea.estado } : item);
            tareasEstudiante = allTareas;

            const tareasCurso = allTareas.filter(t => {
                const cn = t.curso?.nombre || t.cursoNombre || '';
                return textoIgual(cn, cursoActual.nombre) || String(t.curso?.id) === String(cursoActual.id);
            });

            // Unificar con tareas que ya vinieron en el curso para máxima consistencia
            const tareasExistentes = Array.isArray(cursoActual.tareas) ? cursoActual.tareas : [];
            const idsVistos = new Set(tareasCurso.map(t => String(t.id)));
            tareasExistentes.forEach(t => {
                if (!idsVistos.has(String(t.id))) {
                    tareasCurso.push(t);
                    idsVistos.add(String(t.id));
                }
            });
            cursoActual.tareas = tareasCurso;

            badge.textContent = tareasCurso.length;

            const clases = obtenerListaClases(cursoActual);
            const semActual = obtenerSemanaActual(cursoActual);

            // Mapear tareas a semanas usando cálculo calendario preciso
            const tareasPorSemana = new Map();
            tareasCurso.forEach(t => {
                const semanaNum = resolverSemanaDeTarea(t, clases);
                if (!tareasPorSemana.has(Number(semanaNum))) {
                    tareasPorSemana.set(Number(semanaNum), []);
                }
                tareasPorSemana.get(Number(semanaNum)).push(t);
            });

            let html = '';
            clases.forEach(cl => {
                const tasksInWeek = tareasPorSemana.get(Number(cl.semana)) || [];
                const tituloTema = obtenerTituloSemana(cl);
                const hasTasks = tasksInWeek.length > 0;
                const isCurrent = Number(cl.semana) === semActual;

                let tasksCardsHtml = '';
                if (hasTasks) {
                    tasksInWeek.forEach(t => {
                        const estado = (t.status || t.estado || 'Pendiente').toLowerCase();
                        const isCompleted = estado.includes('entreg') || estado.includes('calific');
                        const isExpired = !isCompleted && t.fechaVencimiento && (new Date(t.fechaVencimiento) < new Date());

                        let pillClass = 'pending';
                        let pillIcon = 'clock';
                        let pillText = 'Por entregar';

                        if (isCompleted) {
                            pillClass = 'done';
                            pillIcon = 'check-circle';
                            pillText = 'Revisado / Entregado';
                        } else if (isExpired) {
                            pillClass = 'expired';
                            pillIcon = 'warning-circle';
                            pillText = 'Vencido';
                        }

                        const fechaDesde = t.fechaInicio ? formatFecha(t.fechaInicio) : (t.fecha ? formatFecha(t.fecha) : 'Inicio de clase');
                        const fechaHasta = t.fechaVencimiento ? formatFecha(t.fechaVencimiento) : 'Sin fecha límite';
                        const estadoLabel = isCompleted ? 'Tarea entregada' : (t.tipo || 'Actividad evaluativa');

                        tasksCardsHtml += `
                        <div class="cd-task-wireframe-card">
                            <div class="cd-tw-left">
                                <div class="cd-tw-icon">
                                    <img src="../icons/regular/file-text.svg" class="icon-img" alt="doc" onerror="this.onerror=null;this.src='../icons/regular/folder.svg';">
                                </div>
                                <div class="cd-tw-info">
                                    <span class="cd-tw-label">${esc(estadoLabel)}</span>
                                    <strong class="cd-tw-name">${esc(t.titulo || 'Nombre de la tarea')}</strong>
                                </div>
                            </div>
                            <div class="cd-tw-middle">
                                <span class="cd-tw-status-pill ${pillClass}">
                                    <img src="../icons/regular/${pillIcon}.svg" class="icon-img" alt="" onerror="this.onerror=null;this.src='../icons/regular/check-circle.svg';">
                                    ${pillText}
                                </span>
                            </div>
                            <div class="cd-tw-dates">
                                <div><span>Desde:</span> ${fechaDesde}</div>
                                <div><span>Hasta:</span> ${fechaHasta}</div>
                            </div>
                            <div class="cd-tw-action">
                                <button type="button" class="cd-tw-btn-action" onclick="abrirModalTarea(${t.id}, '${esc(t.titulo || 'Tarea')}', '${esc(t.descripcion || '')}')">
                                    <img src="../icons/regular/arrow-right.svg" class="icon-img" alt=""> Ir actividad
                                </button>
                            </div>
                        </div>`;
                    });
                } else {
                    tasksCardsHtml = `<div class="cd-subitem-empty">No hay tareas programadas para esta semana.</div>`;
                }

                html += `
                <div class="cd-week-accordion-row ${hasTasks || isCurrent ? 'open' : ''}">
                    <button type="button" class="cd-week-header-btn">
                        <span class="cd-week-chevron"><img src="../icons/regular/caret-right.svg" class="icon-img" alt=""></span>
                        <span class="cd-week-title">Semana ${cl.semana}: ${esc(tituloTema)}</span>
                    </button>
                    <div class="cd-week-body-content" style="padding: 14px 24px 18px 24px;">
                        ${tasksCardsHtml}
                    </div>
                </div>`;
            });

            html += renderEmptyFillerRows();
            container.innerHTML = html;
            bindAccordionToggles(container);

        } catch(e) {
            container.innerHTML = '<div class="cd-empty-state">No se pudieron cargar las tareas.</div>';
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. PESTAÑA FORO: Todas las semanas con foro por sesión
    // (Solo habilitado si el docente ha creado/iniciado el foro)
    // ─────────────────────────────────────────────────────────────
    function renderForoWeeks(curso) {
        const container = document.getElementById('forum-weeks-list');
        const clases = obtenerListaClases(curso);
        const semActual = obtenerSemanaActual(curso);

        let html = '';
        clases.forEach((cl, index) => {
            const isCurrent = Number(cl.semana) === semActual || (semActual === 1 && index === 0);
            const tituloTema = obtenerTituloSemana(cl);

            html += `
            <div class="cd-week-accordion-row ${isCurrent ? 'open' : ''}" data-forum-week="${cl.semana}">
                <button type="button" class="cd-week-header-btn" onclick="toggleForoSemana(${cl.semana})">
                    <span class="cd-week-chevron"><img src="../icons/regular/caret-right.svg" class="icon-img" alt=""></span>
                    <span class="cd-week-title">Semana ${cl.semana}: ${esc(tituloTema)}</span>
                </button>
                <div class="cd-week-body-content" style="padding: 14px 24px 20px 24px;">
                    <div class="cd-forum-header-bar" style="margin-bottom:12px;">
                        <h3 style="font-size:14px;">Foro de debate y consultas · Semana ${cl.semana}</h3>
                    </div>
                    <div class="cd-forum-stream" id="forum-stream-${cl.semana}">
                        <div class="cd-subitem-empty">Verificando estado del foro...</div>
                    </div>
                    <div class="cd-forum-compose-box" id="forum-compose-${cl.semana}" style="display:none;">
                        <input type="text" id="forum-input-${cl.semana}" placeholder="Escribe tu consulta o aporte para la semana ${cl.semana}..." onkeydown="if(event.key==='Enter')enviarMensajeForo(${cl.semana})">
                        <button type="button" onclick="enviarMensajeForo(${cl.semana})">
                            <img src="../icons/regular/paper-plane-tilt.svg" class="icon-img" alt="" style="width:14px;height:14px;filter:brightness(0) invert(1);"> Enviar
                        </button>
                    </div>
                </div>
            </div>`;
        });

        html += renderEmptyFillerRows();
        container.innerHTML = html;
        bindAccordionToggles(container);

        // Verificar y cargar mensajes de la semana actual
        cargarMensajesForo(semActual || 1);
    }

    function toggleForoSemana(numSemana) {
        cargarMensajesForo(numSemana);
    }

    async function cargarMensajesForo(numSemana) {
        const stream = document.getElementById(`forum-stream-${numSemana}`);
        const composeBox = document.getElementById(`forum-compose-${numSemana}`);
        if (!stream || !cursoActual?.id) return;

        try {
            const r = await fetch(`/api/cursos/${cursoActual.id}/semanas/${numSemana}/foro`);
            const msgs = r.ok ? await r.json() : [];

            // Si el docente no ha creado/iniciado el foro para esta semana
            if (!msgs.length) {
                if (usuario?.rol === 'DOCENTE') {
                    stream.innerHTML = `
                    <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px; padding:18px; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; color:#1e293b; font-weight:700; font-size:13.5px;">
                            <img src="../icons/regular/chat-circle-dots.svg" class="icon-img" alt="" style="width:18px;height:18px;">
                            Iniciar Foro para la Semana ${numSemana} (Docente)
                        </div>
                        <p style="font-size:13px; color:#64748b; margin:0 0 12px 0;">
                            Aún no has creado este foro. Publica la pregunta detonante o tema de debate para abrir la discusión a los estudiantes:
                        </p>
                        <textarea id="starter-forum-input-${numSemana}" rows="3" placeholder="Escribe el tema de debate o consulta para la semana ${numSemana}..." style="width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:13.5px; box-sizing:border-box; font-family:inherit; resize:vertical; background:#ffffff; color:#0f172a;"></textarea>
                        <div style="display:flex; justify-content:flex-end; margin-top:10px;">
                            <button type="button" style="padding:8px 18px; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px; background:#1e293b; color:#fff; border:none; border-radius:6px; cursor:pointer;" onclick="iniciarForoDesdeDocente(${numSemana})">
                                <img src="../icons/regular/paper-plane-tilt.svg" class="icon-img" alt="" style="width:14px;height:14px;filter:brightness(0) invert(1);"> Publicar Tema y Abrir Foro
                            </button>
                        </div>
                    </div>`;
                    if (composeBox) composeBox.style.display = 'none';
                    return;
                }

                stream.innerHTML = `
                <div class="cd-subitem-empty">
                    <img src="../icons/regular/lock.svg" class="icon-img" alt="" onerror="this.onerror=null;this.src='../icons/regular/info.svg';">
                    El docente aún no ha creado un tema de foro para esta semana.
                </div>`;
                if (composeBox) composeBox.style.display = 'none';
                return;
            }

            // Si el foro está creado y activo con temas/mensajes del docente
            if (composeBox) composeBox.style.display = 'flex';
            stream.innerHTML = msgs.map(m => `
                <div class="cd-forum-post">
                    <div class="cd-forum-user-avatar">${(m.autorNombre || 'E').charAt(0).toUpperCase()}</div>
                    <div class="cd-forum-post-content">
                        <div class="cd-forum-post-meta">
                            <span class="cd-forum-post-author">${esc(m.autorNombre || 'Estudiante')}</span>
                            <span class="cd-forum-post-time">${formatFechaHora(m.fechaCreacion || m.fecha)}</span>
                        </div>
                        <p class="cd-forum-post-text">${esc(m.contenido || '')}</p>
                    </div>
                </div>`).join('');
        } catch(e) {
            stream.innerHTML = '<div class="cd-subitem-empty">No se pudo cargar el foro de esta semana.</div>';
            if (composeBox) composeBox.style.display = 'none';
        }
    }

    async function enviarMensajeForo(numSemana) {
        const input = document.getElementById(`forum-input-${numSemana}`);
        if (!input || !cursoActual?.id) return;
        const text = input.value.trim();
        if (!text) return;

        const token = usuario?.sessionToken || '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const r = await fetch(`/api/cursos/${cursoActual.id}/semanas/${numSemana}/foro`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    autorId: usuario?.id,
                    autorNombre: `${usuario?.nombres || ''} ${usuario?.apellidos || ''}`.trim() || 'Estudiante',
                    contenido: text
                })
            });
            if (r.ok) {
                input.value = '';
                await cargarMensajesForo(numSemana);
            }
        } catch(e) {
            console.error('Error enviando al foro:', e);
        }
    }

    async function iniciarForoDesdeDocente(numSemana) {
        const input = document.getElementById(`starter-forum-input-${numSemana}`);
        if (!input || !cursoActual?.id) return;
        const text = input.value.trim();
        if (!text) {
            if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Escribe el tema de debate para abrir el foro.' });
            return;
        }

        const nombre = `${usuario?.nombres || ''} ${usuario?.apellidos || ''}`.trim() || 'Docente';
        const token = usuario?.sessionToken || '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const r = await fetch(`/api/cursos/${cursoActual.id}/semanas/${numSemana}/foro`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    autorId: usuario?.id,
                    autorNombre: `Prof. ${nombre}`,
                    contenido: text
                })
            });
            if (r.ok) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'success', title: 'Foro Habilitado', text: `El foro de la Semana ${numSemana} ya está abierto.`, timer: 1800, showConfirmButton: false });
                }
                await cargarMensajesForo(numSemana);
            }
        } catch(e) {
            console.error('Error iniciando foro:', e);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers comunes
    // ─────────────────────────────────────────────────────────────
    function obtenerListaClases(curso) {
        if (Array.isArray(curso?.clases) && curso.clases.length > 0) {
            return curso.clases;
        }
        // Clases base si aún no se han generado
        const list = [];
        for (let i = 1; i <= 4; i++) {
            list.push({ semana: i, titulo: '', estado: i === 1 ? 'EN_CURSO' : 'PROGRAMADA', publicadoPorDocente: false });
        }
        return list;
    }

    function obtenerTituloSemana(cl) {
        if (cl?.titulo && cl.titulo.trim() !== '') {
            return cl.titulo.trim();
        }
        if (cl?.publicadoPorDocente) {
            return 'Sesión de aprendizaje';
        }
        return 'Nombre del tema';
    }

    function renderEmptyFillerRows() {
        return `
            <div class="cd-empty-filler-row"></div>
            <div class="cd-empty-filler-row"></div>
            <div class="cd-empty-filler-row"></div>
        `;
    }

    function bindAccordionToggles(container) {
        container.querySelectorAll('.cd-week-header-btn').forEach(btn => {
            btn.onclick = () => {
                const row = btn.closest('.cd-week-accordion-row');
                row.classList.toggle('open');
            };
        });
    }

    function normalizarCurso(c) {
        let prof = c.profesor;
        if (!prof && c.docente) prof = `${c.docente.nombres || ''} ${c.docente.apellidos || ''}`.trim();
        if (!prof && c.profesorNombres) prof = `${c.profesorNombres} ${c.profesorApellidos || ''}`.trim();
        if (!prof) prof = 'Docente Asignado';
        return {
            ...c,
            nombre: limpiarTexto(c.nombre || 'Curso'),
            profesor: limpiarTexto(prof),
            clases: Array.isArray(c.clases) ? c.clases : [],
            materiales: Array.isArray(c.materiales) ? c.materiales : [],
            tareas: Array.isArray(c.tareas) ? c.tareas : [],
            totalClases: Number(c.totalClases || c.clases?.length || TOTAL_SEMANAS)
        };
    }

    function obtenerSemanaActual(curso) {
        if (curso?.semanaActual) return Number(curso.semanaActual);
        const hoy = todayStr();
        const match = (curso?.clases || []).find(cl => {
            const ini = String(cl.fechaInicio || cl.fecha).slice(0, 10);
            const fin = String(cl.fechaFin || cl.fecha).slice(0, 10);
            return hoy >= ini && hoy <= fin;
        });
        if (match) return Number(match.semana);
        const prox = (curso?.clases || []).find(cl => cl.estado === 'PROGRAMADA');
        return Number(prox?.semana || curso?.clases?.[0]?.semana || 1);
    }

    function resolverSemanaDeTarea(t, clases) {
        if (!t) return 1;
        if (t.semana && Number(t.semana) > 0) return Number(t.semana);

        const fechaStr = t.fechaVencimiento || t.fechaInicio || t.fecha || t.fechaPublicacion;
        if (!fechaStr) return obtenerSemanaActual(cursoActual) || 1;

        const f = String(fechaStr).slice(0, 10);
        const targetDate = new Date(f + 'T12:00:00');
        if (isNaN(targetDate.getTime())) return 1;

        if (Array.isArray(clases) && clases.length > 0) {
            // 1. Coincidencia dentro de la ventana de 7 días de la semana lectiva (Lunes a Domingo)
            for (let i = 0; i < clases.length; i++) {
                const cl = clases[i];
                const clIniStr = String(cl.fechaInicio || cl.fecha || '').slice(0, 10);
                if (!clIniStr) continue;
                const clIni = new Date(clIniStr + 'T00:00:00');
                const clFin = new Date(clIni);
                clFin.setDate(clFin.getDate() + 7);

                if (targetDate >= clIni && targetDate < clFin) {
                    return Number(cl.semana);
                }
            }

            // 2. Coincidencia cercana (1-2 días antes del inicio del bloque o fin de semana previo)
            for (let i = 0; i < clases.length; i++) {
                const cl = clases[i];
                const clIniStr = String(cl.fechaInicio || cl.fecha || '').slice(0, 10);
                if (!clIniStr) continue;
                const clIni = new Date(clIniStr + 'T00:00:00');
                const diffDias = Math.round((targetDate - clIni) / (1000 * 60 * 60 * 24));
                if (diffDias >= -2 && diffDias <= 7) {
                    return Number(cl.semana);
                }
            }

            // 3. Buscar la semana más próxima por distancia de fecha
            let mejorSemana = 1;
            let menorDiff = Infinity;
            for (const cl of clases) {
                const clIniStr = String(cl.fechaInicio || cl.fecha || '').slice(0, 10);
                if (!clIniStr) continue;
                const clIni = new Date(clIniStr + 'T12:00:00');
                const diff = Math.abs(targetDate - clIni);
                if (diff < menorDiff) {
                    menorDiff = diff;
                    mejorSemana = Number(cl.semana);
                }
            }
            return mejorSemana;
        }

        return 1;
    }

    function getContenidoSemana(curso, semana) {
        const semNum = Number(semana.semana);
        const clases = obtenerListaClases(curso);
        return {
            materiales: (curso.materiales || []).filter(m => {
                if (m.semana && Number(m.semana) === semNum) return true;
                return resolverSemanaDeTarea(m, clases) === semNum;
            }),
            actividades: (curso.tareas || []).filter(t => {
                if (t.semana && Number(t.semana) === semNum) return true;
                return resolverSemanaDeTarea(t, clases) === semNum;
            })
        };
    }

    function perteneceASemana(fechaStr, semana) {
        if (!fechaStr || !semana) return false;
        const clases = obtenerListaClases(cursoActual);
        const semCalculada = resolverSemanaDeTarea({ fecha: fechaStr }, clases);
        return semCalculada === Number(semana.semana);
    }

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function formatFecha(f) {
        if (!f) return '';
        const m = String(f).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return String(f);
        const meses = ['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic'];
        return `${parseInt(m[3])} ${meses[parseInt(m[2])-1]}`;
    }

    function formatFechaLarga(f) {
        if (!f) return 'Fecha por definir';
        const m = String(f).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return String(f);
        const date = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
        const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
        return `${dias[date.getDay()]} ${parseInt(m[3])} de ${meses[parseInt(m[2])-1]}`;
    }

    function formatFechaHora(fh) {
        if (!fh) return '';
        try {
            const d = new Date(fh);
            return isNaN(d.getTime()) ? String(fh) : d.toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
        } catch(e) { return String(fh); }
    }

    function getFileExtension(name) {
        const parts = String(name).split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    function textoIgual(a, b) {
        return quitarAcentos(limpiarTexto(a||'')).toLowerCase() === quitarAcentos(limpiarTexto(b||'')).toLowerCase();
    }

    function quitarAcentos(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

    function limpiarTexto(t) {
        let v = String(t || '');
        for (let i = 0; i < 3 && /[\u00C3\u00C2]/.test(v); i++) {
            try { const d = decodeURIComponent(escape(v)); if (d === v) break; v = d; } catch(e) { break; }
        }
        return v;
    }

    function esc(v) {
        return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c] || c);
    }

    async function loadEvaluacionesCurso() {
        const container = document.getElementById('exams-bimestre-list');
        const badge = document.getElementById('badge-examenes');
        if (!container || !usuario?.id || !cursoActual) return;
        try {
            const r = await fetch(`/api/calificaciones/estudiante/${usuario.id}`);
            if (!r.ok) throw new Error('Error al cargar evaluaciones');
            const data = await r.json();
            const programadas = Array.isArray(data.evaluacionesProgramadas) ? data.evaluacionesProgramadas : [];
            const cals = Array.isArray(data.evaluaciones) ? data.evaluaciones : [];

            const vistas = new Set();
            const delCurso = [];
            const agregarSiCurso = (ev) => {
                const cNombre = limpiarTexto(ev.cursoNombre || ev.curso?.nombre || '');
                const coincide = String(ev.cursoId || ev.curso?.id) === String(cursoActual.id)
                    || (cNombre && textoIgual(cNombre, cursoActual.nombre));
                if (!coincide) return;
                const titulo = limpiarTexto(ev.titulo || ev.actividad || 'Evaluación');
                const key = titulo.toLowerCase();
                if (vistas.has(key)) return;
                vistas.add(key);
                delCurso.push({
                    titulo,
                    bimestre: Number(ev.bimestre || ev.evaluacion?.bimestre || resolverBimestreTitulo(titulo, ev.fecha)),
                    peso: Number(ev.peso || ev.evaluacion?.peso || 1),
                    fecha: ev.fecha || null,
                    calificada: ev.calificada != null ? Boolean(ev.calificada && ev.nota20 != null) : (ev.nota20 != null || ev.nota != null),
                    nota20: ev.nota20 != null ? Number(ev.nota20) : (ev.nota != null ? Number(ev.nota) : null)
                });
            };

            programadas.forEach(agregarSiCurso);
            cals.forEach(agregarSiCurso);

            if (badge) badge.textContent = String(delCurso.length);

            if (!delCurso.length) {
                container.innerHTML = '<div class="cd-empty-state">No hay exámenes programados para este curso.</div>';
                return;
            }

            const romanos = { 1: 'I Bimestre', 2: 'II Bimestre', 3: 'III Bimestre', 4: 'IV Bimestre' };
            let html = '';
            for (let b = 1; b <= 4; b++) {
                const listaBim = delCurso
                    .filter(item => item.bimestre === b)
                    .sort((x, y) => String(x.fecha || '').localeCompare(String(y.fecha || '')));
                const calificadasBim = listaBim.filter(item => item.calificada && item.nota20 != null);
                const promBimNum = calificadasBim.length
                    ? (calificadasBim.reduce((acc, item) => acc + item.nota20, 0) / calificadasBim.length)
                    : null;
                const promBimTxt = promBimNum !== null
                    ? (window.ShidellGrades?.isLiteral() ? window.ShidellGrades.toLiteral(promBimNum) : `${promBimNum.toFixed(1)} / 20`)
                    : null;
                const statusBadge = promBimTxt !== null
                    ? `<span class="cd-week-tag-status done">Promedio: ${promBimTxt}</span>`
                    : `<span class="cd-week-tag-status current">Programado</span>`;

                const rowsHtml = listaBim.length
                    ? listaBim.map(ex => {
                        const notaVal = ex.calificada && ex.nota20 != null ? Number(ex.nota20) : null;
                        const isLit = Boolean(window.ShidellGrades?.isLiteral());
                        const notaHtml = notaVal !== null
                            ? (isLit ? window.ShidellGrades.toLiteral(notaVal) : `${notaVal.toFixed(1)} <span>/ 20</span>`)
                            : (isLit ? '—' : `— <span>/ 20</span>`);
                        const pillCls = notaVal === null ? 'programado' : (notaVal >= 11 ? 'aprobado' : 'riesgo');
                        const pillTxt = notaVal === null ? 'Programado' : (notaVal >= 11 ? 'Aprobado' : 'En riesgo');
                        return `
                        <div class="cd-exam-row">
                            <div class="cd-exam-main">
                                <span class="cd-exam-title">${esc(ex.titulo)}</span>
                                <span class="cd-exam-meta">${formatFechaLarga(ex.fecha)} · Peso ×${ex.peso.toFixed(1)}</span>
                            </div>
                            <div class="cd-exam-right">
                                <span class="cd-exam-score">${notaHtml}</span>
                                <span class="cd-exam-pill ${pillCls}">${pillTxt}</span>
                            </div>
                        </div>`;
                    }).join('')
                    : '<div class="cd-subitem-empty">Sin exámenes registrados en este bimestre.</div>';

                html += `
                <div class="cd-week-accordion-row open">
                    <button type="button" class="cd-week-header-btn">
                        <span class="cd-week-chevron"><img src="../icons/regular/caret-right.svg" class="icon-img" alt=""></span>
                        <span class="cd-week-title">${romanos[b]} (${listaBim.length} ${listaBim.length === 1 ? 'examen' : 'exámenes'})</span>
                        ${statusBadge}
                    </button>
                    <div class="cd-week-body-content">
                        ${rowsHtml}
                    </div>
                </div>`;
            }
            container.innerHTML = html;
            container.querySelectorAll('.cd-week-header-btn').forEach(btn => {
                btn.addEventListener('click', () => btn.closest('.cd-week-accordion-row')?.classList.toggle('open'));
            });
        } catch (err) {
            container.innerHTML = '<div class="cd-empty-state">No se pudieron cargar los exámenes del curso.</div>';
        }
    }

    function resolverBimestreTitulo(titulo, fecha) {
        const m = String(titulo || '').match(/\b(IV|III|II|I)\b/);
        if (m) return ({ I: 1, II: 2, III: 3, IV: 4 })[m[1]] || 1;
        const mes = fecha ? Number(String(fecha).slice(5, 7)) : 0;
        if (mes >= 3 && mes <= 5) return 1;
        if (mes >= 6 && mes <= 7) return 2;
        if (mes >= 8 && mes <= 10) return 3;
        return 4;
    }
