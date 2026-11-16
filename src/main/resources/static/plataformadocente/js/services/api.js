import { Auth } from './auth.js';

const API_BASE = (window.location.host === '' || !window.location.host.includes('localhost')) 
    ? 'http://localhost:8080' 
    : '';

export const API = {
    async fetch(endpoint, options = {}) {
        const token = Auth.getToken();
        const isFormData = options.body instanceof FormData;
        const headers = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const statusEl = document.getElementById('server-status');
            if (statusEl) statusEl.textContent = 'Sincronizando...';

            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    Auth.logout();
                    throw new Error('Tu sesión se cerró por seguridad. Inicia sesión otra vez.');
                }
                let msg = '';
                try {
                    const errBody = await response.json();
                    msg = errBody?.error || errBody?.message || '';
                } catch {}
                const friendly = window.ShidellErrors
                    ? window.ShidellErrors.humanizar(msg || `HTTP ${response.status}`, 'No pudimos completar esta operación. Intenta nuevamente.')
                    : (msg || 'No pudimos completar esta operación. Intenta nuevamente.');
                throw new Error(friendly);
            }

            if (statusEl) statusEl.textContent = 'En línea';

            const text = await response.text();
            return text ? JSON.parse(text) : null;

        } catch (error) {
            const statusEl = document.getElementById('server-status');
            if (statusEl) statusEl.textContent = 'Sin conexión momentánea';
            console.warn('Aviso de conexión:', error);
            if (window.ShidellErrors && error instanceof Error) {
                throw new Error(window.ShidellErrors.humanizar(error.message));
            }
            throw error;
        }
    }
};
