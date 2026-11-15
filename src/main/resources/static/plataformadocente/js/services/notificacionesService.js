import { API } from './api.js';
import { Auth } from './auth.js';
import { DocentePrefs } from './docentePrefs.js?v=20261114u';

function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatRelativeTime(fechaStr) {
    if (!fechaStr) return '';
    const d = new Date(fechaStr);
    if (Number.isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Ahora';
    if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)} h`;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function resolveNotifIcon(titulo = '') {
    const t = String(titulo).toLowerCase();
    if (t.includes('tarea') || t.includes('entrega')) return 'ph-clipboard-text';
    if (t.includes('calificaci') || t.includes('nota') || t.includes('examen')) return 'ph-star';
    if (t.includes('mensaje') || t.includes('foro') || t.includes('comentario')) return 'ph-chat-circle-dots';
    if (t.includes('clase') || t.includes('horario') || t.includes('evento')) return 'ph-calendar-blank';
    if (t.includes('crítico') || t.includes('alerta') || t.includes('urgente')) return 'ph-warning-circle';
    return 'ph-bell';
}

export const NotificacionesService = {
    panel: null,
    backdrop: null,
    triggerBtn: null,
    notificaciones: [],
    activeTab: DocentePrefs.get().notifDefaultTab || 'all',
    _boundGlobals: false,
    _pollTimer: null,

    startPolling(userId) {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        const pollMs = Number(DocentePrefs.get().notifPollMs);
        if (pollMs > 0 && userId) {
            this._pollTimer = setInterval(() => this.cargarNotificaciones(userId), pollMs);
        }
    },

    syncBadge() {
        const badge = document.getElementById('notificaciones-badge');
        if (!badge) return;
        const showBadge = DocentePrefs.get().showNotifBadge !== false;
        const noLeidas = this.notificaciones.filter(n => !n.leida).length;
        if (showBadge && noLeidas > 0) {
            badge.textContent = noLeidas > 9 ? '9+' : String(noLeidas);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    },

    async init() {
        const user = Auth.getUser();
        if (!user) return;

        this.activeTab = DocentePrefs.get().notifDefaultTab || 'all';
        await this.cargarNotificaciones(user.id);
        this.startPolling(user.id);

        const bellIcon = document.getElementById('btn-notificaciones');
        if (bellIcon) {
            this.triggerBtn = bellIcon;
            bellIcon.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.cargarNotificaciones(user.id);
                this.togglePanel(bellIcon);
            });
        }

        if (!this._boundGlobals) {
            this._boundGlobals = true;
            window.addEventListener('shidell:prefs-changed', (e) => {
                const prefs = e?.detail || DocentePrefs.get();
                if (prefs?.notifDefaultTab) {
                    this.activeTab = prefs.notifDefaultTab;
                    this.renderPanel(this.notificaciones);
                }
                this.syncBadge();
                const currentUser = Auth.getUser();
                if (currentUser) this.startPolling(currentUser.id);
            });
            document.addEventListener('click', (e) => {
                if (this.panel?.classList.contains('visible')) {
                    if (!this.panel.contains(e.target) && !e.target.closest('#btn-notificaciones')) {
                        this.closePanel();
                    }
                }
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.panel?.classList.contains('visible')) {
                    this.closePanel();
                }
            });
            window.addEventListener('resize', () => this.positionPanel());
            window.addEventListener('scroll', () => this.positionPanel(), { passive: true });
        }
    },

    async cargarNotificaciones(userId) {
        try {
            const data = await API.fetch(`/api/notificaciones/usuario/${userId}`);
            this.notificaciones = Array.isArray(data) ? data : [];
            this.renderPanel(this.notificaciones);
            this.syncBadge();
        } catch (e) {
            console.error('Error cargando notificaciones', e);
        }
    },

    ensureBackdrop() {
        if (!this.backdrop) {
            this.backdrop = document.getElementById('notificationBackdrop');
            if (!this.backdrop) {
                this.backdrop = document.createElement('div');
                this.backdrop.id = 'notificationBackdrop';
                this.backdrop.className = 'notification-backdrop';
                this.backdrop.addEventListener('click', () => this.closePanel());
                document.body.appendChild(this.backdrop);
            }
        }
        return this.backdrop;
    },

    closePanel() {
        this.panel?.classList.remove('visible');
        this.backdrop?.classList.remove('visible');
    },

    positionPanel(btn) {
        if (!this.panel || !this.panel.classList.contains('visible')) return;
        const target = btn || this.triggerBtn || document.getElementById('btn-notificaciones');
        if (!target) return;

        const rect = target.getBoundingClientRect();
        this.panel.style.position = 'fixed';

        if (window.innerWidth <= 640) {
            this.panel.style.top = `${Math.max(60, Math.round(rect.bottom + 8))}px`;
            this.panel.style.left = '12px';
            this.panel.style.right = '12px';
            this.panel.style.width = 'auto';
        } else {
            this.panel.style.left = 'auto';
            this.panel.style.top = `${Math.round(rect.bottom + 12)}px`;
            const rightGap = Math.max(16, Math.round(window.innerWidth - rect.right));
            this.panel.style.right = `${rightGap}px`;
        }
    },

    togglePanel(btn) {
        if (!this.panel) return;
        this.triggerBtn = btn || this.triggerBtn;
        const willOpen = !this.panel.classList.contains('visible');
        if (!willOpen) {
            this.closePanel();
            return;
        }
        this.ensureBackdrop().classList.add('visible');
        this.panel.classList.add('visible');
        this.positionPanel(this.triggerBtn);
    },

    renderPanel(notificaciones) {
        if (!this.panel) {
            this.panel = document.createElement('div');
            this.panel.id = 'notificationPanel';
            this.panel.className = 'notification-panel';
            this.panel.setAttribute('role', 'dialog');
            this.panel.setAttribute('aria-label', 'Centro de notificaciones');
            document.body.appendChild(this.panel);
            this.panel.addEventListener('click', e => e.stopPropagation());
        }

        const total = notificaciones.length;
        const unreadList = notificaciones.filter(n => !n.leida);
        const unreadCount = unreadList.length;
        const visibleItems = (this.activeTab === 'unread' ? unreadList : notificaciones).slice(0, 12);

        const rowsHtml = visibleItems.map(n => `
            <button type="button" class="notif-row ${n.leida ? '' : 'unread'}" data-id="${escapeHtml(n.id)}">
                <span class="notif-icon"><i class="ph ${resolveNotifIcon(n.titulo)}"></i></span>
                <span class="notif-content">
                    <span class="np-row-top">
                        <strong>${escapeHtml(n.titulo || 'Notificación')}</strong>
                        <span class="notif-time">${escapeHtml(formatRelativeTime(n.fecha))}</span>
                    </span>
                    <small>${escapeHtml(n.mensaje || '')}</small>
                </span>
                <span class="np-unread-col" aria-hidden="true">
                    ${n.leida ? '' : '<span class="np-unread-dot"></span>'}
                </span>
            </button>
        `).join('');

        const emptyTitle = this.activeTab === 'unread' ? 'Todo al día' : 'Sin novedades por ahora';
        const emptyCopy = this.activeTab === 'unread'
            ? 'No tienes notificaciones pendientes por revisar.'
            : 'Te avisaremos aquí cuando haya entregas, mensajes o avisos de tus cursos.';

        this.panel.innerHTML = `
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
                    <button type="button" class="np-close-btn" id="np-close-btn" title="Cerrar" aria-label="Cerrar notificaciones">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            </div>
            <div class="np-tabs" role="tablist">
                <button type="button" role="tab" class="np-tab ${this.activeTab === 'all' ? 'is-active' : ''}" data-np-tab="all" aria-selected="${this.activeTab === 'all'}">
                    <span>Todas</span>
                    <span class="np-tab-count">${total}</span>
                </button>
                <button type="button" role="tab" class="np-tab ${this.activeTab === 'unread' ? 'is-active' : ''}" data-np-tab="unread" aria-selected="${this.activeTab === 'unread'}">
                    <span>Sin leer</span>
                    <span class="np-tab-count">${unreadCount}</span>
                </button>
            </div>
            <div class="notification-panel-list">
                ${rowsHtml || `
                    <div class="np-empty">
                        <span class="np-empty-icon"><i class="ph ${unreadCount === 0 && total > 0 ? 'ph-check-circle' : 'ph-bell-simple'}"></i></span>
                        <p class="np-empty-title">${emptyTitle}</p>
                        <p class="np-empty-copy">${emptyCopy}</p>
                    </div>
                `}
            </div>
        `;

        this.panel.querySelector('#np-close-btn')?.addEventListener('click', () => this.closePanel());

        this.panel.querySelectorAll('[data-np-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                const next = tab.getAttribute('data-np-tab');
                if (next && next !== this.activeTab) {
                    this.activeTab = next;
                    this.renderPanel(this.notificaciones);
                }
            });
        });

        this.panel.querySelectorAll('.notif-row').forEach(row => {
            row.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                try {
                    await API.fetch(`/api/notificaciones/${id}/leer`, { method: 'PUT' });
                    const user = Auth.getUser();
                    if (user) await this.cargarNotificaciones(user.id);
                } catch (err) {
                    console.error(err);
                }
            });
        });

        this.panel.querySelector('#btn-marcar-todas')?.addEventListener('click', async () => {
            const user = Auth.getUser();
            if (!user || unreadCount === 0) return;
            await Promise.all(unreadList.map(n =>
                API.fetch(`/api/notificaciones/${n.id}/leer`, { method: 'PUT' }).catch(() => {})
            ));
            await this.cargarNotificaciones(user.id);
        });
    }
};
