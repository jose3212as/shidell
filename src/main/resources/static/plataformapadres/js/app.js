// Shidell - Portal Padres de Familia
// FIXED: clave sesión, evento hijo-cargado, campo nota20, asistencia via progreso
instalarAuthFetchPadres();

window.PadresPrefs = (() => {
    const DEFAULTS = {
        defaultChildId: null,
        notifDefaultTab: 'all',
        notifPollMs: 30000,
        showNotifBadge: true,
        reduceMotion: false,
        contactSchedule: 'CUALQUIERA'
    };

    function keyFor(userId) {
        return `shidell_padres_prefs_${userId || 'anon'}`;
    }

    function sanitize(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const poll = Number(src.notifPollMs);
        return {
            defaultChildId: src.defaultChildId ? Number(src.defaultChildId) : null,
            notifDefaultTab: src.notifDefaultTab === 'unread' ? 'unread' : 'all',
            notifPollMs: [0, 15000, 30000, 60000].includes(poll) ? poll : DEFAULTS.notifPollMs,
            showNotifBadge: src.showNotifBadge !== false,
            reduceMotion: Boolean(src.reduceMotion),
            contactSchedule: ['MANANA', 'TARDE', 'CUALQUIERA'].includes(src.contactSchedule)
                ? src.contactSchedule
                : DEFAULTS.contactSchedule
        };
    }

    function applyToDocument(prefs) {
        const clean = sanitize(prefs);
        if (clean.reduceMotion) {
            document.documentElement.dataset.motion = 'reduced';
        } else {
            delete document.documentElement.dataset.motion;
        }
    }

    return {
        defaults() {
            return { ...DEFAULTS };
        },
        get(userId) {
            try {
                const parsed = JSON.parse(localStorage.getItem(keyFor(userId)) || 'null');
                return sanitize(parsed);
            } catch {
                return { ...DEFAULTS };
            }
        },
        update(userId, patch) {
            const next = sanitize({ ...this.get(userId), ...(patch || {}) });
            try {
                localStorage.setItem(keyFor(userId), JSON.stringify(next));
            } catch {}
            applyToDocument(next);
            window.dispatchEvent(new CustomEvent('shidell:padres-prefs-changed', { detail: { userId, prefs: next } }));
            return next;
        },
        reset(userId) {
            const next = { ...DEFAULTS };
            try {
                localStorage.setItem(keyFor(userId), JSON.stringify(next));
            } catch {}
            applyToDocument(next);
            window.dispatchEvent(new CustomEvent('shidell:padres-prefs-changed', { detail: { userId, prefs: next } }));
            return next;
        },
        applyToDocument
    };
})();

(() => {
    try {
        const u = JSON.parse(localStorage.getItem('shidell_user') || 'null');
        if (u?.id) window.PadresPrefs.applyToDocument(window.PadresPrefs.get(u.id));
    } catch {}
})();

