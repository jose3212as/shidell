import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

const TIPO_LABELS = {
    EXAMEN: 'Examen',
    PRACTICA: 'Práctica',
    ACTIVIDAD: 'Actividad',
    PARTICIPACION: 'Participación',
    TAREA: 'Tarea'
};

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getQueryParams() {
    const hash = window.location.hash || '';
    const idx = hash.indexOf('?');
    if (idx === -1) return { curso: null, evalId: null };
    const params = new URLSearchParams(hash.slice(idx + 1));
    return {
        curso: params.get('curso'),
        evalId: params.get('eval')
    };
}

export const CalificacionesView = {
    async render() {
        return `
            <div class="content-header grades-header">
                <div>
                    <h2>Registro de Calificaciones</h2>
                    <p>Crea evaluaciones o exámenes para el curso y registra notas en bloque directamente sobre la tabla.</p>
                </div>
            </div>

            <!-- Panel de Controles -->
            <div class="filters-panel grades-toolbar">
                <div class="grades-toolbar-left">
                    <div class="filters-search-box" style="padding: 8px 15px; max-width: 320px;">
                        <i class="ph ph-magnifying-glass filters-search-icon"></i>
                        <input type="text" id="search-grades-student" class="filters-search-input" placeholder="Buscar estudiante por nombre...">
                    </div>
                    
                    <div class="filter-group">
                        <label class="filter-label"><i class="ph ph-books"></i> Curso:</label>
                        <select id="grades-curso-select" class="filter-select" style="padding: 8px 15px; min-width: 260px;">
                            <option value="" disabled selected>Elige un curso para ver el registro</option>
                        </select>
                    </div>
                </div>
                
                <button type="button" class="btn-primary grades-primary-btn" id="btn-nueva-evaluacion">
                    <i class="ph ph-plus-circle" style="font-size:18px;"></i> Nueva Evaluación
                </button>
            </div>

            <!-- Contenedor Principal (Tabla) -->
            <div class="grades-main-container" id="grades-container">
                <div class="kanban-empty" style="border: none;">
                    <i class="ph ph-table" style="font-size: 48px; color: var(--border-color); margin-bottom:10px; display:block;"></i>
                    Selecciona un curso arriba para visualizar o registrar calificaciones.
                </div>
            </div>

            <!-- Modal Calificar Entrega (Tareas con archivo) -->
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
                        <button class="modal-close" id="close-modal-entrega" type="button"><i class="ph ph-x"></i></button>
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
        this.currentEvaluaciones = [];
        this.currentCalificaciones = [];
        this.currentTareas = [];
        this.currentEntregas = [];
        this.selectedCursoId = null;
        this.colFilter = 'ALL';       // ALL | EVALUACIONES | TAREAS
        this.bimestreFilter = 'ALL';  // ALL | 1 | 2 | 3 | 4
        this.editingColumn = null;
        this.initialDraftNotas = new Map();
        this.draftNotas = new Map();
        this.pendingFocusEstId = null;

        try {
            await this.loadCursos();
            this.setupEvents();

            const { curso: queryCursoId, evalId: queryEvalId } = getQueryParams();
            if (queryCursoId && this.cursos.some(c => String(c.id) === String(queryCursoId))) {
                const select = document.getElementById('grades-curso-select');
                select.value = queryCursoId;
                await this.onCourseSelected(queryCursoId);
                if (queryEvalId) {
                    await this.iniciarEdicionColumna(`eval-${queryEvalId}`, null);
                    window.history.replaceState(null, '', `#/calificaciones?curso=${encodeURIComponent(queryCursoId)}`);
                }
            }
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

    async onCourseSelected(cursoId) {
        this.selectedCursoId = cursoId;
        this.cancelColumnEditSilent();
        if (!cursoId) return;

        document.getElementById('search-grades-student').value = '';
        await this.loadGradesForCourse();
    },

    setupEvents() {
        const select = document.getElementById('grades-curso-select');
        select.addEventListener('change', async (e) => {
            await this.onCourseSelected(e.target.value);
        });

        document.getElementById('search-grades-student').addEventListener('input', () => {
            this.renderGradesTable();
        });

        // Página dedicada Nueva Evaluación
        document.getElementById('btn-nueva-evaluacion').addEventListener('click', () => {
            this.irANuevaEvaluacion();
        });

        // Modal Entrega
        const modalEntrega = document.getElementById('modal-calificar-entrega');
        document.getElementById('close-modal-entrega').addEventListener('click', () => modalEntrega.classList.remove('active'));
        document.getElementById('btn-cancel-entrega').addEventListener('click', () => modalEntrega.classList.remove('active'));

        document.getElementById('form-calificar-entrega').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.guardarNotaEntrega();
        });

        // Delegación en el contenedor de la tabla
        const container = document.getElementById('grades-container');
        container.addEventListener('click', async (e) => {
            if (e.target.closest('#btn-onboarding-eval')) {
                this.irANuevaEvaluacion();
                return;
            }

            const tabBtn = e.target.closest('.grades-tab-btn');
            if (tabBtn) {
                this.colFilter = tabBtn.dataset.colFilter || 'ALL';
                this.renderGradesTable();
                return;
            }

            const editColBtn = e.target.closest('[data-action="edit-col"]');
            if (editColBtn) {
                await this.iniciarEdicionColumna(editColBtn.dataset.colKey, null);
                return;
            }

            const editCellBtn = e.target.closest('[data-action="edit-cell"]');
            if (editCellBtn) {
                await this.iniciarEdicionColumna(editCellBtn.dataset.colKey, editCellBtn.dataset.estId);
                return;
            }

            const delEvalBtn = e.target.closest('[data-action="delete-eval"]');
            if (delEvalBtn) {
                await this.confirmarEliminarEvaluacion(delEvalBtn.dataset.evalId, delEvalBtn.dataset.evalTitle);
                return;
            }

            if (e.target.closest('#btn-cancel-col-edit')) {
                this.cancelColumnEditSilent();
                this.renderGradesTable();
                return;
            }

            if (e.target.closest('#btn-save-col-edit')) {
                await this.guardarEdicionColumna();
                return;
            }

            const btnEntrega = e.target.closest('.btn-calificar-entrega');
            if (btnEntrega) {
                this.abrirModalEntrega(btnEntrega.dataset.id);
                return;
            }

            const btnManual = e.target.closest('.btn-calificar-manual-rapido');
            if (btnManual) {
                await this.calificarTareaManualRapido(
                    btnManual.dataset.estudiante,
                    btnManual.dataset.estudianteNombre,
                    btnManual.dataset.actividad
                );
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'grades-bimestre-select') {
                this.bimestreFilter = e.target.value || 'ALL';
                this.renderGradesTable();
            }
        });

        container.addEventListener('input', (e) => {
            if (e.target && e.target.classList.contains('grade-inline-input')) {
                const input = e.target;
                const estId = String(input.dataset.estudianteId);
                this.draftNotas.set(estId, input.value);
                const max = this.editingColumn?.notaMaxima ?? 20;
                const num = parseFloat(input.value);
                const valid = input.value.trim() === '' || (!isNaN(num) && num >= 0 && num <= max);
                input.classList.toggle('is-invalid', !valid);
                this.actualizarContadorCambios();
            }
        });

        container.addEventListener('keydown', (e) => {
            if (!e.target || !e.target.classList.contains('grade-inline-input')) return;
            if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const inputs = Array.from(container.querySelectorAll('.grade-inline-input'));
                const idx = inputs.indexOf(e.target);
                if (idx === -1) return;
                const nextIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
                if (nextIdx >= 0 && nextIdx < inputs.length) {
                    inputs[nextIdx].focus();
                    inputs[nextIdx].select();
                } else if (e.key === 'Enter') {
                    document.getElementById('btn-save-col-edit')?.focus();
                }
            }
        });
    },

    irANuevaEvaluacion() {
        const go = () => {
            const query = this.selectedCursoId ? `?curso=${encodeURIComponent(this.selectedCursoId)}` : '';
            window.location.hash = `#/crear-evaluacion${query}`;
        };
        if (this.hasUnsavedChanges()) {
            Swal.fire({
                title: 'Tienes cambios sin guardar',
                text: `¿Descartar los cambios en "${this.editingColumn.titulo}" para crear una nueva evaluación?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Descartar y continuar',
                cancelButtonText: 'Seguir editando'
            }).then(res => {
                if (res.isConfirmed) go();
            });
            return;
        }
        go();
    },

    async confirmarEliminarEvaluacion(evaluacionId, titulo) {
        const result = await Swal.fire({
            title: '¿Eliminar evaluación?',
            text: `Se eliminará "${titulo}" y todas sus notas registradas en este curso.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!result.isConfirmed) return;

        try {
            await API.fetch(`/api/docente/evaluaciones/${evaluacionId}`, { method: 'DELETE' });
            if (this.editingColumn?.evaluacionId && String(this.editingColumn.evaluacionId) === String(evaluacionId)) {
                this.cancelColumnEditSilent();
            }
            await this.loadGradesForCourse();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', error.message || 'No se pudo eliminar la evaluación.', 'error');
        }
    },

    async loadGradesForCourse() {
        const container = document.getElementById('grades-container');
        container.innerHTML = '<div class="loading-container"><i class="ph ph-spinner ph-spin loading-spinner"></i><p>Cargando registro, evaluaciones y tareas...</p></div>';

        try {
            const [estudiantes, evaluaciones, calificaciones, tareas] = await Promise.all([
                API.fetch(`/api/docente/curso/${this.selectedCursoId}/estudiantes`),
                API.fetch(`/api/docente/curso/${this.selectedCursoId}/evaluaciones`),
                API.fetch(`/api/docente/curso/${this.selectedCursoId}/calificaciones`),
                API.fetch(`/api/docente/curso/${this.selectedCursoId}/tareas`)
            ]);

            this.currentEstudiantes = estudiantes || [];
            this.currentEvaluaciones = evaluaciones || [];
            this.currentCalificaciones = calificaciones || [];
            this.currentTareas = tareas || [];

            const resultadosEntregas = await Promise.all(
                this.currentTareas.map(t => API.fetch(`/api/entregas/tarea/${t.id}`))
            );
            this.currentEntregas = resultadosEntregas.flat();

            this.renderGradesTable();
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="kanban-empty" style="color:var(--red); border:none;">Error al cargar los datos del curso.</div>';
        }
    },

    buildAllColumns() {
        const cols = [];
        const evalTitulosNorm = new Set();
        const tareaTitulosNorm = new Set();

        this.currentEvaluaciones.forEach(ev => {
            evalTitulosNorm.add((ev.titulo || '').trim().toLowerCase());
            cols.push({
                kind: 'EVALUACION',
                key: `eval-${ev.id}`,
                evaluacionId: ev.id,
                titulo: ev.titulo,
                tipo: ev.tipo || 'EXAMEN',
                bimestre: ev.bimestre || 1,
                peso: ev.peso || 1,
                notaMaxima: ev.notaMaxima || 20,
                fecha: ev.fecha
            });
        });

        this.currentTareas.forEach(t => {
            tareaTitulosNorm.add((t.titulo || '').trim().toLowerCase());
            cols.push({
                kind: 'TAREA',
                key: `tarea-${t.id}`,
                tarea: t,
                titulo: t.titulo,
                tipo: 'TAREA',
                bimestre: null,
                peso: 1,
                notaMaxima: 20,
                fecha: t.fechaVencimiento
            });
        });

        const legacyMap = new Map();
        this.currentCalificaciones.forEach(c => {
            if (c.evaluacionId) return;
            const act = (c.actividad || '').trim();
            const actNorm = act.toLowerCase();
            if (!act || evalTitulosNorm.has(actNorm) || tareaTitulosNorm.has(actNorm)) return;
            if (!legacyMap.has(actNorm)) legacyMap.set(actNorm, act);
        });

        legacyMap.forEach((act) => {
            cols.push({
                kind: 'LEGACY',
                key: `legacy-${act}`,
                evaluacionId: null,
                titulo: act,
                tipo: 'ACTIVIDAD',
                bimestre: null,
                peso: 1,
                notaMaxima: 20,
                fecha: null
            });
        });

        return cols;
    },

    getVisibleColumns(allCols) {
        return allCols.filter(col => {
            if (this.colFilter === 'EVALUACIONES' && col.kind === 'TAREA') return false;
            if (this.colFilter === 'TAREAS' && col.kind !== 'TAREA') return false;
            if (this.bimestreFilter !== 'ALL' && col.kind === 'EVALUACION') {
                return String(col.bimestre) === String(this.bimestreFilter);
            }
            return true;
        });
    },

    findCalificacionForStudent(estId, col) {
        if (col.kind === 'EVALUACION') {
            return this.currentCalificaciones.find(c =>
                c.estudiante && c.estudiante.id === estId &&
                (c.evaluacionId === col.evaluacionId ||
                    (c.actividad || '').trim().toLowerCase() === (col.titulo || '').trim().toLowerCase())
            );
        }
        return this.currentCalificaciones.find(c =>
            c.estudiante && c.estudiante.id === estId &&
            (c.actividad || '').trim().toLowerCase() === (col.titulo || '').trim().toLowerCase()
        );
    },

    hasUnsavedChanges() {
        if (!this.editingColumn) return false;
        for (const [k, v] of this.draftNotas.entries()) {
            if ((this.initialDraftNotas.get(k) ?? '') !== (v ?? '')) return true;
        }
        return false;
    },

    cancelColumnEditSilent() {
        this.editingColumn = null;
        this.initialDraftNotas.clear();
        this.draftNotas.clear();
        this.pendingFocusEstId = null;
    },

    async iniciarEdicionColumna(colKey, focusEstId) {
        if (this.editingColumn && this.editingColumn.key !== colKey && this.hasUnsavedChanges()) {
            const res = await Swal.fire({
                title: 'Tienes cambios sin guardar',
                text: `¿Descartar los cambios en "${this.editingColumn.titulo}" para editar otra columna?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Descartar y cambiar',
                cancelButtonText: 'Seguir editando'
            });
            if (!res.isConfirmed) return;
        }

        const allCols = this.buildAllColumns();
        const col = allCols.find(c => c.key === colKey);
        if (!col || col.kind === 'TAREA') return;

        this.editingColumn = col;
        this.initialDraftNotas.clear();
        this.draftNotas.clear();

        this.currentEstudiantes.forEach(est => {
            const existing = this.findCalificacionForStudent(est.id, col);
            const val = existing && existing.nota !== null && existing.nota !== undefined ? String(existing.nota) : '';
            this.initialDraftNotas.set(String(est.id), val);
            this.draftNotas.set(String(est.id), val);
        });

        this.pendingFocusEstId = focusEstId ? String(focusEstId) : null;
        this.renderGradesTable();
    },

    actualizarContadorCambios() {
        const el = document.getElementById('grades-dirty-count');
        if (!el) return;
        let changed = 0;
        for (const [k, v] of this.draftNotas.entries()) {
            if ((this.initialDraftNotas.get(k) ?? '') !== (v ?? '')) changed++;
        }
        el.textContent = changed > 0 ? `${changed} ${changed === 1 ? 'cambio' : 'cambios'} sin guardar` : '';
    },

    async guardarEdicionColumna() {
        if (!this.editingColumn) return;
        const max = this.editingColumn.notaMaxima || 20;
        const notasPayload = [];

        for (const est of this.currentEstudiantes) {
            const raw = (this.draftNotas.get(String(est.id)) ?? '').trim();
            if (raw !== '') {
                const parsed = parseFloat(raw);
                if (isNaN(parsed) || parsed < 0 || parsed > max) {
                    Swal.fire('Nota fuera de rango', `La nota para ${est.apellidos}, ${est.nombres} debe estar entre 0 y ${max}.`, 'warning');
                    return;
                }
                notasPayload.push({ estudianteId: est.id, nota: parsed });
            } else if ((this.initialDraftNotas.get(String(est.id)) ?? '') !== '') {
                notasPayload.push({ estudianteId: est.id, nota: null });
            }
        }

        const btn = document.getElementById('btn-save-col-edit');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
        }

        try {
            const res = await API.fetch(`/api/docente/curso/${this.selectedCursoId}/calificaciones/lote`, {
                method: 'POST',
                body: JSON.stringify({
                    evaluacionId: this.editingColumn.evaluacionId,
                    actividad: this.editingColumn.titulo,
                    notas: notasPayload
                })
            });

            if (Array.isArray(res.calificaciones)) {
                this.currentCalificaciones = res.calificaciones;
            } else {
                this.currentCalificaciones = await API.fetch(`/api/docente/curso/${this.selectedCursoId}/calificaciones`);
            }

            const tituloGuardado = this.editingColumn.titulo;
            this.cancelColumnEditSilent();
            this.renderGradesTable();

            const resumen = [];
            if (res.guardadas) resumen.push(`${res.guardadas} registradas`);
            if (res.actualizadas) resumen.push(`${res.actualizadas} actualizadas`);
            if (res.eliminadas) resumen.push(`${res.eliminadas} borradas`);
            Swal.fire({
                icon: 'success',
                title: 'Planilla guardada',
                text: `${tituloGuardado}: ${resumen.length ? resumen.join(' · ') : 'sin cambios pendientes'}.`,
                timer: 1900,
                showConfirmButton: false
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', error.message || 'No se pudieron guardar las calificaciones.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar notas';
            }
        }
    },

    async calificarTareaManualRapido(estudianteId, estudianteNombre, actividad) {
        const result = await Swal.fire({
            title: `Nota para ${actividad}`,
            input: 'number',
            inputLabel: `${estudianteNombre} (0 - 20)`,
            inputValue: 0,
            inputAttributes: { min: 0, max: 20, step: 0.5 },
            showCancelButton: true,
            confirmButtonText: 'Guardar nota',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (value === '' || value === null) return 'Ingresa una nota válida';
                const num = parseFloat(value);
                if (isNaN(num) || num < 0 || num > 20) return 'La nota debe estar entre 0 y 20';
                return undefined;
            }
        });

        if (!result.isConfirmed) return;

        try {
            const res = await API.fetch(`/api/docente/curso/${this.selectedCursoId}/calificaciones/lote`, {
                method: 'POST',
                body: JSON.stringify({
                    actividad,
                    notas: [{ estudianteId: Number(estudianteId), nota: parseFloat(result.value) }]
                })
            });
            if (Array.isArray(res.calificaciones)) {
                this.currentCalificaciones = res.calificaciones;
            } else {
                await this.loadGradesForCourse();
                return;
            }
            this.renderGradesTable();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', error.message || 'No se pudo guardar la nota.', 'error');
        }
    },

    computeStudentAverage(estId, allCols) {
        let sumaPonderada = 0;
        let sumaPeso = 0;

        allCols.forEach(col => {
            if (col.kind === 'TAREA') {
                const entrega = this.currentEntregas.find(e => e.tarea && e.tarea.id === col.tarea.id && e.estudiante && e.estudiante.id === estId);
                const notaManual = this.findCalificacionForStudent(estId, col);
                const rawVal = (entrega && entrega.nota !== null && entrega.nota !== undefined)
                    ? entrega.nota
                    : (notaManual && notaManual.nota !== null && notaManual.nota !== undefined ? notaManual.nota : null);
                if (rawVal !== null) {
                    sumaPonderada += rawVal;
                    sumaPeso += 1;
                }
            } else {
                const notaObj = this.findCalificacionForStudent(estId, col);
                if (notaObj && notaObj.nota !== null && notaObj.nota !== undefined) {
                    const max = col.notaMaxima || 20;
                    const sobre20 = (notaObj.nota / max) * 20;
                    const peso = col.peso || 1;
                    sumaPonderada += sobre20 * peso;
                    sumaPeso += peso;
                }
            }
        });

        return sumaPeso > 0 ? { value: (sumaPonderada / sumaPeso).toFixed(1), hasGrades: true } : { value: '0.0', hasGrades: false };
    },

    renderGradesTable() {
        const container = document.getElementById('grades-container');
        const searchTerm = document.getElementById('search-grades-student').value.toLowerCase();

        if (this.currentEstudiantes.length === 0) {
            container.innerHTML = '<div class="kanban-empty" style="border:none;">No hay estudiantes matriculados en este curso.</div>';
            return;
        }

        let filteredStudents = [...this.currentEstudiantes];
        if (searchTerm) {
            filteredStudents = filteredStudents.filter(est =>
                `${est.nombres} ${est.apellidos}`.toLowerCase().includes(searchTerm) ||
                `${est.apellidos} ${est.nombres}`.toLowerCase().includes(searchTerm)
            );
        }
        filteredStudents.sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || ''));

        const allCols = this.buildAllColumns();
        const visibleCols = this.getVisibleColumns(allCols);

        const evalCount = this.currentEvaluaciones.length;
        const tareasCount = this.currentTareas.length;

        let html = `
            <div class="grades-subfilters">
                <div class="grades-filter-tabs">
                    <button type="button" class="grades-tab-btn ${this.colFilter === 'ALL' ? 'active' : ''}" data-col-filter="ALL">Todas (${allCols.length})</button>
                    <button type="button" class="grades-tab-btn ${this.colFilter === 'EVALUACIONES' ? 'active' : ''}" data-col-filter="EVALUACIONES">Exámenes y Evaluaciones (${evalCount})</button>
                    <button type="button" class="grades-tab-btn ${this.colFilter === 'TAREAS' ? 'active' : ''}" data-col-filter="TAREAS">Tareas (${tareasCount})</button>
                </div>
                <div class="grades-subfilters-right">
                    <select id="grades-bimestre-select" class="grades-bimestre-select" title="Filtrar evaluaciones por bimestre">
                        <option value="ALL" ${this.bimestreFilter === 'ALL' ? 'selected' : ''}>Todos los bimestres</option>
                        <option value="1" ${this.bimestreFilter === '1' ? 'selected' : ''}>I Bimestre</option>
                        <option value="2" ${this.bimestreFilter === '2' ? 'selected' : ''}>II Bimestre</option>
                        <option value="3" ${this.bimestreFilter === '3' ? 'selected' : ''}>III Bimestre</option>
                        <option value="4" ${this.bimestreFilter === '4' ? 'selected' : ''}>IV Bimestre</option>
                    </select>
                    <span class="grades-summary-text">${filteredStudents.length} ${filteredStudents.length === 1 ? 'estudiante' : 'estudiantes'}</span>
                </div>
            </div>
        `;

        if (allCols.length === 0) {
            html += `
                <div class="grades-onboarding-banner">
                    <div class="grades-onboarding-copy">
                        <h4><i class="ph-fill ph-sparkle"></i> Crea tu primera evaluación para empezar a calificar</h4>
                        <p>Para exámenes o prácticas presenciales crea la columna aquí y llena todas las notas en bloque. Si el alumno debe subir un archivo, créala como tarea.</p>
                    </div>
                    <div class="grades-onboarding-actions">
                        <button type="button" class="btn-primary grades-primary-btn" id="btn-onboarding-eval">
                            <i class="ph ph-plus-circle"></i> Crear Examen / Evaluación
                        </button>
                        <a href="#/tareas" class="grades-link-btn"><i class="ph ph-notebook"></i> Ir a Tareas</a>
                    </div>
                </div>
            `;
        }

        if (this.editingColumn) {
            html += `
                <div class="grades-edit-bar">
                    <div class="grades-edit-bar-info">
                        <i class="ph-fill ph-exam"></i>
                        <div>
                            Editando planilla: <strong>${escapeHtml(this.editingColumn.titulo)}</strong>
                            <span class="grades-edit-hint">· Escala 0–${this.editingColumn.notaMaxima || 20} · Usa Enter o ↓ para bajar rápido</span>
                        </div>
                    </div>
                    <div class="grades-edit-bar-actions">
                        <span id="grades-dirty-count" class="grades-dirty-pill"></span>
                        <button type="button" class="btn-edit-secondary" id="btn-cancel-col-edit">Cancelar</button>
                        <button type="button" class="btn-edit-primary" id="btn-save-col-edit"><i class="ph ph-floppy-disk"></i> Guardar notas</button>
                    </div>
                </div>
            `;
        }

        if (filteredStudents.length === 0) {
            html += `<div class="kanban-empty" style="border:none;">No se encontraron estudiantes con ese nombre.</div>`;
            container.innerHTML = html;
            return;
        }

        html += `
            <div class="grades-table-wrapper">
                <table class="grades-table">
                    <thead>
                        <tr>
                            <th class="col-student">Estudiante</th>
                            ${visibleCols.map(col => this.renderColumnHeader(col)).join('')}
                            <th>Promedio Final</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filteredStudents.forEach(est => {
            const iniciales = ((est.nombres || '').charAt(0) + (est.apellidos || '').charAt(0)).toUpperCase();
            html += `
                <tr>
                    <td class="col-student">
                        <div class="student-mini-avatar">${escapeHtml(iniciales)}</div>
                        <div class="student-name-block">
                            <a href="#/estudiante-perfil?id=${encodeURIComponent(est.id)}&curso=${encodeURIComponent(this.selectedCursoId)}&from=calificaciones" style="color:inherit; text-decoration:none; font-weight:700;">
                                ${escapeHtml(est.apellidos)}, ${escapeHtml(est.nombres)}
                            </a>
                            <span>${escapeHtml(est.email)}</span>
                        </div>
                    </td>
            `;

            visibleCols.forEach(col => {
                html += this.renderStudentCell(est, col);
            });

            const avg = this.computeStudentAverage(est.id, allCols);
            const promClase = parseFloat(avg.value) >= 11 ? 'aprobado' : (avg.hasGrades ? 'desaprobado' : 'empty');
            html += `<td><span class="grade-badge ${promClase}" style="font-size:15px; font-weight:800; padding:6px 14px;">${avg.value}</span></td>`;
            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
        this.actualizarContadorCambios();

        if (this.editingColumn) {
            const selector = this.pendingFocusEstId
                ? `.grade-inline-input[data-estudiante-id="${this.pendingFocusEstId}"]`
                : '.grade-inline-input';
            const targetInput = container.querySelector(selector);
            if (targetInput) {
                targetInput.focus();
                targetInput.select();
            }
            this.pendingFocusEstId = null;
        }
    },

    renderColumnHeader(col) {
        const isEditing = this.editingColumn && this.editingColumn.key === col.key;
        if (col.kind === 'TAREA') {
            return `
                <th class="grade-col-header grade-task-col">
                    <div class="grade-th-top">
                        <span class="grade-type-pill type-tarea">Tarea</span>
                    </div>
                    <div class="grade-th-title" title="${escapeHtml(col.titulo)}">${escapeHtml(col.titulo)}</div>
                    ${col.fecha ? `<div class="grade-th-sub">Vence: ${escapeHtml(col.fecha)}</div>` : ''}
                </th>
            `;
        }

        const tipoKey = (col.tipo || 'ACTIVIDAD').toLowerCase();
        const tipoLabel = col.kind === 'LEGACY' ? 'Manual' : (TIPO_LABELS[col.tipo] || 'Actividad');

        return `
            <th class="grade-col-header ${isEditing ? 'is-editing' : ''}">
                <div class="grade-th-top">
                    <span class="grade-type-pill type-${escapeHtml(tipoKey)}">${escapeHtml(tipoLabel)}</span>
                    ${col.bimestre ? `<span class="grade-meta-chip">B${col.bimestre}</span>` : ''}
                    ${col.peso > 1 ? `<span class="grade-meta-chip weight">×${col.peso}</span>` : ''}
                </div>
                <div class="grade-th-title" title="${escapeHtml(col.titulo)}">${escapeHtml(col.titulo)}</div>
                <div class="grade-th-actions">
                    <button type="button" class="btn-col-grade ${isEditing ? 'active' : ''}" data-action="edit-col" data-col-key="${escapeHtml(col.key)}">
                        <i class="ph ${isEditing ? 'ph-pencil-simple-line' : 'ph-pencil-simple'}"></i>
                        ${isEditing ? 'Editando' : 'Calificar'}
                    </button>
                    ${col.kind === 'EVALUACION' ? `
                        <button type="button" class="btn-col-delete" data-action="delete-eval" data-eval-id="${col.evaluacionId}" data-eval-title="${escapeHtml(col.titulo)}" title="Eliminar evaluación">
                            <i class="ph ph-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </th>
        `;
    },

    renderStudentCell(est, col) {
        if (col.kind === 'TAREA') {
            const tarea = col.tarea;
            const entrega = this.currentEntregas.find(e => e.tarea && e.tarea.id === tarea.id && e.estudiante && e.estudiante.id === est.id);
            const notaManual = this.findCalificacionForStudent(est.id, col);

            if (entrega && entrega.nota !== null && entrega.nota !== undefined) {
                const val = entrega.nota;
                const clase = val >= 11 ? 'aprobado' : 'desaprobado';
                return `<td>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <span class="grade-badge ${clase}">${val}</span>
                        <button type="button" class="btn-calificar-entrega" data-id="${entrega.id}" title="Ver/Editar Archivo" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:12px;text-decoration:underline;">Ver Archivo</button>
                    </div>
                </td>`;
            }
            if (notaManual && notaManual.nota !== null && notaManual.nota !== undefined) {
                const val = notaManual.nota;
                const clase = val >= 11 ? 'aprobado' : 'desaprobado';
                return `<td>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <span class="grade-badge ${clase}">${val}</span>
                        <span class="grade-manual-note">(Nota Manual)</span>
                    </div>
                </td>`;
            }
            if (entrega) {
                return `<td>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <span class="grade-badge pending">Por Evaluar</span>
                        <button type="button" class="btn-calificar-entrega btn-primary" data-id="${entrega.id}" style="padding:4px 10px; font-size:11px; border-radius:6px; border:none; cursor:pointer;">Calificar</button>
                    </div>
                </td>`;
            }
            const isExpired = tarea.fechaVencimiento && new Date(tarea.fechaVencimiento) < new Date();
            if (isExpired) {
                const nombreEst = `${est.apellidos}, ${est.nombres}`;
                return `<td>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <span class="grade-badge empty" style="font-size:10px;">Vencido</span>
                        <button type="button" class="btn-calificar-manual-rapido grade-quick-zero" data-estudiante="${est.id}" data-estudiante-nombre="${escapeHtml(nombreEst)}" data-actividad="${escapeHtml(tarea.titulo)}">Poner nota</button>
                    </div>
                </td>`;
            }
            return `<td><span class="grade-badge empty" style="font-size:10px;">Aún a tiempo</span></td>`;
        }

        const isEditing = this.editingColumn && this.editingColumn.key === col.key;
        if (isEditing) {
            const draftVal = this.draftNotas.get(String(est.id)) ?? '';
            return `
                <td class="grade-edit-cell">
                    <input type="number"
                        class="grade-inline-input"
                        data-estudiante-id="${est.id}"
                        min="0"
                        max="${col.notaMaxima || 20}"
                        step="0.5"
                        value="${escapeHtml(draftVal)}"
                        placeholder="—">
                </td>
            `;
        }

        const notaObj = this.findCalificacionForStudent(est.id, col);
        if (notaObj && notaObj.nota !== null && notaObj.nota !== undefined) {
            const val = notaObj.nota;
            const clase = val >= 11 ? 'aprobado' : 'desaprobado';
            return `
                <td>
                    <button type="button" class="grade-cell-btn" data-action="edit-cell" data-col-key="${escapeHtml(col.key)}" data-est-id="${est.id}" title="Clic para editar nota">
                        <span class="grade-badge ${clase}">${val}</span>
                    </button>
                </td>
            `;
        }

        return `
            <td>
                <button type="button" class="grade-cell-btn" data-action="edit-cell" data-col-key="${escapeHtml(col.key)}" data-est-id="${est.id}" title="Clic para asignar nota">
                    <span class="grade-badge empty">—</span>
                </button>
            </td>
        `;
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
        const entregaId = document.getElementById('ce-entrega-id').value;
        const notaRaw = document.getElementById('ce-nota').value;
        const notaNum = Number(notaRaw);
        const comentario = document.getElementById('ce-comentario').value;

        if (notaRaw === '' || Number.isNaN(notaNum) || notaNum < 0 || notaNum > 20) {
            Swal.fire('Nota inválida', 'Ingresa una calificación entre 0 y 20.', 'warning');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Calificando...';

        try {
            const url = `/api/entregas/${entregaId}/calificar?nota=${encodeURIComponent(notaNum)}&comentario=${encodeURIComponent(comentario)}`;
            await API.fetch(url, { method: 'PUT' });

            document.getElementById('modal-calificar-entrega').classList.remove('active');
            Swal.fire('¡Éxito!', 'Tarea calificada y sincronizada con el registro de notas.', 'success');
            await this.loadGradesForCourse();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', error?.message || 'No se pudo guardar la calificación de la tarea.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-check-circle"></i> Calificar';
        }
    }
};
