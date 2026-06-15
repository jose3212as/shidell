/**
 * notificaciones.js
 * Handles the notification bell dropdown for Portal Docente.
 * Depends on app.js being loaded first (uses shidell_user from localStorage).
 */
(function () {
    'use strict';

    const API_BASE = location.host.includes('localhost') ? '' : 'http://localhost:8080';
    const POLL_INTERVAL = 60_000; // 1 minute

    const btnBell = document.getElementById('btn-notificaciones');
    const panel   = document.getElementById('notif-panel');
    const list    = document.getElementById('notif-list');
    const badge   = document.getElementById('notif-badge');
    const btnMarkAll = document.getElementById('btn-marcar-todas');

    if (!btnBell || !panel) return; // guard – not on this page

    let docenteId = null;
    let notifData  = [];

    // ── Toggle panel ──────────────────────────────────────────────────────────
    btnBell.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.toggle('open');
        btnBell.setAttribute('aria-expanded', isOpen);
        if (isOpen) cargar();
    });

    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== btnBell) {
            panel.classList.remove('open');
            btnBell.setAttribute('aria-expanded', 'false');
        }
    });

    // ── Mark all as read ──────────────────────────────────────────────────────
    btnMarkAll?.addEventListener('click', async () => {
        const unread = notifData.filter(n => !n.leida);
        if (!unread.length) return;
        await Promise.allSettled(unread.map(n => marcarLeida(n.id)));
        notifData.forEach(n => { n.leida = true; });
        actualizarBadge(0);
        render(notifData);
    });

    // ── Fetch notifications ───────────────────────────────────────────────────
    async function cargar() {
        docenteId = docenteId ?? await resolverDocenteId();
        if (!docenteId) {
            renderEmpty('No se pudo identificar al docente.');
            return;
        }

        list.innerHTML = '<div class="notif-loading"><i class="ph ph-circle-notch spin"></i> Cargando...</div>';

        try {
            const data = await fetch(`${API_BASE}/api/notificaciones/usuario/${docenteId}`, {
                headers: authHeaders()
            }).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            });

            notifData = Array.isArray(data) ? data : [];
            const unread = notifData.filter(n => !n.leida).length;
            actualizarBadge(unread);
            render(notifData);
        } catch (err) {
            renderError('No se pudieron cargar las notificaciones.');
            console.warn('[notificaciones]', err);
        }
    }

    async function marcarLeida(id) {
        await fetch(`${API_BASE}/api/notificaciones/${id}/leer`, {
            method: 'PUT',
            headers: authHeaders()
        }).catch(() => {});
    }

    // ── Resolve teacher ID from session ───────────────────────────────────────
    async function resolverDocenteId() {
        try {
            const user = JSON.parse(localStorage.getItem('shidell_user') || 'null');
            if (!user?.email || user.rol !== 'DOCENTE') return null;

            // Try getting id directly from session first
            if (user.id) return user.id;

            // Otherwise, look up by email
            const docente = await fetch(
                `${API_BASE}/api/docente/buscar?email=${encodeURIComponent(user.email)}`,
                { headers: authHeaders() }
            ).then(r => r.ok ? r.json() : null);

            return docente?.id ?? null;
        } catch {
            return null;
        }
    }

    // ── Rendering helpers ─────────────────────────────────────────────────────
    function render(items) {
        if (!items.length) {
            renderEmpty('No tienes notificaciones por ahora.');
            return;
        }

        // Sort: unread first, then by date desc
        const sorted = [...items].sort((a, b) => {
            if (a.leida !== b.leida) return a.leida ? 1 : -1;
            return new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0);
        });

        list.innerHTML = sorted.map(n => {
            const icon = iconParaTipo(n.tipo);
            const time = formatRelTime(n.fechaCreacion);
            return `
                <div class="notif-item ${n.leida ? '' : 'unread'}" data-id="${n.id}" role="listitem" tabindex="0">
                    <div class="notif-icon"><i class="ph ph-${icon}"></i></div>
                    <div class="notif-body">
                        <strong>${esc(n.titulo || 'Notificación')}</strong>
                        <p>${esc(n.mensaje || '')}</p>
                        <time>${time}</time>
                    </div>
                    ${n.leida ? '' : '<div class="notif-dot"></div>'}
                </div>`;
        }).join('');

        // Click to mark individual as read
        list.querySelectorAll('.notif-item').forEach(el => {
            el.addEventListener('click', async () => {
                const id = Number(el.dataset.id);
                const notif = notifData.find(n => n.id === id);
                if (notif && !notif.leida) {
                    notif.leida = true;
                    await marcarLeida(id);
                    el.classList.remove('unread');
                    el.querySelector('.notif-dot')?.remove();
                    const unread = notifData.filter(n => !n.leida).length;
                    actualizarBadge(unread);
                }
            });

            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') el.click();
            });
        });
    }

    function renderEmpty(msg) {
        list.innerHTML = `
            <div class="notif-empty">
                <i class="ph ph-bell-slash"></i>
                <span>${esc(msg)}</span>
            </div>`;
    }

    function renderError(msg) {
        list.innerHTML = `
            <div class="notif-empty">
                <i class="ph ph-warning-circle" style="color:var(--red);"></i>
                <span>${esc(msg)}</span>
            </div>`;
    }

    function actualizarBadge(count) {
        if (count > 0) {
            badge.style.display = 'block';
            badge.title = `${count} sin leer`;
        } else {
            badge.style.display = 'none';
        }
    }

    // ── Utilities ─────────────────────────────────────────────────────────────
    function iconParaTipo(tipo) {
        const map = {
            ASISTENCIA: 'calendar-x',
            CALIFICACION: 'student',
            TAREA: 'notebook',
            MENSAJE: 'chat-circle-dots',
            ALERTA: 'warning',
            INFO: 'info',
        };
        return map[String(tipo || '').toUpperCase()] || 'bell';
    }

    function formatRelTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (isNaN(date)) return '';
        const diff = Date.now() - date.getTime();
        const mins  = Math.floor(diff / 60_000);
        const hours = Math.floor(diff / 3_600_000);
        const days  = Math.floor(diff / 86_400_000);
        if (mins  < 1)  return 'Ahora mismo';
        if (mins  < 60) return `Hace ${mins} min`;
        if (hours < 24) return `Hace ${hours} h`;
        if (days  < 7)  return `Hace ${days} día${days > 1 ? 's' : ''}`;
        return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    }

    function authHeaders() {
        try {
            const user = JSON.parse(localStorage.getItem('shidell_user') || 'null');
            if (user?.sessionToken) {
                return { Authorization: `Bearer ${user.sessionToken}` };
            }
        } catch {}
        return {};
    }

    function esc(val) {
        return String(val ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ── Polling (background refresh) ──────────────────────────────────────────
    async function pollBadge() {
        const id = docenteId ?? await resolverDocenteId();
        if (!id) return;
        docenteId = id;

        try {
            const data = await fetch(`${API_BASE}/api/notificaciones/usuario/${id}`, {
                headers: authHeaders()
            }).then(r => r.ok ? r.json() : []);

            notifData = Array.isArray(data) ? data : [];
            const unread = notifData.filter(n => !n.leida).length;
            actualizarBadge(unread);
        } catch { /* silent */ }
    }

    // Initial badge load (without opening panel)
    pollBadge();
    setInterval(pollBadge, POLL_INTERVAL);

})();
