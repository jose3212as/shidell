package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.*;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.repository.*;
import org.example.shidell.util.AcademicCalendarUtil;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.CourseProgressHelper;
import org.example.shidell.util.FileUploadUtil;
import org.example.shidell.util.GradeCalculationHelper;
import org.example.shidell.util.StudentProfileHelper;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class DocenteService {
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AsistenciaRepository asistenciaRepository;
    @Autowired
    private CalificacionRepository calificacionRepository;
    @Autowired
    private TareaRepository tareaRepository;
    @Autowired
    private EventoRepository eventoRepository;
    @Autowired
    private MaterialCursoRepository materialCursoRepository;
    @Autowired
    private NotificacionService notificacionService;
    @Autowired
    private EntityMapper mapper;
    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;
    @Autowired(required = false)
    private EntregaRepository entregaRepository;
    @Autowired(required = false)
    private AsistenciaService asistenciaService;
    @Autowired(required = false)
    private ForoSemanaMensajeRepository foroSemanaMensajeRepository;
    @Autowired(required = false)
    private EvaluacionRepository evaluacionRepository;
    public List<CursoDTO> obtenerCursosPorDocente(Long docenteId) {
        UserEntity docente = userRepository.findById(docenteId).orElse(null);
        if (docente == null) return List.of();
        
        List<Curso> cursosUnicos = deduplicarCursos(cursoRepository.findByProfesor(docente));
        return cursosUnicos.stream().map(mapper::toDTO).toList();
    }
    public Map<String, Object> obtenerDashboardDocente(Long docenteId) {
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        List<Curso> cursos = deduplicarCursos(cursoRepository.findByProfesor(docente));
        
        List<Map<String, Object>> cursosMap = new ArrayList<>();
        Set<Long> estudiantesUnicos = new HashSet<>();
        int totalTareas = 0;

        for (Curso curso : cursos) {
            List<UserEntity> estudiantes = obtenerEstudiantesPorCurso(curso.getId());
            estudiantes.forEach(e -> estudiantesUnicos.add(e.getId()));
            
            List<Tarea> tareasCurso = tareaRepository.findByCurso(curso);
            totalTareas += tareasCurso.size();

            Map<String, Object> item = new HashMap<>();
            item.put("curso", mapper.toDTO(curso));
            item.put("alumnos", estudiantes.size());
            item.put("tareas", tareasCurso.size());
            cursosMap.add(item);
        }

        LocalDate hoy = LocalDate.now();
        List<EventoDTO> clasesHoy = eventoRepository.findByUsuarioAndTipo(docente, "CLASE").stream()
                .filter(e -> e.getFechaInicio() != null && e.getFechaInicio().toLocalDate().equals(hoy))
                .sorted(Comparator.comparing(Evento::getFechaInicio))
                .map(mapper::toDTO)
                .toList();

        Map<String, Object> res = new HashMap<>();
        res.put("docente", mapper.toDTO(docente));
        res.put("cursos", cursosMap);
        res.put("horarioHoy", clasesHoy);
        res.put("metricas", Map.of(
            "cursos", cursosMap.size(),
            "estudiantes", estudiantesUnicos.size(),
            "clasesHoy", clasesHoy.size(),
            "tareas", totalTareas
        ));
        return res;
    }

    public List<UserEntity> obtenerEstudiantesPorCurso(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElse(null);
        if (curso == null) return List.of();
        return userRepository.findByGrupoAcademico(curso.getNivel(), curso.getGrado(), curso.getSeccion(), curso.getTurno())
                .stream().filter(u -> "ESTUDIANTE".equalsIgnoreCase(u.getRol())).toList();
    }

    public void registrarAsistencia(Long cursoId, Long estudianteId, String estado) {
        registrarAsistencia(cursoId, estudianteId, estado, LocalDate.now(), false);
    }

    public Asistencia registrarAsistencia(Long cursoId, Long estudianteId, String estado, LocalDate fecha, boolean allowAdminOverride) {
        Curso curso = cursoRepository.findById(cursoId)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        LocalDate dia = fecha != null ? fecha : LocalDate.now();
        validarPermisoRegistroAsistencia(curso, dia, allowAdminOverride);

        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        return persistirYNotificarAsistencia(curso, estudiante, dia, estado);
    }

    public Map<String, Object> obtenerListaAsistencia(Long cursoId, LocalDate fecha) {
        Curso curso = cursoRepository.findById(cursoId)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        LocalDate dia = fecha != null ? fecha : LocalDate.now();
        List<UserEntity> estudiantes = obtenerEstudiantesPorCurso(cursoId).stream()
                .sorted(Comparator
                        .comparing((UserEntity u) -> TextUtils.limpiarTexto(u.getApellidos()), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(u -> TextUtils.limpiarTexto(u.getNombres()), String.CASE_INSENSITIVE_ORDER))
                .toList();
        List<Asistencia> asistencias = asistenciaRepository.findByCursoAndFecha(curso, dia);
        Map<Long, Asistencia> asistenciaMap = new HashMap<>();
        asistencias.forEach(a -> {
            if (a.getEstudiante() != null && a.getEstudiante().getId() != null) {
                asistenciaMap.put(a.getEstudiante().getId(), a);
            }
        });

        List<Map<String, Object>> filas = estudiantes.stream().map(e -> {
            Asistencia a = asistenciaMap.get(e.getId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("estudianteId", e.getId());
            row.put("nombres", e.getNombres() != null ? e.getNombres() : "");
            row.put("apellidos", e.getApellidos() != null ? e.getApellidos() : "");
            row.put("email", e.getEmail() != null ? e.getEmail() : "");
            row.put("estado", a != null ? a.getEstado() : "PRESENTE");
            row.put("registrado", a != null);
            return row;
        }).toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("cursoId", curso.getId());
        response.put("cursoNombre", curso.getNombre() != null ? curso.getNombre() : "");
        response.put("nivel", curso.getNivel());
        response.put("grado", curso.getGrado());
        response.put("seccion", curso.getSeccion());
        response.put("turno", curso.getTurno());
        response.put("diaSemana", curso.getDiaSemana());
        response.put("horaInicio", curso.getHoraInicio());
        response.put("horaFin", curso.getHoraFin());
        response.put("fecha", dia.toString());
        response.put("esFechaFutura", dia.isAfter(LocalDate.now()));
        response.put("esFeriado", AcademicCalendarUtil.esFeriado(dia));
        response.put("feriadoNombre", AcademicCalendarUtil.nombreFeriado(dia));
        response.put("estudiantes", filas);
        return response;
    }

    public Calificacion guardarCalificacion(Long cursoId, Long estudianteId, String actividad, Double nota) {
        if (nota == null || Double.isNaN(nota) || Double.isInfinite(nota)
                || nota < GradeCalculationHelper.NOTA_MINIMA
                || nota > GradeCalculationHelper.NOTA_MAXIMA_VIGESIMAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nota debe estar entre 0 y 20.");
        }
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        UserEntity estudiante = userRepository.findById(estudianteId).orElseThrow();
        if (!AccessControlHelper.sameAcademicGroup(estudiante, curso, matriculaRepository)) {
            throw new BadRequestException("El estudiante no pertenece a la sección de este curso.");
        }
        String titulo = TextUtils.limpiarTexto(actividad);
        if (titulo.isBlank()) {
            throw new BadRequestException("El nombre de la actividad o evaluación es obligatorio.");
        }

        Evaluacion ev = evaluacionRepository != null && !titulo.isBlank()
                ? evaluacionRepository.findFirstByCursoIdAndTituloIgnoreCase(cursoId, titulo).orElse(null)
                : null;

        Calificacion c = (ev != null
                ? calificacionRepository.findFirstByCursoIdAndEstudianteIdAndEvaluacionId(cursoId, estudianteId, ev.getId())
                : Optional.<Calificacion>empty())
                .or(() -> calificacionRepository.findFirstByCursoIdAndEstudianteIdAndActividadIgnoreCase(cursoId, estudianteId, titulo))
                .orElseGet(Calificacion::new);

        c.setCurso(curso);
        c.setEstudiante(estudiante);
        c.setEvaluacion(ev);
        c.setActividad(ev != null ? ev.getTitulo() : titulo);
        c.setNota(GradeCalculationHelper.redondear2(nota));
        c.setNotaMaxima(ev != null && ev.getNotaMaxima() != null ? ev.getNotaMaxima() : 20.0);
        c.setFecha(LocalDate.now());

        Calificacion guardada = calificacionRepository.save(c);
        notificacionService.notificarNuevaCalificacionAEstudiante(guardada);
        notificacionService.alertarPadrePorBajaNota(guardada);
        notificacionService.notificarCalificacionAPadre(guardada);
        return guardada;
    }

    public List<Calificacion> obtenerCalificacionesPorCurso(Long cursoId) {
        return calificacionRepository.findByCursoId(cursoId);
    }

    /** Lista las evaluaciones (exámenes/actividades presenciales) configuradas para un curso. */
    public List<EvaluacionDTO> obtenerEvaluacionesPorCurso(Long cursoId, UserEntity authUser) {
        validarCursoDocente(cursoId, authUser);
        if (evaluacionRepository == null) return List.of();
        return evaluacionRepository.findByCursoIdOrderByBimestreAscFechaAscIdAsc(cursoId)
                .stream().map(mapper::toDTO).toList();
    }

    /** Crea una nueva evaluación para el curso (y opcionalmente para todas las secciones de la misma materia). */
    @Transactional
    public Map<String, Object> crearEvaluacion(Long cursoId, Map<String, Object> body, UserEntity authUser) {
        Curso curso = validarCursoDocente(cursoId, authUser);
        String titulo = TextUtils.limpiarTexto(body != null && body.get("titulo") != null ? body.get("titulo").toString() : "");
        if (titulo.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El título de la evaluación es obligatorio.");
        }
        if (evaluacionRepository.findFirstByCursoIdAndTituloIgnoreCase(curso.getId(), titulo).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una evaluación llamada '" + titulo + "' en este curso.");
        }

        String rawTipo = body.get("tipo") != null ? body.get("tipo").toString().trim().toUpperCase(Locale.ROOT) : "EXAMEN";
        String tipo = Set.of("EXAMEN", "PRACTICA", "ACTIVIDAD", "PARTICIPACION").contains(rawTipo) ? rawTipo : "EXAMEN";

        int bimestre = parseEntero(body.get("bimestre"), 1);
        if (bimestre < 1 || bimestre > 4) bimestre = 1;

        double peso = parseDouble(body.get("peso"), 1.0);
        if (peso < 0.5 || peso > 10.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El peso debe estar entre 0.5 y 10.");
        }

        double notaMaxima = parseDouble(body.get("notaMaxima"), 20.0);
        if (notaMaxima < 1.0 || notaMaxima > 100.0) notaMaxima = 20.0;

        LocalDate fecha = LocalDate.now();
        Object rawFecha = body.get("fecha");
        if (rawFecha != null && !rawFecha.toString().isBlank()) {
            try {
                fecha = LocalDate.parse(rawFecha.toString().trim());
            } catch (Exception ignored) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato de fecha inválido.");
            }
        }

        boolean aplicarTodas = Boolean.TRUE.equals(body.get("aplicarTodasSecciones"));
        List<Curso> destinos = new ArrayList<>();
        destinos.add(curso);
        if (aplicarTodas && curso.getProfesor() != null) {
            String nombreNorm = TextUtils.normalizar(curso.getNombre());
            String nivelCurso = curso.getNivel() != null ? curso.getNivel() : "";
            for (Curso otro : deduplicarCursos(cursoRepository.findByProfesor(curso.getProfesor()))) {
                if (Objects.equals(otro.getId(), curso.getId())) continue;
                String nivelOtro = otro.getNivel() != null ? otro.getNivel() : "";
                if (TextUtils.normalizar(otro.getNombre()).equals(nombreNorm)
                        && nivelOtro.equalsIgnoreCase(nivelCurso)
                        && evaluacionRepository.findFirstByCursoIdAndTituloIgnoreCase(otro.getId(), titulo).isEmpty()) {
                    destinos.add(otro);
                }
            }
        }

        Evaluacion principal = null;
        int creadas = 0;
        for (Curso destino : destinos) {
            Evaluacion ev = new Evaluacion();
            ev.setTitulo(titulo);
            ev.setTipo(tipo);
            ev.setBimestre(bimestre);
            ev.setPeso(peso);
            ev.setNotaMaxima(notaMaxima);
            ev.setFecha(fecha);
            ev.setCurso(destino);
            Evaluacion guardada = evaluacionRepository.save(ev);
            if (notificacionService != null && destino.getId() != null) {
                List<UserEntity> estudiantes = obtenerEstudiantesPorCurso(destino.getId());
                notificacionService.notificarNuevaEvaluacion(guardada, estudiantes);
            }
            if (principal == null) principal = guardada;
            creadas++;
        }

        return Map.of(
                "evaluacion", mapper.toDTO(principal),
                "cursosCreados", creadas
        );
    }

    /** Elimina una evaluación del docente junto con las calificaciones asociadas a ella. */
    @Transactional
    public void eliminarEvaluacion(Long evaluacionId, UserEntity authUser) {
        Evaluacion ev = evaluacionRepository.findById(evaluacionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluación no encontrada."));
        if (ev.getCurso() != null) {
            validarCursoDocente(ev.getCurso().getId(), authUser);
        }
        calificacionRepository.deleteByEvaluacionId(evaluacionId);
        evaluacionRepository.delete(ev);
    }

    /** Registra o actualiza en lote las notas de toda una columna (evaluación o actividad) del curso. */
    @Transactional
    public Map<String, Object> guardarCalificacionesLote(Long cursoId, Map<String, Object> body, UserEntity authUser) {
        Curso curso = validarCursoDocente(cursoId, authUser);

        Long evaluacionId = body != null && body.get("evaluacionId") != null && !body.get("evaluacionId").toString().isBlank()
                ? Long.valueOf(body.get("evaluacionId").toString())
                : null;

        Evaluacion evaluacion = null;
        String actividad;
        double notaMaxima = 20.0;

        if (evaluacionId != null) {
            evaluacion = evaluacionRepository.findById(evaluacionId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluación no encontrada."));
            if (evaluacion.getCurso() == null || !Objects.equals(evaluacion.getCurso().getId(), curso.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La evaluación no pertenece al curso seleccionado.");
            }
            actividad = evaluacion.getTitulo();
            if (evaluacion.getNotaMaxima() != null) notaMaxima = evaluacion.getNotaMaxima();
        } else {
            actividad = TextUtils.limpiarTexto(body != null && body.get("actividad") != null ? body.get("actividad").toString() : "");
            if (actividad.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debes indicar la evaluación o actividad a calificar.");
            }
            evaluacion = evaluacionRepository.findFirstByCursoIdAndTituloIgnoreCase(cursoId, actividad).orElse(null);
            if (evaluacion != null) {
                actividad = evaluacion.getTitulo();
                if (evaluacion.getNotaMaxima() != null) notaMaxima = evaluacion.getNotaMaxima();
            }
        }

        Object rawNotas = body.get("notas");
        if (!(rawNotas instanceof List<?> listaNotas)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato inválido para la lista de notas.");
        }

        int guardadas = 0;
        int actualizadas = 0;
        int eliminadas = 0;
        LocalDate hoy = LocalDate.now();

        for (Object itemObj : listaNotas) {
            if (!(itemObj instanceof Map<?, ?> item)) continue;
            Object rawEstId = item.get("estudianteId");
            if (rawEstId == null) continue;
            Long estudianteId = Long.valueOf(rawEstId.toString());

            Object rawNota = item.get("nota");
            Double nota;
            try {
                nota = GradeCalculationHelper.parseNotaInput(rawNota, notaMaxima);
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
            }

            final Long evIdFinal = evaluacion != null ? evaluacion.getId() : null;
            final String actFinal = actividad;
            Optional<Calificacion> existenteOpt = (evIdFinal != null
                    ? calificacionRepository.findFirstByCursoIdAndEstudianteIdAndEvaluacionId(cursoId, estudianteId, evIdFinal)
                    : Optional.<Calificacion>empty())
                    .or(() -> calificacionRepository.findFirstByCursoIdAndEstudianteIdAndActividadIgnoreCase(cursoId, estudianteId, actFinal));

            if (nota == null) {
                if (existenteOpt.isPresent()) {
                    calificacionRepository.delete(existenteOpt.get());
                    eliminadas++;
                }
                continue;
            }

            UserEntity estudiante = userRepository.findById(estudianteId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Estudiante no encontrado: " + estudianteId));

            Calificacion cal = existenteOpt.orElseGet(Calificacion::new);
            boolean esNueva = cal.getId() == null;
            boolean cambioValor = esNueva || !Objects.equals(cal.getNota(), nota);

            cal.setCurso(curso);
            cal.setEstudiante(estudiante);
            cal.setEvaluacion(evaluacion);
            cal.setActividad(actividad);
            cal.setNota(nota);
            cal.setNotaMaxima(notaMaxima);
            cal.setFecha(hoy);

            Calificacion saved = calificacionRepository.save(cal);
            if (esNueva) guardadas++;
            else if (cambioValor) actualizadas++;

            if (cambioValor) {
                notificacionService.notificarNuevaCalificacionAEstudiante(saved);
                notificacionService.alertarPadrePorBajaNota(saved);
                notificacionService.notificarCalificacionAPadre(saved);
            }
        }

        List<CalificacionDTO> listaActualizada = calificacionRepository.findByCursoId(cursoId)
                .stream().map(mapper::toDTO).toList();

        return Map.of(
                "guardadas", guardadas,
                "actualizadas", actualizadas,
                "eliminadas", eliminadas,
                "calificaciones", listaActualizada
        );
    }

    private Curso validarCursoDocente(Long cursoId, UserEntity authUser) {
        Curso curso = cursoRepository.findById(cursoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Curso no encontrado."));
        if (authUser != null) {
            String rol = authUser.getRol() != null ? authUser.getRol().toUpperCase(Locale.ROOT) : "";
            boolean esAdmin = "ADMIN".equals(rol) || "ADMINISTRADOR".equals(rol);
            if (!esAdmin && (curso.getProfesor() == null || !Objects.equals(curso.getProfesor().getId(), authUser.getId()))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permiso para gestionar este curso.");
            }
        }
        return curso;
    }

    private int parseEntero(Object raw, int fallback) {
        if (raw == null || raw.toString().isBlank()) return fallback;
        try {
            return Integer.parseInt(raw.toString().trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private double parseDouble(Object raw, double fallback) {
        if (raw == null || raw.toString().isBlank()) return fallback;
        try {
            return Double.parseDouble(raw.toString().trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    public Tarea crearTarea(Tarea tarea, MultipartFile archivo) {
        if (tarea == null || tarea.getTitulo() == null || TextUtils.limpiarTexto(tarea.getTitulo()).isBlank()) {
            throw new BadRequestException("El título de la tarea es obligatorio.");
        }
        tarea.setTitulo(TextUtils.limpiarTexto(tarea.getTitulo()));
        if (tarea.getFechaInicio() != null && tarea.getFechaVencimiento() != null
                && tarea.getFechaVencimiento().isBefore(tarea.getFechaInicio())) {
            throw new BadRequestException("La fecha de vencimiento no puede ser anterior a la fecha de inicio.");
        }
        if (tarea.getEstado() == null) tarea.setEstado("Pendiente");
        String pdfUrl = FileUploadUtil.saveFile("tareas", archivo);
        if (pdfUrl != null) tarea.setPdfUrl(pdfUrl);
        Tarea guardada = tareaRepository.save(tarea);
        if (guardada.getCurso() != null && guardada.getCurso().getId() != null) {
            List<UserEntity> estudiantes = obtenerEstudiantesPorCurso(guardada.getCurso().getId());
            notificacionService.notificarNuevaTareaAEstudiantes(guardada, estudiantes);
        }
        return guardada;
    }

    public List<Asistencia> guardarAsistencias(Long cursoId, LocalDate fecha, List<RegistroAsistencia> registros) {
        return guardarAsistencias(cursoId, fecha, registros, false);
    }

    public List<Asistencia> guardarAsistencias(Long cursoId, LocalDate fecha, List<RegistroAsistencia> registros, boolean allowAdminOverride) {
        Curso curso = cursoRepository.findById(cursoId)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        LocalDate dia = fecha != null ? fecha : LocalDate.now();
        validarPermisoRegistroAsistencia(curso, dia, allowAdminOverride);

        List<Asistencia> guardadas = new ArrayList<>();
        if (registros == null) return guardadas;
        for (RegistroAsistencia r : registros) {
            if (r.estudianteId() == null) continue;
            UserEntity estudiante = userRepository.findById(r.estudianteId())
                    .orElseThrow(() -> new ResourceNotFoundException("Estudiante #" + r.estudianteId() + " no encontrado"));
            guardadas.add(persistirYNotificarAsistencia(curso, estudiante, dia, r.estado()));
        }
        return guardadas;
    }

    private Asistencia persistirYNotificarAsistencia(Curso curso, UserEntity estudiante, LocalDate fecha, String estado) {
        if (!AccessControlHelper.sameAcademicGroup(estudiante, curso, matriculaRepository)) {
            throw new BadRequestException("El estudiante #" + estudiante.getId() + " no pertenece a la sección de este curso.");
        }
        Asistencia asistencia = asistenciaRepository.findByCursoAndEstudianteAndFecha(curso, estudiante, fecha)
                .orElseGet(Asistencia::new);
        String estadoAnterior = asistencia.getId() != null ? asistencia.getEstado() : null;
        String estadoNuevo = normalizarEstadoAsistencia(estado);
        asistencia.setCurso(curso);
        asistencia.setEstudiante(estudiante);
        asistencia.setFecha(fecha);
        asistencia.setEstado(estadoNuevo);
        Asistencia saved = asistenciaRepository.save(asistencia);
        Asistencia resultado = saved != null ? saved : asistencia;

        if (!Objects.equals(estadoAnterior, estadoNuevo)) {
            notificacionService.alertarPadrePorFalta(resultado);
        }
        return resultado;
    }

    private void validarPermisoRegistroAsistencia(Curso curso, LocalDate fechaClase, boolean allowAdminOverride) {
        LocalDate hoy = LocalDate.now();
        if (fechaClase.isAfter(hoy)) {
            throw new BadRequestException("No puede tomar asistencia para fechas futuras.");
        }
        if (allowAdminOverride) {
            return;
        }
        validarVentanaAsistencia(curso, fechaClase);
    }

    private void validarVentanaAsistencia(Curso curso, LocalDate fechaClase) {
        LocalDate hoy = LocalDate.now();
        if (fechaClase.isAfter(hoy)) {
            throw new BadRequestException("No puede tomar asistencia para fechas futuras.");
        }
        if (fechaClase.isBefore(hoy)) {
            throw new BadRequestException("El tiempo para registrar faltas expiró. Todos los alumnos quedaron presentes por defecto.");
        }
        if (AcademicCalendarUtil.esFeriado(fechaClase)) {
            String nombre = AcademicCalendarUtil.nombreFeriado(fechaClase);
            throw new BadRequestException("Hoy es feriado calendario" + (nombre != null ? " (" + nombre + ")" : "") + "; no corresponde tomar asistencia.");
        }

        java.time.LocalTime horaInicio = curso.getHoraInicioLocalTime();
        java.time.LocalTime horaFin = curso.getHoraFinLocalTime();
        java.time.LocalTime ahora = java.time.LocalTime.now();

        if (horaInicio != null && horaFin != null) {
            java.time.LocalTime inicioPermitido = horaInicio.minusMinutes(15);
            if (ahora.isBefore(inicioPermitido) || ahora.isAfter(horaFin)) {
                throw new BadRequestException("Fuera de horario. Puede tomar asistencia desde 15 min antes de iniciar hasta el fin de la clase.");
            }
        }
    }

    public List<Map<String, Object>> obtenerDiasClaseAsistencia(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        if (curso.getProfesor() == null) return List.of();
        List<Evento> clases = eventoRepository.findByUsuarioAndTipo(curso.getProfesor(), "CLASE");
        Map<String, Map<String, Object>> dias = new LinkedHashMap<>();
        for (Evento clase : clases) {
            if (!esClaseDelCurso(clase, curso) || clase.getFechaInicio() == null) continue;
            LocalDateTime inicio = clase.getFechaInicio();
            LocalDate fecha = inicio.toLocalDate();
            LocalDate finClases = LocalDate.of(fecha.getYear(), 12, 20);
            while (!fecha.isAfter(finClases)) {
                String key = fecha + "|" + inicio.toLocalTime();
                Map<String, Object> dia = new HashMap<>();
                dia.put("fecha", fecha.toString());
                dia.put("hora", inicio.toLocalTime().toString().substring(0, 5));
                dia.put("titulo", TextUtils.limpiarTexto(clase.getTitulo()));
                dia.put("registrados", asistenciaRepository.findByCursoAndFecha(curso, fecha).size());
                dia.put("totalEstudiantes", obtenerEstudiantesPorCurso(cursoId).size());
                dias.putIfAbsent(key, dia);
                fecha = fecha.plusWeeks(1);
            }
        }
        return dias.values().stream().sorted(Comparator.comparing((Map<String, Object> d) -> String.valueOf(d.get("fecha"))).thenComparing(d -> String.valueOf(d.get("hora")))).toList();
    }

    public MaterialCurso crearMaterial(Long docenteId, Long cursoId, String titulo, String descripcion, MultipartFile archivo) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();

        MaterialCurso m = new MaterialCurso();
        m.setCurso(curso);
        m.setDocente(docente);
        m.setTitulo(titulo);
        m.setDescripcion(descripcion != null ? descripcion : "");
        m.setFechaPublicacion(LocalDateTime.now());

        String archivoUrl = FileUploadUtil.saveFile("materiales", archivo);
        if (archivoUrl != null) {
            m.setArchivoUrl(archivoUrl);
            m.setArchivoNombre(archivo.getOriginalFilename());
        }

        MaterialCurso guardado = materialCursoRepository.save(m);
        List<UserEntity> estudiantes = obtenerEstudiantesPorCurso(cursoId);
        notificacionService.notificarNuevoMaterialAEstudiantes(guardado, estudiantes);
        return guardado;
    }

    private List<Curso> deduplicarCursos(List<Curso> cursos) {
        LinkedHashMap<String, Curso> unicos = new LinkedHashMap<>();
        for (Curso c : cursos) {
            if (c == null || "ARCHIVADO".equalsIgnoreCase(c.getTurno())) {
                continue;
            }
            String key = String.format("%s-%s-%s-%s-%s", 
                c.getNombre(), c.getNivel(), c.getGrado(), c.getSeccion(), c.getTurno()
            ).toLowerCase();
            unicos.putIfAbsent(key, c);
        }
        return new ArrayList<>(unicos.values());
    }

    private boolean esClaseDelCurso(Evento clase, Curso curso) {
        String titulo = TextUtils.normalizar(clase.getTitulo());
        String nombreCurso = TextUtils.normalizar(curso.getNombre());
        if (!titulo.isBlank() && !nombreCurso.isBlank() && (titulo.contains(nombreCurso) || nombreCurso.contains(titulo))) return true;
        return clase.getColor() != null && curso.getColor() != null && Objects.equals(clase.getColor(), curso.getColor());
    }

    private String normalizarEstadoAsistencia(String estado) {
        if (estado == null) return "PRESENTE";
        String val = estado.trim().toUpperCase();
        return List.of("PRESENTE", "AUSENTE", "TARDE", "JUSTIFICADO").contains(val) ? val : "PRESENTE";
    }

    public List<Tarea> obtenerTareasPorCurso(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        return tareaRepository.findByCurso(curso);
    }

    public List<MaterialCurso> obtenerMaterialesPorCurso(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        return materialCursoRepository.findByCursoOrderByFechaPublicacionDesc(curso);
    }

    @Transactional
    public boolean eliminarTarea(Long id) {
        return eliminarTarea(id, null);
    }

    @Transactional
    public boolean eliminarTarea(Long id, UserEntity authUser) {
        Tarea tarea = tareaRepository.findById(id).orElse(null);
        if (tarea == null) {
            return false;
        }
        if (authUser != null) {
            AccessControlHelper.requireCourseOwnerOrAdmin(authUser, tarea.getCurso());
        }
        if (entregaRepository != null) {
            List<Entrega> entregas = entregaRepository.findByTarea(tarea);
            if (entregas != null && !entregas.isEmpty()) {
                entregaRepository.deleteAll(entregas);
            }
        }
        tareaRepository.delete(tarea);
        return true;
    }

    public List<Evento> obtenerEventosPorDocente(Long docenteId) {
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        return eventoRepository.findByUsuario(docente);
    }

    public List<Evento> obtenerEventosPorDocenteYTipo(Long docenteId, String tipo) {
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        return eventoRepository.findByUsuarioAndTipo(docente, tipo);
    }

    public Evento guardarEvento(Evento evento) {
        return eventoRepository.save(evento);
    }

    /**
     * Construye el perfil académico, personal, familiar y de seguimiento de cualquier estudiante
     * para ser renderizado como página dedicada dentro del portal docente.
     */
    public Map<String, Object> obtenerPerfilEstudianteParaDocente(Long estudianteId, Long docenteId) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .filter(u -> "ESTUDIANTE".equalsIgnoreCase(u.getRol()))
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));

        if (docenteId != null) {
            UserEntity solicitante = userRepository.findById(docenteId).orElse(null);
            if (solicitante != null && !AccessControlHelper.isAdmin(solicitante)
                    && !AccessControlHelper.docenteHasStudentAccess(solicitante, estudiante, cursoRepository, matriculaRepository)) {
                throw new ForbiddenException("No tienes permiso para ver el perfil académico de este estudiante.");
            }
        }

        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);
        boolean grupoCompleto = grupo.isComplete();

        List<Curso> cursosAula = grupoCompleto
                ? cursoRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno())
                : List.of();
        List<Calificacion> calificaciones = calificacionRepository.findByEstudianteId(estudianteId);
        List<Tarea> tareas = grupoCompleto
                ? tareaRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno())
                : List.of();
        List<Entrega> entregas = entregaRepository != null ? entregaRepository.findByEstudiante(estudiante) : List.of();
        List<Asistencia> asistenciasRegistradas = asistenciaRepository.findByEstudiante(estudiante);
        List<Asistencia> asistenciasCompletas = asistenciaService != null
                ? asistenciaService.getAsistenciasCompletas(estudiante)
                : asistenciasRegistradas;
        Map<Long, List<ForoSemanaMensaje>> forosPorCursoId =
                CourseProgressHelper.cargarForosPorCursoId(cursosAula, foroSemanaMensajeRepository);
        List<UserEntity> companeros = grupoCompleto
                ? userRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno())
                : List.of();
        List<CalificacionDTO> califDtos = calificaciones.stream().map(mapper::toDTO).toList();

        return StudentProfileHelper.build(
                estudiante,
                mapper.toDTO(estudiante),
                docenteId,
                grupo,
                cursosAula,
                calificaciones,
                tareas,
                entregas,
                asistenciasRegistradas,
                asistenciasCompletas,
                forosPorCursoId,
                companeros,
                califDtos,
                LocalDate.now());
    }
}
