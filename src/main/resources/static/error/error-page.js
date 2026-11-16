(function (window, document) {
    'use strict';

    const COPY_BY_CODE = {
        '403': {
            chip: 'Acceso reservado',
            title: 'Esta zona pertenece a otro perfil escolar',
            message: 'Tu cuenta actual no tiene acceso a esta sección, pero puedes regresar directamente a tu espacio principal.'
        },
        '404': {
            chip: 'Página extraviada',
            title: '¡Vaya! Este cuaderno no aparece por aquí',
            message: 'La dirección que abriste ya no existe o fue movida de carpeta. Te llevamos de vuelta sin perder tu avance.'
        },
        '500': {
            chip: 'Pausa breve',
            title: 'Estamos ordenando el salón por un instante',
            message: 'Tuvimos un tropiezo momentáneo al abrir esta página. Intenta recargar en unos segundos o vuelve al inicio.'
        },
        generic: {
            chip: 'Aviso amigable',
            title: 'No pudimos completar ese paso ahora',
            message: 'Algo salió diferente de lo esperado, pero todo sigue a salvo. Vuelve a intentarlo o regresa a tu inicio.'
        }
    };

    function render() {
        const root = document.getElementById('error-stage');
        if (!root || !window.ShidellErrors) return;

        const code = document.body.getAttribute('data-error-code') || 'generic';
        const copy = COPY_BY_CODE[code] || COPY_BY_CODE.generic;
        const meta = window.ShidellErrors.detectPortal();
        const dark = window.ShidellErrors.isDarkActive(meta);

        document.body.style.background = dark
            ? `radial-gradient(circle at top, rgba(255,255,255,0.04), ${meta.surfaceDark})`
            : `radial-gradient(circle at top, ${meta.accentSoft}, #f8fafc)`;
        document.body.style.color = dark ? meta.inkDark : meta.ink;

        window.ShidellErrors.renderCard(root, {
            badge: `${meta.badge} · ${copy.chip}`,
            title: copy.title,
            message: copy.message,
            homeHref: meta.home,
            homeLabel: 'Volver a mi portal',
            retryLabel: 'Intentar recargar',
            onRetry: () => window.location.reload()
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})(window, document);
