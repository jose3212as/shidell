import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

export const CalificacionesView = {
    async render() {
        return `
            <div class="content-header grades-header">
                <div>
                    <h2>Registro de Calificaciones y Entregas</h2>
                    <p>Administra las notas manuales y califica los trabajos entregados por tus estudiantes.</p>
                </div>
            </div>

            <!-- Panel de Controles -->
            <div class="filters-panel" style="padding: 15px 20px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; gap: 15px; flex: 1;">
                    <div class="filters-search-box" style="padding: 8px 15px; max-width: 350px;">
                        <i class="ph ph-magnifying-glass filters-search-icon"></i>
                        <input type="text" id="search-grades-student" class="filters-search-input" placeholder="Buscar estudiante por nombre...">
                    </div>
                    
                    <div class="filter-group">
                        <label class="filter-label"><i class="ph ph-books"></i> Curso:</label>
                        <select id="grades-curso-select" class="filter-select" style="padding: 8px 15px; min-width: 250px;">
                            <option value="" disabled selected>Elige un curso para ver el registro</option>
                        </select>
                    </div>
                </div>
                
                <button class="btn-primary" id="btn-nueva-nota" disabled style="padding:10px 20px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:6px; opacity: 0.5;">
                    <i class="ph ph-plus-circle" style="font-size:18px;"></i> Nota Manual
                </button>
            </div>

            <!-- Contenedor Principal (Tabla) -->
            <div class="grades-main-container" id="grades-container">
                <div class="kanban-empty" style="border: none;">
                    <i class="ph ph-table" style="font-size: 48px; color: var(--border-color); margin-bottom:10px; display:block;"></i>
                    Selecciona un curso arriba para visualizar el registro.
                </div>
            </div>

            <!-- Modal Nueva Calificación Manual -->
            <div class="modal-overlay" id="modal-nueva-nota">
                <div class="modal-content premium-modal">
                    <div class="modal-header">
                        <div class="modal-title-wrapper">
                            <div class="modal-icon-bg"><i class="ph-fill ph-exam"></i></div>
                            <div>
                                <h3>Registrar Calificación Manual</h3>
                                <p id="modal-course-name">Asigna una nota a un estudiante.</p>
                            </div>
                        </div>
                        <button class="modal-close" id="close-modal-nota"><i class="ph ph-x"></i></button>
                    </div>
                    <form id="form-nueva-nota" class="modal-body">
                        <div class="form-group-premium">
                            <label>Actividad Evaluada <span class="required">*</span></label>
                            <div class="input-with-icon">
                                <i class="ph ph-bookmark-simple"></i>
                                <input type="text" id="nn-actividad" list="dl-actividades" placeholder="Selecciona una tarea o escribe otra..." required>
                                <datalist id="dl-actividades"></datalist>
                            </div>
                        </div>
                        <div class="form-group-premium">
                            <label>Estudiante <span class="required">*</span></label>
                            <div class="input-with-icon">
                                <i class="ph ph-user"></i>
                                <select id="nn-estudiante" required>
                                    <option value="" disabled selected>Selecciona un estudiante</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group-premium">
                            <label>Calificación (0 - 20) <span class="required">*</span></label>
                            <div class="input-with-icon">
                                <i class="ph ph-star"></i>
                                <input type="number" id="nn-nota" min="0" max="20" step="0.5" placeholder="Ej. 18.5" required>
                            </div>
                        </div>
                        <div class="modal-footer-premium">
                            <button type="button" class="btn-cancelar" id="btn-cancel-nota">Descartar</button>
                            <button type="submit" class="btn-publicar" id="btn-save-nota"><i class="ph ph-check-circle"></i> Guardar Nota</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Modal Calificar Entrega -->
            <div class="modal-overlay" id="modal-calificar-entrega">
                <div class="modal-content premium-modal">
                    <div class="modal-header">
                        <div class="modal-title-wrapper">
                            <div class="modal-icon-bg" style="background:var(--blue-light); color:var(--primary);"><i class="ph-fill ph-student"></i></div>
                            <div>
                                <h3>Calificar Tarea Entregada</h3>
                                <p id="modal-entrega-tarea-name">Tarea: ...</p>
                            </div>
                        </div>
                        <button class="modal-close" id="close-modal-entrega"><i class="ph ph-x"></i></button>
                    </div>
                    <form id="form-calificar-entrega" class="modal-body">
                        <input type="hidden" id="ce-entrega-id">
                        
                        <div class="form-group-premium">
                            <label>Estudiante</label>
                            <div class="input-with-icon">
                                <i class="ph ph-user"></i>
                                <input type="text" id="ce-estudiante-nombre" disabled>
                            </div>
                        </div>

                        <div class="form-group-premium">
                            <label>Archivo Entregado</label>
                            <a id="ce-archivo-btn" href="#" target="_blank" class="btn-secondary" style="display:inline-flex; align-items:center; gap:8px; padding:10px 15px; border-radius:8px; text-decoration:none; color:var(--primary); font-weight:600; background:var(--blue-light); border:none; margin-top:5px;">
                                <i class="ph ph-download-simple" style="font-size:20px;"></i> Descargar/Ver Archivo
                            </a>
                        </div>
                        
                        <div class="form-group-premium" style="margin-top:15px;">
                            <label>Calificación (0 - 20) <span class="required">*</span></label>
                            <div class="input-with-icon">
                                <i class="ph ph-star"></i>
                                <input type="number" id="ce-nota" min="0" max="20" step="0.5" placeholder="Asigna una nota..." required>
                            </div>
                        </div>

                        <div class="form-group-premium">
                            <label>Comentario (Opcional)</label>
                            <div class="input-with-icon align-top">
                                <i class="ph ph-chat-text" style="margin-top:12px;"></i>
                                <textarea id="ce-comentario" rows="3" placeholder="Comentarios de retroalimentación..."></textarea>
                            </div>
                        </div>

                        <div class="modal-footer-premium">
                            <button type="button" class="btn-cancelar" id="btn-cancel-entrega">Cerrar</button>
                            <button type="submit" class="btn-publicar" id="btn-save-entrega"><i class="ph ph-check-circle"></i> Calificar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    async afterRender() {
        this.user = Auth.getUser();
        this.cursos = [];
        this.currentEstudiantes = [];
        this.currentCalificaciones = [];
        this.currentTareas = [];
        this.currentEntregas = []; // Lista plana de todas las entregas del curso
        this.selectedCursoId = null;

        try {
            await this.loadCursos();
            this.setupEvents();
        } catch (error) {
            console.error(error);
        }
    },

    async loadCursos() {
        this.cursos = await CursoService.getCursosUnicos(this.user.email);
        const select = document.getElementById('grades-curso-select');
        
        this.cursos.forEach(curso => {
            const opt = document.createElement('option');
            opt.value = curso.id;
            opt.textContent = `${curso.nombre} (${curso.grado} ${curso.seccion} - ${curso.nivel})`;
            select.appendChild(opt);
        });
    },

    setupEvents() {
        const select = document.getElementById('grades-curso-select');
        select.addEventListener('change', async (e) => {
            this.selectedCursoId = e.target.value;
            if (this.selectedCursoId) {
                const btn = document.getElementById('btn-nueva-nota');
                btn.disabled = false;
                btn.style.opacity = '1';
                document.getElementById('search-grades-student').value = '';
                const curso = this.cursos.find(c => c.id == this.selectedCursoId);
                document.getElementById('modal-course-name').textContent = `Curso: ${curso.nombre} (${curso.grado} ${curso.seccion})`;
                await this.loadGradesForCourse();
            }
        });

        document.getElementById('search-grades-student').addEventListener('input', () => {
            this.renderGradesTable();
        });

        // Modal Manual
        const modal = document.getElementById('modal-nueva-nota');
        document.getElementById('btn-nueva-nota').addEventListener('click', () => {
            this.populateStudentsModal();
            document.getElementById('nn-actividad').value = '';
            document.getElementById('nn-nota').value = '';
            modal.classList.add('active');
        });
        document.getElementById('close-modal-nota').addEventListener('click', () => modal.classList.remove('active'));
        document.getElementById('btn-cancel-nota').addEventListener('click', () => modal.classList.remove('active'));

        document.getElementById('form-nueva-nota').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.guardarNotaManual();
        });

        // Modal Entrega
        const modalEntrega = document.getElementById('modal-calificar-entrega');
        document.getElementById('close-modal-entrega').addEventListener('click', () => modalEntrega.classList.remove('active'));
        document.getElementById('btn-cancel-entrega').addEventListener('click', () => modalEntrega.classList.remove('active'));

        document.getElementById('form-calificar-entrega').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.guardarNotaEntrega();
        });

        // Delegar clics en la tabla
        document.getElementById('grades-container').addEventListener('click', (e) => {
            const btnEntrega = e.target.closest('.btn-calificar-entrega');
            if (btnEntrega) {
                this.abrirModalEntrega(btnEntrega.dataset.id);
                return;
            }
            
            // Si hacen clic en "Calificar Manual" porque el alumno no entregó
            const btnManual = e.target.closest('.btn-calificar-manual-rapido');
            if (btnManual) {
                this.populateStudentsModal();
                document.getElementById('nn-estudiante').value = btnManual.dataset.estudiante;
                document.getElementById('nn-actividad').value = btnManual.dataset.actividad;
                document.getElementById('nn-nota').value = '';
                modal.classList.add('active');
            }
        });
    },

    async loadGradesForCourse() {
        const container = document.getElementById('grades-container');
        container.innerHTML = '<div class="loading-container"><i class="ph ph-spinner ph-spin loading-spinner"></i><p>Cargando registro y tareas...</p></div>';

        try {
            // 1. Estudiantes
            this.currentEstudiantes = await API.fetch(`/api/docente/curso/${this.selectedCursoId}/estudiantes`);
            // 2. Calificaciones manuales
            this.currentCalificaciones = await API.fetch(`/api/docente/curso/${this.selectedCursoId}/calificaciones`);
            // 3. Tareas
            this.currentTareas = await API.fetch(`/api/docente/curso/${this.selectedCursoId}/tareas`);
            
            // 4. Entregas de todas las tareas
            const promesasEntregas = this.currentTareas.map(t => API.fetch(`/api/entregas/tarea/${t.id}`));
            const resultadosEntregas = await Promise.all(promesasEntregas);
            this.currentEntregas = resultadosEntregas.flat();

            this.renderGradesTable();
            
            // Llenar datalist de actividades
            const dlActividades = document.getElementById('dl-actividades');
            dlActividades.innerHTML = '';
            this.currentTareas.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.titulo;
                dlActividades.appendChild(opt);
            });
            
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="kanban-empty" style="color:red; border:none;">Error al cargar los datos del curso.</div>';
        }
    },

    renderGradesTable() {
        const container = document.getElementById('grades-container');
        const searchTerm = document.getElementById('search-grades-student').value.toLowerCase();
        
        // Identificar actividades manuales que NO son tareas
        const tareasTitulos = this.currentTareas.map(t => t.titulo.toLowerCase());
        const manualActividadesSet = new Set();
        this.currentCalificaciones.forEach(c => {
            if (!tareasTitulos.includes(c.actividad.toLowerCase())) {
                manualActividadesSet.add(c.actividad);
            }
        });
        const actividadesExtra = Array.from(manualActividadesSet);

        // Filtrado local
        let filteredStudents = this.currentEstudiantes;
        if (searchTerm) {
            filteredStudents = this.currentEstudiantes.filter(est => 
                est.nombres.toLowerCase().includes(searchTerm) || 
                est.apellidos.toLowerCase().includes(searchTerm)
            );
        }

        if (this.currentEstudiantes.length === 0) {
            container.innerHTML = `<div class="kanban-empty" style="border:none;">No hay estudiantes matriculados en este curso.</div>`;
            return;
        }

        if (filteredStudents.length === 0) {
            container.innerHTML = `<div class="kanban-empty" style="border:none;">No se encontraron estudiantes con ese nombre.</div>`;
            return;
        }

        let html = `
            <div class="grades-table-wrapper">
                <table class="grades-table">
                    <thead>
                        <tr>
                            <th class="col-student">Estudiante</th>
                            ${this.currentTareas.map(t => `<th style="background:#e0f2fe; color:#0369a1;"><i class="ph-fill ph-notebook"></i> ${t.titulo}</th>`).join('')}
                            ${actividadesExtra.map(act => `<th>${act}</th>`).join('')}
                            ${this.currentTareas.length === 0 && actividadesExtra.length === 0 ? '<th>Sin Evaluaciones</th>' : ''}
                            <th>Promedio Final</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filteredStudents.sort((a,b) => a.apellidos.localeCompare(b.apellidos));

        filteredStudents.forEach(est => {
            const iniciales = (est.nombres.charAt(0) + est.apellidos.charAt(0)).toUpperCase();
            
            html += `
                <tr>
                    <td class="col-student">
                        <div class="student-mini-avatar">${iniciales}</div>
                        <div class="student-name-block">
                            <strong>${est.apellidos}, ${est.nombres}</strong>
                            <span>${est.email}</span>
                        </div>
                    </td>
            `;

            let suma = 0;
            let count = 0;

            // 1. Columnas de Tareas (Combina Entregas y Calificaciones Manuales con el mismo nombre)
            this.currentTareas.forEach(tarea => {
                const entrega = this.currentEntregas.find(e => e.tarea && e.tarea.id === tarea.id && e.estudiante && e.estudiante.id === est.id);
                // Buscar si hay una nota manual con el nombre de esta tarea
                const notaManual = this.currentCalificaciones.find(c => c.estudiante && c.estudiante.id === est.id && c.actividad.toLowerCase() === tarea.titulo.toLowerCase());
                
                if (entrega && entrega.nota !== null) {
                    const val = entrega.nota;
                    suma += val;
                    count++;
                    const clase = val >= 11 ? 'aprobado' : 'desaprobado';
                    html += `<td>
                                <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                                    <span class="grade-badge ${clase}">${val}</span>
                                    <button class="btn-calificar-entrega" data-id="${entrega.id}" title="Ver/Editar Archivo" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:12px;text-decoration:underline;">Ver Archivo</button>
                                </div>
                             </td>`;
                } else if (notaManual) {
                    const val = notaManual.nota;
                    suma += val;
                    count++;
                    const clase = val >= 11 ? 'aprobado' : 'desaprobado';
                    html += `<td>
                                <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                                    <span class="grade-badge ${clase}">${val}</span>
                                    <span style="font-size:10px; color:#64748b;">(Nota Manual)</span>
                                </div>
                             </td>`;
                } else if (entrega) {
                    // Entregó pero no está calificado
                    html += `<td>
                                <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                                    <span class="grade-badge" style="background:#fef3c7; color:#d97706; padding:4px 8px; font-size:11px;">Por Evaluar</span>
                                    <button class="btn-calificar-entrega btn-primary" data-id="${entrega.id}" style="padding:4px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;">Calificar</button>
                                </div>
                             </td>`;
                } else {
                    // No entregó archivo ni tiene nota manual
                    const fechaVencimiento = new Date(tarea.fechaVencimiento);
                    const isExpired = fechaVencimiento < new Date();
                    
                    if (isExpired) {
                        html += `<td>
                                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                                        <span class="grade-badge empty" style="font-size:10px;">Vencido</span>
                                        <button class="btn-calificar-manual-rapido btn-secondary" data-estudiante="${est.id}" data-actividad="${tarea.titulo}" style="padding:4px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer; background:#e2e8f0; color:#475569;">Poner 0 (Manual)</button>
                                    </div>
                                 </td>`;
                    } else {
                        html += `<td><span class="grade-badge empty" style="font-size:10px; background:#f1f5f9; color:#64748b;">Aún a tiempo</span></td>`;
                    }
                }
            });

            // 2. Renderizar columnas de Actividades Extras (Manuales que no son tareas)
            actividadesExtra.forEach(act => {
                const notaObj = this.currentCalificaciones.find(c => c.estudiante && c.estudiante.id === est.id && c.actividad === act);
                if (notaObj) {
                    const val = notaObj.nota;
                    suma += val;
                    count++;
                    const clase = val >= 11 ? 'aprobado' : 'desaprobado';
                    html += `<td><span class="grade-badge ${clase}">${val}</span></td>`;
                } else {
                    html += `<td><span class="grade-badge empty">-</span></td>`;
                }
            });

            if (this.currentTareas.length === 0 && actividadesExtra.length === 0) {
                html += `<td><span class="grade-badge empty">0.0</span></td>`;
            }

            // Promedio Total (Tareas + Manuales)
            const promedio = count > 0 ? (suma / count).toFixed(1) : "0.0";
            const promClase = parseFloat(promedio) >= 11 ? 'aprobado' : (count > 0 ? 'desaprobado' : 'empty');
            html += `<td><span class="grade-badge ${promClase}" style="font-size:16px; font-weight:800; padding:6px 14px;">${promedio}</span></td>`;
            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    },

    populateStudentsModal() {
        const select = document.getElementById('nn-estudiante');
        select.innerHTML = '<option value="" disabled selected>Selecciona un estudiante</option>';
        this.currentEstudiantes.forEach(est => {
            const opt = document.createElement('option');
            opt.value = est.id;
            opt.textContent = `${est.apellidos}, ${est.nombres}`;
            select.appendChild(opt);
        });
    },

    async guardarNotaManual() {
        const btn = document.getElementById('btn-save-nota');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';

        const form = new FormData();
        form.append('cursoId', this.selectedCursoId);
        form.append('estudianteId', document.getElementById('nn-estudiante').value);
        form.append('actividad', document.getElementById('nn-actividad').value);
        form.append('nota', document.getElementById('nn-nota').value);

        try {
            await API.fetch('/api/docente/calificar', { method: 'POST', body: form });
            document.getElementById('modal-nueva-nota').classList.remove('active');
            document.getElementById('form-nueva-nota').reset();
            await this.loadGradesForCourse();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Error al registrar la calificación.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-check-circle"></i> Guardar Nota';
        }
    },

    abrirModalEntrega(entregaId) {
        const entrega = this.currentEntregas.find(e => e.id == entregaId);
        if (!entrega) return;

        document.getElementById('modal-entrega-tarea-name').textContent = `Tarea: ${entrega.tarea.titulo}`;
        document.getElementById('ce-entrega-id').value = entrega.id;
        document.getElementById('ce-estudiante-nombre').value = `${entrega.estudiante.apellidos}, ${entrega.estudiante.nombres}`;
        
        const btnArchivo = document.getElementById('ce-archivo-btn');
        if (entrega.archivoUrl) {
            btnArchivo.href = (entrega.archivoUrl.startsWith('/') || entrega.archivoUrl.startsWith('http')) 
                ? entrega.archivoUrl 
                : '/uploads/entregas/' + entrega.archivoUrl;
            btnArchivo.style.display = 'inline-flex';
        } else {
            btnArchivo.style.display = 'none';
        }

        document.getElementById('ce-nota').value = entrega.nota !== null ? entrega.nota : '';
        document.getElementById('ce-comentario').value = entrega.comentarios || '';

        document.getElementById('modal-calificar-entrega').classList.add('active');
    },

    async guardarNotaEntrega() {
        const btn = document.getElementById('btn-save-entrega');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Calificando...';

        const entregaId = document.getElementById('ce-entrega-id').value;
        const nota = document.getElementById('ce-nota').value;
        const comentario = document.getElementById('ce-comentario').value;

        try {
            const url = `/api/entregas/${entregaId}/calificar?nota=${encodeURIComponent(nota)}&comentario=${encodeURIComponent(comentario)}`;
            await API.fetch(url, { method: 'PUT' });
            
            document.getElementById('modal-calificar-entrega').classList.remove('active');
            Swal.fire('¡Éxito!', 'Tarea calificada correctamente.', 'success');
            await this.loadGradesForCourse();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar la calificación de la tarea.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-check-circle"></i> Calificar';
        }
    }
};
