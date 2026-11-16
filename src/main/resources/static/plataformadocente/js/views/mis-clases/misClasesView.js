import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

const DAYS_SHORT = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ATTENDANCE_STATES = [
    { key: 'PRESENTE', label: 'Presente', short: 'P' },
    { key: 'TARDE', label: 'Tarde', short: 'T' },
    { key: 'AUSENTE', label: 'Ausente', short: 'A' },
    { key: 'JUSTIFICADO', label: 'Justificado', short: 'J' }
];

function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getInitials(nombres, apellidos) {
    const a = String(nombres || '').trim().charAt(0);
    const b = String(apellidos || '').trim().charAt(0);
    return (a + b || 'ES').toUpperCase();
}

function formatNivel(nivel) {
    const raw = String(nivel || '').trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function formatTurno(turno) {
    const raw = String(turno || '').trim().toUpperCase();
    if (!raw) return '';
    if (raw === 'MANANA' || raw === 'MAÑANA') return 'Mañana';
    if (raw === 'TARDE') return 'Tarde';
    if (raw === 'NOCHE') return 'Noche';
    return raw.charAt(0) + raw.slice(1).toLowerCase();
}

function todayLocalIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatFechaHumana(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const weekday = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dt.getDay()];
    return `${weekday} ${String(d).padStart(2, '0')} ${MONTHS_SHORT[m - 1]}, ${y}`;
}

function formatSchedule(curso) {
    const parts = [];
    const day = DAYS_SHORT[Number(curso.diaSemana)];
    if (day && curso.horaInicio && curso.horaFin) {
        parts.push(`${day} ${curso.horaInicio}–${curso.horaFin}`);
    } else if (curso.horaInicio && curso.horaFin) {
        parts.push(`${curso.horaInicio}–${curso.horaFin}`);
    }
    const lvl = formatNivel(curso.nivel);
    if (lvl) parts.push(lvl);
    return parts.join(' · ');
}

function sortCourses(a, b) {
    const niv = String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es');
    if (niv !== 0) return niv;
    const ga = parseInt(a.grado, 10);
    const gb = parseInt(b.grado, 10);
    if (!Number.isNaN(ga) && !Number.isNaN(gb) && ga !== gb) return ga - gb;
    const gStr = String(a.grado || '').localeCompare(String(b.grado || ''), 'es');
    if (gStr !== 0) return gStr;
    const sec = String(a.seccion || '').localeCompare(String(b.seccion || ''), 'es');
    if (sec !== 0) return sec;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
}

