package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.dto.CursoDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.AdminService;
import org.example.shidell.service.SystemConfigService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private SystemConfigService systemConfigService;

    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        return adminService.getStats();
    }

    @GetMapping("/usuarios")
    public List<UserDTO> getAllUsuarios(@RequestParam(required = false) String rol) {
        return adminService.getAllUsuarios(rol);
    }

    @GetMapping("/usuarios/{id}")
    public UserDTO getUsuario(@PathVariable Long id) {
        return adminService.getUsuario(id);
    }

    @PostMapping("/usuarios")
    public UserDTO createUsuario(@RequestBody UserEntity user) {
        return adminService.createUsuario(user);
    }

    @PutMapping("/usuarios/{id}")
    public UserDTO updateUsuario(@PathVariable Long id, @RequestBody UserEntity datos) {
        return adminService.updateUsuario(id, datos);
    }

    @DeleteMapping("/usuarios/{id}")
    public void deleteUsuario(@PathVariable Long id, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            adminService.deleteUsuario(id);
            return;
        }
        adminService.deleteUsuario(id, authUser);
    }

    @GetMapping("/cursos")
    public List<CursoDTO> getAllCursos() {
        return adminService.getAllCursos();
    }

    @PostMapping("/cursos")
    public CursoDTO createCurso(@RequestBody Curso curso) {
        adminService.prohibirCreacionCurso();
        return null;
    }

    @PutMapping("/cursos/{id}")
    public CursoDTO updateCurso(@PathVariable Long id, @RequestBody Curso datos) {
        return adminService.updateCurso(id, datos);
    }

    @DeleteMapping("/cursos/{id}")
    public void deleteCurso(@PathVariable Long id) {
        adminService.prohibirEliminacionCurso();
    }

    public static class CloneRequest {
        public String nivel;
        public String grado;
        public String turno;
        public String seccionOrigen;
        public String seccionDestino;
    }

    @PostMapping("/cursos/clonar")
    public List<CursoDTO> clonarCursos(@RequestBody CloneRequest req) {
        return adminService.clonarCursos(req.nivel, req.grado, req.turno, req.seccionOrigen, req.seccionDestino);
    }

    @GetMapping("/padres/{id}/hijos")
    public List<UserDTO> getHijos(@PathVariable Long id) {
        return adminService.getHijos(id);
    }

    @GetMapping("/config")
    public Map<String, Object> getSystemConfig() {
        return systemConfigService.toPublicConfigMap();
    }

    @PutMapping("/config")
    public Map<String, Object> updateSystemConfig(@RequestBody(required = false) Map<String, String> body) {
        if (body == null || body.isEmpty()) {
            systemConfigService.updateTabTitle(null);
            return systemConfigService.toPublicConfigMap();
        }
        boolean hasTabTitle = body.containsKey("tabTitle");
        boolean hasGradeScale = body.containsKey("gradeScale");
        if (!hasTabTitle && !hasGradeScale) {
            systemConfigService.updateTabTitle(null);
        }
        if (hasTabTitle) {
            systemConfigService.updateTabTitle(body.get("tabTitle"));
        }
        if (hasGradeScale) {
            systemConfigService.updateGradeScale(body.get("gradeScale"));
        }
        return systemConfigService.toPublicConfigMap();
    }

    @PostMapping(value = "/config/icon", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadSystemIcon(@RequestParam("file") MultipartFile file) {
        systemConfigService.updateIcon(file);
        return systemConfigService.toPublicConfigMap();
    }

    @DeleteMapping("/config/icon")
    public Map<String, Object> resetSystemIcon() {
        systemConfigService.resetIcon();
        return systemConfigService.toPublicConfigMap();
    }
}
