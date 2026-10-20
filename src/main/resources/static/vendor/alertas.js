/**
 * alertas.js
 * Utilitario global para mostrar mensajes de error y éxito utilizando SweetAlert2.
 * Asegúrate de importar SweetAlert2 antes de este script.
 */

window.AppAlerts = {
    /**
     * Muestra una ventana modal de error (al centro)
     * @param {string} mensaje El texto principal del error
     * @param {any} detalles Detalles técnicos opcionales (ej. objeto Error)
     */
    mostrarError: function(mensaje, detalles = '') {
        console.error("AppAlert Error:", mensaje, detalles);
        
        let textoDetalle = '';
        if (detalles) {
            if (typeof detalles === 'string') {
                textoDetalle = detalles;
            } else if (detalles.message) {
                textoDetalle = detalles.message;
            }
        }

        Swal.fire({
            icon: 'error',
            title: '¡Ups! Ha ocurrido un error',
            text: mensaje,
            footer: textoDetalle ? `<span style="color: #888; font-size: 0.85em;">Detalle: ${textoDetalle}</span>` : '',
            confirmButtonColor: '#e3342f', // Rojo estándar de error
            confirmButtonText: 'Entendido',
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
     * Útil para acciones exitosas o errores menores que no deben bloquear la pantalla
     */
    mostrarToast: function(mensaje, tipo = 'success') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });

        Toast.fire({
            icon: tipo,
            title: mensaje
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

    if (!window.__shidellMobileShellLoaded && !document.querySelector('script[src*="mobile-shell.js"]')) {
        const s = document.createElement('script');
        s.src = '/vendor/mobile-shell.js?v=20261019d';
        document.head.appendChild(s);
    }
    if (window.location.pathname.toLowerCase().includes('plataformaestudiante') &&
        !window.__shidellStudentSuiteLoaded &&
        !document.querySelector('script[src*="student-suite.js"]')) {
        const st = document.createElement('script');
        st.src = '/plataformaestudiante/js/student-suite.js?v=20261019d';
        document.head.appendChild(st);
    }
})();



