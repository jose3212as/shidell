package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.UserService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping
    public List<UserDTO> getAllUsers(HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser != null
                && !AccessControlHelper.isAdmin(authUser)
                && !"DOCENTE".equalsIgnoreCase(AccessControlHelper.normalizedRole(authUser))) {
            throw new ForbiddenException("No tienes permiso para listar todos los usuarios.");
        }
        return userService.getAllUserDTOs();
    }

    @GetMapping("/{id}")
    public UserDTO getUserById(@PathVariable Long id, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return userService.getUserById(id);
        }
        return userService.getUserById(id, authUser);
    }

    @PutMapping("/{id}")
    public UserDTO updateUser(@PathVariable Long id, @RequestBody UserEntity datos, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return userService.updateUser(id, datos);
        }
        return userService.updateUser(id, datos, authUser);
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<Map<String, Object>> changePassword(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        userService.changePassword(
                id,
                payload != null ? payload.get("currentPassword") : null,
                payload != null ? payload.get("newPassword") : null,
                authUser);
        return ResponseEntity.ok(Map.of("ok", true, "message", "Contraseña actualizada correctamente."));
    }

    @PutMapping(value = "/{id}/foto-perfil", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserDTO updateFotoPerfil(@PathVariable Long id, @RequestParam("file") MultipartFile file, HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), id, "No puedes cambiar la foto de otro usuario.");
        return userService.updateFotoPerfil(id, file);
    }

    @PutMapping("/{id}/ping")
    public void pingUser(@PathVariable Long id, HttpServletRequest request) {
        AccessControlHelper.requireSelfOrAdmin(
                AccessControlHelper.getAuthUser(request), id, "No puedes actualizar la conexión de otro usuario.");
        userService.pingUser(id);
    }

    @GetMapping("/contacts/{id}")
    public List<UserDTO> getContacts(@PathVariable Long id, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return userService.getContacts(id);
        }
        return userService.getContacts(id, authUser);
    }

    @GetMapping("/contacts/course/{courseId}")
    public List<UserDTO> getContactsByCourse(@PathVariable Long courseId) {
        return userService.getContactsByCourse(courseId);
    }
}
