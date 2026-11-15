package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.dto.MensajeDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.service.MensajeService;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mensajes")
@CrossOrigin(origins = "*")
public class MensajeController {

    @Autowired
    private MensajeService mensajeService;

    @Autowired
    private EntityMapper mapper;

    @PostMapping(value = "/enviar", consumes = "multipart/form-data")
    public MensajeDTO enviar(@RequestParam("remitenteId") Long remitenteId,
                          @RequestParam("destinatarioId") Long destinatarioId,
                          @RequestParam(value = "cursoId", required = false) Long cursoId,
                          @RequestParam(value = "contenido", required = false) String contenido,
                          @RequestParam(value = "archivo", required = false) MultipartFile archivo,
                          HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return mensajeService.enviarMensaje(remitenteId, destinatarioId, cursoId, contenido != null ? contenido : "", archivo);
        }
        return mensajeService.enviarMensaje(remitenteId, destinatarioId, cursoId, contenido != null ? contenido : "", archivo, authUser);
    }

    @GetMapping("/conversacion")
    public List<MensajeDTO> getConversacion(@RequestParam Long u1,
                                            @RequestParam Long u2,
                                            @RequestParam(required = false) Long cursoId,
                                            HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        AccessControlHelper.requireSelfOrAdmin(authUser, u1, "No tienes permiso para acceder a esta conversación.");
        return mensajeService.obtenerConversacion(u1, u2, cursoId);
    }

    @GetMapping("/estudiante/{estudianteId}/bandeja")
    public Map<String, Object> getBandejaEstudiante(
            @PathVariable Long estudianteId,
            @RequestParam(required = false) Long cursoId,
            HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), estudianteId, "No tienes permiso para ver la bandeja de otro estudiante.");
        return mensajeService.obtenerBandejaEstudiante(estudianteId, cursoId);
    }

    @GetMapping("/estudiante/{estudianteId}/conversacion/{contactoId}")
    public Map<String, Object> getConversacionEstudiante(
            @PathVariable Long estudianteId,
            @PathVariable Long contactoId,
            @RequestParam(required = false) Long cursoId,
            HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), estudianteId, "No tienes permiso para acceder a esta conversación.");
        return mensajeService.obtenerConversacionConMetadata(estudianteId, contactoId, cursoId);
    }

    @GetMapping("/docente/{docenteId}/bandeja")
    public Map<String, Object> getBandejaDocente(
            @PathVariable Long docenteId,
            @RequestParam(required = false) Long cursoId,
            HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), docenteId, "No tienes permiso para ver la bandeja de otro docente.");
        return mensajeService.obtenerBandejaDocente(docenteId, cursoId);
    }

    @GetMapping("/docente/{docenteId}/conversacion/{contactoId}")
    public Map<String, Object> getConversacionDocente(
            @PathVariable Long docenteId,
            @PathVariable Long contactoId,
            @RequestParam(required = false) Long cursoId,
            HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), docenteId, "No tienes permiso para acceder a esta conversación.");
        return mensajeService.obtenerConversacionConMetadata(docenteId, contactoId, cursoId);
    }

    @GetMapping("/noleidos/{usuarioId}")
    public Long getMensajesNoLeidos(@PathVariable Long usuarioId, HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), usuarioId, "No tienes permiso para consultar mensajes de otro usuario.");
        return mensajeService.contarMensajesNoLeidos(usuarioId);
    }

    @GetMapping("/contactos-curso/{cursoId}")
    public List<UserDTO> getParticipantesCurso(@PathVariable Long cursoId) {
        return mensajeService.obtenerParticipantesCurso(cursoId).stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/recientes/{usuarioId}")
    public List<Map<String, Object>> getContactosRecientes(@PathVariable Long usuarioId, HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), usuarioId, "No tienes permiso para consultar contactos de otro usuario.");
        return mensajeService.obtenerContactosRecientes(usuarioId);
    }
}
