import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

const BIMESTRES = [
    { num: 1, label: 'Bimestre I · Semanas 1–9', start: 1, end: 9 },
    { num: 2, label: 'Bimestre II · Semanas 10–18', start: 10, end: 18 },
    { num: 3, label: 'Bimestre III · Semanas 19–27', start: 19, end: 27 },
    { num: 4, label: 'Bimestre IV · Semanas 28–36', start: 28, end: 36 }
];

const SCAFFOLDS = {
    analisis: 'A partir de lo trabajado en clase esta semana, ¿cuál consideran que es la idea clave y cómo la aplicarían a un problema cotidiano?',
    caso: 'Resuelvan y comenten el siguiente caso práctico:\n1. ¿Qué estrategia usarían primero?\n2. Expliquen brevemente por qué funciona su planteamiento.',
    dudas: 'Espacio abierto para dudas sobre los ejercicios y la actividad de esta semana. Indiquen el número de ejercicio y qué paso intentaron.'
};

function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sortCourses(a, b) {
    const cmpNivel = String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es');
    if (cmpNivel !== 0) return cmpNivel;
    const cmpGrado = Number(a.grado || 0) - Number(b.grado || 0);
    if (cmpGrado !== 0) return cmpGrado;
    const cmpSec = String(a.seccion || '').localeCompare(String(b.seccion || ''), 'es');
    if (cmpSec !== 0) return cmpSec;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
}

function formatAulaCorta(c) {
    if (!c) return '';
    const g = c.grado ? `${c.grado}°` : '';
    const s = c.seccion ? String(c.seccion).trim() : '';
    return [g, s].filter(Boolean).join(' ');
}

