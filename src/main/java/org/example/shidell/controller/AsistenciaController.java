package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.entity.Asistencia;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.dto.AsistenciaDTO;
import org.example.shidell.repository.AsistenciaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.exception.ForbiddenException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/asistencia")
@CrossOrigin(origins = "*")
public class AsistenciaController {

    @Autowired
    private org.example.shidell.service.AsistenciaService asistenciaService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityMapper mapper;

    @GetMapping("/estudiante/{estudianteId}")
    public List<AsistenciaDTO> getAsistenciaEstudiante(
            @PathVariable Long estudianteId,
            HttpServletRequest request) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        
        validarAcceso(estudiante, (UserEntity) request.getAttribute("authUser"));

        return asistenciaService.getAsistenciasCompletas(estudiante).stream()
                .sorted(Comparator.comparing(Asistencia::getFecha, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(mapper::toDTO)
                .peek(dto -> {
                    // Lógica adicional que estaba en el controlador anterior
                    String estado = dto.getEstado() != null ? dto.getEstado().toUpperCase(Locale.ROOT) : "AUSENTE";
                    dto.setAsistio(!"AUSENTE".equals(estado));
                    dto.setDescripcion(descripcionEstado(estado));
                })
                .toList();
    }

    private void validarAcceso(UserEntity estudiante, UserEntity authUser) {
        if (authUser == null) return;
        String rol = authUser.getRol() == null ? "" : authUser.getRol().toUpperCase(Locale.ROOT);
        if ("ADMIN".equals(rol) || "ADMINISTRADOR".equals(rol) || "DOCENTE".equals(rol)) return;
        if ("ESTUDIANTE".equals(rol) && authUser.getId() != null && authUser.getId().equals(estudiante.getId())) return;
        if ("PADRE".equals(rol)
                && estudiante.getPadre() != null
                && estudiante.getPadre().getId() != null
                && estudiante.getPadre().getId().equals(authUser.getId())) {
            return;
        }
        throw new ForbiddenException("No tienes acceso a la asistencia de este estudiante");
    }

    private String descripcionEstado(String estado) {
        return switch (estado) {
            case "PRESENTE" -> "Asistió";
            case "TARDE" -> "Asistió tarde";
            case "JUSTIFICADO" -> "Falta justificada";
            default -> "No asistió";
        };
    }
}
