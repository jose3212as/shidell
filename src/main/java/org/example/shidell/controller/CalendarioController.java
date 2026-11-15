package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.CalendarioService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/calendario")
@CrossOrigin(origins = "*")
public class CalendarioController {

    @Autowired
    private CalendarioService calendarioService;

    @GetMapping("/estudiante/{estudianteId}")
    public Map<String, Object> getCalendarioEstudiante(@PathVariable Long estudianteId, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return calendarioService.getCalendarioEstudiante(estudianteId);
        }
        return calendarioService.getCalendarioEstudiante(estudianteId, authUser);
    }

    /** Crea un recordatorio personal en el calendario del estudiante autenticado. */
    @PostMapping("/estudiante/{estudianteId}/recordatorios")
    public ResponseEntity<?> crearRecordatorio(
            @PathVariable Long estudianteId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        UserEntity authUser = (request.getAttribute("authUser") instanceof UserEntity u) ? u : null;
        return calendarioService.crearRecordatorio(estudianteId, body, authUser);
    }

    /** Elimina un recordatorio personal del estudiante autenticado. */
    @DeleteMapping("/estudiante/{estudianteId}/recordatorios/{eventoId}")
    public ResponseEntity<?> eliminarRecordatorio(
            @PathVariable Long estudianteId,
            @PathVariable Long eventoId,
            HttpServletRequest request) {
        UserEntity authUser = (request.getAttribute("authUser") instanceof UserEntity u) ? u : null;
        return calendarioService.eliminarRecordatorio(estudianteId, eventoId, authUser);
    }
}
