/**
 * ==========================================================================
 * Shidell — Mensajería del Estudiante (mensajes.js)
 * Sistema de chat en tiempo real con soporte responsivo para PC y Smartphone
 * ==========================================================================
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificación de sesión de estudiante
    const user = await window.shidellSession?.obtenerUsuario();
    if (!user || !user.id) {
        mostrarSinSesion();
        return;
    }
    const studentId = user.id;

    // 2. Elementos del DOM
    const layout = document.getElementById('messaging-layout');
    const convoList = document.getElementById('convo-list');
    const chatActive = document.getElementById('chat-active');
    const noChat = document.getElementById('no-chat');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send-msg');
    const btnBackChats = document.getElementById('btn-back-chats');
    const activeName = document.getElementById('active-name');
    const activeAvatar = document.getElementById('active-avatar');
    const activeRoleBadge = document.getElementById('active-role-badge');
    const activeStatus = document.getElementById('active-status');
    const activeExtra = document.getElementById('active-extra');
    const activeDot = document.getElementById('active-dot');
    const totalUnreadBadge = document.getElementById('total-unread-badge');

    const fileInput = document.getElementById('msg-file');
    const filePreview = document.getElementById('file-preview');
    const fileNamePrev = document.getElementById('file-name-preview');
    const fileSizePrev = document.getElementById('file-size-preview');
    const cancelFileBtn = document.getElementById('cancel-file');

    const btnNewChat = document.getElementById('btn-new-chat');
    const btnSidebarNewChat = document.getElementById('btn-sidebar-new-chat');
    const modal = document.getElementById('contacts-modal');
    const closeModal = document.getElementById('close-contacts');
    const contactsMod = document.getElementById('contacts-list-modal');
    const modalSearchInput = document.getElementById('modal-search-input');
    const modalClearSearch = document.getElementById('modal-clear-search');
    const modalCategoryTabs = document.getElementById('modal-category-tabs');

    const courseFilter = document.getElementById('course-filter');
    const searchInput = document.getElementById('chat-search-input');
    const sidebarClearSearch = document.getElementById('sidebar-clear-search');

    // 3. Estado local
    let bandeja = { estudiante: user, cursos: [], conversaciones: [], noLeidos: 0 };
    let contactosAcademicos = [];
    let contactosCargados = false;
    let selectedCourseId = null;
    let activeContacto = null;
    let refreshInterval = null;
    let modalFilterRole = 'all'; // 'all' | 'DOCENTE' | 'ESTUDIANTE'
    let shouldAutoScroll = true;

    // ── Inicialización ──
    async function inicializar() {
        configurarEventos();
        await cargarBandeja();

        // Cargar contactos académicos (docentes y compañeros) en segundo plano
        cargarTodosLosContactos();

        // Atender parámetro de URL ?chatId=
        const chatId = new URLSearchParams(window.location.search).get('chatId');
        if (chatId) {
            abrirChatPorId(chatId);
        }
    }

    // ── Carga de Bandeja Principal ──
    async function cargarBandeja() {
        mostrarCargando(convoList, 'Cargando conversaciones...');

        try {
            const query = selectedCourseId ? `?cursoId=${encodeURIComponent(selectedCourseId)}` : '';
            const response = await fetch(`/api/mensajes/estudiante/${studentId}/bandeja${query}`);
            if (!response.ok) throw new Error('No se pudo cargar la bandeja.');

            bandeja = await response.json();

            actualizarContadorNoLeidosTotal(bandeja.noLeidos || 0);
            renderCursos(bandeja.cursos || []);
            renderConversaciones(bandeja.conversaciones || []);
        } catch (error) {
            mostrarError(convoList, 'No se pudieron cargar tus mensajes.');
        }
    }

    function actualizarContadorNoLeidosTotal(total) {
        if (!totalUnreadBadge) return;
        const count = Number(total || 0);
        if (count > 0) {
            totalUnreadBadge.textContent = count > 99 ? '99+' : count;
            totalUnreadBadge.style.display = 'inline-flex';
        } else {
            totalUnreadBadge.style.display = 'none';
        }
    }

    // ── Selector de Cursos ──
    function renderCursos(cursos) {
        if (!courseFilter || courseFilter.dataset.loaded === 'true') return;

        courseFilter.innerHTML = '<option value="">Todos los cursos</option>';
        cursos.forEach(curso => {
            const option = document.createElement('option');
            option.value = curso.id;
            option.textContent = limpiarTexto(curso.nombre || 'Curso');
            courseFilter.appendChild(option);
        });
        courseFilter.dataset.loaded = 'true';
    }

    // ── Renderizado de Conversaciones en Sidebar ──
    function renderConversaciones(conversaciones) {
        const filtradas = filtrarPorBusqueda(conversaciones);

        if (!filtradas.length) {
            const esBusqueda = Boolean((searchInput?.value || '').trim());
            convoList.innerHTML = `
                <div style="padding: 32px 16px; text-align: center; color: var(--text-tertiary);">
                    <img src="../icons/regular/chat-circle.svg" class="icon-img" alt="Sin mensajes" style="width: 36px; height: 36px; opacity: 0.35; margin-bottom: 8px;">
                    <p style="font-size: 13.5px; font-weight: 600;">${esBusqueda ? 'No se encontraron conversaciones.' : 'Aún no tienes conversaciones abiertas.'}</p>
                    <p style="font-size: 12px; margin-top: 4px;">Usa el botón <strong>"Nuevo"</strong> para escribirle a un profesor o compañero.</p>
                </div>`;
            return;
        }

        convoList.innerHTML = filtradas.map(item => tarjetaConversacion(item)).join('');
        convoList.querySelectorAll('.convo-item').forEach(element => {
            element.addEventListener('click', () => {
                const contacto = filtradas.find(item => String(item.contacto.id) === element.dataset.id)?.contacto;
                if (contacto) abrirConversacion(contacto);
            });
        });
    }

    function tarjetaConversacion(item) {
        const contacto = item.contacto || {};
        const nombre = nombreContacto(contacto);
        const activo = activeContacto && String(activeContacto.id) === String(contacto.id) ? ' active' : '';
        const rolLabel = etiquetaRol(contacto);
        const rolClass = contacto.rol === 'DOCENTE' ? 'docente' : 'estudiante';
        const preview = item.preview ? limpiarTexto(item.preview) : (item.ultimoMensaje?.contenido ? limpiarTexto(item.ultimoMensaje.contenido) : 'Haz clic para iniciar conversación');
        const hora = item.fechaUltimoMensaje ? formatearHora(item.fechaUltimoMensaje) : '';
        const badge = Number(item.noLeidos || 0) > 0
            ? `<span class="convo-unread-badge">${item.noLeidos}</span>`
            : '';

        return `
            <div class="convo-item${activo}" data-id="${escapeHtml(contacto.id)}" data-name="${escapeHtml(nombre.toLowerCase())}" data-role="${escapeHtml(rolLabel.toLowerCase())}">
                <div class="convo-avatar" style="${estiloAvatar(contacto)}">${avatarPersona(contacto)}</div>
                <div class="convo-info">
                    <div class="convo-top-line">
                        <span class="convo-name">${escapeHtml(nombre)}</span>
                        <span class="convo-meta-right">
                            ${badge}
                            ${hora ? `<small class="convo-time">${escapeHtml(hora)}</small>` : ''}
                        </span>
                    </div>
                    <div class="convo-bottom-line">
                        <span class="convo-role-tag ${rolClass}">${escapeHtml(rolLabel)}</span>
                        <span class="convo-preview">${escapeHtml(preview)}</span>
                    </div>
                </div>
            </div>`;
    }

    // ── Abrir Conversación Activa ──
    async function abrirConversacion(contacto, extraInfo = '') {
        if (!contacto || !contacto.id) return;
        activeContacto = contacto;

        // Mostrar pantalla de chat y ocultar empty state
        if (noChat) noChat.style.display = 'none';
        if (chatActive) chatActive.style.display = 'flex';

        // En pantallas pequeñas / móviles: activar clase para vista única
        if (layout) {
            layout.classList.add('mobile-chat-open');
        }

        // Header del contacto activo
        if (activeName) activeName.textContent = nombreContacto(contacto);
        renderAvatarEnContenedor(activeAvatar, contacto);

        const rolLabel = etiquetaRol(contacto);
        const rolClass = contacto.rol === 'DOCENTE' ? 'docente' : 'estudiante';
        if (activeRoleBadge) {
            activeRoleBadge.textContent = rolLabel;
            activeRoleBadge.className = `chat-header-badge ${rolClass}`;
            activeRoleBadge.style.display = 'inline-flex';
        }

        if (activeExtra) {
            const info = extraInfo || (contacto.rol === 'DOCENTE' ? (contacto.codigoPlaza || 'Docente') : `${contacto.grado || '1'}° ${contacto.seccion || 'A'} Secundaria`);
            activeExtra.textContent = info;
            activeExtra.style.display = info ? 'inline' : 'none';
        }
        if (activeDot) {
            activeDot.style.display = activeExtra && activeExtra.textContent ? 'inline' : 'none';
        }

        actualizarEstadoEnLinea(contacto);

        // Resaltar en la lista lateral
        if (convoList) {
            convoList.querySelectorAll('.convo-item').forEach(el => {
                el.classList.toggle('active', String(el.dataset.id) === String(contacto.id));
            });
        }

        // Reset scroll y estado de mensajes
        shouldAutoScroll = true;
        chatMessages.dataset.hash = '';
        mostrarCargandoMensajes();

        // Cargar mensajes reales
        await cargarConversacion();

        // Reiniciar polling cada 5 segundos
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(cargarConversacion, 5000);
    }

    function mostrarCargandoMensajes() {
        chatMessages.innerHTML = `
            <div class="chat-loading-state">
                <div class="chat-spinner"></div>
                <span>Cargando conversación...</span>
            </div>`;
    }

    async function abrirChatPorId(targetUserId) {
        // 1. Buscar en conversaciones existentes
        const existente = bandeja.conversaciones.find(item => String(item.contacto.id) === String(targetUserId));
        if (existente && existente.contacto) {
            abrirConversacion(existente.contacto);
            return;
        }

        // 2. Buscar en contactos académicos
        const academico = contactosAcademicos.find(c => String(c.id) === String(targetUserId));
        if (academico) {
            abrirConversacion(academico);
            return;
        }

        // 3. Consultar backend directamente
        try {
            const res = await fetch(`/api/users/${targetUserId}`);
            if (res.ok) {
                const fetched = await res.json();
                abrirConversacion(fetched);
            }
        } catch (e) {
            console.warn('No se pudo abrir el chat por ID:', targetUserId, e);
        }
    }

    // ── Cargar Mensajes de la Conversación ──
    async function cargarConversacion() {
        if (!activeContacto) return;

        try {
            const query = selectedCourseId ? `?cursoId=${encodeURIComponent(selectedCourseId)}` : '';
            const response = await fetch(`/api/mensajes/estudiante/${studentId}/conversacion/${activeContacto.id}${query}`);
            if (!response.ok) throw new Error('No se pudo cargar la conversación.');

            const data = await response.json();
            if (data.contacto) {
                activeContacto = { ...activeContacto, ...data.contacto };
                actualizarEstadoEnLinea(activeContacto);
            } else {
                actualizarEstadoEnLinea(activeContacto);
            }
            renderMensajes(data.mensajes || []);
            await refrescarResumenBandeja();
        } catch (error) {
            mostrarError(chatMessages, 'No se pudo cargar esta conversación.');
        }
    }

    // ── Renderizado de Mensajes con Divisores de Fecha ──
    function renderMensajes(mensajes) {
        const hash = mensajes.map(m => `${m.id}-${m.leido ? 1 : 0}`).join(',');
        if (chatMessages.dataset.hash === hash) return;
        chatMessages.dataset.hash = hash;

        if (!mensajes.length) {
            chatMessages.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-tertiary); gap:12px; padding:40px; text-align:center;">
                    <img src="../icons/regular/chat-circle-dots.svg" class="icon-img" alt="Chat vacío" style="width:52px; height:52px; opacity:0.3;">
                    <p style="font-size:15px; font-weight:700; color:var(--text-primary);">Aún no hay mensajes aquí</p>
                    <p style="font-size:13px; max-width:280px;">Escribe el primer mensaje a continuación para comenzar la conversación.</p>
                </div>`;
            return;
        }

        let html = '';
        let ultimaFecha = '';

        mensajes.forEach(mensaje => {
            const fechaCabecera = formatearFechaCabecera(mensaje.fechaEnvio);
            if (fechaCabecera && fechaCabecera !== ultimaFecha) {
                html += `<div class="msg-date-divider"><span>${escapeHtml(fechaCabecera)}</span></div>`;
                ultimaFecha = fechaCabecera;
            }
            html += burbujaMensaje(mensaje);
        });

        chatMessages.innerHTML = html;

        if (shouldAutoScroll) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function burbujaMensaje(mensaje) {
        const isMine = mensaje.remitente?.id === studentId;
        const remitente = isMine ? bandeja.estudiante : mensaje.remitente;
        const archivo = mensaje.archivoUrl ? archivoHtml(mensaje.archivoUrl) : '';
        const sender = !isMine
            ? `<span class="msg-sender-name">${escapeHtml(nombreContacto(mensaje.remitente))}</span>`
            : '';

        return `
            <div class="msg-row ${isMine ? 'mine' : 'theirs'}">
                <div class="msg-avatar-inline" style="${estiloAvatar(remitente)}">${avatarPersona(remitente)}</div>
                <div class="msg-bubble ${isMine ? 'msg-sent' : 'msg-received'}">
                    ${sender}
                    ${archivo}
                    ${mensaje.contenido ? `<div class="msg-content">${escapeHtml(limpiarTexto(mensaje.contenido))}</div>` : ''}
                    <span class="msg-time">${escapeHtml(formatearHora(mensaje.fechaEnvio))}</span>
                </div>
            </div>`;
    }

    function archivoHtml(url) {
        const decoded = decodeURIComponent(String(url).split('_').pop() || 'archivo');
        const ext = decoded.split('.').pop().toLowerCase();
        let icono = '../icons/svg/file-doc.svg';
        return `
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="msg-file-link" title="Descargar archivo">
                <img src="${icono}" class="icon-img" alt="Archivo" style="width:20px;height:20px;flex-shrink:0;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(decoded)}</span>
                <span style="font-size:11px;opacity:0.8;text-transform:uppercase;font-weight:800;">${escapeHtml(ext)}</span>
            </a>`;
    }

    // ── Enviar Mensaje ──
    async function enviarMensaje() {
        if (!activeContacto) return;

        const contenido = chatInput.value.trim();
        const archivo = fileInput?.files?.[0] || null;
        if (!contenido && !archivo) return;

        // Validar tamaño de archivo (máx 15MB)
        if (archivo && archivo.size > 15 * 1024 * 1024) {
            mostrarNotificacion('El archivo seleccionado supera el límite de 15MB.', 'warning');
            return;
        }

        btnSend.disabled = true;
        const originalBtnHtml = btnSend.innerHTML;
        btnSend.innerHTML = '<span class="chat-spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#ffffff;"></span>';

        const formData = new FormData();
        formData.append('remitenteId', studentId);
        formData.append('destinatarioId', activeContacto.id);
        if (selectedCourseId) formData.append('cursoId', selectedCourseId);
        if (contenido) formData.append('contenido', contenido);
        if (archivo) formData.append('archivo', archivo);

        try {
            const response = await fetch('/api/mensajes/enviar', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('No se pudo enviar el mensaje.');

            chatInput.value = '';
            cancelarArchivo();
            shouldAutoScroll = true;
            chatMessages.dataset.hash = '';

            await cargarConversacion();
            await cargarBandeja();
        } catch (error) {
            mostrarNotificacion('No se pudo enviar el mensaje. Inténtalo nuevamente.', 'error');
        } finally {
            btnSend.disabled = false;
            btnSend.innerHTML = originalBtnHtml;
            chatInput.focus();
        }
    }

    async function refrescarResumenBandeja() {
        const query = selectedCourseId ? `?cursoId=${encodeURIComponent(selectedCourseId)}` : '';
        const response = await fetch(`/api/mensajes/estudiante/${studentId}/bandeja${query}`).catch(() => null);
        if (!response || !response.ok) return;

        const next = await response.json();
        bandeja = next;
        actualizarContadorNoLeidosTotal(bandeja.noLeidos || 0);
        renderConversaciones(bandeja.conversaciones || []);
    }

    // ── Carga Completa de Contactos Académicos para el Modal ──
    async function cargarTodosLosContactos() {
        const mapa = new Map();

        // 1. Docentes de todos los cursos inscritos
        (bandeja.cursos || []).forEach(curso => {
            if (curso.profesor && curso.profesor.id && curso.profesor.id !== studentId) {
                const p = curso.profesor;
                if (!mapa.has(p.id)) {
                    mapa.set(p.id, {
                        ...p,
                        rol: 'DOCENTE',
                        materia: limpiarTexto(curso.nombre || 'Docente')
                    });
                }
            }
        });

        // 2. Contactos existentes en bandeja
        (bandeja.conversaciones || []).forEach(c => {
            if (c.contacto && c.contacto.id && c.contacto.id !== studentId) {
                if (!mapa.has(c.contacto.id)) {
                    mapa.set(c.contacto.id, c.contacto);
                }
            }
        });

        // 3. Compañeros de aula mediante /api/mensajes/contactos-curso/{cursoId}
        const cursoParaParticipantes = (bandeja.cursos || [])[0]?.id || 1;
        try {
            const res = await fetch(`/api/mensajes/contactos-curso/${cursoParaParticipantes}`);
            if (res.ok) {
                const participantes = await res.json();
                participantes.forEach(userItem => {
                    if (userItem.id && userItem.id !== studentId && !mapa.has(userItem.id)) {
                        mapa.set(userItem.id, userItem);
                    }
                });
            }
        } catch (e) {
            console.warn('No se pudieron precargar los participantes de aula.', e);
        }

        contactosAcademicos = Array.from(mapa.values());
        contactosCargados = true;
    }

    // ── Modal de Contactos ("Nuevo") ──
    function abrirModalContactos() {
        modal.classList.add('show');
        if (modalSearchInput) {
            modalSearchInput.value = '';
            if (modalClearSearch) modalClearSearch.style.display = 'none';
        }
        modalFilterRole = 'all';
        if (modalCategoryTabs) {
            modalCategoryTabs.querySelectorAll('.modal-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.filter === 'all');
            });
        }
        renderContactosModal();
        if (modalSearchInput) modalSearchInput.focus();
    }

    function renderContactosModal() {
        const query = (modalSearchInput?.value || '').trim().toLowerCase();
        let lista = contactosAcademicos.slice();

        // Filtrar por rol
        if (modalFilterRole === 'DOCENTE') {
            lista = lista.filter(c => c.rol === 'DOCENTE');
        } else if (modalFilterRole === 'ESTUDIANTE') {
            lista = lista.filter(c => c.rol === 'ESTUDIANTE');
        }

        // Filtrar por búsqueda
        if (query) {
            lista = lista.filter(c => {
                const nom = nombreContacto(c).toLowerCase();
                const rol = etiquetaRol(c).toLowerCase();
                const mat = (c.materia || '').toLowerCase();
                const em = (c.email || '').toLowerCase();
                return nom.includes(query) || rol.includes(query) || mat.includes(query) || em.includes(query);
            });
        }

        if (!lista.length) {
            contactsMod.innerHTML = `
                <div style="padding:32px 16px; text-align:center; color:var(--text-tertiary);">
                    <p style="font-size:14px; font-weight:700; color:var(--text-secondary);">No se encontraron contactos</p>
                    <p style="font-size:12px; margin-top:4px;">Prueba ajustando los filtros o escribiendo otro nombre.</p>
                </div>`;
            return;
        }

        contactsMod.innerHTML = lista.map(c => tarjetaModalContacto(c)).join('');
        contactsMod.querySelectorAll('.convo-item').forEach(element => {
            element.addEventListener('click', () => {
                const contacto = lista.find(c => String(c.id) === element.dataset.id);
                if (!contacto) return;
                modal.classList.remove('show');
                abrirConversacion(contacto, contacto.materia || '');
            });
        });
    }

    function tarjetaModalContacto(contacto) {
        const rolLabel = etiquetaRol(contacto);
        const rolClass = contacto?.rol === 'DOCENTE' ? 'docente' : 'estudiante';
        const subtitulo = contacto.materia ? contacto.materia : (contacto.rol === 'DOCENTE' ? 'Docente' : 'Compañero/a de aula');

        return `
            <div class="convo-item" data-id="${escapeHtml(contacto.id)}">
                <div class="convo-avatar" style="${estiloAvatar(contacto)}">${avatarPersona(contacto)}</div>
                <div class="convo-info">
                    <div class="convo-top-line">
                        <span class="convo-name">${escapeHtml(nombreContacto(contacto))}</span>
                        <span class="convo-role-tag ${rolClass}">${escapeHtml(rolLabel)}</span>
                    </div>
                    <div class="convo-bottom-line">
                        <span class="convo-preview" style="font-size:12px; color:var(--text-tertiary);">${escapeHtml(subtitulo)}</span>
                    </div>
                </div>
            </div>`;
    }

    // ── Configuración de Eventos ──
    function configurarEventos() {
        // Enviar por botón
        btnSend?.addEventListener('click', event => {
            event.preventDefault();
            enviarMensaje();
        });

        // Enviar por Enter
        chatInput?.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                enviarMensaje();
            }
        });

        // Botón volver en smartphone
        btnBackChats?.addEventListener('click', () => {
            if (layout) layout.classList.remove('mobile-chat-open');
            activeContacto = null;
            if (chatActive) chatActive.style.display = 'none';
            if (noChat && window.innerWidth > 900) noChat.style.display = 'flex';
            if (refreshInterval) clearInterval(refreshInterval);
            if (convoList) {
                convoList.querySelectorAll('.convo-item.active').forEach(el => el.classList.remove('active'));
            }
        });

        // Detector de scroll inteligente en mensajes
        chatMessages?.addEventListener('scroll', () => {
            const distanciaFondo = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
            shouldAutoScroll = distanciaFondo < 100;
        });

        // Adjuntar archivo
        fileInput?.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return cancelarArchivo();

            if (file.size > 15 * 1024 * 1024) {
                mostrarNotificacion('El archivo no puede exceder 15MB.', 'warning');
                return cancelarArchivo();
            }

            if (fileNamePrev) fileNamePrev.textContent = file.name;
            if (fileSizePrev) fileSizePrev.textContent = `(${formatearTamano(file.size)})`;
            if (filePreview) filePreview.style.display = 'flex';
        });

        cancelFileBtn?.addEventListener('click', cancelarArchivo);

        // Filtro por curso
        courseFilter?.addEventListener('change', async () => {
            selectedCourseId = courseFilter.value || null;
            activeContacto = null;
            if (chatActive) chatActive.style.display = 'none';
            if (noChat) noChat.style.display = 'flex';
            if (layout) layout.classList.remove('mobile-chat-open');
            if (refreshInterval) clearInterval(refreshInterval);
            await cargarBandeja();
        });

        // Búsqueda en sidebar
        searchInput?.addEventListener('input', () => {
            const val = (searchInput.value || '').trim();
            if (sidebarClearSearch) sidebarClearSearch.style.display = val ? 'inline-flex' : 'none';
            renderConversaciones(bandeja.conversaciones || []);
        });

        sidebarClearSearch?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            sidebarClearSearch.style.display = 'none';
            renderConversaciones(bandeja.conversaciones || []);
            searchInput?.focus();
        });

        // Botones de nueva conversación
        btnNewChat?.addEventListener('click', abrirModalContactos);
        btnSidebarNewChat?.addEventListener('click', abrirModalContactos);

        // Modal de contactos
        closeModal?.addEventListener('click', () => modal.classList.remove('show'));
        modal?.addEventListener('click', event => {
            if (event.target === modal) modal.classList.remove('show');
        });

        // Búsqueda en el modal
        modalSearchInput?.addEventListener('input', () => {
            const val = (modalSearchInput.value || '').trim();
            if (modalClearSearch) modalClearSearch.style.display = val ? 'inline-flex' : 'none';
            renderContactosModal();
        });

        modalClearSearch?.addEventListener('click', () => {
            if (modalSearchInput) modalSearchInput.value = '';
            modalClearSearch.style.display = 'none';
            renderContactosModal();
            modalSearchInput?.focus();
        });

        // Pestañas de categoría en el modal
        modalCategoryTabs?.addEventListener('click', e => {
            const tab = e.target.closest('.modal-tab');
            if (!tab) return;
            modalCategoryTabs.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            modalFilterRole = tab.dataset.filter || 'all';
            renderContactosModal();
        });

        // Smart Polling: suspender peticiones periódicas cuando la pestaña está en segundo plano
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                    refreshInterval = null;
                }
            } else if (activeContacto) {
                cargarConversacion();
                if (!refreshInterval) {
                    refreshInterval = setInterval(cargarConversacion, 5000);
                }
            }
        });

        // Manejo de escape para cerrar modal
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal?.classList.contains('show')) {
                modal.classList.remove('show');
            }
        });
    }

    // ── Utilidades y Formateadores ──
    function filtrarPorBusqueda(conversaciones) {
        const q = (searchInput?.value || '').trim().toLowerCase();
        if (!q) return conversaciones;

        return conversaciones.filter(item => {
            const contacto = item.contacto || {};
            const preview = String(item.preview || item.ultimoMensaje?.contenido || '');
            return nombreContacto(contacto).toLowerCase().includes(q) ||
                etiquetaRol(contacto).toLowerCase().includes(q) ||
                preview.toLowerCase().includes(q);
        });
    }

    function cancelarArchivo() {
        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';
    }

    function actualizarEstadoEnLinea(contacto) {
        const statusEl = document.getElementById('active-status');
        if (!statusEl) return;

        const info = window.ShidellPresence
            ? window.ShidellPresence.getStatus(contacto)
            : (() => {
                const uc = contacto?.ultimaConexion ? new Date(contacto.ultimaConexion) : null;
                const diff = uc ? (new Date() - uc) / 60000 : Infinity;
                return {
                    state: diff < 3 ? 'online' : diff < 15 ? 'away' : 'offline',
                    label: diff < 3 ? 'En línea' : diff < 15 ? 'Ausente' : 'Desconectado',
                    title: ''
                };
            })();

        const svgMap = {
            online: '../icons/svg/status-online.svg',
            away: '../icons/svg/status-away.svg',
            offline: '../icons/svg/status-offline.svg'
        };
        const colorMap = {
            online: 'var(--green, #157347)',
            away: 'var(--yellow, #b45309)',
            offline: 'var(--text-tertiary, #6e7785)'
        };

        const svgIcon = svgMap[info.state] || svgMap.offline;
        statusEl.title = info.title || info.label;
        statusEl.innerHTML = `<img src="${svgIcon}" class="status-svg-icon" alt="${escapeHtml(info.label)}"> <span>${escapeHtml(info.label)}</span>`;
        statusEl.style.color = colorMap[info.state] || colorMap.offline;
    }

    function renderAvatarEnContenedor(container, persona) {
        if (!container) return;
        container.innerHTML = avatarPersona(persona);
        container.style.background = obtenerFotoPerfil(persona) ? '#e2e8f0' : (persona?.rol === 'DOCENTE' ? 'var(--primary, #144272)' : '#e2e8f0');
        container.style.color = obtenerFotoPerfil(persona) ? 'transparent' : (persona?.rol === 'DOCENTE' ? 'white' : 'var(--text-secondary, #4a525d)');
    }

    function avatarPersona(persona) {
        const foto = obtenerFotoPerfil(persona);
        if (foto) return `<img src="${escapeHtml(foto)}" alt="Foto de perfil">`;
        return escapeHtml(inicialesDe(persona));
    }

    function estiloAvatar(persona) {
        return persona?.rol === 'DOCENTE' && !obtenerFotoPerfil(persona)
            ? 'background:var(--primary, #144272); color:white;'
            : '';
    }

    function nombreContacto(persona) {
        if (!persona) return 'Contacto';
        const nombres = persona.nombres || '';
        const apellidos = persona.apellidos || '';
        const prefijo = (persona.rol === 'DOCENTE' && !nombres.startsWith('Prof.')) ? 'Prof. ' : '';
        return limpiarTexto(`${prefijo}${nombres} ${apellidos}`.trim() || 'Contacto');
    }

    function etiquetaRol(persona) {
        if (persona?.rol === 'DOCENTE') return 'Docente';
        if (persona?.rol === 'ESTUDIANTE') return 'Compañero/a';
        return 'Contacto académico';
    }

    function obtenerFotoPerfil(persona) {
        const foto = persona?.fotoPerfil || persona?.foto_perfil || '';
        return esFotoValida(foto) ? foto : '';
    }

    function esFotoValida(value) {
        return typeof value === 'string' && (
            value.startsWith('data:image/') ||
            value.startsWith('/uploads/') ||
            value.startsWith('http://') ||
            value.startsWith('https://')
        );
    }

    function inicialesDe(persona) {
        const n = (persona?.nombres || '?').trim();
        const a = (persona?.apellidos || '').trim();
        const primera = n.startsWith('Prof.') ? (n.split(' ')[1] || 'P')[0] : n[0];
        const segunda = a ? a[0] : (n[1] || '?');
        return `${primera || '?'}${segunda || '?'}`.toUpperCase();
    }

    function formatearHora(value) {
        if (!value) return '';
        try {
            return new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return '';
        }
    }

    function formatearFechaCabecera(value) {
        if (!value) return '';
        try {
            const fecha = new Date(value);
            const hoy = new Date();
            const ayer = new Date();
            ayer.setDate(hoy.getDate() - 1);

            const esMismoDia = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

            if (esMismoDia(fecha, hoy)) return 'Hoy';
            if (esMismoDia(fecha, ayer)) return 'Ayer';

            return fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: fecha.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined });
        } catch (e) {
            return '';
        }
    }

    function formatearTamano(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const dm = 1;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function limpiarTexto(value) {
        if (!value) return '';
        return String(value)
            .replace(/Ã¡/g, 'á')
            .replace(/Ã©/g, 'é')
            .replace(/Ã­/g, 'í')
            .replace(/Ã³/g, 'ó')
            .replace(/Ãº/g, 'ú')
            .replace(/Ã /g, 'Á')
            .replace(/Ã‰/g, 'É')
            .replace(/Ã /g, 'Í')
            .replace(/Ã“/g, 'Ó')
            .replace(/Ãš/g, 'Ú')
            .replace(/Ã±/g, 'ñ')
            .replace(/Ã‘/g, 'Ñ')
            .replace(/Â¿/g, '¿')
            .replace(/Â¡/g, '¡');
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function mostrarCargando(container, text) {
        if (container) {
            container.innerHTML = `
                <div class="chat-loading-state" style="padding: 24px;">
                    <div class="chat-spinner"></div>
                    <span>${escapeHtml(text)}</span>
                </div>`;
        }
    }

    function mostrarError(container, text) {
        if (container) {
            container.innerHTML = `
                <div style="padding:28px 16px; color:var(--red, #b91c1c); text-align:center;">
                    <p style="font-weight:700; font-size:14px;">${escapeHtml(text)}</p>
                </div>`;
        }
    }

    function mostrarNotificacion(mensaje, tipo = 'info') {
        if (window.Swal) {
            window.Swal.fire({
                text: mensaje,
                icon: tipo,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3500,
                timerProgressBar: true
            });
        } else {
            alert(mensaje);
        }
    }

    function mostrarSinSesion() {
        const main = document.querySelector('.content-area') || document.querySelector('.messaging-layout');
        if (main) {
            main.innerHTML = `
                <div style="padding:48px 24px; text-align:center; color:var(--text-secondary);">
                    <h3>Sesión no detectada</h3>
                    <p style="margin-top:8px;">Por favor inicia sesión para acceder a tu mensajería académica.</p>
                    <a href="/auth/login.html" style="display:inline-block; margin-top:16px; padding:10px 20px; background:var(--primary); color:#fff; border-radius:10px; text-decoration:none; font-weight:700;">Ir al Login</a>
                </div>`;
        }
    }

    // Arrancar la aplicación
    inicializar();
});
