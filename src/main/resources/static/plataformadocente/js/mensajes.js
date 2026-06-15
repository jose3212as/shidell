instalarAuthFetchDocente();

function instalarAuthFetchDocente() {
    if (window.__shidellAuthFetch) return;
    window.__shidellAuthFetch = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('shidell_user') || 'null'); } catch {}
        if (!user?.sessionToken) return originalFetch(input, init);
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${user.sessionToken}`);
        return originalFetch(input, { ...init, headers });
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '' : 'http://localhost:8080';
    const defaultTeacherEmail = 'profesor@shidell.edu';

    const convoList = document.getElementById('convo-list');
    const chatActive = document.getElementById('chat-active');
    const noChat = document.getElementById('no-chat');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send-msg');
    const fileInput = document.getElementById('msg-file');
    const filePreview = document.getElementById('file-preview');
    const fileNamePreview = document.getElementById('file-name-preview');
    const courseFilter = document.getElementById('course-filter');

    const state = {
        docente: null,
        cursos: [],
        conversaciones: [],
        activeContact: null,
        selectedCourseId: null,
        refreshInterval: null
    };

    document.getElementById('btn-logout')?.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('shidell_user');
        location.href = '/login.html';
    });

    courseFilter.addEventListener('change', async () => {
        state.selectedCourseId = courseFilter.value || null;
        state.activeContact = null;
        closeChat();
        await cargarBandeja();
    });

    fileInput.onchange = () => {
        if (fileInput.files[0]) {
            fileNamePreview.textContent = fileInput.files[0].name;
            filePreview.style.display = 'block';
        }
    };

    window.cancelFile = () => {
        fileInput.value = '';
        filePreview.style.display = 'none';
    };

    btnSend.onclick = enviarMensaje;
    chatInput.onkeypress = (event) => {
        if (event.key === 'Enter') enviarMensaje();
    };

    window.nuevoChat = abrirContactos;
    window.closeContacts = () => {
        document.getElementById('contacts-modal').style.display = 'none';
    };

    inicializar();

    async function inicializar() {
        convoList.innerHTML = emptyState('Cargando bandeja desde el API...');
        try {
            const docente = await api(`/api/docente/buscar?email=${encodeURIComponent(getTeacherEmail())}`);
            if (!docente?.id || docente.rol !== 'DOCENTE') throw new Error('Sesión docente inválida');

            state.docente = docente;
            renderTeacher(docente);
            setupSearch();
            iniciarPing(docente.id);
            await cargarBandeja();
        } catch (error) {
            document.getElementById('teacher-context').textContent = 'Error al conectar con el API del docente';
            convoList.innerHTML = emptyState(error.message || 'No se pudo cargar la bandeja.', true);
        }
    }

    async function cargarBandeja() {
        if (!state.docente?.id) return;
        const query = state.selectedCourseId ? `?cursoId=${state.selectedCourseId}` : '';
        const bandeja = await api(`/api/mensajes/docente/${state.docente.id}/bandeja${query}`);

        state.cursos = Array.isArray(bandeja.cursos) ? bandeja.cursos : [];
        state.conversaciones = Array.isArray(bandeja.conversaciones) ? bandeja.conversaciones : [];
        renderCourseFilter();
        renderConversations();
    }

    function renderCourseFilter() {
        const selected = state.selectedCourseId || '';
        courseFilter.innerHTML = '<option value="">Todos los cursos</option>'
            + state.cursos.map((curso) => `<option value="${curso.id}">${escapeHtml(nombreCurso(curso))}</option>`).join('');
        courseFilter.value = selected;
    }

    function renderConversations() {
        if (!state.conversaciones.length) {
            convoList.innerHTML = emptyState('No hay alumnos o conversaciones para el curso seleccionado.');
            return;
        }

        convoList.innerHTML = state.conversaciones.map((item) => {
            const contacto = item.contacto || {};
            const active = state.activeContact?.id === contacto.id ? 'active' : '';
            const unread = Number(item.noLeidos || 0);
            const isOnline = estaEnLinea(contacto.ultimaConexion);
            
            return `
                <div class="convo-item ${active}" data-contact-id="${contacto.id}">
                    <div class="convo-avatar" style="position:relative;">
                        ${avatarPersona(contacto)}
                        <span style="position:absolute; bottom:0; right:0; width:12px; height:12px; border:2px solid white; border-radius:50%; background:${isOnline ? '#22c55e' : '#94a3b8'};"></span>
                    </div>
                    <div class="convo-info">
                        <span class="convo-name">${escapeHtml(nombreCompleto(contacto))}</span>
                        <span class="convo-preview">${escapeHtml(item.preview || contacto.rol || 'Contacto académico')} ${isOnline ? '· <span style="color:#22c55e">En línea</span>' : ''}</span>
                    </div>
                    ${unread ? `<span class="unread-pill">${unread}</span>` : ''}
                </div>
            `;
        }).join('');

        convoList.querySelectorAll('.convo-item').forEach((item) => {
            item.addEventListener('click', () => {
                const conversation = state.conversaciones.find((conv) => String(conv.contacto?.id) === item.dataset.contactId);
                if (conversation?.contacto) seleccionarChat(conversation.contacto);
            });
        });
    }

    async function seleccionarChat(contacto) {
        state.activeContact = contacto;
        noChat.style.display = 'none';
        chatActive.style.display = 'flex';
        
        // Actualizar header con datos frescos (especialmente el estado)
        actualizarHeaderActivo(contacto);
        
        renderAvatarEnContenedor(document.getElementById('active-avatar'), contacto);
        renderConversations();
        await cargarMensajes();
        if (state.refreshInterval) clearInterval(state.refreshInterval);
        state.refreshInterval = setInterval(async () => {
            await cargarMensajes();
            // Refrescar datos del contacto para actualizar el estado online
            try {
                const freshContact = await api(`/api/users/${state.activeContact.id}`);
                if (freshContact) {
                    state.activeContact = freshContact;
                    actualizarHeaderActivo(freshContact);
                }
            } catch {}
        }, 3000);
    }

    function actualizarHeaderActivo(contacto) {
        const isOnline = estaEnLinea(contacto.ultimaConexion);
        document.getElementById('active-name').textContent = nombreCompleto(contacto);
        const statusEl = document.getElementById('active-status');
        statusEl.textContent = isOnline ? 'En línea' : `Desconectado (últ. vez: ${formatearFechaRelativa(contacto.ultimaConexion)})`;
        statusEl.style.color = isOnline ? '#22c55e' : '#64748b';
    }

    async function cargarMensajes() {
        if (!state.activeContact?.id || !state.docente?.id) return;
        const query = state.selectedCourseId ? `?cursoId=${state.selectedCourseId}` : '';
        try {
            const data = await api(`/api/mensajes/docente/${state.docente.id}/conversacion/${state.activeContact.id}${query}`);
            const mensajes = Array.isArray(data.mensajes) ? data.mensajes : [];
            const currentHash = mensajes.map((m) => `${m.id}-${m.leido}`).join(',');
            if (chatMessages.dataset.hash === currentHash) return;
            chatMessages.dataset.hash = currentHash;

            chatMessages.innerHTML = mensajes.length
                ? mensajes.map(renderMessage).join('')
                : '<div style="text-align:center;color:var(--text-tertiary);padding:24px;">Aún no hay mensajes en esta conversación.</div>';
            chatMessages.scrollTop = chatMessages.scrollHeight;
            await cargarBandeja();
        } catch (error) {
            chatMessages.innerHTML = '<div style="text-align:center;color:var(--red);padding:24px;">No se pudo cargar la conversación.</div>';
        }
    }

    function renderMessage(mensaje) {
        const remitente = mensaje.remitente || {};
        const isMine = remitente.id === state.docente.id;
        const fileHtml = mensaje.archivoUrl ? renderFile(mensaje.archivoUrl) : '';
        const time = mensaje.fechaEnvio
            ? new Date(mensaje.fechaEnvio).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
            : '';

        return `
            <div class="msg-row ${isMine ? 'mine' : 'theirs'}">
                <div class="msg-avatar-inline">${avatarPersona(remitente)}</div>
                <div class="msg-bubble ${isMine ? 'msg-sent' : 'msg-received'}">
                    ${fileHtml}
                    <div class="msg-content">${escapeHtml(limpiarTexto(mensaje.contenido || ''))}</div>
                    <span class="msg-time">${escapeHtml(time)}</span>
                </div>
            </div>
        `;
    }

    function renderFile(url) {
        const fileName = limpiarTexto(url.split('_').pop() || 'Archivo');
        return `
            <a href="${API_BASE}${escapeHtml(url)}" target="_blank" style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.05); padding:8px; border-radius:8px; margin-bottom:8px; color:inherit; text-decoration:none; border:1px solid rgba(0,0,0,0.1);">
                <i class="ph ph-paperclip" style="font-size:22px;"></i>
                <div style="overflow:hidden;">
                    <div style="font-size:11px; font-weight:700; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${escapeHtml(fileName)}</div>
                    <div style="font-size:9px; opacity:0.7;">Abrir archivo</div>
                </div>
            </a>
        `;
    }

    async function enviarMensaje() {
        if (!state.activeContact?.id || !state.docente?.id) return;
        const contenido = chatInput.value.trim();
        const archivo = fileInput.files[0];
        if (!contenido && !archivo) return;

        chatInput.value = '';
        cancelFile();

        const formData = new FormData();
        formData.append('remitenteId', state.docente.id);
        formData.append('destinatarioId', state.activeContact.id);
        if (state.selectedCourseId) formData.append('cursoId', state.selectedCourseId);
        if (contenido) formData.append('contenido', contenido);
        if (archivo) formData.append('archivo', archivo);

        btnSend.disabled = true;
        try {
            await api('/api/mensajes/enviar', { method: 'POST', body: formData });
            chatMessages.dataset.hash = '';
            await cargarMensajes();
        } catch (error) {
            chatInput.value = contenido;
        } finally {
            btnSend.disabled = false;
        }
    }

    function abrirContactos() {
        const modal = document.getElementById('contacts-modal');
        const list = document.getElementById('contacts-list');
        modal.style.display = 'flex';

        if (!state.conversaciones.length) {
            list.innerHTML = emptyState('No hay contactos disponibles.');
            return;
        }

        list.innerHTML = state.conversaciones.map((item) => {
            const contacto = item.contacto || {};
            return `
                <div class="convo-item" data-contact-id="${contacto.id}">
                    <div class="convo-avatar">${avatarPersona(contacto)}</div>
                    <div class="convo-info">
                        <span class="convo-name">${escapeHtml(nombreCompleto(contacto))}</span>
                        <span class="convo-preview">${escapeHtml(contacto.rol || 'Contacto')}</span>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.convo-item').forEach((item) => {
            item.addEventListener('click', () => {
                const conversation = state.conversaciones.find((conv) => String(conv.contacto?.id) === item.dataset.contactId);
                if (conversation?.contacto) {
                    seleccionarChat(conversation.contacto);
                    closeContacts();
                }
            });
        });
    }

    function setupSearch() {
        const searchInput = document.querySelector('.search-input-wrapper input');
        if (!searchInput) return;
        searchInput.oninput = () => {
            const q = normalizar(searchInput.value);
            convoList.querySelectorAll('.convo-item').forEach((item) => {
                const text = normalizar(item.textContent || '');
                item.style.display = text.includes(q) ? 'flex' : 'none';
            });
        };
    }

    function closeChat() {
        if (state.refreshInterval) clearInterval(state.refreshInterval);
        state.refreshInterval = null;
        chatMessages.dataset.hash = '';
        chatMessages.innerHTML = '';
        chatActive.style.display = 'none';
        noChat.style.display = 'flex';
    }

    async function api(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, options);
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    function renderTeacher(docente) {
        document.getElementById('user-name-label').textContent = nombreCompleto(docente);
        document.getElementById('teacher-context').textContent = `${nombreCompleto(docente)} · bandeja conectada al API`;
        renderAvatarEnContenedor(document.getElementById('profile-avatar'), docente);
    }

    function getTeacherEmail() {
        try {
            const user = JSON.parse(localStorage.getItem('shidell_user') || 'null');
            return user?.rol === 'DOCENTE' && user.email ? user.email : defaultTeacherEmail;
        } catch (error) {
            return defaultTeacherEmail;
        }
    }

    function iniciarPing(userId) {
        if (!userId) return;
        const ping = () => fetch(`/api/users/${userId}/ping`, { method: 'PUT' }).catch(() => {});
        ping();
        setInterval(ping, 30000);
    }

    function estaEnLinea(ultimaConexion) {
        if (!ultimaConexion) return false;
        const last = new Date(ultimaConexion).getTime();
        const now = Date.now();
        // Definimos online como actividad en los últimos 60 segundos
        return (now - last) < 60000;
    }

    function formatearFechaRelativa(fecha) {
        if (!fecha) return 'nunca';
        const d = new Date(fecha);
        if (isNaN(d)) return 'fecha inválida';
        const diff = Date.now() - d.getTime();
        if (diff < 60000) return 'hace un momento';
        if (diff < 3600000) return `hace ${Math.floor(diff/60000)} min`;
        if (diff < 86400000) return `hace ${Math.floor(diff/3600000)} h`;
        return d.toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
    }

    function nombreCurso(curso = {}) {
        return [limpiarTexto(curso.nombre || 'Curso'), curso.grado ? `${curso.grado}° ${curso.seccion || ''}`.trim() : ''].filter(Boolean).join(' - ');
    }

    function nombreCompleto(persona = {}) {
        return limpiarTexto(`${persona.nombres || ''} ${persona.apellidos || ''}`).trim() || 'Docente';
    }

    function avatarPersona(persona) {
        const fotoPerfil = primeraFotoValida(persona?.fotoPerfil, persona?.foto_perfil);
        if (fotoPerfil) return `<img src="${escapeHtml(fotoPerfil)}" alt="Foto de perfil">`;
        return escapeHtml(inicialesDe(persona));
    }

    function renderAvatarEnContenedor(contenedor, persona) {
        if (!contenedor) return;
        const fotoPerfil = primeraFotoValida(persona?.fotoPerfil, persona?.foto_perfil);
        contenedor.innerHTML = fotoPerfil
            ? `<img src="${escapeHtml(fotoPerfil)}" alt="Foto de perfil">`
            : escapeHtml(inicialesDe(persona));
        contenedor.style.color = fotoPerfil ? 'transparent' : 'var(--text-secondary)';
    }

    function inicialesDe(persona) {
        return `${(limpiarTexto(persona?.nombres || '?')[0]) || '?'}${(limpiarTexto(persona?.apellidos || '?')[0]) || '?'}`.toUpperCase();
    }

    function primeraFotoValida(...valores) {
        return valores.find((valor) => {
            if (typeof valor !== 'string') return false;
            const foto = valor.trim();
            return foto.startsWith('data:image/') || foto.startsWith('/uploads/') || foto.startsWith('http://') || foto.startsWith('https://');
        }) || '';
    }

    function normalizar(value) {
        return limpiarTexto(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    function limpiarTexto(value) {
        let text = String(value ?? '');
        for (let i = 0; i < 2 && /Ã|Â/.test(text); i++) {
            try {
                const fixed = decodeURIComponent(escape(text));
                if (!fixed || fixed === text) break;
                text = fixed;
            } catch (error) {
                break;
            }
        }
        return text.replace(/Â/g, '');
    }

    function emptyState(text, error = false) {
        return `<div style="padding:20px; color:${error ? 'var(--red)' : 'var(--text-tertiary)'}; text-align:center;">${escapeHtml(text)}</div>`;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }
});
