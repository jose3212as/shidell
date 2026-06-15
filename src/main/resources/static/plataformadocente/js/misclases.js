// Shidell Teacher Portal - Mis Clases Logic
instalarAuthFetchDocente();

function instalarAuthFetchDocente() {
    if (window.__shidellAuthFetch) return;
    window.__shidellAuthFetch = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('shidell_user') || 'null'); } catch {}
        if (!user?.sessionToken) return originalFetch(input, init);
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${user.sessionToken}`);
        return originalFetch(input, { ...init, headers });
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const currentHost = window.location.host;
    const API_BASE = (currentHost === '' || !currentHost.includes('localhost')) ? 'http://localhost:8080' : '';

    const storedUser = localStorage.getItem('shidell_user');
    let teacherEmail = 'profesor@shidell.edu';
    let teacherName = 'Ana Lopez';
    let asistenciaCursoActual = null;
    let diasClaseActuales = [];

    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            if (user.rol === 'DOCENTE') {
                teacherEmail = user.email;
                teacherName = `${user.nombres} ${user.apellidos}`;
            }
        } catch (e) {}
    }

    const nameLabel = document.getElementById('user-name-label');
    if (nameLabel) nameLabel.textContent = teacherName;

    async function cargarMisClases() {
        const statusEl = document.getElementById('server-status');
        const grid = document.getElementById('courses-grid');

        try {
            statusEl.textContent = 'Estado: Cargando clases...';

            const respDocente = await fetch(`${API_BASE}/api/docente/buscar?email=${encodeURIComponent(teacherEmail)}`);
            if (!respDocente.ok) throw new Error('Error al buscar docente');
            const docente = await respDocente.json();

            if (!docente || !docente.id) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">Docente no encontrado.</div>';
                return;
            }

            const respCursos = await fetch(`${API_BASE}/api/docente/${docente.id}/cursos`);
            const cursos = await respCursos.json();

            statusEl.textContent = 'Estado: Conectado';
            renderizarCursos(cursos);
        } catch (error) {
            console.error(error);
            statusEl.textContent = 'Estado: Error de conexion';
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">Error al cargar las clases. Verifica la conexion con el servidor.</div>';
        }
    }

    function renderizarCursos(cursos) {
        const grid = document.getElementById('courses-grid');
        if (!cursos || cursos.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">No tienes cursos asignados.</div>';
            return;
        }

        grid.innerHTML = '';
        cursos.forEach(curso => {
            const info = `${curso.grado} grado ${curso.seccion} - ${curso.nivel}`;
            const card = document.createElement('div');
            card.className = 'course-card';
            card.innerHTML = `
                <div class="course-card-header">
                    <div class="course-card-icon">
                        <i class="ph-fill ${escapeHtml(curso.icono || 'ph-book-open')}"></i>
                    </div>
                    <span class="status-pill success">Activo</span>
                </div>
                <div class="course-card-body">
                    <h3>${escapeHtml(limpiarTexto(curso.nombre || 'Curso'))}</h3>
                    <div class="course-details">
                        <div class="detail-item">
                            <i class="ph ph-graduation-cap"></i>
                            <span>${escapeHtml(curso.grado || '')} grado de ${escapeHtml(curso.nivel || '')}</span>
                        </div>
                        <div class="detail-item">
                            <i class="ph ph-users-three"></i>
                            <span>Seccion: ${escapeHtml(curso.seccion || '')}</span>
                        </div>
                        <div class="detail-item">
                            <i class="ph ph-clock"></i>
                            <span>Registro por fecha</span>
                        </div>
                    </div>
                </div>
                <div class="course-card-footer">
                    <button class="btn-primary btn-students" type="button">
                        Ver Estudiantes
                    </button>
                    <button class="btn-secondary btn-attendance" type="button" style="padding:10px 14px;font-size:13px;">
                        <i class="ph ph-calendar-check"></i> Asistencia
                    </button>
                </div>
            `;

            card.querySelector('.btn-students').addEventListener('click', () => {
                verEstudiantes(curso.id, limpiarTexto(curso.nombre || 'Curso'), info);
            });
            card.querySelector('.btn-attendance').addEventListener('click', () => {
                abrirAsistencia(curso.id, limpiarTexto(curso.nombre || 'Curso'), info);
            });
            grid.appendChild(card);
        });
    }

    window.verEstudiantes = async function(cursoId, nombre, info) {
        const modal = document.getElementById('students-modal');
        const modalTitle = document.getElementById('modal-course-name');
        const modalInfo = document.getElementById('modal-course-info');
        const tableBody = document.getElementById('students-list-body');

        modalTitle.textContent = `Estudiantes: ${nombre}`;
        modalInfo.textContent = info;
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';
        modal.classList.add('active');

        try {
            const resp = await fetch(`${API_BASE}/api/docente/curso/${cursoId}/estudiantes`);
            const estudiantes = await resp.json();

            tableBody.innerHTML = '';
            if (estudiantes.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay estudiantes inscritos.</td></tr>';
                return;
            }

            estudiantes.forEach(est => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${escapeHtml(`${est.nombres || ''} ${est.apellidos || ''}`.trim())}</strong></td>
                    <td>${escapeHtml(est.email || '')}</td>
                    <td><span class="status-pill success">Inscrito</span></td>
                    <td><button class="btn-secondary" style="padding:6px 12px;font-size:12px;">Perfil</button></td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Error al cargar estudiantes.</td></tr>';
        }
    };

    async function abrirAsistencia(cursoId, nombre, info) {
        asistenciaCursoActual = { id: cursoId, nombre, info };
        const modal = document.getElementById('attendance-modal');

        document.getElementById('attendance-course-name').textContent = `Asistencia: ${nombre}`;
        document.getElementById('attendance-course-info').textContent = info;

        modal.classList.add('active');
        await cargarDiasClase();
    }

    async function cargarDiasClase() {
        if (!asistenciaCursoActual) return;

        const select = document.getElementById('attendance-class-date');
        const tableBody = document.getElementById('attendance-list-body');
        const saveBtn = document.getElementById('save-attendance');

        select.innerHTML = '<option value="">Cargando dias...</option>';
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Cargando dias de clase...</td></tr>';
        saveBtn.disabled = true;

        try {
            const resp = await fetch(`${API_BASE}/api/docente/curso/${asistenciaCursoActual.id}/asistencia/dias`);
            if (!resp.ok) throw new Error('No se pudieron cargar los dias de clase');

            diasClaseActuales = await resp.json();
            if (!diasClaseActuales.length) {
                select.innerHTML = '<option value="">Sin clases programadas</option>';
                tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Este curso no tiene dias de clase programados en el calendario.</td></tr>';
                return;
            }

            const seleccion = elegirDiaClase(diasClaseActuales, fechaHoy());
            select.innerHTML = diasClaseActuales.map(dia => {
                const registrados = Number(dia.registrados || 0);
                const total = Number(dia.totalEstudiantes || 0);
                const resumen = registrados > 0 ? ` - ${registrados}/${total} registrados` : '';
                return `<option value="${escapeHtml(dia.fecha)}">${escapeHtml(formatearDiaClase(dia))}${escapeHtml(resumen)}</option>`;
            }).join('');

            select.value = seleccion.fecha;
            saveBtn.disabled = false;
            await cargarAsistencia();
        } catch (error) {
            console.error(error);
            select.innerHTML = '<option value="">Error al cargar dias</option>';
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red;">No se pudieron cargar los dias de clase.</td></tr>';
        }
    }

    async function cargarAsistencia() {
        if (!asistenciaCursoActual) return;

        const tableBody = document.getElementById('attendance-list-body');
        const fecha = document.getElementById('attendance-class-date').value;
        if (!fecha) return;

        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Cargando asistencia...</td></tr>';

        try {
            const resp = await fetch(`${API_BASE}/api/docente/curso/${asistenciaCursoActual.id}/asistencia?fecha=${fecha}`);
            if (!resp.ok) throw new Error('No se pudo cargar asistencia');
            const data = await resp.json();
            renderizarAsistencia(data.estudiantes || []);
        } catch (error) {
            console.error(error);
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red;">Error al cargar asistencia.</td></tr>';
        }
    }

    function renderizarAsistencia(estudiantes) {
        const tableBody = document.getElementById('attendance-list-body');
        tableBody.innerHTML = '';

        if (!estudiantes.length) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No hay estudiantes en este curso.</td></tr>';
            return;
        }

        estudiantes.forEach(est => {
            const nombre = `${est.nombres || ''} ${est.apellidos || ''}`.trim();
            const iniciales = nombre.split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'E';
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>
                    <div class="attendance-student">
                        <div class="attendance-avatar">${escapeHtml(iniciales)}</div>
                        <strong>${escapeHtml(nombre)}</strong>
                    </div>
                </td>
                <td>${escapeHtml(est.email || '')}</td>
                <td>
                    <select class="attendance-select" data-student-id="${est.estudianteId}">
                        <option value="PRESENTE">Presente</option>
                        <option value="TARDE">Tarde</option>
                        <option value="AUSENTE">Ausente</option>
                        <option value="JUSTIFICADO">Justificado</option>
                    </select>
                    ${est.registrado ? '<span class="attendance-save-state">Registrado</span>' : ''}
                </td>
            `;

            row.querySelector('select').value = est.estado || 'PRESENTE';
            tableBody.appendChild(row);
        });
    }

    async function guardarAsistencia() {
        if (!asistenciaCursoActual) return;

        const fecha = document.getElementById('attendance-class-date').value;
        if (!fecha) return;

        const saveBtn = document.getElementById('save-attendance');
        const registros = Array.from(document.querySelectorAll('#attendance-list-body .attendance-select')).map(select => ({
            estudianteId: Number(select.dataset.studentId),
            estado: select.value
        }));

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ph ph-spinner"></i> Guardando...';

        try {
            const resp = await fetch(`${API_BASE}/api/docente/curso/${asistenciaCursoActual.id}/asistencia?fecha=${fecha}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registros)
            });

            if (!resp.ok) throw new Error('No se pudo guardar asistencia');
            await cargarAsistencia();
            saveBtn.innerHTML = '<i class="ph ph-check"></i> Guardado';
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar asistencia';
                saveBtn.disabled = false;
            }, 1000);
        } catch (error) {
            console.error(error);
            alert('No se pudo guardar la asistencia.');
            saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar asistencia';
            saveBtn.disabled = false;
        }
    }

    document.getElementById('attendance-class-date')?.addEventListener('change', cargarAsistencia);
    document.getElementById('mark-all-present')?.addEventListener('click', () => {
        document.querySelectorAll('#attendance-list-body .attendance-select').forEach(select => {
            select.value = 'PRESENTE';
        });
    });
    document.getElementById('save-attendance')?.addEventListener('click', guardarAsistencia);

    window.closeModal = function() {
        document.getElementById('students-modal').classList.remove('active');
    };

    window.closeAttendanceModal = function() {
        document.getElementById('attendance-modal').classList.remove('active');
    };

    function fechaHoy() {
        return new Date().toISOString().slice(0, 10);
    }

    function elegirDiaClase(dias, hoy) {
        return dias.find(dia => dia.fecha === hoy)
            || dias.find(dia => dia.fecha > hoy)
            || dias[dias.length - 1];
    }

    function formatearDiaClase(dia) {
        const fecha = new Date(`${dia.fecha}T00:00:00`);
        const textoFecha = Number.isNaN(fecha.getTime())
            ? dia.fecha
            : fecha.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
        return `${textoFecha} ${dia.hora || ''}`.trim();
    }

    function limpiarTexto(texto) {
        let valor = String(texto || '');
        for (let i = 0; i < 3 && /[\u00C3\u00C2]/.test(valor); i++) {
            try {
                const decodificado = decodeURIComponent(escape(valor));
                if (decodificado === valor) break;
                valor = decodificado;
            } catch (error) {
                break;
            }
        }
        return valor;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    cargarMisClases();
});
