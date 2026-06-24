import { Auth } from '../../services/auth.js';
import { API } from '../../services/api.js';

export const ReportesView = {
    charts: {},

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
            const cursos = await API.fetch(`/api/docente/${this.user.id}/cursos`);
            if (!cursos || cursos.length === 0) {
                this.el.select.innerHTML = '<option value="">No tienes cursos asignados</option>';
                return;
            }

            this.el.select.innerHTML = '<option value="">-- Selecciona un Curso --</option>' + 
                cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
            
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

        const promGeneral = cantNotas > 0 ? (sumaNotas / cantNotas).toFixed(1) : 0;
        const nEstudiantes = totalEstudiantes.size || aprobados + desaprobados;

        // 2. Asistencia
        let presente = 0;
        let ausente = 0;
        let tardanza = 0;

        const listaAsistencia = asistenciaData.estudiantes || [];
        listaAsistencia.forEach(a => {
            if (a.estado === 'PRESENTE') presente++;
            else if (a.estado === 'AUSENTE') ausente++;
            else if (a.estado === 'TARDANZA') tardanza++;
        });

        const totalAsis = presente + ausente + tardanza;
        const tasaAsis = totalAsis > 0 ? Math.round((presente / totalAsis) * 100) : 0;

        // 3. Actualizar KPIs
        this.el.kpiEst.textContent = nEstudiantes || '0';
        this.el.kpiProm.textContent = promGeneral;
        this.el.kpiAsis.textContent = tasaAsis + '%';

        // 4. Dibujar Gráficos
        this.dibujarGraficoRendimiento(aprobados, desaprobados);
        this.dibujarGraficoAsistencia(presente, ausente, tardanza);
    },

    dibujarGraficoRendimiento(aprobados, desaprobados) {
        if (this.charts.rendimiento) this.charts.rendimiento.destroy();

        const ctx = document.getElementById('chart-rendimiento').getContext('2d');
        this.charts.rendimiento = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Aprobados (>=13)', 'Desaprobados (<13)'],
                datasets: [{
                    data: [aprobados, desaprobados],
                    backgroundColor: ['#22c55e', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    },

    dibujarGraficoAsistencia(presente, ausente, tardanza) {
        if (this.charts.asistencia) this.charts.asistencia.destroy();

        const ctx = document.getElementById('chart-asistencia').getContext('2d');
        this.charts.asistencia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Presentes', 'Tardanzas', 'Ausentes'],
                datasets: [{
                    label: 'Registros',
                    data: [presente, tardanza, ausente],
                    backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444'],
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
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }
};
