// Shidell - Mensajería Padre de Familia
// El padre puede chatear con los docentes y con sus hijos vinculados.
document.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem('shidell_user');
    if (!stored) { window.location.href = '/login.html'; return; }
    const padre = JSON.parse(stored);
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

    const CONTACTS_POLL_MS = 10000;
    const MESSAGES_POLL_MS = 4000;

    let activeContacto      = null;
    let refreshInterval     = null;
    let presenceInterval    = null;
    let hijoActivo          = null;
    let eventosConfigurados = false;
    let chatInicialAbierto  = false;
    let cargandoContactos   = false;
    const contactosById     = new Map();

    configurarEventos();
    cargarContactos();
    presenceInterval = window.setInterval(() => {
        if (document.visibilityState !== 'hidden') {
            cargarContactos();
        }
        if (activeContacto) {
            actualizarEstadoEnLinea(activeContacto);
        }
    }, CONTACTS_POLL_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            cargarContactos();
            if (activeContacto) cargarMensajes();
        }
    });

    window.addEventListener('hijo-cargado', async (e) => {
        hijoActivo = e.detail;
        await cargarContactos();
    });

    function parseTimestamp(value) {
        if (!value) return -1;
        const ms = Date.parse(value);
        return Number.isNaN(ms) ? -1 : ms;
    }

    function elegirUltimaConexion(actual, candidato) {
        const msActual = parseTimestamp(actual);
        const msCand = parseTimestamp(candidato);
        if (msCand > msActual) return candidato;
        return actual ?? candidato ?? null;
    }

    function fusionarContacto(mapa, entrada) {
        if (!entrada || entrada.id == null) return;
        const key = String(entrada.id);
        const prev = mapa.get(key);
        if (!prev) {
            mapa.set(key, { ...entrada });
            return;
        }
        mapa.set(key, {
            ...entrada,
            ...prev,
            nombres: prev.nombres || entrada.nombres,
            apellidos: prev.apellidos || entrada.apellidos,
            rol: prev.rol || entrada.rol,
            fotoPerfil: prev.fotoPerfil || entrada.fotoPerfil,
            ultimaConexion: elegirUltimaConexion(prev.ultimaConexion, entrada.ultimaConexion)
        });
    }

    async function obtenerContactosPadres() {
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
            respuestasContactos.map(res => (res.ok ? res.json() : []))
        );
        const docentes = contactosPorHijo.flat().filter(c => c.rol === 'DOCENTE');

        const mapa = new Map();
        recientes.forEach(c => fusionarContacto(mapa, c));
        docentes.forEach(c => fusionarContacto(mapa, c));
        hijos.forEach(c => fusionarContacto(mapa, c));

        const listaCombinada = Array.from(mapa.values());
        contactosById.clear();
        listaCombinada.forEach(c => contactosById.set(String(c.id), c));

        return {
            contactos: listaCombinada,
            disponibles: (() => {
                const availMap = new Map();
                docentes.forEach(c => fusionarContacto(availMap, c));
                hijos.forEach(c => fusionarContacto(availMap, c));
                return Array.from(availMap.values()).map(c => contactosById.get(String(c.id)) || c);
            })()
        };
    }

    function obtenerEstadoContacto(contacto) {
        if (window.ShidellPresence) {
            return window.ShidellPresence.getStatus(contacto);
        }
        const raw = contacto?.ultimaConexion;
        if (!raw) return { state: 'offline', label: 'Desconectado', shortLabel: 'Desconectado', title: 'Sin conexión reciente' };
        const diff = (Date.now() - new Date(raw).getTime()) / 60000;
        if (diff < 3) return { state: 'online', label: 'En línea', shortLabel: 'En línea', title: 'Activo ahora' };
        if (diff < 15) return { state: 'away', label: `Ausente · hace ${Math.max(1, Math.floor(diff))} min`, shortLabel: 'Ausente', title: 'Inactivo' };
        return { state: 'offline', label: 'Desconectado', shortLabel: 'Desconectado', title: 'Sin conexión reciente' };
    }

    function actualizarEstadoEnLinea(contacto) {
        const statusEl = document.getElementById('active-status');
        if (!statusEl) return;
        const st = obtenerEstadoContacto(contacto);
        statusEl.className = `chat-status-indicator is-${st.state}`;
        statusEl.title = st.title || st.label;
        statusEl.innerHTML = `<span class="presence-dot"></span><span>${escapeHtml(st.label)}</span>`;
    }

    function crearSublineaHtml(contacto) {
        const st = obtenerEstadoContacto(contacto);
        return `
            <div class="convo-subline">
                <span class="convo-preview">${escapeHtml(etiquetaContacto(contacto))}</span>
                <span class="presence-sep" aria-hidden="true">·</span>
                <span class="presence-inline is-${st.state}" title="${escapeHtml(st.title || st.label)}">
                    <span class="presence-dot"></span>
                    <span>${escapeHtml(st.shortLabel)}</span>
                </span>
            </div>`;
    }

    function crearElementoContacto(c, onClick) {
        const initials = (((c.nombres || '?')[0] || '?') + ((c.apellidos || '?')[0] || '?')).toUpperCase();
        const nombre   = nombreContacto(c);
        const item     = document.createElement('div');
        item.className = 'convo-item';
        if (activeContacto && String(activeContacto.id) === String(c.id)) {
            item.classList.add('active');
        }
        item.dataset.id   = c.id;
        item.dataset.name = nombre.toLowerCase();
        item.innerHTML = `
            <div class="convo-avatar" style="${estiloAvatar(c)}">${avatarPersona(c, initials)}</div>
            <div class="convo-info">
                <span class="convo-name">${escapeHtml(nombre)}</span>
                ${crearSublineaHtml(c)}
            </div>`;
        item.onclick = () => onClick(item);
        return item;
    }

    function aplicarFiltroBusqueda() {
        if (!searchInput || !convoList) return;
        const q = searchInput.value.toLowerCase();
        convoList.querySelectorAll('.convo-item').forEach(el => {
            el.style.display = (el.dataset.name || '').includes(q) ? 'flex' : 'none';
        });
    }

    async function cargarContactos() {
        if (cargandoContactos) return;
        cargandoContactos = true;
        try {
            const { contactos } = await obtenerContactosPadres();
            renderContactos(contactos);

            if (activeContacto) {
                const actualizado = contactosById.get(String(activeContacto.id));
                if (actualizado) {
                    activeContacto = actualizado;
                    actualizarEstadoEnLinea(activeContacto);
                }
            }
            abrirChatInicial();
        } catch (e) {
            console.error(e);
        } finally {
            cargandoContactos = false;
        }
    }

    function renderContactos(contactos) {
        if (!contactos || contactos.length === 0) {
            convoList.dataset.signature = '';
            convoList.innerHTML = `<div style="padding:30px;text-align:center;color:#94a3b8;font-size:13px;">No hay contactos disponibles</div>`;
            return;
        }
        const signature = contactos.map(c => {
            const st = obtenerEstadoContacto(c);
            return `${c.id}|${nombreContacto(c)}|${st.state}|${st.shortLabel}`;
        }).join(';');
        if (convoList.dataset.signature === signature) {
            aplicarFiltroBusqueda();
            return;
        }
        convoList.dataset.signature = signature;
        const prevScrollTop = convoList.scrollTop;
        convoList.innerHTML = '';
        contactos.forEach(c => {
            const item = crearElementoContacto(c, el => seleccionarChat(contactosById.get(String(c.id)) || c, el));
            convoList.appendChild(item);
        });
        convoList.scrollTop = prevScrollTop;
        aplicarFiltroBusqueda();
    }

    function seleccionarChat(contacto, element) {
        activeContacto = contactosById.get(String(contacto.id)) || contacto;
        if (noChat)     noChat.style.display     = 'none';
        if (chatActive) chatActive.style.display = 'flex';
        chatActive.dataset.selectedId = contacto.id;
        chatMessages.dataset.hash = '';
        document.querySelectorAll('.convo-item').forEach(el => el.classList.remove('active'));
        if (element) element.classList.add('active');

        document.getElementById('active-name').textContent = nombreContacto(activeContacto);
        renderAvatarEnContenedor(document.getElementById('active-avatar'), activeContacto);
        actualizarEstadoEnLinea(activeContacto);

        cargarMensajes();
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = window.setInterval(() => {
            if (document.visibilityState !== 'hidden') {
                cargarMensajes();
            }
        }, MESSAGES_POLL_MS);
    }

    function sincronizarPresenciaDesdeMensajes(msgs) {
        if (!activeContacto || !Array.isArray(msgs) || msgs.length === 0) return;
        let latestContacto = null;
        for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i];
            if (String(m?.remitente?.id) === String(activeContacto.id)) {
                latestContacto = m.remitente;
                break;
            }
            if (String(m?.destinatario?.id) === String(activeContacto.id)) {
                latestContacto = m.destinatario;
                break;
            }
        }
        if (!latestContacto) return;

        activeContacto.ultimaConexion = latestContacto.ultimaConexion ?? null;
        const stored = contactosById.get(String(activeContacto.id));
        if (stored) stored.ultimaConexion = activeContacto.ultimaConexion;

        actualizarEstadoEnLinea(activeContacto);
        const sidebarItem = convoList.querySelector(`.convo-item[data-id="${activeContacto.id}"] .convo-subline`);
        if (sidebarItem) {
            sidebarItem.outerHTML = crearSublineaHtml(activeContacto);
        }
    }

    async function cargarMensajes() {
        if (!activeContacto) return;
        const contactoId = activeContacto.id;
        try {
            const res = await fetch(`/api/mensajes/conversacion?u1=${padreId}&u2=${contactoId}`);
            if (!res.ok) return;
            const msgs = await res.json();

            if (!activeContacto || String(activeContacto.id) !== String(contactoId)) return;
            sincronizarPresenciaDesdeMensajes(msgs);

            const hash = msgs.map(m => `${m.id}${m.leido ? 1 : 0}`).join(',');
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
                    const baseFile = (m.archivoUrl.split('/').pop() || 'archivo')
                        .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '');
                    const fn = decodeURIComponent(baseFile);
                    const ext = fn.split('.').pop().toLowerCase();
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                        fileHtml = `<a href="${escapeHtml(m.archivoUrl)}" target="_blank"><img src="${escapeHtml(m.archivoUrl)}" class="file-image-preview" alt="Imagen adjunta"></a>`;
                    } else {
                        fileHtml = `<a href="${escapeHtml(m.archivoUrl)}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(0,0,0,0.08);border-radius:8px;margin-bottom:8px;color:inherit;text-decoration:none;"><i class="ph ph-file" style="font-size:20px;"></i><span style="font-size:12px;font-weight:600;">${escapeHtml(fn)}</span></a>`;
                    }
                }
                const time = new Date(m.fechaEnvio).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                bubble.innerHTML = `${fileHtml}<div>${escapeHtml(m.contenido || '')}</div><span class="msg-time">${time}</span>`;
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
        if (searchInput) searchInput.oninput = aplicarFiltroBusqueda;
        if (btnNewChat) {
            btnNewChat.onclick = async () => {
                modal.classList.add('show');
                contactsMod.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8;">Cargando...</p>';
                try {
                    const { disponibles } = await obtenerContactosPadres();
                    contactsMod.innerHTML = '';
                    if (disponibles.length === 0) {
                        contactsMod.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8;">Sin contactos disponibles.</p>';
                        return;
                    }
                    disponibles.forEach(c => {
                        const row = crearElementoContacto(c, () => {
                            modal.classList.remove('show');
                            let ex = convoList.querySelector(`[data-id="${c.id}"]`);
                            if (!ex) {
                                ex = crearElementoContacto(c, el => seleccionarChat(contactosById.get(String(c.id)) || c, el));
                                convoList.prepend(ex);
                            }
                            seleccionarChat(c, ex);
                        });
                        contactsMod.appendChild(row);
                    });
                } catch (e) {
                    contactsMod.innerHTML = '<p style="color:#ef4444; padding:20px; text-align:center;">Error.</p>';
                }
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
        if (persona?.rol === 'DOCENTE' && !/^prof\.?\s/i.test(nombre)) {
            return `Prof. ${nombre}`;
        }
        return nombre;
    }

    function etiquetaContacto(persona) {
        if (persona?.rol === 'DOCENTE') return 'Docente';
        if (persona?.rol === 'ESTUDIANTE') return 'Hijo/a';
        return persona?.rol || 'Contacto';
    }
});
