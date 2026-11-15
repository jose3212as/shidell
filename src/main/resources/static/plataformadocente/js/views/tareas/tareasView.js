import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DAYS_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function todayLocalIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseLocalDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}

function diffDaysFromToday(iso) {
    const dt = parseLocalDate(iso);
    const today = parseLocalDate(todayLocalIso());
    if (!dt || !today) return null;
    return Math.round((dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdueTask(t) {
    if (t.estado === 'Completada') return false;
    const diff = diffDaysFromToday(t.fechaVencimiento);
    return diff !== null && diff < 0;
}

function formatDueBlock(iso, estado) {
    const dt = parseLocalDate(iso);
    if (!dt) {
        return { day: '—', meta: 'SIN FECHA', tone: 'normal', rel: 'Sin plazo' };
    }
    const day = String(dt.getDate()).padStart(2, '0');
    const meta = `${MONTHS_SHORT[dt.getMonth()]} · ${DAYS_SHORT[dt.getDay()]}`;
    const diff = diffDaysFromToday(iso);

    if (estado === 'Completada') {
        return { day, meta, tone: 'done', rel: 'Finalizada' };
    }
    if (diff === null) return { day, meta, tone: 'normal', rel: '' };
    if (diff < 0) return { day, meta, tone: 'overdue', rel: `Vencida hace ${Math.abs(diff)}d` };
    if (diff === 0) return { day, meta, tone: 'today', rel: 'Vence hoy' };
    if (diff === 1) return { day, meta, tone: 'soon', rel: 'Vence mañana' };
    return { day, meta, tone: 'normal', rel: `En ${diff} días` };
}

function normalizeEntregaUrl(rawUrl) {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('/') || rawUrl.startsWith('http')) return rawUrl;
    return `/uploads/entregas/${rawUrl}`;
}

export const TareasView = {
    allTareas: [],
    uniqueCourses: [],
    phaseFilter: 'ALL',
    searchTerm: '',
    cursoFilter: 'ALL',
    _closeTimer: null,
    _keyHandler: null,
    _hashCleanup: null,

    async render() {
        return `
            <div class="tr-page" id="tr-root">
                <header class="tr-masthead">
                    <div>
                        <p class="tr-kicker">SEGUIMIENTO ACADÉMICO · DOCENTE</p>
                        <h2 class="tr-title">Tareas</h2>
                        <p class="tr-subtitle">Administra asignaciones activas, revisa entregas por sección y publica nuevas prácticas.</p>
                    </div>
                    <div class="tr-masthead-right">
                        <div class="tr-stats" id="tr-stats">
                            <div class="tr-stat-col">
                                <span class="tr-stat-num" id="tr-stat-pend">0</span>
                                <span class="tr-stat-lbl">PENDIENTES</span>
                            </div>
                            <div class="tr-stat-col">
                                <span class="tr-stat-num" id="tr-stat-prog">0</span>
                                <span class="tr-stat-lbl">EN PROGRESO</span>
                            </div>
                            <div class="tr-stat-col">
                                <span class="tr-stat-num" id="tr-stat-comp">0</span>
                                <span class="tr-stat-lbl">COMPLETADAS</span>
                            </div>
                        </div>
                        <a href="#/crear-tarea" class="tr-btn-create" id="btn-nueva-tarea">
                            <i class="ph ph-plus" aria-hidden="true"></i>
                            <span>Nueva tarea</span>
                        </a>
                    </div>
                </header>

                <div class="tr-toolbar">
                    <nav class="tr-tabs" id="tr-phase-tabs" aria-label="Filtrar por fase"></nav>
                    <div class="tr-filters">
                        <select id="filter-curso-tarea" class="tr-curso-select" aria-label="Filtrar por curso">
                            <option value="ALL">Todas las secciones</option>
                        </select>
                        <div class="tr-search-wrap">
                            <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
                            <input type="search" id="search-tareas" class="tr-bare-input" placeholder="Buscar tarea o descripción…" autocomplete="off">
                        </div>
                    </div>
                </div>

                <section class="tr-ledger" id="tareas-ledger" aria-live="polite">
                    <div class="tr-loading">
                        <span class="tr-loading-dot"></span>
                        <span>Cargando asignaciones…</span>
                    </div>
                </section>
            </div>

            <!-- Ventanilla de Detalle y Entregas -->
            <div class="tr-sheet-backdrop" id="tr-detail-sheet" aria-hidden="true">
                <div class="tr-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="tr-sheet-title">
                    <header class="tr-sheet-head">
                        <div class="tr-sheet-top">
                            <span class="tr-sheet-kicker" id="tr-sheet-kicker">DETALLE DE ASIGNACIÓN</span>
                            <div class="tr-sheet-actions">
                                <a href="#/crear-tarea" class="tr-sheet-link-btn" id="tr-sheet-edit-link">
                                    <i class="ph ph-pencil-simple"></i>
                                    <span>Editar en página</span>
                                </a>
                                <button type="button" class="tr-sheet-close" id="tr-sheet-close" aria-label="Cerrar ventana">
                                    <i class="ph ph-x"></i>
                                </button>
                            </div>
                        </div>
                        <h3 class="tr-sheet-title" id="tr-sheet-title">Tarea</h3>
                        <p class="tr-sheet-sub" id="tr-sheet-sub"></p>
                    </header>

                    <div class="tr-sheet-body">
                        <div class="tr-sheet-brief" id="tr-sheet-brief"></div>
                        <div class="tr-deliveries-head">
                            <h4>Entregas recibidas</h4>
                            <a href="#/calificaciones" class="tr-grade-jump" id="tr-sheet-grade-link">
                                <span>Ir a Calificaciones</span>
                                <i class="ph ph-arrow-up-right" aria-hidden="true"></i>
                            </a>
                        </div>
                        <div id="tr-deliveries-body" class="tr-deliveries-list"></div>
                    </div>
                </div>
            </div>
        `;
    },

    async afterRender(queryString) {
        this.user = Auth.getUser();
        if (!this.user) return;

        this.allTareas = [];
        this.uniqueCourses = [];
        this.phaseFilter = 'ALL';
        this.searchTerm = '';
        this.cursoFilter = 'ALL';
        document.body.classList.remove('tr-modal-open');

        const params = new URLSearchParams(queryString || '');
        const presetCurso = params.get('curso');

        this.setupEvents();
        await this.loadData(presetCurso);
    },

    async loadData(presetCurso) {
        const ledger = document.getElementById('tareas-ledger');
        if (ledger) {
            ledger.innerHTML = `<div class="tr-loading"><span class="tr-loading-dot"></span><span>Cargando asignaciones…</span></div>`;
        }

        try {
            this.uniqueCourses = await CursoService.getCursosUnicos(this.user.email);

            const selectFilter = document.getElementById('filter-curso-tarea');
            if (selectFilter) {
                selectFilter.innerHTML = '<option value="ALL">Todas las secciones</option>';
                this.uniqueCourses.forEach(curso => {
                    const opt = document.createElement('option');
                    opt.value = curso.id;
                    opt.textContent = `${curso.nombre} · ${curso.grado}° ${curso.seccion}`;
                    selectFilter.appendChild(opt);
                });
                if (presetCurso && this.uniqueCourses.some(c => String(c.id) === String(presetCurso))) {
                    selectFilter.value = String(presetCurso);
                    this.cursoFilter = String(presetCurso);
                }
            }

            const promesas = this.uniqueCourses.map(async (curso) => {
                const tareas = await API.fetch(`/api/docente/curso/${curso.id}/tareas`).catch(() => []);
                return (Array.isArray(tareas) ? tareas : []).map(t => ({
                    ...t,
                    curso: t.curso || curso,
                    cursoLabel: `${curso.nombre} · ${curso.grado}° ${curso.seccion}`
                }));
            });

            const resultados = await Promise.all(promesas);
            this.allTareas = resultados.flat().sort((a, b) => {
                const da = parseLocalDate(a.fechaVencimiento)?.getTime() || Number.MAX_SAFE_INTEGER;
                const db = parseLocalDate(b.fechaVencimiento)?.getTime() || Number.MAX_SAFE_INTEGER;
                return da - db;
            });

            this.syncCreateButtonHref();
            this.renderStats();
            this.renderTabs();
            this.renderLedger();
        } catch (err) {
            console.error('Error cargando Tareas:', err);
            if (ledger) {
                ledger.innerHTML = `<div class="tr-empty">No se pudieron cargar las tareas en este momento.</div>`;
            }
        }
    },

    setupEvents() {
        document.getElementById('search-tareas')?.addEventListener('input', (e) => {
            this.searchTerm = (e.target.value || '').trim().toLowerCase();
            this.renderLedger();
        });

        document.getElementById('filter-curso-tarea')?.addEventListener('change', (e) => {
            this.cursoFilter = e.target.value || 'ALL';
            this.syncCreateButtonHref();
            this.renderStats();
            this.renderTabs();
            this.renderLedger();
        });

        document.getElementById('tr-phase-tabs')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-phase]');
            if (!btn) return;
            this.phaseFilter = btn.getAttribute('data-phase') || 'ALL';
            this.renderTabs();
            this.renderLedger();
        });

        const ledger = document.getElementById('tareas-ledger');
        ledger?.addEventListener('change', async (e) => {
            const sel = e.target.closest('.tr-estado-select[data-tarea-id]');
            if (!sel) return;
            const id = sel.getAttribute('data-tarea-id');
            const estado = sel.value;
            await this.cambiarEstadoTarea(id, estado);
        });

        ledger?.addEventListener('click', async (e) => {
            const detailBtn = e.target.closest('[data-action="detail"][data-tarea-id]');
            if (detailBtn) {
                const id = detailBtn.getAttribute('data-tarea-id');
                await this.abrirDetalle(id);
                return;
            }

            const delBtn = e.target.closest('[data-action="delete"][data-tarea-id]');
            if (delBtn) {
                const id = delBtn.getAttribute('data-tarea-id');
                if (!delBtn.classList.contains('is-confirming')) {
                    delBtn.classList.add('is-confirming');
                    const lbl = delBtn.querySelector('span');
                    if (lbl) lbl.textContent = '¿Confirmar?';
                    setTimeout(() => {
                        if (delBtn && delBtn.isConnected) {
                            delBtn.classList.remove('is-confirming');
                            if (lbl) lbl.textContent = 'Eliminar';
                        }
                    }, 4000);
                    return;
                }
                await this.eliminarTarea(id);
            }
        });

        document.getElementById('tr-sheet-close')?.addEventListener('click', () => this.closeDetailSheet());
        const sheet = document.getElementById('tr-detail-sheet');
        sheet?.addEventListener('click', (e) => {
            if (e.target === sheet) this.closeDetailSheet();
        });

        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && document.getElementById('tr-detail-sheet')?.classList.contains('is-open')) {
                this.closeDetailSheet();
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        if (this._hashCleanup) window.removeEventListener('hashchange', this._hashCleanup);
        this._hashCleanup = () => {
            document.body.classList.remove('tr-modal-open');
            if (this._keyHandler) {
                document.removeEventListener('keydown', this._keyHandler);
                this._keyHandler = null;
            }
        };
        window.addEventListener('hashchange', this._hashCleanup, { once: true });
    },

    syncCreateButtonHref() {
        const createBtn = document.getElementById('btn-nueva-tarea');
        if (!createBtn) return;
        createBtn.href = this.cursoFilter !== 'ALL'
            ? `#/crear-tarea?curso=${encodeURIComponent(this.cursoFilter)}`
            : '#/crear-tarea';
    },

    scopedByCourse() {
        if (this.cursoFilter === 'ALL') return this.allTareas;
        return this.allTareas.filter(t => String(t.curso?.id) === String(this.cursoFilter));
    },

    renderStats() {
        const scoped = this.scopedByCourse();
        const pend = scoped.filter(t => !t.estado || t.estado === 'Pendiente').length;
        const prog = scoped.filter(t => t.estado === 'En progreso').length;
        const comp = scoped.filter(t => t.estado === 'Completada').length;

        const elP = document.getElementById('tr-stat-pend');
        const elG = document.getElementById('tr-stat-prog');
        const elC = document.getElementById('tr-stat-comp');
        if (elP) elP.textContent = String(pend);
        if (elG) elG.textContent = String(prog);
        if (elC) elC.textContent = String(comp);
    },

    renderTabs() {
        const nav = document.getElementById('tr-phase-tabs');
        if (!nav) return;

        const scoped = this.scopedByCourse();
        const tabs = [
            { key: 'ALL', label: 'Todas', count: scoped.length },
            { key: 'Pendiente', label: 'Pendientes', count: scoped.filter(t => !t.estado || t.estado === 'Pendiente').length },
            { key: 'En progreso', label: 'En progreso', count: scoped.filter(t => t.estado === 'En progreso').length },
            { key: 'Completada', label: 'Completadas', count: scoped.filter(t => t.estado === 'Completada').length },
            { key: 'OVERDUE', label: 'Vencidas', count: scoped.filter(isOverdueTask).length }
        ];

        nav.innerHTML = tabs.map(tab => `
            <button type="button" class="tr-tab ${this.phaseFilter === tab.key ? 'is-active' : ''}" data-phase="${tab.key}">
                ${escapeHtml(tab.label)} <span class="tr-tab-count">${tab.count}</span>
            </button>
        `).join('');
    },

    renderLedger() {
        const ledger = document.getElementById('tareas-ledger');
        if (!ledger) return;

        const scoped = this.scopedByCourse();
        const filtered = scoped.filter(t => {
            if (this.phaseFilter === 'OVERDUE' && !isOverdueTask(t)) return false;
            else if (this.phaseFilter !== 'ALL' && this.phaseFilter !== 'OVERDUE') {
                const st = t.estado || 'Pendiente';
                if (st !== this.phaseFilter) return false;
            }

            if (this.searchTerm) {
                const hay = `${t.titulo || ''} ${t.descripcion || ''} ${t.cursoLabel || ''}`.toLowerCase();
                if (!hay.includes(this.searchTerm)) return false;
            }
            return true;
        });

        if (!this.allTareas.length) {
            const createUrl = this.cursoFilter !== 'ALL'
                ? `#/crear-tarea?curso=${encodeURIComponent(this.cursoFilter)}`
                : '#/crear-tarea';
            ledger.innerHTML = `
                <div class="tr-empty-editorial">
                    <h3>Aún no has publicado tareas</h3>
                    <p>Redacta tu primera práctica o actividad académica con fecha límite, prioridad y guía adjunta.</p>
                    <a href="${createUrl}" class="tr-empty-cta">
                        <span>Redactar primera tarea</span>
                        <i class="ph ph-arrow-right" aria-hidden="true"></i>
                    </a>
                </div>
            `;
            return;
        }

        if (!filtered.length) {
            ledger.innerHTML = `<div class="tr-empty">Ninguna tarea coincide con los filtros actuales.</div>`;
            return;
        }

        ledger.innerHTML = filtered.map((t, idx) => {
            const due = formatDueBlock(t.fechaVencimiento, t.estado);
            const prio = t.prioridad || 'Media';
            const prioKey = prio.toLowerCase();
            const estado = t.estado || 'Pendiente';
            const pdfTag = t.pdfUrl
                ? `<a href="${escapeHtml(t.pdfUrl)}" target="_blank" rel="noopener" class="tr-pdf-link"><i class="ph ph-paperclip"></i> Guía</a>`
                : '';

            return `
                <article class="tr-row" style="--tr-i:${Math.min(idx, 12)};">
                    <div class="tr-col-due is-${due.tone}">
                        <span class="tr-due-day">${escapeHtml(due.day)}</span>
                        <span class="tr-due-meta">${escapeHtml(due.meta)}</span>
                        <span class="tr-due-rel">${escapeHtml(due.rel)}</span>
                    </div>

                    <div class="tr-col-main">
                        <div class="tr-meta-line">
                            <span class="tr-course-label">${escapeHtml(t.cursoLabel)}</span>
                            <span class="tr-prio-dot is-${escapeHtml(prioKey)}"><i aria-hidden="true"></i>Prioridad ${escapeHtml(prio)}</span>
                            ${pdfTag}
                        </div>
                        <button type="button" class="tr-task-title" data-action="detail" data-tarea-id="${escapeHtml(t.id)}">
                            ${escapeHtml(t.titulo || 'Sin título')}
                        </button>
                        <p class="tr-task-desc">${escapeHtml(t.descripcion || 'Sin instrucciones adicionales.')}</p>
                    </div>

                    <div class="tr-col-phase">
                        <select class="tr-estado-select" data-tarea-id="${escapeHtml(t.id)}" aria-label="Fase de ${escapeHtml(t.titulo)}">
                            <option value="Pendiente" ${estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="En progreso" ${estado === 'En progreso' ? 'selected' : ''}>En progreso</option>
                            <option value="Completada" ${estado === 'Completada' ? 'selected' : ''}>Completada</option>
                        </select>
                    </div>

                    <div class="tr-col-actions">
                        <button type="button" class="tr-action-btn" data-action="detail" data-tarea-id="${escapeHtml(t.id)}">
                            <i class="ph ph-tray" aria-hidden="true"></i>
                            <span>Entregas</span>
                        </button>
                        <a href="#/crear-tarea?edit=${encodeURIComponent(t.id)}" class="tr-icon-link" title="Editar en página dedicada">
                            <i class="ph ph-pencil-simple" aria-hidden="true"></i>
                            <span>Editar</span>
                        </a>
                        <button type="button" class="tr-delete-btn" data-action="delete" data-tarea-id="${escapeHtml(t.id)}" title="Eliminar tarea">
                            <i class="ph ph-trash" aria-hidden="true"></i>
                            <span>Eliminar</span>
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    },

    async cambiarEstadoTarea(tareaId, nuevoEstado) {
        try {
            await API.fetch(`/api/tareas/${tareaId}`, {
                method: 'PUT',
                body: JSON.stringify({ estado: nuevoEstado })
            });
            const found = this.allTareas.find(t => String(t.id) === String(tareaId));
            if (found) found.estado = nuevoEstado;
            this.renderStats();
            this.renderTabs();
            this.renderLedger();
        } catch (err) {
            console.error('Error actualizando estado:', err);
        }
    },

    async eliminarTarea(tareaId) {
        try {
            await API.fetch(`/api/docente/tareas/${tareaId}`, { method: 'DELETE' });
            this.allTareas = this.allTareas.filter(t => String(t.id) !== String(tareaId));
            this.renderStats();
            this.renderTabs();
            this.renderLedger();
        } catch (err) {
            console.error('Error eliminando tarea:', err);
        }
    },

    openDetailSheet() {
        const sheet = document.getElementById('tr-detail-sheet');
        if (!sheet) return;
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }
        sheet.classList.remove('is-closing');
        sheet.setAttribute('aria-hidden', 'false');
        document.body.classList.add('tr-modal-open');
        void sheet.offsetWidth;
        requestAnimationFrame(() => sheet.classList.add('is-open'));
    },

    closeDetailSheet() {
        const sheet = document.getElementById('tr-detail-sheet');
        if (!sheet || !sheet.classList.contains('is-open')) return;
        sheet.classList.add('is-closing');
        sheet.classList.remove('is-open');
        sheet.setAttribute('aria-hidden', 'true');
        this._closeTimer = setTimeout(() => {
            sheet.classList.remove('is-closing');
            document.body.classList.remove('tr-modal-open');
            this._closeTimer = null;
        }, 250);
    },

    async abrirDetalle(tareaId) {
        const t = this.allTareas.find(item => String(item.id) === String(tareaId));
        if (!t) return;

        document.getElementById('tr-sheet-kicker').textContent = `${(t.cursoLabel || '').toUpperCase()} · ${t.estado || 'PENDIENTE'}`;
        document.getElementById('tr-sheet-title').textContent = t.titulo || 'Tarea';
        document.getElementById('tr-sheet-sub').textContent = `Fecha límite: ${t.fechaVencimiento || 'Sin definir'} · Prioridad ${t.prioridad || 'Media'}`;

        const editLink = document.getElementById('tr-sheet-edit-link');
        if (editLink) editLink.href = `#/crear-tarea?edit=${encodeURIComponent(t.id)}`;

        const gradeLink = document.getElementById('tr-sheet-grade-link');
        if (gradeLink) {
            gradeLink.href = t.curso?.id
                ? `#/calificaciones?curso=${encodeURIComponent(t.curso.id)}`
                : '#/calificaciones';
        }

        const brief = document.getElementById('tr-sheet-brief');
        if (brief) {
            const pdfLine = t.pdfUrl
                ? `<a href="${escapeHtml(t.pdfUrl)}" target="_blank" rel="noopener" class="tr-sheet-pdf"><i class="ph ph-file-pdf"></i> Abrir documento adjunto ↗</a>`
                : '';
            brief.innerHTML = `
                <p>${escapeHtml(t.descripcion || 'Sin instrucciones registradas.')}</p>
                ${pdfLine}
            `;
        }

        const body = document.getElementById('tr-deliveries-body');
        if (body) body.innerHTML = `<div class="tr-empty">Consultando entregas…</div>`;
        this.openDetailSheet();

        try {
            const entregas = await API.fetch(`/api/entregas/tarea/${tareaId}`);
            const lista = Array.isArray(entregas) ? entregas : [];
            if (!lista.length) {
                body.innerHTML = `<div class="tr-empty">Ningún estudiante ha enviado entregas todavía.</div>`;
                return;
            }
            body.innerHTML = lista.map(e => {
                const estName = e.estudiante
                    ? `${e.estudiante.nombres || ''} ${e.estudiante.apellidos || ''}`.trim()
                    : 'Estudiante';
                const notaTxt = e.nota !== null && e.nota !== undefined ? `Nota: ${e.nota}` : 'Por calificar';
                const fileUrl = normalizeEntregaUrl(e.archivoUrl);
                return `
                    <div class="tr-delivery-row">
                        <div>
                            <strong>${escapeHtml(estName)}</strong>
                            <p>${escapeHtml(e.comentarioEstudiante || 'Sin comentario del estudiante.')}</p>
                        </div>
                        <div class="tr-delivery-right">
                            <span class="tr-delivery-nota">${escapeHtml(notaTxt)}</span>
                            ${fileUrl ? `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener" class="tr-pdf-link">Ver archivo ↗</a>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error cargando entregas:', err);
            if (body) body.innerHTML = `<div class="tr-empty">Error al cargar entregas.</div>`;
        }
    }
};
