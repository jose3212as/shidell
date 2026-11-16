/* ============================================================================
   SHIDELL THEME SYSTEM — Unified Light / Dark Controller (All Platforms)
   Pre-paint FOUC prevention + Topbar toggle + Settings sync + View Transitions
   ============================================================================ */
(function (window, document) {
    'use strict';

    const THEME_KEY = 'shidell_theme';
    const DOCENTE_KEY = 'shidell_docente_theme';
    const BRANDING_KEY = 'shidell_branding';
    const BRANDING_TS_KEY = 'shidell_branding_ts';
    const BRANDING_TTL_MS = 30000;
    const DEFAULT_TAB_TITLE = 'Shidell';
    const DARK_CSS_ID = 'shidell-dark-themes-css';
    const DARK_CSS_HREF = '/vendor/shidell-dark-themes.css?v=20261115b';

    /* ------------------------------------------------------------------------
       SYSTEM-WIDE BRANDING (Browser Tab Title & Favicon)
       ------------------------------------------------------------------------ */
    let rawBaseTitle = '';
    let isApplyingTitle = false;
    let titleObserver = null;
    let brandingChannel = null;
    try {
        if (typeof BroadcastChannel === 'function') {
            brandingChannel = new BroadcastChannel('shidell_branding');
        }
    } catch (_) {}

    const DEFAULT_GRADE_SCALE = 'NUMERICO';

    function normalizeGradeScale(rawScale) {
        return String(rawScale || '').trim().toUpperCase() === 'LITERAL' ? 'LITERAL' : DEFAULT_GRADE_SCALE;
    }

    function normalizeBranding(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const title = typeof src.tabTitle === 'string' && src.tabTitle.trim()
            ? src.tabTitle.trim()
            : (typeof src.nombreInstitucion === 'string' && src.nombreInstitucion.trim()
                ? src.nombreInstitucion.trim()
                : DEFAULT_TAB_TITLE);
        const iconUrl = typeof src.iconUrl === 'string' && src.iconUrl.trim() ? src.iconUrl.trim() : null;
        const stamp = src.updatedAt ? String(src.updatedAt) : '';
        const effectiveIconUrl = iconUrl || (stamp ? ('/favicon.ico?v=' + encodeURIComponent(stamp)) : '/favicon.ico');
        const gradeScale = normalizeGradeScale(src.gradeScale);
        return {
            tabTitle: title,
            iconUrl: iconUrl,
            effectiveIconUrl: effectiveIconUrl,
            gradeScale: gradeScale,
            updatedAt: stamp
        };
    }

    function readCachedBranding() {
        try {
            const raw = localStorage.getItem(BRANDING_KEY);
            if (raw) return normalizeBranding(JSON.parse(raw));
        } catch (_) {}
        return normalizeBranding(null);
    }

    function writeCachedBranding(cfg) {
        try {
            localStorage.setItem(BRANDING_KEY, JSON.stringify(cfg));
        } catch (_) {}
    }

    function formatSystemTitle(baseTitle, customTabTitle) {
        const base = typeof baseTitle === 'string' && baseTitle.trim() ? baseTitle.trim() : DEFAULT_TAB_TITLE;
        const target = typeof customTabTitle === 'string' && customTabTitle.trim() ? customTabTitle.trim() : DEFAULT_TAB_TITLE;
        if (target === DEFAULT_TAB_TITLE) return base;
        if (/\bshidell\b/i.test(base)) {
            return base.replace(/\bshidell\b/gi, target);
        }
        return base.includes(target) ? base : (base + ' — ' + target);
    }

    function inferIconMimeType(url) {
        const clean = String(url || '').split('?')[0].toLowerCase();
        if (clean.endsWith('.svg')) return 'image/svg+xml';
        if (clean.endsWith('.png')) return 'image/png';
        if (clean.endsWith('.webp')) return 'image/webp';
        if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
        if (clean.endsWith('.gif')) return 'image/gif';
        if (clean.endsWith('.ico')) return 'image/x-icon';
        return '';
    }

    function upsertFaviconLinks(href) {
        if (!document.head || !href) return;
        const type = inferIconMimeType(href);
        const defs = [
            { id: 'shidell-favicon', rel: 'icon' },
            { id: 'shidell-shortcut-icon', rel: 'shortcut icon' },
            { id: 'shidell-apple-icon', rel: 'apple-touch-icon' }
        ];
        // Limpiar iconos estáticos previos sin ID gestionado para evitar conflictos en pestaña
        document.head.querySelectorAll('link[rel*="icon"]').forEach(function (el) {
            if (el.id !== 'shidell-favicon' && el.id !== 'shidell-shortcut-icon' && el.id !== 'shidell-apple-icon') {
                el.parentNode && el.parentNode.removeChild(el);
            }
        });
        defs.forEach(function (d) {
            let link = document.getElementById(d.id);
            if (!link) {
                link = document.createElement('link');
                link.id = d.id;
                link.rel = d.rel;
                document.head.appendChild(link);
            }
            if (type) link.type = type;
            else link.removeAttribute('type');
            if (link.getAttribute('href') !== href) {
                link.setAttribute('href', href);
            }
        });
    }

    function applyBranding(rawCfg) {
        const cfg = rawCfg ? normalizeBranding(rawCfg) : readCachedBranding();
        upsertFaviconLinks(cfg.effectiveIconUrl);

        if (document.title && !rawBaseTitle) {
            rawBaseTitle = document.title;
        }
        const sourceTitle = rawBaseTitle || document.title;
        if (sourceTitle) {
            const formatted = formatSystemTitle(sourceTitle, cfg.tabTitle);
            if (document.title !== formatted) {
                isApplyingTitle = true;
                try {
                    document.title = formatted;
                } finally {
                    isApplyingTitle = false;
                }
            }
        }
        window.dispatchEvent(new CustomEvent('shidell:branding-changed', { detail: cfg }));
        return cfg;
    }

    function observeTitleElement() {
        const titleEl = document.head && document.head.querySelector('title');
        if (!titleEl || typeof MutationObserver !== 'function' || titleObserver) return;
        if (!rawBaseTitle) rawBaseTitle = document.title || DEFAULT_TAB_TITLE;
        titleObserver = new MutationObserver(function () {
            if (isApplyingTitle) return;
            rawBaseTitle = document.title || rawBaseTitle || DEFAULT_TAB_TITLE;
            applyBranding();
        });
        titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    async function refreshBrandingFromServer(force = false) {
        try {
            if (!force) {
                const lastTs = Number(localStorage.getItem(BRANDING_TS_KEY) || '0');
                if (lastTs && (Date.now() - lastTs) < BRANDING_TTL_MS && localStorage.getItem(BRANDING_KEY)) {
                    return readCachedBranding();
                }
            }
            const res = await fetch('/api/config');
            if (!res.ok) return readCachedBranding();
            const data = await res.json();
            const normalized = normalizeBranding(data);
            const prevRaw = localStorage.getItem(BRANDING_KEY);
            const nextRaw = JSON.stringify(normalized);
            if (prevRaw !== nextRaw) {
                writeCachedBranding(normalized);
            }
            try { localStorage.setItem(BRANDING_TS_KEY, String(Date.now())); } catch (_) {}
            applyBranding(normalized);
            return normalized;
        } catch (_) {
            return readCachedBranding();
        }
    }

    function broadcastBranding(rawCfg) {
        const normalized = normalizeBranding(rawCfg);
        writeCachedBranding(normalized);
        try { localStorage.setItem(BRANDING_TS_KEY, String(Date.now())); } catch (_) {}
        applyBranding(normalized);
        try {
            if (brandingChannel) brandingChannel.postMessage(normalized);
        } catch (_) {}
        return normalized;
    }

    // Ejecución inmediata en <head>: aplica favicon en caché y sincroniza título al terminar DOM
    applyBranding();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            rawBaseTitle = document.title || DEFAULT_TAB_TITLE;
            observeTitleElement();
            applyBranding();
            refreshBrandingFromServer();
        });
    } else {
        rawBaseTitle = document.title || DEFAULT_TAB_TITLE;
        observeTitleElement();
        applyBranding();
        refreshBrandingFromServer();
    }

    const GRADE_BANDS = [
        { letter: 'AD', min: 18, numericValue: 19,   label: 'Logro destacado', tone: 'excelente',    parentClass: 'a', rango: '18 – 20' },
        { letter: 'A',  min: 14, numericValue: 16,   label: 'Logro esperado',  tone: 'muy-bueno',    parentClass: 'b', rango: '14 – 17.9' },
        { letter: 'B',  min: 11, numericValue: 12.5, label: 'En proceso',      tone: 'bueno',        parentClass: 'c', rango: '11 – 13.9' },
        { letter: 'C',  min: 0,  numericValue: 9,    label: 'En inicio',       tone: 'insuficiente', parentClass: 'd', rango: '0 – 10.9' }
    ];
    const LITERAL_MAP = { AD: 19, A: 16, B: 12.5, C: 9 };

    let lastKnownGradeScale = readCachedBranding().gradeScale || DEFAULT_GRADE_SCALE;
    function notifyGradeScaleIfChanged(cfg) {
        const nextScale = normalizeGradeScale(cfg && cfg.gradeScale);
        if (lastKnownGradeScale !== nextScale) {
            lastKnownGradeScale = nextScale;
            try {
                window.dispatchEvent(new CustomEvent('shidell:grade-scale-changed', {
                    detail: { gradeScale: nextScale }
                }));
            } catch (_) {}
        }
        return nextScale;
    }

    function toLiteralGrade(nota20) {
        if (nota20 === null || nota20 === undefined || nota20 === '') return '—';
        const n = Number(nota20);
        if (!Number.isFinite(n)) return '—';
        if (n >= 18) return 'AD';
        if (n >= 14) return 'A';
        if (n >= 11) return 'B';
        return 'C';
    }

    function literalToNumber(raw) {
        if (raw === null || raw === undefined) return null;
        const s = String(raw).trim().toUpperCase();
        if (!s) return null;
        if (Object.prototype.hasOwnProperty.call(LITERAL_MAP, s)) return LITERAL_MAP[s];
        const parsed = Number(s.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
    }

    function bandForGrade(nota20) {
        const n = Number(nota20);
        if (!Number.isFinite(n)) return GRADE_BANDS[3];
        return GRADE_BANDS.find(b => n >= b.min) || GRADE_BANDS[3];
    }

    function optionValueForLiteral(nota20) {
        if (nota20 === null || nota20 === undefined || nota20 === '') return '';
        const n = Number(nota20);
        if (!Number.isFinite(n)) return '';
        return String(bandForGrade(n).numericValue);
    }

    function formatGradeValue(nota20, options) {
        const opts = options || {};
        const fallback = opts.fallback !== undefined ? opts.fallback : '—';
        if (nota20 === null || nota20 === undefined || nota20 === '') return fallback;
        const n = Number(nota20);
        if (!Number.isFinite(n)) return fallback;
        if (opts.emptyWhenZero && n === 0) return fallback;
        const literal = opts.scaleOverride
            ? normalizeGradeScale(opts.scaleOverride) === 'LITERAL'
            : normalizeGradeScale(readCachedBranding().gradeScale) === 'LITERAL';
        if (literal) {
            return toLiteralGrade(n);
        }
        const decimals = opts.decimals !== undefined ? opts.decimals : 1;
        const text = n.toFixed(decimals);
        return opts.withDenominator ? (text + ' / 20') : text;
    }

    function formatGradePair(nota, notaMaxima, options) {
        const opts = options || {};
        const fallback = opts.fallback !== undefined ? opts.fallback : '—';
        if (nota === null || nota === undefined || nota === '') return fallback;
        const n = Number(nota);
        if (!Number.isFinite(n)) return fallback;
        const max = Number(notaMaxima) > 0 ? Number(notaMaxima) : 20;
        const n20 = (n / max) * 20;
        if (normalizeGradeScale(readCachedBranding().gradeScale) === 'LITERAL') {
            return toLiteralGrade(n20);
        }
        const decimals = opts.decimals !== undefined ? opts.decimals : 1;
        if (opts.withDenominator) {
            return n.toFixed(decimals) + ' / ' + max.toFixed(0);
        }
        return n.toFixed(decimals);
    }

    function parseGradeInput(raw, max) {
        const limit = Number(max) > 0 ? Number(max) : 20;
        const s = raw === null || raw === undefined ? '' : String(raw).trim();
        if (!s) return { valid: true, numeric: null, literal: '—' };
        const upper = s.toUpperCase();
        if (Object.prototype.hasOwnProperty.call(LITERAL_MAP, upper)) {
            const val20 = LITERAL_MAP[upper];
            const scaled = Math.round(((val20 / 20) * limit) * 100) / 100;
            return { valid: true, numeric: scaled, literal: upper };
        }
        const parsed = Number(s.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > limit) {
            return { valid: false, message: 'Cada nota debe estar entre 0 y ' + limit + '.' };
        }
        return { valid: true, numeric: parsed, literal: toLiteralGrade((parsed / limit) * 20) };
    }

    window.ShidellGrades = {
        SCALES: { NUMERICO: 'NUMERICO', LITERAL: 'LITERAL' },
        BANDS: GRADE_BANDS,
        getScale: function () {
            return normalizeGradeScale(readCachedBranding().gradeScale);
        },
        isLiteral: function () {
            return this.getScale() === 'LITERAL';
        },
        toLiteral: toLiteralGrade,
        literalToNumber: literalToNumber,
        optionValueFor: optionValueForLiteral,
        bandFor: bandForGrade,
        format: formatGradeValue,
        formatWithMax: formatGradePair,
        parseInput: parseGradeInput,
        denominatorLabel: function () {
            return this.isLiteral() ? 'Escala AD–C' : 'Sobre 20';
        }
    };

    window.addEventListener('storage', function (ev) {
        if (ev.key === BRANDING_KEY && ev.newValue) {
            try {
                const parsed = JSON.parse(ev.newValue);
                applyBranding(parsed);
                notifyGradeScaleIfChanged(parsed);
            } catch (_) {}
        }
    });
    if (brandingChannel) {
        brandingChannel.onmessage = function (ev) {
            if (ev && ev.data) {
                const normalized = normalizeBranding(ev.data);
                writeCachedBranding(normalized);
                applyBranding(normalized);
                notifyGradeScaleIfChanged(normalized);
            }
        };
    }

    try {
        Promise.resolve(refreshBrandingFromServer(false)).then(function () {
            notifyGradeScaleIfChanged(readCachedBranding());
        });
    } catch (_) {}

    window.ShidellBranding = {
        DEFAULT_TAB_TITLE: DEFAULT_TAB_TITLE,
        get: readCachedBranding,
        formatTitle: formatSystemTitle,
        apply: applyBranding,
        refresh: function (force) {
            return Promise.resolve(refreshBrandingFromServer(force)).then(function (res) {
                notifyGradeScaleIfChanged(res || readCachedBranding());
                return res;
            });
        },
        broadcast: function (rawCfg) {
            broadcastBranding(rawCfg);
            notifyGradeScaleIfChanged(rawCfg);
        }
    };

    const PORTAL_DARK_META = {
        DOCENTE: '#0B0D11',
        ESTUDIANTE: '#0B111E',
        PADRE: '#0B1215',
        ADMIN: '#0B0E17',
        AUTH: '#0B111E',
        LANDING: '#0B101B'
    };

    function detectPortal() {
        const path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
        if (path.includes('plataformadocente')) return 'DOCENTE';
        if (path.includes('plataformaestudiante')) return 'ESTUDIANTE';
        if (path.includes('plataformapadres')) return 'PADRE';
        if (path.includes('plataformaadmin')) return 'ADMIN';
        if (path.includes('/auth/') || /\/(login|register)\.html$/.test(path)) return 'AUTH';
        return 'LANDING';
    }

    const portal = detectPortal();

    function getSavedTheme() {
        try {
            const unified = localStorage.getItem(THEME_KEY);
            const docente = localStorage.getItem(DOCENTE_KEY);
            if (portal === 'DOCENTE') {
                if (docente === 'light' || docente === 'dark') return docente;
                if (unified === 'light' || unified === 'dark') return unified;
                return 'dark';
            }
            if (unified === 'light' || unified === 'dark') return unified;
        } catch (_) {}
        try {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
        } catch (_) {}
        return 'light';
    }

    function ensureDarkStylesheet() {
        if (portal === 'DOCENTE' || !document.head) return;
        if (document.getElementById(DARK_CSS_ID)) return;
        const link = document.createElement('link');
        link.id = DARK_CSS_ID;
        link.rel = 'stylesheet';
        link.href = DARK_CSS_HREF;
        document.head.appendChild(link);
    }

    function applyThemeDom(theme) {
        const normalized = theme === 'dark' ? 'dark' : 'light';
        const root = document.documentElement;
        root.dataset.theme = normalized;
        root.dataset.portal = portal;
        root.style.colorScheme = normalized;

        let metaTheme = document.getElementById('meta-theme-color') || document.querySelector('meta[name="theme-color"]');
        if (!metaTheme && document.head) {
            metaTheme = document.createElement('meta');
            metaTheme.id = 'meta-theme-color';
            metaTheme.name = 'theme-color';
            document.head.appendChild(metaTheme);
        }
        if (metaTheme) {
            metaTheme.content = normalized === 'dark'
                ? (PORTAL_DARK_META[portal] || '#0B111E')
                : '#FFFFFF';
        }
        return normalized;
    }

    // Immediate pre-paint execution inside <head> to eliminate any FOUC white flash
    const initialTheme = applyThemeDom(getSavedTheme());
    ensureDarkStylesheet(false);

    if (portal === 'DOCENTE') {
        // Sync explicit Docente theme changes back to unified shidell_theme key
        window.addEventListener('shidell:theme-changed', function (ev) {
            const t = ev && ev.detail && ev.detail.theme;
            if (t === 'dark' || t === 'light') {
                try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
            }
        });
        window.ShidellTheme = {
            getPortal: function () { return portal; },
            getTheme: function () { return document.documentElement.dataset.theme || initialTheme; },
            setTheme: function (theme) {
                const norm = theme === 'dark' ? 'dark' : 'light';
                try {
                    localStorage.setItem(DOCENTE_KEY, norm);
                    localStorage.setItem(THEME_KEY, norm);
                } catch (_) {}
                document.documentElement.dataset.theme = norm;
                document.documentElement.style.colorScheme = norm;
                window.dispatchEvent(new CustomEvent('shidell:theme-changed', { detail: { theme: norm } }));
            },
            toggleTheme: function () {
                const btn = document.getElementById('btn-theme-toggle');
                if (btn) btn.click();
                else this.setTheme(this.getTheme() === 'dark' ? 'light' : 'dark');
            },
            syncUI: function () {}
        };
        return;
    }

    function createToggleButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-theme-toggle';
        btn.className = 'shidell-theme-btn';
        if (portal === 'AUTH') btn.classList.add('auth-theme-toggle');
        if (portal === 'LANDING') btn.classList.add('landing-theme-toggle');
        if (portal === 'ADMIN') btn.classList.add('admin-theme-toggle');
        btn.innerHTML =
            '<span class="shidell-theme-icon-wrap" aria-hidden="true">' +
            '<svg class="st-svg st-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' +
            '</svg>' +
            '<svg class="st-svg st-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="4"/>' +
            '<path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/>' +
            '</svg>' +
            '</span>' +
            '<span class="shidell-theme-label" id="theme-toggle-label">Modo oscuro</span>';
        btn.addEventListener('click', function () {
            toggleTheme(btn);
        });
        return btn;
    }

    function syncUI(theme) {
        const t = theme || document.documentElement.dataset.theme || 'light';
        const isDark = t === 'dark';

        const btn = document.getElementById('btn-theme-toggle');
        if (btn) {
            const label = btn.querySelector('.shidell-theme-label');
            const nextAction = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
            if (label) label.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
            btn.setAttribute('aria-label', nextAction);
            btn.setAttribute('title', nextAction);
            btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        }

        // Sync Configuración theme choice buttons/toggles across any portal
        document.querySelectorAll('[data-theme-choice]').forEach(function (el) {
            const active = el.getAttribute('data-theme-choice') === t;
            el.classList.toggle('active', active);
            el.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        document.querySelectorAll('#shidell-theme-switch').forEach(function (chk) {
            if (chk.type === 'checkbox') chk.checked = isDark;
        });
        const adminToggle = document.getElementById('toggle-dark-mode');
        if (adminToggle) {
            adminToggle.classList.toggle('on', isDark);
            adminToggle.setAttribute('aria-checked', isDark ? 'true' : 'false');
        }
    }

    function mountToggleButton() {
        if (!document.body) return;

        // Avoid duplicate mount if already inside expected container
        let btn = document.getElementById('btn-theme-toggle');

        if (portal === 'AUTH') {
            if (!btn) {
                btn = createToggleButton();
                document.body.appendChild(btn);
            }
            syncUI();
            return;
        }

        if (portal === 'LANDING') {
            const ctaGroup = document.querySelector('.site-header .header-cta-group');
            if (ctaGroup) {
                if (!btn) btn = createToggleButton();
                if (!ctaGroup.contains(btn)) {
                    ctaGroup.insertBefore(btn, ctaGroup.firstElementChild);
                }
            }
            syncUI();
            return;
        }

        if (portal === 'ADMIN') {
            const right = document.querySelector('.topbar .topbar-right');
            if (right) {
                if (!btn) btn = createToggleButton();
                if (!right.contains(btn)) {
                    const notifBtn = right.querySelector('#notif-btn');
                    right.insertBefore(btn, notifBtn || right.firstElementChild);
                }
            }
            syncUI();
            return;
        }

        // ESTUDIANTE & PADRE
        const actions = document.querySelector('.topbar .topbar-actions');
        if (actions) {
            if (!btn) btn = createToggleButton();
            if (!actions.contains(btn)) {
                const notifBtn = actions.querySelector('.notification-btn');
                actions.insertBefore(btn, notifBtn || actions.firstElementChild);
            }
        }
        syncUI();
    }

    function bindSettingsControls() {
        document.querySelectorAll('[data-theme-choice]').forEach(function (el) {
            if (el.dataset.themeBound === '1') return;
            el.dataset.themeBound = '1';
            el.addEventListener('click', function () {
                const targetTheme = el.getAttribute('data-theme-choice');
                if (targetTheme) setTheme(targetTheme, el);
            });
        });

        const chk = document.getElementById('shidell-theme-switch');
        if (chk && chk.dataset.themeBound !== '1') {
            chk.dataset.themeBound = '1';
            chk.addEventListener('change', function () {
                setTheme(chk.checked ? 'dark' : 'light', chk);
            });
        }

        const adminToggle = document.getElementById('toggle-dark-mode');
        if (adminToggle && adminToggle.dataset.themeBound !== '1') {
            adminToggle.dataset.themeBound = '1';
            adminToggle.addEventListener('click', function () {
                const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                setTheme(next, adminToggle);
            });
        }
    }

    function setTheme(nextTheme, triggerEl) {
        const normalized = nextTheme === 'dark' ? 'dark' : 'light';
        const prev = document.documentElement.dataset.theme || 'light';

        const commit = function () {
            try {
                localStorage.setItem(THEME_KEY, normalized);
                localStorage.setItem(DOCENTE_KEY, normalized);
            } catch (_) {}
            applyThemeDom(normalized);
            ensureDarkStylesheet(true);
            syncUI(normalized);
            window.dispatchEvent(new CustomEvent('shidell:theme-changed', { detail: { theme: normalized, portal: portal } }));
        };

        if (prev === normalized) {
            commit();
            return;
        }

        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!document.startViewTransition || reducedMotion) {
            commit();
            return;
        }

        const anchor = triggerEl || document.getElementById('btn-theme-toggle');
        if (anchor && anchor.getBoundingClientRect) {
            const rect = anchor.getBoundingClientRect();
            const x = Math.round(rect.left + rect.width / 2);
            const y = Math.round(rect.top + rect.height / 2);
            document.documentElement.style.setProperty('--vt-x', x + 'px');
            document.documentElement.style.setProperty('--vt-y', y + 'px');
        }

        document.documentElement.classList.add('shidell-theme-transition');
        try {
            const vt = document.startViewTransition(commit);
            vt.finished.finally(function () {
                document.documentElement.classList.remove('shidell-theme-transition');
            });
        } catch (_) {
            document.documentElement.classList.remove('shidell-theme-transition');
            commit();
        }
    }

    function toggleTheme(triggerEl) {
        const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        setTheme(current === 'dark' ? 'light' : 'dark', triggerEl);
    }

    function boot() {
        ensureDarkStylesheet(true);
        mountToggleButton();
        bindSettingsControls();
        syncUI();

        // Watch dynamic DOM builds (Admin topbar, Estudiante/Padres dynamic sections)
        if (window.MutationObserver && document.body) {
            let rafId = 0;
            const obs = new MutationObserver(function () {
                if (rafId) return;
                rafId = window.requestAnimationFrame(function () {
                    rafId = 0;
                    const needsMount = !document.getElementById('btn-theme-toggle') ||
                        (portal === 'ADMIN' && document.querySelector('.topbar .topbar-right') && !document.querySelector('.topbar .topbar-right #btn-theme-toggle')) ||
                        ((portal === 'ESTUDIANTE' || portal === 'PADRE') && document.querySelector('.topbar .topbar-actions') && !document.querySelector('.topbar .topbar-actions #btn-theme-toggle'));
                    if (needsMount) mountToggleButton();
                    bindSettingsControls();
                });
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('load', function () {
        ensureDarkStylesheet(true);
        mountToggleButton();
        bindSettingsControls();
        syncUI();
    });

    // Cross-tab synchronization
    window.addEventListener('storage', function (ev) {
        if ((ev.key === THEME_KEY || ev.key === DOCENTE_KEY) && (ev.newValue === 'dark' || ev.newValue === 'light')) {
            applyThemeDom(ev.newValue);
            syncUI(ev.newValue);
            window.dispatchEvent(new CustomEvent('shidell:theme-changed', { detail: { theme: ev.newValue, portal: portal } }));
        }
    });

    window.ShidellTheme = {
        getPortal: function () { return portal; },
        getTheme: function () { return document.documentElement.dataset.theme || 'light'; },
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        syncUI: syncUI
    };
})(window, document);
