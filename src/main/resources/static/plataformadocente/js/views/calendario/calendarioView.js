import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MONTHS_SHORT_ES = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];
const DAYS_LONG_ES = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];
const DAYS_SHORT_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const DENSITY_CONFIG = {
    comfy: { label: 'Altura: Cómoda', slotMinHeight: 96 },
    wide: { label: 'Altura: Amplia', slotMinHeight: 120 },
    compact: { label: 'Altura: Compacta', slotMinHeight: 72 }
};
const DENSITY_ORDER = ['comfy', 'wide', 'compact'];

const COLOR_KEYS = ['blue', 'purple', 'green', 'orange', 'pink', 'cyan', 'yellow', 'red'];
const COLOR_ACCENT = {
    blue: '#3B82F6',
    purple: '#8B5CF6',
    green: '#10B981',
    orange: '#F97316',
    pink: '#EC4899',
    cyan: '#06B6D4',
    yellow: '#F59E0B',
    red: '#EF4444'
};

const HEX_TO_KEY = {
    '#2563eb': 'blue',
    '#3b82f6': 'blue',
    '#7c3aed': 'purple',
    '#8b5cf6': 'purple',
    '#059669': 'green',
    '#10b981': 'green',
    '#d97706': 'orange',
    '#ea580c': 'orange',
    '#f97316': 'orange',
    '#db2777': 'pink',
    '#ec4899': 'pink',
    '#0891b2': 'cyan',
    '#06b6d4': 'cyan',
    '#eab308': 'yellow',
    '#ca8a04': 'yellow',
    '#f59e0b': 'yellow',
    '#dc2626': 'red',
    '#ef4444': 'red'
};

const TIPO_LABEL = {
    CLASE: 'Clase',
    EXAMEN: 'Examen',
    TAREA: 'Tarea',
    RECORDATORIO: 'Personal',
    REUNION: 'Reunión'
};

function readStoredBool(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        if (v === 'true') return true;
        if (v === 'false') return false;
    } catch {}
    return fallback;
}

