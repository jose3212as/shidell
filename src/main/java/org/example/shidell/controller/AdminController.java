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
import java.util.Objects;

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
    private AsistenciaRepository asistenciaRepository;
    @Autowired
    private AulaRepository aulaRepository;
    @Autowired
    private MatriculaRepository matriculaRepository;
    @Autowired
    private EntityMapper mapper;
    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        Map<String, Object> res = new HashMap<>();

        var allUsers = userRepository.findAll();

        // Roles activos (excluir ARCHIVADO)
        long estudiantes = allUsers.stream().filter(u -> "ESTUDIANTE".equalsIgnoreCase(u.getRol())).count();
        long docentes    = allUsers.stream().filter(u -> "DOCENTE".equalsIgnoreCase(u.getRol())).count();
        long padres      = allUsers.stream().filter(u -> "PADRE".equalsIgnoreCase(u.getRol())).count();
        long admins      = allUsers.stream().filter(u -> "ADMINISTRADOR".equalsIgnoreCase(u.getRol())).count();

        res.put("totalUsuarios",    estudiantes + docentes + padres + admins);
        res.put("totalEstudiantes", estudiantes);
        res.put("totalDocentes",    docentes);
        res.put("totalPadres",      padres);

        // Aulas únicas activas (nivel+grado+seccion+turno distintos)
        var cursosActivos = cursoRepository.findAll().stream().filter(this::esCursoActivo).toList();
        long aulasTotal = cursosActivos.stream()
                .map(c -> c.getNivel() + "|" + c.getGrado() + "|" + c.getSeccion() + "|" + c.getTurno())
                .distinct().count();
        long aulasPrimaria   = cursosActivos.stream()
                .filter(c -> "PRIMARIA".equalsIgnoreCase(c.getNivel()))
                .map(c -> c.getGrado() + "|" + c.getSeccion())
                .distinct().count();
        long aulasSecundaria = cursosActivos.stream()
                .filter(c -> "SECUNDARIA".equalsIgnoreCase(c.getNivel()))
                .map(c -> c.getGrado() + "|" + c.getSeccion())
                .distinct().count();

        res.put("totalAulas",        aulasTotal);
        res.put("aulasPrimaria",     aulasPrimaria);
        res.put("aulasSecundaria",   aulasSecundaria);
        res.put("totalCursos",       cursosActivos.size());  // sesiones de malla
        res.put("totalMensajes",     mensajeRepository.count());
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
        if (user.getPassword() != null && !user.getPassword().isBlank()) {
            user.setPassword(authSessionService.hashPassword(user.getPassword()));
        }
        UserEntity savedUser = userRepository.save(user);

        if ("ESTUDIANTE".equalsIgnoreCase(savedUser.getRol()) && user.getNivel() != null) {
            org.example.shidell.model.entity.Aula aula = aulaRepository.findByNivelAndGradoAndSeccionAndTurnoAndAnioEscolar(
                    user.getNivel(), user.getGrado(), user.getSeccion(), user.getTurno(), 2026)
                    .orElseGet(() -> aulaRepository.save(new org.example.shidell.model.entity.Aula(user.getNivel(), user.getGrado(), user.getSeccion(), user.getTurno(), 2026)));
            
            org.example.shidell.model.entity.Matricula m = new org.example.shidell.model.entity.Matricula();
            m.setEstudiante(savedUser);
            m.setAula(aula);
            m.setAnioEscolar(2026);
            m.setFechaMatricula(java.time.LocalDate.now());
            m.setEstado("ACTIVO");
            matriculaRepository.save(m);
        }

        return mapper.toDTO(savedUser);
    }
    @PutMapping("/usuarios/{id}")
    public UserDTO updateUsuario(@PathVariable Long id, @RequestBody UserEntity datos) {
        return userRepository.findById(id).map(user -> {
            if (datos.getNombres() != null) user.setNombres(datos.getNombres());
            if (datos.getApellidos() != null) user.setApellidos(datos.getApellidos());
            if (datos.getDni() != null) user.setDni(datos.getDni());
            if (datos.getTelefono() != null) user.setTelefono(datos.getTelefono());
            if (datos.getFechaNacimiento() != null) user.setFechaNacimiento(datos.getFechaNacimiento());
            if (datos.getSexo() != null) user.setSexo(datos.getSexo());
            if (datos.getDireccion() != null) user.setDireccion(datos.getDireccion());
            if (datos.getTipoSangre() != null) user.setTipoSangre(datos.getTipoSangre());
            if (datos.getEstadoCivil() != null) user.setEstadoCivil(datos.getEstadoCivil());
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
            
            UserEntity savedUser = userRepository.save(user);

            if ("ESTUDIANTE".equalsIgnoreCase(savedUser.getRol()) && datos.getNivel() != null) {
                org.example.shidell.model.entity.Aula aula = aulaRepository.findByNivelAndGradoAndSeccionAndTurnoAndAnioEscolar(
                        datos.getNivel(), datos.getGrado(), datos.getSeccion(), datos.getTurno(), 2026)
                        .orElseGet(() -> aulaRepository.save(new org.example.shidell.model.entity.Aula(datos.getNivel(), datos.getGrado(), datos.getSeccion(), datos.getTurno(), 2026)));
                
                org.example.shidell.model.entity.Matricula m = matriculaRepository.findByEstudianteAndAnioEscolar(savedUser, 2026).orElseGet(org.example.shidell.model.entity.Matricula::new);
                m.setEstudiante(savedUser);
                m.setAula(aula);
                if (m.getId() == null) {
                    m.setAnioEscolar(2026);
                    m.setFechaMatricula(java.time.LocalDate.now());
                    m.setEstado("ACTIVO");
                }
                matriculaRepository.save(m);
            }

            return mapper.toDTO(savedUser);
        }).orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    }
    @DeleteMapping("/usuarios/{id}")
    public void deleteUsuario(@PathVariable Long id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        // Ya se permite eliminar docentes
        userRepository.deleteById(id);
    }
    @GetMapping("/cursos")
    public List<CursoDTO> getAllCursos() {
        return cursoRepository.findAll().stream().filter(this::esCursoActivo).map(mapper::toDTO).toList();
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
            } else {
                curso.setProfesor(null);
            }

            // Validar choque de horarios
            List<Curso> todosCursos = cursoRepository.findAll();
            for (Curso c : todosCursos) {
                if (c.getId().equals(curso.getId())) continue;
                if (!Objects.equals(c.getDiaSemana(), curso.getDiaSemana())) continue;
                
                java.time.LocalTime start1 = curso.getHoraInicioLocalTime();
                java.time.LocalTime end1 = curso.getHoraFinLocalTime();
                java.time.LocalTime start2 = c.getHoraInicioLocalTime();
                java.time.LocalTime end2 = c.getHoraFinLocalTime();
                
                if (start1 != null && end1 != null && start2 != null && end2 != null) {
                    if (start1.isBefore(end2) && start2.isBefore(end1)) {
                        // Hay cruce de horario
                        // Verificar si es el mismo profesor
                        if (curso.getProfesor() != null && c.getProfesor() != null 
                            && curso.getProfesor().getId().equals(c.getProfesor().getId())) {
                            throw new org.example.shidell.exception.BadRequestException("Choque de horario: El profesor ya dicta el curso '" + c.getNombre() + "' en ese horario.");
                        }
                        // Verificar si es la misma aula
                        if (Objects.equals(curso.getNivel(), c.getNivel()) 
                            && Objects.equals(curso.getGrado(), c.getGrado()) 
                            && Objects.equals(curso.getSeccion(), c.getSeccion())
                            && Objects.equals(curso.getTurno(), c.getTurno())) {
                            throw new org.example.shidell.exception.BadRequestException("Choque de horario: El aula ya tiene el curso '" + c.getNombre() + "' en ese horario.");
                        }
                    }
                }
            }

            return mapper.toDTO(cursoRepository.save(curso));
        }).orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
    }
    @DeleteMapping("/cursos/{id}")
    public void deleteCurso(@PathVariable Long id) {
        throw new ForbiddenException("La malla de cursos es fija. Los cursos no se eliminan desde administración.");
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
        if (req.nivel == null || req.grado == null || req.turno == null || req.seccionOrigen == null || req.seccionDestino == null) {
            throw new org.example.shidell.exception.BadRequestException("Todos los campos son obligatorios.");
        }
        if (req.seccionOrigen.equalsIgnoreCase(req.seccionDestino)) {
            throw new org.example.shidell.exception.BadRequestException("La sección origen y destino no pueden ser iguales.");
        }

        // Buscar cursos de origen
        List<Curso> origenCursos = cursoRepository.findByGrupoAcademico(req.nivel, req.grado, req.seccionOrigen, req.turno);
        if (origenCursos.isEmpty()) {
            throw new org.example.shidell.exception.BadRequestException("No hay cursos en la sección origen para clonar.");
        }

        // Verificar si el destino ya tiene cursos
        List<Curso> destinoCursos = cursoRepository.findByGrupoAcademico(req.nivel, req.grado, req.seccionDestino, req.turno);
        if (!destinoCursos.isEmpty()) {
            throw new org.example.shidell.exception.BadRequestException("La sección destino ya tiene cursos creados.");
        }

        // Obtener o crear aula de destino
        org.example.shidell.model.entity.Aula aulaDestino = aulaRepository.findByNivelAndGradoAndSeccionAndTurnoAndAnioEscolar(
                req.nivel, req.grado, req.seccionDestino, req.turno, 2026)
                .orElseGet(() -> aulaRepository.save(new org.example.shidell.model.entity.Aula(req.nivel, req.grado, req.seccionDestino, req.turno, 2026)));

        // Clonar
        List<Curso> clones = new java.util.ArrayList<>();
        for (Curso c : origenCursos) {
            Curso clone = new Curso();
            clone.setNombre(c.getNombre());
            clone.setAula(aulaDestino);
            clone.setColor(c.getColor());
            clone.setIcono(c.getIcono());
            clone.setDiaSemana(c.getDiaSemana());
            clone.setHoraInicio(c.getHoraInicio());
            clone.setHoraFin(c.getHoraFin());
            clone.setProfesor(null); // No copiar profesor
            clones.add(clone);
        }

        return cursoRepository.saveAll(clones).stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/padres/{id}/hijos")
    public List<UserDTO> getHijos(@PathVariable Long id) {
        return userRepository.findByPadreId(id).stream().map(mapper::toDTO).toList();
    }

    private boolean esCursoActivo(Curso curso) {
        return curso != null && !"ARCHIVADO".equalsIgnoreCase(curso.getTurno());
    }
}
