import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFecha(iso) {
    if (!iso) return 'No registrado';
    const parts = String(iso).split('T')[0].split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
}

function formatRelativo(iso) {
    if (!iso) return 'Sin conexión reciente';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Sin conexión reciente';
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 2) return 'En línea ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `Hace ${diffHrs} h`;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function plural(count, singular, pluralForm) {
    return Number(count) === 1 ? singular : pluralForm;
}

function normalizeCourseColor(colorName) {
    const allowed = new Set(['purple', 'blue', 'green', 'orange', 'red', 'yellow', 'cyan']);
    const normalized = String(colorName || 'blue').toLowerCase();
    return allowed.has(normalized) ? normalized : 'blue';
}

function estadoTextoLegible(estado) {
    const map = {
        ATRASADA: 'Vencida',
        PENDIENTE: 'Pendiente',
        ENTREGADA: 'Entregada',
        CALIFICADA: 'Calificada',
        PRESENTE: 'Presente',
        TARDE: 'Tardanza',
        AUSENTE: 'Falta',
        JUSTIFICADO: 'Justificada'
    };
    return map[String(estado || '').toUpperCase()] || (estado || '—');
}

export const EstudiantePerfilView = {
    perfil: null,
    activeTab: 'resumen',
    onlyMyCourses: false,
    taskFilter: 'ALL',
    navContext: { from: 'estudiantes', curso: null },

    async render() {
        return `
            <div id="ep-root" class="ep-page">
                <div class="loading-container">
                    <i class="ph ph-spinner ph-spin loading-spinner"></i>
                    <p>Cargando expediente del estudiante...</p>
                </div>
            </div>
        `;
    },

    async afterRender(queryString) {
        const params = new URLSearchParams(queryString || '');
        const estudianteId = params.get('id');
        this.navContext = {
            from: params.get('from') || 'estudiantes',
            curso: params.get('curso') || null
        };
        this.activeTab = 'resumen';
        this.onlyMyCourses = false;
        this.taskFilter = 'ALL';

        const root = document.getElementById('ep-root');
        if (!estudianteId) {
            root.innerHTML = this.renderEmptyError('No se indicó el estudiante a consultar.');
            return;
        }

        try {
            const user = Auth.getUser();
            const docenteId = user?.id || (await CursoService.getDocenteId(user.email));
            this.perfil = await API.fetch(
                `/api/docente/estudiante/${encodeURIComponent(estudianteId)}/perfil?docenteId=${encodeURIComponent(docenteId)}`
            );
            this.renderPage();
        } catch (error) {
            console.error(error);
            root.innerHTML = this.renderEmptyError('No se pudo cargar el expediente del estudiante seleccionado.');
        }
    },

    renderEmptyError(mensaje) {
        return `
            <div class="ep-util-bar">
                <a href="#/estudiantes" class="ep-back-link">
                    <i class="ph ph-arrow-left"></i> Volver a Estudiantes
                </a>
            </div>
            <div class="ep-dispatch is-danger">
                <div class="ep-dispatch-kicker">No disponible</div>
                <p class="ep-dispatch-lead">${esc(mensaje)}</p>
                <div class="ep-dispatch-actions">
                    <a href="#/estudiantes" class="ep-inline-jump">Ir al directorio de estudiantes →</a>
                </div>
            </div>
        `;
    },

    getBackConfig() {
        if (this.navContext.from === 'mis-clases') {
            const qs = this.navContext.curso ? `?curso=${encodeURIComponent(this.navContext.curso)}` : '';
            return { href: `#/mis-clases${qs}`, label: 'Mis Clases', section: 'Mis Clases' };
        }
        if (this.navContext.from === 'calificaciones') {
            return { href: '#/calificaciones', label: 'Calificaciones', section: 'Calificaciones' };
        }
        return { href: '#/estudiantes', label: 'Estudiantes', section: 'Estudiantes' };
    },

    navigateToStudent(id) {
        const params = new URLSearchParams();
        params.set('id', id);
        if (this.navContext.from) params.set('from', this.navContext.from);
        if (this.navContext.curso) params.set('curso', this.navContext.curso);
        window.location.hash = `#/estudiante-perfil?${params.toString()}`;
    },

    buildPriorityDispatch(p) {
        const r = p.resumenAcademico || {};
        const tareas = Array.isArray(p.tareasYEntregas) ? p.tareasYEntregas : [];
        const est = p.estudiante || {};
        const aulaCorta = est.grado && est.seccion ? `${est.grado}° ${est.seccion}` : '';
        const misCursos = (p.cursos || []).filter(c => c.esMiCurso);
        const cursoNombre = misCursos.length === 1
            ? (aulaCorta ? `${misCursos[0].nombre} (${aulaCorta})` : misCursos[0].nombre)
            : 'tus cursos';
        const atrasadas = Number(r.tareasAtrasadas || 0);
        const misAtrasadas = tareas.filter(t => t.esMiCurso && t.estadoEntrega === 'ATRASADA');
        const pendientes = Number(r.tareasPendientes || 0);
        const asistPct = Number(r.asistenciaPorcentaje ?? 100);
        const cursosAlerta = Number(r.cursosConAlerta || 0);
        const apoderado = p.apoderado;
        const apoderadoNombre = apoderado ? `${apoderado.nombres || ''} ${apoderado.apellidos || ''}`.trim() : '';

        if (atrasadas > 0 || cursosAlerta > 0 || asistPct < 80) {
            const partes = [];
            if (atrasadas > 0) {
                const detalleMia = misAtrasadas.length > 0
                    ? ` (incluyendo <em>${esc(misAtrasadas[0].titulo)}</em> en ${esc(cursoNombre)})`
                    : '';
                partes.push(`acumula <strong>${atrasadas} ${atrasadas === 1 ? 'entrega vencida' : 'entregas vencidas'}</strong>${detalleMia}`);
            }
            if (cursosAlerta > 0) {
                partes.push(`presenta <strong>${cursosAlerta} ${cursosAlerta === 1 ? 'área' : 'áreas'} bajo nota mínima</strong>`);
            }
            if (asistPct < 80) {
                partes.push(`asistencia en riesgo (<strong>${asistPct}%</strong>)`);
            } else if (asistPct >= 95) {
                partes.push(`aunque mantiene <strong>${asistPct}% de asistencia</strong>`);
            }

            const texto = partes.length
                ? `Requiere seguimiento: ${partes.join(', ')}.`
                : 'Requiere seguimiento cercano durante el periodo actual.';

            return {
                tone: 'is-danger',
                kicker: `Prioridad docente · ${r.estadoEtiqueta || 'Requiere apoyo'}`,
                html: texto,
                showTasksJump: atrasadas > 0,
                apoderado
            };
        }

        if (pendientes > 0 || (r.tieneEvaluacionesMias && Number(r.promedioEnMisCursos) < 13)) {
            const partes = [];
            if (pendientes > 0) {
                partes.push(`tiene <strong>${pendientes} ${pendientes === 1 ? 'actividad pendiente' : 'actividades pendientes'}</strong> en plazo`);
            }
            if (r.tieneEvaluacionesMias && Number(r.promedioEnMisCursos) < 13) {
                partes.push(`promedio ajustado en ${esc(cursoNombre)} (<strong>${Number(r.promedioEnMisCursos).toFixed(1)}/20</strong>)`);
            }
            return {
                tone: 'is-warn',
                kicker: 'Seguimiento en curso',
                html: `Desempeño estable: ${partes.join(' y ')} con <strong>${asistPct}% de asistencia</strong>.`,
                showTasksJump: pendientes > 0,
                apoderado
            };
        }

        const fmtScore = (val) => window.ShidellGrades ? window.ShidellGrades.format(val) : `${Number(val).toFixed(1)}/20`;
        const evalPhrase = r.tieneEvaluacionesMias
            ? `mantiene <strong>${window.ShidellGrades?.isLiteral() ? fmtScore(r.promedioEnMisCursos) : `${Number(r.promedioEnMisCursos).toFixed(1)}/20`}</strong> en ${esc(cursoNombre)}`
            : (r.tieneEvaluaciones
                ? `mantiene promedio general de <strong>${window.ShidellGrades?.isLiteral() ? fmtScore(r.promedioGeneral) : `${Number(r.promedioGeneral).toFixed(1)}/20`}</strong>`
                : 'aún no registra evaluaciones calificadas en este bloque');

        return {
            tone: r.tieneEvaluaciones ? 'is-ok' : 'is-info',
            kicker: r.estadoEtiqueta || 'Situación al día',
            html: `Sin incidencias urgentes: ${evalPhrase}, con <strong>${asistPct}% de asistencia</strong>${apoderadoNombre ? ` y contacto familiar activo (${esc(apoderadoNombre)})` : ''}.`,
            showTasksJump: false,
            apoderado
        };
    },

    renderPage() {
        const root = document.getElementById('ep-root');
        const p = this.perfil;
        const est = p.estudiante || {};
        const r = p.resumenAcademico || {};
        const back = this.getBackConfig();
        const companeros = Array.isArray(p.companerosAula) ? p.companerosAula : [];
        const currentIdx = companeros.findIndex(c => String(c.id) === String(est.id));
        const prevStudent = currentIdx > 0 ? companeros[currentIdx - 1] : null;
        const nextStudent = currentIdx >= 0 && currentIdx < companeros.length - 1 ? companeros[currentIdx + 1] : null;

        const nombreCompleto = `${est.nombres || ''} ${est.apellidos || ''}`.trim() || 'Estudiante';
        const iniciales = `${(est.nombres || 'E').charAt(0)}${(est.apellidos || '').charAt(0)}`.toUpperCase();
        const aulaTexto = est.nivel
            ? `${est.grado || ''}° ${est.seccion || ''} · ${est.nivel}${est.turno ? ` · ${est.turno}` : ''}`.trim()
            : 'Aula sin asignar';

        const cursos = Array.isArray(p.cursos) ? p.cursos : [];
        const misCursos = cursos.filter(c => c.esMiCurso);
        const miCursoPrincipal = misCursos[0] || null;
        const tareas = Array.isArray(p.tareasYEntregas) ? p.tareasYEntregas : [];
        const misAtrasadasCount = tareas.filter(t => t.esMiCurso && t.estadoEntrega === 'ATRASADA').length;
        const misPendientesCount = tareas.filter(t => t.esMiCurso && t.estadoEntrega === 'PENDIENTE').length;

        const literalMode = Boolean(window.ShidellGrades?.isLiteral());
        const promDisplay = r.tieneEvaluaciones
            ? (literalMode ? window.ShidellGrades.toLiteral(r.promedioGeneral || 0) : Number(r.promedioGeneral || 0).toFixed(1))
            : '—';
        const asistPct = Number(r.asistenciaPorcentaje ?? 100);
        const asistTone = asistPct >= 90 ? 'ep-sig-ok' : (asistPct >= 80 ? 'ep-sig-warn' : 'ep-sig-danger');
        const promTone = !r.tieneEvaluaciones ? '' : (Number(r.promedioGeneral) >= 14 ? 'ep-sig-ok' : (Number(r.promedioGeneral) >= 11 ? '' : 'ep-sig-danger'));

        // Bloque 1 del Scoreboard: priorizar la asignatura del profesor actual
        const aulaBadgeEst = est.grado && est.seccion ? `${est.grado}° ${est.seccion}` : '';
        const col1Label = miCursoPrincipal
            ? (misCursos.length > 1
                ? `En tus ${misCursos.length} cursos`
                : `Tu curso · ${miCursoPrincipal.nombre}${aulaBadgeEst ? ` (${aulaBadgeEst})` : ''}`)
            : 'Áreas curriculares';
        let col1Figure = '—';
        let col1Unit = '';
        let col1IsEmpty = false;
        let col1Note = '';

        if (r.tieneEvaluacionesMias) {
            const mia = Number(r.promedioEnMisCursos || 0);
            col1Figure = literalMode ? window.ShidellGrades.toLiteral(mia) : mia.toFixed(1);
            col1Unit = literalMode ? 'CNEB' : '/ 20';
            col1Note = miCursoPrincipal
                ? `${miCursoPrincipal.evaluacionesCount || 0} ${plural(miCursoPrincipal.evaluacionesCount || 0, 'evaluación', 'evaluaciones')} · Avance ${miCursoPrincipal.porcentajeAvance || 0}%`
                : 'Promedio en tus asignaturas';
        } else if (misAtrasadasCount > 0 || misPendientesCount > 0) {
            const totalPend = misAtrasadasCount + misPendientesCount;
            col1Figure = String(totalPend);
            col1Unit = misAtrasadasCount > 0
                ? plural(totalPend, 'vencida', 'vencidas')
                : plural(totalPend, 'pendiente', 'pendientes');
            col1Note = misCursos.length ? 'Sin notas todavía · Revisar entrega' : 'Tareas pendientes contigo';
        } else if (miCursoPrincipal) {
            col1Figure = 'Sin notas';
            col1IsEmpty = true;
            col1Note = `${miCursoPrincipal.entregasCount || 0}/${miCursoPrincipal.tareasCount || 0} entregas contigo`;
        } else {
            col1Figure = String(r.cursosTotales || cursos.length || 0);
            col1Unit = 'áreas';
            col1Note = `${r.cursosAprobados || 0} aprobadas`;
        }

        const col1Tone = r.tieneEvaluacionesMias
            ? (Number(r.promedioEnMisCursos) >= 11 ? '' : 'ep-sig-danger')
            : (misAtrasadasCount > 0 ? 'ep-sig-danger' : '');

        const dispatch = this.buildPriorityDispatch(p);

        root.innerHTML = `
            <div class="ep-util-bar">
                <div class="ep-util-left">
                    <a href="${esc(back.href)}" class="ep-back-link">
                        <i class="ph ph-arrow-left"></i> ${esc(back.label)}
                    </a>
                    <span class="ep-util-sep">/</span>
                    <span class="ep-util-context">${esc(aulaTexto)}</span>
                </div>

                <div class="ep-util-right">
                    ${companeros.length > 1 ? `
                        <div class="ep-switcher" title="Cambiar estudiante del aula">
                            <button type="button" class="ep-switch-arrow" id="ep-prev-btn" ${!prevStudent ? 'disabled' : ''} aria-label="Estudiante anterior">
                                <i class="ph ph-caret-left"></i>
                            </button>
                            <select id="ep-student-select" class="ep-switcher-select" aria-label="Seleccionar estudiante">
                                ${companeros.map(c => `
                                    <option value="${esc(c.id)}" ${String(c.id) === String(est.id) ? 'selected' : ''}>
                                        ${esc(c.apellidos || '')}, ${esc(c.nombres || '')}
                                    </option>
                                `).join('')}
                            </select>
                            <button type="button" class="ep-switch-arrow" id="ep-next-btn" ${!nextStudent ? 'disabled' : ''} aria-label="Siguiente estudiante">
                                <i class="ph ph-caret-right"></i>
                            </button>
                        </div>
                    ` : ''}
                    <button type="button" class="ep-text-action" id="ep-print-btn">
                        <i class="ph ph-printer"></i> Imprimir ficha
                    </button>
                </div>
            </div>

            <header class="ep-header">
                <div class="ep-identity-block">
                    <div class="ep-monogram" id="ep-avatar-box">
                        ${est.fotoPerfil
                            ? `<img src="${esc(est.fotoPerfil)}" alt="${esc(nombreCompleto)}" id="ep-avatar-img">`
                            : esc(iniciales)}
                    </div>

                    <div class="ep-identity-copy">
                        <div class="ep-kicker-row">
                            <span class="ep-kicker">Expediente estudiantil${est.dni ? ` · DNI ${esc(est.dni)}` : ''}${p.edad != null ? ` · ${esc(p.edad)} años` : ''}</span>
                            <span class="ep-status-inline ${esc(r.estadoGeneral || 'SIN_EVALUACIONES')}">
                                <span class="ep-status-dot"></span>
                                ${esc(r.estadoEtiqueta || 'Seguimiento activo')}
                            </span>
                        </div>

                        <h1 class="ep-name">${esc(nombreCompleto)}</h1>

                        <div class="ep-byline">
                            <span>${esc(est.email || 'Sin correo institucional')}</span>
                            <span class="ep-byline-sep">·</span>
                            <span>Último acceso: ${esc(formatRelativo(est.ultimaConexion))}</span>
                        </div>
                        ${p.apoderado ? `
                            <div class="ep-byline" style="margin-top:4px;">
                                <span>Apoderado: <strong>${esc(p.apoderado.nombres || '')} ${esc(p.apoderado.apellidos || '')}</strong>${p.apoderado.telefono ? ` · Tel. ${esc(p.apoderado.telefono)}` : ''}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="ep-header-actions">
                    <a href="#/mensajes?contacto=${encodeURIComponent(est.id)}" class="ep-btn-solid">
                        <i class="ph ph-chat-circle-dots"></i> Mensaje al estudiante
                    </a>
                    ${p.apoderado ? `
                        <a href="#/mensajes?contacto=${encodeURIComponent(p.apoderado.id)}" class="ep-btn-underline">
                            Contactar apoderado →
                        </a>
                    ` : ''}
                </div>
            </header>

            <section class="ep-metrics-strip" aria-label="Indicadores principales">
                <div class="ep-metric-col">
                    <span class="ep-metric-label">${esc(col1Label)}</span>
                    <div class="ep-metric-figure ${col1IsEmpty ? 'is-empty' : ''} ${col1Tone}">
                        <span>${esc(col1Figure)}</span>
                        ${col1Unit ? `<span class="ep-metric-unit">${esc(col1Unit)}</span>` : ''}
                    </div>
                    <div class="ep-metric-note">${esc(col1Note)}</div>
                </div>

                <div class="ep-metric-col">
                    <span class="ep-metric-label">Promedio general</span>
                    <div class="ep-metric-figure ${!r.tieneEvaluaciones ? 'is-empty' : ''} ${promTone}">
                        <span>${esc(promDisplay)}</span>
                        ${r.tieneEvaluaciones ? `<span class="ep-metric-unit">/ 20</span>` : `<span class="ep-metric-unit">sin notas</span>`}
                    </div>
                    <div class="ep-metric-note">
                        ${r.tieneEvaluaciones
                            ? `${esc(r.cursosAprobados || 0)} de ${esc(r.cursosTotales || 0)} áreas aprobadas`
                            : `${esc(r.cursosTotales || 0)} áreas inscritas en el aula`}
                    </div>
                </div>

                <div class="ep-metric-col">
                    <span class="ep-metric-label">Asistencia del ciclo</span>
                    <div class="ep-metric-figure ${asistTone}">
                        <span>${esc(asistPct)}%</span>
                        <span class="ep-metric-unit">${esc(r.rachaDias || 0)}d racha</span>
                    </div>
                    <div class="ep-metric-note">${esc(r.presentes || 0)} presentes · ${esc(r.tardanzas || 0)} tardanzas · ${esc(r.ausentes || 0)} faltas</div>
                </div>

                <div class="ep-metric-col">
                    <span class="ep-metric-label">Entregas globales</span>
                    <div class="ep-metric-figure ${r.tareasAtrasadas > 0 ? 'ep-sig-danger' : ''}">
                        <span>${esc(r.tareasCompletadas || 0)}</span>
                        <span class="ep-metric-unit">/ ${esc(r.tareasTotales || 0)}</span>
                    </div>
                    <div class="ep-metric-note">
                        ${r.tareasAtrasadas > 0
                            ? `<strong class="ep-sig-danger">${esc(r.tareasAtrasadas)} ${plural(r.tareasAtrasadas, 'vencida sin enviar', 'vencidas sin enviar')}</strong>`
                            : `${esc(r.tareasPendientes || 0)} ${plural(r.tareasPendientes || 0, 'pendiente en plazo', 'pendientes en plazo')}`}
                    </div>
                </div>
            </section>

            <aside class="ep-dispatch ${dispatch.tone}">
                <div class="ep-dispatch-kicker">${esc(dispatch.kicker)}</div>
                <p class="ep-dispatch-lead">${dispatch.html}</p>
                ${(dispatch.showTasksJump || dispatch.apoderado) ? `
                    <div class="ep-dispatch-actions">
                        ${dispatch.showTasksJump ? `<button type="button" class="ep-inline-jump" id="ep-jump-pending">Revisar entregas pendientes →</button>` : ''}
                        ${dispatch.apoderado ? `<a href="#/mensajes?contacto=${encodeURIComponent(dispatch.apoderado.id)}" class="ep-inline-jump">Escribir a ${esc(dispatch.apoderado.nombres || 'apoderado')} →</a>` : ''}
                    </div>
                ` : ''}
            </aside>

            <nav class="ep-tabs-line" role="tablist">
                <button type="button" class="ep-tab-link ${this.activeTab === 'resumen' ? 'active' : ''}" data-tab="resumen">
                    Lo esencial
                </button>
                <button type="button" class="ep-tab-link ${this.activeTab === 'calificaciones' ? 'active' : ''}" data-tab="calificaciones">
                    Calificaciones <span class="ep-tab-num">${(p.evaluaciones || []).length}</span>
                </button>
                <button type="button" class="ep-tab-link ${this.activeTab === 'tareas' ? 'active' : ''}" data-tab="tareas">
                    Entregas <span class="ep-tab-num ${r.tareasAtrasadas > 0 ? 'is-alert' : ''}">${tareas.length}</span>
                </button>
                <button type="button" class="ep-tab-link ${this.activeTab === 'asistencia' ? 'active' : ''}" data-tab="asistencia">
                    Asistencia <span class="ep-tab-num">${esc(asistPct)}%</span>
                </button>
            </nav>

            <section id="ep-tab-body"></section>
        `;

        const img = document.getElementById('ep-avatar-img');
        if (img) {
            img.addEventListener('error', () => {
                const box = document.getElementById('ep-avatar-box');
                if (box) box.textContent = iniciales;
            });
        }

        document.getElementById('ep-prev-btn')?.addEventListener('click', () => {
            if (prevStudent) this.navigateToStudent(prevStudent.id);
        });
        document.getElementById('ep-next-btn')?.addEventListener('click', () => {
            if (nextStudent) this.navigateToStudent(nextStudent.id);
        });
        document.getElementById('ep-student-select')?.addEventListener('change', (e) => {
            if (e.target.value) this.navigateToStudent(e.target.value);
        });
        document.getElementById('ep-print-btn')?.addEventListener('click', () => window.print());

        document.getElementById('ep-jump-pending')?.addEventListener('click', () => {
            this.activeTab = 'tareas';
            this.taskFilter = 'PENDING';
            root.querySelectorAll('.ep-tab-link').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tareas'));
            this.renderTabBody();
        });

        root.querySelectorAll('.ep-tab-link').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTab = btn.dataset.tab;
                root.querySelectorAll('.ep-tab-link').forEach(b => b.classList.toggle('active', b === btn));
                this.renderTabBody();
            });
        });

        this.renderTabBody();
    },

    renderTabBody() {
        const container = document.getElementById('ep-tab-body');
        if (!container) return;

        if (this.activeTab === 'calificaciones') {
            this.renderCalificacionesTab(container);
        } else if (this.activeTab === 'tareas') {
            this.renderTareasTab(container);
        } else if (this.activeTab === 'asistencia') {
            this.renderAsistenciaTab(container);
        } else {
            this.renderResumenTab(container);
        }
    },

    renderResumenTab(container) {
        const p = this.perfil;
        const est = p.estudiante || {};
        const cursos = Array.isArray(p.cursos) ? p.cursos : [];
        const misCursos = cursos.filter(c => c.esMiCurso);
        const otrosCursos = cursos.filter(c => !c.esMiCurso);
        const apoderado = p.apoderado;
        const tutor = p.tutorAula;

        const tareas = Array.isArray(p.tareasYEntregas) ? p.tareasYEntregas : [];
        const tareasPrioritarias = tareas
            .filter(t => t.estadoEntrega === 'ATRASADA' || t.estadoEntrega === 'PENDIENTE' || (t.esMiCurso && t.estadoEntrega === 'ENTREGADA'))
            .sort((a, b) => Number(Boolean(b.esMiCurso)) - Number(Boolean(a.esMiCurso)));

        const renderCourseLedgerRow = (c) => {
            const colorSlug = normalizeCourseColor(c.color);
            const tieneNotas = Number(c.evaluacionesCount || 0) > 0;
            const numProm = Number(c.promedio || 0);
            const gradeClass = !tieneNotas ? 'is-muted' : (numProm >= 11 ? 'is-ok' : 'is-risk');
            const gradeText = !tieneNotas ? 'Sin notas' : `${numProm.toFixed(1)}`;
            return `
                <div class="ep-ledger-row ${c.esMiCurso ? 'is-mine' : ''}">
                    <div class="ep-ledger-left">
                        <span class="ep-course-dot color-${colorSlug}"></span>
                        <div class="ep-ledger-titles">
                            <div class="ep-ledger-title-line">
                                <span class="ep-ledger-name">${esc(c.nombre)}</span>
                                ${c.esMiCurso ? '<span class="ep-mine-mark">Tu curso</span>' : ''}
                            </div>
                            <div class="ep-ledger-sub">${esc(c.docenteNombre)} · ${esc(c.entregasCount || 0)}/${esc(c.tareasCount || 0)} entregas</div>
                        </div>
                    </div>

                    <div class="ep-ledger-right">
                        <div class="ep-thin-track-wrap">
                            <div class="ep-thin-track-meta">
                                <span>Avance</span>
                                <span>${esc(c.porcentajeAvance || 0)}%</span>
                            </div>
                            <div class="ep-thin-track">
                                <div class="ep-thin-fill color-${colorSlug}" style="width:${c.porcentajeAvance || 0}%;"></div>
                            </div>
                        </div>
                        <span class="ep-score-num ${gradeClass}" title="${esc(c.evaluacionesCount || 0)} evaluación(es)">
                            ${esc(gradeText)}
                        </span>
                    </div>
                </div>
            `;
        };

        container.innerHTML = `
            <div class="ep-split">
                <div class="ep-main-col">
                    ${tareasPrioritarias.length > 0 ? `
                        <div>
                            <div class="ep-sec-head">
                                <div class="ep-sec-title-wrap">
                                    <h2 class="ep-sec-title">Pendientes y entregas por atender</h2>
                                    <span class="ep-sec-kicker">${tareasPrioritarias.length} ${plural(tareasPrioritarias.length, 'actividad', 'actividades')}</span>
                                </div>
                                <button type="button" class="ep-inline-jump" id="ep-go-all-tasks">Ver historial completo →</button>
                            </div>
                            <div class="ep-ledger-list">
                                ${tareasPrioritarias.slice(0, 6).map(t => `
                                    <div class="ep-ledger-row ${t.esMiCurso ? 'is-mine' : ''}">
                                        <div class="ep-ledger-left">
                                            <div class="ep-ledger-titles">
                                                <div class="ep-ledger-title-line">
                                                    <span class="ep-ledger-name">${esc(t.titulo)}</span>
                                                    ${t.esMiCurso ? '<span class="ep-mine-mark">Tu curso</span>' : ''}
                                                </div>
                                                <div class="ep-ledger-sub">
                                                    ${esc(t.cursoNombre)}${t.prioridad ? ` · Prioridad ${esc(t.prioridad)}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="ep-ledger-right">
                                            <span class="ep-mono-date">${esc(formatFecha(t.fechaVencimiento))}</span>
                                            <span class="ep-dot-state ${esc(t.estadoEntrega)}">${esc(estadoTextoLegible(t.estadoEntrega))}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div>
                        <div class="ep-sec-head">
                            <div class="ep-sec-title-wrap">
                                <h2 class="ep-sec-title">Desempeño por área curricular</h2>
                                <span class="ep-sec-kicker">${cursos.length} asignaturas</span>
                            </div>
                        </div>

                        ${cursos.length === 0 ? `
                            <p class="ep-empty-inline">Este estudiante aún no tiene cursos asignados en su aula.</p>
                        ` : `
                            <div class="ep-ledger-list">
                                ${misCursos.length > 0 && otrosCursos.length > 0 ? '<div class="ep-group-tag">Tus cursos asignados</div>' : ''}
                                ${misCursos.map(renderCourseLedgerRow).join('')}
                                ${misCursos.length > 0 && otrosCursos.length > 0 ? '<div class="ep-group-tag">Otras áreas del aula</div>' : ''}
                                ${otrosCursos.map(renderCourseLedgerRow).join('')}
                            </div>
                        `}
                    </div>
                </div>

                <aside class="ep-rail-col">
                    <div>
                        <div class="ep-sec-head">
                            <div class="ep-sec-title-wrap">
                                <h2 class="ep-sec-title">Contacto y tutoría</h2>
                            </div>
                        </div>

                        ${apoderado ? `
                            <div class="ep-contact-entry">
                                <div class="ep-contact-role">Apoderado principal</div>
                                <div class="ep-contact-name">${esc(apoderado.nombres || '')} ${esc(apoderado.apellidos || '')}</div>
                                <div class="ep-contact-meta">
                                    ${apoderado.telefono ? `<span>Tel. ${esc(apoderado.telefono)}</span>` : ''}
                                    <span>${esc(apoderado.email || 'Sin correo registrado')}</span>
                                </div>
                                <a href="#/mensajes?contacto=${encodeURIComponent(apoderado.id)}" class="ep-inline-jump">
                                    Enviar mensaje directo →
                                </a>
                            </div>
                        ` : '<p class="ep-empty-inline" style="padding:12px 0;">Sin apoderado vinculado.</p>'}

                        ${tutor ? `
                            <div class="ep-contact-entry">
                                <div class="ep-contact-role">Tutor(a) de aula</div>
                                <div class="ep-contact-name">${esc(tutor.nombres || '')} ${esc(tutor.apellidos || '')}</div>
                                <div class="ep-contact-meta">
                                    <span>${esc(tutor.email || '—')}</span>
                                    ${tutor.codigoPlaza ? `<span>Plaza ${esc(tutor.codigoPlaza)}</span>` : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <div>
                        <div class="ep-sec-head">
                            <div class="ep-sec-title-wrap">
                                <h2 class="ep-sec-title">Datos de registro</h2>
                            </div>
                        </div>
                        <dl class="ep-dl">
                            <div class="ep-dl-row">
                                <dt>DNI</dt>
                                <dd>${esc(est.dni || 'No registrado')}</dd>
                            </div>
                            <div class="ep-dl-row">
                                <dt>Teléfono</dt>
                                <dd>${esc(est.telefono || 'No registrado')}</dd>
                            </div>
                            <div class="ep-dl-row">
                                <dt>Nacimiento</dt>
                                <dd>${esc(formatFecha(est.fechaNacimiento))}${p.edad != null ? ` (${p.edad} años)` : ''}</dd>
                            </div>
                            <div class="ep-dl-row">
                                <dt>Sexo / Sangre</dt>
                                <dd>${esc(est.sexo || '—')}${est.tipoSangre ? ` · ${esc(est.tipoSangre)}` : ''}</dd>
                            </div>
                            <div class="ep-dl-row">
                                <dt>Dirección</dt>
                                <dd>${esc(est.direccion || 'No registrada')}</dd>
                            </div>
                            <div class="ep-dl-row">
                                <dt>Correo</dt>
                                <dd>${esc(est.email || '—')}</dd>
                            </div>
                        </dl>
                    </div>
                </aside>
            </div>
        `;

        document.getElementById('ep-go-all-tasks')?.addEventListener('click', () => {
            this.activeTab = 'tareas';
            this.taskFilter = 'ALL';
            document.querySelectorAll('.ep-tab-link').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tareas'));
            this.renderTabBody();
        });
    },

    renderCalificacionesTab(container) {
        const todas = this.perfil.evaluaciones || [];
        const filtradas = this.onlyMyCourses ? todas.filter(e => e.esMiCurso) : todas;

        container.innerHTML = `
            <div class="ep-subtoolbar">
                <div class="ep-sec-title-wrap">
                    <h2 class="ep-sec-title">Historial de calificaciones</h2>
                    <span class="ep-sec-kicker">${filtradas.length} registro(s)</span>
                </div>
                <div class="ep-subfilter-links">
                    <button type="button" class="ep-filter-btn ${!this.onlyMyCourses ? 'active' : ''}" data-scope="all">
                        Todos los cursos (${todas.length})
                    </button>
                    <button type="button" class="ep-filter-btn ${this.onlyMyCourses ? 'active' : ''}" data-scope="mine">
                        Solo mis cursos (${todas.filter(e => e.esMiCurso).length})
                    </button>
                </div>
            </div>

            ${filtradas.length === 0 ? `
                <p class="ep-empty-inline">No hay calificaciones registradas con este criterio.</p>
            ` : `
                <div class="ep-ledger-wrap">
                    <table class="ep-ledger-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Área</th>
                                <th>Actividad</th>
                                <th>${window.ShidellGrades?.isLiteral() ? 'Nota (CNEB)' : 'Nota (0–20)'}</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtradas.map(ev => {
                                const isLit = Boolean(window.ShidellGrades?.isLiteral());
                                const scoreText = isLit ? window.ShidellGrades.toLiteral(ev.nota20) : esc(ev.nota20);
                                const rawSub = (!isLit || (ev.notaMaxima && Number(ev.notaMaxima) !== 20))
                                    ? `<span class="ep-mono-date" style="margin-left:6px;">(${esc(ev.nota)}/${esc(ev.notaMaxima)})</span>`
                                    : '';
                                return `
                                <tr>
                                    <td class="ep-mono-date">${esc(formatFecha(ev.fecha))}</td>
                                    <td>
                                        <strong>${esc(ev.cursoNombre)}</strong>
                                        ${ev.esMiCurso ? ' <span class="ep-mine-mark">· Tu curso</span>' : ''}
                                    </td>
                                    <td>${esc(ev.actividad || 'Evaluación')}</td>
                                    <td>
                                        <span class="ep-score-num ${Number(ev.nota20) >= 11 ? 'is-ok' : 'is-risk'}" style="font-size:17px;">${scoreText}</span>
                                        ${rawSub}
                                    </td>
                                    <td><span class="ep-dot-state ${esc(ev.estado)}">${esc(ev.estado)}</span></td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        container.querySelectorAll('.ep-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.onlyMyCourses = btn.dataset.scope === 'mine';
                this.renderCalificacionesTab(container);
            });
        });
    },

    renderTareasTab(container) {
        const todas = this.perfil.tareasYEntregas || [];
        const filtradas = todas.filter(t => {
            if (this.taskFilter === 'PENDING') return t.estadoEntrega === 'PENDIENTE' || t.estadoEntrega === 'ATRASADA';
            if (this.taskFilter === 'DONE') return t.estadoEntrega === 'ENTREGADA' || t.estadoEntrega === 'CALIFICADA';
            return true;
        });

        container.innerHTML = `
            <div class="ep-subtoolbar">
                <div class="ep-sec-title-wrap">
                    <h2 class="ep-sec-title">Tareas y entregas</h2>
                    <span class="ep-sec-kicker">${filtradas.length} de ${todas.length}</span>
                </div>
                <div class="ep-subfilter-links">
                    <button type="button" class="ep-filter-btn ${this.taskFilter === 'ALL' ? 'active' : ''}" data-tfilter="ALL">
                        Todas (${todas.length})
                    </button>
                    <button type="button" class="ep-filter-btn ${this.taskFilter === 'PENDING' ? 'active' : ''}" data-tfilter="PENDING">
                        Pendientes / Vencidas (${todas.filter(t => t.estadoEntrega === 'PENDIENTE' || t.estadoEntrega === 'ATRASADA').length})
                    </button>
                    <button type="button" class="ep-filter-btn ${this.taskFilter === 'DONE' ? 'active' : ''}" data-tfilter="DONE">
                        Entregadas (${todas.filter(t => t.estadoEntrega === 'ENTREGADA' || t.estadoEntrega === 'CALIFICADA').length})
                    </button>
                </div>
            </div>

            ${filtradas.length === 0 ? `
                <p class="ep-empty-inline">No hay actividades que coincidan con este filtro.</p>
            ` : `
                <div class="ep-ledger-wrap">
                    <table class="ep-ledger-table">
                        <thead>
                            <tr>
                                <th>Actividad</th>
                                <th>Área</th>
                                <th>Vencimiento</th>
                                <th>Estado</th>
                                <th>Nota / Archivo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtradas.map(t => `
                                <tr>
                                    <td>
                                        <strong>${esc(t.titulo)}</strong>
                                        ${t.comentarioDocente ? `<div class="ep-table-note">Obs.: ${esc(t.comentarioDocente)}</div>` : ''}
                                    </td>
                                    <td>
                                        ${esc(t.cursoNombre)}
                                        ${t.esMiCurso ? ' <span class="ep-mine-mark">· Tu curso</span>' : ''}
                                    </td>
                                    <td class="ep-mono-date">${esc(formatFecha(t.fechaVencimiento))}</td>
                                    <td><span class="ep-dot-state ${esc(t.estadoEntrega)}">${esc(estadoTextoLegible(t.estadoEntrega))}</span></td>
                                    <td>
                                        ${t.nota !== null && t.nota !== undefined
                                            ? `<span class="ep-score-num" style="font-size:16px;">${esc(t.nota)}/20</span>`
                                            : '<span class="ep-mono-date">—</span>'}
                                        ${t.archivoUrl ? ` <a href="${esc(t.archivoUrl)}" target="_blank" class="ep-inline-jump" style="margin-left:10px;">Ver archivo →</a>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        container.querySelectorAll('.ep-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.taskFilter = btn.dataset.tfilter;
                this.renderTareasTab(container);
            });
        });
    },

    renderAsistenciaTab(container) {
        const r = this.perfil.resumenAcademico || {};
        const recientes = this.perfil.asistenciasRecientes || [];

        container.innerHTML = `
            <div class="ep-subtoolbar">
                <div class="ep-sec-title-wrap">
                    <h2 class="ep-sec-title">Registro de asistencia</h2>
                </div>
                <div class="ep-asist-summary-strip">
                    <span class="ep-asist-stat"><strong class="ep-sig-ok">${esc(r.presentes || 0)}</strong> presentes</span>
                    <span class="ep-asist-stat"><strong class="ep-sig-warn">${esc(r.tardanzas || 0)}</strong> tardanzas</span>
                    <span class="ep-asist-stat"><strong class="ep-sig-danger">${esc(r.ausentes || 0)}</strong> faltas</span>
                    <span class="ep-asist-stat"><strong>${esc(r.justificados || 0)}</strong> justificadas</span>
                    <span class="ep-asist-stat"><strong>${esc(r.rachaDias || 0)}d</strong> racha</span>
                </div>
            </div>

            ${recientes.length === 0 ? `
                <p class="ep-empty-inline">No hay sesiones de asistencia registradas aún.</p>
            ` : `
                <div class="ep-ledger-wrap">
                    <table class="ep-ledger-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Área</th>
                                <th>Estado</th>
                                <th>Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recientes.map(a => `
                                <tr>
                                    <td class="ep-mono-date">${esc(formatFecha(a.fecha))}</td>
                                    <td>${esc(a.cursoNombre)}</td>
                                    <td><span class="ep-dot-state ${esc(a.estado)}">${esc(estadoTextoLegible(a.estado))}</span></td>
                                    <td>
                                        ${esc(a.descripcion || '—')}
                                        ${a.registradoManual ? ' <span class="ep-mine-mark">· Manual</span>' : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;
    }
};
