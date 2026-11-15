package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.dto.CursoDTO;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.CursoService;
import org.example.shidell.util.AccessControlHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cursos")
@CrossOrigin(origins = "*")
public class CursoController {

    @Autowired
    private CursoService cursoService;

    @GetMapping
    public List<CursoDTO> getAllCursos() {
        return cursoService.getAllCursos();
    }

    @GetMapping("/{id}")
    public CursoDTO getCursoById(@PathVariable Long id) {
        return cursoService.getCursoById(id);
    }

    @GetMapping("/{id}/detalle")
    public Map<String, Object> getCursoDetalleById(@PathVariable Long id) {
        return cursoService.getCursoDetalleById(id);
    }

    @GetMapping("/seccion")
    public List<CursoDTO> getCursosBySeccion(
            @RequestParam String nivel,
            @RequestParam String grado,
            @RequestParam String seccion,
            @RequestParam(required = false) String turno) {
        return cursoService.getCursosBySeccion(nivel, grado, seccion, turno);
    }

    @GetMapping("/estudiante/{estudianteId}/detalle")
    public Map<String, Object> getCursosDetalleEstudiante(@PathVariable Long estudianteId, HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return cursoService.getCursosDetalleEstudiante(estudianteId);
        }
        return cursoService.getCursosDetalleEstudiante(estudianteId, authUser);
    }

    @GetMapping("/{cursoId}/semanas/{semana}/foro")
    public List<Map<String, Object>> getForoSemana(@PathVariable Long cursoId, @PathVariable Integer semana) {
        return cursoService.getForoSemana(cursoId, semana);
    }

    @PostMapping("/{cursoId}/semanas/{semana}/foro")
    public Map<String, Object> crearMensajeForo(
            @PathVariable Long cursoId,
            @PathVariable Integer semana,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        if (authUser == null) {
            return cursoService.crearMensajeForo(cursoId, semana, body);
        }
        return cursoService.crearMensajeForo(cursoId, semana, body, authUser);
    }

    @DeleteMapping("/{cursoId}/semanas/{semana}/foro/{mensajeId}")
    public ResponseEntity<Void> eliminarMensajeForo(
            @PathVariable Long cursoId,
            @PathVariable Integer semana,
            @PathVariable Long mensajeId,
            HttpServletRequest request) {
        UserEntity authUser = AccessControlHelper.getAuthUser(request);
        boolean deleted = (authUser == null)
                ? cursoService.eliminarMensajeForo(mensajeId)
                : cursoService.eliminarMensajeForo(mensajeId, authUser);
        return deleted
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }

    @GetMapping("/{cursoId}/foros/resumen")
    public List<Map<String, Object>> getResumenForos(@PathVariable Long cursoId) {
        return cursoService.getResumenForos(cursoId);
    }
}
