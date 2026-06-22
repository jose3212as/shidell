package org.example.shidell.controller;

import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.service.AuthSessionService;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CursoRepository cursoRepository;

    @Autowired
    private AuthSessionService authSessionService;

    @Autowired
    private EntityMapper mapper;

    @GetMapping
    public List<UserDTO> getAllUsers() {
        return userRepository.findAll().stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/{id}")
    public UserDTO getUserById(@PathVariable Long id) {
        return mapper.toDTO(userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado")));
    }

    @PutMapping("/{id}")
    public UserDTO updateUser(@PathVariable Long id, @RequestBody UserEntity datos) {
        UserEntity user = userRepository.findById(id).orElseThrow();

        if (datos.getNombres() != null) user.setNombres(datos.getNombres());
        if (datos.getApellidos() != null) user.setApellidos(datos.getApellidos());
        if (datos.getEmail() != null) user.setEmail(datos.getEmail());
        if (datos.getNivel() != null) user.setNivel(datos.getNivel());
        if (datos.getGrado() != null) user.setGrado(datos.getGrado());
        if (datos.getSeccion() != null) user.setSeccion(datos.getSeccion());
        if (datos.getTurno() != null) user.setTurno(datos.getTurno());
        if (datos.getFotoPerfil() != null) user.setFotoPerfil(datos.getFotoPerfil());
        if (datos.getPassword() != null && !datos.getPassword().isBlank()) 
            user.setPassword(authSessionService.hashPassword(datos.getPassword()));

        return mapper.toDTO(userRepository.save(user));
    }

    @PutMapping("/{id}/foto-perfil")
    public UserDTO updateFotoPerfil(@PathVariable Long id, @RequestBody Map<String, String> datos) {
        UserEntity user = userRepository.findById(id).orElseThrow();
        user.setFotoPerfil(datos.getOrDefault("fotoPerfil", ""));
        return mapper.toDTO(userRepository.save(user));
    }

    @PutMapping("/{id}/ping")
    public void pingUser(@PathVariable Long id) {
        userRepository.findById(id).ifPresent(user -> {
            user.setUltimaConexion(java.time.LocalDateTime.now());
            userRepository.save(user);
        });
    }

    @GetMapping("/contacts/{id}")
    public List<UserDTO> getContacts(@PathVariable Long id) {
        UserEntity user = userRepository.findById(id).orElseThrow();
        List<UserEntity> contacts = new ArrayList<>();
        
        if (user.getNivel() != null && user.getGrado() != null && user.getSeccion() != null) {
            List<UserEntity> classmates = userRepository.findByGrupoAcademico(
                user.getNivel(), user.getGrado(), user.getSeccion(), user.getTurno());
            classmates.removeIf(u -> u.getId().equals(id));
            contacts.addAll(classmates);
            
            List<Curso> cursos = cursoRepository.findByGrupoAcademico(
                user.getNivel(), user.getGrado(), user.getSeccion(), user.getTurno());
            
            for (Curso curso : cursos) {
                if (curso.getProfesor() != null && !contacts.contains(curso.getProfesor())) {
                    contacts.add(curso.getProfesor());
                }
            }
        }
        
        if (user.getTutor() != null && !contacts.contains(user.getTutor())) {
            contacts.add(user.getTutor());
        }
        
        return contacts.stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/contacts/course/{courseId}")
    public List<UserDTO> getContactsByCourse(@PathVariable Long courseId) {
        Curso curso = cursoRepository.findById(courseId).orElseThrow();
        List<UserEntity> contacts = new ArrayList<>();
        
        if (curso.getProfesor() != null) {
            contacts.add(curso.getProfesor());
        }
        
        List<UserEntity> students = userRepository.findByGrupoAcademico(
            curso.getNivel(), curso.getGrado(), curso.getSeccion(), curso.getTurno());
        contacts.addAll(students);
        
        return contacts.stream().map(mapper::toDTO).toList();
    }
}
