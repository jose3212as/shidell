package org.example.shidell.service;

import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.entity.*;
import org.example.shidell.repository.*;
import org.example.shidell.util.AcademicCalendarUtil;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.CourseProgressHelper;
import org.example.shidell.util.GradeCalculationHelper;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Calcula métricas de progreso académico, asistencia, rachas y logros del estudiante.
 */
@Service
public class ProgresoService {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;
    @Autowired
    private CalificacionRepository calificacionRepository;
    @Autowired
    private TareaRepository tareaRepository;
    @Autowired
    private AsistenciaService asistenciaService;
    @Autowired
    private EntregaRepository entregaRepository;
    @Autowired(required = false)
    private ForoSemanaMensajeRepository foroSemanaMensajeRepository;
    @Autowired
    private EntityMapper mapper;

    public Map<String, Object> getProgresoEstudiante(Long id) {
        return getProgresoEstudiante(id, null);
    }

    public Map<String, Object> getProgresoEstudiante(Long id, UserEntity authUser) {
        UserEntity estudiante = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        if (authUser != null) {
            AccessControlHelper.requireStudentAccess(
                    authUser,
                    estudiante,
                    cursoRepository,
                    matriculaRepository,
                    "No tienes permiso para ver el progreso de este estudiante."
            );
        }

        List<Calificacion> calificaciones = calificacionRepository.findByEstudianteId(id);
        List<Asistencia> asistencias = asistenciaService.getAsistenciasCompletas(estudiante);
        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);

        List<Tarea> tareasSeccion = tareaRepository.findByGrupoAcademico(
                grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno());
        List<Entrega> entregas = entregaRepository.findByEstudiante(estudiante);
        List<Curso> cursosEstudiante = cursoRepository.findByGrupoAcademico(
                grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno());

        Map<String, Object> res = new HashMap<>();
        res.put("estudiante", mapper.toDTO(estudiante));
        res.put("promedioGeneral", redondear(promedioNotas(calificaciones)));

        long completadas = entregas.stream().map(e -> e.getTarea().getId()).distinct().count();
        res.put("tareasTotales", tareasSeccion.size());
        res.put("tareasCompletadas", completadas);

        long presentes = asistencias.stream().filter(this::cuentaComoAsistencia).count();
        double asistenciaPct = asistencias.isEmpty() ? 100.0 : (double) presentes / asistencias.size() * 100.0;
        res.put("asistenciaPorcentaje", Math.round(asistenciaPct));

        res.putAll(calcularRacha(asistencias));

        long entregasSemana = entregas.stream()
                .filter(e -> e.getFechaEntrega() != null && e.getFechaEntrega().isAfter(LocalDateTime.now().minusWeeks(1)))
                .count();
        long asistenciasSemana = asistencias.stream()
                .filter(a -> a.getFecha() != null && !a.getFecha().isBefore(LocalDate.now().minusDays(6)))
                .filter(this::cuentaComoAsistencia)
                .count();
        res.put("horasEstudioSemana", redondear(entregasSemana * 1.5 + asistenciasSemana * 0.5));
        res.put("mejoradoPuntos", 0.0);

        long cursosUnicosCount = cursosEstudiante.stream()
                .map(c -> TextUtils.normalizar(c.getNombre()))
                .distinct()
                .count();

