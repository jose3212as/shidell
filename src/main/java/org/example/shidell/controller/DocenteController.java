package org.example.shidell.controller;

import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.*;
import org.example.shidell.service.DocenteService;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/docente")
@CrossOrigin(origins = "*")
public class DocenteController {

    @Autowired
    private DocenteService docenteService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CursoRepository cursoRepository;

    @Autowired
    private EntityMapper mapper;

    @GetMapping("/buscar")
    public ResponseEntity<UserDTO> buscarPorEmail(@RequestParam String email) {
        UserEntity user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(mapper.toDTO(user));
    }

    @GetMapping("/{docenteId}/cursos")
    public List<CursoDTO> getCursos(@PathVariable Long docenteId) {
        return docenteService.obtenerCursosPorDocente(docenteId);
    }

    @GetMapping("/{docenteId}/dashboard")
    public Map<String, Object> getDashboard(@PathVariable Long docenteId) {
        return docenteService.obtenerDashboardDocente(docenteId);
    }

    @GetMapping("/curso/{cursoId}/estudiantes")
    public List<UserDTO> getEstudiantes(@PathVariable Long cursoId) {
        return docenteService.obtenerEstudiantesPorCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @PostMapping("/asistencia")
    public void registrarAsistencia(@RequestParam Long cursoId, @RequestParam Long estudianteId, @RequestParam String estado) {
        docenteService.registrarAsistencia(cursoId, estudianteId, estado);
    }

    @GetMapping("/curso/{cursoId}/asistencia")
    public Map<String, Object> getAsistenciaPorCurso(@PathVariable Long cursoId, @RequestParam(required = false) String fecha) {
        LocalDate dia = (fecha == null || fecha.isBlank()) ? LocalDate.now() : LocalDate.parse(fecha);
        return docenteService.obtenerListaAsistencia(cursoId, dia);
    }

    @GetMapping("/curso/{cursoId}/asistencia/dias")
    public List<Map<String, Object>> getDiasClaseAsistencia(@PathVariable Long cursoId) {
        return docenteService.obtenerDiasClaseAsistencia(cursoId);
    }

    @PostMapping("/curso/{cursoId}/asistencia")
    public List<AsistenciaDTO> guardarAsistenciaPorCurso(@PathVariable Long cursoId, @RequestParam(required = false) String fecha, @RequestBody List<RegistroAsistencia> registros) {
        LocalDate dia = (fecha == null || fecha.isBlank()) ? LocalDate.now() : LocalDate.parse(fecha);
        return docenteService.guardarAsistencias(cursoId, dia, registros).stream().map(mapper::toDTO).toList();
    }

    @PostMapping(value = "/calificar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CalificacionDTO registrarCalificacion(@RequestParam Long cursoId, @RequestParam Long estudianteId, @RequestParam String actividad, @RequestParam Double nota) {
        return mapper.toDTO(docenteService.guardarCalificacion(cursoId, estudianteId, actividad, nota));
    }

    @GetMapping("/curso/{cursoId}/calificaciones")
    public List<CalificacionDTO> getCalificacionesPorCurso(@PathVariable Long cursoId) {
        return docenteService.obtenerCalificacionesPorCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @PostMapping(value = "/tareas", consumes = "multipart/form-data")
    public TareaDTO crearTarea(
            @RequestParam String titulo,
            @RequestParam(required = false) String descripcion,
            @RequestParam Long cursoId,
            @RequestParam(required = false) String fechaInicio,
            @RequestParam(required = false) String fechaVencimiento,
            @RequestParam(required = false) String prioridad,
            @RequestParam(value = "archivo", required = false) MultipartFile archivo) {
        
        Tarea tarea = new Tarea();
        tarea.setTitulo(titulo);
        tarea.setDescripcion(descripcion != null ? descripcion : "");
        tarea.setPrioridad(prioridad != null ? prioridad : "Media");
        if (fechaInicio != null && !fechaInicio.isEmpty()) tarea.setFechaInicio(LocalDate.parse(fechaInicio));
        if (fechaVencimiento != null && !fechaVencimiento.isEmpty()) tarea.setFechaVencimiento(LocalDate.parse(fechaVencimiento));
        
        Curso curso = cursoRepository.findById(cursoId).orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        tarea.setCurso(curso);
        
        return mapper.toDTO(docenteService.crearTarea(tarea, archivo));
    }

    @GetMapping("/curso/{cursoId}/tareas")
    public List<TareaDTO> getTareasPorCurso(@PathVariable Long cursoId) {
        return docenteService.obtenerTareasPorCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @PostMapping(value = "/{docenteId}/materiales", consumes = "multipart/form-data")
    public MaterialCursoDTO crearMaterial(
            @PathVariable Long docenteId,
            @RequestParam Long cursoId,
            @RequestParam String titulo,
            @RequestParam(required = false) String descripcion,
            @RequestParam(value = "archivo", required = false) MultipartFile archivo) {
        return mapper.toDTO(docenteService.crearMaterial(docenteId, cursoId, titulo, descripcion, archivo));
    }

    @GetMapping("/curso/{cursoId}/materiales")
    public List<MaterialCursoDTO> getMaterialesPorCurso(@PathVariable Long cursoId) {
        return docenteService.obtenerMaterialesPorCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @DeleteMapping("/tareas/{id}")
    public ResponseEntity<Void> eliminarTarea(@PathVariable Long id) {
        if (!docenteService.eliminarTarea(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{docenteId}/eventos")
    public List<EventoDTO> getEventos(@PathVariable Long docenteId, @RequestParam(required = false) String tipo) {
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
            @RequestParam(required = false) String color) {

        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        Evento ev = new Evento();
        ev.setTitulo(titulo);
        ev.setDescripcion(descripcion);
        ev.setTipo(tipo.toUpperCase());
        ev.setColor(color != null ? color : "blue");
        ev.setFechaInicio(java.time.LocalDateTime.parse(fechaInicio));
        if (fechaFin != null && !fechaFin.isEmpty()) ev.setFechaFin(java.time.LocalDateTime.parse(fechaFin));
        ev.setUsuario(docente);
        return mapper.toDTO(docenteService.guardarEvento(ev));
    }
}
