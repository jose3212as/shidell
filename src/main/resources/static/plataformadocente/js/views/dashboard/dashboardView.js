import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';

export const DashboardView = {
    async render() {
        return `
            <section class="docente-metrics">
                <article><i class="ph ph-books"></i><div><strong id="metric-cursos">0</strong><span>Cursos</span></div></article>
                <article><i class="ph ph-users-three"></i><div><strong id="metric-estudiantes">0</strong><span>Estudiantes</span></div></article>
                <article><i class="ph ph-calendar-check"></i><div><strong id="metric-clases">0</strong><span>Clases hoy</span></div></article>
                <article><i class="ph ph-clipboard-text"></i><div><strong id="metric-tareas">0</strong><span>Tareas</span></div></article>
            </section>

            <section class="docente-grid">
                <div class="main-panel">
                    <div class="panel-header">
                        <h3 class="panel-title"><i class="ph ph-list-checks"></i> Cursos activos</h3>
                        <a class="link-action" href="#/estudiantes">Ver alumnos</a>
                    </div>
                    <div class="table-scroll">
                        <table class="data-table">
                            <thead><tr><th>Curso</th><th>Sección</th><th>Alumnos</th><th>Acción</th></tr></thead>
                            <tbody id="dash-tabla-cursos">
                                <tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside class="main-panel">
                    <div class="panel-header"><h3 class="panel-title"><i class="ph ph-lightning"></i> Accesos</h3></div>
                    <div class="docente-accesos">
                        <a href="#/calendario"><i class="ph ph-calendar-plus"></i><span>Programar clase</span></a>
                        <a href="#/estudiantes"><i class="ph ph-users"></i><span>Ver estudiantes</span></a>
                        <a href="#/calificaciones"><i class="ph ph-check-square"></i><span>Registrar notas</span></a>
                        <a href="#/mensajes"><i class="ph ph-chat-circle-text"></i><span>Mensajes</span></a>
                    </div>
                </aside>
            </section>
        `;
    },

    async afterRender() {
        const user = Auth.getUser();

        try {
            const dashboard = await CursoService.getDashboard(user.email);
            
            // Metrics
            const metrics = dashboard.metricas || {};
            document.getElementById('metric-cursos').textContent = metrics.cursos || 0;
            document.getElementById('metric-estudiantes').textContent = metrics.estudiantes || 0;
            document.getElementById('metric-clases').textContent = metrics.clasesHoy || 0;
            document.getElementById('metric-tareas').textContent = metrics.tareas || 0;

            // Render tabla de cursos activos
            const tablaCursos = document.getElementById('dash-tabla-cursos');
            if (!dashboard.cursos || dashboard.cursos.length === 0) {
                tablaCursos.innerHTML = '<tr><td colspan="4" style="text-align:center;">No tienes cursos.</td></tr>';
            } else {
                tablaCursos.innerHTML = dashboard.cursos.map(item => this.renderCursoRow(item)).join('');
            }
        } catch (error) {
            console.error(error);
            const tablaCursos = document.getElementById('dash-tabla-cursos');
            if (tablaCursos) {
                tablaCursos.innerHTML = '<tr><td colspan="4" style="text-align:center;">Error al cargar cursos.</td></tr>';
            }
        }
    },

    renderCursoRow(item) {
        const c = item.curso || {};
        const esc = v => String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const gradoText = c.grado ? `${esc(c.grado)}° ` : '';
        return `
            <tr>
                <td><strong>${esc(c.nombre)}</strong></td>
                <td>${gradoText}${esc(c.seccion)}</td>
                <td>${esc(item.alumnos)}</td>
                <td>
                    <a href="#/mis-clases?curso=${encodeURIComponent(c.id)}" class="dash-course-btn">
                        <span>Ver curso</span>
                        <i class="ph ph-arrow-up-right" aria-hidden="true"></i>
                    </a>
                </td>
            </tr>
        `;
    }
};
