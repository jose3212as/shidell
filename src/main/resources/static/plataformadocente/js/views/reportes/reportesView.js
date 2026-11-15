import { Auth } from '../../services/auth.js';
import { API } from '../../services/api.js';

export const ReportesView = {
    charts: {},
    _onThemeChanged: null,

    getChartTheme() {
        const isLight = document.documentElement.dataset.theme === 'light';
        return {
            legendColor: isLight ? '#111318' : '#CBD5E1',
            tickColor: isLight ? '#475467' : '#9CA7B8',
            gridColorX: isLight ? 'rgba(17, 19, 24, 0.05)' : 'rgba(255, 255, 255, 0.04)',
            gridColorY: isLight ? 'rgba(17, 19, 24, 0.09)' : 'rgba(255, 255, 255, 0.08)',
            rendimientoColors: isLight ? ['#16a34a', '#dc2626'] : ['#22c55e', '#ef4444'],
            emptyColor: isLight ? ['rgba(15, 23, 42, 0.16)'] : ['rgba(148, 163, 184, 0.28)'],
            asistenciaColors: isLight ? ['#1d4ed8', '#d97706', '#dc2626'] : ['#60a5fa', '#fbbf24', '#f87171']
        };
    },

    bindThemeListener() {
        if (this._onThemeChanged) {
            window.removeEventListener('shidell:theme-changed', this._onThemeChanged);
        }
        this._onThemeChanged = () => {
            const palette = this.getChartTheme();
            if (this.charts.rendimiento && this.charts.rendimiento.canvas?.isConnected) {
                const isEmpty = this.charts.rendimiento._sinNotas === true;
                this.charts.rendimiento.data.datasets[0].backgroundColor = isEmpty
                    ? palette.emptyColor
                    : palette.rendimientoColors;
                this.charts.rendimiento.options.plugins.legend.labels.color = palette.legendColor;
                this.charts.rendimiento.update();
            }
            if (this.charts.asistencia && this.charts.asistencia.canvas?.isConnected) {
                this.charts.asistencia.data.datasets[0].backgroundColor = palette.asistenciaColors;
                this.charts.asistencia.options.scales.x.ticks.color = palette.tickColor;
                this.charts.asistencia.options.scales.x.grid.color = palette.gridColorX;
                this.charts.asistencia.options.scales.y.ticks.color = palette.tickColor;
                this.charts.asistencia.options.scales.y.grid.color = palette.gridColorY;
                this.charts.asistencia.update();
            }
        };
        window.addEventListener('shidell:theme-changed', this._onThemeChanged);
    },

    async render() {
        return `
            <div class="content-header" style="margin-bottom:20px;">
                <div>
                    <h2>Reportes y Estadísticas</h2>
                    <p>Analiza el rendimiento y asistencia de tus cursos.</p>
                </div>
            </div>

            <div class="reports-container">
                <!-- Selector -->
                <div class="reports-filter">
                    <label for="report-curso"><i class="ph ph-books"></i> Curso:</label>
                    <select id="report-curso">
                        <option value="">Cargando cursos...</option>
                    </select>
                </div>

                <!-- Resumen KPIs -->
                <div class="reports-kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-icon blue"><i class="ph ph-users"></i></div>
                        <div class="kpi-info">
                            <span>Total Estudiantes</span>
                            <strong id="kpi-estudiantes">-</strong>
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon green"><i class="ph ph-graduation-cap"></i></div>
                        <div class="kpi-info">
                            <span>Promedio del Salón</span>
                            <strong id="kpi-promedio">-</strong>
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon orange"><i class="ph ph-check-circle"></i></div>
                        <div class="kpi-info">
                            <span>Tasa de Asistencia</span>
                            <strong id="kpi-asistencia">-</strong>
                        </div>
                    </div>
                </div>

                <!-- Gráficos -->
                <div class="reports-charts-grid" id="charts-area" style="display:none;">
                    <div class="chart-card">
                        <h3><i class="ph ph-chart-pie"></i> Rendimiento (Aprobados vs Desaprobados)</h3>
                        <div class="chart-container">
                            <canvas id="chart-rendimiento"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <h3><i class="ph ph-chart-bar"></i> Resumen de Asistencias</h3>
                        <div class="chart-container">
                            <canvas id="chart-asistencia"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Empty State -->
                <div id="reports-empty" class="reports-empty">
                    <i class="ph ph-chart-polar"></i>
                    <h3>Selecciona un curso</h3>
                    <p>Elige un curso en la parte superior para visualizar sus estadísticas.</p>
                </div>
            </div>
        `;
    },

    async afterRender() {
        this.user = Auth.getUser();
        this.el = {
            select: document.getElementById('report-curso'),
            kpiEst: document.getElementById('kpi-estudiantes'),
            kpiProm: document.getElementById('kpi-promedio'),
            kpiAsis: document.getElementById('kpi-asistencia'),
            chartsArea: document.getElementById('charts-area'),
            emptyState: document.getElementById('reports-empty')
        };

        this.bindEvents();
        await this.cargarCursos();
    },

    bindEvents() {
        this.el.select.addEventListener('change', () => this.cargarReportes());
    },

    async cargarCursos() {
        try {
            const cursosCrudos = await API.fetch(`/api/docente/${this.user.id}/cursos`);
            const unicos = [];
            const seen = new Set();
            (Array.isArray(cursosCrudos) ? cursosCrudos : []).forEach(c => {
                const key = `${c.nombre || ''}|${c.nivel || ''}|${c.grado || ''}|${c.seccion || ''}|${c.turno || ''}`.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    unicos.push(c);
                }
            });

            unicos.sort((a, b) => {
                const cmpNivel = String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es');
                if (cmpNivel !== 0) return cmpNivel;
                const cmpGrado = Number(a.grado || 0) - Number(b.grado || 0);
                if (cmpGrado !== 0) return cmpGrado;
                const cmpSecc = String(a.seccion || '').localeCompare(String(b.seccion || ''), 'es');
                if (cmpSecc !== 0) return cmpSecc;
                return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
            });

            if (unicos.length === 0) {
                this.el.select.innerHTML = '<option value="">No tienes cursos asignados</option>';
                return;
            }

            const formatCourseOption = (c) => {
                const grado = c.grado ? `${c.grado}°` : '';
                const seccion = c.seccion ? String(c.seccion).trim() : '';
                const aula = [grado, seccion].filter(Boolean).join(' ');
                const nivelRaw = String(c.nivel || '').trim();
                const nivel = nivelRaw
                    ? nivelRaw.charAt(0).toUpperCase() + nivelRaw.slice(1).toLowerCase()
                    : '';
                const detalle = [aula, nivel].filter(Boolean).join(' · ');
                return detalle ? `${c.nombre} — ${detalle}` : (c.nombre || `Curso ${c.id}`);
            };

            this.el.select.innerHTML = '<option value="">-- Selecciona un Curso --</option>' +
                unicos.map(c => `<option value="${c.id}">${formatCourseOption(c)}</option>`).join('');

            const hash = window.location.hash || '';
            const qIdx = hash.indexOf('?');
            const preCurso = qIdx !== -1 ? new URLSearchParams(hash.slice(qIdx + 1)).get('curso') : null;
            if (preCurso && unicos.some(c => String(c.id) === String(preCurso))) {
                this.el.select.value = String(preCurso);
                await this.cargarReportes(String(preCurso));
            }
        } catch (e) {
            console.error("Error al cargar cursos para reportes:", e);
            this.el.select.innerHTML = '<option value="">Error al cargar cursos</option>';
        }
    },

    async cargarReportes() {
        const cursoId = this.el.select.value;
        if (!cursoId) {
            this.el.chartsArea.style.display = 'none';
            this.el.emptyState.style.display = 'block';
            this.limpiarKPIs();
            return;
        }

        try {
            this.el.emptyState.style.display = 'none';
            this.el.chartsArea.style.display = 'grid';
            
            // Mostrar estado de carga en KPIs
            this.el.kpiEst.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
            this.el.kpiProm.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
            this.el.kpiAsis.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';

            const [calificaciones, asistenciaData] = await Promise.all([
                API.fetch(`/api/docente/curso/${cursoId}/calificaciones`),
                API.fetch(`/api/docente/curso/${cursoId}/asistencia`)
            ]);

            this.procesarReportes(calificaciones, asistenciaData);
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudieron cargar los datos del curso', 'error');
            this.limpiarKPIs();
        }
    },

    limpiarKPIs() {
        this.el.kpiEst.textContent = '-';
        this.el.kpiProm.textContent = '-';
        this.el.kpiAsis.textContent = '-';
    },

    procesarReportes(calificaciones, asistenciaData) {
        // 1. Rendimiento
        let totalEstudiantes = new Set();
        let sumaNotas = 0;
        let cantNotas = 0;
        
        let aprobados = 0;
        let desaprobados = 0;

        // Evaluamos promedio por estudiante
        const notasPorEstudiante = {};

        calificaciones.forEach(c => {
            if (c.estudiante && c.estudiante.id) {
                totalEstudiantes.add(c.estudiante.id);
                if (c.nota !== undefined && c.nota !== null) {
                    const nota = parseFloat(c.nota);
                    if (!isNaN(nota)) {
                        sumaNotas += nota;
                        cantNotas++;
                        
                        if (!notasPorEstudiante[c.estudiante.id]) {
                            notasPorEstudiante[c.estudiante.id] = { suma: 0, count: 0 };
                        }
                        notasPorEstudiante[c.estudiante.id].suma += nota;
                        notasPorEstudiante[c.estudiante.id].count++;
                    }
                }
            }
        });

        // Contar aprobados vs desaprobados (nota >= 11)
        Object.values(notasPorEstudiante).forEach(est => {
            const prom = est.suma / est.count;
            if (prom >= 11) aprobados++;
            else desaprobados++;
        });

        const promGeneral = cantNotas > 0 ? (sumaNotas / cantNotas).toFixed(1) : '—';

        // 2. Asistencia
        const listaAsistencia = (asistenciaData && Array.isArray(asistenciaData.estudiantes)) ? asistenciaData.estudiantes : [];
        let presente = 0;
        let ausente = 0;
        let tardanza = 0;

        listaAsistencia.forEach(a => {
            if (a.estudianteId) totalEstudiantes.add(a.estudianteId);
            const estadoNorm = String(a.estado || '').trim().toUpperCase();
            if (estadoNorm === 'PRESENTE' || estadoNorm === 'JUSTIFICADO') presente++;
            else if (estadoNorm === 'AUSENTE') ausente++;
            else if (estadoNorm === 'TARDE' || estadoNorm === 'TARDANZA') tardanza++;
        });

        const nEstudiantes = totalEstudiantes.size || listaAsistencia.length || (aprobados + desaprobados);
        const totalAsis = presente + ausente + tardanza;
        const tasaAsis = totalAsis > 0 ? Math.round((presente / totalAsis) * 100) : 0;

        // 3. Actualizar KPIs
        this.el.kpiEst.textContent = String(nEstudiantes || 0);
        this.el.kpiProm.textContent = promGeneral;
        this.el.kpiAsis.textContent = totalAsis > 0 ? `${tasaAsis}%` : '—';

        // 4. Dibujar Gráficos
        this.dibujarGraficoRendimiento(aprobados, desaprobados);
        this.dibujarGraficoAsistencia(presente, ausente, tardanza);
    },

    dibujarGraficoRendimiento(aprobados, desaprobados) {
        if (this.charts.rendimiento) this.charts.rendimiento.destroy();
        this.bindThemeListener();

        const palette = this.getChartTheme();
        const sinNotas = aprobados === 0 && desaprobados === 0;
        const ctx = document.getElementById('chart-rendimiento').getContext('2d');
        this.charts.rendimiento = new Chart(ctx, {
            type: 'doughnut',
            data: sinNotas ? {
                labels: ['Sin calificaciones registradas'],
                datasets: [{
                    data: [1],
                    backgroundColor: palette.emptyColor,
                    borderWidth: 0
                }]
            } : {
                labels: ['Aprobados (>=11)', 'Desaprobados (<11)'],
                datasets: [{
                    data: [aprobados, desaprobados],
                    backgroundColor: palette.rendimientoColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    tooltip: { enabled: !sinNotas },
                    legend: {
                        position: 'bottom',
                        labels: { color: palette.legendColor, padding: 16 }
                    }
                }
            }
        });
        this.charts.rendimiento._sinNotas = sinNotas;
    },

    dibujarGraficoAsistencia(presente, ausente, tardanza) {
        if (this.charts.asistencia) this.charts.asistencia.destroy();
        this.bindThemeListener();

        const palette = this.getChartTheme();
        const ctx = document.getElementById('chart-asistencia').getContext('2d');
        this.charts.asistencia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Presentes', 'Tardanzas', 'Ausentes'],
                datasets: [{
                    label: 'Registros',
                    data: [presente, tardanza, ausente],
                    backgroundColor: palette.asistenciaColors,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: palette.tickColor },
                        grid: { color: palette.gridColorX }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: palette.tickColor },
                        grid: { color: palette.gridColorY }
                    }
                }
            }
        });
    }
};
