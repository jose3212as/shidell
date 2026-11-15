package org.example.shidell.service;

import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.CalificacionDTO;
import org.example.shidell.model.entity.Calificacion;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Evaluacion;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CalificacionRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.EvaluacionRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.GradeCalculationHelper;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.*;

/**
 * Lógica de negocio para cálculo de promedios, resúmenes y registro de calificaciones.
 */
@Service
public class CalificacionService {

    @Autowired
    private CalificacionRepository calificacionRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;
    @Autowired(required = false)
    private EvaluacionRepository evaluacionRepository;
    @Autowired(required = false)
    private NotificacionService notificacionService;
    @Autowired
    private EntityMapper mapper;

    public Map<String, Object> getCalificacionesByEstudiante(Long estudianteId) {
        return getCalificacionesByEstudiante(estudianteId, null);
    }

    public Map<String, Object> getCalificacionesByEstudiante(Long estudianteId, UserEntity authUser) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        if (authUser != null) {
            AccessControlHelper.requireStudentAccess(
                    authUser,
                    estudiante,
                    cursoRepository,
                    matriculaRepository,
                    "No tienes permiso para ver las calificaciones de este estudiante."
            );
        }

        List<Calificacion> calificaciones = calificacionRepository.findByEstudianteId(estudianteId);
        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);
        List<Curso> cursos = AcademicGroupHelper.preferActiveCourses(
                cursoRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno()));

        List<CalificacionDTO> evaluaciones = calificaciones.stream()
                .sorted(Comparator.comparing((Calificacion c) -> c.getFecha() == null ? LocalDate.MIN : c.getFecha()).reversed())
                .map(mapper::toDTO)
                .toList();

        List<Map<String, Object>> cursosResumen = construirCursosResumen(cursos, calificaciones);
        double promedio = promedioNota20(calificaciones);
        long aprobados = cursosResumen.stream()
                .filter(c -> !Objects.equals("Sin notas", c.get("estado"))
                        && ((Number) c.getOrDefault("promedio", 0)).doubleValue() >= GradeCalculationHelper.NOTA_APROBATORIA)
                .count();
        boolean tieneEvaluaciones = calificaciones.stream().anyMatch(c -> c.getNota() != null);

        Map<String, Object> res = new HashMap<>();
        res.put("estudiante", mapper.toDTO(estudiante));
        res.put("evaluaciones", evaluaciones);
        res.put("evaluacionesProgramadas", construirEvaluacionesProgramadas(cursos, calificaciones));
        res.put("cursos", cursosResumen);
        res.put("promedioGeneral", redondear(promedio));
        res.put("cursosTotales", cursosResumen.size());
        res.put("cursosAprobados", aprobados);
        res.put("mejoraPromedio", calcularMejora(calificaciones));
        res.put("distribucion", construirDistribucion(calificaciones));
        res.put("evaluacionesTotales", evaluaciones.size());
        res.put("mensaje", construirMensaje(tieneEvaluaciones, promedio));
        return res;
    }

    public Optional<CalificacionDTO> createCalificacion(Calificacion datos) {
        return createCalificacion(datos, null);
    }

    public Optional<CalificacionDTO> createCalificacion(Calificacion datos, UserEntity authUser) {
        if (datos == null || datos.getEstudiante() == null || datos.getEstudiante().getId() == null
                || datos.getCurso() == null || datos.getCurso().getId() == null) {
            return Optional.empty();
        }

        UserEntity estudiante = userRepository.findById(datos.getEstudiante().getId()).orElseThrow();
        Curso curso = cursoRepository.findById(datos.getCurso().getId()).orElseThrow();
        if (authUser != null) {
            AccessControlHelper.requireCourseOwnerOrAdmin(authUser, curso);
        }

        double notaMaxima = datos.getNotaMaxima() == null ? GradeCalculationHelper.NOTA_MAXIMA_VIGESIMAL : datos.getNotaMaxima();
        if (Double.isNaN(notaMaxima) || Double.isInfinite(notaMaxima) || notaMaxima <= 0.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nota máxima debe ser mayor a 0.");
        }
        if (datos.getNota() != null) {
            double nota = datos.getNota();
            if (Double.isNaN(nota) || Double.isInfinite(nota) || nota < 0.0 || nota > notaMaxima) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "La nota debe estar entre 0 y " + notaMaxima + "."
                );
            }
        } else if (authUser != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debes especificar una calificación válida.");
        }

        if ((authUser != null || AcademicGroupHelper.resolve(estudiante, matriculaRepository).isComplete())
                && !AccessControlHelper.sameAcademicGroup(estudiante, curso, matriculaRepository)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El estudiante no pertenece al aula de este curso.");
        }

        String actividad = datos.getActividad() != null ? datos.getActividad().trim() : null;
        if (authUser != null && (actividad == null || actividad.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debes indicar el nombre de la actividad.");
        }

        Calificacion calificacion = null;
        if (actividad != null && !actividad.isBlank()) {
            calificacion = calificacionRepository
                    .findFirstByCursoIdAndEstudianteIdAndActividadIgnoreCase(curso.getId(), estudiante.getId(), actividad)
                    .orElse(null);
        }
        if (calificacion == null) {
            calificacion = new Calificacion();
            calificacion.setEstudiante(estudiante);
            calificacion.setCurso(curso);
        }
        calificacion.setActividad(actividad != null ? actividad : datos.getActividad());
        calificacion.setNota(datos.getNota() != null ? GradeCalculationHelper.redondear2(datos.getNota()) : null);
        calificacion.setNotaMaxima(notaMaxima);
        calificacion.setFecha(datos.getFecha() == null ? LocalDate.now() : datos.getFecha());

        Calificacion guardada = calificacionRepository.save(calificacion);
        if (notificacionService != null && guardada.getNota() != null) {
            notificacionService.notificarNuevaCalificacionAEstudiante(guardada);
            notificacionService.alertarPadrePorBajaNota(guardada);
            notificacionService.notificarCalificacionAPadre(guardada);
        }
        return Optional.of(mapper.toDTO(guardada));
    }

    private List<Map<String, Object>> construirCursosResumen(List<Curso> cursos, List<Calificacion> calificaciones) {
        Map<String, Map<String, Object>> map = new LinkedHashMap<>();

        for (Curso curso : cursos) {
            String key = TextUtils.normalizar(curso.getNombre());
            if (map.containsKey(key)) continue;

            Map<String, Object> cMap = new HashMap<>();
            cMap.put("id", curso.getId());
            cMap.put("nombre", TextUtils.limpiarTexto(curso.getNombre()));
            cMap.put("icono", curso.getIcono());
            cMap.put("color", curso.getColor());
            String profesorStr = "Docente por asignar";
            if (curso.getProfesor() != null) {
                profesorStr = TextUtils.limpiarTexto(
                        curso.getProfesor().getNombres() + " "
                                + (curso.getProfesor().getApellidos() != null ? curso.getProfesor().getApellidos() : ""));
            }
            cMap.put("profesor", profesorStr);
            map.put(key, cMap);
        }

        for (Map<String, Object> cMap : map.values()) {
            String key = TextUtils.normalizar((String) cMap.get("nombre"));
            List<Calificacion> notasCurso = calificaciones.stream()
                    .filter(c -> c.getCurso() != null && TextUtils.normalizar(c.getCurso().getNombre()).equals(key))
                    .toList();

            double promedio = promedioNota20(notasCurso);
            cMap.put("evaluaciones", notasCurso.size());
            cMap.put("promedio", redondear(promedio));
            cMap.put("estado", notasCurso.isEmpty() ? "Sin notas" : (promedio >= 11 ? "Aprobado" : "Desaprobado"));
        }

        return new ArrayList<>(map.values());
    }

    private List<Map<String, Object>> construirDistribucion(List<Calificacion> calificaciones) {
        int[] counts = new int[4]; // 18-20, 14-17, 11-13, 0-10
        for (Calificacion cal : calificaciones) {
            double n20 = nota20(cal);
            if (n20 >= 18) counts[0]++;
            else if (n20 >= 14) counts[1]++;
            else if (n20 >= 11) counts[2]++;
            else counts[3]++;
        }

        String[] labels = {"18 - 20", "14 - 17", "11 - 13", "0 - 10"};
        String[] colors = {"green", "blue", "yellow", "red"};
        List<Map<String, Object>> dist = new ArrayList<>();
        int total = calificaciones.size();
        for (int i = 0; i < 4; i++) {
            Map<String, Object> item = new HashMap<>();
            item.put("label", labels[i]);
            item.put("color", colors[i]);
            item.put("cantidad", counts[i]);
            item.put("porcentaje", total == 0 ? 0 : Math.round((double) counts[i] / total * 100.0));
            dist.add(item);
        }
        return dist;
    }

    private double promedioNota20(List<Calificacion> calificaciones) {
        return GradeCalculationHelper.promedioPonderadoNota20(calificaciones);
    }

    private double nota20(Calificacion cal) {
        return GradeCalculationHelper.notaSobre20(cal);
    }

    private double calcularMejora(List<Calificacion> calificaciones) {
        List<Calificacion> notas = calificaciones.stream()
                .filter(c -> c.getNota() != null)
                .sorted(Comparator.comparing(c -> c.getFecha() == null ? LocalDate.MIN : c.getFecha()))
                .toList();
        if (notas.size() < 2) return 0.0;
        int mitad = notas.size() / 2;
        double ant = promedioNota20(notas.subList(0, mitad));
        double act = promedioNota20(notas.subList(mitad, notas.size()));
        return redondear(act - ant);
    }

    private Map<String, Object> construirMensaje(boolean tieneEvaluaciones, double promedio) {
        Map<String, Object> m = new HashMap<>();
        if (!tieneEvaluaciones) {
            m.put("titulo", "Sin evaluaciones aún");
            m.put("texto", "Aún no registras calificaciones en este periodo.");
        } else if (promedio >= 18) {
            m.put("titulo", "Excelente rendimiento");
            m.put("texto", "Tus calificaciones están en un nivel sobresaliente.");
        } else if (promedio >= GradeCalculationHelper.NOTA_APROBATORIA) {
            m.put("titulo", "Buen avance");
            m.put("texto", "Estás aprobando, sigue así.");
        } else {
            m.put("titulo", "Necesitas refuerzo");
            m.put("texto", "Revisa tus materias pendientes.");
        }
        return m;
    }

    private double redondear(double v) {
        return GradeCalculationHelper.redondear1(v);
    }

    private List<Map<String, Object>> construirEvaluacionesProgramadas(
            List<Curso> cursos, List<Calificacion> calificaciones) {
        if (evaluacionRepository == null || cursos == null || cursos.isEmpty()) {
            return List.of();
        }
        Map<Long, Calificacion> calPorEvalId = new HashMap<>();
        for (Calificacion c : calificaciones) {
            if (c.getEvaluacion() != null && c.getEvaluacion().getId() != null) {
                calPorEvalId.putIfAbsent(c.getEvaluacion().getId(), c);
            }
        }
        Map<String, Map<String, Object>> porClave = new LinkedHashMap<>();
        Set<Long> vistas = new HashSet<>();
        for (Curso curso : cursos) {
            if (curso == null || curso.getId() == null) continue;
            List<Evaluacion> evals = evaluacionRepository.findByCursoIdOrderByBimestreAscFechaAscIdAsc(curso.getId());
            if (evals == null) continue;
            String docenteNombre = curso.getProfesor() != null
                    ? TextUtils.limpiarTexto(
                            (curso.getProfesor().getNombres() != null ? curso.getProfesor().getNombres() : "")
                                    + " "
                                    + (curso.getProfesor().getApellidos() != null ? curso.getProfesor().getApellidos() : ""))
                    : "Docente asignado";
            String cursoNombre = TextUtils.limpiarTexto(curso.getNombre());
            for (Evaluacion ev : evals) {
                if (ev == null || ev.getId() == null || !vistas.add(ev.getId())) continue;
                Calificacion cal = calPorEvalId.get(ev.getId());
                boolean calificada = cal != null && cal.getNota() != null;
                String clave = TextUtils.normalizar(cursoNombre) + "|" + TextUtils.normalizar(ev.getTitulo());
                Map<String, Object> existente = porClave.get(clave);
                if (existente != null && (Boolean.TRUE.equals(existente.get("calificada")) || !calificada)) {
                    continue;
                }
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", ev.getId());
                item.put("titulo", ev.getTitulo());
                item.put("tipo", ev.getTipo() != null ? ev.getTipo() : "EXAMEN");
                item.put("bimestre", ev.getBimestre() != null ? ev.getBimestre() : 1);
                item.put("peso", ev.getPeso() != null ? ev.getPeso() : 1.0);
                item.put("notaMaxima", ev.getNotaMaxima() != null ? ev.getNotaMaxima() : 20.0);
                item.put("fecha", ev.getFecha() != null ? ev.getFecha().toString() : null);
                item.put("cursoId", curso.getId());
                item.put("cursoNombre", cursoNombre);
                item.put("cursoColor", curso.getColor() != null ? curso.getColor() : "blue");
                item.put("cursoIcono", curso.getIcono() != null ? curso.getIcono() : "ph-book-open");
                item.put("docenteNombre", docenteNombre.isBlank() ? "Docente asignado" : docenteNombre);
                item.put("calificada", calificada);
                item.put("nota", cal != null ? cal.getNota() : null);
                item.put("nota20", calificada ? GradeCalculationHelper.notaSobre20(cal) : null);
                porClave.put(clave, item);
            }
        }
        List<Map<String, Object>> programadas = new ArrayList<>(porClave.values());
        programadas.sort(Comparator
                .comparing((Map<String, Object> m) -> m.get("fecha") == null ? "" : m.get("fecha").toString())
                .reversed());
        return programadas;
    }
}
