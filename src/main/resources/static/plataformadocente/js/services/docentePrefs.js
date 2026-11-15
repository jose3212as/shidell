/**
 * Preferencias locales reales del docente en Portal Docente.
 * Persiste configuración de flujo de trabajo, densidad visual, animaciones y notificaciones
 * sin duplicar estado institucional (que pertenece al backend).
 */
const PREFS_KEY = 'shidell_docente_prefs';

const ALLOWED_START_ROUTES = new Set([
    '/dashboard',
    '/mis-clases',
    '/calificaciones',
    '/tareas',
    '/asistencia',
    '/calendario'
]);

const ALLOWED_POLL_INTERVALS = new Set([0, 15000, 30000, 60000]);

export const DEFAULT_DOCENTE_PREFS = Object.freeze({
    startRoute: '/dashboard',
    density: 'comfortable', // 'comfortable' | 'compact'
    reduceMotion: false,
    notifDefaultTab: 'all', // 'all' | 'unread'
    notifPollMs: 30000,     // 15000 | 30000 | 60000 | 0 (manual)
    showNotifBadge: true
});

function sanitize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const poll = Number(src.notifPollMs);
    return {
        startRoute: ALLOWED_START_ROUTES.has(src.startRoute)
            ? src.startRoute
            : DEFAULT_DOCENTE_PREFS.startRoute,
        density: src.density === 'compact' ? 'compact' : 'comfortable',
        reduceMotion: Boolean(src.reduceMotion),
        notifDefaultTab: src.notifDefaultTab === 'unread' ? 'unread' : 'all',
        notifPollMs: ALLOWED_POLL_INTERVALS.has(poll) ? poll : DEFAULT_DOCENTE_PREFS.notifPollMs,
        showNotifBadge: src.showNotifBadge === undefined
            ? DEFAULT_DOCENTE_PREFS.showNotifBadge
            : Boolean(src.showNotifBadge)
    };
}

export const DocentePrefs = {
    get() {
        try {
            const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
            return sanitize(parsed);
        } catch {
            return { ...DEFAULT_DOCENTE_PREFS };
        }
    },

    applyToDocument(prefs = this.get()) {
        const clean = sanitize(prefs);
        const root = document.documentElement;
        root.dataset.density = clean.density;
        root.dataset.motion = clean.reduceMotion ? 'reduced' : 'normal';
        return clean;
    },

    update(patch) {
        const next = sanitize({ ...this.get(), ...(patch || {}) });
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(next));
        } catch {
            // Ignorar si almacenamiento local está restringido
        }
        this.applyToDocument(next);
        window.dispatchEvent(new CustomEvent('shidell:prefs-changed', { detail: next }));
        return next;
    },

    reset() {
        const next = { ...DEFAULT_DOCENTE_PREFS };
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(next));
        } catch {
            // Ignorar si almacenamiento local está restringido
        }
        this.applyToDocument(next);
        window.dispatchEvent(new CustomEvent('shidell:prefs-changed', { detail: next }));
        return next;
    }
};
