package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.EntregaDTO;
import org.example.shidell.model.dto.TareaDTO;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.EntregaRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.repository.TareaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Gestión de tareas académicas, consulta por estudiante y envío de notificaciones.
 */
@Service
public class TareaService {

    @Autowired
    private TareaRepository tareaRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private EntregaRepository entregaRepository;
    @Autowired(required = false)
    private CursoRepository cursoRepository;
    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;
    @Autowired
    private EntityMapper mapper;
    @Autowired
    private DocenteService docenteService;
    @Autowired
    private NotificacionService notificacionService;

    public List<TareaDTO> getAllTareas() {
        return tareaRepository.findAll().stream().map(mapper::toDTO).toList();
    }

    public List<TareaDTO> getTareasBySeccion(String nivel, String grado, String seccion, String turno, UserEntity authUser) {
        if (nivel == null || nivel.isBlank() || grado == null || grado.isBlank() || seccion == null || seccion.isBlank()) {
            throw new BadRequestException("Debes indicar nivel, grado y sección para consultar las tareas.");
        }
        String turnoFiltro = (turno != null && !turno.isBlank()) ? turno.trim() : null;
        if (authUser != null && !AccessControlHelper.isAdmin(authUser)) {
            String rol = AccessControlHelper.normalizedRole(authUser);
            if ("ESTUDIANTE".equals(rol)) {
                AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(authUser, matriculaRepository);
                if (!grupo.isComplete()
                        || !TextUtils.normalizar(grupo.nivel()).equals(TextUtils.normalizar(nivel))
                        || !TextUtils.normalizar(grupo.grado()).equals(TextUtils.normalizar(grado))
                        || !TextUtils.normalizar(grupo.seccion()).equals(TextUtils.normalizar(seccion))) {
                    throw new ForbiddenException("No puedes consultar tareas de otra sección.");
                }
            } else if ("PADRE".equals(rol)) {
                List<UserEntity> hijos = userRepository.findByPadreId(authUser.getId());
                boolean tieneHijoEnSeccion = hijos.stream().anyMatch(hijo -> {
                    AcademicGroupHelper.AcademicGroup g = AcademicGroupHelper.resolve(hijo, matriculaRepository);
                    return g.isComplete()
                            && TextUtils.normalizar(g.nivel()).equals(TextUtils.normalizar(nivel))
                            && TextUtils.normalizar(g.grado()).equals(TextUtils.normalizar(grado))
                            && TextUtils.normalizar(g.seccion()).equals(TextUtils.normalizar(seccion));
                });
                if (!tieneHijoEnSeccion) {
                    throw new ForbiddenException("No tienes hijos matriculados en esta sección.");
                }
            } else if (!"DOCENTE".equals(rol)) {
                throw new ForbiddenException("No tienes permiso para consultar tareas de esta sección.");
            }
        }
        return tareaRepository.findByGrupoAcademico(nivel.trim(), grado.trim(), seccion.trim(), turnoFiltro)
                .stream()
                .sorted(Comparator.comparing(t -> nullSafeDate(t.getFechaVencimiento())))
                .map(mapper::toDTO)
                .toList();
    }

    public Map<String, Object> getTareasByEstudiante(Long estudianteId) {
        return getTareasByEstudiante(estudianteId, null);
    }

    public Map<String, Object> getTareasByEstudiante(Long estudianteId, UserEntity authUser) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        if (authUser != null) {
            AccessControlHelper.requireStudentAccess(
                    authUser,
                    estudiante,
                    cursoRepository,
                    matriculaRepository,
                    "No tienes permiso para ver las tareas de este estudiante."
            );
        }

