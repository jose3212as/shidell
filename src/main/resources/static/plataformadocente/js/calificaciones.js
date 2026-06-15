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
    const API_BASE = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '' : 'http://localhost:8080';
    const defaultTeacherEmail = 'profesor@shidell.edu';
    const $ = (id) => document.getElementById(id);

    const courseSelector = $('course-selector');
    const evaluationType = $('evaluation-type');
    const tasksOptGroup = $('tasks-optgroup');
    const manualContainer = $('manual-activity-container');
    const activityInput = $('activity-name');
    const gradingTable = $('grading-table');
    const noCourseMsg = $('no-course-msg');
    const tbody = $('grading-table-body');
    const saveBtn = $('btn-save-grades');
    const statusEl = $('server-status');

    const state = {
        docente: null,
        cursos: [],
        estudiantes: [],
        calificacionesPorEstudiante: new Map(),
        selectedCourse: null
    };

    $('btn-logout')?.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('shidell_user');
        location.href = '../login.html';
    });

    $('btn-focus-grades')?.addEventListener('click', () => {
        $('grades-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        courseSelector?.focus();
    });

    courseSelector.addEventListener('change', cargarCursoSeleccionado);
    evaluationType.addEventListener('change', onEvaluationChange);
    saveBtn.addEventListener('click', guardarCalificaciones);

    inicializar();

    async function inicializar() {
        setStatus('Conectando...');
        try {
            const docente = await api(`/api/docente/buscar?email=${encodeURIComponent(getTeacherEmail())}`);
            if (!docente?.id || docente.rol?.toUpperCase() !== 'DOCENTE') throw new Error('No se encontró una cuenta docente válida.');
            state.docente = docente;
            renderTeacher(docente);

            const cursos = await api(`/api/docente/${docente.id}/cursos`);
            state.cursos = deduplicarCursos(Array.isArray(cursos) ? cursos : []);
            renderCourses();
            updateMetrics();
            setStatus(`Conectado como ${nombreCompleto(docente)}`);
        } catch (error) {
            setStatus('Error de conexión');
            noCourseMsg.innerHTML = `<p style="color:var(--red);">${escapeHtml(error.message || 'No se pudo cargar el API del docente.')}</p>`;
        }
    }

    function renderTeacher(docente) {
        const nombre = nombreCompleto(docente);
        $('user-name-label').textContent = nombre;
        $('user-role-label').textContent = docente.rol === 'DOCENTE' ? 'Docente' : (docente.rol || 'Docente');
        $('teacher-context').textContent = `${nombre} · calificaciones sincronizadas con sus cursos`;
        $('grades-title').textContent = `Calificaciones de ${nombre.split(' ')[0] || 'docente'}`;
        renderAvatar($('profile-avatar'), docente);
    }

    function renderCourses() {
        courseSelector.innerHTML = '<option value="">Elige un curso...</option>';
        state.cursos.forEach((curso) => {
            const option = document.createElement('option');
            option.value = curso.id;
            option.textContent = nombreCurso(curso);
            courseSelector.appendChild(option);
        });
    }

    async function cargarCursoSeleccionado() {
        const cursoId = courseSelector.value;
        state.selectedCourse = state.cursos.find((curso) => String(curso.id) === String(cursoId)) || null;
        state.estudiantes = [];
        state.calificacionesPorEstudiante = new Map();
        tbody.innerHTML = '';
        tasksOptGroup.innerHTML = '';
        evaluationType.value = '';
        activityInput.value = '';
        manualContainer.style.display = 'none';

        if (!cursoId) {
            gradingTable.style.display = 'none';
            noCourseMsg.style.display = 'block';
            noCourseMsg.innerHTML = '<i class="ph ph-selection-all" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i><p>Por favor, selecciona un curso para cargar la lista de estudiantes.</p>';
            renderCourseSummary();
            updateMetrics();
            return;
        }

        noCourseMsg.style.display = 'block';
        gradingTable.style.display = 'none';
        noCourseMsg.innerHTML = '<p>Cargando estudiantes y calificaciones desde el API...</p>';

        try {
            await Promise.all([cargarTareasCurso(cursoId), cargarEstudiantesCurso(cursoId)]);
            await cargarCalificacionesEstudiantes();
            renderStudents();
            renderCourseSummary();
            updateMetrics();
        } catch (error) {
            noCourseMsg.innerHTML = `<p style="color:var(--red);">${escapeHtml(error.message || 'Error al cargar estudiantes.')}</p>`;
        }
    }

    async function cargarTareasCurso(cursoId) {
        const tareas = await api(`/api/docente/curso/${cursoId}/tareas`).catch(() => []);
        tasksOptGroup.innerHTML = '';
        (Array.isArray(tareas) ? tareas : []).forEach((tarea) => {
            const option = document.createElement('option');
            option.value = `TAREA_${tarea.id}`;
            option.dataset.activity = tarea.titulo || 'Tarea';
            option.textContent = limpiarTexto(tarea.titulo || 'Tarea');
            tasksOptGroup.appendChild(option);
        });
    }

    async function cargarEstudiantesCurso(cursoId) {
        const estudiantes = await api(`/api/docente/curso/${cursoId}/estudiantes`);
        state.estudiantes = Array.isArray(estudiantes) ? estudiantes : [];
    }

    async function cargarCalificacionesEstudiantes() {
        const results = await Promise.all(state.estudiantes.map(async (estudiante) => {
            const data = await api(`/api/calificaciones/estudiante/${estudiante.id}`).catch(() => ({ evaluaciones: [] }));
            return [estudiante.id, Array.isArray(data.evaluaciones) ? data.evaluaciones : []];
        }));
        state.calificacionesPorEstudiante = new Map(results);
    }

    function renderStudents() {
        tbody.innerHTML = '';
        if (!state.estudiantes.length) {
            noCourseMsg.innerHTML = '<p>No hay estudiantes inscritos en este curso.</p>';
            noCourseMsg.style.display = 'block';
            gradingTable.style.display = 'none';
            return;
        }

        state.estudiantes.forEach((estudiante) => {
            const promedio = promedioCurso(estudiante.id, state.selectedCourse?.id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${escapeHtml(nombreCompleto(estudiante))}</strong></td>
                <td>${escapeHtml(estudiante.email || '')}</td>
                <td><span class="status-pill" style="background:#e2e8f0;">${promedio || '--'}</span></td>
                <td style="text-align: center;">
                    <input type="number" class="grade-input" data-student-id="${estudiante.id}" min="0" max="20" step="0.1" placeholder="--">
                </td>
            `;
            tbody.appendChild(row);
        });

        noCourseMsg.style.display = 'none';
        gradingTable.style.display = 'table';
        populateExistingGrades();
    }

    function onEvaluationChange() {
        const value = evaluationType.value;
        if (value === 'MANUAL') {
            manualContainer.style.display = 'flex';
            activityInput.value = '';
        } else {
            manualContainer.style.display = 'none';
            const selected = evaluationType.options[evaluationType.selectedIndex];
            activityInput.value = value.startsWith('EXAMEN_')
                ? selected.textContent.trim()
                : selected?.dataset?.activity || '';
        }
        populateExistingGrades();
    }

    function populateExistingGrades() {
        const actividad = activityInput.value.trim();
        document.querySelectorAll('.grade-input').forEach((input) => {
            input.value = '';
            if (!actividad) return;
            const studentId = Number(input.dataset.studentId);
            const existing = (state.calificacionesPorEstudiante.get(studentId) || [])
                .find((cal) => String(cal.curso?.id) === String(state.selectedCourse?.id)
                    && normalizar(cal.actividad) === normalizar(actividad));
            if (existing?.nota != null) input.value = existing.nota;
        });
    }

    async function guardarCalificaciones() {
        const cursoId = courseSelector.value;
        const actividad = activityInput.value.trim();
        const inputs = Array.from(document.querySelectorAll('.grade-input'));

        if (!cursoId) return showToast('Selecciona un curso.', true);
        if (!actividad) return showToast('Selecciona o ingresa una evaluación.', true);

        const grades = inputs
            .filter((input) => input.value !== '')
            .map((input) => ({ estudianteId: input.dataset.studentId, nota: Number(input.value) }))
            .filter((grade) => Number.isFinite(grade.nota) && grade.nota >= 0 && grade.nota <= 20);

        if (!grades.length) return showToast('Ingresa al menos una nota válida entre 0 y 20.', true);

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ph ph-circle-notch-bold" style="animation: spin 1s linear infinite;"></i> Guardando...';

        try {
            await Promise.all(grades.map((grade) => {
                const formData = new FormData();
                formData.append('cursoId', cursoId);
                formData.append('estudianteId', grade.estudianteId);
                formData.append('actividad', actividad);
                formData.append('nota', grade.nota);
                return api('/api/docente/calificar', { method: 'POST', body: formData });
            }));

            showToast('Calificaciones guardadas con éxito');
            await cargarCalificacionesEstudiantes();
            renderStudents();
            updateMetrics();
        } catch (error) {
            showToast(error.message || 'Error al guardar calificaciones.', true);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar Calificaciones';
        }
    }

    function renderCourseSummary() {
        const summary = $('course-grade-summary');
        if (!state.selectedCourse) {
            summary.innerHTML = '<span>Curso no seleccionado</span><strong>Elige un curso para ver alumnos, tareas y notas existentes.</strong>';
            return;
        }
        const evals = evaluacionesCurso(state.selectedCourse.id);
        const avg = promedio(evals.map((cal) => Number(cal.nota20 ?? cal.nota)).filter(Number.isFinite));
        summary.innerHTML = `
            <span>${escapeHtml(nombreCurso(state.selectedCourse))}</span>
            <strong>${state.estudiantes.length} estudiantes · ${evals.length} evaluaciones · promedio ${avg || '--'}</strong>
        `;
    }

    function updateMetrics() {
        const evals = state.selectedCourse ? evaluacionesCurso(state.selectedCourse.id) : [];
        const avg = promedio(evals.map((cal) => Number(cal.nota20 ?? cal.nota)).filter(Number.isFinite));
        $('metric-courses').textContent = state.cursos.length;
        $('metric-students').textContent = state.estudiantes.length;
        $('metric-evals').textContent = evals.length;
        $('metric-average').textContent = avg || '--';
    }

    function evaluacionesCurso(cursoId) {
        return Array.from(state.calificacionesPorEstudiante.values())
            .flat()
            .filter((cal) => String(cal.curso?.id) === String(cursoId));
    }

    function promedioCurso(estudianteId, cursoId) {
        const notas = (state.calificacionesPorEstudiante.get(Number(estudianteId)) || [])
            .filter((cal) => String(cal.curso?.id) === String(cursoId))
            .map((cal) => Number(cal.nota20 ?? cal.nota))
            .filter(Number.isFinite);
        return promedio(notas);
    }

    function promedio(values) {
        if (!values.length) return '';
        return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
    }

    async function api(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, options);
        if (!response.ok) {
            if (response.status === 401 || response.status === 404) {
                localStorage.removeItem('shidell_user');
                location.href = '../login.html';
                return null;
            }
            throw new Error(`Error HTTP ${response.status}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    function getTeacherEmail() {
        try {
            const user = JSON.parse(localStorage.getItem('shidell_user') || 'null');
            return user?.rol?.toUpperCase() === 'DOCENTE' && user.email ? user.email : defaultTeacherEmail;
        } catch (error) {
            return defaultTeacherEmail;
        }
    }

    function deduplicarCursos(cursos) {
        const map = new Map();
        cursos.forEach((curso) => {
            const key = [normalizar(curso.nombre), curso.nivel, curso.grado, curso.seccion].join('|');
            if (!map.has(key) || Number(curso.id) < Number(map.get(key).id)) map.set(key, curso);
        });
        return Array.from(map.values()).sort((a, b) => limpiarTexto(a.nombre).localeCompare(limpiarTexto(b.nombre), 'es'));
    }

    function renderAvatar(container, user) {
        if (!container) return;
        const foto = primeraFotoValida(user?.fotoPerfil, user?.foto_perfil);
        container.innerHTML = foto ? `<img src="${escapeHtml(foto)}" alt="Foto de perfil">` : '<i class="ph-fill ph-user-circle" style="font-size: 32px;"></i>';
    }

    function nombreCurso(curso = {}) {
        return [limpiarTexto(curso.nombre || 'Curso'), curso.grado ? `${curso.grado}° ${curso.seccion || ''}`.trim() : ''].filter(Boolean).join(' - ');
    }

    function nombreCompleto(user = {}) {
        return limpiarTexto(`${user.nombres || ''} ${user.apellidos || ''}`).trim() || 'Docente';
    }

    function normalizar(value) {
        return limpiarTexto(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    function limpiarTexto(value) {
        let text = String(value ?? '');
        for (let i = 0; i < 2 && /Ã|Â/.test(text); i++) {
            try {
                const fixed = decodeURIComponent(escape(text));
                if (!fixed || fixed === text) break;
                text = fixed;
            } catch (error) {
                break;
            }
        }
        return text.replace(/Â/g, '');
    }

    function primeraFotoValida(...values) {
        return values.find((value) => typeof value === 'string' && (
            value.startsWith('data:image/') ||
            value.startsWith('/uploads/') ||
            value.startsWith('http://') ||
            value.startsWith('https://')
        )) || '';
    }

    function showToast(message, isError = false) {
        const toast = $('feedback-toast');
        toast.textContent = message;
        toast.style.background = isError ? '#ef4444' : '#22c55e';
        toast.style.display = 'block';
        clearTimeout(showToast.timeout);
        showToast.timeout = setTimeout(() => { toast.style.display = 'none'; }, 3200);
    }

    function setStatus(text) {
        statusEl.textContent = `Estado: ${text}`;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }
});
