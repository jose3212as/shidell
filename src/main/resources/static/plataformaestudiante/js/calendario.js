/**
 * Shidell · Calendario Estudiantil Interactivo con FullCalendar v7 (Tema Breezy)
 * Vistas Día / Semana / Mes + Vista Agenda/Lista, alternancia Lun–Vie / 7 días,
 * densidad adaptable de filas, tarjetas amplias sin recorte y gestión de recordatorios.
 */
(function () {
    'use strict';

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

    const PASTEL_PALETTE = [
        { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', ink: '#1e3a8a' },
        { bg: '#f5f3ff', border: '#ddd6fe', accent: '#7c3aed', ink: '#4c1d95' },
        { bg: '#ecfdf5', border: '#a7f3d0', accent: '#059669', ink: '#064e3b' },
        { bg: '#fff7ed', border: '#fed7aa', accent: '#ea580c', ink: '#7c2d12' },
        { bg: '#fdf2f8', border: '#fbcfe8', accent: '#db2777', ink: '#831843' },
        { bg: '#ecfeff', border: '#a5f3fc', accent: '#0891b2', ink: '#164e63' },
        { bg: '#fefce8', border: '#fde68a', accent: '#ca8a04', ink: '#713f12' },
        { bg: '#fef2f2', border: '#fecaca', accent: '#dc2626', ink: '#7f1d1d' }
    ];

    const COLOR_TO_PALETTE = {
        blue: PASTEL_PALETTE[0],
        purple: PASTEL_PALETTE[1],
        green: PASTEL_PALETTE[2],
        orange: PASTEL_PALETTE[3],
        pink: PASTEL_PALETTE[4],
        cyan: PASTEL_PALETTE[5],
        yellow: PASTEL_PALETTE[6],
        red: PASTEL_PALETTE[7],
        '#2563eb': PASTEL_PALETTE[0],
        '#3b82f6': PASTEL_PALETTE[0],
        '#7c3aed': PASTEL_PALETTE[1],
        '#8b5cf6': PASTEL_PALETTE[1],
        '#059669': PASTEL_PALETTE[2],
        '#10b981': PASTEL_PALETTE[2],
        '#d97706': PASTEL_PALETTE[3],
        '#ea580c': PASTEL_PALETTE[3],
        '#f97316': PASTEL_PALETTE[3],
        '#db2777': PASTEL_PALETTE[4],
        '#ec4899': PASTEL_PALETTE[4],
        '#0891b2': PASTEL_PALETTE[5],
        '#eab308': PASTEL_PALETTE[6],
        '#ca8a04': PASTEL_PALETTE[6],
        '#dc2626': PASTEL_PALETTE[7]
    };

    const TIPO_LABEL = {
        CLASE: 'Clase',
        EXAMEN: 'Examen',
        TAREA: 'Tarea',
        RECORDATORIO: 'Personal'
    };

    // ─── Estado ────────────────────────────────────────────────────────────────
    const state = {
        estudianteId: null,
        payload: null,
        allEventos: [],
        feriadosMap: new Map(),
        tiposFiltro: { CLASE: true, EXAMEN: true, TAREA: true, RECORDATORIO: true },
        cursosFiltro: new Map(), // clave -> { label, checked, color }
        mode: 'grid', // 'grid' | 'list'
        timeScale: 'week', // 'day' | 'week' | 'month'
        weekends: readStoredBool('sh_cal_weekends', true),
        density: readStoredDensity('sh_cal_density', 'comfy'),
        calendar: null,
        detalleActual: null
    };

    // ─── Referencias DOM ───────────────────────────────────────────────────────
    const el = {};

    function cacheDom() {
        el.calTitle = document.getElementById('calTitle');
        el.btnToday = document.getElementById('btnToday');
        el.btnPrev = document.getElementById('btnPrev');
        el.btnNext = document.getElementById('btnNext');
        el.segBtns = Array.from(document.querySelectorAll('.cal-segmented .seg-btn'));

        el.btnFilter = document.getElementById('btnFilter');
        el.filterCount = document.getElementById('filterCount');
        el.filterDropdown = document.getElementById('filterDropdown');
        el.cntClases = document.getElementById('cntClases');
        el.cntExamenes = document.getElementById('cntExamenes');
        el.cntTareas = document.getElementById('cntTareas');
        el.cntRecordatorios = document.getElementById('cntRecordatorios');
        el.courseFilterList = document.getElementById('courseFilterList');
        el.btnFilterAll = document.getElementById('btnFilterAll');
        el.btnFilterNone = document.getElementById('btnFilterNone');

        el.btnToggleWeekends = document.getElementById('btnToggleWeekends');
        el.weekendsLabel = document.getElementById('weekendsLabel');
        el.btnDensity = document.getElementById('btnDensity');
        el.densityLabel = document.getElementById('densityLabel');
        el.btnViewList = document.getElementById('btnViewList');
        el.btnViewGrid = document.getElementById('btnViewGrid');
        el.btnAddSchedule = document.getElementById('btnAddSchedule');

        el.calCoordBar = document.getElementById('calCoordBar');
        el.calBody = document.getElementById('calBody');
        el.calLoading = document.getElementById('calLoading');
        el.fcCalendar = document.getElementById('fcCalendar');
        el.calFooterStats = document.getElementById('calFooterStats');

        // Modal detalle
        el.modalDetailBackdrop = document.getElementById('modalDetailBackdrop');
        el.detailBand = document.getElementById('detailBand');
        el.detailKicker = document.getElementById('detailKicker');
        el.modalDetailTitle = document.getElementById('modalDetailTitle');
        el.btnDetailClose = document.getElementById('btnDetailClose');
        el.detailDate = document.getElementById('detailDate');
        el.detailTime = document.getElementById('detailTime');
        el.rowDocente = document.getElementById('rowDocente');
        el.detailDocente = document.getElementById('detailDocente');
        el.detailCurso = document.getElementById('detailCurso');
        el.rowEstado = document.getElementById('rowEstado');
        el.detailEstado = document.getElementById('detailEstado');
        el.rowDesc = document.getElementById('rowDesc');
        el.detailDesc = document.getElementById('detailDesc');
        el.btnDeleteEvent = document.getElementById('btnDeleteEvent');
        el.btnLinkCurso = document.getElementById('btnLinkCurso');
        el.btnLinkTarea = document.getElementById('btnLinkTarea');
        el.btnDetailOk = document.getElementById('btnDetailOk');

        // Modal agregar recordatorio
        el.modalAddBackdrop = document.getElementById('modalAddBackdrop');
        el.formAddSchedule = document.getElementById('formAddSchedule');
        el.formError = document.getElementById('formError');
        el.schedTitle = document.getElementById('schedTitle');
        el.schedDate = document.getElementById('schedDate');
        el.schedStart = document.getElementById('schedStart');
        el.schedEnd = document.getElementById('schedEnd');
        el.schedDesc = document.getElementById('schedDesc');
        el.btnAddClose = document.getElementById('btnAddClose');
        el.btnCancelAdd = document.getElementById('btnCancelAdd');
        el.btnSaveSchedule = document.getElementById('btnSaveSchedule');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────
    function readStoredBool(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            if (v === 'true') return true;
            if (v === 'false') return false;
        } catch (e) {}
        return fallback;
    }

    function readStoredDensity(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            if (v && DENSITY_CONFIG[v]) return v;
        } catch (e) {}
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

    function claveCurso(ev) {
        if (ev?.cursoKey) return String(ev.cursoKey).trim().toUpperCase();
        const raw = (ev?.curso || '').trim();
        if (raw) return raw.toUpperCase().replace(/\s+/g, ' ');
        return ev?.tipo === 'RECORDATORIO' ? 'PERSONAL' : 'GENERAL';
    }

    function labelCurso(ev) {
        const raw = (ev?.curso || '').trim();
        if (raw) return raw;
        return ev?.tipo === 'RECORDATORIO' ? 'Personal / Recordatorios' : 'General';
    }

    function paletteForEvent(ev) {
        const keyColor = (ev?.color || '').trim().toLowerCase();
        if (COLOR_TO_PALETTE[keyColor]) return COLOR_TO_PALETTE[keyColor];
        if (keyColor.startsWith('#') && keyColor.length === 7) {
            return {
                bg: keyColor + '18',
                border: keyColor + '55',
                accent: keyColor,
                ink: '#0f172a'
            };
        }
        const key = claveCurso(ev);
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        }
        return PASTEL_PALETTE[hash % PASTEL_PALETTE.length];
    }

    function inicialesDocente(nombre) {
        if (!nombre) return '';
        const parts = nombre.trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
                    if (child != null) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
                });
            } else if (typeof content === 'string') {
                node.textContent = content;
            } else {
                node.appendChild(content);
            }
        }
        return node;
    }

    // ─── Carga de API & Estado Inicial ─────────────────────────────────────────
    async function resolverEstudianteId() {
        if (window.shidellSession?.obtenerUsuario) {
            const u = await window.shidellSession.obtenerUsuario();
            if (u?.id) return u.id;
        }
        try {
            const raw = localStorage.getItem('shidell_user');
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed?.id || null;
        } catch (e) {
            return null;
        }
    }

    async function cargarDatosCalendario() {
        const resp = await fetch(`/api/calendario/estudiante/${encodeURIComponent(state.estudianteId)}`, {
            credentials: 'same-origin'
        });
        if (!resp.ok) {
            throw new Error(`No se pudo obtener el calendario (HTTP ${resp.status})`);
        }
        const data = await resp.json();
        aplicarPayload(data);
    }

    function aplicarPayload(data) {
        state.payload = data || {};
        state.allEventos = Array.isArray(data?.eventos) ? data.eventos : [];
        state.feriadosMap = new Map();
        const feriados = data?.calendarioEscolar?.feriados || [];
        feriados.forEach(f => {
            if (f?.fecha) state.feriadosMap.set(f.fecha, f);
        });

        construirFiltrosCurso();
        actualizarContadoresFiltro();
        renderFilterCountBadge();
        sincronizarEventosCalendar();
    }

    // ─── Filtros por Tipo y Curso ──────────────────────────────────────────────
    function wireTypeCheckboxes() {
        const mappings = [
            { tipo: 'CLASE', cntEl: el.cntClases },
            { tipo: 'EXAMEN', cntEl: el.cntExamenes },
            { tipo: 'TAREA', cntEl: el.cntTareas },
            { tipo: 'RECORDATORIO', cntEl: el.cntRecordatorios }
        ];
        mappings.forEach(({ tipo, cntEl }) => {
            const cb = cntEl?.closest('label')?.querySelector('input[type="checkbox"]');
            if (!cb) return;
            cb.checked = state.tiposFiltro[tipo] !== false;
            cb.addEventListener('change', () => {
                state.tiposFiltro[tipo] = cb.checked;
                onFiltersChanged();
            });
        });

        // Soporte adicional por selector genérico si faltara algún label
        el.filterDropdown?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.closest('#courseFilterList') || cb.dataset.boundType) return;
            const candidate = (cb.dataset.type || cb.dataset.tipo || cb.value || '').toUpperCase();
            if (state.tiposFiltro.hasOwnProperty(candidate)) {
                cb.dataset.boundType = '1';
                cb.checked = state.tiposFiltro[candidate];
                cb.addEventListener('change', () => {
                    state.tiposFiltro[candidate] = cb.checked;
                    onFiltersChanged();
                });
            }
        });
    }

    function construirFiltrosCurso() {
        const prevStates = new Map();
        state.cursosFiltro.forEach((info, k) => prevStates.set(k, info.checked));
        const nextMap = new Map();

        const cursosApi = state.payload?.cursos || [];
        cursosApi.forEach(c => {
            const evSim = { curso: c.nombre || c.titulo, cursoKey: c.cursoKey, color: c.color };
            const key = claveCurso(evSim);
            if (!nextMap.has(key)) {
                nextMap.set(key, {
                    label: c.nombre || c.titulo || key,
                    checked: prevStates.has(key) ? prevStates.get(key) : true,
                    color: paletteForEvent(evSim).accent
                });
            }
        });

        state.allEventos.forEach(ev => {
            const key = claveCurso(ev);
            if (!nextMap.has(key)) {
                nextMap.set(key, {
                    label: labelCurso(ev),
                    checked: prevStates.has(key) ? prevStates.get(key) : true,
                    color: paletteForEvent(ev).accent
                });
            }
        });

        state.cursosFiltro = nextMap;
        renderCourseFiltersDom();
    }

    function renderCourseFiltersDom() {
        if (!el.courseFilterList) return;
        el.courseFilterList.innerHTML = '';
        if (state.cursosFiltro.size === 0) {
            el.courseFilterList.appendChild(h('p', 'cal-muted-empty', 'Sin cursos cargados'));
            return;
        }
        state.cursosFiltro.forEach((info, key) => {
            const labelEl = document.createElement('label');
            labelEl.className = 'cal-check';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = info.checked;
            cb.addEventListener('change', () => {
                info.checked = cb.checked;
                onFiltersChanged();
            });

            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.style.background = info.color || '#2563eb';

            const spanTxt = h('span', 'lbl', info.label);

            labelEl.appendChild(cb);
            labelEl.appendChild(dot);
            labelEl.appendChild(spanTxt);
            el.courseFilterList.appendChild(labelEl);
        });
    }

    function actualizarContadoresFiltro() {
        const counts = { CLASE: 0, EXAMEN: 0, TAREA: 0, RECORDATORIO: 0 };
        state.allEventos.forEach(ev => {
            const t = (ev.tipo || 'CLASE').toUpperCase();
            if (counts[t] !== undefined) counts[t]++;
        });
        if (el.cntClases) el.cntClases.textContent = String(counts.CLASE);
        if (el.cntExamenes) el.cntExamenes.textContent = String(counts.EXAMEN);
        if (el.cntTareas) el.cntTareas.textContent = String(counts.TAREA);
        if (el.cntRecordatorios) el.cntRecordatorios.textContent = String(counts.RECORDATORIO);
    }

    function renderFilterCountBadge() {
        if (!el.filterCount) return;
        let hidden = 0;
        Object.values(state.tiposFiltro).forEach(v => { if (!v) hidden++; });
        state.cursosFiltro.forEach(info => { if (!info.checked) hidden++; });
        if (hidden > 0) {
            el.filterCount.textContent = String(hidden);
            el.filterCount.classList.add('show');
        } else {
            el.filterCount.textContent = '0';
            el.filterCount.classList.remove('show');
        }
    }

    function eventoVisible(ev) {
        const tipo = (ev.tipo || 'CLASE').toUpperCase();
        if (state.tiposFiltro[tipo] === false) return false;
        const cKey = claveCurso(ev);
        const courseEntry = state.cursosFiltro.get(cKey);
        if (courseEntry && !courseEntry.checked) return false;
        return true;
    }

    function onFiltersChanged() {
        renderFilterCountBadge();
        sincronizarEventosCalendar();
    }

    // ─── Mapeo de Eventos a FullCalendar v7 ────────────────────────────────────
    function buildFullCalendarEvents() {
        const fcEvents = [];

        // Feriados como eventos de fondo
        state.feriadosMap.forEach((f, fecha) => {
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

        // Eventos académicos y recordatorios filtrados
        state.allEventos.forEach(ev => {
            if (!eventoVisible(ev)) return;
            const fecha = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');
            if (!fecha) return;

            const tipo = (ev.tipo || 'CLASE').toUpperCase();
            const isAllDay = Boolean(ev.todoElDia) || (tipo === 'TAREA' && !ev.hora);
            const palette = paletteForEvent(ev);
            const horaIni = normalizeHHMM(ev.hora || (ev.fechaInicio && String(ev.fechaInicio).length >= 16 ? String(ev.fechaInicio).slice(11, 16) : ''));
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

            const done = String(ev.estado || '').toLowerCase() === 'completada';
            const cls = [];
            if (tipo === 'EXAMEN') cls.push('is-exam');
            if (done) cls.push('is-done');

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
                    palette,
                    horaIni: horaIni || (isAllDay ? '' : '08:00'),
                    horaFin: isAllDay ? '' : horaFin
                }
            });
        });

        return fcEvents;
    }

    function sincronizarEventosCalendar() {
        if (!state.calendar) return;
        const sourceEvents = buildFullCalendarEvents();
        state.calendar.removeAllEvents();
        state.calendar.addEventSource(sourceEvents);
        actualizarBarraFooterYWeekends();
    }

    // ─── FullCalendar v7 Setup & Custom Rendering ──────────────────────────────
    function getFcViewName() {
        if (state.mode === 'list') {
            if (state.timeScale === 'day') return 'listDay';
            if (state.timeScale === 'month') return 'listMonth';
            return 'listWeek';
        }
        if (state.timeScale === 'day') return 'timeGridDay';
        if (state.timeScale === 'month') return 'dayGridMonth';
        return 'timeGridWeek';
    }

    function getSlotMinHeight() {
        return (DENSITY_CONFIG[state.density] || DENSITY_CONFIG.comfy).slotMinHeight;
    }

    function formatHourPill(date) {
        const hour24 = date.getHours();
        const ampm = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        return { main: `${hour12}:00`, ampm };
    }

    function buildSlotHeaderContent(arg) {
        const { main, ampm } = formatHourPill(arg.date);
        const pill = h('span', 'sh-fc-hour-pill', [
            h('span', null, main),
            h('small', null, ampm)
        ]);
        return { domNodes: [pill] };
    }

    function buildDayHeaderContent(arg) {
        const viewType = arg.view.type;
        if (viewType === 'dayGridMonth') {
            return { domNodes: [document.createTextNode(arg.text)] };
        }
        const dateIso = toIsoDateLocal(arg.date);
        const holiday = state.feriadosMap.get(dateIso);
        const wrap = h('div', `sh-fc-dayhead-inner${arg.isToday ? ' is-today' : ''}`);
        const top = h('div', 'sh-fc-dh-top', [
            h('span', 'sh-fc-dh-dow', DAYS_SHORT_ES[arg.date.getDay()]),
            h('span', 'sh-fc-dh-num', String(arg.date.getDate()))
        ]);
        wrap.appendChild(top);
        if (holiday) {
            wrap.appendChild(h('span', 'sh-fc-dh-holiday', `Feriado · ${holiday.nombre}`));
        }
        return { domNodes: [wrap] };
    }

    function buildEventContent(arg) {
        // Eventos de fondo (feriados)
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

        // Vista Agenda / Lista
        if (viewType.startsWith('list')) {
            const card = h('div', 'sh-fc-list-card');
            const main = h('div', 'sh-fc-list-main');
            const titleRow = h('div', 'sh-fc-list-title-row', [
                h('span', 'sh-fc-list-badge', typeLabel),
                h('span', 'sh-fc-list-time', timeRange || 'Todo el día'),
                h('span', 'sh-fc-list-title', ev.titulo || arg.event.title)
            ]);
            main.appendChild(titleRow);

            const subParts = [];
            if (ev.curso) subParts.push(ev.curso);
            if (ev.docente) subParts.push(`Docente: ${ev.docente}`);
            if (ev.descripcion) subParts.push(ev.descripcion);
            if (subParts.length) {
                main.appendChild(h('div', 'sh-fc-list-sub', subParts.join(' · ')));
            }
            card.appendChild(main);

            const right = h('div', 'sh-fc-list-right');
            if (ev.estado) {
                right.appendChild(h('span', 'sh-fc-list-status', ev.estado));
            } else if (ev.propio) {
                right.appendChild(h('span', 'sh-fc-list-status', 'Recordatorio personal'));
            }
            if (right.childNodes.length) card.appendChild(right);
            return { domNodes: [card] };
        }

        // Eventos Todo el Día o en Vista Mes
        if (arg.event.allDay || viewType === 'dayGridMonth') {
            const row = h('div', 'sh-fc-row-card', [
                h('span', 'sh-fc-row-dot')
            ]);
            if (timeRange) {
                row.appendChild(h('span', 'sh-fc-row-time', props.horaIni || timeRange));
            }
            row.appendChild(h('span', 'sh-fc-row-title', ev.titulo || arg.event.title));
            const miniBadge = ev.estado || (tipo === 'EXAMEN' ? 'Examen' : '');
            if (miniBadge) {
                row.appendChild(h('span', 'sh-fc-row-badge', miniBadge));
            }
            return { domNodes: [row] };
        }

        // Vista Semana / Día (TimeGrid Column Event): lista de nodos Element (nunca DocumentFragment, que carece de .remove())
        const nodes = [];
        nodes.push(h('div', 'sh-fc-card-top', [
            h('span', 'sh-fc-type-pill', typeLabel),
            timeRange ? h('span', 'sh-fc-card-time', timeRange) : null
        ]));
        nodes.push(h('div', 'sh-fc-card-title', ev.titulo || arg.event.title));

        const tituloLower = (ev.titulo || '').trim().toLowerCase();
        const cursoLower = (ev.curso || '').trim().toLowerCase();
        const showCourseSub = cursoLower && !tituloLower.includes(cursoLower);
        if (showCourseSub) {
            nodes.push(h('div', 'sh-fc-card-sub', ev.curso));
        }

        if (ev.docente || ev.estado || ev.propio) {
            const foot = h('div', 'sh-fc-card-foot');
            if (ev.docente) {
                foot.appendChild(h('span', 'sh-fc-avatar', inicialesDocente(ev.docente)));
                foot.appendChild(h('span', 'sh-fc-teacher', ev.docente));
            } else if (ev.estado) {
                foot.appendChild(h('span', 'sh-fc-teacher', `Estado: ${ev.estado}`));
            } else if (ev.propio) {
                foot.appendChild(h('span', 'sh-fc-teacher', 'Mi recordatorio'));
            }
            nodes.push(foot);
        }

        return { domNodes: nodes };
    }

    let narrowRafId = 0;
    function programarAjusteTarjetasAngostas() {
        if (!el.fcCalendar) return;
        if (narrowRafId) cancelAnimationFrame(narrowRafId);
        narrowRafId = requestAnimationFrame(() => {
            narrowRafId = 0;
            el.fcCalendar?.querySelectorAll('.sh-fc-col-event').forEach(node => {
                const w = node.clientWidth;
                node.classList.toggle('is-narrow', w > 0 && w < 92);
                node.classList.toggle('is-ultra-narrow', w > 0 && w < 68);
            });
        });
    }

    function inicializarFullCalendar() {
        if (!window.FullCalendar || !el.fcCalendar) {
            throw new Error('FullCalendar v7 no está disponible en la página.');
        }

        state.calendar = new FullCalendar.Calendar(el.fcCalendar, {
            locale: 'es',
            initialView: getFcViewName(),
            headerToolbar: false,
            borderless: true,
            firstDay: 1,
            weekends: state.weekends,
            height: 'auto',
            slotMinTime: '07:00:00',
            slotMaxTime: '20:00:00',
            slotDuration: '00:30:00',
            slotHeaderInterval: '01:00:00',
            slotMinHeight: getSlotMinHeight(),
            expandRows: true,
            allDaySlot: true,
            allDayText: 'Todo el día',
            slotEventOverlap: false,
            navLinks: true,
            navLinkDayClick: (date) => {
                state.calendar.gotoDate(date);
                cambiarVista('grid', 'day');
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
                    slotHeaderContent: buildSlotHeaderContent,
                    dayHeaderInnerClass: 'sh-fc-dayhead-inner-wrap',
                    dayHeaderContent: buildDayHeaderContent
                }
            },

            dayCellClassNames: (arg) => {
                const iso = toIsoDateLocal(arg.date);
                return state.feriadosMap.has(iso) ? ['sh-fc-day-holiday'] : [];
            },

            eventContent: buildEventContent,

            eventDidMount: (info) => {
                if (info.event.display === 'background') return;
                const props = info.event.extendedProps || {};
                const p = props.palette || PASTEL_PALETTE[0];
                info.el.style.setProperty('--ev-bg', p.bg);
                info.el.style.setProperty('--ev-border', p.border);
                info.el.style.setProperty('--ev-accent', p.accent);
                info.el.style.setProperty('--ev-ink', p.ink);
                info.el.style.setProperty('--fc-breezy-event', p.accent);

                const ev = props.raw || {};
                const parts = [
                    `${TIPO_LABEL[props.tipo] || props.tipo || 'Evento'}: ${ev.titulo || info.event.title}`,
                    props.horaIni ? `${props.horaIni}–${props.horaFin || ''}` : 'Todo el día',
                    ev.curso ? `Curso: ${ev.curso}` : '',
                    ev.docente ? `Docente: ${ev.docente}` : '',
                    ev.descripcion ? ev.descripcion : ''
                ].filter(Boolean);
                info.el.title = parts.join(' • ');
            },

            eventClick: (info) => {
                if (info.event.display === 'background') return;
                const ev = info.event.extendedProps?.raw;
                if (ev) verDetalleEvento(ev.id);
            },

            select: (info) => {
                state.calendar.unselect();
                const fecha = toIsoDateLocal(info.start);
                if (info.allDay) {
                    abrirModalAdd(fecha, '08:00', '09:00');
                    return;
                }
                const startHHMM = `${pad2(info.start.getHours())}:${pad2(info.start.getMinutes())}`;
                let endHHMM = `${pad2(info.end.getHours())}:${pad2(info.end.getMinutes())}`;
                const diffMins = Math.round((info.end.getTime() - info.start.getTime()) / 60000);
                // Si fue un solo clic (1 slot de 30m), sugiere 60 minutos por comodidad
                if (diffMins <= 30) {
                    endHHMM = addMinutesHHMM(startHHMM, 60);
                }
                abrirModalAdd(fecha, startHHMM, endHHMM);
            },

            eventsSet: () => {
                programarAjusteTarjetasAngostas();
            },

            datesSet: () => {
                actualizarMountClasses();
                actualizarTituloBarra();
                actualizarBarraFooterYWeekends();
                programarAjusteTarjetasAngostas();
            }
        });

        state.calendar.render();
        if (el.calLoading) el.calLoading.style.display = 'none';
        sincronizarEventosCalendar();
        actualizarMountClasses();
        actualizarTituloBarra();
        programarAjusteTarjetasAngostas();
        window.addEventListener('resize', programarAjusteTarjetasAngostas);
    }

    function actualizarMountClasses() {
        if (!el.fcCalendar) return;
        const isWeekGrid = state.mode === 'grid' && state.timeScale === 'week';
        el.fcCalendar.classList.toggle('is-week-full', isWeekGrid && state.weekends);
        el.fcCalendar.classList.toggle('is-week-work', isWeekGrid && !state.weekends);
    }

    // ─── Título, Barra de Coordinación y Footer ────────────────────────────────
    function actualizarTituloBarra() {
        if (!state.calendar || !el.calTitle) return;
        const view = state.calendar.view;
        const start = view.currentStart;
        const endIncl = new Date(view.currentEnd.getTime() - 1);

        let title = '';
        if (state.timeScale === 'month') {
            title = `${MONTHS_ES[start.getMonth()]} de ${start.getFullYear()}`;
        } else if (state.timeScale === 'day') {
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
        el.calTitle.textContent = title;
    }

    function actualizarBarraFooterYWeekends() {
        if (!state.calendar) return;
        const view = state.calendar.view;
        const startIso = toIsoDateLocal(view.currentStart);
        const endExclIso = toIsoDateLocal(view.currentEnd);

        // Detectar eventos en sáb/dom dentro del rango visible para avisar si están ocultos
        let weekendCount = 0;
        if (!state.weekends) {
            state.allEventos.forEach(ev => {
                if (!eventoVisible(ev)) return;
                const f = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');
                if (!f || f < startIso || f >= endExclIso) return;
                const [y, m, d] = f.split('-').map(Number);
                const dow = new Date(y, m - 1, d).getDay();
                if (dow === 0 || dow === 6) weekendCount++;
            });
        }

        if (el.btnToggleWeekends && el.weekendsLabel) {
            el.btnToggleWeekends.classList.toggle('active', !state.weekends);
            const oldBadge = el.btnToggleWeekends.querySelector('.cal-chip-badge');
            if (oldBadge) oldBadge.remove();
            el.weekendsLabel.textContent = state.weekends ? '7 días' : 'Solo Lun–Vie';
            if (!state.weekends && weekendCount > 0) {
                el.btnToggleWeekends.appendChild(h('span', 'cal-chip-badge', `${weekendCount} fin sem.`));
            }
        }

        if (el.btnDensity && el.densityLabel) {
            el.btnDensity.classList.toggle('active', state.density === 'wide');
            el.densityLabel.textContent = (DENSITY_CONFIG[state.density] || DENSITY_CONFIG.comfy).label;
        }

        renderCoordBar(startIso, endExclIso);
        renderFooterStats(startIso, endExclIso);
    }

    function renderCoordBar(startIso, endExclIso) {
        if (!el.calCoordBar) return;
        el.calCoordBar.innerHTML = '';
        const esc = state.payload?.calendarioEscolar;
        const grupo = state.payload?.grupo;

        if (esc) {
            if (esc.enSemanaLectiva && esc.semanaActual) {
                el.calCoordBar.appendChild(
                    h('span', 'cal-coord-pill is-week', `Semana ${esc.semanaActual}${esc.totalSemanas ? ` de ${esc.totalSemanas}` : ''} · ${esc.bloqueActual || 'Ciclo lectivo'}`)
                );
            } else {
                el.calCoordBar.appendChild(
                    h('span', 'cal-coord-pill is-recess', 'Periodo no lectivo / Receso académico')
                );
            }
            if (esc.turno || grupo?.turno) {
                const turnoTxt = esc.turno || grupo.turno;
                const gradoTxt = grupo?.grado ? ` · ${grupo.grado} ${grupo.seccion || ''}`.trim() : '';
                el.calCoordBar.appendChild(
                    h('span', 'cal-coord-pill is-shift', `Turno ${turnoTxt}${gradoTxt}`)
                );
            }
        }

        // Feriados dentro del periodo visible
        const feriadosVisibles = [];
        state.feriadosMap.forEach((f, fecha) => {
            if (fecha >= startIso && fecha < endExclIso) feriadosVisibles.push(f);
        });
        if (feriadosVisibles.length) {
            const first = feriadosVisibles[0];
            el.calCoordBar.appendChild(
                h('span', 'cal-coord-pill is-holiday', `Feriado: ${first.nombre}${feriadosVisibles.length > 1 ? ` (+${feriadosVisibles.length - 1})` : ''}`)
            );
        }

        // Botones de acceso rápido: próximo examen y tareas pendientes
        const todayIso = toIsoDateLocal(new Date());
        const proxExamen = state.allEventos
            .filter(ev => ev.tipo === 'EXAMEN' && (ev.fecha || '') >= todayIso)
            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))[0];

        if (proxExamen) {
            const btn = h('button', 'cal-coord-pill is-action', `Próx. examen: ${proxExamen.titulo} (${proxExamen.fecha})`);
            btn.type = 'button';
            btn.addEventListener('click', () => irAEvento(proxExamen.id));
            el.calCoordBar.appendChild(btn);
        }

        const tareasPend = state.allEventos.filter(
            ev => ev.tipo === 'TAREA' && String(ev.estado || '').toLowerCase() !== 'completada'
        );
        if (tareasPend.length > 0) {
            const nextTask = tareasPend.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))[0];
            const btn = h('button', 'cal-coord-pill is-action is-task', `${tareasPend.length} tarea${tareasPend.length > 1 ? 's' : ''} pendiente${tareasPend.length > 1 ? 's' : ''}`);
            btn.type = 'button';
            btn.addEventListener('click', () => irAEvento(nextTask.id));
            el.calCoordBar.appendChild(btn);
        }
    }

    function renderFooterStats(startIso, endExclIso) {
        if (!el.calFooterStats) return;
        let visiblesEnRango = 0;
        let clases = 0;
        let evals = 0;
        let tareas = 0;

        state.allEventos.forEach(ev => {
            if (!eventoVisible(ev)) return;
            const f = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');
            if (!f || f < startIso || f >= endExclIso) return;
            visiblesEnRango++;
            if (ev.tipo === 'CLASE') clases++;
            else if (ev.tipo === 'EXAMEN') evals++;
            else if (ev.tipo === 'TAREA') tareas++;
        });

        el.calFooterStats.textContent = `${visiblesEnRango} evento${visiblesEnRango === 1 ? '' : 's'} en este periodo (${clases} clases · ${evals} exámenes · ${tareas} tareas)`;
    }

    function irAEvento(id) {
        const ev = state.allEventos.find(x => String(x.id) === String(id));
        if (!ev) return;
        const fecha = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');
        if (fecha && state.calendar) {
            state.calendar.gotoDate(fecha);
        }
        verDetalleEvento(ev.id);
    }
    window.irAEvento = irAEvento;

    // ─── Modales (Detalle y Nuevo Recordatorio) ────────────────────────────────
    function verDetalleEvento(id) {
        const ev = state.allEventos.find(x => String(x.id) === String(id));
        if (!ev) return;
        state.detalleActual = ev;

        const tipo = (ev.tipo || 'CLASE').toUpperCase();
        const p = paletteForEvent(ev);
        const fecha = ev.fecha || (ev.fechaInicio ? String(ev.fechaInicio).slice(0, 10) : '');

        if (el.detailBand) el.detailBand.style.background = p.accent;
        if (el.detailKicker) {
            el.detailKicker.textContent = TIPO_LABEL[tipo] || tipo;
            el.detailKicker.style.color = p.accent;
        }
        if (el.modalDetailTitle) el.modalDetailTitle.textContent = ev.titulo || 'Detalle del evento';
        if (el.detailDate) el.detailDate.textContent = formatFechaLarga(fecha);
        if (el.detailTime) {
            if (ev.todoElDia) {
                el.detailTime.textContent = 'Todo el día';
            } else {
                const hIni = normalizeHHMM(ev.hora) || '—';
                const hFin = normalizeHHMM(ev.horaFin);
                el.detailTime.textContent = hFin ? `${hIni} – ${hFin}` : hIni;
            }
        }

        if (el.rowDocente && el.detailDocente) {
            if (ev.docente) {
                el.rowDocente.style.display = '';
                el.detailDocente.textContent = ev.docente;
            } else {
                el.rowDocente.style.display = 'none';
            }
        }

        if (el.detailCurso) el.detailCurso.textContent = labelCurso(ev);

        if (el.rowEstado && el.detailEstado) {
            if (ev.estado) {
                el.rowEstado.style.display = '';
                el.detailEstado.textContent = ev.estado;
            } else {
                el.rowEstado.style.display = 'none';
            }
        }

        if (el.rowDesc && el.detailDesc) {
            if (ev.descripcion) {
                el.rowDesc.style.display = '';
                el.detailDesc.textContent = ev.descripcion;
            } else {
                el.rowDesc.style.display = 'none';
            }
        }

        if (el.btnDeleteEvent) {
            el.btnDeleteEvent.style.display = ev.propio ? 'inline-flex' : 'none';
        }
        if (el.btnLinkCurso) {
            if (ev.cursoId) {
                el.btnLinkCurso.style.display = 'inline-flex';
                el.btnLinkCurso.href = `cursodetalleestudiante.html?id=${encodeURIComponent(ev.cursoId)}`;
            } else {
                el.btnLinkCurso.style.display = 'none';
            }
        }
        if (el.btnLinkTarea) {
            if (ev.tareaId) {
                el.btnLinkTarea.style.display = 'inline-flex';
                el.btnLinkTarea.href = `tareadetalle.html?id=${encodeURIComponent(ev.tareaId)}`;
            } else {
                el.btnLinkTarea.style.display = 'none';
            }
        }

        el.modalDetailBackdrop?.classList.add('open');
    }

    function cerrarModalDetalle() {
        el.modalDetailBackdrop?.classList.remove('open');
        state.detalleActual = null;
    }

    function abrirModalAdd(fechaIso, horaIni, horaFin) {
        if (!el.modalAddBackdrop) return;
        const todayIso = toIsoDateLocal(new Date());
        if (el.formError) {
            el.formError.textContent = '';
            el.formError.classList.remove('show');
        }
        if (el.schedTitle) el.schedTitle.value = '';
        if (el.schedDate) el.schedDate.value = fechaIso || todayIso;
        if (el.schedStart) el.schedStart.value = horaIni || '08:00';
        if (el.schedEnd) el.schedEnd.value = horaFin || '09:00';
        if (el.schedDesc) el.schedDesc.value = '';

        const firstColor = document.querySelector('input[name="schedColor"]');
        if (firstColor) firstColor.checked = true;

        el.modalAddBackdrop.classList.add('open');
        setTimeout(() => el.schedTitle?.focus(), 60);
    }

    function cerrarModalAdd() {
        el.modalAddBackdrop?.classList.remove('open');
    }

    async function guardarNuevoHorario(e) {
        e.preventDefault();
        if (!state.estudianteId) return;

        const titulo = (el.schedTitle?.value || '').trim();
        const fecha = el.schedDate?.value || '';
        const hora = el.schedStart?.value || '';
        const horaFin = el.schedEnd?.value || '';
        const descripcion = (el.schedDesc?.value || '').trim();
        const colorEl = document.querySelector('input[name="schedColor"]:checked');
        const color = colorEl?.value || '#2563eb';

        const showErr = (msg) => {
            if (!el.formError) return;
            el.formError.textContent = msg;
            el.formError.classList.add('show');
        };

        if (!titulo) return showErr('Ingresa un título para tu recordatorio o bloque.');
        if (!fecha) return showErr('Selecciona una fecha.');
        if (!hora || !horaFin || horaFin <= hora) {
            return showErr('La hora de fin debe ser posterior a la hora de inicio.');
        }

        if (el.btnSaveSchedule) el.btnSaveSchedule.disabled = true;
        try {
            const resp = await fetch(`/api/calendario/estudiante/${encodeURIComponent(state.estudianteId)}/recordatorios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ titulo, fecha, hora, horaFin, color, descripcion })
            });
            const body = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                throw new Error(body?.message || body?.error || 'No se pudo guardar el recordatorio.');
            }
            cerrarModalAdd();
            await cargarDatosCalendario();
            if (state.calendar && fecha) state.calendar.gotoDate(fecha);
        } catch (err) {
            const msg = window.ShidellErrors
                ? window.ShidellErrors.humanizar(err, 'No pudimos guardar tu recordatorio. Intenta de nuevo.')
                : (err?.message || 'No pudimos guardar tu recordatorio.');
            showErr(msg);
        } finally {
            if (el.btnSaveSchedule) el.btnSaveSchedule.disabled = false;
        }
    }

    async function eliminarEventoActual() {
        const ev = state.detalleActual;
        if (!ev?.propio || !state.estudianteId) return;
        if (el.btnDeleteEvent) el.btnDeleteEvent.disabled = true;
        try {
            const resp = await fetch(
                `/api/calendario/estudiante/${encodeURIComponent(state.estudianteId)}/recordatorios/${encodeURIComponent(ev.id)}`,
                { method: 'DELETE', credentials: 'same-origin' }
            );
            if (!resp.ok) throw new Error('No se pudo eliminar el recordatorio.');
            cerrarModalDetalle();
            await cargarDatosCalendario();
        } catch (err) {
            const msg = window.ShidellErrors
                ? window.ShidellErrors.humanizar(err, 'No pudimos quitar ese recordatorio ahora.')
                : (err?.message || 'No pudimos quitar ese recordatorio ahora.');
            if (window.AppAlerts?.mostrarError) window.AppAlerts.mostrarError(msg);
            else alert(msg);
        } finally {
            if (el.btnDeleteEvent) el.btnDeleteEvent.disabled = false;
        }
    }

    // ─── Enlace de Eventos de Toolbar y Teclado ────────────────────────────────
    function cambiarVista(nextMode, nextScale) {
        state.mode = nextMode;
        state.timeScale = nextScale;

        el.segBtns.forEach(b => b.classList.toggle('active', b.dataset.view === state.timeScale));
        el.btnViewList?.classList.toggle('active', state.mode === 'list');
        el.btnViewGrid?.classList.toggle('active', state.mode === 'grid');

        if (state.calendar) {
            state.calendar.changeView(getFcViewName());
            actualizarMountClasses();
            actualizarTituloBarra();
            actualizarBarraFooterYWeekends();
        }
    }

    function wireUiControls() {
        el.btnToday?.addEventListener('click', () => state.calendar?.today());
        el.btnPrev?.addEventListener('click', () => state.calendar?.prev());
        el.btnNext?.addEventListener('click', () => state.calendar?.next());

        el.segBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const scale = btn.dataset.view || 'week';
                cambiarVista(state.mode, scale);
            });
        });

        el.btnViewList?.addEventListener('click', () => cambiarVista('list', state.timeScale));
        el.btnViewGrid?.addEventListener('click', () => cambiarVista('grid', state.timeScale));

        el.btnToggleWeekends?.addEventListener('click', () => {
            state.weekends = !state.weekends;
            try { localStorage.setItem('sh_cal_weekends', String(state.weekends)); } catch (e) {}
            if (state.calendar) {
                state.calendar.setOption('weekends', state.weekends);
                actualizarMountClasses();
                actualizarTituloBarra();
                actualizarBarraFooterYWeekends();
                programarAjusteTarjetasAngostas();
            }
        });

        el.btnDensity?.addEventListener('click', () => {
            const idx = DENSITY_ORDER.indexOf(state.density);
            state.density = DENSITY_ORDER[(idx + 1) % DENSITY_ORDER.length];
            try { localStorage.setItem('sh_cal_density', state.density); } catch (e) {}
            if (state.calendar) {
                state.calendar.setOption('slotMinHeight', getSlotMinHeight());
                actualizarBarraFooterYWeekends();
                programarAjusteTarjetasAngostas();
            }
        });

        // Dropdown de filtros
        el.btnFilter?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = el.filterDropdown?.classList.toggle('open');
            el.btnFilter.classList.toggle('open', Boolean(isOpen));
        });
        el.filterDropdown?.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => {
            el.filterDropdown?.classList.remove('open');
            el.btnFilter?.classList.remove('open');
        });

        el.btnFilterAll?.addEventListener('click', () => {
            Object.keys(state.tiposFiltro).forEach(k => { state.tiposFiltro[k] = true; });
            el.filterDropdown?.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; });
            state.cursosFiltro.forEach(info => { info.checked = true; });
            onFiltersChanged();
        });

        el.btnFilterNone?.addEventListener('click', () => {
            state.cursosFiltro.forEach(info => { info.checked = false; });
            el.courseFilterList?.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
            onFiltersChanged();
        });

        wireTypeCheckboxes();

        // Modales
        el.btnAddSchedule?.addEventListener('click', () => abrirModalAdd(toIsoDateLocal(new Date()), '08:00', '09:00'));
        el.btnAddClose?.addEventListener('click', cerrarModalAdd);
        el.btnCancelAdd?.addEventListener('click', cerrarModalAdd);
        el.modalAddBackdrop?.addEventListener('click', (e) => {
            if (e.target === el.modalAddBackdrop) cerrarModalAdd();
        });
        el.formAddSchedule?.addEventListener('submit', guardarNuevoHorario);

        el.btnDetailClose?.addEventListener('click', cerrarModalDetalle);
        el.btnDetailOk?.addEventListener('click', cerrarModalDetalle);
        el.modalDetailBackdrop?.addEventListener('click', (e) => {
            if (e.target === el.modalDetailBackdrop) cerrarModalDetalle();
        });
        el.btnDeleteEvent?.addEventListener('click', eliminarEventoActual);

        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cerrarModalDetalle();
                cerrarModalAdd();
                el.filterDropdown?.classList.remove('open');
                el.btnFilter?.classList.remove('open');
                return;
            }
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (el.modalDetailBackdrop?.classList.contains('open') || el.modalAddBackdrop?.classList.contains('open')) return;

            if (e.key === 'ArrowLeft') state.calendar?.prev();
            else if (e.key === 'ArrowRight') state.calendar?.next();
            else if (e.key === 'h' || e.key === 'H') state.calendar?.today();
        });
    }

    // ─── Arranque ──────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        cacheDom();
        wireUiControls();

        try {
            state.estudianteId = await resolverEstudianteId();
            if (!state.estudianteId) {
                throw new Error('No se encontró la sesión del estudiante.');
            }
            inicializarFullCalendar();
            await cargarDatosCalendario();
        } catch (err) {
            console.warn('[Calendario]', err);
            if (el.calLoading) {
                el.calLoading.style.display = 'flex';
                if (window.ShidellErrors?.renderCard) {
                    window.ShidellErrors.renderCard(el.calLoading, {
                        portal: 'ESTUDIANTE',
                        compact: true,
                        title: 'Tu calendario está tomando un respiro',
                        message: err?.message || 'No pudimos actualizar las fechas ahora.',
                        onRetry: () => cargarDatosCalendario()
                    });
                } else {
                    el.calLoading.innerHTML = `<p style="color:#dc2626;font-weight:700;">No pudimos cargar el calendario en este momento.</p>`;
                }
            }
        }
    });
})();
