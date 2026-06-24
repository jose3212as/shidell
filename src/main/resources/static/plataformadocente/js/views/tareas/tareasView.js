import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

export const TareasView = {
    async render() {
        return `
            <div class="content-header">
                <div>
                    <h2>Gestión de Tareas</h2>
                    <p>Tablero Kanban interactivo para administrar las asignaciones de tus cursos.</p>
                </div>
            </div>

            <!-- Panel de Filtros -->
            <div class="filters-panel" style="padding: 15px 20px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; gap: 15px; flex: 1;">
                    <div class="filters-search-box" style="padding: 8px 15px; max-width: 400px; flex: 1;">
                        <i class="ph ph-magnifying-glass filters-search-icon"></i>
                        <input type="text" id="search-tareas" class="filters-search-input" placeholder="Buscar por título o descripción...">
                    </div>
                    
                    <div class="filter-group">
                        <label class="filter-label"><i class="ph ph-funnel"></i> Filtrar Curso:</label>
                        <select id="filter-curso-tarea" class="filter-select" style="padding: 8px 15px;">
                            <option value="ALL">Todos los cursos</option>
                        </select>
                    </div>
                </div>
                
                <button class="btn-primary" id="btn-nueva-tarea" style="padding:10px 20px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:6px;">
                    <i class="ph ph-plus-circle" style="font-size:18px;"></i> Nueva Tarea
                </button>
            </div>

            <!-- Tablero Kanban -->
            <div class="kanban-board" id="tareas-kanban">
                <div class="loading-container">
                    <i class="ph ph-spinner ph-spin loading-spinner"></i>
                    <p>Cargando tablero...</p>
                </div>
            </div>

            <!-- Modal Nueva Tarea (Premium Redesign) -->
            <div class="modal-overlay" id="modal-nueva-tarea">
                <div class="modal-content premium-modal">
                    <div class="modal-header">
                        <div class="modal-title-wrapper">
                            <div class="modal-icon-bg"><i class="ph-fill ph-notebook"></i></div>
                            <div>
                                <h3>Crear Nueva Tarea</h3>
                                <p>Configura y asigna una nueva actividad académica.</p>
                            </div>
                        </div>
                        <button class="modal-close" id="close-modal-tarea"><i class="ph ph-x"></i></button>
                    </div>
                    <form id="form-nueva-tarea" class="modal-body">
                        
                        <div class="form-group-premium">
                            <label>Título de la tarea <span class="required">*</span></label>
                            <div class="input-with-icon">
                                <i class="ph ph-text-t"></i>
                                <input type="text" id="nt-titulo" placeholder="Ej. Ensayo sobre la Revolución Francesa" required>
                            </div>
                        </div>
                        
                        <div class="form-row-2">
                            <div class="form-group-premium">
                                <label>Curso asignado <span class="required">*</span></label>
                                <div class="input-with-icon">
                                    <i class="ph ph-books"></i>
                                    <select id="nt-curso" required>
                                        <option value="" disabled selected>Selecciona un curso</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-group-premium">
                                <label>Fecha Límite <span class="required">*</span></label>
                                <div class="input-with-icon">
                                    <i class="ph ph-calendar-blank"></i>
                                    <input type="date" id="nt-fecha" required>
                                </div>
                            </div>
                        </div>

                        <div class="form-group-premium">
                            <label>Nivel de Prioridad</label>
                            <div class="priority-selector">
                                <label class="priority-radio green">
                                    <input type="radio" name="prioridad" value="Baja">
                                    <span>Baja</span>
                                </label>
                                <label class="priority-radio yellow">
                                    <input type="radio" name="prioridad" value="Media" checked>
                                    <span>Media</span>
                                </label>
                                <label class="priority-radio red">
                                    <input type="radio" name="prioridad" value="Alta">
                                    <span>Alta</span>
                                </label>
                            </div>
                        </div>

                        <div class="form-group-premium">
                            <label>Descripción y Detalles</label>
                            <div class="input-with-icon align-top">
                                <i class="ph ph-align-left" style="margin-top:12px;"></i>
                                <textarea id="nt-descripcion" rows="4" placeholder="Escribe aquí las instrucciones detalladas para los estudiantes..."></textarea>
                            </div>
                        </div>

                        <div class="modal-footer-premium">
                            <button type="button" class="btn-cancelar" id="btn-cancel-tarea">Descartar</button>
                            <button type="submit" class="btn-publicar" id="btn-save-tarea"><i class="ph ph-paper-plane-tilt"></i> Publicar Tarea</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    async afterRender() {
        this.user = Auth.getUser();
        this.allTareas = [];
        this.uniqueCourses = [];

        // Inicializar fecha mínima en el input de fecha
        document.getElementById('nt-fecha').min = new Date().toISOString().split('T')[0];

        try {
            await this.loadData();
            this.setupEvents();
        } catch (error) {
            console.error(error);
            document.getElementById('tareas-kanban').innerHTML = '<div class="loading-container" style="color:red;">Error al cargar el tablero de tareas.</div>';
        }
    },

    async loadData() {
        document.getElementById('tareas-kanban').innerHTML = '<div class="loading-container"><i class="ph ph-spinner ph-spin loading-spinner"></i></div>';

        // 1. Obtener cursos del docente
        this.uniqueCourses = await CursoService.getCursosUnicos(this.user.email);
        
        // Poblar selects de filtro y modal
        const selectFilter = document.getElementById('filter-curso-tarea');
        const selectModal = document.getElementById('nt-curso');
        
        // Limpiar para recargas
        selectFilter.innerHTML = '<option value="ALL">Todos los cursos</option>';
        selectModal.innerHTML = '<option value="" disabled selected>Selecciona un curso</option>';

        this.uniqueCourses.forEach(curso => {
            const txt = `${curso.nombre} (${curso.grado} ${curso.seccion} - ${curso.nivel})`;
            
            const opt1 = document.createElement('option');
            opt1.value = curso.id; opt1.textContent = txt;
            selectFilter.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = curso.id; opt2.textContent = txt;
            selectModal.appendChild(opt2);
        });

        // 2. Obtener todas las tareas de esos cursos
        const promesas = this.uniqueCourses.map(async (curso) => {
            const tareas = await API.fetch(`/api/docente/curso/${curso.id}/tareas`);
            return tareas.map(t => ({
                ...t,
                cursoInfo: `${curso.nombre} (${curso.grado} ${curso.seccion})`,
                cursoColor: curso.color || 'blue'
            }));
        });

        const resultados = await Promise.all(promesas);
        this.allTareas = resultados.flat().sort((a,b) => {
            return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento);
        });

        this.applyFilters();
    },

    setupEvents() {
        // Filtros
        document.getElementById('search-tareas').addEventListener('input', () => this.applyFilters());
        document.getElementById('filter-curso-tarea').addEventListener('change', () => this.applyFilters());

        // Modal
        const modal = document.getElementById('modal-nueva-tarea');
        document.getElementById('btn-nueva-tarea').addEventListener('click', () => modal.classList.add('active'));
        document.getElementById('close-modal-tarea').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('btn-cancel-tarea').addEventListener('click', () => modal.classList.remove('active'));

        // Guardar Tarea
        document.getElementById('form-nueva-tarea').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.guardarTarea();
        });
    },

    applyFilters() {
        const searchTerm = document.getElementById('search-tareas').value.toLowerCase();
        const cursoId = document.getElementById('filter-curso-tarea').value;

        const filtradas = this.allTareas.filter(t => {
            const matchText = t.titulo?.toLowerCase().includes(searchTerm) || t.descripcion?.toLowerCase().includes(searchTerm);
            const matchCurso = (cursoId === 'ALL') || (String(t.curso?.id) === String(cursoId));
            return matchText && matchCurso;
        });

        this.renderKanbanBoard(filtradas);
    },

    renderKanbanBoard(tareas) {
        const board = document.getElementById('tareas-kanban');
        
        // Agrupar tareas por estado
        const pendientes = tareas.filter(t => !t.estado || t.estado === 'Pendiente');
        const progreso = tareas.filter(t => t.estado === 'En progreso');
        const completadas = tareas.filter(t => t.estado === 'Completada');

        board.innerHTML = `
            ${this.renderKanbanColumn('Pendientes', 'blue', 'ph-circle', pendientes)}
            ${this.renderKanbanColumn('En Progreso', 'yellow', 'ph-clock', progreso)}
            ${this.renderKanbanColumn('Completadas', 'green', 'ph-check-circle', completadas)}
        `;
    },

    renderKanbanColumn(title, color, icon, tareas) {
        return `
            <div class="kanban-column">
                <div class="kanban-column-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="ph-fill ${icon}" style="color:var(--${color}); font-size:18px;"></i>
                        <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--text-primary);">${title}</h4>
                    </div>
                    <span class="kanban-column-count">${tareas.length}</span>
                </div>
                <div class="kanban-column-body">
                    ${tareas.length === 0 
                        ? `<div class="kanban-empty">No hay tareas en esta fase</div>`
                        : tareas.map(t => this.renderKanbanCard(t)).join('')}
                </div>
            </div>
        `;
    },

    renderKanbanCard(t) {
        const prioridadColor = t.prioridad === 'Alta' ? 'red' : (t.prioridad === 'Media' ? 'yellow' : 'green');
        
        // Días restantes
        const diffTime = new Date(t.fechaVencimiento) - new Date();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let vencimientoClass = 'normal';
        let vencimientoText = t.fechaVencimiento;
        if (diffDays < 0) {
            vencimientoClass = 'overdue';
            vencimientoText = `Vencida hace ${Math.abs(diffDays)}d`;
        } else if (diffDays === 0) {
            vencimientoClass = 'today';
            vencimientoText = 'Vence hoy';
        }

        return `
            <article class="kanban-card">
                <div class="kanban-card-top">
                    <span class="kanban-tag course-tag" style="background:var(--${t.cursoColor}-light, #f0f4ff); color:var(--${t.cursoColor}, #3b82f6);">
                        ${t.cursoInfo}
                    </span>
                    <span class="kanban-priority ${prioridadColor}">
                        <i class="ph-fill ph-flag"></i> ${t.prioridad || 'Media'}
                    </span>
                </div>
                
                <h4 class="kanban-card-title">${t.titulo}</h4>
                <p class="kanban-card-desc">${t.descripcion || 'Sin descripción.'}</p>
                
                <div class="kanban-card-bottom">
                    <div class="kanban-date ${vencimientoClass}">
                        <i class="ph-fill ${vencimientoClass === 'overdue' ? 'ph-warning-circle' : 'ph-calendar-blank'}"></i>
                        ${vencimientoText}
                    </div>
                    <button class="kanban-action-btn" title="Ver Detalles/Entregas"><i class="ph ph-arrow-right"></i></button>
                </div>
            </article>
        `;
    },

    async guardarTarea() {
        const btn = document.getElementById('btn-save-tarea');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';

        const prioridadSeleccionada = document.querySelector('input[name="prioridad"]:checked').value;

        const nuevaTarea = {
            titulo: document.getElementById('nt-titulo').value,
            curso: { id: parseInt(document.getElementById('nt-curso').value) },
            prioridad: prioridadSeleccionada,
            fechaVencimiento: document.getElementById('nt-fecha').value,
            descripcion: document.getElementById('nt-descripcion').value,
            fechaInicio: new Date().toISOString().split('T')[0],
            estado: 'Pendiente' // El backend podría sobreescribirlo pero lo enviamos por si acaso
        };

        try {
            await API.fetch('/api/tareas', {
                method: 'POST',
                body: JSON.stringify(nuevaTarea)
            });
            
            // Éxito
            document.getElementById('modal-nueva-tarea').classList.remove('active');
            document.getElementById('form-nueva-tarea').reset();
            
            // Recargar datos
            await this.loadData();
            
        } catch (error) {
            console.error(error);
            alert('Error al publicar la tarea. Revisa tu conexión.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Publicar Tarea';
        }
    }
};
