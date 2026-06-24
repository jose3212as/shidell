import { Auth } from './auth.js';

const API_BASE = (window.location.host === '' || !window.location.host.includes('localhost')) 
    ? 'http://localhost:8080' 
    : '';

export const API = {
    async fetch(endpoint, options = {}) {
        const token = Auth.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const statusEl = document.getElementById('server-status');
            if (statusEl) statusEl.textContent = 'Estado: Conectando...';

            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    Auth.logout();
                    throw new Error('Sesión expirada');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (statusEl) statusEl.textContent = 'Estado: Conectado';
            
            // Check if response has content before parsing JSON
            const text = await response.text();
            return text ? JSON.parse(text) : null;
            
        } catch (error) {
            const statusEl = document.getElementById('server-status');
            if (statusEl) statusEl.textContent = 'Estado: Error de conexión';
            console.error('API Error:', error);
            throw error;
        }
    }
};
