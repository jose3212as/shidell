import { API } from './api.js';
import { Auth } from './auth.js';

export const NotificacionesService = {
    panel: null,
    
    async init() {
        const user = Auth.getUser();
        if (!user) return;

        await this.cargarNotificaciones(user.id);
        setInterval(() => this.cargarNotificaciones(user.id), 30000);
        
        const bellIcon = document.getElementById('btn-notificaciones');
        if (bellIcon) {
            bellIcon.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.cargarNotificaciones(user.id);
                this.togglePanel(bellIcon);
            });
        }

        document.addEventListener('click', () => {
            if (this.panel) this.panel.classList.remove('visible');
        });
    },

    async cargarNotificaciones(userId) {
        try {
            const notificaciones = await API.fetch(`/api/notificaciones/usuario/${userId}`);
            this.renderPanel(notificaciones);
            
            const badge = document.getElementById('notificaciones-badge');
            const noLeidas = notificaciones.filter(n => !n.leida).length;
            if (badge) {
                if (noLeidas > 0) {
                    badge.textContent = noLeidas > 9 ? '9+' : noLeidas;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (e) {
            console.error("Error cargando notificaciones", e);
        }
    },

    togglePanel(btn) {
        if (!this.panel) return;
        const isVisible = this.panel.classList.contains('visible');
        this.panel.classList.toggle('visible', !isVisible);
        this.panel.style.top = `${btn.offsetTop + btn.offsetHeight + 10}px`;
        this.panel.style.right = '20px';
    },

    renderPanel(notificaciones) {
        if (!this.panel) {
            this.panel = document.createElement('div');
            this.panel.id = 'notificationPanel';
            this.panel.className = 'notification-panel';
            document.body.appendChild(this.panel);
            this.panel.addEventListener('click', e => e.stopPropagation());
        }

        const items = [];
        notificaciones.slice(0, 10).forEach(n => {
            items.push(`
                <button class="notif-row ${n.leida ? '' : 'unread'}" data-id="${n.id}">
                    <span class="notif-icon"><i class="ph ph-bell"></i></span>
                    <span class="notif-content">
                        <strong>${n.titulo}</strong>
                        <small>${n.mensaje}</small>
                        <span class="time">${new Date(n.fecha).toLocaleString()}</span>
                    </span>
                </button>
            `);
        });

        this.panel.innerHTML = `
            <div class="notification-panel-header">
                <h3>Notificaciones</h3>
                <button id="btn-marcar-todas" title="Marcar como leídas"><i class="ph ph-checks"></i></button>
            </div>
            <div class="notification-panel-list">
                ${items.length ? items.join('') : '<div class="notif-empty"><i class="ph ph-bell-slash"></i><p>No tienes notificaciones pendientes.</p></div>'}
            </div>
        `;

        this.panel.querySelectorAll('.notif-row').forEach(row => {
            row.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                try {
                    await API.fetch(`/api/notificaciones/${id}/leer`, { method: 'PUT' });
                    const user = Auth.getUser();
                    if(user) this.cargarNotificaciones(user.id);
                } catch (err) {
                    console.error(err);
                }
            });
        });

        const btnMarcarTodas = this.panel.querySelector('#btn-marcar-todas');
        if (btnMarcarTodas) {
            btnMarcarTodas.addEventListener('click', async () => {
                const user = Auth.getUser();
                if (!user) return;
                await Promise.all(notificaciones.filter(n => !n.leida).map(n =>
                    API.fetch(`/api/notificaciones/${n.id}/leer`, { method: 'PUT' }).catch(() => {})
                ));
                this.cargarNotificaciones(user.id);
            });
        }
    }
};