        res.put("cursosTotales", (int) cursosUnicosCount);
        res.put("cursosActivos", (int) cursosUnicosCount);
        res.put("logrosRecientes", construirLogros(completadas, totalTareasPorCurso(tareasSeccion), asistenciaPct, calificaciones));
        res.put("tendenciaProgreso", construirTendencia(calificaciones));
        res.put("progresoPorCurso", construirProgresoCursos(id, cursosEstudiante, tareasSeccion, entregas, calificaciones));
        return res;
    }

    private List<Map<String, Object>> construirProgresoCursos(
            Long estudianteId, List<Curso> cursos, List<Tarea> tareas, List<Entrega> entregas, List<Calificacion> califs) {
        List<Map<String, Object>> list = new ArrayList<>();
        Set<Long> tareasEntregadasIds = entregas.stream()
                .map(Entrega::getTarea)
                .filter(Objects::nonNull)
                .map(Tarea::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, List<ForoSemanaMensaje>> forosPorCursoId =
                CourseProgressHelper.cargarForosPorCursoId(cursos, foroSemanaMensajeRepository);

        Map<String, List<Curso>> cursosPorMateria = new LinkedHashMap<>();
        for (Curso c : cursos) {
            cursosPorMateria.computeIfAbsent(TextUtils.normalizar(c.getNombre()), k -> new ArrayList<>()).add(c);
        }

        LocalDate hoy = LocalDate.now();
        for (Map.Entry<String, List<Curso>> entry : cursosPorMateria.entrySet()) {
            String key = entry.getKey();
            List<Curso> grupoCursos = entry.getValue();
            Curso c = grupoCursos.get(0);

            CourseProgressHelper.WeeklyProgressSummary summary = CourseProgressHelper.calcularProgresoMateria(
                    estudianteId, key, grupoCursos, tareas, tareasEntregadasIds, forosPorCursoId,
                    AcademicCalendarUtil.TOTAL_SEMANAS, hoy);

            Map<String, Object> m = new HashMap<>();
            m.put("curso", mapper.toDTO(c));
            m.put("id", c.getId());
            m.put("nombre", TextUtils.limpiarTexto(c.getNombre()));
            m.put("icono", c.getIcono());
            m.put("color", c.getColor());
            m.put("porcentaje", summary.porcentajeAvance());
            m.put("semanasCompletadas", summary.semanasCompletadas());
            m.put("semanasTotales", summary.totalSemanas());
            m.put("semanasConActividades", summary.semanasConActividades());
            List<Calificacion> califsMateria = califs.stream()
                    .filter(calif -> calif.getCurso() != null && TextUtils.normalizar(calif.getCurso().getNombre()).equals(key))
                    .toList();
            m.put("promedio", redondear(GradeCalculationHelper.promedioPonderadoNota20(califsMateria)));
            list.add(m);
        }
        return list;
    }

    private Map<String, Object> calcularRacha(List<Asistencia> asistencias) {
        TreeSet<LocalDate> fechas = new TreeSet<>();
        asistencias.stream().filter(this::cuentaComoAsistencia).forEach(a -> fechas.add(a.getFecha()));

        int racha = 0;
        if (!fechas.isEmpty()) {
            LocalDate cursor = fechas.last();
            while (fechas.contains(cursor)) {
                racha++;
                cursor = cursor.minusDays(1);
            }
        }
        return Map.of(
                "rachaDias", racha,
                "mejorRacha", racha,
                "diasSemana", construirDiasSemana(fechas)
        );
    }

    private List<Map<String, Object>> construirDiasSemana(Set<LocalDate> fechasAsistencia) {
        LocalDate lunes = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<String> labels = List.of("L", "M", "M", "J", "V", "S", "D");
        List<Map<String, Object>> dias = new ArrayList<>();

        for (int i = 0; i < 7; i++) {
            LocalDate fecha = lunes.plusDays(i);
            Map<String, Object> dia = new HashMap<>();
            dia.put("label", labels.get(i));
            dia.put("fecha", fecha.toString());
            dia.put("asistio", fechasAsistencia.contains(fecha));
            dias.add(dia);
        }
        return dias;
    }

    private Map<Long, Long> totalTareasPorCurso(List<Tarea> tareas) {
        Map<Long, Long> totales = new HashMap<>();
        for (Tarea tarea : tareas) {
            if (tarea.getCurso() == null) continue;
            Long cursoId = tarea.getCurso().getId();
            totales.put(cursoId, totales.getOrDefault(cursoId, 0L) + 1);
        }
        return totales;
    }

    private List<Map<String, Object>> construirLogros(
            long completadas, Map<Long, Long> tareasPorCurso, double asistenciaPct, List<Calificacion> calificaciones) {
        List<Map<String, Object>> logros = new ArrayList<>();
        double promedio = promedioNotas(calificaciones);

        if (completadas > 0) {
            logros.add(logro("Tareas al dia", "Tienes " + completadas + " entregas registradas.", "ph-check-circle", "green"));
        }
        if (asistenciaPct >= 90.0) {
            logros.add(logro("Buena asistencia", "Mantienes " + Math.round(asistenciaPct) + "% de asistencia.", "ph-calendar-check", "blue"));
        }
        if (promedio >= 14.0) {
            logros.add(logro("Promedio destacado", "Tu promedio general es " + redondear(promedio) + "/20.", "ph-star", "yellow"));
        }
        if (logros.isEmpty() && !tareasPorCurso.isEmpty()) {
            logros.add(logro("Cursos activos", "Ya puedes revisar el avance de tus cursos.", "ph-books", "purple"));
        }
        return logros;
    }

    private Map<String, Object> logro(String titulo, String descripcion, String icono, String color) {
        Map<String, Object> logro = new HashMap<>();
        logro.put("titulo", titulo);
        logro.put("descripcion", descripcion);
        logro.put("icono", icono);
        logro.put("color", color);
        logro.put("tiempo", "Actualizado");
        return logro;
    }

    private List<Map<String, Object>> construirTendencia(List<Calificacion> calificaciones) {
        if (calificaciones.isEmpty()) return List.of();
        List<Calificacion> ordenadas = calificaciones.stream()
                .filter(c -> c != null && c.getNota() != null)
                .sorted(Comparator.comparing((Calificacion c) -> c.getFecha() == null ? LocalDate.MIN : c.getFecha())
                        .thenComparing(c -> c.getId() == null ? 0L : c.getId()))
                .toList();
        if (ordenadas.isEmpty()) return List.of();
        List<Map<String, Object>> puntos = new ArrayList<>();
        int limite = Math.min(ordenadas.size(), 6);

        for (int i = ordenadas.size() - limite; i < ordenadas.size(); i++) {
            Calificacion calificacion = ordenadas.get(i);
            Map<String, Object> punto = new HashMap<>();
            double nota20 = GradeCalculationHelper.notaSobre20(calificacion);
            punto.put("label", "N" + (puntos.size() + 1));
            punto.put("valor", redondear(nota20));
            punto.put("porcentaje", Math.round((nota20 / GradeCalculationHelper.NOTA_MAXIMA_VIGESIMAL) * 100.0));
            puntos.add(punto);
        }
        return puntos;
    }

    private boolean cuentaComoAsistencia(Asistencia a) {
        if (a == null || a.getEstado() == null) return false;
        String estado = a.getEstado().trim().toUpperCase(Locale.ROOT);
        return "PRESENTE".equals(estado) || "TARDE".equals(estado) || "JUSTIFICADO".equals(estado);
    }

    private double promedioNotas(List<Calificacion> calificaciones) {
        return GradeCalculationHelper.promedioPonderadoNota20(calificaciones);
    }

    private double redondear(double v) {
        return GradeCalculationHelper.redondear1(v);
    }
}
