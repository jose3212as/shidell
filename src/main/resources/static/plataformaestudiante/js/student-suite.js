/**
 * SHIDELL — PANEL ANALÍTICO CONECTADO 100% AL API (student-suite.js)
 * Sin datos estáticos ni localStorage ficticio, sin botón "Estudio y Práctica"
 * y sin interruptor de modo oscuro.
 * Consume exclusivamente los endpoints reales de Spring Boot + PostgreSQL:
 *  - GET /api/calificaciones/estudiante/{id}
 *  - GET /api/progreso/estudiante/{id}
 *  - GET /api/tareas/estudiante/{id}
 */
(function () {
    if (window.__shidellStudentSuiteLoaded) return;
    window.__shidellStudentSuiteLoaded = true;

    // Limpiar cualquier estado previo de modo oscuro guardado en el navegador
    try {
        localStorage.removeItem('shidell_student_dark');
        document.body?.classList.remove('shidell-dark');
    } catch {}

    const ICONS = {
        chart: `<img src="../icons/svg/chart-analytics.svg" class="icon-img" alt="Gráfico de promedios" style="width:22px;height:22px;">`,
        tasks: `<img src="../icons/svg/tasks-check.svg" class="icon-img" alt="Estado de tareas" style="width:22px;height:22px;">`,
        completed: `<img src="../icons/svg/dot-completed.svg" class="icon-img" alt="Entregadas" style="width:18px;height:18px;">`,
        pending: `<img src="../icons/svg/dot-pending.svg" class="icon-img" alt="Pendientes" style="width:18px;height:18px;">`,
        overdue: `<img src="../icons/svg/dot-overdue.svg" class="icon-img" alt="Vencidas" style="width:18px;height:18px;">`,
        attendance: `<img src="../icons/svg/dot-attendance.svg" class="icon-img" alt="Asistencia" style="width:18px;height:18px;">`
    };

    let apiState = {
        user: null,
        calificaciones: [],
        progreso: null,
        tareasResumen: null
    };

    let dashboardChart = null;
    let tasksDonutChart = null;
    let currentChartType = 'bar';

    function loadScript(src) {
        return new Promise((resolve) => {
            if (document.querySelector(`script[src*="${src}"]`)) {
                resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => resolve();
            document.head.appendChild(s);
        });
    }

    function ensureSuiteAssets() {
        if (!document.querySelector('link[href*="student-suite.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/plataformaestudiante/css/student-suite.css?v=20261019b';
            document.head.appendChild(link);
        }
        return loadScript('/vendor/apexcharts.min.js');
    }

    async function fetchRealStudentApiData() {
        try {
            let user = null;
            if (window.shidellSession?.obtenerUsuario) {
                user = await window.shidellSession.obtenerUsuario();
            }
            if (!user) {
                const raw = localStorage.getItem('shidell_user');
                if (raw) user = JSON.parse(raw);
            }
            if (!user || !user.id) return false;
            apiState.user = user;

            const [calRes, progRes, tarRes] = await Promise.all([
                fetch(`/api/calificaciones/estudiante/${user.id}`).catch(() => null),
                fetch(`/api/progreso/estudiante/${user.id}`).catch(() => null),
                fetch(`/api/tareas/estudiante/${user.id}`).catch(() => null)
            ]);

            if (calRes && calRes.ok) {
                const gData = await calRes.json();
                apiState.calificaciones = Array.isArray(gData) ? gData : (gData.cursos || gData.calificaciones || []);
            }

            if (progRes && progRes.ok) {
                apiState.progreso = await progRes.json();
            }

            if (tarRes && tarRes.ok) {
                const tData = await tarRes.json();
                apiState.tareasResumen = tData.resumen || {
                    total: Array.isArray(tData.tareas) ? tData.tareas.length : 0,
                    pendientes: Array.isArray(tData.tareas) ? tData.tareas.filter(t => t.status === 'Pendiente').length : 0,
                    completadas: Array.isArray(tData.tareas) ? tData.tareas.filter(t => t.status === 'Completada').length : 0,
                    vencidas: Array.isArray(tData.tareas) ? tData.tareas.filter(t => t.status === 'Vencido').length : 0
                };
            }
            return true;
        } catch (err) {
            console.warn('Error consultando endpoints del estudiante:', err);
            return false;
        }
    }

    function getRealCourseChartDataset() {
        const items = [];
        if (Array.isArray(apiState.calificaciones) && apiState.calificaciones.length > 0) {
            apiState.calificaciones.forEach((c) => {
                const name = limpiarTexto(c.nombre || c.cursoNombre || c.curso || 'Curso');
                const avg = Number(c.promedio ?? c.nota ?? 0);
                items.push({
                    name: shortenCourseName(name),
                    avg: Number(avg.toFixed(1))
                });
            });
        } else if (Array.isArray(apiState.progreso?.progresoPorCurso) && apiState.progreso.progresoPorCurso.length > 0) {
            apiState.progreso.progresoPorCurso.forEach((c) => {
                const name = limpiarTexto(c.nombre || c.curso?.nombre || 'Curso');
                const avg = Number(c.promedio ?? 0);
                items.push({
                    name: shortenCourseName(name),
                    avg: Number(avg.toFixed(1))
                });
            });
        }
        return items;
    }

    function shortenCourseName(name) {
        const clean = String(name || 'Curso').trim();
        return clean.length > 18 ? clean.slice(0, 17) + '…' : clean;
    }

    function limpiarTexto(texto) {
        let valor = String(texto || '');
        for (let i = 0; i < 3 && /[\u00C3\u00C2]/.test(valor); i++) {
            try {
                const decodificado = decodeURIComponent(escape(valor));
                if (decodificado === valor) break;
                valor = decodificado;
            } catch {
                break;
            }
        }
        return valor;
    }

    function injectApiAnalyticsSection() {
        const contentArea = document.querySelector('.content-area');
        const panelsRow = document.querySelector('.panels-row');
        // Solo inyectar en el Dashboard principal (portalestudiante.html)
        if (!contentArea || !panelsRow || document.getElementById('api-interactive-dashboard-row')) return;

        const interactiveRow = document.createElement('section');
        interactiveRow.id = 'api-interactive-dashboard-row';
        interactiveRow.className = 'interactive-dashboard-row';
        interactiveRow.innerHTML = `
            <div class="interactive-card">
                <div class="panel-top" style="margin-bottom: 16px;">
                    <div>
                        <h3 class="panel-title">${ICONS.chart} Promedio por Curso (API)</h3>
                        <p class="interactive-card-subtitle">Calificaciones reales registradas por tus docentes en la base de datos</p>
                    </div>
                    <div class="chart-mode-pills">
                        <button type="button" class="chart-mode-pill active" data-chart-mode="bar">Barras</button>
                        <button type="button" class="chart-mode-pill" data-chart-mode="radar">Radar</button>
                    </div>
                </div>
                <div id="student-apex-chart" style="min-height: 270px; width: 100%; display:flex; align-items:center; justify-content:center;"></div>
            </div>

            <div class="interactive-card">
                <div class="panel-top" style="margin-bottom: 14px;">
                    <div>
                        <h3 class="panel-title">${ICONS.tasks} Estado de Entregas y Asistencia</h3>
                        <p class="interactive-card-subtitle">Sincronizado en tiempo real con tus tareas y registro de asistencia</p>
                    </div>
                    <a href="tareas.html" class="panel-link">Ir a tareas →</a>
                </div>
                <div id="student-tasks-api-summary" class="api-tasks-summary-box"></div>
            </div>
        `;

        contentArea.insertBefore(interactiveRow, panelsRow);

        interactiveRow.querySelectorAll('[data-chart-mode]').forEach((pill) => {
            pill.addEventListener('click', () => {
                interactiveRow.querySelectorAll('[data-chart-mode]').forEach((p) => p.classList.remove('active'));
                pill.classList.add('active');
                currentChartType = pill.getAttribute('data-chart-mode');
                renderDashboardChart(currentChartType);
            });
        });

        renderDashboardChart(currentChartType);
        renderTasksAndAttendanceSummary();
    }

    function renderDashboardChart(type = 'bar') {
        const container = document.getElementById('student-apex-chart');
        if (!container) return;

        const dataset = getRealCourseChartDataset();

        if (dashboardChart) {
            dashboardChart.destroy();
            dashboardChart = null;
        }

        if (!dataset.length) {
            container.innerHTML = `
                <div class="api-empty-state">
                    <strong>Sin calificaciones registradas aún</strong>
                    <span>Cuando tus docentes registren notas en el sistema, el gráfico mostrará tus promedios reales por curso.</span>
                </div>
            `;
            return;
        }

        if (typeof window.ApexCharts === 'undefined') return;
        container.innerHTML = '';

        const categories = dataset.map((d) => d.name);
        const values = dataset.map((d) => d.avg);

        const options = {
            chart: {
                type: type === 'radar' ? 'radar' : 'bar',
                height: 270,
                toolbar: { show: false },
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                background: 'transparent'
            },
            colors: ['#144272'],
            series: [
                { name: 'Promedio Registrado', data: values }
            ],
            xaxis: {
                categories: categories,
                labels: {
                    style: {
                        colors: '#4a525d',
                        fontSize: '13.5px',
                        fontWeight: 600
                    }
                }
            },
            yaxis: {
                min: 0,
                max: 20,
                tickAmount: 4,
                labels: {
                    style: {
                        fontSize: '13px',
                        fontWeight: 600
                    }
                }
            },
            plotOptions: {
                bar: {
                    borderRadius: 7,
                    columnWidth: '46%'
                }
            },
            dataLabels: {
                enabled: type !== 'radar',
                style: { fontSize: '13px', fontWeight: 700 }
            },
            stroke: {
                width: type === 'radar' ? 2.5 : 0
            },
            fill: {
                opacity: type === 'radar' ? 0.22 : 0.95
            },
            legend: {
                position: 'top',
                horizontalAlign: 'right',
                fontSize: '14px',
                fontWeight: 600
            }
        };

        dashboardChart = new window.ApexCharts(container, options);
        dashboardChart.render();
    }

    function renderTasksAndAttendanceSummary() {
        const container = document.getElementById('student-tasks-api-summary');
        if (!container) return;

        const resumen = apiState.tareasResumen || {};
        const prog = apiState.progreso || {};

        const pendientes = Number(resumen.pendientes ?? 0);
        const completadas = Number(resumen.completadas ?? prog.tareasCompletadas ?? 0);
        const vencidas = Number(resumen.vencidas ?? 0);
        const totalTareas = Number(resumen.total ?? prog.tareasTotales ?? (pendientes + completadas + vencidas));
        const asistenciaPct = Number(prog.asistenciaPorcentaje ?? 0);
        const rachaDias = Number(prog.rachaDias ?? 0);

        container.innerHTML = `
            <div class="api-summary-layout">
                <div id="api-tasks-donut" style="min-height: 200px; display:flex; align-items:center; justify-content:center;"></div>
                <div class="api-metrics-column">
                    <div class="api-metric-row">
                        ${ICONS.completed}
                        <span class="api-metric-label">Tareas entregadas</span>
                        <strong class="api-metric-value">${completadas} / ${totalTareas}</strong>
                    </div>
                    <div class="api-metric-row">
                        ${ICONS.pending}
                        <span class="api-metric-label">Tareas pendientes</span>
                        <strong class="api-metric-value">${pendientes}</strong>
                    </div>
                    <div class="api-metric-row">
                        ${ICONS.overdue}
                        <span class="api-metric-label">Tareas vencidas</span>
                        <strong class="api-metric-value">${vencidas}</strong>
                    </div>
                    <div class="api-metric-row" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 4px;">
                        ${ICONS.attendance}
                        <span class="api-metric-label">Asistencia registrada</span>
                        <strong class="api-metric-value">${asistenciaPct}% (${rachaDias}d)</strong>
                    </div>
                </div>
            </div>
        `;

        const donutEl = document.getElementById('api-tasks-donut');
        if (!donutEl || typeof window.ApexCharts === 'undefined') return;

        if (tasksDonutChart) {
            tasksDonutChart.destroy();
            tasksDonutChart = null;
        }

        if (totalTareas === 0) {
            donutEl.innerHTML = `
                <div class="api-empty-state" style="padding: 20px;">
                    <strong>0 tareas asignadas</strong>
                    <span>No tienes tareas registradas en este momento.</span>
                </div>
            `;
            return;
        }

        tasksDonutChart = new window.ApexCharts(donutEl, {
            chart: {
                type: 'donut',
                height: 210,
                fontFamily: "'Plus Jakarta Sans', sans-serif"
            },
            series: [completadas, pendientes, vencidas],
            labels: ['Entregadas', 'Pendientes', 'Vencidas'],
            colors: ['#157347', '#b45309', '#b91c1c'],
            dataLabels: { enabled: false },
            legend: { show: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '68%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Total',
                                fontSize: '13.5px',
                                fontWeight: 600,
                                color: '#4a525d',
                                formatter: () => String(totalTareas)
                            },
                            value: {
                                fontSize: '24px',
                                fontWeight: 800,
                                color: '#14171a'
                            }
                        }
                    }
                }
            }
        });
        tasksDonutChart.render();
    }

    async function initStudentSuite() {
        document.body?.classList.remove('shidell-dark');
        // Remover cualquier botón residual si existiera en el DOM
        document.querySelector('.student-QuickTools')?.remove();
        document.getElementById('student-gamification-bar')?.remove();
        document.getElementById('study-hub-overlay')?.remove();

        if (!window.location.pathname.toLowerCase().includes('plataformaestudiante')) return;
        // Solo cargar gráficos en el dashboard principal donde existe .panels-row
        if (!document.querySelector('.panels-row')) return;

        await ensureSuiteAssets();
        await fetchRealStudentApiData();
        injectApiAnalyticsSection();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStudentSuite);
    } else {
        initStudentSuite();
    }
})();
