package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.dto.CalificacionDTO;
import org.example.shidell.model.entity.Calificacion;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.CalificacionService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/calificaciones")
@CrossOrigin(origins = "*")
public class CalificacionController {

    @Autowired
    private CalificacionService calificacionService;

    @GetMapping("/estudiante/{id}")
    public Map<String, Object> getCalificacionesByEstudiante(@PathVariable Long id, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return calificacionService.getCalificacionesByEstudiante(id);
        }
        return calificacionService.getCalificacionesByEstudiante(id, authUser);
    }

    @PostMapping
    public ResponseEntity<CalificacionDTO> createCalificacion(@RequestBody Calificacion datos, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        var created = (authUser == null)
                ? calificacionService.createCalificacion(datos)
                : calificacionService.createCalificacion(datos, authUser);
        return created
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.badRequest().build());
    }
}
