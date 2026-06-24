import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

export const MisClasesView = {
    async render() {
        return `
            <div class="content-header">
                <div>
                    <h2>Mis Clases</h2>
                    <p>Gestiona tus aulas, estudiantes y registro de asistencia.</p>
                </div>
            </div>

            <div class="courses-grid" id="courses-grid">
                <div style="grid-column:1/-1;text-align:center;">Cargando clases...</div>
            </div>

            <!-- Modal Estudiantes -->
            <div class="modal-overlay" id="students-modal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <div>
                            <h3 id="modal-course-name">Estudiantes</h3>
                            <p id="modal-course-info" style="color:var(--text-secondary);font-size:13px;"></p>
                        </div>
                        <button class="modal-close" id="close-students-modal"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="modal-body" style="padding:0;">
                        <div class="table-scroll" style="max-height:400px;">
                            <table class="data-table">
                                <thead><tr><th>Estudiante</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody id="students-list-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Asistencia -->
            <div class="modal-overlay" id="attendance-modal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <div>
                            <h3 id="attendance-course-name">Asistencia</h3>
                            <p id="attendance-course-info" style="color:var(--text-secondary);font-size:13px;"></p>
                        </div>
                        <button class="modal-close" id="close-attendance-modal"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="modal-body">
                        <div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">
                            <label style="font-weight:600;font-size:13px;">Día de clase:</label>
                            <select id="attendance-class-date" class="form-input" style="max-width:300px;"></select>
                            <button id="mark-all-present" class="btn-secondary" style="margin-left:auto;"><i class="ph ph-check-square-offset"></i> Marcar todos presentes</button>
                        </div>
                        <div class="table-scroll" style="max-height:350px;">
                            <table class="data-table">
                                <thead><tr><th>Estudiante</th><th>Correo</th><th>Asistencia</th></tr></thead>
                                <tbody id="attendance-list-body"></tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer" style="padding:15px 20px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end;">
                        <button id="save-attendance" class="btn-primary" disabled><i class="ph ph-floppy-disk"></i> Guardar asistencia</button>
                    </div>
                </div>
            </div>
        `;
    },

    async afterRender(queryString) {
        const user = Auth.getUser();
        
        // Cargar cursos deduplicados
        try {
            const cursos = await CursoService.getCursosUnicos(user.email);
            this.renderCursos(cursos);

            // Manejar query params para auto-abrir modal
            if (queryString) {
                const params = new URLSearchParams(queryString);
                const cursoId = params.get('curso');
                const asistencia = params.get('asistencia');
                
                if (cursoId) {
                    const curso = cursos.find(c => String(c.id) === String(cursoId));
                    if (curso) {
                        const info = `${curso.grado} grado ${curso.seccion} - ${curso.nivel}`;
                        if (asistencia === '1') {
                            this.abrirAsistencia(curso.id, curso.nombre, info);
                        } else {
                            this.verEstudiantes(curso.id, curso.nombre, info);
                        }
                    }
                }
            }
        } catch (e) {
            document.getElementById('courses-grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;">Error al cargar cursos.</div>';
        }

        // Setup Event Listeners for Modals
        document.getElementById('close-students-modal').addEventListener('click', () => {
            document.getElementById('students-modal').classList.remove('active');
        });
        
        document.getElementById('close-attendance-modal').addEventListener('click', () => {
            document.getElementById('attendance-modal').classList.remove('active');
        });

        document.getElementById('attendance-class-date').addEventListener('change', () => this.cargarAsistencia());
        document.getElementById('mark-all-present').addEventListener('click', () => {
            document.querySelectorAll('#attendance-list-body select').forEach(s => s.value = 'PRESENTE');
        });
        document.getElementById('save-attendance').addEventListener('click', () => this.guardarAsistencia());
    },

    renderCursos(cursos) {
        const grid = document.getElementById('courses-grid');
        if (!cursos || cursos.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">No tienes cursos asignados.</div>';
            return;
        }

        grid.innerHTML = cursos.map(curso => `
            <div class="course-card">
                <div class="course-card-header">
                    <div class="course-card-icon">
                        <i class="ph-fill ${curso.icono || 'ph-book-open'}"></i>
                    </div>
                    <span class="status-pill success">Activo</span>
                </div>
                <div class="course-card-body">
                    <h3>${curso.nombre}</h3>
                    <div class="course-details">
                        <div class="detail-item"><i class="ph ph-graduation-cap"></i><span>${curso.grado} grado de ${curso.nivel}</span></div>
                        <div class="detail-item"><i class="ph ph-users-three"></i><span>Sección: ${curso.seccion}</span></div>
                    </div>
                </div>
                <div class="course-card-footer">
                    <button class="btn-primary" onclick="window.misClasesAPI.verEstudiantes(${curso.id}, '${curso.nombre}', '${curso.grado} ${curso.seccion} - ${curso.nivel}')">Estudiantes</button>
                    <button class="btn-secondary" onclick="window.misClasesAPI.abrirAsistencia(${curso.id}, '${curso.nombre}', '${curso.grado} ${curso.seccion} - ${curso.nivel}')"><i class="ph ph-calendar-check"></i> Asistencia</button>
                </div>
            </div>
        `).join('');

        // Expose global methods for inline handlers
        window.misClasesAPI = {
            verEstudiantes: (id, n, i) => this.verEstudiantes(id, n, i),
            abrirAsistencia: (id, n, i) => this.abrirAsistencia(id, n, i)
        };
    },

    async verEstudiantes(cursoId, nombre, info) {
        document.getElementById('modal-course-name').textContent = `Estudiantes: ${nombre}`;
        document.getElementById('modal-course-info').textContent = info;
        const tbody = document.getElementById('students-list-body');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';
        document.getElementById('students-modal').classList.add('active');

        try {
            const estudiantes = await API.fetch(`/api/docente/curso/${cursoId}/estudiantes`);
            if (estudiantes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay estudiantes inscritos.</td></tr>';
                return;
            }
            tbody.innerHTML = estudiantes.map(est => `
                <tr>
                    <td><strong>${est.nombres} ${est.apellidos}</strong></td>
                    <td>${est.email}</td>
                    <td><span class="status-pill success">Inscrito</span></td>
                    <td><button class="btn-secondary" style="padding:4px 8px; font-size:12px;">Perfil</button></td>
                </tr>
            `).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Error al cargar.</td></tr>';
        }
    },

    async abrirAsistencia(cursoId, nombre, info) {
        this.currentAsistenciaCurso = cursoId;
        document.getElementById('attendance-course-name').textContent = `Asistencia: ${nombre}`;
        document.getElementById('attendance-course-info').textContent = info;
        document.getElementById('attendance-modal').classList.add('active');
        
        const select = document.getElementById('attendance-class-date');
        const tbody = document.getElementById('attendance-list-body');
        const btnSave = document.getElementById('save-attendance');
        
        select.innerHTML = '<option value="">Cargando días...</option>';
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Cargando...</td></tr>';
        btnSave.disabled = true;

        try {
            const dias = await API.fetch(`/api/docente/curso/${cursoId}/asistencia/dias`);
            if (!dias || dias.length === 0) {
                select.innerHTML = '<option value="">Sin clases programadas</option>';
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No hay días programados.</td></tr>';
                return;
            }

            select.innerHTML = dias.map(d => `
                <option value="${d.fecha}">${d.fecha} ${d.registrados > 0 ? `(${d.registrados}/${d.totalEstudiantes})` : ''}</option>
            `).join('');
            
            // Auto-seleccionar hoy si es posible
            const hoy = new Date().toISOString().slice(0, 10);
            if (dias.find(d => d.fecha === hoy)) select.value = hoy;

            btnSave.disabled = false;
            await this.cargarAsistencia();
        } catch (error) {
            select.innerHTML = '<option value="">Error al cargar</option>';
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red;">Error</td></tr>';
        }
    },

    async cargarAsistencia() {
        const cursoId = this.currentAsistenciaCurso;
        const fecha = document.getElementById('attendance-class-date').value;
        const tbody = document.getElementById('attendance-list-body');
        
        if (!fecha) return;
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Cargando...</td></tr>';

        try {
            const data = await API.fetch(`/api/docente/curso/${cursoId}/asistencia?fecha=${fecha}`);
            const ests = data.estudiantes || [];
            
            if (ests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No hay estudiantes.</td></tr>';
                return;
            }

            tbody.innerHTML = ests.map(est => `
                <tr>
                    <td><strong>${est.nombres} ${est.apellidos}</strong></td>
                    <td>${est.email}</td>
                    <td>
                        <select data-id="${est.estudianteId}" class="form-input" style="padding:4px 8px;">
                            <option value="PRESENTE" ${est.estado === 'PRESENTE' ? 'selected' : ''}>Presente</option>
                            <option value="TARDE" ${est.estado === 'TARDE' ? 'selected' : ''}>Tarde</option>
                            <option value="AUSENTE" ${est.estado === 'AUSENTE' ? 'selected' : ''}>Ausente</option>
                            <option value="JUSTIFICADO" ${est.estado === 'JUSTIFICADO' ? 'selected' : ''}>Justificado</option>
                        </select>
                        ${est.registrado ? '<span class="status-pill success" style="margin-left:10px;">Guardado</span>' : ''}
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red;">Error al cargar.</td></tr>';
        }
    },

    async guardarAsistencia() {
        const cursoId = this.currentAsistenciaCurso;
        const fecha = document.getElementById('attendance-class-date').value;
        const btnSave = document.getElementById('save-attendance');
        
        if (!cursoId || !fecha) return;
        
        const registros = Array.from(document.querySelectorAll('#attendance-list-body select')).map(s => ({
            estudianteId: Number(s.getAttribute('data-id')),
            estado: s.value
        }));

        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';

        try {
            await API.fetch(`/api/docente/curso/${cursoId}/asistencia?fecha=${fecha}`, {
                method: 'POST',
                body: JSON.stringify(registros)
            });
            await this.cargarAsistencia();
            btnSave.innerHTML = '<i class="ph ph-check"></i> Guardado';
            setTimeout(() => {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar asistencia';
            }, 2000);
        } catch (error) {
            alert('Error al guardar');
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar asistencia';
        }
    }
};
