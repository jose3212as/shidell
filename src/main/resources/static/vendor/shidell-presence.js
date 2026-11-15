(function (global) {
    'use strict';

    const ONLINE_WINDOW_MINUTES = 3;
    const AWAY_WINDOW_MINUTES = 15;
    const HEARTBEAT_INTERVAL_MS = 30000;
    const MIN_PING_GAP_MS = 10000;

    let heartbeatState = null;

    function parseConnectionDate(value) {
        if (!value) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function extractUltimaConexion(source) {
        if (!source) return null;
        if (typeof source === 'string' || typeof source === 'number' || source instanceof Date) {
            return parseConnectionDate(source);
        }
        return parseConnectionDate(source.ultimaConexion);
    }

    function formatLastConnectionTooltip(date) {
        if (!date) return 'Sin conexión registrada';
        try {
            return `Última conexión: ${date.toLocaleString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })}`;
        } catch {
            return 'Sin conexión reciente';
        }
    }

    function getStatus(contactoOrDate, nowMs = Date.now()) {
        const lastDate = extractUltimaConexion(contactoOrDate);
        if (!lastDate) {
            return {
                state: 'offline',
                label: 'Desconectado',
                shortLabel: 'Desconectado',
                diffMinutes: Infinity,
                title: 'Sin conexión reciente'
            };
        }

        const diffMinutes = (nowMs - lastDate.getTime()) / 60000;
        if (diffMinutes < ONLINE_WINDOW_MINUTES) {
            return {
                state: 'online',
                label: 'En línea',
                shortLabel: 'En línea',
                diffMinutes,
                title: 'Activo ahora'
            };
        }

        if (diffMinutes < AWAY_WINDOW_MINUTES) {
            const mins = Math.max(1, Math.floor(diffMinutes));
            return {
                state: 'away',
                label: `Ausente · hace ${mins} min`,
                shortLabel: 'Ausente',
                diffMinutes,
                title: `Inactivo hace ${mins} min`
            };
        }

        return {
            state: 'offline',
            label: 'Desconectado',
            shortLabel: 'Desconectado',
            diffMinutes,
            title: formatLastConnectionTooltip(lastDate)
        };
    }

    function readUserDefault() {
        try {
            return JSON.parse(localStorage.getItem('shidell_user') || 'null');
        } catch {
            return null;
        }
    }

    function startHeartbeat(getUserFn, options = {}) {
        const resolveUser = typeof getUserFn === 'function' ? getUserFn : readUserDefault;
        stopHeartbeat();

        const intervalMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : HEARTBEAT_INTERVAL_MS;
        let lastPingAt = 0;
        let inFlight = false;

        async function sendPing(force = false) {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            const user = resolveUser();
            if (!user || !user.id) return;

            const now = Date.now();
            if (!force && now - lastPingAt < MIN_PING_GAP_MS) return;
            if (inFlight) return;

            inFlight = true;
            lastPingAt = now;
            try {
                const headers = {};
                if (user.sessionToken) headers['Authorization'] = `Bearer ${user.sessionToken}`;
                await fetch(`/api/users/${encodeURIComponent(user.id)}/ping`, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers
                });
            } catch {
                // Silencioso en caídas de red momentáneas
            } finally {
                inFlight = false;
            }
        }

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') sendPing(false);
        };
        const onFocus = () => sendPing(false);

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onFocus);

        sendPing(true);
        const timerId = window.setInterval(() => sendPing(false), intervalMs);

        heartbeatState = {
            timerId,
            cleanup: () => {
                window.clearInterval(timerId);
                document.removeEventListener('visibilitychange', onVisibilityChange);
                window.removeEventListener('focus', onFocus);
            }
        };

        return heartbeatState;
    }

    function stopHeartbeat() {
        if (heartbeatState && typeof heartbeatState.cleanup === 'function') {
            heartbeatState.cleanup();
        }
        heartbeatState = null;
    }

    async function notifyLogout(userOrToken) {
        stopHeartbeat();
        const user = (userOrToken && typeof userOrToken === 'object') ? userOrToken : readUserDefault();
        const token = typeof userOrToken === 'string'
            ? userOrToken
            : (user?.sessionToken || readUserDefault()?.sessionToken || '');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers
            });
        } catch {
            // No bloquear navegación si el servidor no responde
        }
    }

    global.ShidellPresence = {
        ONLINE_WINDOW_MINUTES,
        AWAY_WINDOW_MINUTES,
        HEARTBEAT_INTERVAL_MS,
        parseConnectionDate,
        getStatus,
        startHeartbeat,
        stopHeartbeat,
        notifyLogout
    };
})(window);
