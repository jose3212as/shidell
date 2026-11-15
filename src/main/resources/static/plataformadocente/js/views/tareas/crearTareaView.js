import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const TEMPLATES = {
    objetivo: '\nObjetivo de aprendizaje:\n- Comprender y aplicar los conceptos principales trabajados en clase.',
    entregable: '\nFormato de entrega:\n- Resolver los ejercicios propuestos con procedimiento completo en PDF o fotografía legible.',
    criterios: '\nCriterios de evaluación:\n- Procedimiento ordenado y justificado (10 pts)\n- Exactitud en los resultados (6 pts)\n- Puntualidad y presentación (4 pts)'
};

function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toLocalIso(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function addDaysIso(baseIso, days) {
    const [y, m, d] = baseIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    return toLocalIso(dt);
}

function nextMondayIso(baseIso) {
    const [y, m, d] = baseIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay(); // 0=Dom .. 6=Sab
    const delta = dow === 1 ? 7 : ((8 - dow) % 7 || 7);
    dt.setDate(dt.getDate() + delta);
    return toLocalIso(dt);
}

function formatFechaNatural(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Sin fecha seleccionada';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${WEEKDAYS_SHORT[dt.getDay()]} ${String(d).padStart(2, '0')} ${MONTHS_SHORT[m - 1]}, ${y}`;
}

function diffDaysLocal(fromIso, toIso) {
    if (!fromIso || !toIso) return null;
    const [y1, m1, d1] = fromIso.split('-').map(Number);
    const [y2, m2, d2] = toIso.split('-').map(Number);
    const t1 = new Date(y1, m1 - 1, d1).getTime();
    const t2 = new Date(y2, m2 - 1, d2).getTime();
    return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatNivel(nivel) {
    const raw = String(nivel || '').trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
}

function sortCourses(a, b) {
    const niv = String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es');
    if (niv !== 0) return niv;
    const ga = parseInt(a.grado, 10);
    const gb = parseInt(b.grado, 10);
    if (!Number.isNaN(ga) && !Number.isNaN(gb) && ga !== gb) return ga - gb;
    return String(a.seccion || '').localeCompare(String(b.seccion || ''), 'es');
}

export const CrearTareaView = {
    courses: [],
    selectedCourseIds: new Set(),
    editingTarea: null,
    selectedFile: null,
    prioridad: 'Media',
    estado: 'Pendiente',
    isSubmitting: false,
    _keyHandler: null,
    _hashCleanup: null,

    async render() {
        return `
            <div class="ct-page" id="ct-root">
                <header class="ct-topbar">
                    <a href="#/tareas" class="ct-back-link">
                        <i class="ph ph-arrow-left" aria-hidden="true"></i>
                        <span>Volver a Tareas</span>
                    </a>
                    <div class="ct-topbar-right">
                        <span class="ct-breadcrumb" id="ct-breadcrumb">TAREAS / NUEVA ASIGNACIÓN</span>
                        <span class="ct-kbd-hint">Ctrl + Enter para publicar</span>
                    </div>
                </header>

                <form id="ct-form" class="ct-workspace" novalidate>
                    <!-- Columna Principal de Redacción (sin recuadros contenedoras) -->
                    <main class="ct-editor-col">
                        <div class="ct-title-block">
                            <div class="ct-field-top">
                                <span class="ct-mono-label" id="ct-mode-kicker">REDACCIÓN DE ACTIVIDAD ACADÉMICA</span>
                                <span class="ct-char-count" id="ct-title-count">0 / 120</span>
                            </div>
                            <textarea
                                rows="1"
                                id="ct-titulo"
                                class="ct-title-input"
                                maxlength="120"
                                placeholder="Título de la actividad o práctica…"
                                autocomplete="off"
                                required
                            ></textarea>
                        </div>

                        <section class="ct-block">
                            <div class="ct-field-top">
                                <span class="ct-mono-label" id="ct-audience-label">SECCIONES DESTINATARIAS <span class="ct-req">*</span></span>
                                <span class="ct-field-hint" id="ct-audience-summary">Selecciona una o más aulas</span>
                            </div>
                            <div class="ct-sections-wrap" id="ct-sections-wrap">
                                <div class="ct-loading-inline">Cargando secciones asignadas…</div>
                            </div>
                        </section>

                        <section class="ct-block">
                            <div class="ct-field-top ct-desc-head">
                                <span class="ct-mono-label">CONSIGNA E INSTRUCCIONES</span>
                                <div class="ct-scaffolds" aria-label="Insertar estructura">
                                    <button type="button" class="ct-scaffold-btn" data-tpl="objetivo">+ Objetivo</button>
                                    <button type="button" class="ct-scaffold-btn" data-tpl="entregable">+ Formato de entrega</button>
                                    <button type="button" class="ct-scaffold-btn" data-tpl="criterios">+ Criterios</button>
                                    <span class="ct-char-count" id="ct-desc-count">0 / 1000</span>
                                </div>
                            </div>
                            <textarea
                                id="ct-descripcion"
                                class="ct-desc-input"
                                rows="6"
                                maxlength="1000"
                                placeholder="Detalla los ejercicios, lecturas, materiales permitidos y pautas de entrega para tus estudiantes…"
                            ></textarea>
                        </section>

                        <section class="ct-block ct-attach-block" id="ct-attach-block">
                            <div class="ct-field-top">
                                <span class="ct-mono-label">GUÍA O MATERIAL ADJUNTO (OPCIONAL)</span>
                                <span class="ct-field-hint" id="ct-attach-note">PDF, Word o imagen de apoyo</span>
                            </div>

                            <div class="ct-dropzone" id="ct-dropzone" tabindex="0" role="button" aria-label="Adjuntar archivo de guía o ficha">
                                <input type="file" id="ct-archivo" class="ct-file-hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ppt,.pptx">
                                <div class="ct-dropzone-idle" id="ct-dropzone-idle">
                                    <i class="ph ph-paperclip" aria-hidden="true"></i>
                                    <div>
                                        <strong>Arrastra un archivo aquí o examina tu equipo</strong>
                                        <span>Se adjuntará automáticamente para todos los estudiantes de las secciones seleccionadas.</span>
                                    </div>
                                </div>
                                <div class="ct-file-chosen is-hidden" id="ct-file-chosen">
                                    <div class="ct-file-meta">
                                        <i class="ph ph-file-text" aria-hidden="true"></i>
                                        <div>
                                            <span class="ct-file-name" id="ct-file-name"></span>
                                            <span class="ct-file-size" id="ct-file-size"></span>
                                        </div>
                                    </div>
                                    <button type="button" class="ct-text-danger" id="ct-file-remove">Quitar</button>
                                </div>
                            </div>

                            <div class="ct-existing-pdf is-hidden" id="ct-existing-pdf">
                                <i class="ph ph-file-pdf" aria-hidden="true"></i>
                                <span>Archivo actualmente adjunto en la tarea:</span>
                                <a href="#" id="ct-existing-pdf-link" target="_blank" rel="noopener">Ver documento adjunto ↗</a>
                            </div>
                        </section>
                    </main>

                    <!-- Riel Derecho: Programación, Prioridad y Resumen de Envío -->
                    <aside class="ct-meta-col">
                        <section class="ct-rail-section">
                            <span class="ct-mono-label">VENTANA DE ENTREGA</span>

                            <div class="ct-date-pair">
                                <div class="ct-date-row">
                                    <label for="ct-fecha-inicio">Inicio</label>
                                    <input type="date" id="ct-fecha-inicio" class="ct-date-input" required>
                                </div>
                                <div class="ct-date-row">
                                    <label for="ct-fecha-vencimiento">Fecha límite <span class="ct-req">*</span></label>
                                    <input type="date" id="ct-fecha-vencimiento" class="ct-date-input" required>
                                </div>
                            </div>

                            <div class="ct-quick-dates" aria-label="Atajos de fecha">
                                <button type="button" class="ct-date-chip" data-days="1">Mañana</button>
                                <button type="button" class="ct-date-chip" data-days="3">En 3 días</button>
                                <button type="button" class="ct-date-chip" data-next-monday="1">Próx. lunes</button>
                                <button type="button" class="ct-date-chip" data-days="7">En 1 semana</button>
                            </div>

                            <p class="ct-deadline-readout" id="ct-deadline-readout"></p>
                        </section>

                        <section class="ct-rail-section">
                            <span class="ct-mono-label">NIVEL DE PRIORIDAD</span>
                            <div class="ct-prio-track" role="radiogroup" aria-label="Prioridad de la tarea">
                                <button type="button" class="ct-prio-opt is-baja" data-prio="Baja" aria-pressed="false">Baja</button>
                                <button type="button" class="ct-prio-opt is-media is-active" data-prio="Media" aria-pressed="true">Media</button>
                                <button type="button" class="ct-prio-opt is-alta" data-prio="Alta" aria-pressed="false">Alta</button>
                            </div>
                        </section>

                        <section class="ct-rail-section is-hidden" id="ct-estado-section">
                            <span class="ct-mono-label">FASE DE SEGUIMIENTO</span>
                            <div class="ct-prio-track" role="radiogroup" aria-label="Estado de la tarea">
                                <button type="button" class="ct-estado-opt is-active" data-estado="Pendiente" aria-pressed="true">Pendiente</button>
                                <button type="button" class="ct-estado-opt" data-estado="En progreso" aria-pressed="false">En progreso</button>
                                <button type="button" class="ct-estado-opt" data-estado="Completada" aria-pressed="false">Completada</button>
                            </div>
                        </section>

                        <section class="ct-rail-section ct-digest">
                            <span class="ct-mono-label">RESUMEN ANTES DE PUBLICAR</span>
                            <dl class="ct-digest-list">
                                <div>
                                    <dt>Alcance</dt>
                                    <dd id="ct-digest-alcance">Sin sección</dd>
                                </div>
                                <div>
                                    <dt>Plazo</dt>
                                    <dd id="ct-digest-plazo">—</dd>
                                </div>
                                <div>
                                    <dt>Prioridad</dt>
                                    <dd id="ct-digest-prioridad">Media</dd>
                                </div>
                                <div>
                                    <dt>Material</dt>
                                    <dd id="ct-digest-material">Sin adjunto</dd>
                                </div>
                            </dl>
                        </section>

                        <div class="ct-feedback is-hidden" id="ct-feedback" role="alert"></div>

                        <div class="ct-rail-actions">
                            <button type="submit" class="ct-btn-publish" id="ct-submit-btn">
                                <i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>
                                <span id="ct-submit-label">Publicar tarea</span>
                            </button>
                            <a href="#/tareas" class="ct-btn-secondary">Descartar y volver</a>
                            <button type="button" class="ct-btn-danger is-hidden" id="ct-delete-btn">
                                <i class="ph ph-trash" aria-hidden="true"></i>
                                <span>Eliminar esta tarea</span>
                            </button>
                        </div>
                    </aside>
                </form>
            </div>
        `;
    },

    async afterRender(queryString) {
        const user = Auth.getUser();
        if (!user) return;

        this.courses = [];
        this.selectedCourseIds = new Set();
        this.editingTarea = null;
        this.selectedFile = null;
        this.prioridad = 'Media';
        this.estado = 'Pendiente';
        this.isSubmitting = false;

        const hoy = toLocalIso(new Date());
        const defaultDue = addDaysIso(hoy, 3);
        const startEl = document.getElementById('ct-fecha-inicio');
        const dueEl = document.getElementById('ct-fecha-vencimiento');
        if (startEl) startEl.value = hoy;
        if (dueEl) {
            dueEl.min = hoy;
            dueEl.value = defaultDue;
        }

        const params = new URLSearchParams(queryString || '');
        const preCurso = params.get('curso');
        const editId = params.get('edit');

        await this.loadCourses(user.email);

        if (editId) {
            await this.loadTaskForEdit(editId);
        } else if (preCurso && this.courses.some(c => String(c.id) === String(preCurso))) {
            this.selectedCourseIds.add(String(preCurso));
        } else if (this.courses.length === 1) {
            this.selectedCourseIds.add(String(this.courses[0].id));
        }

        this.renderSections();
        this.bindEvents();
        this.autoResizeTextarea(document.getElementById('ct-titulo'), 48);
        this.updateAllReadouts();

        if (!editId) {
            document.getElementById('ct-titulo')?.focus();
        }
    },

    async loadCourses(email) {
        try {
            const [dash, fallback] = await Promise.all([
                CursoService.getDashboard(email).catch(() => null),
                CursoService.getCursosUnicos(email).catch(() => [])
            ]);

            if (dash && Array.isArray(dash.cursos) && dash.cursos.length > 0) {
                this.courses = dash.cursos.map(entry => {
                    const c = entry.curso || entry;
                    return {
                        ...c,
                        alumnos: typeof entry.alumnos === 'number' ? entry.alumnos : null
                    };
                });
            } else {
                this.courses = (fallback || []).map(c => ({ ...c, alumnos: null }));
            }
            this.courses.sort(sortCourses);
        } catch (err) {
            console.error('Error cargando cursos:', err);
            this.courses = [];
        }
    },

    async loadTaskForEdit(editId) {
        try {
            const allLists = await Promise.all(
                this.courses.map(c => API.fetch(`/api/docente/curso/${c.id}/tareas`).catch(() => []))
            );
            const found = allLists.flat().find(t => String(t.id) === String(editId));
            if (!found) {
                this.showFeedback('No se encontró la tarea solicitada para edición.', 'error');
                return;
            }

            this.editingTarea = found;
            document.getElementById('ct-breadcrumb').textContent = `TAREAS / EDITAR #${found.id}`;
            document.getElementById('ct-mode-kicker').textContent = 'EDICIÓN DE ACTIVIDAD PUBLICADA';
            document.getElementById('ct-submit-label').textContent = 'Guardar cambios';

            const delBtn = document.getElementById('ct-delete-btn');
            if (delBtn) delBtn.classList.remove('is-hidden');

            const estadoSec = document.getElementById('ct-estado-section');
            if (estadoSec) estadoSec.classList.remove('is-hidden');

            const titleInput = document.getElementById('ct-titulo');
            const descInput = document.getElementById('ct-descripcion');
            const startEl = document.getElementById('ct-fecha-inicio');
            const dueEl = document.getElementById('ct-fecha-vencimiento');

            if (titleInput) {
                titleInput.value = found.titulo || '';
                this.autoResizeTextarea(titleInput, 48);
            }
            if (descInput) {
                descInput.value = found.descripcion || '';
                this.autoResizeTextarea(descInput, 168);
            }
            if (startEl && found.fechaInicio) startEl.value = found.fechaInicio;
            if (dueEl) {
                dueEl.removeAttribute('min');
                if (found.fechaVencimiento) dueEl.value = found.fechaVencimiento;
            }

            if (found.curso?.id) {
                this.selectedCourseIds = new Set([String(found.curso.id)]);
            }

            this.prioridad = ['Baja', 'Media', 'Alta'].includes(found.prioridad) ? found.prioridad : 'Media';
            this.estado = ['Pendiente', 'En progreso', 'Completada'].includes(found.estado) ? found.estado : 'Pendiente';
            this.syncPriorityUI();
            this.syncEstadoUI();

            // El endpoint PUT /api/tareas/{id} edita metadatos de texto/fechas/estado; ocultamos carga nueva pero mostramos si ya tiene PDF.
            const dropzone = document.getElementById('ct-dropzone');
            const attachNote = document.getElementById('ct-attach-note');
            if (dropzone) dropzone.classList.add('is-hidden');
            if (attachNote) attachNote.textContent = 'Material registrado en la asignación';

            if (found.pdfUrl) {
                const pdfWrap = document.getElementById('ct-existing-pdf');
                const pdfLink = document.getElementById('ct-existing-pdf-link');
                if (pdfWrap && pdfLink) {
                    pdfLink.href = found.pdfUrl;
                    pdfWrap.classList.remove('is-hidden');
                }
            } else {
                const attachBlock = document.getElementById('ct-attach-block');
                if (attachBlock) attachBlock.classList.add('is-hidden');
            }

            const audLabel = document.getElementById('ct-audience-label');
            if (audLabel) audLabel.textContent = 'SECCIÓN ASIGNADA';
        } catch (err) {
            console.error('Error cargando tarea para editar:', err);
            this.showFeedback('No se pudieron recuperar los datos de la tarea.', 'error');
        }
    },

    renderSections() {
        const container = document.getElementById('ct-sections-wrap');
        if (!container) return;

        if (!this.courses.length) {
            container.innerHTML = `<div class="ct-loading-inline">No tienes cursos activos asignados.</div>`;
            return;
        }

        const isEditing = Boolean(this.editingTarea);
        const groups = new Map();
        this.courses.forEach(c => {
            const key = `${c.nivel || ''}|${c.grado || ''}`;
            const label = `${c.grado || ''}° ${formatNivel(c.nivel)}`.trim();
            if (!groups.has(key)) groups.set(key, { key, label, items: [] });
            groups.get(key).items.push(c);
        });

        container.innerHTML = Array.from(groups.values()).map(grp => {
            const allSelected = grp.items.every(c => this.selectedCourseIds.has(String(c.id)));
            const groupBtn = (!isEditing && grp.items.length > 1)
                ? `<button type="button" class="ct-group-select-btn" data-select-group="${escapeHtml(grp.key)}" data-group-label="${escapeHtml(grp.label)}">${allSelected ? 'Quitar todo ' : 'Todo '}${escapeHtml(grp.label)}</button>`
                : '';

            const pills = grp.items.map(c => {
                const selected = this.selectedCourseIds.has(String(c.id));
                const alu = typeof c.alumnos === 'number' ? `${c.alumnos} alumnos` : (c.turno || '');
                return `
                    <button
                        type="button"
                        class="ct-section-opt ${selected ? 'is-selected' : ''} ${isEditing ? 'is-locked' : ''}"
                        data-curso-id="${escapeHtml(c.id)}"
                        aria-pressed="${selected ? 'true' : 'false'}"
                        ${isEditing ? 'disabled' : ''}>
                        <span class="ct-sec-badge">${escapeHtml(c.grado || '')}° ${escapeHtml(c.seccion || '')}</span>
                        <span class="ct-sec-info">
                            <strong>${escapeHtml(c.nombre)}</strong>
                            <small>${escapeHtml(alu)}</small>
                        </span>
                        <i class="ph ${selected ? 'ph-check' : 'ph-plus'}" aria-hidden="true"></i>
                    </button>
                `;
            }).join('');

            return `
                <div class="ct-sec-group">
                    <div class="ct-sec-group-head">
                        <span>${escapeHtml(grp.label)}</span>
                        ${groupBtn}
                    </div>
                    <div class="ct-sec-grid">${pills}</div>
                </div>
            `;
        }).join('');
    },

    bindEvents() {
        const titleInput = document.getElementById('ct-titulo');
        const descInput = document.getElementById('ct-descripcion');
        const startInput = document.getElementById('ct-fecha-inicio');
        const dueInput = document.getElementById('ct-fecha-vencimiento');
        const sectionsWrap = document.getElementById('ct-sections-wrap');
        const dropzone = document.getElementById('ct-dropzone');
        const fileInput = document.getElementById('ct-archivo');
        const form = document.getElementById('ct-form');

        titleInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                descInput?.focus();
            }
        });

        titleInput?.addEventListener('input', () => {
            titleInput.value = titleInput.value.replace(/[\r\n]+/g, ' ');
            this.autoResizeTextarea(titleInput, 48);
            this.clearFeedback();
            this.updateAllReadouts();
        });

        descInput?.addEventListener('input', () => {
            this.autoResizeTextarea(descInput);
            this.updateAllReadouts();
        });

        document.querySelectorAll('.ct-scaffold-btn[data-tpl]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!descInput) return;
                const tpl = TEMPLATES[btn.getAttribute('data-tpl')] || '';
                const current = descInput.value.trimEnd();
                const next = (current ? `${current}\n${tpl.trimStart()}` : tpl.trimStart()).slice(0, 1000);
                descInput.value = next;
                descInput.focus();
                this.autoResizeTextarea(descInput);
                this.updateAllReadouts();
            });
        });

        sectionsWrap?.addEventListener('click', (e) => {
            if (this.editingTarea) return;

            const groupBtn = e.target.closest('[data-select-group]');
            if (groupBtn) {
                const key = groupBtn.getAttribute('data-select-group');
                const groupCourses = this.courses.filter(c => `${c.nivel || ''}|${c.grado || ''}` === key);
                const allIn = groupCourses.every(c => this.selectedCourseIds.has(String(c.id)));
                groupCourses.forEach(c => {
                    if (allIn) this.selectedCourseIds.delete(String(c.id));
                    else this.selectedCourseIds.add(String(c.id));
                });
                this.syncSectionsUI();
                this.clearFeedback();
                this.updateAllReadouts();
                return;
            }

            const opt = e.target.closest('.ct-section-opt[data-curso-id]');
            if (!opt) return;
            const id = String(opt.getAttribute('data-curso-id'));
            if (this.selectedCourseIds.has(id)) {
                this.selectedCourseIds.delete(id);
            } else {
                this.selectedCourseIds.add(id);
            }
            this.syncSectionsUI();
            this.clearFeedback();
            this.updateAllReadouts();
        });

        [startInput, dueInput].forEach(el => {
            el?.addEventListener('change', () => {
                this.clearFeedback();
                this.updateAllReadouts();
            });
        });

        document.querySelectorAll('.ct-date-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const base = startInput?.value || toLocalIso(new Date());
                let targetIso;
                if (chip.hasAttribute('data-next-monday')) {
                    targetIso = nextMondayIso(base);
                } else {
                    const days = Number(chip.getAttribute('data-days') || 1);
                    targetIso = addDaysIso(base, days);
                }
                if (dueInput) dueInput.value = targetIso;
                this.clearFeedback();
                this.updateAllReadouts();
            });
        });

        document.querySelectorAll('.ct-prio-opt[data-prio]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.prioridad = btn.getAttribute('data-prio') || 'Media';
                this.syncPriorityUI();
                this.updateAllReadouts();
            });
        });

        document.querySelectorAll('.ct-estado-opt[data-estado]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.estado = btn.getAttribute('data-estado') || 'Pendiente';
                this.syncEstadoUI();
            });
        });

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', (e) => {
                if (e.target.closest('#ct-file-remove')) return;
                fileInput.click();
            });
            dropzone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.click();
                }
            });
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('is-dragover');
            });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('is-dragover');
                const file = e.dataTransfer?.files?.[0];
                if (file) this.setSelectedFile(file);
            });
            fileInput.addEventListener('change', () => {
                const file = fileInput.files?.[0] || null;
                this.setSelectedFile(file);
            });
        }

        document.getElementById('ct-file-remove')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setSelectedFile(null);
            if (fileInput) fileInput.value = '';
        });

        document.getElementById('ct-delete-btn')?.addEventListener('click', () => this.deleteCurrentTask());

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submit();
        });

        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        this._keyHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const f = document.getElementById('ct-form');
                if (f) {
                    e.preventDefault();
                    f.requestSubmit();
                }
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        if (this._hashCleanup) window.removeEventListener('hashchange', this._hashCleanup);
        this._hashCleanup = () => {
            if (this._keyHandler) {
                document.removeEventListener('keydown', this._keyHandler);
                this._keyHandler = null;
            }
        };
        window.addEventListener('hashchange', this._hashCleanup, { once: true });
    },

    syncSectionsUI() {
        document.querySelectorAll('.ct-section-opt[data-curso-id]').forEach(opt => {
            const id = String(opt.getAttribute('data-curso-id'));
            const selected = this.selectedCourseIds.has(id);
            opt.classList.toggle('is-selected', selected);
            opt.setAttribute('aria-pressed', selected ? 'true' : 'false');
            const icon = opt.querySelector('i');
            if (icon) {
                icon.className = `ph ${selected ? 'ph-check' : 'ph-plus'}`;
            }
        });

        document.querySelectorAll('.ct-group-select-btn[data-select-group]').forEach(btn => {
            const key = btn.getAttribute('data-select-group');
            const label = btn.getAttribute('data-group-label') || '';
            const groupCourses = this.courses.filter(c => `${c.nivel || ''}|${c.grado || ''}` === key);
            const allSelected = groupCourses.length > 0 && groupCourses.every(c => this.selectedCourseIds.has(String(c.id)));
            btn.textContent = `${allSelected ? 'Quitar todo ' : 'Todo '}${label}`;
        });
    },

    autoResizeTextarea(el, minHeight = 168) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
    },

    setSelectedFile(file) {
        this.selectedFile = file || null;
        const idleEl = document.getElementById('ct-dropzone-idle');
        const chosenEl = document.getElementById('ct-file-chosen');
        const nameEl = document.getElementById('ct-file-name');
        const sizeEl = document.getElementById('ct-file-size');

        if (this.selectedFile) {
            idleEl?.classList.add('is-hidden');
            chosenEl?.classList.remove('is-hidden');
            if (nameEl) nameEl.textContent = this.selectedFile.name;
            if (sizeEl) sizeEl.textContent = formatBytes(this.selectedFile.size);
        } else {
            idleEl?.classList.remove('is-hidden');
            chosenEl?.classList.add('is-hidden');
            if (nameEl) nameEl.textContent = '';
            if (sizeEl) sizeEl.textContent = '';
        }
        this.updateAllReadouts();
    },

    syncPriorityUI() {
        document.querySelectorAll('.ct-prio-opt[data-prio]').forEach(btn => {
            const active = btn.getAttribute('data-prio') === this.prioridad;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    },

    syncEstadoUI() {
        document.querySelectorAll('.ct-estado-opt[data-estado]').forEach(btn => {
            const active = btn.getAttribute('data-estado') === this.estado;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    },

    updateAllReadouts() {
        const titleLen = (document.getElementById('ct-titulo')?.value || '').length;
        const descLen = (document.getElementById('ct-descripcion')?.value || '').length;
        const tCount = document.getElementById('ct-title-count');
        const dCount = document.getElementById('ct-desc-count');
        if (tCount) tCount.textContent = `${titleLen} / 120`;
        if (dCount) {
            dCount.textContent = `${descLen} / 1000`;
            dCount.classList.toggle('is-near-limit', descLen >= 900);
        }

        const selected = this.courses.filter(c => this.selectedCourseIds.has(String(c.id)));
        const secCount = selected.length;
        const hasStudents = selected.some(c => typeof c.alumnos === 'number');
        const stuTotal = selected.reduce((s, c) => s + (c.alumnos || 0), 0);

        const audSummary = document.getElementById('ct-audience-summary');
        const digAlcance = document.getElementById('ct-digest-alcance');

        if (!secCount) {
            if (audSummary) audSummary.textContent = 'Ninguna sección seleccionada';
            if (digAlcance) digAlcance.textContent = 'Sin sección';
        } else {
            const labels = selected.map(c => `${c.grado || ''}° ${c.seccion || ''}`.trim()).join(', ');
            const alcanceTxt = hasStudents
                ? `${labels} · ${stuTotal} estudiante${stuTotal === 1 ? '' : 's'}`
                : `${labels} (${secCount} ${secCount === 1 ? 'sección' : 'secciones'})`;
            if (audSummary) audSummary.textContent = this.editingTarea ? labels : `${alcanceTxt} recibirán notificación`;
            if (digAlcance) digAlcance.textContent = alcanceTxt;
        }

        const startIso = document.getElementById('ct-fecha-inicio')?.value || '';
        const dueIso = document.getElementById('ct-fecha-vencimiento')?.value || '';
        const readout = document.getElementById('ct-deadline-readout');
        const digPlazo = document.getElementById('ct-digest-plazo');

        if (!dueIso) {
            if (readout) readout.textContent = 'Define una fecha límite de entrega.';
            if (digPlazo) digPlazo.textContent = 'Sin definir';
        } else {
            const hoy = toLocalIso(new Date());
            const deltaFromStart = startIso ? diffDaysLocal(startIso, dueIso) : null;
            const deltaFromToday = diffDaysLocal(hoy, dueIso);
            const natural = formatFechaNatural(dueIso);

            let relText = '';
            if (deltaFromStart !== null && deltaFromStart < 0) {
                relText = 'La fecha límite es anterior al inicio.';
            } else if (deltaFromToday === 0) {
                relText = 'Vence hoy mismo';
            } else if (deltaFromToday === 1) {
                relText = 'Vence mañana';
            } else if (deltaFromToday > 1) {
                relText = `en ${deltaFromToday} días`;
            } else {
                relText = `hace ${Math.abs(deltaFromToday)} días`;
            }

            if (readout) {
                readout.textContent = `${natural} (${relText})`;
                readout.classList.toggle('is-invalid', deltaFromStart !== null && deltaFromStart < 0);
            }
            if (digPlazo) digPlazo.textContent = natural;
        }

        const digPrio = document.getElementById('ct-digest-prioridad');
        if (digPrio) digPrio.textContent = this.prioridad;

        const digMat = document.getElementById('ct-digest-material');
        if (digMat) {
            if (this.selectedFile) digMat.textContent = this.selectedFile.name;
            else if (this.editingTarea?.pdfUrl) digMat.textContent = 'Archivo adjunto previo';
            else digMat.textContent = 'Sin adjunto';
        }
    },

    clearFeedback() {
        const el = document.getElementById('ct-feedback');
        if (!el) return;
        el.textContent = '';
        el.className = 'ct-feedback is-hidden';
    },

    showFeedback(msg, tone = 'error') {
        const el = document.getElementById('ct-feedback');
        if (!el) return;
        el.textContent = msg;
        el.className = `ct-feedback is-${tone}`;
    },

    async submit() {
        if (this.isSubmitting) return;
        this.clearFeedback();

        const titulo = (document.getElementById('ct-titulo')?.value || '').trim();
        const descripcion = (document.getElementById('ct-descripcion')?.value || '').trim();
        const fechaInicio = document.getElementById('ct-fecha-inicio')?.value || toLocalIso(new Date());
        const fechaVencimiento = document.getElementById('ct-fecha-vencimiento')?.value || '';

        if (!titulo) {
            this.showFeedback('Escribe un título claro para la tarea.', 'error');
            document.getElementById('ct-titulo')?.focus();
            return;
        }

        if (!this.selectedCourseIds.size) {
            this.showFeedback('Selecciona al menos una sección destinataria.', 'error');
            return;
        }

        if (!fechaVencimiento) {
            this.showFeedback('Indica la fecha límite de entrega.', 'error');
            document.getElementById('ct-fecha-vencimiento')?.focus();
            return;
        }

        const span = diffDaysLocal(fechaInicio, fechaVencimiento);
        if (span !== null && span < 0) {
            this.showFeedback('La fecha límite no puede ser anterior a la fecha de inicio.', 'error');
            document.getElementById('ct-fecha-vencimiento')?.focus();
            return;
        }

        const btn = document.getElementById('ct-submit-btn');
        const labelEl = document.getElementById('ct-submit-label');
        this.isSubmitting = true;
        if (btn) btn.disabled = true;
        if (labelEl) labelEl.textContent = this.editingTarea ? 'Guardando…' : 'Publicando…';

        try {
            if (this.editingTarea) {
                await API.fetch(`/api/tareas/${this.editingTarea.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        titulo,
                        descripcion,
                        prioridad: this.prioridad,
                        estado: this.estado,
                        fechaInicio,
                        fechaVencimiento
                    })
                });
                this.showFeedback('Cambios guardados correctamente. Regresando a Tareas…', 'success');
            } else {
                const targetIds = Array.from(this.selectedCourseIds);
                await Promise.all(targetIds.map(cursoId => {
                    const fd = new FormData();
                    fd.append('titulo', titulo);
                    fd.append('descripcion', descripcion);
                    fd.append('cursoId', String(cursoId));
                    fd.append('fechaInicio', fechaInicio);
                    fd.append('fechaVencimiento', fechaVencimiento);
                    fd.append('prioridad', this.prioridad);
                    if (this.selectedFile) {
                        fd.append('archivo', this.selectedFile);
                    }
                    return API.fetch('/api/docente/tareas', {
                        method: 'POST',
                        body: fd
                    });
                }));
                const n = targetIds.length;
                this.showFeedback(
                    n === 1 ? 'Tarea publicada y notificada a la sección.' : `Tarea publicada en ${n} secciones.`,
                    'success'
                );
            }

            setTimeout(() => {
                window.location.hash = '#/tareas';
            }, 450);
        } catch (err) {
            console.error('Error guardando tarea:', err);
            this.showFeedback('No se pudo publicar la tarea. Revisa tu conexión e inténtalo de nuevo.', 'error');
            this.isSubmitting = false;
            if (btn) btn.disabled = false;
            if (labelEl) labelEl.textContent = this.editingTarea ? 'Guardar cambios' : 'Publicar tarea';
        }
    },

    async deleteCurrentTask() {
        if (!this.editingTarea || this.isSubmitting) return;
        const delBtn = document.getElementById('ct-delete-btn');
        if (!delBtn) return;

        if (!delBtn.classList.contains('is-confirming')) {
            delBtn.classList.add('is-confirming');
            delBtn.querySelector('span').textContent = 'Confirmar eliminación definitiva';
            setTimeout(() => {
                if (delBtn && delBtn.isConnected) {
                    delBtn.classList.remove('is-confirming');
                    const sp = delBtn.querySelector('span');
                    if (sp) sp.textContent = 'Eliminar esta tarea';
                }
            }, 4500);
            return;
        }

        this.isSubmitting = true;
        delBtn.disabled = true;
        try {
            await API.fetch(`/api/docente/tareas/${this.editingTarea.id}`, { method: 'DELETE' });
            window.location.hash = '#/tareas';
        } catch (err) {
            console.error('Error eliminando tarea:', err);
            this.showFeedback('No se pudo eliminar la tarea.', 'error');
            this.isSubmitting = false;
            delBtn.disabled = false;
        }
    }
};
