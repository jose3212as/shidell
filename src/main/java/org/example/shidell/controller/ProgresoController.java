package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.ProgresoService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/progreso")
@CrossOrigin(origins = "*")
public class ProgresoController {

    @Autowired
    private ProgresoService progresoService;

    @GetMapping("/estudiante/{id}")
    public Map<String, Object> getProgresoEstudiante(@PathVariable("id") Long id, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return progresoService.getProgresoEstudiante(id);
        }
        return progresoService.getProgresoEstudiante(id, authUser);
    }
}