function instalarAuthFetchPadres() {
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

function iniciarPresenciaPadres(getUserFn) {
    if (window.ShidellPresence?.startHeartbeat) {
        window.ShidellPresence.startHeartbeat(getUserFn);
        return;
    }
    if (document.querySelector('script[data-shidell-presence]')) return;
    const script = document.createElement('script');
    script.src = '/vendor/shidell-presence.js?v=20261115a';
    script.dataset.shidellPresence = 'true';
    script.onload = () => window.ShidellPresence?.startHeartbeat?.(getUserFn);
    document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {

    // ── 1. Sesión ──────────────────────────────────────────
    // El login guarda con 'shidell_user' — usamos esa clave
    const storedUser = localStorage.getItem('shidell_user');
    if (!storedUser) { window.location.href = '/login.html'; return; }
    const padre = JSON.parse(storedUser);
    if (!padre.sessionToken) {
        localStorage.removeItem('shidell_user');
        window.location.href = '/login.html';
        return;
    }
    if (padre.rol !== 'PADRE') { window.location.href = '/login.html'; return; }

    // Exponemos al padre globalmente para que otras páginas lo usen
    window._padreActual = padre;
    refrescarPadreDesdeBackend(padre);
    iniciarPresenciaPadres(() => window._padreActual || padre);

    // ── 2. Rellenar UI con datos del padre ─────────────────
    document.querySelectorAll('.padre-nombre').forEach(el => {
        el.textContent = (padre.nombres || '') + ' ' + (padre.apellidos || '');
    });
    renderAvatarPadre(padre);

    // ── 3. Cargar hijo activo ──────────────────────────────
    let hijoActivo = null;
    window._hijoActivo = null;

    async function cargarHijos() {
        try {
            const res = await fetch(`/api/admin/padres/${padre.id}/hijos`);
            if (!res.ok) return;
            const hijos = await res.json();
            if (hijos.length === 0) {
                // Mostrar mensaje de sin hijos vinculados
                const hijoNombreEl = document.getElementById('hijo-nombre');
                if (hijoNombreEl) hijoNombreEl.textContent = 'Sin hijos vinculados';
                const hijoInfoEl = document.getElementById('hijo-info');
                if (hijoInfoEl) hijoInfoEl.textContent = 'Contacta al administrador para vincular a tu hijo/a';
                return;
            }

            const prefsActuales = window.PadresPrefs ? window.PadresPrefs.get(padre.id) : {};
            const queryHijoId = Number(new URLSearchParams(window.location.search).get('hijoId') || 0);
            let sessionHijoId = 0;
            try {
                sessionHijoId = Number(sessionStorage.getItem(`shidell_padre_active_child_${padre.id}`) || 0);
            } catch {}
            const prefHijoId = Number(prefsActuales.defaultChildId || 0);

            hijoActivo =
                hijos.find(h => h.id === queryHijoId) ||
                hijos.find(h => h.id === sessionHijoId) ||
                hijos.find(h => h.id === prefHijoId) ||
                hijos[0];

            try {
                if (hijoActivo?.id) {
                    sessionStorage.setItem(`shidell_padre_active_child_${padre.id}`, String(hijoActivo.id));
                }
            } catch {}

            window._hijoActivo = hijoActivo;
            renderHijoActivo();

            // Selector de hijos (si tiene más de uno)
            const selectorHijo = document.getElementById('hijo-selector-list');
            if (selectorHijo && hijos.length > 1) {
                selectorHijo.innerHTML = '';
                hijos.forEach((h) => {
                    const btn = document.createElement('button');
                    btn.className = `btn-hijo${h.id === hijoActivo.id ? ' active' : ''}`;
                    btn.textContent = h.nombres;
                    btn.onclick = () => {
                        hijoActivo = h;
                        window._hijoActivo = h;
                        try {
                            sessionStorage.setItem(`shidell_padre_active_child_${padre.id}`, String(h.id));
                        } catch {}
                        document.querySelectorAll('.btn-hijo').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        renderHijoActivo();
                        dispararHijoCargado(h);
                        cargarTodosDatos();
                    };
                    selectorHijo.appendChild(btn);
                });
                const switchWrap = document.getElementById('hijo-switch-wrap');
                if (switchWrap) switchWrap.style.display = 'flex';
            }

            // FIXED: disparar evento hijo-cargado para que las subpáginas lo reciban
            dispararHijoCargado(hijoActivo);
            await cargarTodosDatos();

        } catch (e) { console.error('Error cargarHijos:', e); }
    }

    function dispararHijoCargado(hijo) {
        window.dispatchEvent(new CustomEvent('hijo-cargado', { detail: hijo }));
    }

    function renderHijoActivo() {
        if (!hijoActivo) return;
        const nombres   = hijoActivo.nombres   || '';
        const apellidos = hijoActivo.apellidos  || '';
        const initials  = ((nombres[0] || '') + (apellidos[0] || '')).toUpperCase();
        const elAvatar  = document.getElementById('hijo-avatar');
        const elNombre  = document.getElementById('hijo-nombre');
        const elInfo    = document.getElementById('hijo-info');
        if (elAvatar) renderAvatarEnContenedor(elAvatar, hijoActivo, initials || '?');
        if (elNombre) elNombre.textContent = `${nombres} ${apellidos}`.trim();
        if (elInfo)   elInfo.textContent   = [hijoActivo.nivel, hijoActivo.grado ? hijoActivo.grado + '°' : '', hijoActivo.seccion].filter(Boolean).join(' · ');
    }

    // ── 4. Cargar todos los datos del hijo activo ──────────
    async function cargarTodosDatos() {
        if (!hijoActivo) return;
        await Promise.all([
            cargarCalificaciones(),
            cargarTareas(),
            cargarAsistencia(),
            cargarMensajesRecientes(),
            cargarNotificaciones()
        ]);
    }

    // ── 5. Calificaciones del hijo ─────────────────────────
    // FIXED: usa campo nota20 (no nota)
    async function cargarCalificaciones() {
        const container = document.getElementById('calificaciones-list');
        if (!container) return;
        try {
            const res  = await fetch(`/api/calificaciones/estudiante/${hijoActivo.id}`);
            const payload = res.ok ? await res.json() : {};
            const cals = Array.isArray(payload) ? payload : (payload.evaluaciones || []);

            if (cals.length > 0) {
                // FIXED: campo correcto es nota20
                const promedio = Number(payload.promedioGeneral ?? (cals.reduce((s, c) => s + Number(c.nota20 || c.nota || 0), 0) / cals.length)).toFixed(1);
                const elProm = document.getElementById('stat-promedio');
                if (elProm) elProm.textContent = promedio;
            }

            container.innerHTML = '';
            if (cals.length === 0) {
                container.innerHTML = '<p style="padding:16px; color:#94a3b8; text-align:center;">Sin calificaciones.</p>';
                return;
            }
            cals.slice(0, 6).forEach(c => {
                const nota  = Number(c.nota20 || c.nota || 0); // FIXED: nota20
                const grade = nota >= 17 ? 'a' : nota >= 14 ? 'b' : nota >= 11 ? 'c' : 'd';
                const curso = c.tarea?.curso?.nombre || c.curso?.nombre || 'Curso';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${curso}</td>
                    <td><span class="grade-badge grade-${grade}">${nota.toFixed(1)}</span></td>
                    <td style="color:var(--text-secondary); font-size:13px;">${c.tarea?.titulo || c.actividad || '—'}</td>
                `;
                container.appendChild(tr);
            });
        } catch (e) { console.error('Error calificaciones:', e); }
    }

    // ── 6. Tareas del hijo ─────────────────────────────────
    async function cargarTareas() {
        const container = document.getElementById('tareas-list');
        if (!container || !hijoActivo) return;
        try {
            if (!hijoActivo.nivel || !hijoActivo.grado || !hijoActivo.seccion) {
                container.innerHTML = '<p style="color:#94a3b8; padding:16px; text-align:center;">Sin sección asignada.</p>';
                return;
            }
            const res    = await fetch(`/api/tareas/estudiante/${hijoActivo.id}`);
            const payload = res.ok ? await res.json() : {};
            const tareasRaw = payload.tareas || [];
            const tareas = tareasRaw.filter(item => item.status !== 'Completada').map(item => item.tarea);

            const elTareas = document.getElementById('stat-tareas');
            if (elTareas) elTareas.textContent = tareas.length;

            container.innerHTML = '';
            if (tareas.length === 0) {
                container.innerHTML = '<p style="padding:16px; color:#94a3b8; text-align:center;">Sin tareas pendientes.</p>';
                return;
            }
            tareas.slice(0, 4).forEach(t => {
                const color  = t.curso?.color || 'blue';
                const icon   = t.curso?.icono || 'ph-clipboard-text';
                const priCol = t.prioridad === 'Alta' ? 'red' : t.prioridad === 'Media' ? 'yellow' : 'green';
                const div = document.createElement('div');
                div.className = 'panel-item';
                div.innerHTML = `
                    <div class="item-icon-box bg-${color}-light"><i class="ph-fill ${icon}"></i></div>
                    <div class="item-main">
                        <h4 class="item-title">${t.titulo}</h4>
                        <div class="item-subtitle"><i class="ph ph-calendar-blank"></i> ${t.fechaVencimiento || '—'} · ${t.curso?.nombre || ''}</div>
                    </div>
                    <span class="item-badge bg-${priCol}-light">${t.prioridad || 'Normal'}</span>
                `;
                container.appendChild(div);
            });
        } catch (e) { console.error('Error tareas:', e); }
    }

    // ── 7. Asistencia ──────────────────────────────────────
    // FIXED: usa /api/progreso/estudiante/{id} ya que /api/asistencia/estudiante/{id} no existe
    async function cargarAsistencia() {
        const container = document.getElementById('asistencia-list');
        if (!container || !hijoActivo) return;
        try {
            const res = await fetch(`/api/progreso/estudiante/${hijoActivo.id}`);
            if (!res.ok) {
                container.innerHTML = '<p style="color:#94a3b8; padding:10px;">Sin datos de asistencia.</p>';
                return;
            }
            const progreso = await res.json();
            const pct = progreso.asistenciaPorcentaje || 0;

            const elAsist = document.getElementById('stat-asistencia');
            if (elAsist) elAsist.textContent = pct + '%';

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:14px; font-weight:600;">Asistencia general</span>
                    <span style="font-size:22px; font-weight:700; color:var(--primary);">${pct}%</span>
                </div>
                <div class="asist-bar-wrap">
                    <div class="asist-bar-fill" style="width:${pct}%;"></div>
                </div>
                <div style="display:flex; gap:16px; margin-top:16px; font-size:13px;">
                    <span style="color:var(--green); font-weight:600;"><i class="ph ph-check-circle"></i> ${pct >= 90 ? 'Excelente' : pct >= 75 ? 'Buena' : 'Mejorar'} asistencia</span>
                    <span style="color:var(--text-secondary);">Racha: ${progreso.rachaDias || 0} días</span>
                </div>
            `;
        } catch (e) {
            if (container) container.innerHTML = '<p style="color:#94a3b8; padding:10px;">Sin datos de asistencia.</p>';
        }
    }

    // ── 8. Mensajes recientes ──────────────────────────────
    async function cargarMensajesRecientes() {
        const container = document.getElementById('mensajes-list');
        const elMsg = document.getElementById('stat-mensajes');
        if (!container && !elMsg) return;
        try {
            const [res, resUnread] = await Promise.all([
                fetch(`/api/mensajes/recientes/${padre.id}`),
                fetch(`/api/mensajes/noleidos/${padre.id}`).catch(() => null)
            ]);
            const contactos = res.ok ? await res.json() : [];
            const noLeidosFallback = contactos.filter(c => Number(c.noLeidos || 0) > 0).length;
            const noLeidos = (resUnread && resUnread.ok) ? Number(await resUnread.json()) : noLeidosFallback;
            if (elMsg) elMsg.textContent = Number.isFinite(noLeidos) ? noLeidos : noLeidosFallback;
            if (!container) return;

            container.innerHTML = '';
            if (contactos.length === 0) {
                container.innerHTML = '<p style="padding:16px; color:#94a3b8; text-align:center;">Sin mensajes recientes.</p>';
                return;
            }
            for (const c of contactos.slice(0, 3)) {
                const initials = ((c.nombres || '?')[0] + (c.apellidos || '?')[0]).toUpperCase();
                const fullName = `${c.nombres || ''} ${c.apellidos || ''}`.trim();
                const displayName = (c.rol === 'DOCENTE' && !/^prof\.?\s/i.test(fullName))
                    ? `Prof. ${fullName}`
                    : fullName;
                const preview = c.ultimoMensaje || (Number(c.noLeidos || 0) > 0 ? `${c.noLeidos} mensaje(s) sin leer` : 'Toca para ver la conversación');
                const fechaRaw = c.fechaUltimoMensaje || '';
                const timeStr = fechaRaw ? new Date(fechaRaw).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';

                const div = document.createElement('div');
                div.className = 'message-card';
                div.onclick = () => window.location.href = `mensajes.html?chatId=${c.id}`;
                div.innerHTML = `
                    <div class="msg-avatar">${avatarPersona(c, initials)}</div>
                    <div class="msg-body">
                        <div class="msg-header">
                            <span class="msg-author">${escapeHtml(displayName)}</span>
                            <span class="msg-role">${c.rol === 'DOCENTE' ? 'Docente' : escapeHtml(c.rol || '')}</span>
                        </div>
                        <p class="msg-snippet">${escapeHtml(preview)}</p>
                    </div>
                    <div class="msg-meta">
                        <span class="msg-time">${escapeHtml(timeStr)}</span>
                    </div>
                `;
                container.appendChild(div);
            }
        } catch (e) { console.error('Error mensajes:', e); }
    }

    // ── 9. Notificaciones ──────────────────────────────────
    let notificationPanel = null;
    let notifBackdrop = null;
    let notifActiveTab = window.PadresPrefs ? window.PadresPrefs.get(padre.id).notifDefaultTab : 'all';
    let ultimaListaNotifs = [];
    let notifPollTimer = null;

    function actualizarBadgeNotif(lista) {
        const noLeidas = (Array.isArray(lista) ? lista : []).filter(n => !n.leida).length;
        const badge = document.querySelector('.notification-btn .badge');
        if (!badge) return;
        const prefs = window.PadresPrefs ? window.PadresPrefs.get(padre.id) : { showNotifBadge: true };
        badge.textContent = noLeidas > 9 ? '9+' : String(noLeidas);
        badge.style.display = (prefs.showNotifBadge !== false && noLeidas > 0) ? 'flex' : 'none';
    }

    function programarPollingNotifs() {
        if (notifPollTimer) {
            clearInterval(notifPollTimer);
            notifPollTimer = null;
        }
        const prefs = window.PadresPrefs ? window.PadresPrefs.get(padre.id) : { notifPollMs: 30000 };
        const ms = Number(prefs.notifPollMs);
        if (ms > 0) {
            notifPollTimer = setInterval(cargarNotificaciones, ms);
        }
    }

    function fmtTiempoPadre(f) {
        if (!f) return '';
        const d = new Date(f);
        if (Number.isNaN(d.getTime())) return '';
        const diff = Date.now() - d.getTime();
        if (diff < 60000) return 'Ahora';
        if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
        return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    }

    function cerrarNotifPadre() {
        notificationPanel?.classList.remove('visible');
        notifBackdrop?.classList.remove('visible');
    }

    function posicionarNotifPadre(btn) {
        if (!notificationPanel || !notificationPanel.classList.contains('visible')) return;
        const target = btn || document.querySelector('.notification-btn');
        if (!target) return;
        const rect = target.getBoundingClientRect();
        notificationPanel.style.position = 'fixed';
        if (window.innerWidth <= 640) {
            notificationPanel.style.top = `${Math.max(60, Math.round(rect.bottom + 8))}px`;
            notificationPanel.style.left = '12px';
            notificationPanel.style.right = '12px';
            notificationPanel.style.width = 'auto';
        } else {
            notificationPanel.style.left = 'auto';
            notificationPanel.style.top = `${Math.round(rect.bottom + 12)}px`;
            notificationPanel.style.right = `${Math.max(16, Math.round(window.innerWidth - rect.right))}px`;
        }
    }

    async function cargarNotificaciones() {
        try {
            const res = await fetch(`/api/notificaciones/usuario/${padre.id}`);
            if (!res.ok) return;
            const nots = await res.json();
            ultimaListaNotifs = Array.isArray(nots) ? nots : [];
            actualizarBadgeNotif(ultimaListaNotifs);
            renderNotificationPanel(ultimaListaNotifs);
        } catch (e) { console.error('Error notificaciones:', e); }
    }

    function toggleNotificationPanel(btn) {
        if (!notificationPanel) return;
        const willOpen = !notificationPanel.classList.contains('visible');
        if (!willOpen) {
            cerrarNotifPadre();
            return;
        }
        if (!notifBackdrop) {
            notifBackdrop = document.getElementById('notificationBackdrop');
            if (!notifBackdrop) {
                notifBackdrop = document.createElement('div');
                notifBackdrop.id = 'notificationBackdrop';
                notifBackdrop.className = 'notification-backdrop';
                notifBackdrop.addEventListener('click', cerrarNotifPadre);
                document.body.appendChild(notifBackdrop);
            }
        }
        notifBackdrop.classList.add('visible');
        notificationPanel.classList.add('visible');
        posicionarNotifPadre(btn);
    }

    function renderNotificationPanel(notificaciones) {
        if (!notificationPanel) {
            notificationPanel = document.createElement('div');
            notificationPanel.id = 'notificationPanel';
            notificationPanel.className = 'notification-panel';
            notificationPanel.setAttribute('role', 'dialog');
            notificationPanel.setAttribute('aria-label', 'Centro de notificaciones');
            document.body.appendChild(notificationPanel);
            notificationPanel.addEventListener('click', e => e.stopPropagation());

            document.addEventListener('click', () => cerrarNotifPadre());
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') cerrarNotifPadre();
            });
            window.addEventListener('resize', () => posicionarNotifPadre());
            window.addEventListener('scroll', () => posicionarNotifPadre(), { passive: true });
        }

        const unreadList = notificaciones.filter(n => !n.leida);
        const unreadCount = unreadList.length;
        const list = (notifActiveTab === 'unread' ? unreadList : notificaciones).slice(0, 12);

        const items = list.map(n => {
            let icon = 'ph-bell';
            let titulo = n.titulo || 'Notificación';
            if (titulo.includes('[CRITICO]')) {
                icon = 'ph-warning-circle';
                titulo = titulo.replace('[CRITICO]', '').trim();
            } else if (titulo.includes('[ALERTA]')) {
                icon = 'ph-info';
                titulo = titulo.replace('[ALERTA]', '').trim();
            }

            return `
                <button type="button" class="notif-row ${n.leida ? '' : 'unread'}" data-id="${escapeHtml(n.id)}">
                    <span class="notif-icon"><i class="ph ${icon}"></i></span>
                    <span class="notif-content">
                        <span class="np-row-top">
                            <strong>${escapeHtml(titulo)}</strong>
                            <span class="notif-time">${escapeHtml(fmtTiempoPadre(n.fecha))}</span>
                        </span>
                        <small>${escapeHtml(n.mensaje || '')}</small>
                    </span>
                    <span class="np-unread-col" aria-hidden="true">${n.leida ? '' : '<span class="np-unread-dot"></span>'}</span>
                </button>
            `;
        });

        const emptyTitle = notifActiveTab === 'unread' ? 'Todo al día' : 'Sin novedades por ahora';
        const emptyCopy = notifActiveTab === 'unread'
            ? 'No tienes avisos sin leer.'
            : 'Aquí aparecerán avisos de asistencia, tareas y notas de tus hijos.';

        notificationPanel.innerHTML = `
            <div class="np-head">
                <div class="np-title-wrap">
                    <h3>Notificaciones</h3>
                    <span class="notif-badge-pill">${unreadCount > 0 ? `${unreadCount} sin leer` : 'Al día'}</span>
                </div>
                <div class="notif-header-actions">
                    <button type="button" id="btn-marcar-todas" class="np-action-pill" ${unreadCount === 0 ? 'disabled' : ''} title="Marcar todas como leídas">
                        <i class="ph ph-checks"></i>
                        <span>Marcar leídas</span>
                    </button>
                    <button type="button" id="np-close-btn" class="np-close-btn" title="Cerrar" aria-label="Cerrar notificaciones">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            </div>
            <div class="np-tabs" role="tablist">
                <button type="button" role="tab" class="np-tab ${notifActiveTab === 'all' ? 'is-active' : ''}" data-pad-np-tab="all" aria-selected="${notifActiveTab === 'all'}">
                    <span>Todas</span>
                    <span class="np-tab-count">${notificaciones.length}</span>
                </button>
                <button type="button" role="tab" class="np-tab ${notifActiveTab === 'unread' ? 'is-active' : ''}" data-pad-np-tab="unread" aria-selected="${notifActiveTab === 'unread'}">
                    <span>Sin leer</span>
                    <span class="np-tab-count">${unreadCount}</span>
                </button>
            </div>
            <div class="notification-panel-list">
                ${items.length ? items.join('') : `
                    <div class="np-empty">
                        <span class="np-empty-icon"><i class="ph ph-bell-simple"></i></span>
                        <p class="np-empty-title">${emptyTitle}</p>
                        <p class="np-empty-copy">${emptyCopy}</p>
                    </div>
                `}
            </div>
        `;

        notificationPanel.querySelector('#np-close-btn')?.addEventListener('click', cerrarNotifPadre);

        notificationPanel.querySelectorAll('[data-pad-np-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                const next = tab.getAttribute('data-pad-np-tab');
                if (next && next !== notifActiveTab) {
                    notifActiveTab = next;
                    renderNotificationPanel(ultimaListaNotifs);
                }
            });
        });

        notificationPanel.querySelectorAll('.notif-row').forEach(row => {
            row.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                try {
                    await fetch(`/api/notificaciones/${id}/leer`, { method: 'PUT' });
                    cargarNotificaciones();
                } catch (err) {
                    console.error(err);
                }
            });
        });

        const btnMarcarTodas = notificationPanel.querySelector('#btn-marcar-todas');
        if (btnMarcarTodas) {
            btnMarcarTodas.addEventListener('click', async () => {
                await Promise.all(unreadList.map(n =>
                    fetch(`/api/notificaciones/${n.id}/leer`, { method: 'PUT' }).catch(() => {})
                ));
                cargarNotificaciones();
            });
        }
    }

    // Event listener para el botón
    const btnNotificaciones = document.querySelector('.notification-btn');
    if (btnNotificaciones) {
        btnNotificaciones.addEventListener('click', (e) => {
            e.stopPropagation();
            cargarNotificaciones().then(() => toggleNotificationPanel(btnNotificaciones));
        });
    }

    // ── 10. Logout ─────────────────────────────────────────
    const btnLogouts = document.querySelectorAll('#btn-logout, .btn-logout, .dropdown-item');
    btnLogouts.forEach(btn => {
        if (btn && (btn.id === 'btn-logout' || btn.classList.contains('btn-logout'))) {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (window.ShidellPresence?.notifyLogout) {
                    await window.ShidellPresence.notifyLogout(padre);
                } else {
                    const headers = padre?.sessionToken ? { Authorization: `Bearer ${padre.sessionToken}` } : {};
                    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', keepalive: true, headers }).catch(() => {});
                }
                localStorage.removeItem('shidell_user');
                localStorage.removeItem('shidell_admin');
                try {
                    sessionStorage.removeItem(`shidell_padre_active_child_${padre.id}`);
                } catch {}
                const goLogin = () => { window.location.href = '/login.html'; };
                if (window.ShidellMotion && typeof window.ShidellMotion.playPortalHandoff === 'function') {
                    window.ShidellMotion.playPortalHandoff({ rol: 'AUTH', originEl: btn }, goLogin);
                } else {
                    goLogin();
                }
            });
        }
    });

    window.addEventListener('shidell:padres-prefs-changed', (ev) => {
        const nextPrefs = ev?.detail?.prefs;
        if (!nextPrefs) return;
        actualizarBadgeNotif(ultimaListaNotifs);
        if (!notificationPanel || !notificationPanel.classList.contains('visible')) {
            notifActiveTab = nextPrefs.notifDefaultTab;
        }
        programarPollingNotifs();
    });

    // ── Arrancar ───────────────────────────────────────────
    cargarHijos();
    cargarNotificaciones();
    programarPollingNotifs();
});

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function esFotoValida(src) {
    return typeof src === 'string' && /^(data:image\/|\/uploads\/|https?:\/\/)/i.test(src.trim());
}

