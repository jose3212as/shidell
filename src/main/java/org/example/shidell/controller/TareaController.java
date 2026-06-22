package org.example.shidell.controller;

import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.dto.TareaDTO;
import org.example.shidell.model.dto.EntregaDTO;
import org.example.shidell.repository.EntregaRepository;
import org.example.shidell.repository.TareaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tareas")
@CrossOrigin(origins = "*")
public class TareaController {

    @Autowired
    private TareaRepository tareaRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntregaRepository entregaRepository;

    @Autowired
    private EntityMapper mapper;

    @GetMapping
    public List<TareaDTO> getAllTareas() {
        return tareaRepository.findAll().stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/estudiante/{estudianteId}")
    public Map<String, Object> getTareasByEstudiante(@PathVariable Long estudianteId) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));

        List<Entrega> entregas = entregaRepository.findByEstudiante(estudiante);
        Map<Long, EntregaDTO> entregasPorTarea = entregas.stream()
                .filter(e -> e.getTarea() != null)
                .collect(Collectors.toMap(e -> e.getTarea().getId(), mapper::toDTO, (a, b) -> a));

        List<Map<String, Object>> tareas = tareaRepository
                .findByGrupoAcademico(estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion(), estudiante.getTurno())
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

    @PostMapping
    public TareaDTO createTarea(@RequestBody Tarea tarea) {
        return mapper.toDTO(tareaRepository.save(tarea));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TareaDTO> updateTarea(@PathVariable Long id, @RequestBody Tarea datos) {
        return tareaRepository.findById(id).map(tarea -> {
            if (datos.getTitulo() != null) tarea.setTitulo(datos.getTitulo());
            if (datos.getDescripcion() != null) tarea.setDescripcion(datos.getDescripcion());
            if (datos.getPrioridad() != null) tarea.setPrioridad(datos.getPrioridad());
            if (datos.getEstado() != null) tarea.setEstado(datos.getEstado());
            if (datos.getFechaInicio() != null) tarea.setFechaInicio(datos.getFechaInicio());
            if (datos.getFechaVencimiento() != null) tarea.setFechaVencimiento(datos.getFechaVencimiento());
            if (datos.getPdfUrl() != null) tarea.setPdfUrl(datos.getPdfUrl());
            return ResponseEntity.ok(mapper.toDTO(tareaRepository.save(tarea)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTarea(@PathVariable Long id) {
        if (!tareaRepository.existsById(id)) return ResponseEntity.notFound().build();
        tareaRepository.deleteById(id);
        return ResponseEntity.ok().build();
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
