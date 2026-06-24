// Shidell - Mensajería Padre de Familia
// El padre puede chatear con los docentes y con sus hijos vinculados.
document.addEventListener('DOMContentLoaded', () => {
    // FIXED: usar shidell_user (clave que escribe el login)
    const stored = localStorage.getItem('shidell_user');
    if (!stored) { window.location.href = '/login.html'; return; }
    const padre   = JSON.parse(stored);
    if (padre.rol !== 'PADRE') { window.location.href = '/login.html'; return; }
    const padreId = padre.id;

    const convoList    = document.getElementById('convo-list');
    const chatActive   = document.getElementById('chat-active');
    const noChat       = document.getElementById('no-chat');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput    = document.getElementById('chat-input');
    const btnSend      = document.getElementById('btn-send-msg');
    const fileInput    = document.getElementById('msg-file');
    const filePreview  = document.getElementById('file-preview');
    const fileNamePrev = document.getElementById('file-name-preview');
    const cancelFile   = document.getElementById('cancel-file');
    const btnNewChat   = document.getElementById('btn-new-chat');
    const modal        = document.getElementById('contacts-modal');
    const closeModal   = document.getElementById('close-contacts');
    const contactsMod  = document.getElementById('contacts-list-modal');
    const searchInput  = document.getElementById('chat-search-input');

    let activeContacto  = null;
    let refreshInterval = null;
    let hijoActivo      = null;
    let eventosConfigurados = false;
    let chatInicialAbierto = false;

    configurarEventos();
    cargarContactos();

    // Si app.js avisa un hijo activo, refrescamos sin limitar la lista a un solo hijo.
    window.addEventListener('hijo-cargado', async (e) => {
        hijoActivo = e.detail;
        await cargarContactos();
    });

    async function cargarContactos() {
        try {
            const [resR, resH] = await Promise.all([
                fetch(`/api/mensajes/recientes/${padreId}`),
                fetch(`/api/admin/padres/${padreId}/hijos`)
            ]);

            const recientes = resR.ok ? await resR.json() : [];
            const hijos     = resH.ok ? await resH.json() : [];
            const hijosBase = hijos.length > 0 ? hijos : (hijoActivo ? [hijoActivo] : []);
            const respuestasContactos = await Promise.all(
                hijosBase.map(h => fetch(`/api/users/contacts/${h.id}`).catch(() => ({ ok: false })))
            );
            const contactosPorHijo = await Promise.all(
                respuestasContactos.map(res => res.ok ? res.json() : [])
            );

            const docentes = contactosPorHijo.flat().filter(c => c.rol === 'DOCENTE');

            // Fusionar recientes + docentes + hijos vinculados (sin duplicados)
            const ids = new Set(recientes.map(c => c.id));
            const contactos = [...recientes];
            docentes.forEach(d => { if (!ids.has(d.id)) { contactos.push(d); ids.add(d.id); } });
            hijos.forEach(h => { if (!ids.has(h.id)) { contactos.push(h); ids.add(h.id); } });

            renderContactos(contactos);
            abrirChatInicial();
        } catch (e) { console.error(e); }
    }

    function renderContactos(contactos) {
        convoList.innerHTML = '';
        if (!contactos || contactos.length === 0) {
            convoList.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8;">Sin contactos.</p>';
            return;
        }
        contactos.forEach(c => {
            const initials = ((c.nombres||'?')[0] + (c.apellidos||'?')[0]).toUpperCase();
            const nombre   = nombreContacto(c);
            const item = document.createElement('div');
            item.className = `convo-item${activeContacto && activeContacto.id === c.id ? ' active' : ''}`;
            item.dataset.id   = c.id;
            item.dataset.name = nombre.toLowerCase();
            item.innerHTML = `
                <div class="convo-avatar" style="${estiloAvatar(c)}">${avatarPersona(c, initials)}</div>
                <div class="convo-info">
                    <span class="convo-name">${nombre}</span>
                    <span class="convo-preview">${etiquetaContacto(c)}</span>
                </div>`;
            item.onclick = () => seleccionarChat(c, item);
            convoList.appendChild(item);
        });
    }

    function seleccionarChat(contacto, element) {
        activeContacto = contacto;
        convoList.querySelectorAll('.convo-item').forEach(el => el.classList.remove('active'));
        if (element) element.classList.add('active');

        noChat.style.display    = 'none';
        chatActive.style.display = 'flex';
        chatMessages.innerHTML  = '';
        chatMessages.dataset.hash = '';

        document.getElementById('active-name').textContent   = nombreContacto(contacto);
        renderAvatarEnContenedor(document.getElementById('active-avatar'), contacto);

        cargarMensajes();
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(cargarMensajes, 4000);
    }

    async function cargarMensajes() {
        if (!activeContacto) return;
        try {
            const res = await fetch(`/api/mensajes/conversacion?u1=${padreId}&u2=${activeContacto.id}`);
            if (!res.ok) return;
            const msgs = await res.json();

            const hash = msgs.map(m => `${m.id}${m.leido?1:0}`).join(',');
            if (chatMessages.dataset.hash === hash) return;
            chatMessages.dataset.hash = hash;

            chatMessages.innerHTML = '';
            if (msgs.length === 0) {
                chatMessages.innerHTML = `
                    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;gap:10px;padding:40px;text-align:center;">
                        <i class="ph ph-chat-circle" style="font-size:52px;opacity:0.25;"></i>
                        <p>No hay mensajes aún. Escribe el primer mensaje.</p>
                    </div>`;
                return;
            }

            msgs.forEach(m => {
                const isMine = m.remitente.id == padreId;
                const remitente = isMine ? (window._padreActual || padre) : m.remitente;
                const row = document.createElement('div');
                row.className = `msg-row ${isMine ? 'mine' : 'theirs'}`;
                const bubble = document.createElement('div');
                bubble.className = `msg-bubble ${isMine ? 'msg-sent' : 'msg-received'}`;
                let fileHtml = '';
                if (m.archivoUrl) {
                    const fn = decodeURIComponent(m.archivoUrl.split('_').pop());
                    const ext = fn.split('.').pop().toLowerCase();
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                        fileHtml = `<a href="${m.archivoUrl}" target="_blank"><img src="${m.archivoUrl}" class="file-image-preview" alt="Imagen adjunta"></a>`;
                    } else {
                        fileHtml = `<a href="${m.archivoUrl}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(0,0,0,0.08);border-radius:8px;margin-bottom:8px;color:inherit;text-decoration:none;"><i class="ph ph-file" style="font-size:20px;"></i><span style="font-size:12px;font-weight:600;">${fn}</span></a>`;
                    }
                }
                const time = new Date(m.fechaEnvio).toLocaleTimeString('es-PE', {hour:'2-digit',minute:'2-digit'});
                bubble.innerHTML = `${fileHtml}<div>${m.contenido||''}</div><span class="msg-time">${time}</span>`;
                const avatar = document.createElement('div');
                avatar.className = 'msg-avatar-inline';
                renderAvatarEnContenedor(avatar, remitente);
                if (isMine) {
                    row.appendChild(bubble);
                    row.appendChild(avatar);
                } else {
                    row.appendChild(avatar);
                    row.appendChild(bubble);
                }
                chatMessages.appendChild(row);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (e) { console.error(e); }
    }

    async function enviarMensaje() {
        if (!activeContacto) return;
        const contenido = chatInput.value.trim();
        const archivo   = fileInput?.files[0];
        if (!contenido && !archivo) return;

        chatInput.value = '';
        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';
        if (btnSend) btnSend.disabled = true;

        try {
            const fd = new FormData();
            fd.append('remitenteId',    padreId);
            fd.append('destinatarioId', activeContacto.id);
            if (contenido) fd.append('contenido', contenido);
            if (archivo)   fd.append('archivo', archivo);

            const res = await fetch('/api/mensajes/enviar', { method: 'POST', body: fd });
            if (res.ok) {
                chatMessages.dataset.hash = '';
                await cargarMensajes();
            }
        } catch (e) { console.error(e); }
        finally { if (btnSend) btnSend.disabled = false; chatInput.focus(); }
    }

    function configurarEventos() {
        if (eventosConfigurados) return;
        eventosConfigurados = true;

        if (btnSend)   btnSend.onclick   = enviarMensaje;
        if (chatInput) chatInput.onkeypress = e => { if (e.key === 'Enter') { e.preventDefault(); enviarMensaje(); } };
        if (fileInput) fileInput.onchange = () => {
            if (fileInput.files[0]) {
                if (fileNamePrev) fileNamePrev.textContent = fileInput.files[0].name;
                if (filePreview)  filePreview.style.display = 'block';
            }
        };
        if (cancelFile) cancelFile.onclick = () => {
            if (fileInput) fileInput.value = '';
            if (filePreview) filePreview.style.display = 'none';
        };
        if (searchInput) searchInput.oninput = () => {
            const q = searchInput.value.toLowerCase();
            convoList.querySelectorAll('.convo-item').forEach(el => {
                el.style.display = (el.dataset.name||'').includes(q) ? 'flex' : 'none';
            });
        };
        if (btnNewChat) {
            btnNewChat.onclick = async () => {
                modal.classList.add('show');
                contactsMod.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8;">Cargando...</p>';
                try {
                    const resHijos = await fetch(`/api/admin/padres/${padreId}/hijos`);
                    const hijos = resHijos?.ok ? await resHijos.json() : [];
                    const hijosBase = hijos.length > 0 ? hijos : (hijoActivo ? [hijoActivo] : []);
                    const respuestasContactos = await Promise.all(
                        hijosBase.map(h => fetch(`/api/users/contacts/${h.id}`).catch(() => ({ ok: false })))
                    );
                    const contactosPorHijo = await Promise.all(
                        respuestasContactos.map(res => res.ok ? res.json() : [])
                    );
                    const docentes = contactosPorHijo.flat().filter(c => c.rol === 'DOCENTE');
                    const ids = new Set();
                    const contactos = [];
                    docentes.forEach(c => { if (!ids.has(c.id)) { contactos.push(c); ids.add(c.id); } });
                    hijos.forEach(c => { if (!ids.has(c.id)) { contactos.push(c); ids.add(c.id); } });

                    contactsMod.innerHTML = '';
                    if (contactos.length === 0) {
                        contactsMod.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8;">Sin contactos disponibles.</p>';
                        return;
                    }
                    contactos.forEach(c => {
                        const div = document.createElement('div');
                        div.className = 'convo-item';
                        div.innerHTML = `<div class="convo-avatar" style="${estiloAvatar(c)}">${avatarPersona(c)}</div><div class="convo-info"><span class="convo-name">${nombreContacto(c)}</span><span class="convo-preview">${etiquetaContacto(c)}</span></div>`;
                        div.onclick = () => {
                            modal.classList.remove('show');
                            let ex = convoList.querySelector(`[data-id="${c.id}"]`);
                            if (!ex) {
                                const initials = ((c.nombres||'?')[0] + (c.apellidos||'?')[0]).toUpperCase();
                                const nombre   = nombreContacto(c);
                                ex = document.createElement('div');
                                ex.className = 'convo-item';
                                ex.dataset.id   = c.id;
                                ex.dataset.name = nombre.toLowerCase();
                                ex.innerHTML = `<div class="convo-avatar" style="${estiloAvatar(c)}">${avatarPersona(c, initials)}</div>
                                                <div class="convo-info">
                                                    <span class="convo-name">${nombre}</span>
                                                    <span class="convo-preview">${etiquetaContacto(c)}</span>
                                                </div>`;
                                ex.onclick = () => seleccionarChat(c, ex);
                                convoList.prepend(ex);
                            }
                            seleccionarChat(c, ex);
                        };
                        contactsMod.appendChild(div);
                    });
                } catch (e) { contactsMod.innerHTML = '<p style="color:#ef4444; padding:20px; text-align:center;">Error.</p>'; }
            };
        }
        if (closeModal) closeModal.onclick = () => modal.classList.remove('show');
        if (modal)      modal.onclick = e => { if (e.target === modal) modal.classList.remove('show'); };
    }

    function estiloAvatar(persona) {
        return primeraFotoValida(persona?.fotoPerfil, persona?.foto_perfil)
            ? 'background:var(--teal-light); color:transparent;'
            : 'background:var(--primary); color:white;';
    }

    function abrirChatInicial() {
        if (chatInicialAbierto) return;
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get('chatId');
        if (!chatId) return;

        const item = convoList.querySelector(`.convo-item[data-id="${chatId}"]`);
        if (item) {
            chatInicialAbierto = true;
            item.click();
        }
    }

    function nombreContacto(persona) {
        const nombre = `${persona?.nombres || ''} ${persona?.apellidos || ''}`.trim() || 'Contacto';
        return persona?.rol === 'DOCENTE' ? `Prof. ${nombre}` : nombre;
    }

    function etiquetaContacto(persona) {
        if (persona?.rol === 'DOCENTE') return 'Docente';
        if (persona?.rol === 'ESTUDIANTE') return 'Hijo/a';
        return persona?.rol || 'Contacto';
    }
});
