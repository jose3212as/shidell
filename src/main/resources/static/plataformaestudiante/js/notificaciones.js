(function () {
    let currentUser = null;
    let panel = null;

    document.addEventListener('DOMContentLoaded', async () => {
        currentUser = await window.shidellSession?.obtenerUsuario();
        if (!currentUser || !currentUser.id) return;
        prepararNotificaciones();
        cargarNotificacionesEstudiante();
        setInterval(cargarNotificacionesEstudiante, 30000);
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
                badge.textContent = '';
                badge.style.display = 'block';
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
        panel.style.top = `${btn.offsetTop + btn.offsetHeight + 10}px`;
        panel.style.right = '0px';
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
                <button class="notif-row" onclick="window.location.href='mensajes.html'">
                    <span class="notif-icon"><i class="ph ph-chat-circle-dots"></i></span>
                    <span><strong>Mensajes nuevos</strong><small>${mensajesNoLeidos} mensaje(s) sin leer</small></span>
                </button>
            `);
        }

        notificaciones.slice(0, 6).forEach(n => {
            items.push(`
                <button class="notif-row ${n.leida ? '' : 'unread'}" onclick="marcarNotificacionLeida(${n.id})">
                    <span class="notif-icon"><i class="ph ph-bell"></i></span>
                    <span><strong>${n.titulo || 'Notificacion'}</strong><small>${n.mensaje || ''}</small></span>
                </button>
            `);
        });

        panel.innerHTML = `
            <div class="notification-panel-header">
                <h3>Notificaciones</h3>
                <button onclick="marcarTodasNotificaciones()" title="Marcar como leidas"><i class="ph ph-checks"></i></button>
            </div>
            <div class="notification-panel-list">
                ${items.length ? items.join('') : '<p class="notif-empty">No tienes notificaciones pendientes.</p>'}
            </div>
        `;
    }

    window.marcarNotificacionLeida = async function (id) {
        await fetch(`/api/notificaciones/${id}/leer`, { method: 'PUT' }).catch(() => {});
        await cargarNotificacionesEstudiante();
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
