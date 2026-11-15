import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

const EVAL_PRESETS = [
    { label: 'Examen Bimestral 1', titulo: 'Examen Bimestral 1', tipo: 'EXAMEN', bimestre: 1, peso: 2 },
    { label: 'Examen Parcial', titulo: 'Examen Parcial', tipo: 'EXAMEN', bimestre: 1, peso: 2 },
    { label: 'Práctica Calificada 1', titulo: 'Práctica Calificada 1', tipo: 'PRACTICA', bimestre: 1, peso: 1 },
    { label: 'Exposición Oral', titulo: 'Exposición Oral', tipo: 'ACTIVIDAD', bimestre: 1, peso: 1 },
    { label: 'Participación en Clase', titulo: 'Participación en Clase', tipo: 'PARTICIPACION', bimestre: 1, peso: 1 }
];

const TIPO_META = [
    { value: 'EXAMEN', label: 'Examen', icon: 'ph-exam' },
    { value: 'PRACTICA', label: 'Práctica', icon: 'ph-pencil-line' },
    { value: 'ACTIVIDAD', label: 'Actividad', icon: 'ph-presentation-chart' },
    { value: 'PARTICIPACION', label: 'Participación', icon: 'ph-hand-waving' }
];

const BIMESTRE_LABELS = {
    1: 'I Bimestre',
    2: 'II Bimestre',
    3: 'III Bimestre',
    4: 'IV Bimestre'
};

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeName(str) {
    return String(str ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function parseQueryParams(queryString) {
    if (queryString) return new URLSearchParams(queryString);
    const hash = window.location.hash || '';
    const idx = hash.indexOf('?');
    return idx === -1 ? new URLSearchParams() : new URLSearchParams(hash.slice(idx + 1));
}

function toLocalIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDaysIso(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toLocalIsoDate(d);
}

function formatReadableDate(iso) {
    if (!iso) return 'Hoy';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(y, m - 1, d);
    const today = new Date();
    const isToday = y === today.getFullYear() && m === (today.getMonth() + 1) && d === today.getDate();
    const formatted = date.toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    return isToday ? `Hoy · ${formatted}` : formatted;
}

function formatShortDate(iso) {
    if (!iso) return 'Hoy';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatWeightLabel(peso) {
    if (peso === 0.5) return 'Medio (×0.5)';
    if (peso === 2) return 'Doble — Examen (×2)';
    if (peso === 3) return 'Triple (×3)';
    if (peso === 1) return 'Normal (×1)';
    return `×${peso}`;
}

export const CrearEvaluacionView = {
    async render() {
        const presetsHtml = EVAL_PRESETS.map((p, idx) => `
            <button type="button" class="ce-preset-btn" data-preset-idx="${idx}">
                <span>${escapeHtml(p.label)}</span>
                <span class="ce-preset-peso">×${p.peso}</span>
            </button>
        `).join('');

        const tiposHtml = TIPO_META.map(t => `
            <button type="button" class="ce-type-opt ${t.value === 'EXAMEN' ? 'is-active' : ''}"
                data-tipo="${t.value}" aria-pressed="${t.value === 'EXAMEN' ? 'true' : 'false'}">
                <i class="ph ${t.icon}"></i>
                <span>${escapeHtml(t.label)}</span>
            </button>
        `).join('');

        return `
            <div class="ce-page">
                <header class="ce-topbar">
                    <a href="#/calificaciones" id="ce-back-link" class="ce-back-link">
                        <i class="ph ph-arrow-left"></i>
                        <span>Volver a Calificaciones</span>
                    </a>
                    <div class="ce-topbar-right">
                        <span class="ce-breadcrumb">CALIFICACIONES / NUEVA EVALUACIÓN</span>
                        <span class="ce-kbd-hint">Ctrl + Enter para crear</span>
                    </div>
                </header>

                <form id="ce-form" class="ce-workspace" novalidate>
                    <div class="ce-editor-col">
                        <div class="ce-intro">
                            <span class="ce-mono-label">REGISTRO EN LIBRO DE NOTAS</span>
                            <p class="ce-intro-copy">Define la columna de evaluación, selecciona el salón y comienza a calificar a tus estudiantes en planilla.</p>
                        </div>

                        <!-- Plantillas rápidas -->
                        <div class="ce-field-block">
                            <div class="ce-field-top">
                                <span class="ce-mono-label">PLANTILLAS RÁPIDAS</span>
                                <span class="ce-field-hint">Opcional · rellena título, tipo y peso</span>
                            </div>
                            <div class="ce-presets-row" id="ce-presets">${presetsHtml}</div>
                        </div>

                        <!-- Nombre de la evaluación -->
                        <div class="ce-title-block">
                            <div class="ce-field-top">
                                <label for="ce-titulo" class="ce-mono-label">NOMBRE DE LA EVALUACIÓN <span class="ce-req">*</span></label>
                                <span class="ce-char-count" id="ce-char-count">0 / 100</span>
                            </div>
                            <textarea id="ce-titulo" class="ce-title-input" rows="1" maxlength="100"
                                placeholder="Ej. Examen Parcial de Álgebra — Unidad II" required></textarea>
                            <p class="ce-title-warning is-hidden" id="ce-duplicate-warning">
                                <i class="ph-fill ph-warning-circle"></i>
                                <span id="ce-duplicate-text"></span>
                            </p>
                        </div>

                        <!-- Tipo de evaluación -->
                        <div class="ce-field-block">
                            <span class="ce-mono-label">TIPO DE EVALUACIÓN</span>
                            <div class="ce-type-grid" role="radiogroup" aria-label="Tipo de evaluación" id="ce-tipo-group">
                                ${tiposHtml}
                            </div>
                        </div>

                        <!-- Curso y Salón Destino -->
                        <div class="ce-field-block">
                            <div class="ce-field-top">
                                <span class="ce-mono-label">CURSO Y SALÓN DESTINO <span class="ce-req">*</span></span>
                                <span class="ce-field-hint" id="ce-cursos-count">Cargando cursos...</span>
                            </div>
                            <div id="ce-cursos-grid" class="ce-cursos-wrap">
                                <div class="ce-loading-inline"><i class="ph ph-spinner ph-spin"></i> Cargando salones asignados...</div>
                            </div>

                            <label class="ce-multi-opt is-hidden" id="ce-multi-wrap">
                                <input type="checkbox" id="ce-todas-secciones">
                                <div class="ce-multi-copy">
                                    <strong id="ce-multi-title">Aplicar también a todas mis secciones</strong>
                                    <small id="ce-multi-desc"></small>
                                </div>
                            </label>
                        </div>

                        <!-- Contexto: columnas existentes -->
                        <div class="ce-field-block is-hidden" id="ce-existing-wrap">
                            <div class="ce-field-top">
                                <span class="ce-mono-label">EVALUACIONES YA REGISTRADAS EN ESTE SALÓN</span>
                                <span class="ce-field-hint" id="ce-existing-count">0 registradas</span>
                            </div>
                            <div class="ce-existing-ledger" id="ce-existing-list"></div>
                        </div>

                        <!-- Nota sobre Tareas con entrega digital -->
                        <div class="ce-task-callout">
                            <i class="ph ph-file-arrow-up"></i>
                            <div>
                                <strong>¿Necesitas que los estudiantes suban un archivo PDF o Word?</strong>
                                <span>Para actividades con entrega digital, créala desde <a href="#/crear-tarea" id="ce-link-crear-tarea">Nueva Tarea</a>; aparecerá automáticamente en tu tabla de calificaciones.</span>
                            </div>
                        </div>
                    </div>

                    <!-- Riel Derecho: Parámetros y Resumen -->
                    <aside class="ce-meta-col">
                        <section class="ce-rail-section">
                            <span class="ce-mono-label">BIMESTRE ACADÉMICO</span>
                            <div class="ce-seg-track ce-seg-4" role="radiogroup" aria-label="Bimestre" id="ce-bimestre-group">
                                <button type="button" class="ce-seg-btn is-active" data-bimestre="1" aria-pressed="true">I Bim.</button>
                                <button type="button" class="ce-seg-btn" data-bimestre="2" aria-pressed="false">II Bim.</button>
                                <button type="button" class="ce-seg-btn" data-bimestre="3" aria-pressed="false">III Bim.</button>
                                <button type="button" class="ce-seg-btn" data-bimestre="4" aria-pressed="false">IV Bim.</button>
                            </div>
                        </section>

                        <section class="ce-rail-section">
                            <div class="ce-field-top" style="margin-bottom:0;">
                                <span class="ce-mono-label">PESO EN PROMEDIO</span>
                                <span class="ce-field-hint">Ponderación</span>
                            </div>
                            <div class="ce-seg-track ce-seg-4" role="radiogroup" aria-label="Peso en promedio" id="ce-peso-group">
                                <button type="button" class="ce-seg-btn" data-peso="0.5" aria-pressed="false">×0.5</button>
                                <button type="button" class="ce-seg-btn is-active" data-peso="1" aria-pressed="true">×1 Normal</button>
                                <button type="button" class="ce-seg-btn" data-peso="2" aria-pressed="false">×2 Examen</button>
                                <button type="button" class="ce-seg-btn" data-peso="3" aria-pressed="false">×3 Triple</button>
                            </div>
                        </section>

                        <section class="ce-rail-section">
                            <span class="ce-mono-label">ESCALA DE NOTA</span>
                            <div class="ce-seg-track ce-seg-2" role="radiogroup" aria-label="Escala de calificación" id="ce-escala-group">
                                <button type="button" class="ce-seg-btn is-active" data-escala="20" aria-pressed="true">0 – 20 (Vigesimal)</button>
                                <button type="button" class="ce-seg-btn" data-escala="100" aria-pressed="false">0 – 100 (Centesimal)</button>
                            </div>
                        </section>

                        <section class="ce-rail-section">
                            <label for="ce-fecha" class="ce-mono-label">FECHA DE EVALUACIÓN</label>
                            <input type="date" id="ce-fecha" class="ce-date-input">
                            <div class="ce-quick-dates" id="ce-quick-dates">
                                <button type="button" class="ce-date-chip" data-days="0">Hoy</button>
                                <button type="button" class="ce-date-chip" data-days="1">Mañana</button>
                                <button type="button" class="ce-date-chip" data-days="7">En 1 semana</button>
                            </div>
                            <p class="ce-date-readout" id="ce-date-readout"></p>
                        </section>

                        <section class="ce-rail-section">
                            <label class="ce-check-inline">
                                <input type="checkbox" id="ce-ir-a-calificar" checked>
                                <span>Abrir la planilla para poner notas al terminar</span>
                            </label>
                        </section>

                        <section class="ce-rail-section ce-digest">
                            <span class="ce-mono-label">RESUMEN DEL REGISTRO</span>
                            <dl class="ce-digest-list">
                                <div><dt>Curso</dt><dd id="ce-sum-curso">Sin seleccionar</dd></div>
                                <div><dt>Tipo y escala</dt><dd id="ce-sum-tipo">Examen · 0–20</dd></div>
                                <div><dt>Bimestre</dt><dd id="ce-sum-bimestre">I Bimestre</dd></div>
                                <div><dt>Peso</dt><dd id="ce-sum-peso">Normal (×1)</dd></div>
                                <div><dt>Fecha</dt><dd id="ce-sum-fecha">Hoy</dd></div>
                            </dl>
                        </section>

                        <div class="ce-feedback is-hidden" id="ce-feedback" role="alert"></div>

                        <div class="ce-rail-actions">
                            <button type="submit" class="ce-btn-submit" id="btn-ce-submit">
                                <i class="ph ph-check-circle"></i>
                                <span id="ce-submit-label">Crear evaluación</span>
                            </button>
                            <a href="#/calificaciones" id="ce-discard-link" class="ce-btn-secondary">Descartar y volver</a>
                        </div>
                    </aside>
                </form>
            </div>
        `;
    },

    async afterRender(queryString) {
        this.user = Auth.getUser();
        this.cursos = [];
        this.selectedCursoId = null;
        this.existingEvaluaciones = [];
        this.evalsCache = new Map();
        this.tipo = 'EXAMEN';
        this.bimestre = 1;
        this.peso = 1;
        this.notaMaxima = 20;
        this.isSubmitting = false;

        const fechaInput = document.getElementById('ce-fecha');
        if (fechaInput) fechaInput.value = toLocalIsoDate(new Date());

        this.setupEvents();
        await this.loadCursos(queryString);
        this.updateAllReadouts();

        setTimeout(() => document.getElementById('ce-titulo')?.focus(), 40);
    },

    async loadCursos(queryString) {
        const container = document.getElementById('ce-cursos-grid');
        const countEl = document.getElementById('ce-cursos-count');
        try {
            this.cursos = (await CursoService.getCursosUnicos(this.user.email)) || [];
            if (!container) return;

            if (this.cursos.length === 0) {
                if (countEl) countEl.textContent = '0 salones';
                container.innerHTML = '<div class="ce-empty-courses"><i class="ph ph-warning"></i> No tienes cursos activos asignados para evaluar.</div>';
                return;
            }

            if (countEl) {
                countEl.textContent = `${this.cursos.length} ${this.cursos.length === 1 ? 'salón disponible' : 'salones disponibles'}`;
            }

            // Agrupar visualmente por nivel
            const byNivel = new Map();
            this.cursos.forEach(c => {
                const nivel = c.nivel || 'General';
                if (!byNivel.has(nivel)) byNivel.set(nivel, []);
                byNivel.get(nivel).push(c);
            });

            let html = '';
            byNivel.forEach((items, nivel) => {
                html += `
                    <div class="ce-course-group">
                        <div class="ce-course-group-label">${escapeHtml(nivel)}</div>
                        <div class="ce-cursos-grid">
                            ${items.map(c => {
                                const aula = `${c.grado || ''} ${c.seccion || ''}`.trim() || 'Aula';
                                const sub = [c.nivel, c.turno].filter(Boolean).join(' · ');
                                return `
                                    <button type="button" class="ce-course-opt" data-curso-id="${c.id}" aria-pressed="false">
                                        <span class="ce-course-room">${escapeHtml(aula)}</span>
                                        <span class="ce-course-meta">
                                            <strong>${escapeHtml(c.nombre)}</strong>
                                            <small>${escapeHtml(sub)}</small>
                                        </span>
                                        <i class="ph-fill ph-check-circle"></i>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;

            const params = parseQueryParams(queryString);
            const preselected = params.get('curso');
            if (preselected && this.cursos.some(c => String(c.id) === String(preselected))) {
                await this.selectCourse(preselected);
            } else if (this.cursos.length === 1) {
                await this.selectCourse(this.cursos[0].id);
            }
        } catch (err) {
            console.error(err);
            if (container) {
                container.innerHTML = '<div class="ce-empty-courses"><i class="ph ph-warning-circle"></i> No se pudieron cargar tus cursos.</div>';
            }
        }
    },

    async selectCourse(cursoId) {
        this.selectedCursoId = String(cursoId);
        document.querySelectorAll('.ce-course-opt').forEach(btn => {
            const active = btn.dataset.cursoId === this.selectedCursoId;
            btn.classList.toggle('is-selected', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        const curso = this.cursos.find(c => String(c.id) === this.selectedCursoId);
        this.updateMultiSectionBox(curso);
        this.updateBackLinks();
        this.clearFeedback();
        await this.loadExistingEvaluaciones(this.selectedCursoId);
        this.updateDigest();
        this.checkDuplicateTitle();
    },

    getSiblingSections(curso) {
        if (!curso) return [];
        const normName = normalizeName(curso.nombre);
        const nivel = (curso.nivel || '').trim().toLowerCase();
        return this.cursos.filter(c =>
            normalizeName(c.nombre) === normName &&
            (c.nivel || '').trim().toLowerCase() === nivel
        );
    },

    updateMultiSectionBox(curso) {
        const wrap = document.getElementById('ce-multi-wrap');
        const checkbox = document.getElementById('ce-todas-secciones');
        const titleEl = document.getElementById('ce-multi-title');
        const descEl = document.getElementById('ce-multi-desc');
        if (!wrap || !checkbox) return;

        const siblings = this.getSiblingSections(curso);
        if (siblings.length > 1) {
            const otherLabels = siblings
                .filter(s => String(s.id) !== String(curso.id))
                .map(s => `${s.grado || ''} ${s.seccion || ''}`.trim())
                .join(', ');
            titleEl.textContent = `Aplicar también a todas mis secciones de ${curso.nombre} (${siblings.length} salones)`;
            descEl.textContent = `Se creará simultáneamente en ${otherLabels} si aún no existe una evaluación con el mismo título.`;
            wrap.classList.remove('is-hidden');
        } else {
            checkbox.checked = false;
            wrap.classList.add('is-hidden');
        }
    },

    async loadExistingEvaluaciones(cursoId) {
        const wrap = document.getElementById('ce-existing-wrap');
        const listEl = document.getElementById('ce-existing-list');
        const countEl = document.getElementById('ce-existing-count');
        if (!wrap || !listEl) return;

        wrap.classList.remove('is-hidden');
        if (this.evalsCache.has(cursoId)) {
            this.existingEvaluaciones = this.evalsCache.get(cursoId);
            this.renderExistingEvaluaciones(listEl, countEl);
            return;
        }

        listEl.innerHTML = '<span class="ce-existing-empty"><i class="ph ph-spinner ph-spin"></i> Consultando evaluaciones del salón...</span>';
        try {
            const evals = (await API.fetch(`/api/docente/curso/${cursoId}/evaluaciones`)) || [];
            this.evalsCache.set(cursoId, evals);
            if (this.selectedCursoId === String(cursoId)) {
                this.existingEvaluaciones = evals;
                this.renderExistingEvaluaciones(listEl, countEl);
                this.checkDuplicateTitle();
            }
        } catch (err) {
            console.error(err);
            listEl.innerHTML = '<span class="ce-existing-empty">No se pudieron listar las evaluaciones previas.</span>';
        }
    },

    renderExistingEvaluaciones(listEl, countEl) {
        const evals = this.existingEvaluaciones || [];
        if (countEl) {
            countEl.textContent = evals.length === 1 ? '1 registrada' : `${evals.length} registradas`;
        }
        if (evals.length === 0) {
            listEl.innerHTML = '<span class="ce-existing-empty">Aún no hay evaluaciones creadas en este salón.</span>';
            return;
        }
        listEl.innerHTML = evals.map(ev => `
            <span class="ce-existing-chip">
                <b>${escapeHtml(ev.titulo)}</b>
                <code>B${ev.bimestre || 1} · ×${ev.peso || 1} · 0–${ev.notaMaxima || 20}</code>
            </span>
        `).join('');
    },

    checkDuplicateTitle() {
        const warnEl = document.getElementById('ce-duplicate-warning');
        const textEl = document.getElementById('ce-duplicate-text');
        const titleInput = document.getElementById('ce-titulo');
        if (!warnEl || !textEl || !titleInput) return false;

        const val = titleInput.value.trim().toLowerCase();
        const isDup = Boolean(
            val &&
            this.selectedCursoId &&
            this.existingEvaluaciones.some(ev => (ev.titulo || '').trim().toLowerCase() === val)
        );
        if (isDup) {
            textEl.textContent = `Ya existe una evaluación llamada "${titleInput.value.trim()}" en este salón. Usa otro nombre para evitar duplicados.`;
            warnEl.classList.remove('is-hidden');
        } else {
            warnEl.classList.add('is-hidden');
        }
        return isDup;
    },

    setupEvents() {
        const tituloEl = document.getElementById('ce-titulo');
        const charCountEl = document.getElementById('ce-char-count');

        tituloEl?.addEventListener('input', () => {
            tituloEl.style.height = 'auto';
            tituloEl.style.height = `${tituloEl.scrollHeight}px`;
            const len = tituloEl.value.length;
            if (charCountEl) {
                charCountEl.textContent = `${len} / 100`;
                charCountEl.classList.toggle('is-near-limit', len >= 85);
            }
            this.syncPresetHighlight();
            this.checkDuplicateTitle();
            this.clearFeedback();
        });

        document.getElementById('ce-presets')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.ce-preset-btn');
            if (!btn) return;
            const preset = EVAL_PRESETS[Number(btn.dataset.presetIdx)];
            if (!preset) return;
            if (tituloEl) {
                tituloEl.value = preset.titulo;
                tituloEl.dispatchEvent(new Event('input'));
                tituloEl.focus();
            }
            this.setTipo(preset.tipo);
            this.setBimestre(preset.bimestre);
            this.setPeso(preset.peso);
            this.syncPresetHighlight();
        });

        document.getElementById('ce-cursos-grid')?.addEventListener('click', async (e) => {
            const opt = e.target.closest('.ce-course-opt');
            if (!opt) return;
            await this.selectCourse(opt.dataset.cursoId);
        });

        document.getElementById('ce-todas-secciones')?.addEventListener('change', () => {
            this.updateDigest();
        });

        document.getElementById('ce-tipo-group')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.ce-type-opt');
            if (!btn) return;
            this.setTipo(btn.dataset.tipo);
            this.syncPresetHighlight();
        });

        document.getElementById('ce-bimestre-group')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-bimestre]');
            if (!btn) return;
            this.setBimestre(Number(btn.dataset.bimestre));
        });

        document.getElementById('ce-peso-group')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-peso]');
            if (!btn) return;
            this.setPeso(parseFloat(btn.dataset.peso));
            this.syncPresetHighlight();
        });

        document.getElementById('ce-escala-group')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-escala]');
            if (!btn) return;
            this.setEscala(Number(btn.dataset.escala));
        });

        document.getElementById('ce-fecha')?.addEventListener('change', () => {
            this.updateDateReadout();
            this.updateDigest();
        });

        document.getElementById('ce-quick-dates')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.ce-date-chip');
            if (!chip) return;
            const days = Number(chip.dataset.days || 0);
            const fechaEl = document.getElementById('ce-fecha');
            if (fechaEl) {
                fechaEl.value = addDaysIso(days);
                this.updateDateReadout();
                this.updateDigest();
            }
        });

        document.getElementById('ce-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitEvaluacion();
        });

        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        this._keyHandler = (e) => {
            if (!document.getElementById('ce-form')) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.submitEvaluacion();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    },

    setTipo(tipo) {
        this.tipo = tipo;
        document.querySelectorAll('#ce-tipo-group .ce-type-opt').forEach(btn => {
            const active = btn.dataset.tipo === tipo;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        this.updateDigest();
    },

    setBimestre(bim) {
        this.bimestre = bim;
        document.querySelectorAll('#ce-bimestre-group [data-bimestre]').forEach(btn => {
            const active = Number(btn.dataset.bimestre) === bim;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        this.updateDigest();
    },

    setPeso(peso) {
        this.peso = peso;
        document.querySelectorAll('#ce-peso-group [data-peso]').forEach(btn => {
            const active = parseFloat(btn.dataset.peso) === peso;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        this.updateDigest();
    },

    setEscala(escala) {
        this.notaMaxima = escala;
        document.querySelectorAll('#ce-escala-group [data-escala]').forEach(btn => {
            const active = Number(btn.dataset.escala) === escala;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        this.updateDigest();
    },

    syncPresetHighlight() {
        const currentTitulo = (document.getElementById('ce-titulo')?.value || '').trim();
        document.querySelectorAll('.ce-preset-btn').forEach(btn => {
            const p = EVAL_PRESETS[Number(btn.dataset.presetIdx)];
            const match = Boolean(
                p &&
                p.titulo === currentTitulo &&
                p.tipo === this.tipo &&
                p.peso === this.peso
            );
            btn.classList.toggle('is-active', match);
        });
    },

    updateAllReadouts() {
        this.updateDateReadout();
        this.updateDigest();
        this.updateBackLinks();
    },

    updateDateReadout() {
        const fechaEl = document.getElementById('ce-fecha');
        const readoutEl = document.getElementById('ce-date-readout');
        if (!readoutEl || !fechaEl) return;
        readoutEl.textContent = formatReadableDate(fechaEl.value);
    },

    updateBackLinks() {
        const cursoSuffix = this.selectedCursoId ? `?curso=${encodeURIComponent(this.selectedCursoId)}` : '';
        const califUrl = `#/calificaciones${cursoSuffix}`;
        const tareaUrl = `#/crear-tarea${cursoSuffix}`;
        document.getElementById('ce-back-link')?.setAttribute('href', califUrl);
        document.getElementById('ce-discard-link')?.setAttribute('href', califUrl);
        document.getElementById('ce-link-crear-tarea')?.setAttribute('href', tareaUrl);
    },

    updateDigest() {
        const cursoEl = document.getElementById('ce-sum-curso');
        const tipoEl = document.getElementById('ce-sum-tipo');
        const bimEl = document.getElementById('ce-sum-bimestre');
        const pesoEl = document.getElementById('ce-sum-peso');
        const fechaEl = document.getElementById('ce-sum-fecha');

        if (cursoEl) {
            const curso = this.cursos.find(c => String(c.id) === String(this.selectedCursoId));
            if (curso) {
                const aula = `${curso.grado || ''} ${curso.seccion || ''}`.trim();
                const multiChecked = document.getElementById('ce-todas-secciones')?.checked;
                const siblingCount = multiChecked ? this.getSiblingSections(curso).length : 1;
                const extra = siblingCount > 1 ? ` (+${siblingCount - 1} ${siblingCount - 1 === 1 ? 'sección' : 'secciones'})` : '';
                cursoEl.textContent = `${curso.nombre} · ${aula}${extra}`;
            } else {
                cursoEl.textContent = 'Sin seleccionar';
            }
        }

        if (tipoEl) {
            const meta = TIPO_META.find(t => t.value === this.tipo);
            tipoEl.textContent = `${meta ? meta.label : this.tipo} · 0–${this.notaMaxima}`;
        }

        if (bimEl) {
            bimEl.textContent = BIMESTRE_LABELS[this.bimestre] || `${this.bimestre}° Bimestre`;
        }

        if (pesoEl) {
            pesoEl.textContent = formatWeightLabel(this.peso);
        }

        if (fechaEl) {
            const iso = document.getElementById('ce-fecha')?.value;
            fechaEl.textContent = formatShortDate(iso);
        }
    },

    showFeedback(type, msg) {
        const box = document.getElementById('ce-feedback');
        if (!box) return;
        box.className = `ce-feedback ${type === 'success' ? 'is-success' : 'is-error'}`;
        box.textContent = msg;
    },

    clearFeedback() {
        const box = document.getElementById('ce-feedback');
        if (!box) return;
        box.className = 'ce-feedback is-hidden';
        box.textContent = '';
    },

    async submitEvaluacion() {
        if (this.isSubmitting) return;
        this.clearFeedback();

        const titulo = (document.getElementById('ce-titulo')?.value || '').trim();
        if (!titulo) {
            this.showFeedback('error', 'Escribe un nombre para la evaluación antes de continuar.');
            document.getElementById('ce-titulo')?.focus();
            return;
        }

        if (!this.selectedCursoId) {
            this.showFeedback('error', 'Selecciona el curso y salón donde se aplicará esta evaluación.');
            return;
        }

        if (this.checkDuplicateTitle()) {
            this.showFeedback('error', `Ya existe "${titulo}" en este salón. Elige otro nombre.`);
            document.getElementById('ce-titulo')?.focus();
            return;
        }

        const btn = document.getElementById('btn-ce-submit');
        const label = document.getElementById('ce-submit-label');
        this.isSubmitting = true;
        if (btn) btn.disabled = true;
        if (label) label.textContent = 'Creando evaluación...';

        const payload = {
            titulo,
            tipo: this.tipo,
            bimestre: this.bimestre,
            peso: this.peso,
            notaMaxima: this.notaMaxima,
            fecha: document.getElementById('ce-fecha')?.value || null,
            aplicarTodasSecciones: Boolean(document.getElementById('ce-todas-secciones')?.checked)
        };
        const irACalificar = Boolean(document.getElementById('ce-ir-a-calificar')?.checked);

        try {
            const res = await API.fetch(`/api/docente/curso/${this.selectedCursoId}/evaluaciones`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res?.cursosCreados > 1) {
                Swal.fire({
                    icon: 'success',
                    title: 'Evaluación creada',
                    text: `Se agregó "${res.evaluacion?.titulo || titulo}" en ${res.cursosCreados} secciones.`,
                    timer: 1900,
                    showConfirmButton: false
                });
            } else if (!irACalificar) {
                Swal.fire({
                    icon: 'success',
                    title: 'Evaluación creada',
                    text: `"${res?.evaluacion?.titulo || titulo}" ya está lista en tu registro.`,
                    timer: 1700,
                    showConfirmButton: false
                });
            }

            const evalQuery = irACalificar && res?.evaluacion?.id
                ? `&eval=${encodeURIComponent(res.evaluacion.id)}`
                : '';
            window.location.hash = `#/calificaciones?curso=${encodeURIComponent(this.selectedCursoId)}${evalQuery}`;
        } catch (err) {
            console.error(err);
            const isDup = String(err?.message || '').includes('409');
            this.showFeedback(
                'error',
                isDup
                    ? 'Ya existe una evaluación con ese mismo nombre en este curso.'
                    : (err?.message || 'No se pudieron validar los datos de la evaluación.')
            );
        } finally {
            this.isSubmitting = false;
            if (btn) btn.disabled = false;
            if (label) label.textContent = 'Crear evaluación';
        }
    }
};
