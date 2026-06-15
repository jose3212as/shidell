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
            renderTodo('resumen');
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
        const keys = ['resumen', 'curso', 'evaluacion', 'historial'];
        tabs.forEach((tab, index) => {
            tab.dataset.view = keys[index] || 'resumen';
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderTodo(tab.dataset.view);
                if (tab.dataset.view === 'evaluacion' || tab.dataset.view === 'historial') mostrarDetalleCompleto(true);
                else ocultarDetalleCompleto();
            });
        });

        document.querySelector('.view-all-link')?.addEventListener('click', event => {
            event.preventDefault();
            tabs[2]?.click();
        });

        document.getElementById('btn-cerrar-detalle')?.addEventListener('click', ocultarDetalleCompleto);
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
        return {
            id: curso.id ?? 'sin-curso',
            nombre: limpiarTexto(curso.nombre || 'Curso sin nombre'),
            color: colorValido(curso.color),
            icono: curso.icono || 'ph-book-open',
            profesor: limpiarTexto(curso.profesor || 'Docente por asignar')
        };
    }

    function renderTodo(vista) {
        renderStats();
        renderDistribucion();
        renderCursos();
        renderEvaluaciones(vista);
        renderDetalleCompleto();
        renderBanner();
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
                renderEvaluaciones('curso', btn.dataset.courseId);
                mostrarDetalleCompleto(true, btn.dataset.courseId);
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

    function renderDetalleCompleto(filtroCursoId = null) {
        const lista = document.getElementById('cal-detail-list');
        const count = document.getElementById('cal-detail-count');
        if (!lista) return;

        const detalle = calificaciones
            .filter(cal => filtroCursoId === null || String(cal.curso.id) === String(filtroCursoId))
            .sort((a, b) => b.fechaOrden - a.fechaOrden);

        if (count) count.textContent = `${detalle.length} evaluaciones registradas desde el API del estudiante.`;

        if (!detalle.length) {
            lista.innerHTML = '<div class="cal-state">No hay calificaciones detalladas.</div>';
            return;
        }

        lista.innerHTML = detalle.map(cal => {
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
                        <small>Registrada por docente</small>
                    </div>
                    <div class="detail-teacher">${escapeHtml(cal.curso.profesor)}</div>
                    <div class="detail-date">${formatearFecha(cal.fecha)}</div>
                    <div class="detail-grade">${cal.nota.toFixed(1)} <span>/ ${cal.notaMaxima.toFixed(0)}</span></div>
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

    function mostrarDetalleCompleto(scroll = false, cursoId = null) {
        const panel = document.getElementById('calificaciones-detalle');
        if (!panel) return;
        renderDetalleCompleto(cursoId);
        panel.hidden = false;
        if (scroll) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function ocultarDetalleCompleto() {
        const panel = document.getElementById('calificaciones-detalle');
        if (panel) panel.hidden = true;
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
