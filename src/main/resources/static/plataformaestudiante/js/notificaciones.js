(function () {
    let currentUser = null;
    let panel = null;
    let backdrop = null;

    let notifInterval = null;

    function iniciarNotifInterval() {
        if (!notifInterval) notifInterval = setInterval(cargarNotificacionesEstudiante, 12000);
    }

    function detenerNotifInterval() {
        if (notifInterval) {
            clearInterval(notifInterval);
            notifInterval = null;
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        currentUser = await window.shidellSession?.obtenerUsuario();
        if (!currentUser || !currentUser.id) return;
        prepararNotificaciones();
        cargarNotificacionesEstudiante();
        iniciarNotifInterval();

        // Smart Polling: Suspender cuando la pestaña está en segundo plano
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                detenerNotifInterval();
            } else {
                cargarNotificacionesEstudiante();
                iniciarNotifInterval();
            }
        });
    });

    function prepararNotificaciones() {
        asegurarBackdrop();

        document.querySelectorAll('.notification-btn').forEach(btn => {
            const badge = btn.querySelector('.badge');
            if (badge) {
                badge.textContent = '';
                badge.style.display = 'none';
            }

            btn.type = 'button';
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                await cargarNotificacionesEstudiante();
                togglePanel(btn);
            });
        });

        document.addEventListener('click', (e) => {
            if (panel && panel.classList.contains('visible')) {
                if (!panel.contains(e.target) && !e.target.closest('.notification-btn')) {
                    cerrarPanel();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panel && panel.classList.contains('visible')) {
                cerrarPanel();
            }
        });

        window.addEventListener('resize', () => {
            if (panel && panel.classList.contains('visible')) {
                const btn = document.querySelector('.notification-btn');
                posicionarPanel(btn);
            }
        });

        window.addEventListener('scroll', () => {
            if (panel && panel.classList.contains('visible')) {
                const btn = document.querySelector('.notification-btn');
                posicionarPanel(btn);
            }
        }, { passive: true });
    }

    function asegurarBackdrop() {
        if (!backdrop) {
            backdrop = document.getElementById('notificationBackdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'notificationBackdrop';
                backdrop.className = 'notification-backdrop';
                backdrop.addEventListener('click', cerrarPanel);
                backdrop.addEventListener('touchstart', cerrarPanel, { passive: true });
                document.body.appendChild(backdrop);
            }
        }
        return backdrop;
    }

    function cerrarPanel() {
        if (panel) panel.classList.remove('visible');
        if (backdrop) backdrop.classList.remove('visible');
    }

    window.cerrarPanelNotificaciones = cerrarPanel;

    function togglePanel(btn) {
        if (!panel) return;
        const isVisible = panel.classList.contains('visible');
        if (isVisible) {
            cerrarPanel();
            return;
        }

        panel.classList.add('visible');
        asegurarBackdrop();
        if (backdrop) backdrop.classList.add('visible');
        posicionarPanel(btn);
    }

    function posicionarPanel(btn) {
        if (!panel || !panel.classList.contains('visible')) return;
        const targetBtn = btn || document.querySelector('.notification-btn');
        if (!targetBtn) return;

        const rect = targetBtn.getBoundingClientRect();
        panel.style.position = 'fixed';

        if (window.innerWidth <= 640) {
            // Modo Smartphone: centrado con márgenes seguros a izquierda y derecha
            panel.style.top = `${Math.max(58, Math.round(rect.bottom + 8))}px`;
            panel.style.left = '12px';
            panel.style.right = '12px';
            panel.style.width = 'auto';
            panel.style.maxWidth = 'calc(100vw - 24px)';
        } else {
            // Modo Desktop/Tablet: alineado a la campana respetando límites de pantalla
            panel.style.top = `${Math.round(rect.bottom + 12)}px`;
            panel.style.left = 'auto';
            const rightOffset = Math.max(16, Math.round(window.innerWidth - rect.right));
            panel.style.right = `${rightOffset}px`;
            panel.style.width = 'min(416px, calc(100vw - 32px))';
            panel.style.maxWidth = '416px';
        }
    }

    async function cargarNotificacionesEstudiante() {
        if (!currentUser || !currentUser.id) return;

        try {
            const [resNotif, resMsgs] = await Promise.all([
                fetch(`/api/notificaciones/usuario/${currentUser.id}`),
                fetch(`/api/mensajes/noleidos/${currentUser.id}`)
            ]);

            const notificaciones = resNotif.ok ? await resNotif.json() : [];
            const mensajesNoLeidos = resMsgs.ok ? await resMsgs.json() : 0;
            const totalNoLeidas = notificaciones.filter(n => !n.leida).length + Number(mensajesNoLeidos || 0);

            actualizarBadges(totalNoLeidas);
            renderPanel(notificaciones, Number(mensajesNoLeidos || 0));
        } catch (error) {
            console.error('Error cargando notificaciones:', error);
            actualizarBadges(0);
        }
    }

    function actualizarBadges(total) {
        document.querySelectorAll('.notification-btn .badge').forEach(badge => {
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : String(total);
                badge.style.display = 'flex';
            } else {
                badge.textContent = '';
                badge.style.display = 'none';
            }
        });
    }

    function obtenerIconoNotificacion(titulo) {
        const t = String(titulo || '').toLowerCase();
        if (t.includes('tarea')) return '../icons/regular/clipboard-text.svg';
        if (t.includes('calificaci') || t.includes('nota')) return '../icons/regular/star.svg';
        if (t.includes('material')) return '../icons/regular/book-open.svg';
        return '../icons/regular/bell.svg';
    }

    function obtenerDestinoNotificacion(titulo) {
        const t = String(titulo || '').toLowerCase();
        if (t.includes('tarea')) return 'tareas.html';
        if (t.includes('calificaci') || t.includes('nota')) return 'calificaciones.html';
        if (t.includes('material')) return 'miscursos.html';
        return '';
    }

    let activeTab = 'all';
    let lastNotifs = [];
    let lastMsgCount = 0;

    function esc(v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtRelTime(f) {
        if (!f) return '';
        const d = new Date(f);
        if (Number.isNaN(d.getTime())) return '';
        const diff = Date.now() - d.getTime();
        if (diff < 60000) return 'Ahora';
        if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
        return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    }

    function renderPanel(notificaciones, mensajesNoLeidos) {
        lastNotifs = Array.isArray(notificaciones) ? notificaciones : [];
        lastMsgCount = Number(mensajesNoLeidos || 0);

        panel = document.getElementById('notificationPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'notificationPanel';
            panel.className = 'notification-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'Centro de notificaciones');
            document.body.appendChild(panel);
            panel.addEventListener('click', e => e.stopPropagation());
        }

        const unreadNotifs = lastNotifs.filter(n => !n.leida);
        const totalUnread = unreadNotifs.length + (lastMsgCount > 0 ? 1 : 0);
        const totalAll = lastNotifs.length + (lastMsgCount > 0 ? 1 : 0);
        const sourceList = activeTab === 'unread' ? unreadNotifs : lastNotifs;

        const items = [];
        if (lastMsgCount > 0) {
            items.push(`
                <button type="button" class="notif-row unread" onclick="window.location.href='mensajes.html'">
                    <span class="notif-icon"><img src="../icons/regular/chat-circle-dots.svg" class="icon-img" alt="Mensajes"></span>
                    <span class="notif-content">
                        <span class="np-row-top">
                            <strong>Mensajes nuevos</strong>
                            <span class="notif-time">Ahora</span>
                        </span>
                        <small>${lastMsgCount} mensaje(s) sin leer en tu bandeja</small>
                    </span>
                    <span class="np-unread-col" aria-hidden="true"><span class="np-unread-dot"></span></span>
                </button>
            `);
        }

        sourceList.slice(0, 12).forEach(n => {
            const icono = obtenerIconoNotificacion(n.titulo);
            const destino = obtenerDestinoNotificacion(n.titulo);
            items.push(`
                <button type="button" class="notif-row ${n.leida ? '' : 'unread'}" onclick="marcarNotificacionLeida(${n.id}, '${destino}')">
                    <span class="notif-icon"><img src="${icono}" class="icon-img" alt="notif"></span>
                    <span class="notif-content">
                        <span class="np-row-top">
                            <strong>${esc(n.titulo || 'Notificación')}</strong>
                            <span class="notif-time">${esc(fmtRelTime(n.fecha))}</span>
                        </span>
                        <small>${esc(n.mensaje || '')}</small>
                    </span>
                    <span class="np-unread-col" aria-hidden="true">${n.leida ? '' : '<span class="np-unread-dot"></span>'}</span>
                </button>
            `);
        });

        const emptyTitle = activeTab === 'unread' ? 'Todo al día' : 'Sin novedades por ahora';
        const emptyCopy = activeTab === 'unread'
            ? 'No tienes notificaciones pendientes por revisar.'
            : 'Aquí aparecerán tus tareas, notas y mensajes nuevos.';

        panel.innerHTML = `
            <div class="np-head">
                <div class="np-title-wrap">
                    <h3>Notificaciones</h3>
                    <span class="notif-badge-pill">${totalUnread > 0 ? `${totalUnread} sin leer` : 'Al día'}</span>
                </div>
                <div class="notif-header-actions">
                    <button type="button" class="np-action-pill" onclick="marcarTodasNotificaciones()" ${unreadNotifs.length === 0 ? 'disabled' : ''} title="Marcar todas como leídas">
                        <img src="../icons/regular/checks.svg" class="icon-img" alt="checks">
                        <span>Marcar leídas</span>
                    </button>
                    <button type="button" class="np-close-btn" onclick="window.cerrarPanelNotificaciones()" title="Cerrar" aria-label="Cerrar notificaciones">
                        ✕
                    </button>
                </div>
            </div>
            <div class="np-tabs" role="tablist">
                <button type="button" role="tab" class="np-tab ${activeTab === 'all' ? 'is-active' : ''}" data-stu-np-tab="all" aria-selected="${activeTab === 'all'}">
                    <span>Todas</span>
                    <span class="np-tab-count">${totalAll}</span>
                </button>
                <button type="button" role="tab" class="np-tab ${activeTab === 'unread' ? 'is-active' : ''}" data-stu-np-tab="unread" aria-selected="${activeTab === 'unread'}">
                    <span>Sin leer</span>
                    <span class="np-tab-count">${totalUnread}</span>
                </button>
            </div>
            <div class="notification-panel-list">
                ${items.length ? items.join('') : `
                    <div class="np-empty">
                        <span class="np-empty-icon"><img src="../icons/regular/bell-slash.svg" class="icon-img" alt="bell-slash"></span>
                        <p class="np-empty-title">${emptyTitle}</p>
                        <p class="np-empty-copy">${emptyCopy}</p>
                    </div>
                `}
            </div>
        `;

        panel.querySelectorAll('[data-stu-np-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                const next = tab.getAttribute('data-stu-np-tab');
                if (next && next !== activeTab) {
                    activeTab = next;
                    renderPanel(lastNotifs, lastMsgCount);
                }
            });
        });
    }

    window.marcarNotificacionLeida = async function (id, destino) {
        await fetch(`/api/notificaciones/${id}/leer`, { method: 'PUT' }).catch(() => {});
        await cargarNotificacionesEstudiante();
        if (destino && !window.location.pathname.endsWith(destino)) {
            window.location.href = destino;
        }
    };

    window.marcarTodasNotificaciones = async function () {
        if (!currentUser) return;
        const res = await fetch(`/api/notificaciones/usuario/${currentUser.id}`).catch(() => null);
        const notificaciones = res && res.ok ? await res.json() : [];
        await Promise.all(notificaciones.filter(n => !n.leida).map(n =>
            fetch(`/api/notificaciones/${n.id}/leer`, { method: 'PUT' }).catch(() => {})
        ));
        await cargarNotificacionesEstudiante();
    };

})();
