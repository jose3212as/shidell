(function () {
    let currentUser = null;
    let panel = null;

    document.addEventListener('DOMContentLoaded', async () => {
        currentUser = await window.shidellSession?.obtenerUsuario();
        if (!currentUser || !currentUser.id) return;
        prepararNotificaciones();
        cargarNotificacionesEstudiante();
        setInterval(cargarNotificacionesEstudiante, 10000);
    });

    function prepararNotificaciones() {
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

        document.addEventListener('click', () => {
            if (panel) panel.classList.remove('visible');
        });
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

    function togglePanel(btn) {
        if (!panel) return;
        const isVisible = panel.classList.contains('visible');
        panel.classList.toggle('visible', !isVisible);
        const rect = btn.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = `${rect.bottom + 10}px`;
        panel.style.right = `${Math.max(16, window.innerWidth - rect.right)}px`;
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

    function renderPanel(notificaciones, mensajesNoLeidos) {
        panel = document.getElementById('notificationPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'notificationPanel';
            panel.className = 'notification-panel';
            document.body.appendChild(panel);
            panel.addEventListener('click', e => e.stopPropagation());
        }

        const items = [];
        if (mensajesNoLeidos > 0) {
            items.push(`
                <button class="notif-row unread" onclick="window.location.href='mensajes.html'">
                    <span class="notif-icon"><img src="../icons/regular/chat-circle-dots.svg" class="icon-img" alt="chat-circle-dots"></span>
                    <span class="notif-content">
                        <strong>Mensajes nuevos</strong>
                        <small>${mensajesNoLeidos} mensaje(s) sin leer</small>
                    </span>
                </button>
            `);
        }

        notificaciones.slice(0, 12).forEach(n => {
            const icono = obtenerIconoNotificacion(n.titulo);
            const destino = obtenerDestinoNotificacion(n.titulo);
            items.push(`
                <button class="notif-row ${n.leida ? '' : 'unread'}" onclick="marcarNotificacionLeida(${n.id}, '${destino}')">
                    <span class="notif-icon"><img src="${icono}" class="icon-img" alt="notif"></span>
                    <span class="notif-content">
                        <strong>${n.titulo || 'Notificación'}</strong>
                        <small>${n.mensaje || ''}</small>
                        <span class="time">${new Date(n.fecha).toLocaleString('es-PE')}</span>
                    </span>
                </button>
            `);
        });

        panel.innerHTML = `
            <div class="notification-panel-header">
                <h3>Notificaciones</h3>
                <button onclick="marcarTodasNotificaciones()" title="Marcar todas como leídas"><img src="../icons/regular/checks.svg" class="icon-img" alt="checks"></button>
            </div>
            <div class="notification-panel-list">
                ${items.length ? items.join('') : '<div class="notif-empty"><img src="../icons/regular/bell-slash.svg" class="icon-img" alt="bell-slash"><p>No tienes notificaciones pendientes.</p></div>'}
            </div>
        `;
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