function primeraFotoValida(...fotos) {
    return fotos.find(esFotoValida) || '';
}

function avatarPersona(persona, fallbackIniciales = '') {
    const foto = primeraFotoValida(persona?.fotoPerfil, persona?.foto_perfil);
    if (foto) return `<img src="${escapeHtml(foto)}" alt="Foto de perfil">`;
    const iniciales = fallbackIniciales || (((persona?.nombres || '?')[0] || '?') + ((persona?.apellidos || '?')[0] || '?')).toUpperCase();
    return escapeHtml(iniciales);
}

function renderAvatarEnContenedor(contenedor, persona, fallbackIniciales = '') {
    if (!contenedor) return;
    contenedor.innerHTML = avatarPersona(persona, fallbackIniciales);
}

function renderAvatarPadre(padre) {
    const iniciales = (((padre?.nombres || '?')[0] || '?') + ((padre?.apellidos || '?')[0] || '?')).toUpperCase();
    document.querySelectorAll('.top-user-info .avatar').forEach(avatar => {
        renderAvatarEnContenedor(avatar, padre, iniciales);
    });
}

async function refrescarPadreDesdeBackend(padre) {
    if (!padre?.id) return;
    try {
        const res = await fetch(`/api/users/${padre.id}`);
        if (!res.ok) return;
        const fresh = await res.json();
        if (!fresh || fresh.rol !== 'PADRE') return;
        const actualizado = { ...padre, ...fresh, sessionToken: padre.sessionToken };
        localStorage.setItem('shidell_user', JSON.stringify(actualizado));
        window._padreActual = actualizado;
        document.querySelectorAll('.padre-nombre').forEach(el => {
            el.textContent = `${actualizado.nombres || ''} ${actualizado.apellidos || ''}`.trim();
        });
        renderAvatarPadre(actualizado);
    } catch (e) {
        console.warn('No se pudo refrescar el perfil del padre:', e);
    }
}
