package org.example.shidell.controller;

import org.example.shidell.model.entity.*;
import org.example.shidell.repository.*;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.util.TextUtils;
import org.example.shidell.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@RestController
@RequestMapping("/api/progreso")
@CrossOrigin(origins = "*")
public class ProgresoController {

    private static final List<LocalDate> INICIOS_BLOQUES_LECTIVOS_2026 = List.of(
        LocalDate.of(2026, 3, 16),
        LocalDate.of(2026, 5, 25),
        LocalDate.of(2026, 8, 10),
        LocalDate.of(2026, 10, 19)
    );
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired
    private CalificacionRepository calificacionRepository;
    @Autowired
    private TareaRepository tareaRepository;
    @Autowired
    private EntregaRepository entregaRepository;
    @Autowired
    private AsistenciaRepository asistenciaRepository;
    @Autowired
    private EntityMapper mapper;
    @GetMapping("/estudiante/{id}")
    public Map<String, Object> getProgresoEstudiante(@PathVariable("id") Long id) {
        UserEntity estudiante = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        
        List<Calificacion> calificaciones = calificacionRepository.findByEstudianteId(id);
        List<Asistencia> asistencias = asistenciaRepository.findByEstudiante(estudiante);
        List<Tarea> tareasSeccion = tareaRepository.findByGrupoAcademico(
            estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion(), estudiante.getTurno());
        List<Entrega> entregas = entregaRepository.findByEstudiante(estudiante);

        List<Curso> cursosEstudiante = cursoRepository.findByGrupoAcademico(
                estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion(), estudiante.getTurno());

        Map<String, Object> res = new HashMap<>();
        res.put("estudiante", mapper.toDTO(estudiante));
        res.put("promedioGeneral", redondear(promedioNotas(calificaciones)));
        
        long completadas = entregas.stream().map(e -> e.getTarea().getId()).distinct().count();
        res.put("tareasTotales", tareasSeccion.size());
        res.put("tareasCompletadas", completadas);

        long presentes = asistencias.stream().filter(this::cuentaComoAsistencia).count();
        double asistenciaPct = asistencias.isEmpty() ? 100.0 : (double) presentes / asistencias.size() * 100.0;
        res.put("asistenciaPorcentaje", Math.round(asistenciaPct));

        Map<String, Object> racha = calcularRacha(asistencias);
        res.putAll(racha);

        long entregasSemana = entregas.stream()
                .filter(e -> e.getFechaEntrega() != null && e.getFechaEntrega().isAfter(LocalDateTime.now().minusWeeks(1)))
                .count();
        long asistenciasSemana = asistencias.stream()
                .filter(a -> a.getFecha() != null && !a.getFecha().isBefore(LocalDate.now().minusDays(6)))
                .filter(this::cuentaComoAsistencia)
                .count();
        res.put("horasEstudioSemana", redondear(entregasSemana * 1.5 + asistenciasSemana * 0.5));
        res.put("mejoradoPuntos", 0.0);
        res.put("cursosTotales", cursosEstudiante.size());
        res.put("cursosActivos", cursosEstudiante.size());
        res.put("logrosRecientes", construirLogros(completadas, totalTareasPorCurso(tareasSeccion), asistenciaPct, calificaciones));
        res.put("tendenciaProgreso", construirTendencia(calificaciones));

        res.put("progresoPorCurso", construirProgresoCursos(cursosEstudiante, tareasSeccion, entregas, calificaciones));
        return res;
    }

    private List<Map<String, Object>> construirProgresoCursos(List<Curso> cursos, List<Tarea> tareas, List<Entrega> entregas, List<Calificacion> califs) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Curso c : cursos) {
            Map<String, Object> m = new HashMap<>();
            m.put("curso", mapper.toDTO(c));
            m.put("id", c.getId());
            m.put("nombre", TextUtils.limpiarTexto(c.getNombre()));
            m.put("icono", c.getIcono());
            m.put("color", c.getColor());
            m.put("porcentaje", calcularPorcentaje(c, tareas, entregas));
            m.put("promedio", redondear(califs.stream()
                    .filter(calificacion -> calificacion.getCurso() != null && calificacion.getCurso().getId().equals(c.getId()))
                    .map(Calificacion::getNota)
                    .filter(Objects::nonNull)
                    .mapToDouble(Double::doubleValue)
                    .average()
                    .orElse(0.0)));
            list.add(m);
        }
        return list;
    }

    private int calcularPorcentaje(Curso c, List<Tarea> tareas, List<Entrega> entregas) {
        long total = tareas.stream().filter(t -> t.getCurso().getId().equals(c.getId())).count();
        if (total == 0) return 0;
        long done = entregas.stream().filter(e -> e.getTarea().getCurso().getId().equals(c.getId())).count();
        return (int) Math.round((double) done / total * 100.0);
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

    private List<Map<String, Object>> construirLogros(long completadas, Map<Long, Long> tareasPorCurso, double asistenciaPct, List<Calificacion> calificaciones) {
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
        List<Map<String, Object>> puntos = new ArrayList<>();
        int limite = Math.min(calificaciones.size(), 6);

        for (int i = calificaciones.size() - limite; i < calificaciones.size(); i++) {
            Calificacion calificacion = calificaciones.get(i);
            Map<String, Object> punto = new HashMap<>();
            double nota = calificacion.getNota() == null ? 0.0 : calificacion.getNota();
            punto.put("label", "N" + (puntos.size() + 1));
            punto.put("valor", redondear(nota));
            punto.put("porcentaje", Math.round((nota / 20.0) * 100.0));
            puntos.add(punto);
        }
        return puntos;
    }

    private boolean cuentaComoAsistencia(Asistencia a) {
        return a != null && a.getEstado() != null && (a.getEstado().equalsIgnoreCase("PRESENTE") || a.getEstado().equalsIgnoreCase("TARDE"));
    }

    private double promedioNotas(List<Calificacion> calificaciones) {
        return calificaciones.stream()
                .map(Calificacion::getNota)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
    }

    private double redondear(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
