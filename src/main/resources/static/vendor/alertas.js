/**
 * alertas.js
 * Utilitario global para mostrar mensajes de error y éxito utilizando SweetAlert2.
 * Asegúrate de importar SweetAlert2 antes de este script.
 */

function _humanizeFallback(raw, fallback) {
    if (window.ShidellErrors && typeof window.ShidellErrors.humanizar === 'function') {
        return window.ShidellErrors.humanizar(raw, fallback);
    }
    const str = typeof raw === 'string' ? raw.trim() : String(raw?.message || raw?.error || '').trim();
    if (!str) return fallback || 'Algo salió diferente de lo esperado. Intenta otra vez en unos segundos.';
    const lower = str.toLowerCase();
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('conectar con el servidor') || lower.includes('conexión con el servidor') || lower.includes('backend')) {
        return 'No pudimos conectarnos en este momento. Revisa tu conexión a internet e intenta otra vez.';
    }
    if (lower.includes('http error') || /^error(\s+http)?\s*:?\s*\d{3}/i.test(str) || lower.includes('exception') || lower.includes('sql') || lower === 'error' || lower === 'error.') {
        return fallback || 'No pudimos completar esta acción ahora. Intenta de nuevo en unos segundos.';
    }
    return str;
}

window.AppAlerts = {
    /**
     * Muestra una ventana modal amigable adaptada al diseño e ilustración de cada plataforma
     * @param {string} mensaje Texto principal en lenguaje cotidiano
     * @param {any} detalles Mensaje opcional secundario ya amigable (nunca expone códigos técnicos)
     */
    mostrarError: function(mensaje, detalles = '') {
        if (detalles) console.warn("AppAlert aviso:", mensaje, detalles);

        const safeMain = _humanizeFallback(mensaje, 'No pudimos completar esto en este momento. Intenta de nuevo.');
        let rawDetail = '';
        if (detalles) {
            if (typeof detalles === 'string') rawDetail = detalles;
            else if (detalles.error || detalles.message) rawDetail = detalles.error || detalles.message;
        }
        const safeDetail = rawDetail ? _humanizeFallback(rawDetail, '') : '';
        const textToShow = (safeDetail && safeDetail !== safeMain && safeMain.length < 48)
            ? `${safeMain} ${safeDetail}`
            : (safeMain || safeDetail);

        const meta = window.ShidellErrors?.detectPortal ? window.ShidellErrors.detectPortal() : null;
        const dark = meta && window.ShidellErrors?.isDarkActive ? window.ShidellErrors.isDarkActive(meta) : false;
        const accent = meta ? (dark ? meta.accentDark : meta.accent) : '#144272';
        const imgUrl = meta?.img || '/assets/errors/error-estudiante.jpg';
        const confirmTextColor = meta?.id === 'DOCENTE' ? '#0B0D11' : '#ffffff';

        if (typeof Swal === 'undefined') {
            alert(textToShow);
            return;
        }

        Swal.fire({
            title: '¡Ups! Pequeño contratiempo',
            html: `
                <div class="shidell-swal-art" style="width:118px;height:118px;margin:4px auto 14px;border-radius:22px;overflow:hidden;border:1px solid rgba(148,163,184,0.28);background:${meta?.imgBg || '#ffffff'};box-shadow:0 10px 24px rgba(15,23,42,0.12);">
                    <img src="${imgUrl}" alt="Ilustración amigable" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'">
                </div>
                <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:${dark ? '#e2e8f0' : '#334155'};">${textToShow.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            `,
            background: dark ? meta.surfaceDark : '#ffffff',
            color: dark ? meta.inkDark : '#14171a',
            confirmButtonColor: accent,
            confirmButtonText: `<span style="color:${confirmTextColor};font-weight:700;">Entendido</span>`,
            customClass: {
                popup: 'premium-modal-popup',
                title: 'premium-modal-title',
                content: 'premium-modal-content'
            },
            showClass: {
                popup: 'animate__animated animate__fadeInDown'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutUp'
            }
        });
    },

    /**
     * Muestra una notificación Toast (arriba a la derecha)
     * Útil para acciones exitosas o avisos breves sin bloquear la pantalla
     */
    mostrarToast: function(mensaje, tipo = 'success') {
        const cleanMsg = tipo === 'error'
            ? _humanizeFallback(mensaje, 'No pudimos completar esta acción.')
            : String(mensaje || '');

        if (tipo === 'success' && window.ShidellFun && /(entregad|calificad|completad|guardad|clonad)/i.test(cleanMsg)) {
            try { window.ShidellFun.celebrar(); } catch (_) {}
        }

        if (typeof Swal === 'undefined') return;
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3200,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });

        Toast.fire({
            icon: tipo,
            title: cleanMsg
        });
    }
};

// Cargar automáticamente el Shell Adaptable Android + PC y el Panel Analítico API de Estudiante
(function () {
    // Limpiar cualquier elemento residual de versiones anteriores en caché
    const purgeLegacyStudyHub = () => {
        document.getElementById('open-study-hub-btn')?.remove();
        document.getElementById('student-theme-toggle')?.remove();
        document.getElementById('study-hub-overlay')?.remove();
        document.getElementById('student-gamification-bar')?.remove();
        document.querySelector('.student-QuickTools')?.remove();
        document.body?.classList.remove('shidell-dark');
    };
    purgeLegacyStudyHub();
    document.addEventListener('DOMContentLoaded', purgeLegacyStudyHub);

    if (!window.ShidellErrors && !document.querySelector('script[src*="shidell-ux.js"]')) {
        const ux = document.createElement('script');
        ux.src = '/vendor/shidell-ux.js?v=20261116a';
        document.head.appendChild(ux);
    }
    if (!window.ShidellTheme && !document.querySelector('script[src*="shidell-theme.js"]')) {
        const th = document.createElement('script');
        th.src = '/vendor/shidell-theme.js?v=20261114d';
        document.head.appendChild(th);
    }
    if (!window.__shidellMobileShellLoaded && !document.querySelector('script[src*="mobile-shell.js"]')) {
        const s = document.createElement('script');
        s.src = '/vendor/mobile-shell.js?v=20261114m2';
        document.head.appendChild(s);
    }
    if (!window.ShidellMotion && !document.querySelector('script[src*="shidell-motion.js"]')) {
        const m = document.createElement('script');
        m.src = '/vendor/shidell-motion.js?v=20261114m3';
        document.head.appendChild(m);
    }
    if (window.location.pathname.toLowerCase().includes('plataformaestudiante') &&
        !window.__shidellStudentSuiteLoaded &&
        !document.querySelector('script[src*="student-suite.js"]')) {
        const st = document.createElement('script');
        st.src = '/plataformaestudiante/js/student-suite.js?v=20261019d';
        document.head.appendChild(st);
    }
})();



