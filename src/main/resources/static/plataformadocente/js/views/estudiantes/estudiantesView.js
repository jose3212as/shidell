import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

export const EstudiantesView = {
    async render() {
        return `
            <div class="content-header">
                <div>
                    <h2>Directorio de Estudiantes</h2>
                    <p>Encuentra y gestiona a todos tus estudiantes inscritos.</p>
                </div>
            </div>

            <!-- Panel de Filtros -->
            <div class="filters-panel">
                <div class="filters-search-box">
                    <i class="ph ph-magnifying-glass filters-search-icon"></i>
                    <input type="text" id="search-students" class="filters-search-input" placeholder="Buscar por nombre o apellido...">
                </div>
                
                <div class="filter-group">
                    <label class="filter-label"><i class="ph ph-funnel"></i> Filtrar curso:</label>
                    <select id="filter-course" class="filter-select">
                        <option value="ALL">Todos los cursos</option>
                    </select>
                </div>
            </div>

            <!-- Grilla de Estudiantes -->
            <div class="items-grid" id="students-grid">
                <div class="loading-container">
                    <i class="ph ph-spinner ph-spin loading-spinner"></i>
                    <p>Cargando directorio de estudiantes...</p>
                </div>
            </div>
        `;
    },

    async afterRender() {
        const user = Auth.getUser();
        this.allStudents = []; 
        this.uniqueCourses = [];

        try {
            // 1. Obtener cursos
            this.uniqueCourses = await CursoService.getCursosUnicos(user.email);
            
            // Llenar el select de filtro
            const selectFilter = document.getElementById('filter-course');
            this.uniqueCourses.forEach(curso => {
                const option = document.createElement('option');
                option.value = curso.id;
                option.textContent = `${curso.nombre} (${curso.grado} ${curso.seccion} - ${curso.nivel})`;
                selectFilter.appendChild(option);
            });

            // 2. Obtener estudiantes
            const promesas = this.uniqueCourses.map(async (curso) => {
                const estudiantes = await API.fetch(`/api/docente/curso/${curso.id}/estudiantes`);
                return estudiantes.map(est => ({
                    ...est,
                    cursoId: curso.id,
                    cursoInfo: `${curso.grado} ${curso.seccion} - ${curso.nivel}`,
                    cursoNombre: curso.nombre,
                    color: curso.color || 'blue'
                }));
            });

            const resultados = await Promise.all(promesas);
            
            // 3. Aplanar y agrupar (un estudiante puede estar en varios cursos)
            const mapEstudiantes = new Map();
            resultados.flat().forEach(est => {
                if (!mapEstudiantes.has(est.id)) {
                    mapEstudiantes.set(est.id, {
                        id: est.id,
                        nombres: est.nombres,
                        apellidos: est.apellidos,
                        email: est.email,
                        cursos: []
                    });
                }
                // Añadir curso al estudiante
                mapEstudiantes.get(est.id).cursos.push({
                    id: est.cursoId,
                    nombre: est.cursoNombre,
                    info: est.cursoInfo,
                    color: est.color
                });
            });

            this.allStudents = Array.from(mapEstudiantes.values()).sort((a,b) => a.apellidos.localeCompare(b.apellidos));
            this.renderStudentsGrid(this.allStudents);

            // Escuchar eventos
            document.getElementById('search-students').addEventListener('input', () => this.applyFilters());
            document.getElementById('filter-course').addEventListener('change', () => this.applyFilters());

        } catch (error) {
            console.error(error);
            document.getElementById('students-grid').innerHTML = '<div class="loading-container" style="color:red;">Error al cargar estudiantes.</div>';
        }
    },

    applyFilters() {
        const searchTerm = document.getElementById('search-students').value.toLowerCase();
        const courseFilterId = document.getElementById('filter-course').value;

        const filtrados = this.allStudents.filter(est => {
            // Filtro por texto
            const matchesText = est.nombres.toLowerCase().includes(searchTerm) || 
                                est.apellidos.toLowerCase().includes(searchTerm) ||
                                est.email.toLowerCase().includes(searchTerm);
            
            // Filtro por curso
            let matchesCourse = true;
            if (courseFilterId !== 'ALL') {
                matchesCourse = est.cursos.some(c => String(c.id) === String(courseFilterId));
            }

            return matchesText && matchesCourse;
        });

        this.renderStudentsGrid(filtrados);
    },

    renderStudentsGrid(estudiantes) {
        const grid = document.getElementById('students-grid');
        
        if (estudiantes.length === 0) {
            grid.innerHTML = '<div class="empty-state-container"><i class="ph ph-users empty-state-icon"></i><p class="empty-state-text">No se encontraron estudiantes con esos filtros.</p></div>';
            return;
        }

        grid.innerHTML = estudiantes.map(est => `
            <article class="premium-card student-card">
                <div class="student-card-header">
                    <div class="student-card-avatar">
                        ${est.nombres.charAt(0)}${est.apellidos.charAt(0)}
                    </div>
                    <div>
                        <h3 class="student-card-title">${est.nombres} ${est.apellidos}</h3>
                        <p class="student-card-subtitle"><i class="ph ph-envelope-simple"></i> ${est.email}</p>
                    </div>
                </div>

                <div class="student-card-courses">
                    <p class="student-card-courses-label">Cursos inscritos contigo</p>
                    <div class="student-card-tags">
                        ${est.cursos.map(c => `
                            <span class="premium-tag" style="background:var(--${c.color}-light, #f0f4ff); color:var(--${c.color}, #3b82f6);">
                                ${c.nombre} (${c.info})
                            </span>
                        `).join('')}
                    </div>
                </div>

                <div class="student-card-actions">
                    <button class="btn-secondary" style="flex:1; justify-content:center; padding:8px; border-radius:10px; font-size:13px;" onclick="alert('Perfil detallado en construcción')">Ver Perfil</button>
                    <a href="#/mensajes" class="btn-primary" style="padding:8px 12px; border-radius:10px; display:flex; align-items:center; justify-content:center; text-decoration:none;"><i class="ph ph-chat-circle-dots"></i></a>
                </div>
            </article>
        `).join('');
    }
};