export const MisClasesView = {
    allItems: [],
    courseById: new Map(),
    activeFilter: 'ALL',
    searchTerm: '',
    activeCurso: null,
    currentStudents: [],
    currentAttendanceCursoId: null,
    currentAttendanceFecha: null,
    attendanceDirty: false,
    _closeTimers: new Map(),
    _keydownHandler: null,
    _hashCleanupHandler: null,

    async render() {
        return `
            <div class="mc-page" id="mc-root">
                <header class="mc-masthead">
                    <div class="mc-masthead-copy">
                        <p class="mc-kicker" id="mc-kicker">CARGA ACADÉMICA · DOCENTE</p>
                        <h2 class="mc-title">Mis Clases</h2>
                        <p class="mc-subtitle">Nóminas de sección, control diario de asistencia y acceso directo a calificación.</p>
                    </div>
                    <div class="mc-masthead-stats" id="mc-summary-stats">
                        <div class="mc-stat-col">
                            <span class="mc-stat-num" id="mc-total-aulas">—</span>
                            <span class="mc-stat-label">AULAS</span>
                        </div>
                        <div class="mc-stat-col">
                            <span class="mc-stat-num" id="mc-total-alumnos">—</span>
                            <span class="mc-stat-label">ESTUDIANTES</span>
                        </div>
                        <div class="mc-stat-col">
                            <span class="mc-stat-num" id="mc-total-tareas">—</span>
                            <span class="mc-stat-label">TAREAS</span>
                        </div>
                    </div>
                </header>

                <div class="mc-toolbar" id="mc-toolbar">
                    <nav class="mc-tabs" id="mc-grade-tabs" aria-label="Filtrar clases"></nav>
                    <div class="mc-search-wrap">
                        <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
                        <input type="search" id="mc-search-input" class="mc-bare-input" placeholder="Buscar sección, materia o turno…" autocomplete="off">
                    </div>
                </div>

                <section class="mc-ledger" id="mc-ledger" aria-live="polite">
                    <div class="mc-loading">
                        <span class="mc-loading-dot"></span>
                        <span>Cargando carga académica…</span>
                    </div>
                </section>
            </div>

            <!-- Ventanilla Expandida: Nómina de Estudiantes -->
            <div class="mc-sheet-backdrop" id="students-modal" aria-hidden="true">
                <div class="mc-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="modal-course-name">
                    <header class="mc-sheet-head">
                        <div class="mc-sheet-top">
                            <span class="mc-sheet-kicker" id="students-sheet-kicker">NÓMINA DE SECCIÓN</span>
                            <div class="mc-sheet-top-actions">
                                <button type="button" class="mc-sheet-switch" id="students-to-attendance">
                                    <i class="ph ph-calendar-check"></i>
                                    <span>Tomar asistencia</span>
                                </button>
                                <button type="button" class="mc-sheet-close" id="close-students-modal" aria-label="Cerrar ventana">
                                    <i class="ph ph-x"></i>
                                </button>
                            </div>
                        </div>
                        <div class="mc-sheet-headline">
                            <div>
                                <h3 class="mc-sheet-title" id="modal-course-name">Estudiantes</h3>
                                <p class="mc-sheet-sub" id="modal-course-info"></p>
                            </div>
                        </div>
                    </header>

                    <div class="mc-sheet-bar">
                        <div class="mc-search-wrap mc-sheet-search">
                            <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
                            <input type="search" id="students-search-input" class="mc-bare-input" placeholder="Filtrar por nombre, correo o DNI…" autocomplete="off">
                        </div>
                        <span class="mc-sheet-count" id="students-count-label">—</span>
                    </div>

                    <div class="mc-sheet-body">
                        <table class="mc-table mc-table-students">
                            <thead>
                                <tr>
                                    <th class="col-idx">#</th>
                                    <th>Estudiante</th>
                                    <th>Contacto</th>
                                    <th class="col-dni">DNI</th>
                                    <th class="col-status">Estado</th>
                                    <th class="col-actions">Expediente</th>
                                </tr>
                            </thead>
                            <tbody id="students-list-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Ventanilla Expandida: Registro de Asistencia -->
            <div class="mc-sheet-backdrop" id="attendance-modal" aria-hidden="true">
                <div class="mc-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="attendance-course-name">
                    <header class="mc-sheet-head">
                        <div class="mc-sheet-top">
                            <span class="mc-sheet-kicker" id="attendance-sheet-kicker">REGISTRO DE ASISTENCIA</span>
                            <div class="mc-sheet-top-actions">
                                <button type="button" class="mc-sheet-switch" id="attendance-to-students">
                                    <i class="ph ph-users"></i>
                                    <span>Ver nómina</span>
                                </button>
                                <button type="button" class="mc-sheet-close" id="close-attendance-modal" aria-label="Cerrar ventana">
                                    <i class="ph ph-x"></i>
                                </button>
                            </div>
                        </div>
                        <div class="mc-sheet-headline is-split">
                            <div>
                                <h3 class="mc-sheet-title" id="attendance-course-name">Asistencia</h3>
                                <p class="mc-sheet-sub" id="attendance-course-info"></p>
                            </div>
                            <div class="mc-att-telemetry" id="attendance-telemetry">
                                <div class="mc-tel-item is-presente">
                                    <span class="mc-tel-num" id="att-count-presente">0</span>
                                    <span class="mc-tel-lbl">Presentes</span>
                                </div>
                                <div class="mc-tel-item is-tarde">
                                    <span class="mc-tel-num" id="att-count-tarde">0</span>
                                    <span class="mc-tel-lbl">Tardanzas</span>
                                </div>
                                <div class="mc-tel-item is-ausente">
                                    <span class="mc-tel-num" id="att-count-ausente">0</span>
                                    <span class="mc-tel-lbl">Ausentes</span>
                                </div>
                                <div class="mc-tel-item is-justificado">
                                    <span class="mc-tel-num" id="att-count-justificado">0</span>
                                    <span class="mc-tel-lbl">Justificados</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div class="mc-sheet-bar is-attendance">
                        <div class="mc-date-controls">
                            <div class="mc-date-field" id="attendance-select-wrap">
                                <label for="attendance-class-date">Sesión</label>
                                <select id="attendance-class-date" class="mc-date-select"></select>
                            </div>
                            <div class="mc-date-field">
                                <label for="attendance-custom-date">Fecha</label>
                                <input type="date" id="attendance-custom-date" class="mc-date-input">
                            </div>
                        </div>
                        <button type="button" id="mark-all-present" class="mc-action-btn">
                            <i class="ph ph-checks"></i>
                            <span>Marcar todos presentes</span>
                        </button>
                    </div>

                    <div class="mc-sheet-body">
                        <table class="mc-table mc-table-attendance">
                            <thead>
                                <tr>
                                    <th class="col-idx">#</th>
                                    <th>Estudiante</th>
                                    <th class="col-reg">Estado previo</th>
                                    <th class="col-seg">Asistencia del día</th>
                                </tr>
                            </thead>
                            <tbody id="attendance-list-body"></tbody>
                        </table>
                    </div>

                    <footer class="mc-sheet-foot">
                        <div class="mc-save-feedback" id="attendance-feedback" role="status" aria-live="polite"></div>
                        <div class="mc-foot-actions">
                            <button type="button" class="mc-action-btn" id="cancel-attendance-modal">Cerrar</button>
                            <button type="button" id="save-attendance" class="mc-action-btn is-primary" disabled>
                                <i class="ph ph-floppy-disk"></i>
                                <span>Guardar asistencia</span>
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        `;
    },

    async afterRender(queryString) {
        const user = Auth.getUser();
        if (!user) return;

        this.allItems = [];
        this.courseById = new Map();
        this.activeFilter = 'ALL';
        this.searchTerm = '';
        this.activeCurso = null;
        this.currentStudents = [];
        this.currentAttendanceCursoId = null;
        this.currentAttendanceFecha = null;
        this.attendanceDirty = false;
        document.body.classList.remove('mc-modal-open');

        this.bindEvents();

        try {
            const [dashboard, cursosFallback] = await Promise.all([
                CursoService.getDashboard(user.email).catch(() => null),
                CursoService.getCursosUnicos(user.email).catch(() => [])
            ]);

            let normalized = [];
            if (dashboard && Array.isArray(dashboard.cursos) && dashboard.cursos.length > 0) {
                normalized = dashboard.cursos.map(entry => {
                    const c = entry.curso || entry;
                    return {
                        ...c,
                        alumnos: typeof entry.alumnos === 'number' ? entry.alumnos : null,
                        tareas: typeof entry.tareas === 'number' ? entry.tareas : 0
                    };
                });
            } else if (Array.isArray(cursosFallback)) {
                normalized = cursosFallback.map(c => ({ ...c, alumnos: null, tareas: 0 }));
            }

            normalized.sort(sortCourses);
            this.allItems = normalized;
            this.courseById = new Map(normalized.map(c => [String(c.id), c]));

            this.renderHeaderSummary();
            this.renderTabs();
            this.renderLedger();

            const params = new URLSearchParams(queryString || '');
            const targetCursoId = params.get('curso');
            const isAsistencia = params.get('asistencia') === '1';

            if (targetCursoId) {
                const target = this.courseById.get(String(targetCursoId));
                if (target) {
                    if (isAsistencia) {
                        this.abrirAsistencia(target.id);
                    } else {
                        this.verEstudiantes(target.id);
                    }
                }
            }
        } catch (err) {
            console.error('Error cargando Mis Clases:', err);
            const ledger = document.getElementById('mc-ledger');
            if (ledger) {
                ledger.innerHTML = `<div class="mc-empty">No se pudieron cargar tus cursos en este momento.</div>`;
            }
        }
    },

    bindEvents() {
        const ledger = document.getElementById('mc-ledger');
        const tabs = document.getElementById('mc-grade-tabs');
        const searchInput = document.getElementById('mc-search-input');
        const studentsSearch = document.getElementById('students-search-input');
        const studentsModal = document.getElementById('students-modal');
        const attendanceModal = document.getElementById('attendance-modal');

        tabs?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            this.activeFilter = btn.getAttribute('data-filter') || 'ALL';
            this.renderTabs();
            this.renderLedger();
        });

        searchInput?.addEventListener('input', (e) => {
            this.searchTerm = (e.target.value || '').trim().toLowerCase();
            this.renderLedger();
        });

        ledger?.addEventListener('click', (e) => {
            const trigger = e.target.closest('[data-action][data-curso-id]');
            if (!trigger) return;
            const action = trigger.getAttribute('data-action');
            const cursoId = trigger.getAttribute('data-curso-id');
            if (action === 'students') {
                this.verEstudiantes(cursoId);
            } else if (action === 'attendance') {
                this.abrirAsistencia(cursoId);
            }
        });

        studentsSearch?.addEventListener('input', () => {
            this.renderStudentRows();
        });

        document.getElementById('students-list-body')?.addEventListener('click', (e) => {
            if (e.target.closest('a[href^="#/estudiante-perfil"]')) {
                document.body.classList.remove('mc-modal-open');
            }
        });

        document.getElementById('close-students-modal')?.addEventListener('click', () => this.closeModal('students-modal'));
        document.getElementById('close-attendance-modal')?.addEventListener('click', () => this.closeModal('attendance-modal'));
        document.getElementById('cancel-attendance-modal')?.addEventListener('click', () => this.closeModal('attendance-modal'));

        document.getElementById('students-to-attendance')?.addEventListener('click', () => {
            const cursoId = this.activeCurso?.id;
            if (!cursoId) return;
            this.closeModal('students-modal', () => this.abrirAsistencia(cursoId));
        });

        document.getElementById('attendance-to-students')?.addEventListener('click', () => {
            const cursoId = this.activeCurso?.id || this.currentAttendanceCursoId;
            if (!cursoId) return;
            this.closeModal('attendance-modal', () => this.verEstudiantes(cursoId));
        });

        [studentsModal, attendanceModal].forEach(backdrop => {
            backdrop?.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.closeModal(backdrop.id);
                }
            });
        });

        document.getElementById('attendance-class-date')?.addEventListener('change', (e) => {
            const fecha = e.target.value;
            if (!fecha) return;
            const dateInput = document.getElementById('attendance-custom-date');
            if (dateInput) dateInput.value = fecha;
            this.currentAttendanceFecha = fecha;
            this.cargarAsistencia(fecha);
        });

        document.getElementById('attendance-custom-date')?.addEventListener('change', (e) => {
            const fecha = e.target.value;
            if (!fecha) return;
            const sel = document.getElementById('attendance-class-date');
            if (sel) {
                const match = Array.from(sel.options).find(opt => opt.value === fecha);
                if (match) sel.value = fecha;
            }
            this.currentAttendanceFecha = fecha;
            this.cargarAsistencia(fecha);
        });

        document.getElementById('attendance-list-body')?.addEventListener('click', (e) => {
            const segBtn = e.target.closest('.mc-seg-btn[data-val]');
            if (!segBtn) return;
            const row = segBtn.closest('tr[data-estudiante-id]');
            if (!row) return;
            const val = segBtn.getAttribute('data-val');
            this.setRowAttendanceState(row, val);
            this.attendanceDirty = true;
            this.updateAttendanceTelemetry();
            this.clearAttendanceFeedback();
        });

        document.getElementById('mark-all-present')?.addEventListener('click', () => {
            const rows = document.querySelectorAll('#attendance-list-body tr[data-estudiante-id]');
            if (!rows.length) return;
            rows.forEach(row => this.setRowAttendanceState(row, 'PRESENTE'));
            this.attendanceDirty = true;
            this.updateAttendanceTelemetry();
            this.setAttendanceFeedback('Todos marcados como Presente. Guarda para confirmar.', 'info');
        });

        document.getElementById('save-attendance')?.addEventListener('click', () => this.guardarAsistencia());

        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
        }
        this._keydownHandler = (e) => {
            if (e.key !== 'Escape') return;
            if (document.getElementById('attendance-modal')?.classList.contains('is-open')) {
                this.closeModal('attendance-modal');
            } else if (document.getElementById('students-modal')?.classList.contains('is-open')) {
                this.closeModal('students-modal');
            }
        };
        document.addEventListener('keydown', this._keydownHandler);

        if (this._hashCleanupHandler) {
            window.removeEventListener('hashchange', this._hashCleanupHandler);
        }
        this._hashCleanupHandler = () => {
            document.body.classList.remove('mc-modal-open');
            if (this._keydownHandler) {
                document.removeEventListener('keydown', this._keydownHandler);
                this._keydownHandler = null;
            }
        };
        window.addEventListener('hashchange', this._hashCleanupHandler, { once: true });
    },

    renderHeaderSummary() {
        const kickerEl = document.getElementById('mc-kicker');
        const aulasEl = document.getElementById('mc-total-aulas');
        const alumnosEl = document.getElementById('mc-total-alumnos');
        const tareasEl = document.getElementById('mc-total-tareas');

        const niveles = [...new Set(this.allItems.map(c => formatNivel(c.nivel).toUpperCase()).filter(Boolean))];
        const turnos = [...new Set(this.allItems.map(c => formatTurno(c.turno).toUpperCase()).filter(Boolean))];
        if (kickerEl) {
            const parts = ['CARGA ACADÉMICA', ...niveles, ...turnos];
            kickerEl.textContent = parts.join(' · ');
        }

        const totalAulas = this.allItems.length;
        const hasAlumnos = this.allItems.some(c => typeof c.alumnos === 'number');
        const totalAlumnos = hasAlumnos
            ? this.allItems.reduce((acc, c) => acc + (c.alumnos || 0), 0)
            : '—';
        const totalTareas = this.allItems.reduce((acc, c) => acc + (c.tareas || 0), 0);

        if (aulasEl) aulasEl.textContent = String(totalAulas).padStart(2, '0');
        if (alumnosEl) alumnosEl.textContent = typeof totalAlumnos === 'number' ? String(totalAlumnos).padStart(2, '0') : '—';
        if (tareasEl) tareasEl.textContent = String(totalTareas).padStart(2, '0');
    },

    renderTabs() {
        const nav = document.getElementById('mc-grade-tabs');
        if (!nav) return;

        const groups = new Map();
        this.allItems.forEach(item => {
            const key = `${item.nivel || ''}|${item.grado || ''}`;
            const label = `${item.grado || ''}° ${formatNivel(item.nivel)}`.trim();
            if (!groups.has(key)) groups.set(key, { key, label, count: 0 });
            groups.get(key).count += 1;
        });

        const html = [
            `<button type="button" class="mc-tab ${this.activeFilter === 'ALL' ? 'is-active' : ''}" data-filter="ALL">
                Todas <span class="mc-tab-count">${this.allItems.length}</span>
            </button>`,
            ...Array.from(groups.values()).map(g => `
                <button type="button" class="mc-tab ${this.activeFilter === g.key ? 'is-active' : ''}" data-filter="${escapeHtml(g.key)}">
                    ${escapeHtml(g.label)} <span class="mc-tab-count">${g.count}</span>
                </button>
            `)
        ].join('');

        nav.innerHTML = html;
    },

    renderLedger() {
        const ledger = document.getElementById('mc-ledger');
        if (!ledger) return;

        if (!this.allItems.length) {
            ledger.innerHTML = `<div class="mc-empty">No tienes cursos asignados en este periodo académico.</div>`;
            return;
        }

        const filtered = this.allItems.filter(c => {
            const key = `${c.nivel || ''}|${c.grado || ''}`;
            if (this.activeFilter !== 'ALL' && key !== this.activeFilter) return false;
            if (this.searchTerm) {
                const hay = [
                    c.nombre,
                    c.nivel,
                    `${c.grado} ${c.seccion}`,
                    `${c.grado}° ${c.seccion}`,
                    c.turno,
                    c.horaInicio,
                    c.horaFin
                ].join(' ').toLowerCase();
                if (!hay.includes(this.searchTerm)) return false;
            }
            return true;
        });

        if (!filtered.length) {
            ledger.innerHTML = `<div class="mc-empty">Ninguna clase coincide con tu búsqueda actual.</div>`;
            return;
        }

        const grouped = new Map();
        filtered.forEach(c => {
            const key = `${c.nivel || ''}|${c.grado || ''}`;
            if (!grouped.has(key)) grouped.set(key, { nivel: c.nivel, grado: c.grado, items: [] });
            grouped.get(key).items.push(c);
        });

        let rowCounter = 0;
        const groupsHtml = Array.from(grouped.values()).map((grp, grpIdx) => {
            const secWord = grp.items.length === 1 ? 'sección' : 'secciones';
            const hasAlu = grp.items.some(i => typeof i.alumnos === 'number');
            const totalAlu = grp.items.reduce((s, i) => s + (i.alumnos || 0), 0);
            const aluText = hasAlu ? ` · ${totalAlu} estudiantes` : '';
            const grpTitle = `${grp.grado || ''}° Grado · ${formatNivel(grp.nivel) || 'General'}`;

            const rowsHtml = grp.items.map(c => {
                const idx = rowCounter++;
                const sched = formatSchedule(c);
                const alumnosText = typeof c.alumnos === 'number' ? c.alumnos : '—';

                return `
                    <article class="mc-row" data-curso-id="${escapeHtml(c.id)}" style="--mc-i:${idx};">
                        <div class="mc-col-section">
                            <button type="button" class="mc-section-trigger" data-action="students" data-curso-id="${escapeHtml(c.id)}" title="Ver nómina de estudiantes">
                                <span class="mc-section-code">${escapeHtml(c.grado || '')}° ${escapeHtml(c.seccion || '')}</span>
                                <span class="mc-section-turno">${escapeHtml(formatTurno(c.turno) || 'Regular')}</span>
                            </button>
                        </div>

                        <div class="mc-col-subject">
                            <button type="button" class="mc-subject-link" data-action="students" data-curso-id="${escapeHtml(c.id)}">
                                ${escapeHtml(c.nombre)}
                            </button>
                            <div class="mc-subject-meta">${escapeHtml(sched || 'Sin horario definido')}</div>
                        </div>

                        <div class="mc-col-metric">
                            <button type="button" class="mc-metric-trigger" data-action="students" data-curso-id="${escapeHtml(c.id)}">
                                <span class="mc-metric-val">${escapeHtml(alumnosText)}</span>
                                <span class="mc-metric-lbl">alumnos</span>
                            </button>
                        </div>

                        <div class="mc-col-metric is-secondary">
                            <div class="mc-metric-static">
                                <span class="mc-metric-val">${escapeHtml(c.tareas ?? 0)}</span>
                                <span class="mc-metric-lbl">tareas</span>
                            </div>
                        </div>

                        <div class="mc-col-actions">
                            <button type="button" class="mc-action-btn" data-action="students" data-curso-id="${escapeHtml(c.id)}">
                                <i class="ph ph-users"></i>
                                <span>Estudiantes</span>
                            </button>
                            <button type="button" class="mc-action-btn is-accent" data-action="attendance" data-curso-id="${escapeHtml(c.id)}">
                                <i class="ph ph-calendar-check"></i>
                                <span>Asistencia</span>
                            </button>
                            <div class="mc-inline-links">
                                <a class="mc-text-link" href="#/calificaciones?curso=${encodeURIComponent(c.id)}">Notas</a>
                                <span class="mc-link-sep" aria-hidden="true">/</span>
                                <a class="mc-text-link" href="#/foros?curso=${encodeURIComponent(c.id)}">Foro</a>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');

            return `
                <section class="mc-group">
                    <div class="mc-group-head">
                        <div class="mc-group-title-wrap">
                            <span class="mc-group-index">${String(grpIdx + 1).padStart(2, '0')}</span>
                            <h3 class="mc-group-title">${escapeHtml(grpTitle)}</h3>
                        </div>
                        <span class="mc-group-meta">${grp.items.length} ${secWord}${aluText}</span>
                    </div>
                    <div class="mc-group-rows">
                        ${rowsHtml}
                    </div>
                </section>
            `;
        }).join('');

        ledger.innerHTML = groupsHtml;
    },

    openModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;

        const prevTimer = this._closeTimers.get(modalId);
        if (prevTimer) {
            clearTimeout(prevTimer);
            this._closeTimers.delete(modalId);
        }

        el.classList.remove('is-closing');
        el.setAttribute('aria-hidden', 'false');
        document.body.classList.add('mc-modal-open');

        // Force style flush so initial pre-open transform cleanly transitions
        void el.offsetWidth;
        requestAnimationFrame(() => {
            el.classList.add('is-open');
        });
    },

    closeModal(modalId, onClosed) {
        const el = document.getElementById(modalId);
        if (!el) {
            if (onClosed) onClosed();
            return;
        }
        if (!el.classList.contains('is-open')) {
            el.classList.remove('is-closing');
            el.setAttribute('aria-hidden', 'true');
            if (onClosed) onClosed();
            return;
        }

        el.classList.add('is-closing');
        el.classList.remove('is-open');
        el.setAttribute('aria-hidden', 'true');

        const prevTimer = this._closeTimers.get(modalId);
        if (prevTimer) clearTimeout(prevTimer);

        const timer = setTimeout(() => {
            el.classList.remove('is-closing');
            this._closeTimers.delete(modalId);

            const anyStillOpen = document.querySelector('.mc-sheet-backdrop.is-open');
            if (!anyStillOpen) {
                document.body.classList.remove('mc-modal-open');
            }
            if (typeof onClosed === 'function') onClosed();
        }, 250);

        this._closeTimers.set(modalId, timer);
    },

    async verEstudiantes(cursoId) {
        const curso = this.courseById.get(String(cursoId));
        this.activeCurso = curso || { id: cursoId, nombre: 'Curso' };

        const kicker = document.getElementById('students-sheet-kicker');
        const title = document.getElementById('modal-course-name');
        const info = document.getElementById('modal-course-info');
        const searchInput = document.getElementById('students-search-input');
        const countEl = document.getElementById('students-count-label');
        const tbody = document.getElementById('students-list-body');

        const secLabel = curso ? `${curso.grado || ''}° ${curso.seccion || ''}`.trim() : '';
        if (kicker) kicker.textContent = `NÓMINA DE SECCIÓN · AULA ${cursoId}`;
        if (title) title.textContent = secLabel ? `${curso.nombre} — ${secLabel}` : (curso?.nombre || 'Estudiantes');
        if (info) info.textContent = curso ? `${formatSchedule(curso)} · Turno ${formatTurno(curso.turno) || 'Regular'}` : '';
        if (searchInput) searchInput.value = '';
        if (countEl) countEl.textContent = 'Cargando…';
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="mc-table-msg">Consultando nómina de estudiantes…</td></tr>`;
        }

        this.openModal('students-modal');

        try {
            const estudiantes = await API.fetch(`/api/docente/curso/${cursoId}/estudiantes`);
            this.currentStudents = Array.isArray(estudiantes) ? estudiantes : [];
            this.renderStudentRows();
        } catch (err) {
            console.error('Error cargando estudiantes:', err);
            this.currentStudents = [];
            if (countEl) countEl.textContent = 'Error';
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="mc-table-msg is-error">Error al cargar la lista de estudiantes.</td></tr>`;
            }
        }
    },

    renderStudentRows() {
        const tbody = document.getElementById('students-list-body');
        const countEl = document.getElementById('students-count-label');
        const query = (document.getElementById('students-search-input')?.value || '').trim().toLowerCase();
        const cursoId = this.activeCurso?.id;

        if (!tbody) return;

        const list = this.currentStudents.filter(est => {
            if (!query) return true;
            const hay = `${est.nombres || ''} ${est.apellidos || ''} ${est.email || ''} ${est.dni || ''}`.toLowerCase();
            return hay.includes(query);
        });

        if (countEl) {
            const total = this.currentStudents.length;
            countEl.textContent = query
                ? `${list.length} de ${total} estudiantes`
                : `${total} estudiante${total === 1 ? '' : 's'}`;
        }

        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="mc-table-msg">${
                this.currentStudents.length
                    ? 'Ningún estudiante coincide con el filtro ingresado.'
                    : 'No hay estudiantes matriculados en esta sección.'
            }</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map((est, idx) => {
            const fullName = `${est.nombres || ''} ${est.apellidos || ''}`.trim();
            const ini = getInitials(est.nombres, est.apellidos);
            const profileUrl = `#/estudiante-perfil?id=${encodeURIComponent(est.id)}&curso=${encodeURIComponent(cursoId || '')}&from=mis-clases`;
            const contacto = [est.email, est.telefono ? `Tel. ${est.telefono}` : ''].filter(Boolean).join(' · ');

            return `
                <tr class="mc-roster-row" style="--mc-ri:${Math.min(idx, 18)};">
                    <td class="col-idx">${String(idx + 1).padStart(2, '0')}</td>
                    <td>
                        <div class="mc-student-cell">
                            <span class="mc-monogram" aria-hidden="true">${escapeHtml(ini)}</span>
                            <a href="${profileUrl}" class="mc-student-name">${escapeHtml(fullName)}</a>
                        </div>
                    </td>
                    <td class="mc-cell-muted">${escapeHtml(contacto || '—')}</td>
                    <td class="col-dni mc-cell-mono">${escapeHtml(est.dni || '—')}</td>
                    <td class="col-status">
                        <span class="mc-status-dot is-active"><i aria-hidden="true"></i>Activo</span>
                    </td>
                    <td class="col-actions">
                        <a href="${profileUrl}" class="mc-profile-link">
                            <span>Expediente</span>
                            <i class="ph ph-arrow-up-right" aria-hidden="true"></i>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async abrirAsistencia(cursoId) {
        const curso = this.courseById.get(String(cursoId));
        this.activeCurso = curso || { id: cursoId, nombre: 'Curso' };
        this.currentAttendanceCursoId = cursoId;
        this.attendanceDirty = false;
        this.clearAttendanceFeedback();

        const kicker = document.getElementById('attendance-sheet-kicker');
        const title = document.getElementById('attendance-course-name');
        const info = document.getElementById('attendance-course-info');
        const selWrap = document.getElementById('attendance-select-wrap');
        const select = document.getElementById('attendance-class-date');
        const dateInput = document.getElementById('attendance-custom-date');
        const saveBtn = document.getElementById('save-attendance');
        const tbody = document.getElementById('attendance-list-body');

        const secLabel = curso ? `${curso.grado || ''}° ${curso.seccion || ''}`.trim() : '';
        if (kicker) kicker.textContent = `CONTROL DE ASISTENCIA · AULA ${cursoId}`;
        if (title) title.textContent = secLabel ? `${curso.nombre} — ${secLabel}` : (curso?.nombre || 'Asistencia');
        if (info) info.textContent = curso ? `${formatSchedule(curso)} · Turno ${formatTurno(curso.turno) || 'Regular'}` : '';
        if (saveBtn) saveBtn.disabled = true;
        if (select) select.innerHTML = `<option value="">Cargando sesiones…</option>`;
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="mc-table-msg">Cargando sesiones de clase…</td></tr>`;
        this.resetAttendanceTelemetry();

        this.openModal('attendance-modal');

        try {
            const dias = await API.fetch(`/api/docente/curso/${cursoId}/asistencia/dias`);
            const hoy = todayLocalIso();

            if (Array.isArray(dias) && dias.length > 0) {
                if (selWrap) selWrap.style.display = '';
                select.innerHTML = dias.map(d => {
                    const mark = d.registrados > 0 ? `✓ ${d.registrados}/${d.totalEstudiantes}` : `Pendiente (${d.totalEstudiantes || 0})`;
                    return `<option value="${escapeHtml(d.fecha)}">${escapeHtml(formatFechaHumana(d.fecha))} · ${escapeHtml(d.hora || '')} · ${mark}</option>`;
                }).join('');

                const hoyItem = dias.find(d => d.fecha === hoy);
                const selectedFecha = hoyItem ? hoy : dias[0].fecha;
                select.value = selectedFecha;
                if (dateInput) dateInput.value = selectedFecha;
                this.currentAttendanceFecha = selectedFecha;
                await this.cargarAsistencia(selectedFecha);
            } else {
                if (selWrap) selWrap.style.display = 'none';
                if (dateInput) dateInput.value = hoy;
                this.currentAttendanceFecha = hoy;
                this.setAttendanceFeedback('Sin sesiones programadas; registrando para la fecha seleccionada.', 'info');
                await this.cargarAsistencia(hoy);
            }
        } catch (err) {
            console.error('Error cargando días de asistencia:', err);
            const hoy = todayLocalIso();
            if (selWrap) selWrap.style.display = 'none';
            if (dateInput) dateInput.value = hoy;
            this.currentAttendanceFecha = hoy;
            await this.cargarAsistencia(hoy);
        }
    },

    async cargarAsistencia(fechaOverride) {
        const fecha = fechaOverride
            || document.getElementById('attendance-custom-date')?.value
            || document.getElementById('attendance-class-date')?.value
            || todayLocalIso();
        const cursoId = this.currentAttendanceCursoId;
        const tbody = document.getElementById('attendance-list-body');
        const saveBtn = document.getElementById('save-attendance');
        if (!cursoId || !tbody) return;

        this.currentAttendanceFecha = fecha;
        this.attendanceDirty = false;
        tbody.innerHTML = `<tr><td colspan="4" class="mc-table-msg">Cargando lista del ${escapeHtml(formatFechaHumana(fecha))}…</td></tr>`;
        if (saveBtn) saveBtn.disabled = true;

        try {
            const data = await API.fetch(`/api/docente/curso/${cursoId}/asistencia?fecha=${encodeURIComponent(fecha)}`);
            const lista = Array.isArray(data?.estudiantes) ? data.estudiantes : [];

            if (!lista.length) {
                tbody.innerHTML = `<tr><td colspan="4" class="mc-table-msg">No hay estudiantes inscritos en este curso.</td></tr>`;
                this.resetAttendanceTelemetry();
                return;
            }

            tbody.innerHTML = lista.map((est, idx) => {
                const fullName = `${est.nombres || ''} ${est.apellidos || ''}`.trim();
                const estado = ATTENDANCE_STATES.some(s => s.key === est.estado) ? est.estado : 'PRESENTE';
                const regClass = est.registrado ? 'is-saved' : 'is-pending';
                const regLabel = est.registrado ? 'Guardado' : 'Sin registrar';

                const segButtons = ATTENDANCE_STATES.map(st => `
                    <button type="button"
                        class="mc-seg-btn is-${st.key.toLowerCase()} ${estado === st.key ? 'is-active' : ''}"
                        data-val="${st.key}"
                        aria-pressed="${estado === st.key ? 'true' : 'false'}">
                        ${st.label}
                    </button>
                `).join('');

                return `
                    <tr class="mc-roster-row" data-estudiante-id="${escapeHtml(est.estudianteId)}" data-estado="${estado}" style="--mc-ri:${Math.min(idx, 18)};">
                        <td class="col-idx">${String(idx + 1).padStart(2, '0')}</td>
                        <td>
                            <div class="mc-att-student">
                                <span class="mc-att-name">${escapeHtml(fullName)}</span>
                                <span class="mc-att-email">${escapeHtml(est.email || '')}</span>
                            </div>
                        </td>
                        <td class="col-reg">
                            <span class="mc-status-dot ${regClass}"><i aria-hidden="true"></i>${regLabel}</span>
                        </td>
                        <td class="col-seg">
                            <div class="mc-seg-group" role="group" aria-label="Asistencia de ${escapeHtml(fullName)}">
                                ${segButtons}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            if (saveBtn) saveBtn.disabled = false;
            this.updateAttendanceTelemetry();
        } catch (err) {
            console.error('Error al cargar asistencia:', err);
            tbody.innerHTML = `<tr><td colspan="4" class="mc-table-msg is-error">Error al cargar asistencia del día.</td></tr>`;
            this.resetAttendanceTelemetry();
        }
    },

    setRowAttendanceState(row, nextEstado) {
        row.setAttribute('data-estado', nextEstado);
        row.querySelectorAll('.mc-seg-btn').forEach(btn => {
            const active = btn.getAttribute('data-val') === nextEstado;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    },

    resetAttendanceTelemetry() {
        ['presente', 'tarde', 'ausente', 'justificado'].forEach(k => {
            const el = document.getElementById(`att-count-${k}`);
            if (el) el.textContent = '0';
        });
    },

    updateAttendanceTelemetry() {
        const counts = { PRESENTE: 0, TARDE: 0, AUSENTE: 0, JUSTIFICADO: 0 };
        document.querySelectorAll('#attendance-list-body tr[data-estudiante-id]').forEach(row => {
            const st = row.getAttribute('data-estado');
            if (st in counts) counts[st] += 1;
        });
        document.getElementById('att-count-presente').textContent = String(counts.PRESENTE);
        document.getElementById('att-count-tarde').textContent = String(counts.TARDE);
        document.getElementById('att-count-ausente').textContent = String(counts.AUSENTE);
        document.getElementById('att-count-justificado').textContent = String(counts.JUSTIFICADO);
    },

    clearAttendanceFeedback() {
        const fb = document.getElementById('attendance-feedback');
        if (!fb) return;
        fb.textContent = '';
        fb.className = 'mc-save-feedback';
    },

    setAttendanceFeedback(message, tone = 'success') {
        const fb = document.getElementById('attendance-feedback');
        if (!fb) return;
        fb.textContent = message;
        fb.className = `mc-save-feedback is-visible is-${tone}`;
    },

    async guardarAsistencia() {
        const cursoId = this.currentAttendanceCursoId;
        const fecha = this.currentAttendanceFecha
            || document.getElementById('attendance-custom-date')?.value
            || document.getElementById('attendance-class-date')?.value;
        if (!cursoId || !fecha) return;

        const saveBtn = document.getElementById('save-attendance');
        const rows = Array.from(document.querySelectorAll('#attendance-list-body tr[data-estudiante-id]'));
        if (!rows.length) return;

        const registros = rows.map(row => ({
            estudianteId: Number(row.getAttribute('data-estudiante-id')),
            estado: row.getAttribute('data-estado') || 'PRESENTE'
        }));

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i class="ph ph-spinner"></i><span>Guardando…</span>`;
        }

        try {
            const saved = await API.fetch(`/api/docente/curso/${cursoId}/asistencia?fecha=${encodeURIComponent(fecha)}`, {
                method: 'POST',
                body: JSON.stringify(registros)
            });

            if (saved !== null && saved !== undefined) {
                this.attendanceDirty = false;
                rows.forEach(row => {
                    const dot = row.querySelector('.mc-status-dot');
                    if (dot) {
                        dot.className = 'mc-status-dot is-saved';
                        dot.innerHTML = `<i aria-hidden="true"></i>Guardado`;
                    }
                });
                const sel = document.getElementById('attendance-class-date');
                if (sel) {
                    const opt = Array.from(sel.options).find(o => o.value === fecha);
                    if (opt) {
                        opt.textContent = opt.textContent.replace(/Pendiente.*$|✓.*$/, `✓ ${registros.length}/${registros.length}`);
                    }
                }
                if (window.ShidellFun?.celebrar) window.ShidellFun.celebrar();
                this.setAttendanceFeedback(`Asistencia del ${formatFechaHumana(fecha)} guardada (${registros.length} registros).`, 'success');
            } else {
                this.setAttendanceFeedback('No pudimos guardar la asistencia. Inténtalo de nuevo.', 'error');
            }
        } catch (err) {
            console.warn('No se pudo guardar la asistencia:', err);
            this.setAttendanceFeedback('Revisa tu conexión e intenta guardar nuevamente.', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="ph ph-floppy-disk"></i><span>Guardar asistencia</span>`;
            }
        }
    }
};
