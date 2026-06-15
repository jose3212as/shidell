document.addEventListener('DOMContentLoaded', async () => {
    const user = await window.shidellSession?.obtenerUsuario();
    if (!user) {
        mostrarSinSesion();
        return;
    }
    const studentId = user.id;
    if (!studentId) {
        mostrarSinSesion();
        return;
    }

    const convoList = document.getElementById('convo-list');
    const chatActive = document.getElementById('chat-active');
    const noChat = document.getElementById('no-chat');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send-msg');
    const fileInput = document.getElementById('msg-file');
    const filePreview = document.getElementById('file-preview');
    const fileNamePrev = document.getElementById('file-name-preview');
    const cancelFileBtn = document.getElementById('cancel-file');
    const btnNewChat = document.getElementById('btn-new-chat');
    const modal = document.getElementById('contacts-modal');
    const closeModal = document.getElementById('close-contacts');
    const contactsMod = document.getElementById('contacts-list-modal');
    const courseFilter = document.getElementById('course-filter');
    const searchInput = document.getElementById('chat-search-input');

    let bandeja = { cursos: [], conversaciones: [] };
    let selectedCourseId = null;
    let activeContacto = null;
    let refreshInterval = null;

    async function inicializar() {
        configurarEventos();
        await cargarBandeja();

        const chatId = new URLSearchParams(window.location.search).get('chatId');
        if (chatId) {
            const conversacion = bandeja.conversaciones.find(item => String(item.contacto.id) === String(chatId));
            if (conversacion) abrirConversacion(conversacion.contacto);
        }
    }

    async function cargarBandeja() {
        mostrarCargando(convoList, 'Cargando conversaciones...');

        try {
            const query = selectedCourseId ? `?cursoId=${encodeURIComponent(selectedCourseId)}` : '';
            const response = await fetch(`/api/mensajes/estudiante/${studentId}/bandeja${query}`);
            if (!response.ok) throw new Error('No se pudo cargar la bandeja.');

            bandeja = await response.json();

            renderCursos(bandeja.cursos || []);
            renderConversaciones(bandeja.conversaciones || []);
        } catch (error) {
            mostrarError(convoList, 'No se pudieron cargar tus mensajes.');
        }
    }

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

    function renderConversaciones(conversaciones) {
        const filtradas = filtrarPorBusqueda(conversaciones);

        if (!filtradas.length) {
            convoList.innerHTML = '<p style="padding:20px;color:#94a3b8;text-align:center;">No hay contactos para este filtro.</p>';
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
        const activo = activeContacto && activeContacto.id === contacto.id ? ' active' : '';
        const preview = limpiarTexto(item.preview || etiquetaRol(contacto));
        const hora = item.fechaUltimoMensaje ? formatearHora(item.fechaUltimoMensaje) : '';
        const badge = Number(item.noLeidos || 0) > 0
            ? `<span style="min-width:20px;height:20px;border-radius:999px;background:var(--primary);color:white;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;">${item.noLeidos}</span>`
            : '';

        return `
            <div class="convo-item${activo}" data-id="${escapeHtml(contacto.id)}" data-name="${escapeHtml(nombre.toLowerCase())}" data-role="${escapeHtml(etiquetaRol(contacto).toLowerCase())}">
                <div class="convo-avatar" style="${estiloAvatar(contacto)}">${avatarPersona(contacto)}</div>
                <div class="convo-info" style="flex:1;overflow:hidden;">
                    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
                        <span class="convo-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(nombre)}</span>
                        <span style="display:inline-flex;align-items:center;gap:6px;">
                            ${badge}
                            ${hora ? `<small style="font-size:10px;color:#94a3b8;flex-shrink:0;">${escapeHtml(hora)}</small>` : ''}
                        </span>
                    </div>
                    <span class="convo-preview">${escapeHtml(preview)}</span>
                </div>
            </div>`;
    }

    async function abrirConversacion(contacto) {
        activeContacto = contacto;
        noChat.style.display = 'none';
        chatActive.style.display = 'flex';
        chatMessages.innerHTML = '';

        document.getElementById('active-name').textContent = nombreContacto(contacto);
        renderAvatarEnContenedor(document.getElementById('active-avatar'), contacto);
        actualizarEstadoEnLinea(contacto);
        renderConversaciones(bandeja.conversaciones || []);

        await cargarConversacion();
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(cargarConversacion, 5000);
    }

    async function cargarConversacion() {
        if (!activeContacto) return;

        try {
            const query = selectedCourseId ? `?cursoId=${encodeURIComponent(selectedCourseId)}` : '';
            const response = await fetch(`/api/mensajes/estudiante/${studentId}/conversacion/${activeContacto.id}${query}`);
            if (!response.ok) throw new Error('No se pudo cargar la conversación.');

            const data = await response.json();
            renderMensajes(data.mensajes || []);
            await refrescarResumenBandeja();
        } catch (error) {
            mostrarError(chatMessages, 'No se pudo cargar esta conversación.');
        }
    }

    function renderMensajes(mensajes) {
        const hash = mensajes.map(m => `${m.id}-${m.leido ? 1 : 0}`).join(',');
        if (chatMessages.dataset.hash === hash) return;
        chatMessages.dataset.hash = hash;

        if (!mensajes.length) {
            chatMessages.innerHTML = `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;gap:10px;padding:40px;text-align:center;">
                    <i class="ph ph-chat-circle" style="font-size:52px;opacity:.25;"></i>
                    <p style="font-size:14px;">No hay mensajes en esta conversación.</p>
                </div>`;
            return;
        }

        chatMessages.innerHTML = mensajes.map(mensaje => burbujaMensaje(mensaje)).join('');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function burbujaMensaje(mensaje) {
        const isMine = mensaje.remitente?.id === studentId;
        const remitente = isMine ? bandeja.estudiante : mensaje.remitente;
        const archivo = mensaje.archivoUrl ? archivoHtml(mensaje.archivoUrl) : '';
        const sender = !isMine
            ? `<small style="font-size:11px;font-weight:700;opacity:.75;display:block;margin-bottom:4px;">${escapeHtml(nombreContacto(mensaje.remitente))}</small>`
            : '';

        return `
            <div class="msg-row ${isMine ? 'mine' : 'theirs'}">
                <div class="msg-avatar-inline">${avatarPersona(remitente)}</div>
                <div class="msg-bubble ${isMine ? 'msg-sent' : 'msg-received'}">
                    ${sender}
                    ${archivo}
                    ${mensaje.contenido ? `<div class="msg-content">${escapeHtml(limpiarTexto(mensaje.contenido))}</div>` : ''}
                    <span class="msg-time">${escapeHtml(formatearHora(mensaje.fechaEnvio))}</span>
                </div>
            </div>`;
    }

    function archivoHtml(url) {
        const fileName = decodeURIComponent(String(url).split('_').pop() || 'archivo');
        return `
            <a href="${escapeHtml(url)}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,.08);border-radius:10px;margin-bottom:8px;color:inherit;text-decoration:none;">
                <i class="ph ph-file" style="font-size:22px;flex-shrink:0;"></i>
                <span style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(fileName)}</span>
            </a>`;
    }

    async function enviarMensaje() {
        if (!activeContacto) return;

        const contenido = chatInput.value.trim();
        const archivo = fileInput?.files?.[0] || null;
        if (!contenido && !archivo) return;

        btnSend.disabled = true;
        const formData = new FormData();
        formData.append('remitenteId', studentId);
        formData.append('destinatarioId', activeContacto.id);
        if (selectedCourseId) formData.append('cursoId', selectedCourseId);
        if (contenido) formData.append('contenido', contenido);
        if (archivo) formData.append('archivo', archivo);

        try {
            const response = await fetch('/api/mensajes/enviar', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('No se pudo enviar.');

            chatInput.value = '';
            cancelarArchivo();
            chatMessages.dataset.hash = '';
            await cargarConversacion();
            await cargarBandeja();
        } catch (error) {
            alert('No se pudo enviar el mensaje.');
        } finally {
            btnSend.disabled = false;
            chatInput.focus();
        }
    }

    async function refrescarResumenBandeja() {
        const query = selectedCourseId ? `?cursoId=${encodeURIComponent(selectedCourseId)}` : '';
        const response = await fetch(`/api/mensajes/estudiante/${studentId}/bandeja${query}`).catch(() => null);
        if (!response || !response.ok) return;

        const next = await response.json();
        bandeja = next;
        renderConversaciones(bandeja.conversaciones || []);
    }

    function configurarEventos() {
        btnSend?.addEventListener('click', event => {
            event.preventDefault();
            enviarMensaje();
        });

        chatInput?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                enviarMensaje();
            }
        });

        fileInput?.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return cancelarArchivo();
            fileNamePrev.textContent = file.name;
            filePreview.style.display = 'flex';
        });

        cancelFileBtn?.addEventListener('click', cancelarArchivo);

        courseFilter?.addEventListener('change', async () => {
            selectedCourseId = courseFilter.value || null;
            activeContacto = null;
            chatActive.style.display = 'none';
            noChat.style.display = 'flex';
            await cargarBandeja();
        });

        searchInput?.addEventListener('input', () => {
            renderConversaciones(bandeja.conversaciones || []);
        });

        btnNewChat?.addEventListener('click', () => {
            modal.classList.add('show');
            const conversaciones = bandeja.conversaciones || [];
            if (!conversaciones.length) {
                contactsMod.innerHTML = '<p style="padding:20px;text-align:center;color:#94a3b8;">Sin contactos disponibles.</p>';
                return;
            }
            contactsMod.innerHTML = conversaciones.map(item => tarjetaModalContacto(item.contacto)).join('');
            contactsMod.querySelectorAll('.convo-item').forEach(element => {
                element.addEventListener('click', () => {
                    const contacto = conversaciones.find(item => String(item.contacto.id) === element.dataset.id)?.contacto;
                    if (!contacto) return;
                    modal.classList.remove('show');
                    abrirConversacion(contacto);
                });
            });
        });

        closeModal?.addEventListener('click', () => modal.classList.remove('show'));
        modal?.addEventListener('click', event => {
            if (event.target === modal) modal.classList.remove('show');
        });
    }

    function tarjetaModalContacto(contacto) {
        return `
            <div class="convo-item" data-id="${escapeHtml(contacto.id)}">
                <div class="convo-avatar" style="${estiloAvatar(contacto)}">${avatarPersona(contacto)}</div>
                <div class="convo-info">
                    <span class="convo-name">${escapeHtml(nombreContacto(contacto))}</span>
                    <span class="convo-preview">${escapeHtml(etiquetaRol(contacto))}</span>
                </div>
            </div>`;
    }

    function filtrarPorBusqueda(conversaciones) {
        const q = (searchInput?.value || '').trim().toLowerCase();
        if (!q) return conversaciones;

        return conversaciones.filter(item => {
            const contacto = item.contacto || {};
            return nombreContacto(contacto).toLowerCase().includes(q) ||
                etiquetaRol(contacto).toLowerCase().includes(q) ||
                String(item.preview || '').toLowerCase().includes(q);
        });
    }

    function cancelarArchivo() {
        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';
    }

    function actualizarEstadoEnLinea(contacto) {
        const statusEl = document.getElementById('active-status');
        if (!statusEl) return;

        const ultimaConexion = contacto?.ultimaConexion ? new Date(contacto.ultimaConexion) : null;
        const diffSeconds = ultimaConexion ? (new Date() - ultimaConexion) / 1000 : Infinity;
        const online = diffSeconds < 60;
        const away = diffSeconds >= 60 && diffSeconds < 300;
        const color = online ? 'var(--green)' : away ? 'var(--yellow)' : '#94a3b8';
        const label = online ? 'En linea' : away ? 'Ausente' : 'Desconectado';

        statusEl.innerHTML = `<span style="width:6px;height:6px;background:${color};border-radius:50%;display:inline-block;"></span> ${label}`;
        statusEl.style.color = color;
    }

    function renderAvatarEnContenedor(container, persona) {
        if (!container) return;
        container.innerHTML = avatarPersona(persona);
        container.style.background = obtenerFotoPerfil(persona) ? '#e2e8f0' : (persona?.rol === 'DOCENTE' ? 'var(--primary)' : '#e2e8f0');
        container.style.color = obtenerFotoPerfil(persona) ? 'transparent' : (persona?.rol === 'DOCENTE' ? 'white' : 'var(--text-secondary)');
    }

    function avatarPersona(persona) {
        const foto = obtenerFotoPerfil(persona);
        if (foto) return `<img src="${escapeHtml(foto)}" alt="Foto de perfil">`;
        return escapeHtml(inicialesDe(persona));
    }

    function estiloAvatar(persona) {
        return persona?.rol === 'DOCENTE' && !obtenerFotoPerfil(persona)
            ? 'background:var(--primary);color:white;'
            : '';
    }

    function nombreContacto(persona) {
        if (!persona) return 'Contacto';
        const prefijo = persona.rol === 'DOCENTE' ? 'Prof. ' : '';
        return limpiarTexto(`${prefijo}${persona.nombres || ''} ${persona.apellidos || ''}`.trim() || 'Contacto');
    }

    function etiquetaRol(persona) {
        if (persona?.rol === 'DOCENTE') return 'Docente';
        if (persona?.rol === 'ESTUDIANTE') return 'Companero/a';
        return 'Contacto academico';
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
        return `${(persona?.nombres || '?')[0] || '?'}${(persona?.apellidos || '?')[0] || '?'}`.toUpperCase();
    }

    function formatearHora(value) {
        if (!value) return '';
        return new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    }

    function limpiarTexto(value) {
        let text = String(value || '');
        for (let i = 0; i < 3 && /[\u00C2\u00C3]/.test(text); i++) {
            try {
                const decoded = decodeURIComponent(escape(text));
                if (decoded === text) break;
                text = decoded;
            } catch (error) {
                break;
            }
        }
        return text;
    }

    function mostrarCargando(container, text) {
        if (container) container.innerHTML = `<p style="padding:16px 20px;color:#94a3b8;font-size:13px;">${escapeHtml(text)}</p>`;
    }

    function mostrarError(container, text) {
        if (container) container.innerHTML = `<p style="padding:20px;color:#ef4444;text-align:center;">${escapeHtml(text)}</p>`;
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

    function mostrarSinSesion() {
        const main = document.querySelector('.messages-layout') || document.querySelector('.content-area');
        if (main) {
            main.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Inicia sesión para ver tus mensajes.</p>';
        }
    }

    inicializar();
});
