package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.dto.TareaDTO;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.TareaService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tareas")
@CrossOrigin(origins = "*")
public class TareaController {

    @Autowired
    private TareaService tareaService;

    @GetMapping
    public List<TareaDTO> getAllTareas() {
        return tareaService.getAllTareas();
    }

    @GetMapping("/seccion")
    public List<TareaDTO> getTareasBySeccion(
            @RequestParam String nivel,
            @RequestParam String grado,
            @RequestParam String seccion,
            @RequestParam(required = false) String turno,
            HttpServletRequest request) {
        return tareaService.getTareasBySeccion(nivel, grado, seccion, turno, AccessControlHelper.getAuthUser(request));
    }

    @GetMapping("/estudiante/{estudianteId}")
    public Map<String, Object> getTareasByEstudiante(@PathVariable Long estudianteId, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return tareaService.getTareasByEstudiante(estudianteId);
        }
        return tareaService.getTareasByEstudiante(estudianteId, authUser);
    }

    @PostMapping
    public TareaDTO createTarea(@RequestBody Tarea tarea, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return tareaService.createTarea(tarea);
        }
        return tareaService.createTarea(tarea, authUser);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TareaDTO> updateTarea(@PathVariable Long id, @RequestBody Tarea datos, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        var updated = (authUser == null)
                ? tareaService.updateTarea(id, datos)
                : tareaService.updateTarea(id, datos, authUser);
        return updated
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTarea(@PathVariable Long id, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        boolean deleted = (authUser == null)
                ? tareaService.deleteTarea(id)
                : tareaService.deleteTarea(id, authUser);
        return deleted
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }
}
