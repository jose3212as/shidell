/**
 * SHIDELL UX ENGINE (shidell-ux.js)
 * - Traductor de errores técnicos a lenguaje humano claro para estudiantes, docentes y padres
 * - Tarjetas y modales ilustrados por plataforma usando arte propio (/assets/errors/*)
 * - Micro-interacciones recreativas (datos curiosos educativos + micro-celebración en Canvas)
 * - Optimización de navegación (prefetch pasivo al pasar el cursor + deduplicación SWR + Ctrl+K)
 */
(function (window, document) {
    'use strict';

    if (window.ShidellErrors && window.ShidellSpeed && window.ShidellFun) return;

    const PORTALS = {
        ESTUDIANTE: {
            id: 'ESTUDIANTE',
            badge: 'Portal Estudiante',
            accent: '#144272',
            accentSoft: '#eaf1f8',
            accentDark: '#60a5fa',
            surface: '#ffffff',
            surfaceDark: '#111a2b',
            ink: '#14171a',
            inkDark: '#eef2ff',
            muted: '#5a6573',
            mutedDark: '#94a3b8',
            border: '#dbe4ee',
            borderDark: 'rgba(148, 163, 184, 0.22)',
            img: '/assets/errors/error-estudiante.jpg',
            imgBg: '#ffffff',
            home: '/plataformaestudiante/html/portalestudiante.html',
            links: [
                { label: 'Mi Inicio', href: '/plataformaestudiante/html/portalestudiante.html' },
                { label: 'Mis Cursos', href: '/plataformaestudiante/html/miscursos.html' },
                { label: 'Mis Tareas', href: '/plataformaestudiante/html/tareas.html' },
                { label: 'Calificaciones', href: '/plataformaestudiante/html/calificaciones.html' },
                { label: 'Calendario', href: '/plataformaestudiante/html/calendario.html' },
                { label: 'Mensajes', href: '/plataformaestudiante/html/mensajes.html' }
            ]
        },
        DOCENTE: {
            id: 'DOCENTE',
            badge: 'Portal Docente',
            accent: '#D8A24A',
            accentSoft: 'rgba(216, 162, 74, 0.14)',
            accentDark: '#E6B562',
            surface: '#ffffff',
            surfaceDark: '#13171D',
            ink: '#111318',
            inkDark: '#EDF1F7',
            muted: '#525b68',
            mutedDark: '#9aa4b2',
            border: '#e5e7eb',
            borderDark: 'rgba(216, 162, 74, 0.24)',
            img: '/assets/errors/error-docente.jpg',
            imgBg: '#13171D',
            home: '/plataformadocente/index.html',
            links: [
                { label: 'Inicio Docente', href: '/plataformadocente/index.html' }
            ]
        },
        PADRE: {
            id: 'PADRE',
            badge: 'Portal Familias',
            accent: '#0d9488',
            accentSoft: '#f0fdfa',
            accentDark: '#2dd4bf',
            surface: '#ffffff',
            surfaceDark: '#0f1f24',
            ink: '#1e293b',
            inkDark: '#ecfeff',
            muted: '#64748b',
            mutedDark: '#99f6e4',
            border: '#ccfbf1',
            borderDark: 'rgba(45, 212, 191, 0.22)',
            img: '/assets/errors/error-padres.jpg',
            imgBg: '#ffffff',
            home: '/plataformapadres/html/portalpadres.html',
            links: [
                { label: 'Inicio Familias', href: '/plataformapadres/html/portalpadres.html' },
                { label: 'Calificaciones', href: '/plataformapadres/html/calificaciones.html' },
                { label: 'Asistencia', href: '/plataformapadres/html/asistencia.html' },
                { label: 'Tareas', href: '/plataformapadres/html/tareas.html' },
                { label: 'Mensajes', href: '/plataformapadres/html/mensajes.html' },
                { label: 'Mi Perfil', href: '/plataformapadres/html/configuracion.html' }
            ]
        },
        ADMIN: {
            id: 'ADMIN',
            badge: 'Administración Central',
            accent: '#4f46e5',
            accentSoft: '#eef2ff',
            accentDark: '#818cf8',
            surface: '#ffffff',
            surfaceDark: '#111528',
            ink: '#1e293b',
            inkDark: '#f1f5f9',
            muted: '#64748b',
            mutedDark: '#94a3b8',
            border: '#e2e8f0',
            borderDark: 'rgba(129, 140, 248, 0.24)',
            img: '/assets/errors/error-admin.jpg',
            imgBg: '#ffffff',
            home: '/plataformaadmin/html/dashboard.html',
            links: [
                { label: 'Resumen General', href: '/plataformaadmin/html/dashboard.html' },
                { label: 'Asistencia', href: '/plataformaadmin/html/asistencia.html' },
                { label: 'Usuarios', href: '/plataformaadmin/html/usuarios.html' },
                { label: 'Cursos', href: '/plataformaadmin/html/cursos.html' },
                { label: 'Calificaciones', href: '/plataformaadmin/html/calificaciones.html' },
                { label: 'Configuración', href: '/plataformaadmin/html/configuracion.html' }
            ]
        }
    };

    const CURIOSIDADES = [
        { tag: 'Ciencia', text: 'El colibrí es la única ave capaz de volar hacia atrás y sus alas baten hasta 80 veces por segundo.' },
        { tag: 'Perú', text: 'Caral, en Lima, tiene más de 5000 años de antigüedad y es considerada la civilización más antigua de América.' },
        { tag: 'Matemática', text: 'Si multiplicas 111,111,111 × 111,111,111 obtienes exactamente 12,345,678,987,654,321.' },
        { tag: 'Espacio', text: 'Un día en Venus dura más que su propio año: tarda 243 días terrestres en girar y 225 en rodear al Sol.' },
        { tag: 'Naturaleza', text: 'Las abejas se comunican mediante una "danza en ocho" para indicar distancia y dirección hacia las flores.' },
        { tag: 'Cultura', text: 'En los Andes peruanos existen más de 3000 variedades nativas de papa adaptadas a diferentes alturas.' },
        { tag: 'Lectura', text: 'Leer solo 15 minutos al día suma más de un millón de palabras nuevas vistas a lo largo de un año escolar.' },
        { tag: 'Mente', text: 'Hacer pausas cortas de 5 minutos cada 25 de estudio ayuda al cerebro a fijar mejor lo aprendido.' }
    ];

    let curiosidadIndex = Math.floor(Math.random() * CURIOSIDADES.length);

    function detectPortal(explicit) {
        if (explicit) {
            const k = String(explicit).toUpperCase();
            if (PORTALS[k]) return PORTALS[k];
            if (k.includes('ADMIN')) return PORTALS.ADMIN;
            if (k.includes('DOC')) return PORTALS.DOCENTE;
            if (k.includes('PADR')) return PORTALS.PADRE;
        }
        const path = (window.location.pathname || '').toLowerCase();
        if (path.includes('plataformaadmin')) return PORTALS.ADMIN;
        if (path.includes('plataformadocente')) return PORTALS.DOCENTE;
        if (path.includes('plataformapadres')) return PORTALS.PADRE;
        if (path.includes('plataformaestudiante')) return PORTALS.ESTUDIANTE;

        try {
            const stored = JSON.parse(localStorage.getItem('shidell_user') || 'null');
            const rol = String(stored?.rol || '').toUpperCase();
            if (rol.includes('ADMIN')) return PORTALS.ADMIN;
            if (rol.includes('DOC')) return PORTALS.DOCENTE;
            if (rol.includes('PADR')) return PORTALS.PADRE;
        } catch (_) {}
        return PORTALS.ESTUDIANTE;
    }

    function isDarkActive(portalMeta) {
        const attr = document.documentElement.getAttribute('data-theme');
        if (attr === 'dark') return true;
        if (attr === 'light') return false;
        if (portalMeta && portalMeta.id === 'DOCENTE') {
            try {
                return localStorage.getItem('shidell_docente_theme') !== 'light';
            } catch (_) {
                return true;
            }
        }
        try {
            return localStorage.getItem('shidell_theme') === 'dark';
        } catch (_) {
            return false;
        }
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function humanizeMessage(raw, fallback) {
        const def = fallback || 'Algo salió diferente de lo esperado. Intenta nuevamente en unos segundos.';
        let text = '';
        if (typeof raw === 'string') text = raw;
        else if (raw && typeof raw === 'object') text = raw.error || raw.message || '';
        text = String(text || '').trim();
        if (!text) return def;

        const lower = text.toLowerCase();
        if (lower.includes('failed to fetch')
                || lower.includes('networkerror')
                || lower.includes('load failed')
                || lower.includes('network request failed')
                || lower.includes('conexión con el servidor')
                || lower.includes('conectar con el servidor')
                || lower.includes('encendido el backend')) {
            return 'No pudimos conectarnos en este momento. Revisa tu conexión a internet e intenta otra vez.';
        }
        if (lower.includes('sesión inválida') || lower.includes('sesión expir') || lower.includes('401') || lower.includes('unauthorized')) {
            return 'Tu sesión se cerró por seguridad. Inicia sesión nuevamente para continuar.';
        }
        if (lower.includes('403') || lower.includes('forbidden')) {
            return 'No cuentas con permiso para entrar o realizar esta acción.';
        }
        if (lower.includes('413') || lower.includes('payload too large') || lower.includes('maximum upload size')) {
            return 'El archivo es muy pesado. Elige uno más liviano (hasta 10 MB).';
        }
        if (lower.includes('http error')
                || /^error(\s+http)?\s*:?\s*\d{3}/i.test(text)
                || lower.includes('internal server error')
                || lower.includes('bad gateway')
                || lower.includes('service unavailable')
                || lower.includes('gateway timeout')
                || lower.includes('unexpected token')
                || lower.includes('is not valid json')
                || lower.includes('cannot read propert')
                || lower.includes('undefined')
                || lower === 'null'
                || lower === 'error'
                || lower === 'error.'
                || lower.includes('exception')
                || lower.includes('sql')
                || lower.includes('jdbc')
                || lower.includes('hibernate')
                || lower.includes('stacktrace')
                || lower.includes('endpoint')
                || lower.includes('backend')) {
            return def;
        }
        if (/\b(?:status|código|http)\s*:?\s*\d{3}\b/i.test(text)) {
            const cleaned = text.replace(/\(?\b(?:status|código|http|error)\s*:?\s*\d{3}\)?/gi, '').trim();
            return cleaned || def;
        }
        return text;
    }

    function ensureStyles() {
        if (document.getElementById('shidell-ux-styles')) return;
        const style = document.createElement('style');
        style.id = 'shidell-ux-styles';
        style.textContent = `
            .shidell-err-card {
                --ux-accent: #144272;
                --ux-accent-soft: #eaf1f8;
                --ux-surface: #ffffff;
                --ux-ink: #14171a;
                --ux-muted: #5a6573;
                --ux-border: #dbe4ee;
                --ux-img-bg: #ffffff;
                background: var(--ux-surface);
                color: var(--ux-ink);
                border: 1px solid var(--ux-border);
                border-radius: 22px;
                padding: 28px 24px;
                margin: 16px auto;
                max-width: 620px;
                text-align: center;
                box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
                font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            }
            .shidell-err-card.compact {
                padding: 20px 18px;
                max-width: 500px;
                border-radius: 18px;
            }
            .shidell-err-illustration {
                width: 158px;
                height: 158px;
                margin: 0 auto 14px;
                border-radius: 26px;
                background: var(--ux-img-bg);
                border: 1px solid var(--ux-border);
                padding: 6px;
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: shidellFloatSlow 4.2s ease-in-out infinite;
            }
            .shidell-err-card.compact .shidell-err-illustration {
                width: 112px;
                height: 112px;
                border-radius: 20px;
            }
            .shidell-err-illustration img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 20px;
                display: block;
            }
            .shidell-err-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 12px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.02em;
                background: var(--ux-accent-soft);
                color: var(--ux-accent);
                margin-bottom: 10px;
            }
            .shidell-err-title {
                margin: 0 0 8px;
                font-family: 'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif;
                font-size: 21px;
                font-weight: 700;
                line-height: 1.25;
                color: var(--ux-ink);
            }
            .shidell-err-card.compact .shidell-err-title {
                font-size: 18px;
            }
            .shidell-err-msg {
                margin: 0 auto 18px;
                max-width: 44ch;
                font-size: 14.5px;
                line-height: 1.55;
                color: var(--ux-muted);
            }
            .shidell-err-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: center;
                margin-bottom: 16px;
            }
            .shidell-err-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                padding: 10px 18px;
                border-radius: 12px;
                font-size: 13.5px;
                font-weight: 700;
                border: 1px solid transparent;
                cursor: pointer;
                text-decoration: none;
                transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
                font-family: inherit;
            }
            .shidell-err-btn:hover { transform: translateY(-1px); }
            .shidell-err-btn-primary {
                background: var(--ux-accent);
                color: #ffffff;
                box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
            }
            .shidell-err-card[data-portal="DOCENTE"] .shidell-err-btn-primary {
                color: #0B0D11;
            }
            .shidell-err-btn-ghost {
                background: transparent;
                border-color: var(--ux-border);
                color: var(--ux-ink);
            }
            .shidell-fun-box {
                background: var(--ux-accent-soft);
                border: 1px dashed var(--ux-border);
                border-radius: 14px;
                padding: 12px 14px;
                text-align: left;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .shidell-fun-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                font-size: 11.5px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: var(--ux-accent);
            }
            .shidell-fun-next {
                border: none;
                background: var(--ux-surface);
                color: var(--ux-accent);
                border-radius: 999px;
                padding: 4px 10px;
                font-size: 11.5px;
                font-weight: 700;
                cursor: pointer;
                font-family: inherit;
            }
            .shidell-fun-text {
                margin: 0;
                font-size: 13px;
                line-height: 1.45;
                color: var(--ux-ink);
            }
            .shidell-swal-art {
                width: 120px;
                height: 120px;
                margin: 4px auto 12px;
                border-radius: 22px;
                overflow: hidden;
                border: 1px solid rgba(148, 163, 184, 0.28);
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
                background: #ffffff;
            }
            .shidell-swal-art img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .shidell-quicknav-backdrop {
                position: fixed;
                inset: 0;
                z-index: 99999;
                background: rgba(15, 23, 42, 0.56);
                backdrop-filter: blur(5px);
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding: 84px 16px 24px;
            }
            .shidell-quicknav-modal {
                width: 100%;
                max-width: 440px;
                background: var(--ux-surface, #ffffff);
                color: var(--ux-ink, #14171a);
                border-radius: 18px;
                border: 1px solid rgba(148, 163, 184, 0.25);
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
                overflow: hidden;
                font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            }
            .shidell-quicknav-head {
                padding: 14px 16px;
                border-bottom: 1px solid rgba(148, 163, 184, 0.2);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .shidell-quicknav-input {
                width: 100%;
                border: none;
                outline: none;
                background: transparent;
                color: inherit;
                font-size: 15px;
                font-family: inherit;
            }
            .shidell-quicknav-list {
                padding: 8px;
                max-height: 300px;
                overflow-y: auto;
                display: grid;
                gap: 4px;
            }
            .shidell-quicknav-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                border-radius: 10px;
                text-decoration: none;
                color: inherit;
                font-size: 14px;
                font-weight: 600;
            }
            .shidell-quicknav-item:hover, .shidell-quicknav-item:focus {
                background: rgba(99, 102, 241, 0.12);
                outline: none;
            }
            @keyframes shidellFloatSlow {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-5px); }
            }
            @media (prefers-reduced-motion: reduce) {
                .shidell-err-illustration { animation: none !important; }
                .shidell-err-btn:hover { transform: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function nextCuriosidad() {
        curiosityAdvance();
        return CURIOSIDADES[curiosidadIndex];
    }

    function curiosityAdvance() {
        curiosidadIndex = (curiosidadIndex + 1) % CURIOSIDADES.length;
    }

    function renderCard(target, opts = {}) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return null;

        ensureStyles();
        const meta = detectPortal(opts.portal);
        const dark = isDarkActive(meta);

        const accent = dark ? meta.accentDark : meta.accent;
        const surface = dark ? meta.surfaceDark : meta.surface;
        const ink = dark ? meta.inkDark : meta.ink;
        const muted = dark ? meta.mutedDark : meta.muted;
        const border = dark ? meta.borderDark : meta.border;
        const accentSoft = dark ? 'rgba(255, 255, 255, 0.06)' : meta.accentSoft;

        const title = opts.title || '¡Ups! Tuvimos un pequeño tropiezo';
        const message = humanizeMessage(opts.message, 'No pudimos cargar esta parte ahora. Puedes volver a intentarlo con un clic.');
        const homeHref = opts.homeHref || meta.home;
        const homeLabel = opts.homeLabel || 'Ir a mi inicio';
        const retryLabel = opts.retryLabel || 'Intentar de nuevo';
        const fun = CURIOSIDADES[curiosidadIndex];

        el.innerHTML = `
            <div class="shidell-err-card ${opts.compact ? 'compact' : ''}" data-portal="${meta.id}"
                 style="--ux-accent:${accent};--ux-accent-soft:${accentSoft};--ux-surface:${surface};--ux-ink:${ink};--ux-muted:${muted};--ux-border:${border};--ux-img-bg:${meta.imgBg};">
                <div class="shidell-err-illustration">
                    <img src="${meta.img}" alt="Ilustración de ${escapeHtml(meta.badge)}">
                </div>
                <div class="shidell-err-badge">${escapeHtml(opts.badge || meta.badge)}</div>
                <h3 class="shidell-err-title">${escapeHtml(title)}</h3>
                <p class="shidell-err-msg">${escapeHtml(message)}</p>
                <div class="shidell-err-actions">
                    ${opts.onRetry ? `<button type="button" class="shidell-err-btn shidell-err-btn-primary" data-shidell-retry>${escapeHtml(retryLabel)}</button>` : ''}
                    ${opts.hideHome ? '' : `<a href="${escapeHtml(homeHref)}" class="shidell-err-btn ${opts.onRetry ? 'shidell-err-btn-ghost' : 'shidell-err-btn-primary'}">${escapeHtml(homeLabel)}</a>`}
                </div>
                ${opts.hideFun ? '' : `
                <div class="shidell-fun-box">
                    <div class="shidell-fun-head">
                        <span>Dato curioso · <span data-fun-tag>${escapeHtml(fun.tag)}</span></span>
                        <button type="button" class="shidell-fun-next" data-fun-next>Otro dato</button>
                    </div>
                    <p class="shidell-fun-text" data-fun-text>${escapeHtml(fun.text)}</p>
                </div>`}
            </div>
        `;

        const retryBtn = el.querySelector('[data-shidell-retry]');
        if (retryBtn && typeof opts.onRetry === 'function') {
            retryBtn.addEventListener('click', () => opts.onRetry());
        }
        const funBtn = el.querySelector('[data-fun-next]');
        if (funBtn) {
            funBtn.addEventListener('click', () => {
                const next = nextCuriosidad();
                const tagEl = el.querySelector('[data-fun-tag]');
                const textEl = el.querySelector('[data-fun-text]');
                if (tagEl) tagEl.textContent = next.tag;
                if (textEl) textEl.textContent = next.text;
            });
        }
        return el.firstElementChild;
    }

    function prefersReducedMotion() {
        if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function celebrar(opts = {}) {
        if (prefersReducedMotion()) return;
        const meta = detectPortal(opts.portal);
        const palette = [meta.accent, '#f59e0b', '#10b981', '#38bdf8', '#a855f7'];
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99998;';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) { canvas.remove(); return; }

        const originX = opts.x ?? canvas.width * 0.5;
        const originY = opts.y ?? canvas.height * 0.25;
        const particles = Array.from({ length: 34 }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2.5 + Math.random() * 5.2;
            return {
                x: originX,
                y: originY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2.5,
                size: 4 + Math.random() * 4,
                color: palette[Math.floor(Math.random() * palette.length)],
                alpha: 1,
                rot: Math.random() * Math.PI,
                vrot: (Math.random() - 0.5) * 0.25
            };
        });

        let frame = 0;
        function tick() {
            frame++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;
            for (const p of particles) {
                p.vy += 0.16;
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vrot;
                p.alpha = Math.max(0, 1 - frame / 65);
                if (p.alpha > 0.02) alive = true;

                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
                ctx.restore();
            }
            if (alive && frame < 70) {
                requestAnimationFrame(tick);
            } else {
                canvas.remove();
            }
        }
        requestAnimationFrame(tick);
    }

    // ── Optimización: Speculative Prefetch + Deduplicación + SWR ───────────────
    const prefetched = new Set();
    const memoryCache = new Map();
    const inflight = new Map();

    function canPrefetch() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ''))) return false;
        return true;
    }

    function prefetchUrl(href) {
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || !canPrefetch() || !document.head) return;
        try {
            const url = new URL(href, window.location.href);
            if (url.origin !== window.location.origin) return;
            if (!url.pathname.endsWith('.html')) return;
            if (url.pathname === window.location.pathname) return;
            if (prefetched.has(url.href)) return;
            prefetched.add(url.href);
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'document';
            link.href = url.href;
            document.head.appendChild(link);
        } catch (_) {}
    }

    function initPrefetch() {
        const handle = (ev) => {
            const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
            if (a && !a.hasAttribute('download') && a.target !== '_blank') {
                prefetchUrl(a.getAttribute('href'));
            }
        };
        document.addEventListener('pointerover', handle, { passive: true });
        document.addEventListener('touchstart', handle, { passive: true });
    }

    async function cachedFetchJson(url, options = {}, ttlMs = 20000) {
        const method = String(options.method || 'GET').toUpperCase();
        if (method !== 'GET') {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(humanizeMessage(`HTTP ${res.status}`));
            return res.json();
        }
        const now = Date.now();
        const hit = memoryCache.get(url);
        if (hit && (now - hit.ts) < ttlMs) {
            return hit.data;
        }
        if (inflight.has(url)) {
            return inflight.get(url);
        }
        const reqPromise = (async () => {
            try {
                const res = await fetch(url, options);
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    throw new Error(humanizeMessage(body || `HTTP ${res.status}`));
                }
                const data = await res.json();
                memoryCache.set(url, { data, ts: Date.now() });
                return data;
            } finally {
                inflight.delete(url);
            }
        })();
        inflight.set(url, reqPromise);
        return reqPromise;
    }

    function invalidateCache(prefix) {
        if (!prefix) { memoryCache.clear(); return; }
        for (const key of memoryCache.keys()) {
            if (key.includes(prefix)) memoryCache.delete(key);
        }
    }

    // Atajo práctico Ctrl+K / Alt+K para saltar rápidamente entre módulos del portal
    function initQuickNav() {
        document.addEventListener('keydown', (ev) => {
            const isShortcut = (ev.ctrlKey || ev.metaKey || ev.altKey) && ev.key.toLowerCase() === 'k';
            if (!isShortcut) return;
            const meta = detectPortal();
            if (!meta.links || meta.links.length <= 1) return;
            ev.preventDefault();

            const existing = document.getElementById('shidell-quicknav');
            if (existing) { existing.remove(); return; }

            ensureStyles();
            const dark = isDarkActive(meta);
            const backdrop = document.createElement('div');
            backdrop.id = 'shidell-quicknav';
            backdrop.className = 'shidell-quicknav-backdrop';
            backdrop.innerHTML = `
                <div class="shidell-quicknav-modal" style="--ux-surface:${dark ? meta.surfaceDark : '#ffffff'};--ux-ink:${dark ? meta.inkDark : '#14171a'};">
                    <div class="shidell-quicknav-head">
                        <span style="font-size:12px;font-weight:800;color:${dark ? meta.accentDark : meta.accent};">${escapeHtml(meta.badge)}</span>
                        <input type="text" class="shidell-quicknav-input" placeholder="Ir rápido a una sección... (Esc para cerrar)" aria-label="Buscar sección">
                    </div>
                    <div class="shidell-quicknav-list">
                        ${meta.links.map(item => `<a class="shidell-quicknav-item" href="${escapeHtml(item.href)}"><span>${escapeHtml(item.label)}</span><span style="opacity:.5;font-size:12px;">Enter ↵</span></a>`).join('')}
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);

            const input = backdrop.querySelector('input');
            const items = Array.from(backdrop.querySelectorAll('.shidell-quicknav-item'));
            input?.focus();

            input?.addEventListener('input', () => {
                const q = input.value.trim().toLowerCase();
                items.forEach(a => {
                    a.style.display = a.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
                });
            });
            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const first = items.find(a => a.style.display !== 'none');
                    if (first) window.location.href = first.getAttribute('href');
                }
            });
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) backdrop.remove();
            });
            const closeEsc = (e) => {
                if (e.key === 'Escape') {
                    backdrop.remove();
                    document.removeEventListener('keydown', closeEsc);
                }
            };
            document.addEventListener('keydown', closeEsc);
        });
    }

    // Boot
    ensureStyles();
    initPrefetch();
    initQuickNav();

    window.ShidellErrors = {
        detectPortal,
        isDarkActive,
        humanizar: humanizeMessage,
        renderCard,
        getPortalMeta: (p) => detectPortal(p)
    };
    window.ShidellSpeed = {
        cachedFetchJson,
        invalidateCache,
        prefetchUrl
    };
    window.ShidellFun = {
        celebrar,
        nextCuriosidad
    };
})(window, document);
