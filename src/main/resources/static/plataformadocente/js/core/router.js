import { DashboardView } from '../views/dashboard/dashboardView.js?v=20261114w';
import { MisClasesView } from '../views/mis-clases/misClasesView.js?v=20261114l';
import { CalendarioView } from '../views/calendario/calendarioView.js?v=20261114o';
import { EstudiantesView } from '../views/estudiantes/estudiantesView.js?v=20261114b';
import { EstudiantePerfilView } from '../views/estudiantes/estudiantePerfilView.js?v=20261114o';
import { TareasView } from '../views/tareas/tareasView.js?v=20261114n';
import { CrearTareaView } from '../views/tareas/crearTareaView.js?v=20261114n';
import { ForosView } from '../views/foros/forosView.js?v=20261114q';
import { CalificacionesView } from '../views/calificaciones/calificacionesView.js?v=20261114y';
import { CrearEvaluacionView } from '../views/calificaciones/crearEvaluacionView.js?v=20261114z2';
import { MensajesView } from '../views/mensajes/mensajesView.js?v=20261115a';
import { ReportesView } from '../views/reportes/reportesView.js?v=20261114p';
import { ConfiguracionView } from '../views/configuracion/configuracionView.js?v=20261114v';
import { DocentePrefs } from '../services/docentePrefs.js?v=20261114u';

DocentePrefs.applyToDocument();

// Add dummy views for others to prevent 404
const DummyView = { render: (title) => `<div class="docente-welcome" style="margin-bottom:20px;"><h2>${title}</h2><p>Módulo en construcción (Próximamente SPA)</p></div>` };

const routes = {
    '/': DashboardView,
    '/dashboard': DashboardView,
    '/mis-clases': MisClasesView,
    '/calendario': CalendarioView,
    '/tareas': TareasView,
    '/crear-tarea': CrearTareaView,
    '/foros': ForosView,
    '/estudiantes': EstudiantesView,
    '/estudiante-perfil': EstudiantePerfilView,
    '/calificaciones': CalificacionesView,
    '/crear-evaluacion': CrearEvaluacionView,
    '/mensajes': MensajesView,
    '/reportes': ReportesView,
    '/configuracion': ConfiguracionView
};

export const Router = {
    async init() {
        // Handle nav clicks
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const route = e.currentTarget.getAttribute('data-route');
                this.navigate(route);
            });
        });

        // Handle browser back/forward
        window.addEventListener('hashchange', () => this.handleHash());
        
        // Initial route
        this.handleHash();
    },

    async navigate(path) {
        window.location.hash = path; // triggers hashchange
    },

    async handleHash() {
        const rawHash = window.location.hash.replace('#', '');
        const preferredStart = DocentePrefs.get().startRoute || '/dashboard';
        let hash = (!rawHash || rawHash === '/')
            ? (routes[preferredStart] ? preferredStart : '/dashboard')
            : rawHash;
        
        // Manejar query params simulados en el hash (ej. #/mis-clases?curso=123)
        let [path, queryString] = hash.split('?');
        
        if (!routes[path]) {
            path = '/dashboard';
            queryString = '';
        }

        const activeMenuRoute = path === '/estudiante-perfil'
            ? '/estudiantes'
            : (path === '/crear-tarea'
                ? '/tareas'
                : (path === '/crear-evaluacion' ? '/calificaciones' : path));

        // Update active class
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-route') === activeMenuRoute) {
                link.classList.add('active');
            }
        });

        // Render view con transición fluida y umbral de carga para evitar parpadeos
        const appContent = document.getElementById('app-content');
        if (!appContent) return;
        window.scrollTo(0, 0);
        appContent.scrollTop = 0;

        const navToken = (this._navToken = (this._navToken || 0) + 1);
        let loaderShown = false;
        const loaderTimer = setTimeout(() => {
            if (this._navToken === navToken && appContent) {
                loaderShown = true;
                appContent.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary);"><i class="ph ph-circle-notch ph-spin" style="font-size:28px;"></i></div>';
            }
        }, 160);

        try {
            const view = routes[path];
            const html = await view.render();
            clearTimeout(loaderTimer);
            if (this._navToken !== navToken) return;

            if (this._hasRendered && !loaderShown && window.ShidellMotion?.animateViewExit) {
                await window.ShidellMotion.animateViewExit(appContent);
                if (this._navToken !== navToken) return;
            }

            appContent.classList.remove('spa-view-entering');
            appContent.innerHTML = html;
            void appContent.offsetWidth;
            appContent.classList.add('spa-view-entering');
            this._hasRendered = true;

            window.ShidellMotion?.animateViewEnter(appContent, { force: true });

            const clearEnterClass = () => appContent.classList.remove('spa-view-entering');
            appContent.addEventListener('animationend', (ev) => {
                if (ev.target === appContent) clearEnterClass();
            }, { once: true });
            setTimeout(clearEnterClass, 450);

            window.scrollTo(0, 0);

            // Execute view logic after DOM update
            if (typeof view.afterRender === 'function') {
                await view.afterRender(queryString);
                if (this._navToken === navToken) {
                    window.ShidellMotion?.animateViewEnter(appContent);
                }
            }
        } catch (error) {
            clearTimeout(loaderTimer);
            console.error(error);
            if (this._navToken === navToken) {
                appContent.innerHTML = `<div style="padding:40px;text-align:center;color:var(--red, #ef4444);">Error al cargar la vista.</div>`;
            }
        }
    }
};
