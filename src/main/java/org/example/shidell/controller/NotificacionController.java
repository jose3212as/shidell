package org.example.shidell.controller;

import org.example.shidell.model.entity.Notificacion;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.dto.NotificacionDTO;
import org.example.shidell.repository.NotificacionRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.service.NotificacionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/notificaciones")
@CrossOrigin(origins = "*")
public class NotificacionController {

    @Autowired
    private NotificacionService notificacionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificacionRepository notificacionRepository;

    @GetMapping("/usuario/{usuarioId}")
    public List<NotificacionDTO> getNotificaciones(@PathVariable Long usuarioId) {
        UserEntity usuario = userRepository.findById(usuarioId).orElseThrow();
        return notificacionService.obtenerNotificaciones(usuario);
    }

    @PutMapping("/{id}/leer")
    public void marcarComoLeida(@PathVariable Long id) {
        notificacionService.marcarComoLeida(id);
    }

    // --- ADMIN ENDPOINTS (Merged from NotificationController) ---

    @GetMapping("/admin/todas")
    public List<Notificacion> getAll() {
        return notificacionRepository.findAll();
    }

    @PostMapping("/admin/enviar-a-rol")
    public ResponseEntity<?> enviarARol(@RequestParam String rol, @RequestBody Notificacion base) {
        List<UserEntity> usuarios = userRepository.findByRol(rol);
        for (UserEntity u : usuarios) {
            notificacionService.crearNotificacion(u, base.getTitulo(), base.getMensaje());
        }
        return ResponseEntity.ok("Notificaciones enviadas a " + usuarios.size() + " usuarios.");
    }

    @PostMapping("/admin/enviar-a-usuario/{id}")
    public ResponseEntity<?> enviarAUsuario(@PathVariable Long id, @RequestBody Notificacion base) {
        return userRepository.findById(id).map(u -> {
            notificacionService.crearNotificacion(u, base.getTitulo(), base.getMensaje());
            return ResponseEntity.ok("Enviada");
        }).orElse(ResponseEntity.notFound().build());
    }
}
