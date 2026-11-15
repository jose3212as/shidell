/**
 * SHIDELL MOTION ENGINE (shidell-motion.js)
 * Sistema unificado de animaciones y transiciones modernas multi-portal:
 * - Cross-Document Portal Handoff Curtain (clip-path radial iris + WAAPI)
 * - Coreografía SPA y Multi-Página vía Web Animations API (stagger expo-out)
 * - Roll-up numérico para KPIs y estadísticas
 * - Seguimiento de luz (Cursor Spotlight), ondas de clic (Pointer Ripple) y física magnética
 * - Observador de revelado por scroll (IntersectionObserver) e hidratación asíncrona
 * - Respeto estricto de data-motion="reduced" y prefers-reduced-motion
 */
(function () {
    if (window.ShidellMotion) return;

    const HANDOFF_KEY = 'shidell_portal_handoff';
    const SPOTLIGHT_SELECTOR = [
        '.stat-item',
        '.course-card',
        '.portal-pill-card',
        '.premium-card',
        '.quick-btn',
        '.course-mini-card',
        '.ce-card',
        '.auth-card',
        '[data-spotlight]'
    ].join(', ');

    const RIPPLE_SELECTOR = [
        '.btn-primary',
        '.btn-primary-action',
        '.auth-btn',
        '.nav-cta',
        '[data-ripple]'
    ].join(', ');

    const EXCLUDED_ANCESTORS = '.messages-container, #chat-messages, .fc, .notification-panel, .notif-panel, .swal2-container';

    const PORTAL_META = {
        DOCENTE: {
            label: 'Portal Docente',
            subtitle: 'Cargando salones, asistencia y actas',
            accent: '#D8A24A',
            accent2: '#1E2430',
            bg: '#0B0D11',
            ink: '#EDF1F7',
            track: 'rgba(255, 255, 255, 0.12)',
            sub: 'rgba(237, 241, 247, 0.70)'
        },
        DOCENTE_LIGHT: {
            label: 'Portal Docente',
            subtitle: 'Cargando salones, asistencia y actas',
            accent: '#111318',
            accent2: '#334155',
            bg: '#FFFFFF',
            ink: '#111318',
            track: 'rgba(17, 19, 24, 0.12)',
            sub: 'rgba(17, 19, 24, 0.68)'
        },
        ESTUDIANTE: {
            label: 'Portal Estudiante',
            subtitle: 'Sincronizando cursos, horarios y tareas',
            accent: '#FFFFFF',
            accent2: '#0a2647',
            bg: '#144272',
            ink: '#FFFFFF',
            track: 'rgba(255, 255, 255, 0.2)',
            sub: 'rgba(255, 255, 255, 0.84)'
        },
        PADRE: {
            label: 'Portal Familias',
            subtitle: 'Conectando libreta y seguimiento académico',
            accent: '#FFFFFF',
            accent2: '#0f766e',
            bg: '#0d9488',
            ink: '#FFFFFF',
            track: 'rgba(255, 255, 255, 0.2)',
            sub: 'rgba(255, 255, 255, 0.85)'
        },
        ADMINISTRADOR: {
            label: 'Administración Central',
            subtitle: 'Inicializando gestión institucional',
            accent: '#FFFFFF',
            accent2: '#6366f1',
            bg: '#4f46e5',
            ink: '#FFFFFF',
            track: 'rgba(255, 255, 255, 0.2)',
            sub: 'rgba(255, 255, 255, 0.85)'
        },
        ADMIN: {
            label: 'Administración Central',
            subtitle: 'Inicializando gestión institucional',
            accent: '#FFFFFF',
            accent2: '#6366f1',
            bg: '#4f46e5',
            ink: '#FFFFFF',
            track: 'rgba(255, 255, 255, 0.2)',
            sub: 'rgba(255, 255, 255, 0.85)'
        },
        AUTH: {
            label: 'Acceso Shidell',
            subtitle: 'Cerrando sesión de forma segura',
            accent: '#FFFFFF',
            accent2: '#0a2647',
            bg: '#144272',
            ink: '#FFFFFF',
            track: 'rgba(255, 255, 255, 0.2)',
            sub: 'rgba(255, 255, 255, 0.84)'
        }
    };

    const animatedNodes = new WeakSet();
    const countedNodes = new WeakSet();
    let revealObserver = null;
    let rafSpotlight = 0;
    let lastPointerEvent = null;

    function isReducedMotion() {
        if (document.documentElement.dataset.motion === 'reduced') return true;
        return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function getPortalMeta(rol) {
        const key = String(rol || 'DOCENTE').toUpperCase();
        if (key === 'DOCENTE') {
            try {
                const docTheme = localStorage.getItem('shidell_docente_theme');
                const globalTheme = localStorage.getItem('shidell_theme');
                if (docTheme === 'light' || (!docTheme && globalTheme === 'light')) {
                    return PORTAL_META.DOCENTE_LIGHT;
                }
            } catch {
                // Ignorar si localStorage no está disponible
            }
            return PORTAL_META.DOCENTE;
        }
        return PORTAL_META[key] || PORTAL_META.DOCENTE;
    }

    function safeAnimate(el, keyframes, options) {
        if (!el || typeof el.animate !== 'function' || isReducedMotion()) return null;
        try {
            const anim = el.animate(keyframes, options);
            anim.finished.catch(() => {});
            return anim;
        } catch {
            return null;
        }
    }

    /* ======================================================================
       1. TRANSICIÓN ENTRE PORTALES (AUTH <-> PORTALES)
       ====================================================================== */
    function buildHandoffCurtainElement(meta, userName) {
        const existing = document.getElementById('shidell-portal-curtain');
        if (existing) existing.remove();

        const curtain = document.createElement('div');
        curtain.id = 'shidell-portal-curtain';
        curtain.className = 'shidell-handoff-curtain';
        curtain.style.setProperty('--hc-accent', meta.accent);
        curtain.style.setProperty('--hc-accent-2', meta.accent2);
        curtain.style.setProperty('--hc-bg', meta.bg);
        curtain.style.setProperty('--hc-ink', meta.ink);
        curtain.style.setProperty('--hc-track', meta.track || 'rgba(255, 255, 255, 0.2)');
        curtain.style.setProperty('--hc-sub', meta.sub || 'rgba(255, 255, 255, 0.84)');

        const greeting = userName ? `Bienvenido, ${escapeHtml(userName)}` : meta.label;
        curtain.innerHTML = `
            <div class="hc-mesh"></div>
            <div class="hc-center">
                <div class="hc-ring-wrap">
                    <svg class="hc-ring-svg" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
                        <circle class="hc-ring-track" cx="40" cy="40" r="34" />
                        <circle class="hc-ring-progress" cx="40" cy="40" r="34" />
                    </svg>
                    <div class="hc-core-dot"></div>
                </div>
                <span class="hc-kicker">${escapeHtml(meta.label)}</span>
                <h2 class="hc-title">${greeting}</h2>
                <p class="hc-sub">${escapeHtml(meta.subtitle)}</p>
            </div>
        `;
        return curtain;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function playPortalHandoff(options, onNavigate) {
        const { rol = 'DOCENTE', name = '', originEl = null } = options || {};
        const meta = getPortalMeta(rol);

        try {
            sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
                rol,
                name,
                ts: Date.now()
            }));
        } catch {
            // Ignorar si sessionStorage no está disponible
        }

        if (isReducedMotion() || typeof document.body?.animate !== 'function') {
            if (typeof onNavigate === 'function') onNavigate();
            return;
        }

        const curtain = buildHandoffCurtainElement(meta, name);
        let ox = '50%';
        let oy = '50%';
        if (originEl && typeof originEl.getBoundingClientRect === 'function') {
            const rect = originEl.getBoundingClientRect();
            ox = `${Math.round(rect.left + rect.width / 2)}px`;
            oy = `${Math.round(rect.top + rect.height / 2)}px`;
        }
        curtain.style.setProperty('--hc-ox', ox);
        curtain.style.setProperty('--hc-oy', oy);
        document.body.appendChild(curtain);

        const revealAnim = curtain.animate([
            { clipPath: `circle(0px at ${ox} ${oy})`, opacity: 0.7 },
            { clipPath: `circle(155vmax at ${ox} ${oy})`, opacity: 1 }
        ], {
            duration: 460,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards'
        });

        const centerEl = curtain.querySelector('.hc-center');
        safeAnimate(centerEl, [
            { opacity: 0, transform: 'translateY(14px) scale(0.96)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], {
            duration: 360,
            delay: 90,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'backwards'
        });

        revealAnim.finished.then(() => {
            setTimeout(() => {
                if (typeof onNavigate === 'function') onNavigate();
            }, 240);
        }).catch(() => {
            if (typeof onNavigate === 'function') onNavigate();
        });
    }

    function consumePortalHandoff() {
        let payload = null;
        try {
            const raw = sessionStorage.getItem(HANDOFF_KEY);
            if (!raw) return false;
            sessionStorage.removeItem(HANDOFF_KEY);
            payload = JSON.parse(raw);
        } catch {
            return false;
        }

        if (!payload || Date.now() - Number(payload.ts || 0) > 8000 || isReducedMotion()) {
            return false;
        }

        const meta = getPortalMeta(payload.rol);
        const curtain = buildHandoffCurtainElement(meta, payload.name);
        curtain.style.clipPath = 'circle(155vmax at 50% 50%)';
        document.body.appendChild(curtain);

        requestAnimationFrame(() => {
            setTimeout(() => {
                const closeAnim = curtain.animate([
                    { clipPath: 'circle(155vmax at 50% 50%)', opacity: 1 },
                    { clipPath: 'circle(0px at 50% 10%)', opacity: 0.35 }
                ], {
                    duration: 520,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'forwards'
                });
                closeAnim.finished.finally(() => curtain.remove());
            }, 130);
        });
        return true;
    }

    /* ======================================================================
       2. COREOGRAFÍA DE VISTAS (WAAPI + STAGGER + COUNTER ROLL-UP)
       ====================================================================== */
    function isInsideExcluded(el) {
        return Boolean(el.closest(EXCLUDED_ANCESTORS));
    }

    function animateCounters(root = document) {
        if (isReducedMotion()) return;
        const targets = root.querySelectorAll('.stat-val, .kpi-value, .metric-value, [data-countup]');
        targets.forEach(el => {
            if (countedNodes.has(el) || isInsideExcluded(el)) return;
            if (el.children.length > 0) return;

            const rawText = (el.textContent || '').trim();
            const match = rawText.match(/^(\d+(?:[.,]\d+)?)\s*(%)?$/);
            if (!match) return;

            const targetNum = parseFloat(match[1].replace(',', '.'));
            if (!Number.isFinite(targetNum) || targetNum === 0) return;

            const decimals = (match[1].split(/[.,]/)[1] || '').length;
            const usesComma = match[1].includes(',');
            const suffix = match[2] || '';

            countedNodes.add(el);
            const duration = Math.min(720, Math.max(380, Math.round(targetNum * 12)));
            const start = performance.now();

            function tick(now) {
                const p = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - p, 4);
                const current = targetNum * eased;
                let formatted = decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
                if (usesComma) formatted = formatted.replace('.', ',');
                el.textContent = formatted + suffix;
                if (p < 1) {
                    requestAnimationFrame(tick);
                } else {
                    el.textContent = rawText;
                }
            }
            requestAnimationFrame(tick);
        });
    }

    function collectChoreographyNodes(root) {
        const heroes = [];
        const cards = [];
        const rows = [];

        const heroSel = [
            '.fr-masthead', '.tr-masthead', '.mc-masthead', '.ep-masthead', '.ce-masthead',
            '.greeting', '.page-header', '.welcome-banner', '.hero-text-side',
            '.profile-hero', '.portal-editorial-header', '.docente-welcome'
        ].join(', ');

        const cardSel = [
            '.stat-item', '.metric-card', '.kpi-card', '.course-card', '.course-mini-card',
            '.premium-card', '.panel', '.card', '.portal-pill-card', '.ce-card',
            '.live-classroom-sheet', '.workflow-step', '.spec-cell'
        ].join(', ');

        const rowSel = [
            '.task-item', '.message-card', '.convo-item', '.grade-row',
            '.class-item', '.student-card', 'tbody tr'
        ].join(', ');

        root.querySelectorAll(heroSel).forEach(el => {
            if (!animatedNodes.has(el) && !isInsideExcluded(el)) heroes.push(el);
        });
        root.querySelectorAll(cardSel).forEach(el => {
            if (!animatedNodes.has(el) && !isInsideExcluded(el)) cards.push(el);
        });
        root.querySelectorAll(rowSel).forEach(el => {
            if (!animatedNodes.has(el) && !isInsideExcluded(el)) rows.push(el);
        });

        return { heroes, cards, rows };
    }

    function animateViewEnter(root = document.getElementById('app-content') || document.body, opts = {}) {
        if (!root) return;
        animateCounters(root);

        if (isReducedMotion()) return;

        const { force = false, baseDelay = 0 } = opts;
        if (!force && root.closest('.auth-page')) return;

        const { heroes, cards, rows } = collectChoreographyNodes(root);

        heroes.slice(0, 4).forEach((el, idx) => {
            animatedNodes.add(el);
            safeAnimate(el, [
                { opacity: 0, transform: 'translate3d(0, 12px, 0)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0)' }
            ], {
                duration: 360,
                delay: baseDelay + idx * 40,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'backwards'
            });
        });

        cards.slice(0, 14).forEach((el, idx) => {
            animatedNodes.add(el);
            safeAnimate(el, [
                { opacity: 0, transform: 'translate3d(0, 16px, 0) scale(0.986)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
            ], {
                duration: 390,
                delay: baseDelay + 35 + Math.min(idx, 9) * 34,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'backwards'
            });
        });

        rows.slice(0, 12).forEach((el, idx) => {
            animatedNodes.add(el);
            safeAnimate(el, [
                { opacity: 0, transform: 'translate3d(0, 9px, 0)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0)' }
            ], {
                duration: 300,
                delay: baseDelay + 70 + Math.min(idx, 10) * 22,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'backwards'
            });
        });
    }

    function animateViewExit(root) {
        if (!root || isReducedMotion() || typeof root.animate !== 'function') {
            return Promise.resolve();
        }
        if (!root.children.length) return Promise.resolve();
        const anim = root.animate([
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            { opacity: 0, transform: 'translate3d(0, -6px, 0)' }
        ], {
            duration: 120,
            easing: 'cubic-bezier(0.4, 0, 1, 1)'
        });
        return anim.finished.catch(() => {});
    }

    /* ======================================================================
       3. SPOTLIGHT EN TARJETAS + RIPPLE EN BOTONES + FLIP TABS
       ====================================================================== */
    function initGlobalMicroInteractions() {
        document.addEventListener('pointermove', (e) => {
            if (isReducedMotion()) return;
            lastPointerEvent = e;
            if (rafSpotlight) return;
            rafSpotlight = requestAnimationFrame(() => {
                rafSpotlight = 0;
                const ev = lastPointerEvent;
                if (!ev || !ev.target || !ev.target.closest) return;
                const card = ev.target.closest(SPOTLIGHT_SELECTOR);
                if (!card) return;
                const rect = card.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                const x = ((ev.clientX - rect.left) / rect.width) * 100;
                const y = ((ev.clientY - rect.top) / rect.height) * 100;
                card.style.setProperty('--mx', `${x.toFixed(1)}%`);
                card.style.setProperty('--my', `${y.toFixed(1)}%`);
            });
        }, { passive: true });

        document.addEventListener('pointerdown', (e) => {
            if (isReducedMotion()) return;
            const btn = e.target?.closest?.(RIPPLE_SELECTOR);
            if (!btn || btn.disabled) return;

            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.15;
            const ripple = document.createElement('span');
            ripple.className = 'shidell-ripple';
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

            if (getComputedStyle(btn).position === 'static') {
                btn.style.position = 'relative';
            }
            btn.classList.add('has-shidell-ripple');
            btn.appendChild(ripple);

            const anim = ripple.animate([
                { transform: 'scale(0.15)', opacity: 0.42 },
                { transform: 'scale(1.65)', opacity: 0 }
            ], {
                duration: 520,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
            });
            anim.finished.finally(() => ripple.remove());
        }, { passive: true });
    }

    function syncTabGlider(container, activeEl, gliderEl) {
        if (!container || !activeEl || !gliderEl) return;
        const left = activeEl.offsetLeft;
        const width = activeEl.offsetWidth;
        if (isReducedMotion()) {
            gliderEl.style.transform = `translateX(${left}px)`;
            gliderEl.style.width = `${width}px`;
            return;
        }
        gliderEl.style.transform = `translateX(${left}px)`;
        gliderEl.style.width = `${width}px`;
    }

    /* ======================================================================
       4. OBSERVADORES DE SCROLL Y CARGA ASÍNCRONA
       ====================================================================== */
    function initScrollReveals() {
        if (isReducedMotion() || typeof IntersectionObserver !== 'function') return;
        if (revealObserver) revealObserver.disconnect();

        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                revealObserver.unobserve(el);
                if (animatedNodes.has(el)) return;
                animatedNodes.add(el);
                safeAnimate(el, [
                    { opacity: 0, transform: 'translate3d(0, 18px, 0) scale(0.985)' },
                    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
                ], {
                    duration: 420,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'backwards'
                });
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

        document.querySelectorAll('[data-reveal], .workflow-card, .role-column, .section-editorial').forEach(el => {
            revealObserver.observe(el);
        });
    }

    function watchPortalHydration() {
        if (isReducedMotion() || typeof MutationObserver !== 'function') return;
        const targets = document.querySelectorAll('.content-area, .page-content, .main-wrapper');
        if (!targets.length) return;

        let debounce = 0;
        const mo = new MutationObserver((mutations) => {
            let hasUsefulAdditions = false;
            for (const m of mutations) {
                if (m.addedNodes.length > 0 && m.target && !isInsideExcluded(m.target)) {
                    hasUsefulAdditions = true;
                    break;
                }
            }
            if (!hasUsefulAdditions) return;
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                targets.forEach(t => animateViewEnter(t));
            }, 35);
        });

        targets.forEach(t => mo.observe(t, { childList: true, subtree: true }));
    }

    /* ======================================================================
       5. INTERCEPTOR SUAVE DE CIERRE DE SESIÓN Y BOOTSTRAP
       ====================================================================== */
    function bindLogoutHandoff() {
        document.addEventListener('click', (e) => {
            const logoutEl = e.target?.closest?.('#btn-logout, .btn-logout, a[href*="login.html"]');
            if (!logoutEl) return;
            if (logoutEl.closest('.auth-page')) return;

            const isLogoutAction = logoutEl.id === 'btn-logout' || logoutEl.classList.contains('btn-logout');
            if (!isLogoutAction) return;

            try {
                sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
                    rol: 'AUTH',
                    name: '',
                    ts: Date.now()
                }));
            } catch {
                // Ignorar
            }
        }, true);
    }

    function boot() {
        const hadHandoff = consumePortalHandoff();
        initGlobalMicroInteractions();
        initScrollReveals();
        bindLogoutHandoff();

        const isAuth = Boolean(document.querySelector('.auth-page'));
        if (!isAuth && !document.getElementById('app-content')) {
            const scope = document.querySelector('.content-area, .page-content, main') || document.body;
            animateViewEnter(scope, { baseDelay: hadHandoff ? 90 : 0 });
            watchPortalHydration();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.ShidellMotion = {
        isReducedMotion,
        animateViewEnter,
        animateViewExit,
        animateCounters,
        playPortalHandoff,
        consumePortalHandoff,
        syncTabGlider,
        getPortalMeta
    };
})();