function readStoredDensity(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        if (v && DENSITY_CONFIG[v]) return v;
    } catch {}
    return fallback;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toIsoDateLocal(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function normalizeHHMM(val) {
    if (!val || typeof val !== 'string') return '';
    const m = val.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return '';
    return `${pad2(Number(m[1]))}:${m[2]}`;
}

function addMinutesHHMM(hhmm, mins) {
    const [h, m] = (hhmm || '08:00').split(':').map(Number);
    let total = h * 60 + m + mins;
    if (total >= 24 * 60) total = 23 * 60 + 59;
    if (total < 0) total = 0;
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function formatFechaLarga(isoDate) {
    if (!isoDate) return '—';
    const parts = isoDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return `${DAYS_LONG_ES[d.getDay()]}, ${parts[2]} de ${MONTHS_ES[parts[1] - 1].toLowerCase()} de ${parts[0]}`;
}

function h(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) {
        if (Array.isArray(content)) {
            content.forEach(child => {
                if (child != null) {
                    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
                }
            });
        } else if (typeof content === 'string') {
            node.textContent = content;
        } else {
            node.appendChild(content);
        }
    }
    return node;
}

function claveCurso(ev) {
    if (ev?.cursoKey) return String(ev.cursoKey).trim().toUpperCase();
    const raw = (ev?.curso || '').trim();
    if (raw) return raw.toUpperCase().replace(/\s+/g, ' ');
    return 'GENERAL';
}

function labelCurso(ev) {
    const raw = (ev?.curso || '').trim();
    if (raw) return raw;
    const t = String(ev?.tipo || '').toUpperCase();
    if (t === 'RECORDATORIO' || t === 'REUNION') return 'Agenda docente / Personal';
    return 'General';
}

function colorKeyForEvent(ev) {
    const rawColor = (ev?.color || '').trim().toLowerCase();
    if (COLOR_ACCENT[rawColor]) return rawColor;
    if (HEX_TO_KEY[rawColor]) return HEX_TO_KEY[rawColor];
    const key = claveCurso(ev);
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return COLOR_KEYS[hash % COLOR_KEYS.length];
}

function extractSalonBadge(ev) {
    const src = (ev?.aula || ev?.curso || '').trim();
    const m = src.match(/(\d+°?\s*[A-Za-z])/);
    if (m) return m[1].replace(/\s+/g, ' ');
    if (src) return src.slice(0, 4).toUpperCase();
    return '';
}

function normalizeFilterCategory(tipo) {
    const t = String(tipo || 'CLASE').toUpperCase();
    if (t === 'REUNION') return 'RECORDATORIO';
    return ['CLASE', 'EXAMEN', 'TAREA', 'RECORDATORIO'].includes(t) ? t : 'RECORDATORIO';
}

export const CalendarioView = {
    async render() {
        return `
            <div class="content-header" style="margin-bottom:20px;">
                <div>
                    <h2>Calendario Académico</h2>
                    <p>Visualiza tu horario semanal por salón, exámenes, entregas de tareas y agenda docente.</p>
                </div>
            </div>

            <div class="cal-shell">
                <div class="cal-toolbar">
                    <div class="cal-toolbar-left">
                        <h3 class="cal-title" id="calTitle">Cargando...</h3>
                        <button type="button" class="cal-btn-today" id="btnToday">Hoy</button>
                        <div class="cal-nav">
                            <button type="button" class="cal-nav-btn" id="btnPrev" aria-label="Anterior">
                                <i class="ph ph-caret-left"></i>
                            </button>
                            <button type="button" class="cal-nav-btn" id="btnNext" aria-label="Siguiente">
                                <i class="ph ph-caret-right"></i>
                            </button>
                        </div>
                    </div>

                    <div class="cal-segmented" role="tablist" aria-label="Vistas del calendario">
                        <button type="button" class="seg-btn" data-view="day">Día</button>
                        <button type="button" class="seg-btn active" data-view="week">Semana</button>
                        <button type="button" class="seg-btn" data-view="month">Mes</button>
                    </div>

                    <div class="cal-toolbar-right">
                        <div class="cal-filter-wrap">
                            <button type="button" class="cal-filter-btn" id="btnFilter" aria-expanded="false">
                                <i class="ph ph-sliders-horizontal"></i>
                                <span>Filtros</span>
                                <span class="cal-filter-count" id="filterCount">0</span>
                                <i class="ph ph-caret-down" style="font-size:12px;"></i>
                            </button>
                            <div class="cal-dropdown" id="filterDropdown">
                                <h4>Tipo de actividad</h4>
                                <label class="cal-check">
                                    <input type="checkbox" value="CLASE" checked>
                                    <span class="dot" style="background:#3B82F6;"></span>
                                    <span class="lbl">Clases y sesiones</span>
                                    <span class="cnt" id="cntClases">0</span>
                                </label>
                                <label class="cal-check">
                                    <input type="checkbox" value="EXAMEN" checked>
                                    <span class="dot" style="background:#8B5CF6;"></span>
                                    <span class="lbl">Exámenes y eval.</span>
                                    <span class="cnt" id="cntExamenes">0</span>
                                </label>
                                <label class="cal-check">
                                    <input type="checkbox" value="TAREA" checked>
                                    <span class="dot" style="background:#F59E0B;"></span>
                                    <span class="lbl">Entregas de tareas</span>
                                    <span class="cnt" id="cntTareas">0</span>
                                </label>
                                <label class="cal-check">
                                    <input type="checkbox" value="RECORDATORIO" checked>
                                    <span class="dot" style="background:#EC4899;"></span>
                                    <span class="lbl">Recordatorios y reuniones</span>
                                    <span class="cnt" id="cntRecordatorios">0</span>
                                </label>

                                <hr>
                                <h4>Cursos y Salones</h4>
                                <div id="courseFilterList" style="display:flex;flex-direction:column;gap:2px;">
                                    <p style="font-size:12px;color:var(--cal-muted);margin:4px;">Cargando cursos...</p>
                                </div>

                                <hr>
                                <div class="cal-dropdown-actions">
                                    <button type="button" class="cal-link-btn" id="btnFilterAll">Seleccionar todos</button>
                                    <button type="button" class="cal-link-btn" id="btnFilterNone">Limpiar</button>
                                </div>
                            </div>
                        </div>

                        <div class="cal-flex-controls" role="group" aria-label="Opciones de diseño del calendario">
                            <button type="button" class="cal-chip-btn" id="btnToggleWeekends" title="Alternar entre semana completa (7 días) y solo Lun–Vie">
                                <span id="weekendsLabel">7 días</span>
                            </button>
                            <button type="button" class="cal-chip-btn" id="btnDensity" title="Cambiar altura de filas (Cómoda / Amplia / Compacta)">
                                <span id="densityLabel">Altura: Cómoda</span>
                            </button>
                        </div>

                        <div class="cal-viewicons">
                            <button type="button" class="cal-icon-btn" id="btnViewList" title="Vista Agenda / Lista">
                                <i class="ph ph-list-bullets"></i>
                            </button>
                            <button type="button" class="cal-icon-btn active" id="btnViewGrid" title="Vista Horario / Cuadrícula">
                                <i class="ph ph-squares-four"></i>
                            </button>
                        </div>

                        <button type="button" class="cal-add-btn" id="btnAddSchedule">
                            <i class="ph ph-plus"></i>
                            <span class="txt">Agregar evento</span>
                        </button>
                    </div>
                </div>

                <div class="cal-coord-bar" id="calCoordBar" style="display:none;"></div>

                <div class="cal-body" id="calBody">
                    <div class="cal-loading" id="calLoading">
                        <i class="ph ph-spinner ph-spin"></i>
                        <p>Sincronizando calendario docente...</p>
                    </div>
                    <div id="fcCalendar" class="sh-fc-mount"></div>
                </div>

                <div class="cal-footer">
                    <div class="item">
                        <span class="sw" style="background:#3B82F6;"></span>
                        <span>Clases</span>
                    </div>
                    <div class="item">
                        <span class="sw" style="background:#8B5CF6;"></span>
                        <span>Exámenes</span>
                    </div>
                    <div class="item">
                        <span class="sw" style="background:#F59E0B;"></span>
                        <span>Tareas</span>
                    </div>
                    <div class="item">
                        <span class="sw" style="background:#EC4899;"></span>
                        <span>Agenda docente</span>
                    </div>
                    <div class="stats" id="calFooterStats">0 actividades visibles</div>
                    <div class="shortcuts">
                        <span>Haz clic en un evento para ver detalles o en un horario vacío para agendar</span>
                    </div>
                </div>
            </div>

            <!-- Modal Detalle del Evento -->
            <div class="cal-modal-backdrop" id="modalDetailBackdrop">
                <div class="cal-modal" id="modalDetail" role="dialog" aria-labelledby="modalDetailTitle">
                    <div class="cal-detail-band" id="detailBand"></div>
                    <div class="cal-modal-head">
                        <div>
                            <span class="cal-detail-kicker" id="detailKicker">Clase regular</span>
                            <h3 id="modalDetailTitle">Detalle de actividad</h3>
                        </div>
                        <button type="button" class="cal-modal-close" id="btnDetailClose" aria-label="Cerrar">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                    <div class="cal-modal-body">
                        <div class="cal-detail-row">
                            <i class="ph ph-calendar-blank"></i>
                            <div>
                                <strong id="detailDate">—</strong>
                                <small id="detailTime">—</small>
                            </div>
                        </div>
                        <div class="cal-detail-row" id="rowCurso">
                            <i class="ph ph-chalkboard-teacher"></i>
                            <div>
                                <strong id="detailCurso">—</strong>
                                <small id="detailAula">—</small>
                            </div>
                        </div>
                        <div class="cal-detail-row" id="rowEstado" style="display:none;">
                            <i class="ph ph-check-circle"></i>
                            <div>
                                <strong>Estado académico</strong>
                                <small id="detailEstado">—</small>
                            </div>
                        </div>
                        <div class="cal-detail-row" id="rowDesc" style="display:none;">
                            <i class="ph ph-clipboard-text"></i>
                            <div>
                                <strong>Descripción / Notas</strong>
                                <small id="detailDesc">—</small>
                            </div>
                        </div>
                    </div>
                    <div class="cal-modal-foot">
                        <button type="button" class="cal-btn danger" id="btnDeleteEvent" style="display:none;">
                            <i class="ph ph-trash"></i>
                            <span>Eliminar</span>
                        </button>
                        <a href="#/mis-clases" class="cal-btn" id="btnLinkCurso" style="display:none;">
                            <span>Ver clase</span>
                            <i class="ph ph-arrow-right"></i>
                        </a>
                        <a href="#/tareas" class="cal-btn primary" id="btnLinkTarea" style="display:none;">
                            <span>Ir a tareas</span>
                            <i class="ph ph-arrow-right"></i>
                        </a>
                        <button type="button" class="cal-btn" id="btnDetailOk">Cerrar</button>
                    </div>
                </div>
            </div>

            <!-- Modal + Agregar Evento Docente -->
            <div class="cal-modal-backdrop" id="modalAddBackdrop">
                <div class="cal-modal" id="modalAdd" role="dialog" aria-labelledby="modalAddTitle">
                    <div class="cal-detail-band"></div>
                    <div class="cal-modal-head">
                        <div>
                            <span class="cal-detail-kicker">+ Nueva Actividad</span>
                            <h3 id="modalAddTitle">Agendar en Calendario Docente</h3>
                        </div>
                        <button type="button" class="cal-modal-close" id="btnAddClose" aria-label="Cerrar">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                    <form id="formAddSchedule">
                        <div class="cal-modal-body">
                            <div class="cal-form-error" id="formError"></div>

                            <div class="cal-field">
                                <label for="schedTitle">Título de la actividad *</label>
                                <input type="text" id="schedTitle" placeholder="Ej: Evaluación parcial, Tutoría grupal, Reunión..." required maxlength="120">
                            </div>

                            <div class="cal-field-row-2">
                                <div class="cal-field">
                                    <label for="schedType">Tipo de evento *</label>
                                    <select id="schedType">
                                        <option value="RECORDATORIO">Recordatorio / Asesoría</option>
                                        <option value="EXAMEN">Examen / Evaluación</option>
                                        <option value="REUNION">Reunión / Coordinación</option>
                                        <option value="CLASE">Sesión / Clase extra</option>
                                    </select>
                                </div>
                                <div class="cal-field">
                                    <label for="schedCourse">Curso y salón (opcional)</label>
                                    <select id="schedCourse">
                                        <option value="">General / Agenda docente</option>
                                    </select>
                                </div>
                            </div>

                            <div class="cal-field-row">
                                <div class="cal-field">
                                    <label for="schedDate">Fecha *</label>
                                    <input type="date" id="schedDate" required>
                                </div>
                                <div class="cal-field">
                                    <label for="schedStart">Inicio *</label>
                                    <input type="time" id="schedStart" value="08:00" required>
                                </div>
                                <div class="cal-field">
                                    <label for="schedEnd">Fin *</label>
                                    <input type="time" id="schedEnd" value="09:00" required>
                                </div>
                            </div>

                            <div class="cal-field">
                                <label>Etiqueta de color</label>
                                <div class="cal-swatches">
                                    <label class="cal-swatch">
                                        <input type="radio" name="schedColor" value="purple" checked>
                                        <span style="background:#8B5CF6;" title="Violeta"></span>
                                    </label>
                                    <label class="cal-swatch">
                                        <input type="radio" name="schedColor" value="blue">
                                        <span style="background:#3B82F6;" title="Azul"></span>
                                    </label>
                                    <label class="cal-swatch">
                                        <input type="radio" name="schedColor" value="green">
                                        <span style="background:#10B981;" title="Verde"></span>
                                    </label>
                                    <label class="cal-swatch">
                                        <input type="radio" name="schedColor" value="orange">
                                        <span style="background:#F97316;" title="Naranja"></span>
                                    </label>
                                    <label class="cal-swatch">
                                        <input type="radio" name="schedColor" value="pink">
                                        <span style="background:#EC4899;" title="Rosa"></span>
                                    </label>
                                    <label class="cal-swatch">
                                        <input type="radio" name="schedColor" value="yellow">
                                        <span style="background:#F59E0B;" title="Ámbar"></span>
                                    </label>
                                </div>
                            </div>

                            <div class="cal-field">
                                <label for="schedDesc">Notas / Descripción (opcional)</label>
                                <textarea id="schedDesc" rows="3" placeholder="Temario, aula, enlace o indicaciones..."></textarea>
                            </div>
                        </div>
                        <div class="cal-modal-foot">
                            <button type="button" class="cal-btn" id="btnCancelAdd">Cancelar</button>
                            <button type="submit" class="cal-btn primary" id="btnSaveSchedule">Guardar actividad</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    cleanup() {
        if (this._narrowRafId) {
            cancelAnimationFrame(this._narrowRafId);
            this._narrowRafId = 0;
        }
        if (this._onDocClick) {
            document.removeEventListener('click', this._onDocClick);
            this._onDocClick = null;
        }
        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this.state?.calendar) {
            this.state.calendar.destroy();
            this.state.calendar = null;
        }
    },

    async afterRender() {
        this.cleanup();
        this.user = Auth.getUser();
        this.state = {
            docenteId: null,
            payload: null,
            allEventos: [],
            feriadosMap: new Map(),
            tiposFiltro: { CLASE: true, EXAMEN: true, TAREA: true, RECORDATORIO: true },
            cursosFiltro: new Map(),
            mode: 'grid',
            timeScale: 'week',
            weekends: readStoredBool('sh_doc_cal_weekends', true),
            density: readStoredDensity('sh_doc_cal_density', 'comfy'),
            calendar: null,
            detalleActual: null
        };

        this.cacheDom();
        this.wireUiControls();

        try {
            if (!this.user) {
                throw new Error('No se encontró la sesión docente.');
            }
            this.state.docenteId = this.user.id || await CursoService.getDocenteId(this.user.email);
            if (!this.state.docenteId) {
                throw new Error('No se pudo identificar al docente.');
            }
            this.inicializarFullCalendar();
            await this.cargarDatosCalendario();
        } catch (err) {
            console.warn('[Calendario Docente]', err);
            if (this.el.calLoading) {
                this.el.calLoading.style.display = 'flex';
                if (window.ShidellErrors?.renderCard) {
                    window.ShidellErrors.renderCard(this.el.calLoading, {
                        portal: 'DOCENTE',
                        compact: true,
                        title: 'No pudimos actualizar tu agenda docente',
                        message: err?.message || 'Revisa tu conexión e intenta cargar de nuevo.',
                        onRetry: () => this.cargarDatosCalendario()
                    });
                } else {
                    this.el.calLoading.innerHTML = `<p style="color:var(--red);font-weight:700;">No pudimos actualizar tu agenda docente en este momento.</p>`;
                }
            }
        }
    },

    cacheDom() {
        this.el = {
            calTitle: document.getElementById('calTitle'),
            btnToday: document.getElementById('btnToday'),
            btnPrev: document.getElementById('btnPrev'),
            btnNext: document.getElementById('btnNext'),
            segBtns: Array.from(document.querySelectorAll('.cal-segmented .seg-btn')),

            btnFilter: document.getElementById('btnFilter'),
            filterCount: document.getElementById('filterCount'),
            filterDropdown: document.getElementById('filterDropdown'),
            cntClases: document.getElementById('cntClases'),
            cntExamenes: document.getElementById('cntExamenes'),
            cntTareas: document.getElementById('cntTareas'),
            cntRecordatorios: document.getElementById('cntRecordatorios'),
            courseFilterList: document.getElementById('courseFilterList'),
            btnFilterAll: document.getElementById('btnFilterAll'),
            btnFilterNone: document.getElementById('btnFilterNone'),

            btnToggleWeekends: document.getElementById('btnToggleWeekends'),
            weekendsLabel: document.getElementById('weekendsLabel'),
            btnDensity: document.getElementById('btnDensity'),
            densityLabel: document.getElementById('densityLabel'),
            btnViewList: document.getElementById('btnViewList'),
            btnViewGrid: document.getElementById('btnViewGrid'),
            btnAddSchedule: document.getElementById('btnAddSchedule'),

            calCoordBar: document.getElementById('calCoordBar'),
            calBody: document.getElementById('calBody'),
            calLoading: document.getElementById('calLoading'),
            fcCalendar: document.getElementById('fcCalendar'),
            calFooterStats: document.getElementById('calFooterStats'),

            modalDetailBackdrop: document.getElementById('modalDetailBackdrop'),
            detailBand: document.getElementById('detailBand'),
            detailKicker: document.getElementById('detailKicker'),
            modalDetailTitle: document.getElementById('modalDetailTitle'),
            btnDetailClose: document.getElementById('btnDetailClose'),
            detailDate: document.getElementById('detailDate'),
            detailTime: document.getElementById('detailTime'),
            rowCurso: document.getElementById('rowCurso'),
            detailCurso: document.getElementById('detailCurso'),
            detailAula: document.getElementById('detailAula'),
            rowEstado: document.getElementById('rowEstado'),
            detailEstado: document.getElementById('detailEstado'),
            rowDesc: document.getElementById('rowDesc'),
            detailDesc: document.getElementById('detailDesc'),
            btnDeleteEvent: document.getElementById('btnDeleteEvent'),
            btnLinkCurso: document.getElementById('btnLinkCurso'),
            btnLinkTarea: document.getElementById('btnLinkTarea'),
            btnDetailOk: document.getElementById('btnDetailOk'),

            modalAddBackdrop: document.getElementById('modalAddBackdrop'),
            formAddSchedule: document.getElementById('formAddSchedule'),
            formError: document.getElementById('formError'),
            schedTitle: document.getElementById('schedTitle'),
            schedType: document.getElementById('schedType'),
            schedCourse: document.getElementById('schedCourse'),
            schedDate: document.getElementById('schedDate'),
            schedStart: document.getElementById('schedStart'),
            schedEnd: document.getElementById('schedEnd'),
            schedDesc: document.getElementById('schedDesc'),
            btnAddClose: document.getElementById('btnAddClose'),
            btnCancelAdd: document.getElementById('btnCancelAdd'),
            btnSaveSchedule: document.getElementById('btnSaveSchedule')
        };
    },

    async cargarDatosCalendario() {
        const data = await API.fetch(`/api/docente/${encodeURIComponent(this.state.docenteId)}/calendario`);
        this.aplicarPayload(data);
    },

    aplicarPayload(data) {
        this.state.payload = data || {};
        this.state.allEventos = Array.isArray(data?.eventos) ? data.eventos : [];
        this.state.feriadosMap = new Map();
        const feriados = data?.calendarioEscolar?.feriados || [];
        feriados.forEach(f => {
            if (f?.fecha) this.state.feriadosMap.set(f.fecha, f);
        });

        this.poblarSelectorCursosModal();
        this.construirFiltrosCurso();
        this.actualizarContadoresFiltro();
        this.renderFilterCountBadge();
        this.actualizarRangoHorarioVisible();
        this.sincronizarEventosCalendar();
    },

    actualizarRangoHorarioVisible() {
        if (!this.state.calendar) return;
        let minMins = null;
        let maxMins = null;

        const considerarHHMM = (hhmm) => {
            const norm = normalizeHHMM(hhmm);
            if (!norm) return null;
            const [h, m] = norm.split(':').map(Number);
            return h * 60 + m;
        };

        (this.state.payload?.horariosBase || []).forEach(b => {
            const ini = considerarHHMM(b.horaInicio);
            const fin = considerarHHMM(b.horaFin);
            if (ini != null) minMins = minMins == null ? ini : Math.min(minMins, ini);
            if (fin != null) maxMins = maxMins == null ? fin : Math.max(maxMins, fin);
        });

        this.state.allEventos.forEach(ev => {
            if (ev.todoElDia) return;
            const ini = considerarHHMM(ev.hora || (ev.fechaInicio ? String(ev.fechaInicio).slice(11, 16) : ''));
            const fin = considerarHHMM(ev.horaFin);
            if (ini != null) minMins = minMins == null ? ini : Math.min(minMins, ini);
            if (fin != null) maxMins = maxMins == null ? fin : Math.max(maxMins, fin);
        });

        const minHour = minMins == null ? 7 : Math.max(6, Math.min(12, Math.floor(minMins / 60) - 1));
        const maxHour = maxMins == null ? 20 : Math.min(23, Math.max(19, Math.ceil(maxMins / 60) + 1));

        this.state.calendar.setOption('slotMinTime', `${pad2(minHour)}:00:00`);
        this.state.calendar.setOption('slotMaxTime', `${pad2(maxHour)}:00:00`);
    },

    poblarSelectorCursosModal() {
        const select = this.el.schedCourse;
        if (!select) return;
        const cursos = this.state.payload?.cursos || [];
        const current = select.value;
        select.innerHTML = '<option value="">General / Agenda docente</option>';
        cursos.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.id);
            opt.textContent = c.label || c.nombre || `Curso ${c.id}`;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    },

    construirFiltrosCurso() {
        const prevStates = new Map();
        this.state.cursosFiltro.forEach((info, k) => prevStates.set(k, info.checked));
        const nextMap = new Map();

        const cursosApi = this.state.payload?.cursos || [];
        cursosApi.forEach(c => {
            const evSim = {
                curso: c.label || c.nombre,
                cursoKey: c.cursoKey,
                color: c.color
            };
            const key = claveCurso(evSim);
            if (!nextMap.has(key)) {
                nextMap.set(key, {
                    label: c.label || c.nombre || key,
                    checked: prevStates.has(key) ? prevStates.get(key) : true,
                    color: COLOR_ACCENT[colorKeyForEvent(evSim)] || COLOR_ACCENT.blue
                });
            }
        });

        this.state.allEventos.forEach(ev => {
            const key = claveCurso(ev);
            if (!nextMap.has(key)) {
                nextMap.set(key, {
                    label: labelCurso(ev),
                    checked: prevStates.has(key) ? prevStates.get(key) : true,
                    color: COLOR_ACCENT[colorKeyForEvent(ev)] || COLOR_ACCENT.blue
                });
            }
        });

        this.state.cursosFiltro = nextMap;
        this.renderCourseFiltersDom();
    },

    renderCourseFiltersDom() {
        const listEl = this.el.courseFilterList;
        if (!listEl) return;
        listEl.innerHTML = '';
        if (this.state.cursosFiltro.size === 0) {
            listEl.appendChild(h('p', null, 'Sin cursos asignados'));
            return;
        }
        this.state.cursosFiltro.forEach((info) => {
            const labelEl = document.createElement('label');
            labelEl.className = 'cal-check';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = info.checked;
            cb.addEventListener('change', () => {
                info.checked = cb.checked;
                this.onFiltersChanged();
            });

            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.style.background = info.color || COLOR_ACCENT.blue;

            labelEl.appendChild(cb);
            labelEl.appendChild(dot);
            labelEl.appendChild(h('span', 'lbl', info.label));
            listEl.appendChild(labelEl);
        });
    },

    actualizarContadoresFiltro() {
        const counts = { CLASE: 0, EXAMEN: 0, TAREA: 0, RECORDATORIO: 0 };
        this.state.allEventos.forEach(ev => {
            const cat = normalizeFilterCategory(ev.tipo);
            counts[cat] = (counts[cat] || 0) + 1;
        });
        if (this.el.cntClases) this.el.cntClases.textContent = String(counts.CLASE);
        if (this.el.cntExamenes) this.el.cntExamenes.textContent = String(counts.EXAMEN);
        if (this.el.cntTareas) this.el.cntTareas.textContent = String(counts.TAREA);
        if (this.el.cntRecordatorios) this.el.cntRecordatorios.textContent = String(counts.RECORDATORIO);
    },

    renderFilterCountBadge() {
        if (!this.el.filterCount) return;
        let hidden = 0;
        Object.values(this.state.tiposFiltro).forEach(v => { if (!v) hidden++; });
        this.state.cursosFiltro.forEach(info => { if (!info.checked) hidden++; });
        this.el.filterCount.textContent = String(hidden);
        this.el.filterCount.classList.toggle('show', hidden > 0);
    },

    eventoVisible(ev) {
        const cat = normalizeFilterCategory(ev.tipo);
        if (this.state.tiposFiltro[cat] === false) return false;
        const cKey = claveCurso(ev);
        const courseEntry = this.state.cursosFiltro.get(cKey);
        if (courseEntry && !courseEntry.checked) return false;
        return true;
    },

    onFiltersChanged() {
        this.renderFilterCountBadge();
        this.sincronizarEventosCalendar();
    },

    buildFullCalendarEvents() {
        const fcEvents = [];

        this.state.feriadosMap.forEach((f, fecha) => {
            fcEvents.push({
                id: `holiday-${fecha}`,
                start: fecha,
                allDay: true,
                display: 'background',
                title: f.nombre || 'Feriado',
                classNames: ['sh-fc-bg-holiday'],
                extendedProps: { isHoliday: true, nombre: f.nombre || 'Feriado' }
            });
        });

        this.state.allEventos.forEach(ev => {
            if (!this.eventoVisible(ev)) return;
            const fecha = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');
            if (!fecha) return;

            const tipo = (ev.tipo || 'CLASE').toUpperCase();
            const isAllDay = Boolean(ev.todoElDia) || (tipo === 'TAREA' && !ev.hora);
            const colorKey = colorKeyForEvent(ev);
            const horaIni = normalizeHHMM(
                ev.hora || (ev.fechaInicio && String(ev.fechaInicio).length >= 16 ? String(ev.fechaInicio).slice(11, 16) : '')
            );
            let horaFin = normalizeHHMM(ev.horaFin);

            let startStr = fecha;
            let endStr;
            if (!isAllDay) {
                const startH = horaIni || '08:00';
                if (!horaFin || horaFin <= startH) {
                    horaFin = addMinutesHHMM(startH, 60);
                }
                startStr = `${fecha}T${startH}:00`;
                endStr = `${fecha}T${horaFin}:00`;
            }

            const cls = [`cal-ev-${colorKey}`];
            if (tipo === 'EXAMEN') cls.push('is-exam');

            fcEvents.push({
                id: String(ev.id),
                title: ev.titulo || 'Evento',
                start: startStr,
                end: endStr,
                allDay: isAllDay,
                classNames: cls,
                extendedProps: {
                    raw: ev,
                    tipo,
                    colorKey,
                    horaIni: horaIni || (isAllDay ? '' : '08:00'),
                    horaFin: isAllDay ? '' : horaFin
                }
            });
        });

        return fcEvents;
    },

    sincronizarEventosCalendar() {
        if (!this.state.calendar) return;
        const sourceEvents = this.buildFullCalendarEvents();
        this.state.calendar.removeAllEvents();
        this.state.calendar.addEventSource(sourceEvents);
        this.actualizarBarraFooterYWeekends();
    },

    getFcViewName() {
        if (this.state.mode === 'list') {
            if (this.state.timeScale === 'day') return 'listDay';
            if (this.state.timeScale === 'month') return 'listMonth';
            return 'listWeek';
        }
        if (this.state.timeScale === 'day') return 'timeGridDay';
        if (this.state.timeScale === 'month') return 'dayGridMonth';
        return 'timeGridWeek';
    },

    getSlotMinHeight() {
        return (DENSITY_CONFIG[this.state.density] || DENSITY_CONFIG.comfy).slotMinHeight;
    },

    buildSlotHeaderContent(arg) {
        const hour24 = arg.date.getHours();
        const ampm = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        const pill = h('span', 'sh-fc-hour-pill', [
            h('span', null, `${hour12}:00`),
            h('small', null, ampm)
        ]);
        return { domNodes: [pill] };
    },

    buildDayHeaderContent(arg) {
        if (arg.view.type === 'dayGridMonth') {
            return { domNodes: [document.createTextNode(arg.text)] };
        }
        const dateIso = toIsoDateLocal(arg.date);
        const holiday = this.state.feriadosMap.get(dateIso);
        const wrap = h('div', `sh-fc-dayhead-inner${arg.isToday ? ' is-today' : ''}`);
        wrap.appendChild(h('div', 'sh-fc-dh-top', [
            h('span', 'sh-fc-dh-dow', DAYS_SHORT_ES[arg.date.getDay()]),
            h('span', 'sh-fc-dh-num', String(arg.date.getDate()))
        ]));
        if (holiday) {
            wrap.appendChild(h('span', 'sh-fc-dh-holiday', `Feriado · ${holiday.nombre}`));
        }
        return { domNodes: [wrap] };
    },

    buildEventContent(arg) {
        if (arg.event.display === 'background') {
            const nombre = arg.event.extendedProps?.nombre;
            if (!nombre || arg.view.type === 'dayGridMonth') return { domNodes: [] };
            return { domNodes: [h('div', 'sh-fc-bg-holiday-label', `Feriado: ${nombre}`)] };
        }

        const props = arg.event.extendedProps || {};
        const ev = props.raw || {};
        const tipo = props.tipo || 'CLASE';
        const typeLabel = TIPO_LABEL[tipo] || tipo;
        const viewType = arg.view.type;
        const timeRange = (!arg.event.allDay && props.horaIni && props.horaFin)
            ? `${props.horaIni}–${props.horaFin}`
            : (!arg.event.allDay && props.horaIni ? props.horaIni : '');

        if (viewType.startsWith('list')) {
            const card = h('div', 'sh-fc-list-card');
            const main = h('div', 'sh-fc-list-main');
            main.appendChild(h('div', 'sh-fc-list-title-row', [
                h('span', 'sh-fc-list-badge', typeLabel),
                h('span', 'sh-fc-list-time', timeRange || 'Todo el día'),
                h('span', 'sh-fc-list-title', ev.titulo || arg.event.title)
            ]));

            const subParts = [];
            if (ev.curso) subParts.push(ev.curso);
            if (ev.aula && (!ev.curso || !ev.curso.includes(ev.aula))) subParts.push(ev.aula);
            if (ev.alumnos != null) subParts.push(`${ev.alumnos} alumnos`);
            if (ev.descripcion) subParts.push(ev.descripcion);
            if (subParts.length) {
                main.appendChild(h('div', 'sh-fc-list-sub', subParts.join(' · ')));
            }
            card.appendChild(main);

            const right = h('div', 'sh-fc-list-right');
            if (ev.estado) {
                right.appendChild(h('span', 'sh-fc-list-status', ev.estado));
            } else if (ev.propio) {
                right.appendChild(h('span', 'sh-fc-list-status', 'Agenda docente'));
            }
            if (right.childNodes.length) card.appendChild(right);
            return { domNodes: [card] };
        }

        if (arg.event.allDay || viewType === 'dayGridMonth') {
            const salon = extractSalonBadge(ev);
            const row = h('div', 'sh-fc-row-card', [
                h('span', 'sh-fc-row-dot')
            ]);
            if (timeRange) {
                row.appendChild(h('span', 'sh-fc-row-time', props.horaIni || timeRange));
            }
            row.appendChild(h('span', 'sh-fc-row-title', ev.titulo || arg.event.title));
            const miniBadge = salon || (tipo === 'EXAMEN' ? 'Examen' : '');
            if (miniBadge) {
                row.appendChild(h('span', 'sh-fc-row-badge', miniBadge));
            }
            return { domNodes: [row] };
        }

        // Vista Semana / Día
        const salon = extractSalonBadge(ev);
        const rawTitle = ev.titulo || arg.event.title || '';
        const showInlineSalon = tipo === 'CLASE' && salon && !rawTitle.toLowerCase().includes(salon.toLowerCase());
        const cardTitleText = showInlineSalon ? `${rawTitle} · ${salon}` : rawTitle;

        const nodes = [];
        nodes.push(h('div', 'sh-fc-card-top', [
            h('span', 'sh-fc-type-pill', typeLabel),
            timeRange ? h('span', 'sh-fc-card-time', timeRange) : null
        ]));
        nodes.push(h('div', 'sh-fc-card-title', cardTitleText));

        const tituloLower = cardTitleText.trim().toLowerCase();
        const cursoLower = (ev.curso || '').trim().toLowerCase();
        if (cursoLower && !tituloLower.includes(cursoLower)) {
            const subText = (tituloLower && cursoLower.startsWith(rawTitle.trim().toLowerCase()) && ev.aula)
                ? ev.aula
                : ev.curso;
            nodes.push(h('div', 'sh-fc-card-sub', subText));
        }

        if (ev.aula || ev.alumnos != null || ev.estado || ev.propio) {
            const foot = h('div', 'sh-fc-card-foot');
            if (salon) foot.appendChild(h('span', 'sh-fc-avatar', salon));
            if (ev.aula && ev.alumnos != null) {
                foot.appendChild(h('span', 'sh-fc-teacher', `${ev.alumnos} alumnos`));
            } else if (ev.aula) {
                foot.appendChild(h('span', 'sh-fc-teacher', ev.aula));
            } else if (ev.estado) {
                foot.appendChild(h('span', 'sh-fc-teacher', ev.estado));
            } else if (ev.propio) {
                foot.appendChild(h('span', 'sh-fc-teacher', 'Agenda docente'));
            }
            nodes.push(foot);
        }

        return { domNodes: nodes };
    },

    programarAjusteTarjetasAngostas() {
        if (!this.el?.fcCalendar) return;
        if (this._narrowRafId) cancelAnimationFrame(this._narrowRafId);
        this._narrowRafId = requestAnimationFrame(() => {
            this._narrowRafId = 0;
            this.el?.fcCalendar?.querySelectorAll('.sh-fc-col-event').forEach(node => {
                const w = node.clientWidth;
                node.classList.toggle('is-narrow', w > 0 && w < 92);
                node.classList.toggle('is-ultra-narrow', w > 0 && w < 68);
            });
        });
    },

    inicializarFullCalendar() {
        if (!window.FullCalendar || !this.el.fcCalendar) {
            throw new Error('FullCalendar v7 no está cargado en la página.');
        }

        const self = this;
        this.state.calendar = new FullCalendar.Calendar(this.el.fcCalendar, {
            locale: 'es',
            initialView: this.getFcViewName(),
            headerToolbar: false,
            borderless: true,
            firstDay: 1,
            weekends: this.state.weekends,
            height: 'auto',
            slotMinTime: '07:00:00',
            slotMaxTime: '20:00:00',
            slotDuration: '00:30:00',
            slotHeaderInterval: '01:00:00',
            slotMinHeight: this.getSlotMinHeight(),
            expandRows: true,
            allDaySlot: true,
            allDayText: 'Todo el día',
            slotEventOverlap: false,
            navLinks: true,
            navLinkDayClick: (date) => {
                self.state.calendar.gotoDate(date);
                self.cambiarVista('grid', 'day');
            },
            nowIndicator: true,
            selectable: true,
            selectMirror: true,
            dayMaxEvents: 4,
            moreLinkClick: 'popover',
            eventShortHeight: 34,

            columnEventClass: 'sh-fc-col-event',
            columnEventInnerClass: 'sh-fc-col-inner',
            rowEventClass: 'sh-fc-row-event',
            listItemEventClass: 'sh-fc-list-item',
            dayHeaderClass: 'sh-fc-dayhead-cell',

            views: {
                timeGrid: {
                    slotHeaderClass: 'sh-fc-slot-header',
                    slotHeaderInnerClass: 'sh-fc-slot-inner',
                    slotHeaderContent: (arg) => self.buildSlotHeaderContent(arg),
                    dayHeaderInnerClass: 'sh-fc-dayhead-inner-wrap',
                    dayHeaderContent: (arg) => self.buildDayHeaderContent(arg)
                }
            },

            dayCellClassNames: (arg) => {
                const iso = toIsoDateLocal(arg.date);
                return self.state.feriadosMap.has(iso) ? ['sh-fc-day-holiday'] : [];
            },

            eventClassNames: (arg) => {
                if (arg.event.display === 'background') return [];
                const props = arg.event.extendedProps || {};
                const out = [];
                if (props.colorKey) out.push(`cal-ev-${props.colorKey}`);
                if (props.tipo === 'EXAMEN') out.push('is-exam');
                return out;
            },

            eventContent: (arg) => self.buildEventContent(arg),

            eventDidMount: (info) => {
                if (info.event.display === 'background') return;
                const props = info.event.extendedProps || {};
                if (props.colorKey) info.el.classList.add(`cal-ev-${props.colorKey}`);
                if (props.tipo === 'EXAMEN') info.el.classList.add('is-exam');
                const ev = props.raw || {};
                const parts = [
                    `${TIPO_LABEL[props.tipo] || props.tipo || 'Evento'}: ${ev.titulo || info.event.title}`,
                    props.horaIni ? `${props.horaIni}–${props.horaFin || ''}` : 'Todo el día',
                    ev.curso ? `Curso: ${ev.curso}` : '',
                    ev.aula ? `Salón: ${ev.aula}` : '',
                    ev.descripcion || ''
                ].filter(Boolean);
                info.el.title = parts.join(' • ');
            },

            eventClick: (info) => {
                if (info.event.display === 'background') return;
                const ev = info.event.extendedProps?.raw;
                if (ev) self.verDetalleEvento(ev.id);
            },

            select: (info) => {
                self.state.calendar.unselect();
                const fecha = toIsoDateLocal(info.start);
                if (info.allDay) {
                    self.abrirModalAdd(fecha, '08:00', '09:00');
                    return;
                }
                const startHHMM = `${pad2(info.start.getHours())}:${pad2(info.start.getMinutes())}`;
                let endHHMM = `${pad2(info.end.getHours())}:${pad2(info.end.getMinutes())}`;
                const diffMins = Math.round((info.end.getTime() - info.start.getTime()) / 60000);
                if (diffMins <= 30) {
                    endHHMM = addMinutesHHMM(startHHMM, 60);
                }
                self.abrirModalAdd(fecha, startHHMM, endHHMM);
            },

            eventsSet: () => self.programarAjusteTarjetasAngostas(),

            datesSet: () => {
                self.actualizarMountClasses();
                self.actualizarTituloBarra();
                self.actualizarBarraFooterYWeekends();
                self.programarAjusteTarjetasAngostas();
            }
        });

        this.state.calendar.render();
        if (this.el.calLoading) this.el.calLoading.style.display = 'none';
        this.actualizarMountClasses();
        this.actualizarTituloBarra();
        this.programarAjusteTarjetasAngostas();
    },

    actualizarMountClasses() {
        if (!this.el?.fcCalendar) return;
        const isWeekGrid = this.state.mode === 'grid' && this.state.timeScale === 'week';
        this.el.fcCalendar.classList.toggle('is-week-full', isWeekGrid && this.state.weekends);
        this.el.fcCalendar.classList.toggle('is-week-work', isWeekGrid && !this.state.weekends);
    },

    actualizarTituloBarra() {
        if (!this.state.calendar || !this.el?.calTitle) return;
        const view = this.state.calendar.view;
        const start = view.currentStart;
        const endIncl = new Date(view.currentEnd.getTime() - 1);

        let title = '';
        if (this.state.timeScale === 'month') {
            title = `${MONTHS_ES[start.getMonth()]} de ${start.getFullYear()}`;
        } else if (this.state.timeScale === 'day') {
            title = `${DAYS_LONG_ES[start.getDay()]}, ${start.getDate()} de ${MONTHS_ES[start.getMonth()].toLowerCase()} de ${start.getFullYear()}`;
        } else {
            const sameMonth = start.getMonth() === endIncl.getMonth();
            const sameYear = start.getFullYear() === endIncl.getFullYear();
            if (sameMonth) {
                title = `${start.getDate()} – ${endIncl.getDate()} ${MONTHS_SHORT_ES[endIncl.getMonth()]} ${endIncl.getFullYear()}`;
            } else if (sameYear) {
                title = `${start.getDate()} ${MONTHS_SHORT_ES[start.getMonth()]} – ${endIncl.getDate()} ${MONTHS_SHORT_ES[endIncl.getMonth()]} ${endIncl.getFullYear()}`;
            } else {
                title = `${start.getDate()} ${MONTHS_SHORT_ES[start.getMonth()]} ${start.getFullYear()} – ${endIncl.getDate()} ${MONTHS_SHORT_ES[endIncl.getMonth()]} ${endIncl.getFullYear()}`;
            }
        }
        this.el.calTitle.textContent = title;
    },

    actualizarBarraFooterYWeekends() {
        if (!this.state.calendar) return;
        const view = this.state.calendar.view;
        const startIso = toIsoDateLocal(view.currentStart);
        const endExclIso = toIsoDateLocal(view.currentEnd);

        let weekendCount = 0;
        if (!this.state.weekends) {
            this.state.allEventos.forEach(ev => {
                if (!this.eventoVisible(ev)) return;
                const f = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');
                if (!f || f < startIso || f >= endExclIso) return;
                const [y, m, d] = f.split('-').map(Number);
                const dow = new Date(y, m - 1, d).getDay();
                if (dow === 0 || dow === 6) weekendCount++;
            });
        }

        if (this.el.btnToggleWeekends && this.el.weekendsLabel) {
            this.el.btnToggleWeekends.classList.toggle('active', !this.state.weekends);
            const oldBadge = this.el.btnToggleWeekends.querySelector('.cal-chip-badge');
            if (oldBadge) oldBadge.remove();
            this.el.weekendsLabel.textContent = this.state.weekends ? '7 días' : 'Solo Lun–Vie';
            if (!this.state.weekends && weekendCount > 0) {
                this.el.btnToggleWeekends.appendChild(h('span', 'cal-chip-badge', `${weekendCount} fin sem.`));
            }
        }

        if (this.el.btnDensity && this.el.densityLabel) {
            this.el.btnDensity.classList.toggle('active', this.state.density === 'wide');
            this.el.densityLabel.textContent = (DENSITY_CONFIG[this.state.density] || DENSITY_CONFIG.comfy).label;
        }

        this.renderCoordBar(startIso, endExclIso);
        this.renderFooterStats(startIso, endExclIso);
    },

    renderCoordBar(startIso, endExclIso) {
        const bar = this.el.calCoordBar;
        if (!bar) return;
        bar.innerHTML = '';
        const esc = this.state.payload?.calendarioEscolar;

        if (esc) {
            if (esc.enSemanaLectiva && esc.semanaActual) {
                bar.appendChild(
                    h('span', 'cal-coord-pill is-week', `Semana ${esc.semanaActual}${esc.totalSemanas ? ` de ${esc.totalSemanas}` : ''} · Bloque ${esc.bloqueActual || 1}`)
                );
            } else {
                bar.appendChild(h('span', 'cal-coord-pill is-recess', 'Periodo no lectivo / Receso académico'));
            }

            const turnoTxt = esc.turno ? `Turno ${esc.turno}` : '';
            const aulasTxt = esc.aulasCount != null ? `${esc.aulasCount} salones` : '';
            const shiftLabel = [turnoTxt, aulasTxt].filter(Boolean).join(' · ');
            if (shiftLabel) {
                bar.appendChild(h('span', 'cal-coord-pill is-shift', shiftLabel));
            }
        }

        const feriadosVisibles = [];
        this.state.feriadosMap.forEach((f, fecha) => {
            if (fecha >= startIso && fecha < endExclIso) feriadosVisibles.push(f);
        });
        if (feriadosVisibles.length) {
            const first = feriadosVisibles[0];
            bar.appendChild(
                h('span', 'cal-coord-pill is-holiday', `Feriado: ${first.nombre}${feriadosVisibles.length > 1 ? ` (+${feriadosVisibles.length - 1})` : ''}`)
            );
        }

        const todayIso = toIsoDateLocal(new Date());
        const proxExamen = this.state.allEventos
            .filter(ev => ev.tipo === 'EXAMEN' && (ev.fecha || '') >= todayIso)
            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))[0];

        if (proxExamen) {
            const btn = h('button', 'cal-coord-pill is-action', `Próx. examen: ${proxExamen.titulo} (${proxExamen.fecha})`);
            btn.type = 'button';
            btn.addEventListener('click', () => this.irAEvento(proxExamen.id));
            bar.appendChild(btn);
        }

        const tareasActivas = this.state.allEventos.filter(ev => ev.tipo === 'TAREA');
        if (tareasActivas.length > 0) {
            const nextTask = tareasActivas.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))[0];
            const btn = h('button', 'cal-coord-pill is-action is-task', `${tareasActivas.length} tarea${tareasActivas.length > 1 ? 's' : ''} programada${tareasActivas.length > 1 ? 's' : ''}`);
            btn.type = 'button';
            btn.addEventListener('click', () => this.irAEvento(nextTask.id));
            bar.appendChild(btn);
        }

        bar.style.display = bar.childNodes.length ? 'flex' : 'none';
    },

    renderFooterStats(startIso, endExclIso) {
        if (!this.el.calFooterStats) return;
        let visibles = 0;
        let clases = 0;
        let evals = 0;
        let tareas = 0;

        this.state.allEventos.forEach(ev => {
            if (!this.eventoVisible(ev)) return;
            const f = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');
            if (!f || f < startIso || f >= endExclIso) return;
            visibles++;
            if (ev.tipo === 'CLASE') clases++;
            else if (ev.tipo === 'EXAMEN') evals++;
            else if (ev.tipo === 'TAREA') tareas++;
        });

        this.el.calFooterStats.textContent = `${visibles} actividad${visibles === 1 ? '' : 'es'} en este periodo (${clases} clases · ${evals} exámenes · ${tareas} tareas)`;
    },

    irAEvento(id) {
        const ev = this.state.allEventos.find(x => String(x.id) === String(id));
        if (!ev) return;
        const fecha = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');
        if (fecha && this.state.calendar) {
            this.state.calendar.gotoDate(fecha);
        }
        this.verDetalleEvento(ev.id);
    },

    verDetalleEvento(id) {
        const ev = this.state.allEventos.find(x => String(x.id) === String(id));
        if (!ev) return;
        this.state.detalleActual = ev;

        const tipo = (ev.tipo || 'CLASE').toUpperCase();
        const colorKey = colorKeyForEvent(ev);
        const accent = COLOR_ACCENT[colorKey] || COLOR_ACCENT.blue;
        const fecha = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');

        if (this.el.detailBand) this.el.detailBand.style.background = accent;
        if (this.el.detailKicker) {
            this.el.detailKicker.textContent = TIPO_LABEL[tipo] || tipo;
            this.el.detailKicker.style.color = accent;
        }
        if (this.el.modalDetailTitle) this.el.modalDetailTitle.textContent = ev.titulo || 'Detalle';
        if (this.el.detailDate) this.el.detailDate.textContent = formatFechaLarga(fecha);
        if (this.el.detailTime) {
            if (ev.todoElDia) {
                this.el.detailTime.textContent = 'Todo el día';
            } else {
                const hIni = normalizeHHMM(ev.hora) || '—';
                const hFin = normalizeHHMM(ev.horaFin);
                this.el.detailTime.textContent = hFin ? `${hIni} – ${hFin}` : hIni;
            }
        }

        if (this.el.detailCurso) this.el.detailCurso.textContent = labelCurso(ev);
        if (this.el.detailAula) {
            const extra = [ev.aula, ev.alumnos != null ? `${ev.alumnos} alumnos` : ''].filter(Boolean).join(' · ');
            this.el.detailAula.textContent = extra || 'Actividad de tu agenda docente';
        }

        if (this.el.rowEstado && this.el.detailEstado) {
            if (ev.estado) {
                this.el.rowEstado.style.display = '';
                this.el.detailEstado.textContent = ev.estado;
            } else {
                this.el.rowEstado.style.display = 'none';
            }
        }

        if (this.el.rowDesc && this.el.detailDesc) {
            if (ev.descripcion) {
                this.el.rowDesc.style.display = '';
                this.el.detailDesc.textContent = ev.descripcion;
            } else {
                this.el.rowDesc.style.display = 'none';
            }
        }

        if (this.el.btnDeleteEvent) {
            this.el.btnDeleteEvent.style.display = (ev.propio && ev.eventoId) ? 'inline-flex' : 'none';
        }
        if (this.el.btnLinkCurso) {
            if (ev.cursoId) {
                this.el.btnLinkCurso.style.display = 'inline-flex';
                this.el.btnLinkCurso.href = `#/mis-clases?curso=${encodeURIComponent(ev.cursoId)}`;
            } else {
                this.el.btnLinkCurso.style.display = 'none';
            }
        }
        if (this.el.btnLinkTarea) {
            this.el.btnLinkTarea.style.display = ev.tareaId ? 'inline-flex' : 'none';
        }

        this.el.modalDetailBackdrop?.classList.add('open');
    },

    cerrarModalDetalle() {
        this.el?.modalDetailBackdrop?.classList.remove('open');
        if (this.state) this.state.detalleActual = null;
    },

    abrirModalAdd(fechaIso, horaIni, horaFin) {
        if (!this.el?.modalAddBackdrop) return;
        const todayIso = toIsoDateLocal(new Date());
        if (this.el.formError) {
            this.el.formError.textContent = '';
            this.el.formError.classList.remove('show');
        }
        if (this.el.schedTitle) this.el.schedTitle.value = '';
        if (this.el.schedType) this.el.schedType.value = 'RECORDATORIO';
        if (this.el.schedCourse) this.el.schedCourse.value = '';
        if (this.el.schedDate) this.el.schedDate.value = fechaIso || todayIso;
        if (this.el.schedStart) this.el.schedStart.value = horaIni || '08:00';
        if (this.el.schedEnd) this.el.schedEnd.value = horaFin || '09:00';
        if (this.el.schedDesc) this.el.schedDesc.value = '';

        const firstColor = document.querySelector('input[name="schedColor"]');
        if (firstColor) firstColor.checked = true;

        this.el.modalAddBackdrop.classList.add('open');
        setTimeout(() => this.el.schedTitle?.focus(), 60);
    },

    cerrarModalAdd() {
        this.el?.modalAddBackdrop?.classList.remove('open');
    },

    async guardarNuevoEvento(e) {
        e.preventDefault();
        if (!this.state.docenteId) return;

        const titulo = (this.el.schedTitle?.value || '').trim();
        const tipo = (this.el.schedType?.value || 'RECORDATORIO').trim();
        const cursoId = (this.el.schedCourse?.value || '').trim();
        const fecha = this.el.schedDate?.value || '';
        const hora = this.el.schedStart?.value || '';
        const horaFin = this.el.schedEnd?.value || '';
        const descripcion = (this.el.schedDesc?.value || '').trim();
        const colorEl = document.querySelector('input[name="schedColor"]:checked');
        const color = colorEl?.value || 'purple';

        const showErr = (msg) => {
            if (!this.el.formError) return;
            this.el.formError.textContent = msg;
            this.el.formError.classList.add('show');
        };

        if (!titulo) return showErr('Ingresa un título para la actividad.');
        if (!fecha) return showErr('Selecciona una fecha.');
        if (!hora || !horaFin || horaFin <= hora) {
            return showErr('La hora de fin debe ser posterior a la hora de inicio.');
        }

        if (this.el.btnSaveSchedule) this.el.btnSaveSchedule.disabled = true;
        try {
            await API.fetch(`/api/docente/${encodeURIComponent(this.state.docenteId)}/calendario/eventos`, {
                method: 'POST',
                body: JSON.stringify({ titulo, tipo, cursoId, fecha, hora, horaFin, color, descripcion })
            });
            this.cerrarModalAdd();
            await this.cargarDatosCalendario();
            if (this.state.calendar && fecha) this.state.calendar.gotoDate(fecha);
        } catch (err) {
            showErr(err.message || 'No se pudo guardar la actividad.');
        } finally {
            if (this.el.btnSaveSchedule) this.el.btnSaveSchedule.disabled = false;
        }
    },

    async eliminarEventoActual() {
        const ev = this.state.detalleActual;
        const eventoId = ev?.eventoId || ev?.id;
        if (!ev?.propio || !eventoId || !this.state.docenteId) return;

        if (this.el.btnDeleteEvent) this.el.btnDeleteEvent.disabled = true;
        try {
            await API.fetch(
                `/api/docente/${encodeURIComponent(this.state.docenteId)}/calendario/eventos/${encodeURIComponent(eventoId)}`,
                { method: 'DELETE' }
            );
            this.cerrarModalDetalle();
            await this.cargarDatosCalendario();
        } catch (err) {
            alert(err.message || 'No se pudo eliminar el evento.');
        } finally {
            if (this.el.btnDeleteEvent) this.el.btnDeleteEvent.disabled = false;
        }
    },

    cambiarVista(nextMode, nextScale) {
        this.state.mode = nextMode;
        this.state.timeScale = nextScale;

        this.el.segBtns.forEach(b => b.classList.toggle('active', b.dataset.view === this.state.timeScale));
        this.el.btnViewList?.classList.toggle('active', this.state.mode === 'list');
        this.el.btnViewGrid?.classList.toggle('active', this.state.mode === 'grid');

        if (this.state.calendar) {
            this.state.calendar.changeView(this.getFcViewName());
            this.actualizarMountClasses();
            this.actualizarTituloBarra();
            this.actualizarBarraFooterYWeekends();
        }
    },

    wireUiControls() {
        const self = this;

        this.el.btnToday?.addEventListener('click', () => this.state.calendar?.today());
        this.el.btnPrev?.addEventListener('click', () => this.state.calendar?.prev());
        this.el.btnNext?.addEventListener('click', () => this.state.calendar?.next());

        this.el.segBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.cambiarVista(this.state.mode, btn.dataset.view || 'week');
            });
        });

        this.el.btnViewList?.addEventListener('click', () => this.cambiarVista('list', this.state.timeScale));
        this.el.btnViewGrid?.addEventListener('click', () => this.cambiarVista('grid', this.state.timeScale));

        this.el.btnToggleWeekends?.addEventListener('click', () => {
            this.state.weekends = !this.state.weekends;
            try { localStorage.setItem('sh_doc_cal_weekends', String(this.state.weekends)); } catch {}
            if (this.state.calendar) {
                this.state.calendar.setOption('weekends', this.state.weekends);
                this.actualizarMountClasses();
                this.actualizarTituloBarra();
                this.actualizarBarraFooterYWeekends();
                this.programarAjusteTarjetasAngostas();
            }
        });

        this.el.btnDensity?.addEventListener('click', () => {
            const idx = DENSITY_ORDER.indexOf(this.state.density);
            this.state.density = DENSITY_ORDER[(idx + 1) % DENSITY_ORDER.length];
            try { localStorage.setItem('sh_doc_cal_density', this.state.density); } catch {}
            if (this.state.calendar) {
                this.state.calendar.setOption('slotMinHeight', this.getSlotMinHeight());
                this.actualizarBarraFooterYWeekends();
                this.programarAjusteTarjetasAngostas();
            }
        });

        this.el.btnFilter?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = this.el.filterDropdown?.classList.toggle('open');
            this.el.btnFilter.classList.toggle('open', Boolean(isOpen));
        });
        this.el.filterDropdown?.addEventListener('click', (e) => e.stopPropagation());

        this.el.filterDropdown?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.closest('#courseFilterList')) return;
            const tipo = (cb.value || '').toUpperCase();
            if (this.state.tiposFiltro.hasOwnProperty(tipo)) {
                cb.checked = this.state.tiposFiltro[tipo];
                cb.addEventListener('change', () => {
                    this.state.tiposFiltro[tipo] = cb.checked;
                    this.onFiltersChanged();
                });
            }
        });

        this.el.btnFilterAll?.addEventListener('click', () => {
            Object.keys(this.state.tiposFiltro).forEach(k => { this.state.tiposFiltro[k] = true; });
            this.el.filterDropdown?.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; });
            this.state.cursosFiltro.forEach(info => { info.checked = true; });
            this.onFiltersChanged();
        });

        this.el.btnFilterNone?.addEventListener('click', () => {
            this.state.cursosFiltro.forEach(info => { info.checked = false; });
            this.el.courseFilterList?.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
            this.onFiltersChanged();
        });

        this.el.btnAddSchedule?.addEventListener('click', () => this.abrirModalAdd(toIsoDateLocal(new Date()), '08:00', '09:00'));
        this.el.btnAddClose?.addEventListener('click', () => this.cerrarModalAdd());
        this.el.btnCancelAdd?.addEventListener('click', () => this.cerrarModalAdd());
        this.el.modalAddBackdrop?.addEventListener('click', (e) => {
            if (e.target === this.el.modalAddBackdrop) this.cerrarModalAdd();
        });
        this.el.formAddSchedule?.addEventListener('submit', (e) => this.guardarNuevoEvento(e));

        this.el.btnDetailClose?.addEventListener('click', () => this.cerrarModalDetalle());
        this.el.btnDetailOk?.addEventListener('click', () => this.cerrarModalDetalle());
        this.el.btnLinkCurso?.addEventListener('click', () => this.cerrarModalDetalle());
        this.el.btnLinkTarea?.addEventListener('click', () => this.cerrarModalDetalle());
        this.el.modalDetailBackdrop?.addEventListener('click', (e) => {
            if (e.target === this.el.modalDetailBackdrop) this.cerrarModalDetalle();
        });
        this.el.btnDeleteEvent?.addEventListener('click', () => this.eliminarEventoActual());

        this._onDocClick = () => {
            if (!self.el?.fcCalendar?.isConnected) {
                self.cleanup();
                return;
            }
            self.el.filterDropdown?.classList.remove('open');
            self.el.btnFilter?.classList.remove('open');
        };
        document.addEventListener('click', this._onDocClick);

        this._onKeyDown = (e) => {
            if (!self.el?.fcCalendar?.isConnected) {
                self.cleanup();
                return;
            }
            if (e.key === 'Escape') {
                self.cerrarModalDetalle();
                self.cerrarModalAdd();
                self.el.filterDropdown?.classList.remove('open');
                self.el.btnFilter?.classList.remove('open');
                return;
            }
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (self.el.modalDetailBackdrop?.classList.contains('open') || self.el.modalAddBackdrop?.classList.contains('open')) return;

            if (e.key === 'ArrowLeft') self.state.calendar?.prev();
            else if (e.key === 'ArrowRight') self.state.calendar?.next();
            else if (e.key === 'h' || e.key === 'H') self.state.calendar?.today();
        };
        document.addEventListener('keydown', this._onKeyDown);

        this._onResize = () => {
            if (!self.el?.fcCalendar?.isConnected) {
                self.cleanup();
                return;
            }
            self.programarAjusteTarjetasAngostas();
        };
        window.addEventListener('resize', this._onResize);
    }
};
