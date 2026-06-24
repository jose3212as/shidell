(function () {
    let usuario = null;
    let payload = null;
    let calificaciones = [];
    let cursosResumen = [];

    document.addEventListener('DOMContentLoaded', iniciar);

    async function iniciar() {
        usuario = await window.shidellSession?.obtenerUsuario();
        if (!usuario) {
            renderError();
            return;
        }

        prepararPantalla();
        configurarTabs();

        try {
            const res = await fetch(`/api/calificaciones/estudiante/${usuario.id}`);
            if (!res.ok) throw new Error('No se pudieron cargar las calificaciones');
            payload = await res.json();
            calificaciones = normalizarEvaluaciones(payload.evaluaciones || []);
            cursosResumen = normalizarCursos(payload.cursos || []);
            renderVistaEspecifica('resumen');
        } catch (error) {
            renderError();
            console.error(error);
        }
    }

    function prepararPantalla() {
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ').trim() || 'Estudiante';
        });

        const saludo = document.querySelector('.greeting h1');
        if (saludo) saludo.textContent = `¡Hola, ${usuario.nombres || 'Estudiante'}!`;

        const header = document.querySelector('.calificaciones-header h2');
        const grupo = [usuario.grado ? `${usuario.grado} grado` : '', usuario.seccion ? `Sección ${usuario.seccion}` : '', usuario.nivel || ''].filter(Boolean).join(' - ');
        if (header) header.innerHTML = `Calificaciones ${grupo ? `<span class="cal-header-group">${escapeHtml(grupo)}</span>` : ''}`;
    }

    function configurarTabs() {
        const tabs = document.querySelectorAll('.cal-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const viewName = tab.dataset.view;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                document.querySelectorAll('.cal-tab-content').forEach(content => {
                    content.hidden = true;
                });

                const activeContent = document.getElementById(`view-${viewName}`);
                if (activeContent) {
                    activeContent.hidden = false;
                }

                renderVistaEspecifica(viewName);
            });
        });

        // Link de "Ver todas las calificaciones" redirige a la pestaña de evaluaciones
        document.querySelector('.view-all-link')?.addEventListener('click', event => {
            event.preventDefault();
            const evalTab = document.querySelector('.cal-tab[data-view="evaluacion"]');
            evalTab?.click();
        });

        // Buscador en tiempo real de evaluaciones
        const searchInput = document.getElementById('eval-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderEvaluacionesTabList(searchInput.value);
            });
        }

        // Botón de impresión del Historial Académico
        const btnPrint = document.getElementById('btn-imprimir-historial');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                window.print();
            });
        }
    }

    function normalizarEvaluaciones(lista) {
        return (Array.isArray(lista) ? lista : []).map(cal => ({
            ...cal,
            nota: Number(cal.nota || 0),
            notaMaxima: Number(cal.notaMaxima || 20),
            nota20: Number(cal.nota20 || 0),
            estado: cal.estado || estadoNota(Number(cal.nota20 || 0)).texto,
            actividad: limpiarTexto(cal.actividad || 'Evaluación'),
            curso: normalizarCurso(cal.curso || {}),
            fechaOrden: cal.fecha ? new Date(`${cal.fecha}T00:00:00`) : new Date(0)
        }));
    }

    function normalizarCursos(lista) {
        return (Array.isArray(lista) ? lista : []).map(curso => ({
            ...normalizarCurso(curso),
            promedio: Number(curso.promedio || 0),
            evaluaciones: Number(curso.evaluaciones || 0),
            estado: curso.estado || 'Sin notas'
        }));
    }

    function normalizarCurso(curso) {
        let profeStr = 'Docente por asignar';
        if (typeof curso.profesor === 'string') {
            profeStr = curso.profesor;
        } else if (curso.profesor && typeof curso.profesor === 'object') {
            profeStr = [curso.profesor.nombres, curso.profesor.apellidos].filter(Boolean).join(' ').trim() || 'Docente por asignar';
        }

        return {
            id: curso.id ?? 'sin-curso',
            nombre: limpiarTexto(curso.nombre || 'Curso sin nombre'),
            color: colorValido(curso.color),
            icono: curso.icono || 'ph-book-open',
            profesor: limpiarTexto(profeStr)
        };
    }

    function renderVistaEspecifica(vista) {
        if (vista === 'resumen') {
            renderStats();
            renderDistribucion();
            renderCursos();
            renderEvaluaciones('resumen');
            renderBanner();
        } else if (vista === 'curso') {
            renderCursosTabList();
        } else if (vista === 'evaluacion') {
            renderEvaluacionesTabList();
        } else if (vista === 'historial') {
            renderHistorialTab();
        }
    }

    function renderStats() {
        const promedio = Number(payload?.promedioGeneral || 0);
        const aprobados = Number(payload?.cursosAprobados || 0);
        const totalCursos = Number(payload?.cursosTotales || 0);
        const mejora = Number(payload?.mejoraPromedio || 0);
        const totalEvaluaciones = Number(payload?.evaluacionesTotales || calificaciones.length || 0);
        const estado = estadoNota(promedio);

        setValue('#stat-promedio', `${promedio.toFixed(1)} <span>/ 20</span>`, true);
        const badge = document.getElementById('stat-promedio-badge');
        if (badge) {
            badge.textContent = estado.texto;
            badge.className = `cal-stat-badge ${estado.clase}`;
        }

        setValue('#stat-cursos', `${aprobados} <span>/ ${totalCursos}</span>`, true);
        setValue('#stat-cursos-pct', totalCursos ? `${Math.round(aprobados / totalCursos * 100)}%` : '0%');
        setValue('#stat-mejora', `${mejora >= 0 ? '+' : ''}${mejora.toFixed(1)}`);
        setValue('#stat-evaluaciones', totalEvaluaciones);
    }

    function renderCursos() {
        const contenedor = document.querySelector('.cal-list');
        if (!contenedor) return;

        if (!cursosResumen.length) {
            contenedor.innerHTML = '<div class="cal-state empty"><i class="ph ph-books"></i><strong>No hay cursos para mostrar.</strong><span>Los cursos se leen desde el API del estudiante.</span></div>';
            return;
        }

        contenedor.innerHTML = cursosResumen.map(curso => {
            const estado = curso.evaluaciones ? estadoNota(curso.promedio) : { texto: 'Sin notas', clase: 'sin-notas' };
            return `
                <button class="cal-item cal-item-button" data-course-id="${escapeHtml(curso.id)}">
                    <div class="cal-course-info">
                        <div class="cal-icon bg-${escapeHtml(curso.color)}-light" style="color: var(--${escapeHtml(curso.color)}, var(--primary));">
                            <i class="ph-fill ${escapeHtml(curso.icono)}"></i>
                        </div>
                        <div class="cal-course-details">
                            <h4>${escapeHtml(curso.nombre)}</h4>
                            <p>${escapeHtml(curso.profesor)}</p>
                        </div>
                    </div>
                    <div class="cal-score">${curso.promedio.toFixed(1)} <span>/ 20</span></div>
                    <div><span class="cal-status-tag ${estado.clase}">${estado.texto}</span></div>
                    <div class="cal-arrow"><i class="ph ph-caret-right"></i></div>
                </button>`;
        }).join('');

        contenedor.querySelectorAll('[data-course-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cursoId = btn.dataset.courseId;
                const cursoTab = document.querySelector('.cal-tab[data-view="curso"]');
                if (cursoTab) {
                    cursoTab.click();
                    setTimeout(() => {
                        const sidebarBtn = document.querySelector(`[data-select-course-id="${cursoId}"]`);
                        sidebarBtn?.click();
                    }, 50);
                }
            });
        });
    }

    function renderEvaluaciones(vista, cursoId = null) {
        const contenedor = document.querySelector('.eval-list');
        const titulo = document.querySelector('.widget-panel:nth-child(2) h3');
        if (!contenedor) return;

        let lista = [...calificaciones].sort((a, b) => b.fechaOrden - a.fechaOrden);
        if (vista === 'curso' && cursoId !== null) lista = lista.filter(cal => String(cal.curso.id) === String(cursoId));
        if (vista === 'resumen') lista = lista.slice(0, 5);

        if (titulo) titulo.textContent = vista === 'historial' ? 'Historial académico' : vista === 'curso' ? 'Evaluaciones del curso' : 'Evaluaciones recientes';

        if (!lista.length) {
            contenedor.innerHTML = '<div class="cal-state">No hay evaluaciones registradas para esta vista.</div>';
            return;
        }

        contenedor.innerHTML = lista.map(cal => `
            <div class="eval-item">
                <div class="eval-icon bg-${escapeHtml(cal.curso.color)}-light" style="color: var(--${escapeHtml(cal.curso.color)}, var(--primary));">
                    <i class="ph-fill ${escapeHtml(cal.curso.icono)}"></i>
                </div>
                <div class="eval-info">
                    <h4>${escapeHtml(cal.actividad)}</h4>
                    <p>${escapeHtml(cal.curso.nombre)}</p>
                </div>
                <div class="eval-score-date">
                    <div class="score">${cal.nota.toFixed(1)} <span>/ ${cal.notaMaxima.toFixed(0)}</span></div>
                    <div class="date">${formatearFecha(cal.fecha)}</div>
                </div>
            </div>
        `).join('');
    }

    function renderDistribucion() {
        const rangos = Array.isArray(payload?.distribucion) ? payload.distribucion : [];
        const legendItems = document.querySelectorAll('.legend-item');
        rangos.forEach((rango, index) => {
            const item = legendItems[index];
            if (!item) return;
            const color = colorValido(rango.color);
            item.querySelector('.label').innerHTML = `<div class="dot" style="background: var(--${color});"></div> ${escapeHtml(rango.label)}`;
            item.querySelector('.val').textContent = Number(rango.cantidad || 0);
            item.querySelector('.pct').textContent = `(${Number(rango.porcentaje || 0)}%)`;
        });

        const total = Number(payload?.evaluacionesTotales || 0);
        const donut = document.querySelector('.donut-chart');
        const num = document.querySelector('.donut-inner .num');
        const lbl = document.querySelector('.donut-inner .lbl');
        if (num) num.textContent = total;
        if (lbl) lbl.textContent = total === 1 ? 'Evaluación' : 'Evaluaciones';
        if (!donut) return;

        if (!total || !rangos.length) {
            donut.style.background = 'var(--border-color-dark)';
            return;
        }

        let cursor = 0;
        const stops = rangos.map(rango => {
            const color = colorValido(rango.color);
            const start = cursor;
            cursor += Number(rango.porcentaje || 0);
            return `var(--${color}) ${start}% ${cursor}%`;
        }).join(', ');
        donut.style.background = `conic-gradient(${stops})`;
    }

    function renderCursosTabList() {
        const contenedor = document.getElementById('curso-tab-list');
        if (!contenedor) return;

        if (!cursosResumen.length) {
            contenedor.innerHTML = '<div class="cal-state empty"><i class="ph ph-books"></i><strong>No hay cursos.</strong></div>';
            return;
        }

        contenedor.innerHTML = cursosResumen.map(curso => {
            const promedioStr = curso.evaluaciones ? curso.promedio.toFixed(1) : '0.0';
            return `
                <button class="course-select-btn" data-select-course-id="${escapeHtml(curso.id)}">
                    <div class="course-select-info">
                        <div class="cal-icon bg-${escapeHtml(curso.color)}-light" style="color: var(--${escapeHtml(curso.color)}, var(--primary)); font-size: 16px; width: 32px; height: 32px; border-radius: 8px;">
                            <i class="ph-fill ${escapeHtml(curso.icono)}"></i>
                        </div>
                        <div class="course-select-details">
                            <h4>${escapeHtml(curso.nombre)}</h4>
                            <p>${escapeHtml(curso.profesor)}</p>
                        </div>
                    </div>
                    <div class="course-select-score">
                        <span class="score-val">${promedioStr}</span>
                        <span class="score-lbl">Promedio</span>
                    </div>
                    <div class="course-select-arrow"><i class="ph ph-caret-right"></i></div>
                </button>`;
        }).join('');

        const buttons = contenedor.querySelectorAll('[data-select-course-id]');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderCursoDetail(btn.dataset.selectCourseId);
            });
        });

        if (buttons.length > 0) {
            buttons[0].click();
        }
    }

    function renderCursoDetail(cursoId) {
        const header = document.getElementById('selected-course-detail-header');
        const listContainer = document.getElementById('course-detail-eval-list');
        if (!header || !listContainer) return;

        const curso = cursosResumen.find(c => String(c.id) === String(cursoId));
        if (!curso) return;

        header.style.display = 'flex';
        
        document.getElementById('course-detail-name').textContent = curso.nombre;
        document.getElementById('course-detail-teacher').textContent = curso.profesor;
        document.getElementById('course-detail-average').textContent = curso.evaluaciones ? curso.promedio.toFixed(1) : '0.0';
        
        const statusEl = document.getElementById('course-detail-status');
        if (statusEl) {
            const estado = curso.evaluaciones ? estadoNota(curso.promedio) : { texto: 'Sin notas', clase: 'sin-notas' };
            statusEl.textContent = estado.texto;
            statusEl.className = `cal-status-tag ${estado.clase}`;
        }
        
        const iconBox = document.getElementById('course-detail-icon-box');
        if (iconBox) {
            iconBox.className = `course-detail-icon bg-${curso.color}-light`;
            iconBox.style.color = `var(--${curso.color}, var(--primary))`;
            iconBox.innerHTML = `<i class="ph-fill ${curso.icono}"></i>`;
        }

        const evals = calificaciones
            .filter(cal => String(cal.curso.id) === String(cursoId))
            .sort((a, b) => b.fechaOrden - a.fechaOrden);

        if (!evals.length) {
            listContainer.innerHTML = '<div class="cal-state">No hay evaluaciones registradas para este curso.</div>';
            return;
        }

        listContainer.innerHTML = evals.map(cal => {
            const estado = estadoNota(cal.nota20);
            return `
                <div class="detail-row">
                    <div class="detail-eval">
                        <strong>${escapeHtml(cal.actividad)}</strong>
                        <small>Evaluación registrada</small>
                    </div>
                    <div class="detail-teacher">${escapeHtml(cal.curso.profesor)}</div>
                    <div class="detail-date">${formatearFecha(cal.fecha)}</div>
                    <div class="detail-grade">${cal.nota.toFixed(1)} <span>/ ${cal.notaMaxima.toFixed(0)}</span></div>
                    <div><span class="cal-status-tag ${estado.clase}">${estado.texto}</span></div>
                </div>`;
        }).join('');
    }

    function renderEvaluacionesTabList(query = '') {
        const contenedor = document.getElementById('eval-tab-list');
        const countEl = document.getElementById('eval-tab-count');
        if (!contenedor) return;

        const cleanQuery = query.toLowerCase().trim();
        const listaFiltrada = calificaciones.filter(cal => {
            if (!cleanQuery) return true;
            return cal.actividad.toLowerCase().includes(cleanQuery) || 
                   cal.curso.nombre.toLowerCase().includes(cleanQuery) || 
                   cal.curso.profesor.toLowerCase().includes(cleanQuery);
        });

        if (countEl) {
            countEl.textContent = `${listaFiltrada.length} de ${calificaciones.length} evaluaciones encontradas.`;
        }

        if (!listaFiltrada.length) {
            contenedor.innerHTML = '<div class="cal-state">No se encontraron evaluaciones que coincidan con la búsqueda.</div>';
            return;
        }

        contenedor.innerHTML = listaFiltrada.map(cal => {
            const estado = estadoNota(cal.nota20);
            return `
                <div class="detail-row">
                    <div class="detail-main">
                        <div class="cal-icon bg-${escapeHtml(cal.curso.color)}-light" style="color: var(--${escapeHtml(cal.curso.color)}, var(--primary));">
                            <i class="ph-fill ${escapeHtml(cal.curso.icono)}"></i>
                        </div>
                        <div>
                            <strong>${escapeHtml(cal.curso.nombre)}</strong>
                            <small>Escala 20: ${cal.nota20.toFixed(1)}</small>
                        </div>
                    </div>
                    <div class="detail-eval">
                        <strong>${escapeHtml(cal.actividad)}</strong>
                        <small>Evaluación registrada</small>
                    </div>
                    <div class="detail-teacher">${escapeHtml(cal.curso.profesor)}</div>
                    <div class="detail-date">${formatearFecha(cal.fecha)}</div>
                    <div class="detail-grade">${cal.nota.toFixed(1)} <span>/ ${cal.notaMaxima.toFixed(0)}</span></div>
                    <div><span class="cal-status-tag ${estado.clase}">${estado.texto}</span></div>
                </div>`;
        }).join('');
    }

    function renderHistorialTab() {
        const contenedor = document.getElementById('history-tab-list');
        if (!contenedor) return;

        const promedioGeneral = Number(payload?.promedioGeneral || 0);
        const totalCursos = cursosResumen.length;
        const aprobados = cursosResumen.filter(c => c.evaluaciones && c.promedio >= 11).length;
        const eficiencia = totalCursos ? Math.round((aprobados / totalCursos) * 100) : 0;

        setValue('#history-overall-avg', promedioGeneral.toFixed(1));
        setValue('#history-total-courses', totalCursos);
        setValue('#history-approved-courses', aprobados);
        setValue('#history-efficiency', `${eficiencia}%`);

        if (!cursosResumen.length) {
            contenedor.innerHTML = '<div class="cal-state">No hay cursos registrados para consolidar el historial.</div>';
            return;
        }

        contenedor.innerHTML = cursosResumen.map(curso => {
            const estado = curso.evaluaciones ? estadoNota(curso.promedio) : { texto: 'Sin notas', clase: 'sin-notas' };
            const promedioFinal = curso.evaluaciones ? curso.promedio.toFixed(1) : '0.0';
            return `
                <div class="detail-row">
                    <div class="detail-main">
                        <div class="cal-icon bg-${escapeHtml(curso.color)}-light" style="color: var(--${escapeHtml(curso.color)}, var(--primary));">
                            <i class="ph-fill ${escapeHtml(curso.icono)}"></i>
                        </div>
                        <strong>${escapeHtml(curso.nombre)}</strong>
                    </div>
                    <div class="detail-teacher">${escapeHtml(curso.profesor)}</div>
                    <div style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">
                        ${curso.evaluaciones} ${curso.evaluaciones === 1 ? 'evaluación' : 'evaluaciones'}
                    </div>
                    <div class="detail-grade">${promedioFinal} <span>/ 20</span></div>
                    <div><span class="cal-status-tag ${estado.clase}">${estado.texto}</span></div>
                </div>`;
        }).join('');
    }

    function renderBanner() {
        const mensaje = payload?.mensaje || {};
        const title = document.querySelector('.motivational-content h4');
        const text = document.querySelector('.motivational-content p');
        if (title) title.textContent = limpiarTexto(mensaje.titulo || 'Calificaciones del estudiante');
        if (text) text.textContent = limpiarTexto(mensaje.texto || 'El resumen se calcula desde el API del estudiante.');
    }

    function renderError() {
        setValue('.cal-list', '<div class="cal-state error"><strong>No se pudieron cargar las calificaciones.</strong><span>Actualiza la página o intenta nuevamente.</span></div>', true);
        setValue('.eval-list', '<div class="cal-state error">Error al cargar evaluaciones.</div>', true);
    }

    function estadoNota(nota) {
        if (nota >= 18) return { texto: 'Excelente', clase: 'excelente' };
        if (nota >= 14) return { texto: 'Muy bueno', clase: 'muy-bueno' };
        if (nota >= 11) return { texto: 'Aprobado', clase: 'bueno' };
        if (nota > 0) return { texto: 'Desaprobado', clase: 'insuficiente' };
        return { texto: 'Sin notas', clase: 'sin-notas' };
    }

    function colorValido(color) {
        return ['purple', 'green', 'blue', 'yellow', 'red', 'orange', 'teal', 'indigo'].includes(color) ? color : 'blue';
    }

    function formatearFecha(fecha) {
        if (!fecha) return 'Sin fecha';
        const date = new Date(`${fecha}T00:00:00`);
        return Number.isNaN(date.getTime()) ? fecha : date.toLocaleDateString('es-PE');
    }

    function limpiarTexto(texto) {
        let valor = String(texto || '');
        for (let i = 0; i < 3 && /[\u00C3\u00C2]/.test(valor); i++) {
            try {
                const decodificado = decodeURIComponent(escape(valor));
                if (decodificado === valor) break;
                valor = decodificado;
            } catch (error) {
                break;
            }
        }
        return valor;
    }

    function setValue(selector, value, html = false) {
        const el = document.querySelector(selector);
        if (!el) return;
        if (html) el.innerHTML = value;
        else el.textContent = value;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }
})();
