import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { Router } from '../../core/router.js';

export const DashboardView = {
    async render() {
        return `
            <section class="docente-welcome">
                <div>
                    <span>Resumen de trabajo</span>
                    <h2>Hola, Prof. <strong id="dash-saludo">Docente</strong></h2>
                    <p>Revisa tus clases, toma asistencia, publica tareas y registra notas sin perderte entre pantallas.</p>
                </div>
                <div class="docente-main-actions">
                    <a href="#/mis-clases" class="btn-primary"><i class="ph ph-presentation-chart"></i> Mis clases</a>
                    <a href="#/tareas" class="btn-secondary"><i class="ph ph-plus-circle"></i> Nueva tarea</a>
                </div>
            </section>

            <section class="docente-metrics">
                <article><i class="ph ph-books"></i><div><strong id="metric-cursos">0</strong><span>Cursos</span></div></article>
                <article><i class="ph ph-users-three"></i><div><strong id="metric-estudiantes">0</strong><span>Estudiantes</span></div></article>
                <article><i class="ph ph-calendar-check"></i><div><strong id="metric-clases">0</strong><span>Clases hoy</span></div></article>
                <article><i class="ph ph-clipboard-text"></i><div><strong id="metric-tareas">0</strong><span>Tareas</span></div></article>
            </section>

            <section class="docente-grid">
                <div class="main-panel">
                    <div class="panel-header">
                        <h3 class="panel-title"><i class="ph ph-book-open"></i> Tus cursos</h3>
                        <a class="link-action" href="#/mis-clases">Administrar</a>
                    </div>
                    <div class="docente-cursos" id="dash-cursos">
                        <div class="teacher-empty compact"><p>Cargando cursos...</p></div>
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

            <section class="docente-grid bottom">
                <div class="main-panel">
                    <div class="panel-header">
                        <h3 class="panel-title"><i class="ph ph-clock"></i> Horario de hoy</h3>
                        <a class="link-action" href="#/calendario">Ver calendario</a>
                    </div>
                    <div class="schedule-list" id="dash-horario">
                        <div class="teacher-empty compact"><p>Cargando horario...</p></div>
                    </div>
                </div>
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
            </section>
        `;
    },

    async afterRender() {
        const user = Auth.getUser();
        document.getElementById('dash-saludo').textContent = (user.nombres || 'Docente').split(' ')[0];

        try {
            const dashboard = await CursoService.getDashboard(user.email);
            
            // Metrics
            const metrics = dashboard.metricas || {};
            document.getElementById('metric-cursos').textContent = metrics.cursos || 0;
            document.getElementById('metric-estudiantes').textContent = metrics.estudiantes || 0;
            document.getElementById('metric-clases').textContent = metrics.clasesHoy || 0;
            document.getElementById('metric-tareas').textContent = metrics.tareas || 0;

            // Render Cursos Cards
            const cursosContainer = document.getElementById('dash-cursos');
            const tablaCursos = document.getElementById('dash-tabla-cursos');
            
            if (!dashboard.cursos || dashboard.cursos.length === 0) {
                cursosContainer.innerHTML = '<div class="teacher-empty compact"><p>No tienes cursos asignados.</p></div>';
                tablaCursos.innerHTML = '<tr><td colspan="4" style="text-align:center;">No tienes cursos.</td></tr>';
            } else {
                cursosContainer.innerHTML = dashboard.cursos.map(item => this.renderCursoCard(item)).join('');
                tablaCursos.innerHTML = dashboard.cursos.map(item => this.renderCursoRow(item)).join('');
            }

            // Render Horario
            const horarioContainer = document.getElementById('dash-horario');
            if (!dashboard.horarioHoy || dashboard.horarioHoy.length === 0) {
                horarioContainer.innerHTML = '<div class="teacher-empty compact"><p>No tienes clases programadas para hoy.</p></div>';
            } else {
                horarioContainer.innerHTML = dashboard.horarioHoy.map(curso => this.renderHorarioItem(curso)).join('');
            }

        } catch (error) {
            console.error(error);
            document.getElementById('dash-cursos').innerHTML = '<div class="teacher-empty compact"><p>Error al cargar cursos.</p></div>';
            document.getElementById('dash-horario').innerHTML = '<div class="teacher-empty compact"><p>Error al cargar horario.</p></div>';
        }
    },

    renderCursoCard(item) {
        const c = item.curso;
        return `
            <article class="docente-curso-card ${c.color || 'blue'}">
                <div class="docente-curso-icon"><i class="ph-fill ${c.icono || 'ph-books'}"></i></div>
                <div class="docente-curso-info">
                    <h4>${c.nombre}</h4>
                    <p>${c.nivel} - ${c.grado} ${c.seccion}</p>
                    <div class="docente-curso-stats">
                        <span><i class="ph ph-users"></i> ${item.alumnos}</span>
                        <span><i class="ph ph-clipboard-text"></i> ${item.tareas}</span>
                    </div>
                </div>
                <div class="docente-card-actions">
                    <a href="#/mis-clases?curso=${c.id}" class="mini-action">Clase</a>
                    <a href="#/mis-clases?curso=${c.id}&asistencia=1" class="mini-action">Asis.</a>
                </div>
            </article>
        `;
    },

    renderCursoRow(item) {
        const c = item.curso;
        return `
            <tr>
                <td><strong>${c.nombre}</strong></td>
                <td>${c.grado} ${c.seccion}</td>
                <td>${item.alumnos}</td>
                <td><a href="#/mis-clases?curso=${c.id}" class="btn-secondary" style="padding:4px 8px; font-size:12px;">Ver</a></td>
            </tr>
        `;
    },

    renderHorarioItem(curso) {
        return `
            <div class="schedule-item">
                <div class="time">
                    <strong>${curso.horaInicio}</strong>
                    <span>${curso.horaFin}</span>
                </div>
                <div class="details">
                    <h4>${curso.nombre}</h4>
                    <p>${curso.grado} ${curso.seccion} - ${curso.nivel}</p>
                </div>
                <span class="status-pill success">Hoy</span>
            </div>
        `;
    }
};