        List<Entrega> entregas = entregaRepository.findByEstudiante(estudiante);
        Map<Long, EntregaDTO> entregasPorTarea = entregas.stream()
                .filter(e -> e.getTarea() != null)
                .collect(Collectors.toMap(e -> e.getTarea().getId(), mapper::toDTO, (a, b) -> a));

        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);

        List<Map<String, Object>> tareas = tareaRepository
                .findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno())
                .stream()
                .sorted((a, b) -> nullSafeDate(a.getFechaVencimiento()).compareTo(nullSafeDate(b.getFechaVencimiento())))
                .map(tarea -> {
                    TareaDTO dto = mapper.toDTO(tarea);
                    EntregaDTO entrega = entregasPorTarea.get(tarea.getId());
                    Map<String, Object> item = new HashMap<>();
                    item.put("tarea", dto);
                    item.put("entrega", entrega);
                    item.put("status", calcularStatus(tarea, entrega));
                    return item;
                })
                .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("estudiante", mapper.toDTO(estudiante));
        response.put("tareas", tareas);
        response.put("resumen", resumenTareas(tareas));
        return response;
    }

    public TareaDTO createTarea(Tarea tarea) {
        return createTarea(tarea, null);
    }

    public TareaDTO createTarea(Tarea tarea, UserEntity authUser) {
        if (tarea == null || tarea.getTitulo() == null || TextUtils.limpiarTexto(tarea.getTitulo()).isBlank()) {
            throw new BadRequestException("El título de la tarea es obligatorio.");
        }
        tarea.setTitulo(TextUtils.limpiarTexto(tarea.getTitulo()));
        if (tarea.getFechaInicio() != null && tarea.getFechaVencimiento() != null
                && tarea.getFechaVencimiento().isBefore(tarea.getFechaInicio())) {
            throw new BadRequestException("La fecha de vencimiento no puede ser anterior a la fecha de inicio.");
        }
        if (authUser != null) {
            Curso curso = null;
            if (tarea.getCurso() != null && tarea.getCurso().getId() != null && cursoRepository != null) {
                curso = cursoRepository.findById(tarea.getCurso().getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
                tarea.setCurso(curso);
            } else {
                curso = tarea.getCurso();
            }
            AccessControlHelper.requireCourseOwnerOrAdmin(authUser, curso);
        }

        Tarea guardada = tareaRepository.save(tarea);
        if (guardada.getCurso() != null && guardada.getCurso().getId() != null) {
            List<UserEntity> estudiantes = docenteService.obtenerEstudiantesPorCurso(guardada.getCurso().getId());
            notificacionService.notificarNuevaTareaAEstudiantes(guardada, estudiantes);
        }
        return mapper.toDTO(guardada);
    }

    public Optional<TareaDTO> updateTarea(Long id, Tarea datos) {
        return updateTarea(id, datos, null);
    }

    public Optional<TareaDTO> updateTarea(Long id, Tarea datos, UserEntity authUser) {
        return tareaRepository.findById(id).map(tarea -> {
            if (authUser != null) {
                AccessControlHelper.requireCourseOwnerOrAdmin(authUser, tarea.getCurso());
            }
            if (datos.getTitulo() != null) {
                String limpio = TextUtils.limpiarTexto(datos.getTitulo());
                if (limpio.isBlank()) {
                    throw new BadRequestException("El título de la tarea no puede quedar vacío.");
                }
                tarea.setTitulo(limpio);
            }
            if (datos.getDescripcion() != null) tarea.setDescripcion(datos.getDescripcion());
            if (datos.getPrioridad() != null) tarea.setPrioridad(datos.getPrioridad());
            if (datos.getEstado() != null) tarea.setEstado(datos.getEstado());
            if (datos.getFechaInicio() != null) tarea.setFechaInicio(datos.getFechaInicio());
            if (datos.getFechaVencimiento() != null) tarea.setFechaVencimiento(datos.getFechaVencimiento());
            if (tarea.getFechaInicio() != null && tarea.getFechaVencimiento() != null
                    && tarea.getFechaVencimiento().isBefore(tarea.getFechaInicio())) {
                throw new BadRequestException("La fecha de vencimiento no puede ser anterior a la fecha de inicio.");
            }
            if (datos.getPdfUrl() != null) tarea.setPdfUrl(datos.getPdfUrl());
            return mapper.toDTO(tareaRepository.save(tarea));
        });
    }

    @Transactional
    public boolean deleteTarea(Long id) {
        return deleteTarea(id, null);
    }

    @Transactional
    public boolean deleteTarea(Long id, UserEntity authUser) {
        Tarea tarea = tareaRepository.findById(id).orElse(null);
        if (tarea == null) return false;
        if (authUser != null) {
            AccessControlHelper.requireCourseOwnerOrAdmin(authUser, tarea.getCurso());
        }
        List<Entrega> entregas = entregaRepository.findByTarea(tarea);
        if (entregas != null && !entregas.isEmpty()) {
            entregaRepository.deleteAll(entregas);
        }
        tareaRepository.delete(tarea);
        return true;
    }

    private String calcularStatus(Tarea tarea, EntregaDTO entrega) {
        if (entrega != null) return "Completada";
        LocalDate vencimiento = tarea.getFechaVencimiento();
        if (vencimiento != null && LocalDate.now().isAfter(vencimiento)) return "Vencido";
        return "Pendiente";
    }

    private Map<String, Object> resumenTareas(List<Map<String, Object>> tareas) {
        long pendientes = tareas.stream().filter(t -> "Pendiente".equals(t.get("status"))).count();
        long vencidas = tareas.stream().filter(t -> "Vencido".equals(t.get("status"))).count();
        long completadas = tareas.stream().filter(t -> "Completada".equals(t.get("status"))).count();

        Map<String, Object> resumen = new HashMap<>();
        resumen.put("total", tareas.size());
        resumen.put("pendientes", pendientes);
        resumen.put("vencidas", vencidas);
        resumen.put("completadas", completadas);
        return resumen;
    }

    private LocalDate nullSafeDate(LocalDate date) {
        return date != null ? date : LocalDate.MAX;
    }
}
