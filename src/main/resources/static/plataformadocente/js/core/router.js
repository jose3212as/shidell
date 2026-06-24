import { DashboardView } from '../views/dashboard/dashboardView.js';
import { MisClasesView } from '../views/mis-clases/misClasesView.js';
import { CalendarioView } from '../views/calendario/calendarioView.js';
import { EstudiantesView } from '../views/estudiantes/estudiantesView.js';
import { TareasView } from '../views/tareas/tareasView.js';
import { CalificacionesView } from '../views/calificaciones/calificacionesView.js';
import { MensajesView } from '../views/mensajes/mensajesView.js';
import { ReportesView } from '../views/reportes/reportesView.js';
import { ConfiguracionView } from '../views/configuracion/configuracionView.js';

// Add dummy views for others to prevent 404
const DummyView = { render: (title) => `<div class="docente-welcome" style="margin-bottom:20px;"><h2>${title}</h2><p>Módulo en construcción (Próximamente SPA)</p></div>` };

const routes = {
    '/': DashboardView,
    '/dashboard': DashboardView,
    '/mis-clases': MisClasesView,
    '/calendario': CalendarioView,
    '/tareas': TareasView,
    '/estudiantes': EstudiantesView,
    '/calificaciones': CalificacionesView,
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
        let hash = window.location.hash.replace('#', '') || '/dashboard';
        
        // Manejar query params simulados en el hash (ej. #/mis-clases?curso=123)
        const [path, queryString] = hash.split('?');
        
        if (!routes[path]) {
            hash = '/dashboard';
        }

        // Update active class
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-route') === path) {
                link.classList.add('active');
            }
        });

        // Render view
        const appContent = document.getElementById('app-content');
        appContent.innerHTML = '<div style="padding:40px;text-align:center;"><i class="ph ph-circle-notch ph-spin" style="font-size:32px;"></i><p>Cargando...</p></div>';
        
        try {
            const view = routes[path];
            const html = await view.render();
            appContent.innerHTML = html;
            
            // Execute view logic after DOM update
            if (typeof view.afterRender === 'function') {
                await view.afterRender(queryString);
            }
        } catch (error) {
            console.error(error);
            appContent.innerHTML = `<div style="padding:40px;text-align:center;color:red;">Error al cargar la vista.</div>`;
        }
    }
};
