package org.example.shidell.controller;

import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.dto.CursoDTO;
import org.example.shidell.repository.*;
import org.example.shidell.service.AuthSessionService;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired
    private MensajeRepository mensajeRepository;
    @Autowired
    private AuthSessionService authSessionService;
    @Autowired
    private CalificacionRepository calificacionRepository;
    @Autowired
    private TareaRepository tareaRepository;
    @Autowired
    private EntregaRepository entregaRepository;
    @Autowired
    private AsistenciaRepository asistenciaRepository;
    @Autowired
    private EntityMapper mapper;
    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        Map<String, Object> res = new HashMap<>();
        res.put("totalUsuarios", userRepository.count());
        res.put("totalEstudiantes", userRepository.findAll().stream().filter(u -> "ESTUDIANTE".equalsIgnoreCase(u.getRol())).count());
        res.put("totalDocentes", userRepository.findAll().stream().filter(u -> "DOCENTE".equalsIgnoreCase(u.getRol())).count());
        res.put("totalCursos", cursoRepository.count());
        res.put("totalMensajes", mensajeRepository.count());
        return res;
    }
    @GetMapping("/usuarios")
    public List<UserDTO> getAllUsuarios(@RequestParam(required = false) String rol) {
        if (rol != null && !rol.isEmpty()) {
            return userRepository.findAll().stream()
                    .filter(u -> rol.equalsIgnoreCase(u.getRol()))
                    .map(mapper::toDTO)
                    .toList();
        }
        return userRepository.findAll().stream().map(mapper::toDTO).toList();
    }
    @GetMapping("/usuarios/{id}")
    public UserDTO getUsuario(@PathVariable Long id) {
        return mapper.toDTO(userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado")));
    }
    @PostMapping("/usuarios")
    public UserDTO createUsuario(@RequestBody UserEntity user) {
        if ("DOCENTE".equalsIgnoreCase(user.getRol())) {
            throw new ForbiddenException("Los docentes son plazas base del sistema. Edita una plaza docente existente para reemplazos.");
        }
        if (user.getPassword() != null && !user.getPassword().isBlank()) {
            user.setPassword(authSessionService.hashPassword(user.getPassword()));
        }
        return mapper.toDTO(userRepository.save(user));
    }
    @PutMapping("/usuarios/{id}")
    public UserDTO updateUsuario(@PathVariable Long id, @RequestBody UserEntity datos) {
        return userRepository.findById(id).map(user -> {
            if (datos.getNombres() != null) user.setNombres(datos.getNombres());
            if (datos.getApellidos() != null) user.setApellidos(datos.getApellidos());
            if (datos.getEmail() != null) user.setEmail(datos.getEmail());
            if (datos.getRol() != null) user.setRol(datos.getRol());
            if (datos.getNivel() != null) user.setNivel(datos.getNivel());
            if (datos.getGrado() != null) user.setGrado(datos.getGrado());
            if (datos.getSeccion() != null) user.setSeccion(datos.getSeccion());
            if (datos.getTurno() != null) user.setTurno(datos.getTurno());
            if (datos.getFotoPerfil() != null) user.setFotoPerfil(datos.getFotoPerfil());
            if (datos.getPadre() != null) user.setPadre(datos.getPadre());
            if (datos.getTutor() != null) user.setTutor(datos.getTutor());
            if (datos.getPassword() != null && !datos.getPassword().isBlank())
                user.setPassword(authSessionService.hashPassword(datos.getPassword()));
            return mapper.toDTO(userRepository.save(user));
        }).orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    }
    @DeleteMapping("/usuarios/{id}")
    public void deleteUsuario(@PathVariable Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        if ("DOCENTE".equalsIgnoreCase(user.getRol())) {
            throw new ForbiddenException("No se eliminan plazas docentes base. Edita sus datos para reemplazar al profesor.");
        }
        userRepository.deleteById(id);
    }
    @GetMapping("/cursos")
    public List<CursoDTO> getAllCursos() {
        return cursoRepository.findAll().stream().map(mapper::toDTO).toList();
    }
    @PostMapping("/cursos")
    public CursoDTO createCurso(@RequestBody Curso curso) {
        throw new ForbiddenException("La malla de cursos es fija. Edita cursos existentes para ajustar docente u horario.");
    }
    @PutMapping("/cursos/{id}")
    public CursoDTO updateCurso(@PathVariable Long id, @RequestBody Curso datos) {
        return cursoRepository.findById(id).map(curso -> {
            if (datos.getNombre() != null) curso.setNombre(datos.getNombre());
            if (datos.getNivel() != null) curso.setNivel(datos.getNivel());
            if (datos.getGrado() != null) curso.setGrado(datos.getGrado());
            if (datos.getSeccion() != null) curso.setSeccion(datos.getSeccion());
            if (datos.getTurno() != null) curso.setTurno(datos.getTurno());
            if (datos.getColor() != null) curso.setColor(datos.getColor());
            if (datos.getIcono() != null) curso.setIcono(datos.getIcono());
            if (datos.getDiaSemana() != null) curso.setDiaSemana(datos.getDiaSemana());
            if (datos.getHoraInicio() != null) curso.setHoraInicio(datos.getHoraInicio());
            if (datos.getHoraFin() != null) curso.setHoraFin(datos.getHoraFin());
            if (datos.getProfesor() != null && datos.getProfesor().getId() != null) {
                userRepository.findById(datos.getProfesor().getId()).ifPresent(curso::setProfesor);
            }
            return mapper.toDTO(cursoRepository.save(curso));
        }).orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
    }
    @DeleteMapping("/cursos/{id}")
    public void deleteCurso(@PathVariable Long id) {
        throw new ForbiddenException("La malla de cursos es fija. Los cursos no se eliminan desde administración.");
    }

    @GetMapping("/padres/{id}/hijos")
    public List<UserDTO> getHijos(@PathVariable Long id) {
        return userRepository.findByPadreId(id).stream().map(mapper::toDTO).toList();
    }
}
