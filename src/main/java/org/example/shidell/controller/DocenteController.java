package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.*;
import org.example.shidell.model.entity.*;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.service.CalendarioService;
import org.example.shidell.service.DocenteService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/docente")
@CrossOrigin(origins = "*")
public class DocenteController {

    @Autowired
    private DocenteService docenteService;

    @Autowired
    private CalendarioService calendarioService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CursoRepository cursoRepository;

    @Autowired
    private EntityMapper mapper;

    private Curso verificarPropietarioCurso(Long cursoId, HttpServletRequest request) {
        Curso curso = cursoRepository.findById(cursoId)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser != null) {
            AccessControlHelper.requireCourseOwnerOrAdmin(authUser, curso);
        }
        return curso;
    }

    @GetMapping("/buscar")
    public ResponseEntity<UserDTO> buscarPorEmail(@RequestParam String email, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser != null
                && !"DOCENTE".equalsIgnoreCase(AccessControlHelper.normalizedRole(authUser))
                && !AccessControlHelper.isAdmin(authUser)) {
            throw new ForbiddenException("Solo los docentes o administradores pueden buscar usuarios por correo.");
        }
        UserEntity user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(mapper.toDTO(user));
    }

    @GetMapping("/{docenteId}/cursos")
    public List<CursoDTO> getCursos(@PathVariable Long docenteId, HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), docenteId, "No tienes permiso para ver los cursos de otro docente.");
        return docenteService.obtenerCursosPorDocente(docenteId);
    }

    @GetMapping("/{docenteId}/dashboard")
    public Map<String, Object> getDashboard(@PathVariable Long docenteId, HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), docenteId, "No tienes permiso para ver el dashboard de otro docente.");
        return docenteService.obtenerDashboardDocente(docenteId);
    }

    @GetMapping("/curso/{cursoId}/estudiantes")
    public List<UserDTO> getEstudiantes(@PathVariable Long cursoId, HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        return docenteService.obtenerEstudiantesPorCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/estudiante/{estudianteId}/perfil")
    public Map<String, Object> getPerfilEstudiante(
            @PathVariable Long estudianteId,
            @RequestParam(required = false) Long docenteId,
            HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser != null
                && !"DOCENTE".equalsIgnoreCase(AccessControlHelper.normalizedRole(authUser))
                && !AccessControlHelper.isAdmin(authUser)) {
            throw new ForbiddenException("Solo docentes o administradores pueden consultar este perfil.");
        }
        Long effectiveDocenteId = authUser != null ? authUser.getId() : docenteId;
        return docenteService.obtenerPerfilEstudianteParaDocente(estudianteId, effectiveDocenteId);
    }

    @PostMapping("/asistencia")
    public Map<String, Object> registrarAsistencia(@RequestParam Long cursoId,
                                                   @RequestParam Long estudianteId,
                                                   @RequestParam String estado,
                                                   @RequestParam(required = false) String fecha,
                                                   HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        LocalDate dia = parseFechaOrToday(fecha);
        boolean esAdmin = AccessControlHelper.isAdmin(AccessControlHelper.getAuthUser(request));
        Asistencia saved = docenteService.registrarAsistencia(cursoId, estudianteId, estado, dia, esAdmin);
        return Map.of(
                "id", saved.getId() != null ? saved.getId() : 0L,
                "estudianteId", estudianteId,
                "cursoId", cursoId,
                "fecha", dia.toString(),
                "estado", saved.getEstado(),
                "registrado", true
        );
    }

    @GetMapping("/curso/{cursoId}/asistencia")
    public Map<String, Object> getAsistenciaPorCurso(@PathVariable Long cursoId,
                                                     @RequestParam(required = false) String fecha,
                                                     HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        LocalDate dia = parseFechaOrToday(fecha);
        return docenteService.obtenerListaAsistencia(cursoId, dia);
    }

    @GetMapping("/curso/{cursoId}/asistencia/dias")
    public List<Map<String, Object>> getDiasClaseAsistencia(@PathVariable Long cursoId, HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        return docenteService.obtenerDiasClaseAsistencia(cursoId);
    }

    @PostMapping("/curso/{cursoId}/asistencia")
    public List<AsistenciaDTO> guardarAsistenciaPorCurso(@PathVariable Long cursoId,
                                                         @RequestParam(required = false) String fecha,
                                                         @RequestBody List<RegistroAsistencia> registros,
                                                         HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        LocalDate dia = parseFechaOrToday(fecha);
        boolean esAdmin = AccessControlHelper.isAdmin(AccessControlHelper.getAuthUser(request));
        return docenteService.guardarAsistencias(cursoId, dia, registros, esAdmin).stream().map(mapper::toDTO).toList();
    }

    private LocalDate parseFechaOrToday(String fecha) {
        if (fecha == null || fecha.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(fecha.trim());
        } catch (java.time.format.DateTimeParseException ex) {
            throw new BadRequestException("Formato de fecha inválido. Usa YYYY-MM-DD.");
        }
    }

    @PostMapping(value = "/calificar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CalificacionDTO registrarCalificacion(@RequestParam Long cursoId,
                                                 @RequestParam Long estudianteId,
                                                 @RequestParam String actividad,
                                                 @RequestParam Double nota,
                                                 HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        return mapper.toDTO(docenteService.guardarCalificacion(cursoId, estudianteId, actividad, nota));
    }

    @GetMapping("/curso/{cursoId}/calificaciones")
    public List<CalificacionDTO> getCalificacionesPorCurso(@PathVariable Long cursoId, HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        return docenteService.obtenerCalificacionesPorCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/curso/{cursoId}/evaluaciones")
    public List<EvaluacionDTO> getEvaluacionesPorCurso(@PathVariable Long cursoId, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        return docenteService.obtenerEvaluacionesPorCurso(cursoId, authUser);
    }

    @PostMapping("/curso/{cursoId}/evaluaciones")
    public Map<String, Object> crearEvaluacion(
            @PathVariable Long cursoId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        return docenteService.crearEvaluacion(cursoId, body, authUser);
    }

    @DeleteMapping("/evaluaciones/{evaluacionId}")
    public ResponseEntity<?> eliminarEvaluacion(@PathVariable Long evaluacionId, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        docenteService.eliminarEvaluacion(evaluacionId, authUser);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/curso/{cursoId}/calificaciones/lote")
    public Map<String, Object> guardarCalificacionesLote(
            @PathVariable Long cursoId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        return docenteService.guardarCalificacionesLote(cursoId, body, authUser);
    }

    @PostMapping(value = "/tareas", consumes = "multipart/form-data")
    public TareaDTO crearTarea(
            @RequestParam String titulo,
            @RequestParam(required = false) String descripcion,
            @RequestParam Long cursoId,
            @RequestParam(required = false) String fechaInicio,
            @RequestParam(required = false) String fechaVencimiento,
            @RequestParam(required = false) String prioridad,
            @RequestParam(value = "archivo", required = false) MultipartFile archivo,
            HttpServletRequest request) {

        Curso curso = verificarPropietarioCurso(cursoId, request);

        Tarea tarea = new Tarea();
        tarea.setTitulo(titulo);
        tarea.setDescripcion(descripcion != null ? descripcion : "");
        tarea.setPrioridad(prioridad != null ? prioridad : "Media");
        if (fechaInicio != null && !fechaInicio.isEmpty()) tarea.setFechaInicio(LocalDate.parse(fechaInicio));
        if (fechaVencimiento != null && !fechaVencimiento.isEmpty()) tarea.setFechaVencimiento(LocalDate.parse(fechaVencimiento));
        tarea.setCurso(curso);

        return mapper.toDTO(docenteService.crearTarea(tarea, archivo));
    }

    @GetMapping("/curso/{cursoId}/tareas")
    public List<TareaDTO> getTareasPorCurso(@PathVariable Long cursoId, HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        return docenteService.obtenerTareasPorCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @PostMapping(value = "/{docenteId}/materiales", consumes = "multipart/form-data")
    public MaterialCursoDTO crearMaterial(
            @PathVariable Long docenteId,
            @RequestParam Long cursoId,
            @RequestParam String titulo,
            @RequestParam(required = false) String descripcion,
            @RequestParam(value = "archivo", required = false) MultipartFile archivo,
            HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), docenteId, "No puedes publicar materiales a nombre de otro docente.");
        verificarPropietarioCurso(cursoId, request);
        if (titulo == null || titulo.isBlank()) {
            throw new BadRequestException("El título del material es obligatorio.");
        }
        return mapper.toDTO(docenteService.crearMaterial(docenteId, cursoId, titulo, descripcion, archivo));
    }

    @GetMapping("/curso/{cursoId}/materiales")
    public List<MaterialCursoDTO> getMaterialesPorCurso(@PathVariable Long cursoId, HttpServletRequest request) {
        verificarPropietarioCurso(cursoId, request);
        return docenteService.obtenerMaterialesPorCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @DeleteMapping("/tareas/{id}")
    public ResponseEntity<Void> eliminarTarea(@PathVariable Long id, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        boolean deleted = (authUser == null)
                ? docenteService.eliminarTarea(id)
                : docenteService.eliminarTarea(id, authUser);
        if (!deleted) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{docenteId}/eventos")
    public List<EventoDTO> getEventos(@PathVariable Long docenteId,
                                      @RequestParam(required = false) String tipo,
                                      HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), docenteId, "No tienes permiso para ver los eventos de otro docente.");
        List<Evento> evs = (tipo != null) ? docenteService.obtenerEventosPorDocenteYTipo(docenteId, tipo) : docenteService.obtenerEventosPorDocente(docenteId);
        return evs.stream().map(mapper::toDTO).toList();
    }

    @PostMapping("/{docenteId}/eventos")
    public EventoDTO crearEvento(
            @PathVariable Long docenteId,
            @RequestParam String titulo,
            @RequestParam(required = false) String descripcion,
            @RequestParam String tipo,
            @RequestParam String fechaInicio,
            @RequestParam(required = false) String fechaFin,
            @RequestParam(required = false) String color,
            HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), docenteId, "No puedes crear eventos para otro docente.");
        if (titulo == null || titulo.isBlank()) {
            throw new BadRequestException("El título del evento es obligatorio.");
        }
        LocalDateTime inicio = LocalDateTime.parse(fechaInicio);
        LocalDateTime fin = (fechaFin != null && !fechaFin.isEmpty()) ? LocalDateTime.parse(fechaFin) : null;
        if (fin != null && fin.isBefore(inicio)) {
            throw new BadRequestException("La fecha de fin no puede ser anterior al inicio del evento.");
        }

        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        Evento ev = new Evento();
        ev.setTitulo(titulo.trim());
        ev.setDescripcion(descripcion);
        ev.setTipo(tipo.toUpperCase());
        ev.setColor(color != null ? color : "blue");
        ev.setFechaInicio(inicio);
        if (fin != null) ev.setFechaFin(fin);
        ev.setUsuario(docente);
        return mapper.toDTO(docenteService.guardarEvento(ev));
    }

    /** Calendario consolidado del docente (clases semanales, exámenes, entregas de tareas y eventos propios). */
    @GetMapping("/{docenteId}/calendario")
    public ResponseEntity<?> getCalendarioDocente(
            @PathVariable Long docenteId,
            HttpServletRequest request) {
        UserEntity authUser = (request.getAttribute("authUser") instanceof UserEntity u) ? u : null;
        if (authUser == null || (!docenteId.equals(authUser.getId()) && !"ADMIN".equalsIgnoreCase(authUser.getRol()))) {
            return ResponseEntity.status(403).body(Map.of("error", "No tienes acceso a este calendario"));
        }
        return ResponseEntity.ok(calendarioService.getCalendarioDocente(docenteId));
    }

    /** Crea un evento, examen, reunión o recordatorio en el calendario del docente autenticado. */
    @PostMapping("/{docenteId}/calendario/eventos")
    public ResponseEntity<?> crearEventoCalendarioDocente(
            @PathVariable Long docenteId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        UserEntity authUser = (request.getAttribute("authUser") instanceof UserEntity u) ? u : null;
        return calendarioService.crearEventoDocente(docenteId, body, authUser);
    }

    /** Elimina un evento o recordatorio creado por el docente autenticado. */
    @DeleteMapping("/{docenteId}/calendario/eventos/{eventoId}")
    public ResponseEntity<?> eliminarEventoCalendarioDocente(
            @PathVariable Long docenteId,
            @PathVariable Long eventoId,
            HttpServletRequest request) {
        UserEntity authUser = (request.getAttribute("authUser") instanceof UserEntity u) ? u : null;
        return calendarioService.eliminarEventoDocente(docenteId, eventoId, authUser);
    }
}
