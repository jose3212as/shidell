package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.model.entity.Notificacion;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.dto.NotificacionDTO;
import org.example.shidell.repository.NotificacionRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.service.NotificacionService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public List<NotificacionDTO> getNotificaciones(@PathVariable Long usuarioId, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        AccessControlHelper.requireSelfOrAdmin(authUser, usuarioId, "No tienes permiso para ver notificaciones de otro usuario.");
        UserEntity usuario = userRepository.findById(usuarioId).orElseThrow();
        if ("PADRE".equalsIgnoreCase(usuario.getRol())) {
            notificacionService.verificarYAlertarTareasVencidasParaPadre(usuario);
        }
        return notificacionService.obtenerNotificaciones(usuario);
    }

    @PutMapping("/{id}/leer")
    public void marcarComoLeida(@PathVariable Long id, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser != null) {
            Notificacion notif = notificacionRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Notificación no encontrada"));
            Long ownerId = notif.getUsuario() != null ? notif.getUsuario().getId() : null;
            AccessControlHelper.requireSelfOrAdmin(authUser, ownerId, "No tienes permiso para modificar esta notificación.");
        }
        notificacionService.marcarComoLeida(id);
    }

    // --- ADMIN ENDPOINTS (Merged from NotificationController) ---

    @GetMapping("/admin/todas")
    public List<Notificacion> getAll(HttpServletRequest request) {
        AccessControlHelper.requireAdmin(AccessControlHelper.getAuthUser(request));
        return notificacionRepository.findAll();
    }

    @PostMapping("/admin/enviar-a-rol")
    public ResponseEntity<?> enviarARol(@RequestParam String rol, @RequestBody Notificacion base, HttpServletRequest request) {
        AccessControlHelper.requireAdmin(AccessControlHelper.getAuthUser(request));
        if (base == null || base.getTitulo() == null || base.getTitulo().isBlank()
                || base.getMensaje() == null || base.getMensaje().isBlank()) {
            throw new BadRequestException("El título y mensaje de la notificación son obligatorios.");
        }
        List<UserEntity> usuarios = userRepository.findByRol(rol);
        for (UserEntity u : usuarios) {
            notificacionService.crearNotificacion(u, base.getTitulo(), base.getMensaje());
        }
        return ResponseEntity.ok("Notificaciones enviadas a " + usuarios.size() + " usuarios.");
    }

    @PostMapping("/admin/enviar-a-usuario/{id}")
    public ResponseEntity<?> enviarAUsuario(@PathVariable Long id, @RequestBody Notificacion base, HttpServletRequest request) {
        AccessControlHelper.requireAdmin(AccessControlHelper.getAuthUser(request));
        if (base == null || base.getTitulo() == null || base.getTitulo().isBlank()
                || base.getMensaje() == null || base.getMensaje().isBlank()) {
            throw new BadRequestException("El título y mensaje de la notificación son obligatorios.");
        }
        return userRepository.findById(id).map(u -> {
            notificacionService.crearNotificacion(u, base.getTitulo(), base.getMensaje());
            return ResponseEntity.ok("Enviada");
        }).orElse(ResponseEntity.notFound().build());
    }
}
