import { Auth } from './services/auth.js';
import { Router } from './core/router.js?v=20261115a';
import { NotificacionesService } from './services/notificacionesService.js?v=20261114u';

const THEME_STORAGE_KEY = 'shidell_docente_theme';

function syncThemeToggleUI(theme) {
    const isLight = theme === 'light';
    const btn = document.getElementById('btn-theme-toggle');
    const icon = document.getElementById('theme-toggle-icon');
    const label = document.getElementById('theme-toggle-label');
    const metaTheme = document.getElementById('meta-theme-color');

    document.documentElement.dataset.theme = theme;
    if (metaTheme) {
        metaTheme.content = isLight ? '#FFFFFF' : '#0B0D11';
    }
    if (icon) {
        icon.className = isLight ? 'ph ph-moon' : 'ph ph-sun';
    }
    if (label) {
        label.textContent = isLight ? 'Modo noche' : 'Modo día';
    }
    if (btn) {
        const nextAction = isLight ? 'Cambiar a modo noche' : 'Cambiar a modo día';
        btn.title = nextAction;
        btn.setAttribute('aria-label', nextAction);
        btn.setAttribute('aria-pressed', String(isLight));
    }
}

function initThemeToggle() {
    const saved = (() => {
        try {
            return localStorage.getItem(THEME_STORAGE_KEY);
        } catch {
            return null;
        }
    })();
    const current = document.documentElement.dataset.theme === 'light' || saved === 'light' ? 'light' : 'dark';
    syncThemeToggleUI(current);

    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
        btn.addEventListener('click', (e) => {
            const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
            const applyTheme = () => {
                try {
                    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
                } catch {
                    // Ignorar si localStorage está restringido
                }
                syncThemeToggleUI(nextTheme);
                window.dispatchEvent(new CustomEvent('shidell:theme-changed', { detail: { theme: nextTheme } }));
            };

            const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            if (!document.startViewTransition || reduceMotion) {
                applyTheme();
                return;
            }

            const rect = btn.getBoundingClientRect();
            const x = e.clientX || (rect.left + rect.width / 2);
            const y = e.clientY || (rect.top + rect.height / 2);
            const root = document.documentElement;
            root.style.setProperty('--vt-x', `${Math.round(x)}px`);
            root.style.setProperty('--vt-y', `${Math.round(y)}px`);
            root.classList.add('shidell-theme-transition');

            const vt = document.startViewTransition(() => applyTheme());
            vt.finished.finally(() => {
                root.classList.remove('shidell-theme-transition');
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Initialize Day/Night Theme Toggle
    initThemeToggle();

    // 1. Verify Authentication
    const user = Auth.getUser();
    if (!user || user.rol !== 'DOCENTE') {
        window.location.href = '../login.html';
        return;
    }

    // 1.5 Heartbeat de presencia en línea (mientras el portal docente esté visible)
    window.ShidellPresence?.startHeartbeat?.(() => Auth.getUser());

    // 2. Setup Topbar UI
    document.getElementById('topbar-subtitle').textContent = new Date().toLocaleDateString('es-PE', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const topbarName = document.getElementById('topbar-name');
    const topbarRole = document.getElementById('topbar-role');
    const topbarAvatar = document.getElementById('topbar-avatar');

    if (topbarName) {
        topbarName.textContent = `${user.nombres} ${user.apellidos}`;
    }
    if (topbarRole) {
        let roleText = 'Docente';
        if (user.nivel && user.nivel !== 'POR ASIGNAR') {
            const esAulaUnica = user.grado && user.seccion
                && user.grado !== 'Múltiple' && user.seccion !== 'Múltiple';
            if (esAulaUnica) {
                const turno = user.turno && user.turno !== 'POR ASIGNAR' ? ` (${user.turno})` : '';
                roleText += ` | ${user.grado}° ${user.seccion} - ${user.nivel}${turno}`;
            } else {
                const grado = user.grado && user.grado !== 'Múltiple' ? ` · ${user.grado}°` : '';
                roleText += ` | ${user.nivel}${grado} · Múltiples secciones`;
            }
        } else if (user.nivel === 'POR ASIGNAR') {
            roleText += ' | Sin asignación';
        }
        topbarRole.textContent = roleText;
    }
    if (topbarAvatar && user.fotoPerfil) {
        const fotoUrl = (user.fotoPerfil.startsWith('/') || user.fotoPerfil.startsWith('http')) 
            ? user.fotoPerfil 
            : '/uploads/perfiles/' + user.fotoPerfil;
        topbarAvatar.innerHTML = `<img src="${fotoUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    }

    document.getElementById('btn-logout').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
    });

    // 3. Notificaciones
    NotificacionesService.init();

    // 4. Initialize Router
    Router.init();
});