function formatNivel(nivel) {
    const raw = String(nivel || '').trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function getBimestreDeSemana(semana) {
    const found = BIMESTRES.find(b => semana >= b.start && semana <= b.end);
    return found ? `Bimestre ${found.num}` : 'Ciclo escolar';
}

export const ForosView = {
    user: null,
    cursos: [],
    cursoActualId: null,
    semanaActual: 28,
    semanaLectivaReal: 28,
    resumenPorCurso: new Map(),
    mensajes: [],
    isSubmitting: false,

    async render() {
        return `
            <div class="fr-page" id="fr-root">
                <header class="fr-masthead">
                    <div>
                        <p class="fr-kicker">DEBATES Y CONSULTAS · POR SECCIÓN</p>
                        <h2 class="fr-title">Foros</h2>
                        <p class="fr-subtitle">Supervisa tus debates activos por aula, modera respuestas y abre discusiones semanales sin perder el panorama general.</p>
                    </div>
                    <div class="fr-stats">
                        <div class="fr-stat-col">
                            <span class="fr-stat-num" id="fr-stat-activos">0</span>
                            <span class="fr-stat-lbl">FOROS ACTIVOS</span>
                        </div>
                        <div class="fr-stat-col">
                            <span class="fr-stat-num" id="fr-stat-msgs">0</span>
                            <span class="fr-stat-lbl">MENSAJES</span>
                        </div>
                        <div class="fr-stat-col">
                            <button type="button" class="fr-stat-btn" id="fr-jump-today-btn" title="Ir a la semana lectiva actual">
                                <span class="fr-stat-num" id="fr-stat-sem">S—</span>
                                <span class="fr-stat-lbl">SEMANA ACTUAL</span>
                            </button>
                        </div>
                    </div>
                </header>

                <div class="fr-controls-bar">
                    <div class="fr-section-tabs" id="fr-section-tabs" role="tablist" aria-label="Secciones asignadas"></div>

                    <div class="fr-week-ctrl">
                        <button type="button" class="fr-step-btn" id="fr-prev-week" title="Semana anterior" aria-label="Semana anterior">
                            <i class="ph ph-caret-left"></i>
                        </button>
                        <select id="foro-semana-select" class="fr-select" aria-label="Seleccionar semana lectiva"></select>
                        <button type="button" class="fr-step-btn" id="fr-next-week" title="Semana siguiente" aria-label="Semana siguiente">
                            <i class="ph ph-caret-right"></i>
                        </button>
                        <span id="foro-status-badge" class="fr-status-tag is-closed">Verificando...</span>
                    </div>
                </div>

                <div class="fr-workbench" id="fr-workbench">
                    <aside class="fr-rail" id="fr-rail"></aside>
                    <main class="fr-stage" id="foro-main-container">
                        <div class="fr-loading-inline">Cargando espacio de foros…</div>
                    </main>
                </div>
            </div>
        `;
    },

    async afterRender(queryString) {
        this.user = Auth.getUser();
        if (!this.user) return;
        this.isSubmitting = false;
        this.resumenPorCurso = new Map();

        try {
            const [cursosUnicos, calData] = await Promise.all([
                CursoService.getCursosUnicos(this.user.email),
                API.fetch(`/api/docente/${encodeURIComponent(this.user.id)}/calendario`).catch(() => null)
            ]);

            this.cursos = (Array.isArray(cursosUnicos) ? cursosUnicos : []).slice().sort(sortCourses);
            const detectedWeek = Number(calData?.calendarioEscolar?.semanaActual || 0);
            this.semanaLectivaReal = detectedWeek >= 1 && detectedWeek <= 36 ? detectedWeek : 28;

            if (!this.cursos.length) {
                const main = document.getElementById('foro-main-container');
                if (main) {
                    main.innerHTML = `<div class="fr-loading-inline">No tienes cursos activos asignados para gestionar foros.</div>`;
                }
                return;
            }

            const params = new URLSearchParams(queryString || '');
            const preCurso = params.get('curso');
            const preSemana = Number(params.get('semana'));

            this.cursoActualId = (preCurso && this.cursos.some(c => String(c.id) === String(preCurso)))
                ? Number(preCurso)
                : Number(this.cursos[0].id);

            this.semanaActual = (preSemana >= 1 && preSemana <= 36)
                ? preSemana
                : this.semanaLectivaReal;

            await this.cargarTodosResumenes();
            this.bindTopEvents();
            this.syncTopControls();
            this.renderRail();
            await this.cargarForo();
        } catch (err) {
            console.error('Error inicializando foros:', err);
            const main = document.getElementById('foro-main-container');
            if (main) {
                main.innerHTML = `<div class="fr-inline-feedback is-error">No se pudo cargar la vista de foros.</div>`;
            }
        }
    },

    async cargarTodosResumenes() {
        const entries = await Promise.all(
            this.cursos.map(async (c) => {
                const list = await API.fetch(`/api/cursos/${c.id}/foros/resumen`).catch(() => []);
                return [Number(c.id), Array.isArray(list) ? list : []];
            })
        );
        this.resumenPorCurso = new Map(entries);
    },

    async refrescarResumenCursoActual() {
        if (!this.cursoActualId) return;
        const list = await API.fetch(`/api/cursos/${this.cursoActualId}/foros/resumen`).catch(() => []);
        this.resumenPorCurso.set(Number(this.cursoActualId), Array.isArray(list) ? list : []);
    },

    bindTopEvents() {
        document.getElementById('fr-section-tabs')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-curso-id]');
            if (!btn) return;
            const nextId = Number(btn.getAttribute('data-curso-id'));
            if (!nextId || nextId === this.cursoActualId) return;
            await this.selectCourseAndWeek(nextId, this.semanaActual);
        });

        document.getElementById('foro-semana-select')?.addEventListener('change', async (e) => {
            const sem = Number(e.target.value);
            if (sem >= 1 && sem <= 36) {
                await this.selectCourseAndWeek(this.cursoActualId, sem);
            }
        });

        document.getElementById('fr-prev-week')?.addEventListener('click', async () => {
            if (this.semanaActual > 1) {
                await this.selectCourseAndWeek(this.cursoActualId, this.semanaActual - 1);
            }
        });

        document.getElementById('fr-next-week')?.addEventListener('click', async () => {
            if (this.semanaActual < 36) {
                await this.selectCourseAndWeek(this.cursoActualId, this.semanaActual + 1);
            }
        });

        document.getElementById('fr-jump-today-btn')?.addEventListener('click', async () => {
            await this.selectCourseAndWeek(this.cursoActualId, this.semanaLectivaReal);
        });

        document.getElementById('fr-rail')?.addEventListener('click', async (e) => {
            const weekBtn = e.target.closest('[data-goto-week]');
            if (!weekBtn) return;
            const targetCourse = weekBtn.getAttribute('data-goto-curso')
                ? Number(weekBtn.getAttribute('data-goto-curso'))
                : this.cursoActualId;
            const targetWeek = Number(weekBtn.getAttribute('data-goto-week'));
            if (targetWeek >= 1 && targetWeek <= 36) {
                await this.selectCourseAndWeek(targetCourse, targetWeek);
            }
        });
    },

    async selectCourseAndWeek(cursoId, semana) {
        this.cursoActualId = Number(cursoId);
        this.semanaActual = Number(semana);
        this.syncTopControls();
        this.renderRail();
        await this.cargarForo();
    },

    getCurrentCourse() {
        return this.cursos.find(c => Number(c.id) === Number(this.cursoActualId)) || this.cursos[0];
    },

    syncTopControls() {
        const tabsEl = document.getElementById('fr-section-tabs');
        if (tabsEl) {
            tabsEl.innerHTML = this.cursos.map(c => {
                const resumen = this.resumenPorCurso.get(Number(c.id)) || [];
                const activeCount = resumen.length;
                const isSelected = Number(c.id) === Number(this.cursoActualId);
                const aula = formatAulaCorta(c) || formatNivel(c.nivel);
                return `
                    <button type="button"
                        role="tab"
                        aria-selected="${isSelected ? 'true' : 'false'}"
                        class="fr-sec-tab ${isSelected ? 'is-active' : ''}"
                        data-curso-id="${escapeHtml(c.id)}"
                        title="${escapeHtml(c.nombre)} (${escapeHtml(aula)} · ${escapeHtml(formatNivel(c.nivel))})">
                        <span class="fr-sec-code">${escapeHtml(aula)}</span>
                        <span class="fr-sec-name">${escapeHtml(c.nombre)}</span>
                        <span class="fr-sec-count ${activeCount > 0 ? 'has-items' : ''}">${activeCount}</span>
                    </button>
                `;
            }).join('');
        }

        const sel = document.getElementById('foro-semana-select');
        if (sel) {
            let html = '';
            for (let i = 1; i <= 36; i++) {
                const resumen = this.resumenPorCurso.get(Number(this.cursoActualId)) || [];
                const item = resumen.find(r => Number(r.semana) === i);
                const actualMark = i === this.semanaLectivaReal ? ' · Actual' : '';
                const countMark = item ? ` (${item.totalMensajes} msg)` : '';
                html += `<option value="${i}" ${i === this.semanaActual ? 'selected' : ''}>Semana ${i}${actualMark}${countMark}</option>`;
            }
            sel.innerHTML = html;
        }

        const prevBtn = document.getElementById('fr-prev-week');
        const nextBtn = document.getElementById('fr-next-week');
        if (prevBtn) prevBtn.disabled = this.semanaActual <= 1;
        if (nextBtn) nextBtn.disabled = this.semanaActual >= 36;

        const resumenActual = this.resumenPorCurso.get(Number(this.cursoActualId)) || [];
        const totalMsgs = resumenActual.reduce((acc, r) => acc + Number(r.totalMensajes || 0), 0);
        const statAct = document.getElementById('fr-stat-activos');
        const statMsgs = document.getElementById('fr-stat-msgs');
        const statSem = document.getElementById('fr-stat-sem');
        if (statAct) statAct.textContent = String(resumenActual.length);
        if (statMsgs) statMsgs.textContent = String(totalMsgs);
        if (statSem) statSem.textContent = `S${this.semanaLectivaReal}`;
    },

    renderRail() {
        const rail = document.getElementById('fr-rail');
        if (!rail) return;

        const curso = this.getCurrentCourse();
        const aula = formatAulaCorta(curso);
        const resumen = (this.resumenPorCurso.get(Number(this.cursoActualId)) || []).slice()
            .sort((a, b) => Number(b.semana) - Number(a.semana));
        const activeWeekMap = new Map(resumen.map(r => [Number(r.semana), r]));

        let activeHtml = '';
        if (resumen.length === 0) {
            activeHtml = `<p class="fr-rail-empty-note">Aún no hay foros abiertos en ${escapeHtml(curso?.nombre || 'esta sección')} ${escapeHtml(aula)}. Usa el formulario de la derecha o elige una semana.</p>`;
        } else {
            activeHtml = `
                <div class="fr-active-list">
                    ${resumen.map(r => {
                        const isCur = Number(r.semana) === Number(this.semanaActual);
                        const repliesCount = Math.max(0, Number(r.totalMensajes || 1) - 1);
                        const repliesTxt = repliesCount === 1 ? '1 respuesta' : `${repliesCount} respuestas`;
                        const topic = r.primerMensaje?.contenido || 'Debate abierto';
                        const lastAuthor = r.ultimoMensaje?.autorNombre || '';
                        const lastTime = this.formatFechaHora(r.ultimoMensaje?.fecha);
                        return `
                            <button type="button" class="fr-active-row ${isCur ? 'is-current' : ''}" data-goto-week="${escapeHtml(r.semana)}">
                                <div class="fr-active-top">
                                    <span class="fr-active-week">SEMANA ${escapeHtml(r.semana)}</span>
                                    <span class="fr-active-replies">${escapeHtml(repliesTxt)}</span>
                                </div>
                                <p class="fr-active-snippet">${escapeHtml(topic)}</p>
                                <span class="fr-active-sub">${escapeHtml(lastAuthor)}${lastTime ? ` · ${escapeHtml(lastTime)}` : ''}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        const otherThreads = this.collectCrossSectionThreads(Number(this.cursoActualId)).slice(0, 4);
        const otherSectionHtml = otherThreads.length > 0 ? `
            <section>
                <div class="fr-rail-block-head">
                    <h3 class="fr-rail-label">En otros salones</h3>
                    <span class="fr-rail-meta">${otherThreads.length}</span>
                </div>
                <div class="fr-active-list">
                    ${otherThreads.map(item => `
                        <button type="button" class="fr-active-row" data-goto-curso="${escapeHtml(item.curso.id)}" data-goto-week="${escapeHtml(item.resumen.semana)}">
                            <div class="fr-active-top">
                                <span class="fr-active-week">${escapeHtml(formatAulaCorta(item.curso))} · S${escapeHtml(item.resumen.semana)}</span>
                                <span class="fr-active-replies">${escapeHtml(item.resumen.totalMensajes)} msg</span>
                            </div>
                            <p class="fr-active-snippet">${escapeHtml(item.resumen.primerMensaje?.contenido || 'Debate activo')}</p>
                        </button>
                    `).join('')}
                </div>
            </section>
        ` : '';

        const mapHtml = BIMESTRES.map(b => {
            let cells = '';
            for (let w = b.start; w <= b.end; w++) {
                const info = activeWeekMap.get(w);
                const classes = ['fr-wk-cell'];
                if (info) classes.push('has-forum');
                if (w === this.semanaLectivaReal) classes.push('is-today');
                if (w === this.semanaActual) classes.push('is-selected');
                const title = info
                    ? `Semana ${w}: Foro activo (${info.totalMensajes} mensaje(s))`
                    : (w === this.semanaLectivaReal ? `Semana ${w} (Actual)` : `Semana ${w}`);
                cells += `<button type="button" class="${classes.join(' ')}" data-goto-week="${w}" title="${escapeHtml(title)}">${w}</button>`;
            }
            return `
                <div class="fr-bim-row">
                    <span class="fr-bim-title">${escapeHtml(b.label)}</span>
                    <div class="fr-week-grid">${cells}</div>
                </div>
            `;
        }).join('');

        rail.innerHTML = `
            <section>
                <div class="fr-rail-block-head">
                    <h3 class="fr-rail-label">Debates activos · ${escapeHtml(aula)}</h3>
                    <span class="fr-rail-meta">${resumen.length} de 36</span>
                </div>
                ${activeHtml}
            </section>

            ${otherSectionHtml}

            <section>
                <div class="fr-rail-block-head">
                    <h3 class="fr-rail-label">Mapa de semanas</h3>
                    <span class="fr-rail-meta">Actual: S${this.semanaLectivaReal}</span>
                </div>
                <div class="fr-bim-groups">${mapHtml}</div>
                <div class="fr-map-legend">
                    <span class="fr-legend-item"><i class="fr-legend-swatch is-open"></i>Con foro</span>
                    <span class="fr-legend-item"><i class="fr-legend-swatch is-now"></i>Semana actual</span>
                </div>
            </section>
        `;
    },

    collectCrossSectionThreads(excludeCursoId) {
        const items = [];
        this.cursos.forEach(c => {
            if (Number(c.id) === Number(excludeCursoId)) return;
            const list = this.resumenPorCurso.get(Number(c.id)) || [];
            list.forEach(r => {
                items.push({ curso: c, resumen: r });
            });
        });
        items.sort((a, b) => {
            const ta = new Date(a.resumen.ultimoMensaje?.fecha || 0).getTime() || 0;
            const tb = new Date(b.resumen.ultimoMensaje?.fecha || 0).getTime() || 0;
            return tb - ta;
        });
        return items;
    },

    async cargarForo() {
        const container = document.getElementById('foro-main-container');
        const badge = document.getElementById('foro-status-badge');
        if (!container) return;

        container.innerHTML = `<div class="fr-loading-inline">Consultando Semana ${escapeHtml(this.semanaActual)}…</div>`;

        try {
            const res = await API.fetch(`/api/cursos/${this.cursoActualId}/semanas/${this.semanaActual}/foro`);
            this.mensajes = Array.isArray(res) ? res : [];

            if (this.mensajes.length === 0) {
                if (badge) {
                    badge.className = 'fr-status-tag is-closed';
                    badge.innerHTML = `<i class="ph ph-lock-simple"></i> Semana ${this.semanaActual} sin debate`;
                }
                this.renderInlineComposer(container);
            } else {
                if (badge) {
                    badge.className = 'fr-status-tag is-open';
                    const total = this.mensajes.length;
                    badge.innerHTML = `<i class="ph ph-check-circle"></i> Foro abierto · ${total} ${total === 1 ? 'mensaje' : 'mensajes'}`;
                }
                this.renderStreamForo(container);
            }
        } catch (err) {
            console.error('Error al cargar foro:', err);
            container.innerHTML = `<div class="fr-inline-feedback is-error">No se pudo cargar el foro de esta semana.</div>`;
        }
    },

    renderInlineComposer(container) {
        const curso = this.getCurrentCourse();
        const aula = formatAulaCorta(curso);
        const nivel = formatNivel(curso?.nivel);
        const bim = getBimestreDeSemana(this.semanaActual);
        const sameNameSections = this.cursos.filter(c =>
            String(c.nombre || '').toLowerCase() === String(curso?.nombre || '').toLowerCase()
            && String(c.nivel || '').toLowerCase() === String(curso?.nivel || '').toLowerCase()
        );

        const scopeOption = sameNameSections.length > 1 ? `
            <label class="fr-scope-check">
                <input type="checkbox" id="fr-apply-all-sections">
                <span>Abrir también en las ${sameNameSections.length} secciones de ${escapeHtml(curso.nombre)}</span>
            </label>
        ` : '<span></span>';

        const recentAcrossAll = this.collectCrossSectionThreads(null).slice(0, 6);
        const lowerContent = recentAcrossAll.length > 0 ? `
            <div class="fr-below-composer">
                <h3 class="fr-section-heading">Actividad reciente en tus foros (${recentAcrossAll.length})</h3>
                <div class="fr-cross-list">
                    ${recentAcrossAll.map(({ curso: c, resumen: r }) => {
                        const replies = Math.max(0, Number(r.totalMensajes || 1) - 1);
                        return `
                            <button type="button" class="fr-cross-row" data-cross-curso="${escapeHtml(c.id)}" data-cross-sem="${escapeHtml(r.semana)}">
                                <span class="fr-cross-meta">
                                    <span class="fr-cross-aula">${escapeHtml(c.nombre)} · ${escapeHtml(formatAulaCorta(c))}</span>
                                    <span class="fr-cross-sem">Semana ${escapeHtml(r.semana)}</span>
                                </span>
                                <span class="fr-cross-preview">
                                    <div class="fr-cross-topic">${escapeHtml(r.primerMensaje?.contenido || 'Debate abierto')}</div>
                                    <div class="fr-cross-last">Último: ${escapeHtml(r.ultimoMensaje?.autorNombre || 'Docente')} — ${escapeHtml(r.ultimoMensaje?.contenido || '')}</div>
                                </span>
                                <span class="fr-cross-count">${replies} ${replies === 1 ? 'respuesta' : 'respuestas'}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : `
            <div class="fr-below-composer">
                <h3 class="fr-section-heading">Cómo funciona el seguimiento de foros</h3>
                <div class="fr-guide-strip">
                    <div class="fr-guide-step">
                        <strong>1. Panorama visible por aula</strong>
                        <span>Los contadores junto a cada salón y el mapa izquierdo marcan qué semanas ya tienen debate publicado.</span>
                    </div>
                    <div class="fr-guide-step">
                        <strong>2. Publicación directa o en bloque</strong>
                        <span>Puedes habilitar la discusión solo para ${escapeHtml(aula)} o replicarla en tus secciones de ${escapeHtml(curso?.nombre || 'curso')}.</span>
                    </div>
                    <div class="fr-guide-step">
                        <strong>3. Moderación inmediata</strong>
                        <span>Cuando un estudiante comente, verás el hilo cronológico y podrás responder o moderar mensajes desde aquí.</span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = `
            <div class="fr-composer-open">
                <div class="fr-stage-eyebrow">
                    <span class="fr-stage-kicker">${escapeHtml(curso?.nombre || 'Curso')} · ${escapeHtml(aula)} · ${escapeHtml(nivel)} · ${escapeHtml(bim)}</span>
                    <span class="fr-stage-date">Semana ${escapeHtml(this.semanaActual)}${this.semanaActual === this.semanaLectivaReal ? ' (en curso)' : ''}</span>
                </div>
                <h3 class="fr-composer-title">Abrir tema de discusión — Semana ${escapeHtml(this.semanaActual)}</h3>
                <p class="fr-composer-lead">El foro de esta semana aún no está visible para ${escapeHtml(aula)}. Redacta la consigna inicial o elige una base rápida.</p>

                <div class="fr-scaffolds">
                    <button type="button" class="fr-scaffold-chip" data-scaffold="analisis">+ Pregunta de análisis</button>
                    <button type="button" class="fr-scaffold-chip" data-scaffold="caso">+ Caso práctico</button>
                    <button type="button" class="fr-scaffold-chip" data-scaffold="dudas">+ Consultas de la clase</button>
                </div>

                <textarea id="nuevo-foro-input" rows="3" class="fr-textarea" placeholder="Escribe la pregunta detonante o instrucciones de participación para la Semana ${escapeHtml(this.semanaActual)}…"></textarea>

                <div class="fr-composer-foot">
                    ${scopeOption}
                    <button type="button" id="btn-publicar-primer-foro" class="fr-btn-primary">
                        <i class="ph ph-paper-plane-tilt"></i>
                        <span>Publicar y abrir foro</span>
                    </button>
                </div>
                <div id="fr-composer-msg" class="fr-inline-feedback" aria-live="polite"></div>
            </div>
            ${lowerContent}
        `;

        container.querySelectorAll('[data-scaffold]').forEach(btn => {
            btn.addEventListener('click', () => {
                const ta = document.getElementById('nuevo-foro-input');
                const key = btn.getAttribute('data-scaffold');
                if (ta && SCAFFOLDS[key]) {
                    ta.value = SCAFFOLDS[key];
                    ta.focus();
                }
            });
        });

        const textarea = document.getElementById('nuevo-foro-input');
        textarea?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.publicarPrimerTema(sameNameSections);
            }
        });

        document.getElementById('btn-publicar-primer-foro')?.addEventListener('click', () => {
            this.publicarPrimerTema(sameNameSections);
        });

        container.querySelectorAll('[data-cross-curso]').forEach(row => {
            row.addEventListener('click', async () => {
                const cId = Number(row.getAttribute('data-cross-curso'));
                const sem = Number(row.getAttribute('data-cross-sem'));
                await this.selectCourseAndWeek(cId, sem);
            });
        });
    },

    renderStreamForo(container) {
        const curso = this.getCurrentCourse();
        const aula = formatAulaCorta(curso);
        const nivel = formatNivel(curso?.nivel);
        const primerMensaje = this.mensajes[0];
        const respuestas = this.mensajes.slice(1);

        const streamHtml = respuestas.length > 0
            ? `<div class="fr-stream-list">${respuestas.map(m => this.renderMessageRow(m)).join('')}</div>`
            : `<p class="fr-stream-empty">El foro ya está habilitado para ${escapeHtml(aula)}. Aún no hay participaciones de estudiantes en esta semana.</p>`;

        container.innerHTML = `
            <article class="fr-topic-band">
                <div class="fr-stage-eyebrow">
                    <span class="fr-stage-kicker">TEMA ACTIVO · ${escapeHtml(curso?.nombre || '')} · ${escapeHtml(aula)} · SEMANA ${escapeHtml(this.semanaActual)}</span>
                    <span class="fr-stage-date">${escapeHtml(this.formatFechaHora(primerMensaje.fecha))}</span>
                </div>
                <p class="fr-topic-text">${escapeHtml(primerMensaje.contenido || '')}</p>
                <div class="fr-topic-meta">
                    <span>Publicado por <strong>${escapeHtml(primerMensaje.autorNombre || 'Docente')}</strong> · ${escapeHtml(nivel)}</span>
                    <button type="button" class="fr-del-btn" data-delete-msg="${escapeHtml(primerMensaje.id)}" title="Cerrar o eliminar tema completo de esta semana">
                        <i class="ph ph-trash"></i>
                        <span>Eliminar tema</span>
                    </button>
                </div>
            </article>

            <div class="fr-stream-head">
                <h3 class="fr-rail-label">Participaciones (${respuestas.length})</h3>
            </div>

            ${streamHtml}

            <div class="fr-reply-bar">
                <input type="text" id="foro-reply-input" class="fr-reply-input" placeholder="Escribe una respuesta o retroalimentación docente para la Semana ${escapeHtml(this.semanaActual)}…">
                <button type="button" id="fr-send-reply-btn" class="fr-btn-primary">
                    <i class="ph ph-paper-plane-tilt"></i>
                    <span>Responder</span>
                </button>
            </div>
            <div id="fr-stream-msg" class="fr-inline-feedback" aria-live="polite"></div>
        `;

        const replyInput = document.getElementById('foro-reply-input');
        replyInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.enviarRespuesta();
            }
        });
        document.getElementById('fr-send-reply-btn')?.addEventListener('click', () => this.enviarRespuesta());

        container.querySelectorAll('[data-delete-msg]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-delete-msg');
                if (!btn.classList.contains('is-confirming')) {
                    btn.classList.add('is-confirming');
                    const span = btn.querySelector('span');
                    if (span) span.textContent = '¿Confirmar?';
                    setTimeout(() => {
                        if (btn && btn.isConnected) {
                            btn.classList.remove('is-confirming');
                            if (span) span.textContent = btn.closest('.fr-topic-band') ? 'Eliminar tema' : 'Eliminar';
                        }
                    }, 4000);
                    return;
                }
                await this.eliminarMensaje(id);
            });
        });
    },

    renderMessageRow(m) {
        const isDocente = String(m.autorId) === String(this.user.id)
            || (m.autorNombre && m.autorNombre.toLowerCase().includes('prof'));
        const inicial = (m.autorNombre || 'U').trim().charAt(0).toUpperCase();
        return `
            <div class="fr-msg-row ${isDocente ? 'is-docente' : ''}">
                <div class="fr-msg-avatar">${escapeHtml(inicial)}</div>
                <div class="fr-msg-body">
                    <div class="fr-msg-top">
                        <div class="fr-msg-author">
                            <strong>${escapeHtml(m.autorNombre || 'Usuario')}</strong>
                            ${isDocente ? '<span class="fr-role-tag">DOCENTE</span>' : ''}
                        </div>
                        <div class="fr-msg-actions">
                            <span class="fr-msg-time">${escapeHtml(this.formatFechaHora(m.fecha))}</span>
                            <button type="button" class="fr-del-btn" data-delete-msg="${escapeHtml(m.id)}" title="Eliminar mensaje">
                                <i class="ph ph-trash"></i>
                                <span>Eliminar</span>
                            </button>
                        </div>
                    </div>
                    <p class="fr-msg-content">${escapeHtml(m.contenido || '')}</p>
                </div>
            </div>
        `;
    },

    async publicarPrimerTema(sameNameSections) {
        if (this.isSubmitting) return;
        const input = document.getElementById('nuevo-foro-input');
        const msgBox = document.getElementById('fr-composer-msg');
        const texto = (input?.value || '').trim();

        if (!texto) {
            if (msgBox) {
                msgBox.className = 'fr-inline-feedback is-error';
                msgBox.textContent = 'Escribe la pregunta detonante o consigna antes de abrir el foro.';
            }
            input?.focus();
            return;
        }

        const applyAll = Boolean(document.getElementById('fr-apply-all-sections')?.checked);
        const targets = applyAll && Array.isArray(sameNameSections) && sameNameSections.length > 1
            ? sameNameSections.map(c => Number(c.id))
            : [Number(this.cursoActualId)];

        const nombreDocente = `${this.user.nombres || ''} ${this.user.apellidos || ''}`.trim() || 'Docente';
        const autorDisplay = nombreDocente.toLowerCase().startsWith('prof') ? nombreDocente : `Prof. ${nombreDocente}`;
        const btn = document.getElementById('btn-publicar-primer-foro');

        this.isSubmitting = true;
        if (btn) btn.disabled = true;

        try {
            await Promise.all(targets.map(cId =>
                API.fetch(`/api/cursos/${cId}/semanas/${this.semanaActual}/foro`, {
                    method: 'POST',
                    body: JSON.stringify({
                        autorId: this.user.id,
                        autorNombre: autorDisplay,
                        contenido: texto
                    })
                })
            ));

            if (targets.length > 1) {
                await this.cargarTodosResumenes();
            } else {
                await this.refrescarResumenCursoActual();
            }
            this.syncTopControls();
            this.renderRail();
            await this.cargarForo();
        } catch (err) {
            console.error('Error publicando foro:', err);
            if (msgBox) {
                msgBox.className = 'fr-inline-feedback is-error';
                msgBox.textContent = 'No se pudo publicar el tema. Inténtalo nuevamente.';
            }
        } finally {
            this.isSubmitting = false;
            if (btn && btn.isConnected) btn.disabled = false;
        }
    },

    async enviarRespuesta() {
        if (this.isSubmitting) return;
        const input = document.getElementById('foro-reply-input');
        const msgBox = document.getElementById('fr-stream-msg');
        const texto = (input?.value || '').trim();
        if (!texto) return;

        const nombreDocente = `${this.user.nombres || ''} ${this.user.apellidos || ''}`.trim() || 'Docente';
        const autorDisplay = nombreDocente.toLowerCase().startsWith('prof') ? nombreDocente : `Prof. ${nombreDocente}`;
        const btn = document.getElementById('fr-send-reply-btn');

        this.isSubmitting = true;
        if (input) input.disabled = true;
        if (btn) btn.disabled = true;

        try {
            await API.fetch(`/api/cursos/${this.cursoActualId}/semanas/${this.semanaActual}/foro`, {
                method: 'POST',
                body: JSON.stringify({
                    autorId: this.user.id,
                    autorNombre: autorDisplay,
                    contenido: texto
                })
            });

            await this.refrescarResumenCursoActual();
            this.syncTopControls();
            this.renderRail();
            await this.cargarForo();
        } catch (err) {
            console.error('Error enviando respuesta:', err);
            if (msgBox) {
                msgBox.className = 'fr-inline-feedback is-error';
                msgBox.textContent = 'No se pudo enviar la respuesta.';
            }
        } finally {
            this.isSubmitting = false;
            if (input && input.isConnected) input.disabled = false;
            if (btn && btn.isConnected) btn.disabled = false;
        }
    },

    async eliminarMensaje(mensajeId) {
        const msgBox = document.getElementById('fr-stream-msg');
        try {
            await API.fetch(`/api/cursos/${this.cursoActualId}/semanas/${this.semanaActual}/foro/${mensajeId}`, {
                method: 'DELETE'
            });
            await this.refrescarResumenCursoActual();
            this.syncTopControls();
            this.renderRail();
            await this.cargarForo();
        } catch (err) {
            console.error('Error eliminando mensaje:', err);
            if (msgBox) {
                msgBox.className = 'fr-inline-feedback is-error';
                msgBox.textContent = 'No se pudo eliminar el mensaje.';
            }
        }
    },

    formatFechaHora(fh) {
        if (!fh) return '';
        try {
            const d = new Date(fh);
            return Number.isNaN(d.getTime())
                ? String(fh)
                : d.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch {
            return String(fh);
        }
    }
};
