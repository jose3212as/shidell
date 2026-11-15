package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.CursoDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.Aula;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Matricula;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.*;
import org.example.shidell.util.AcademicGroupHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/**
 * Operaciones administrativas sobre estadísticas, usuarios, aulas, matrículas y cursos.
 */
@Service
public class AdminService {

    private static final Set<String> ROLES_ADMIN_VALIDOS = Set.of(
            "ESTUDIANTE", "DOCENTE", "PADRE", "ADMIN", "ADMINISTRADOR"
    );

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired
    private MensajeRepository mensajeRepository;
    @Autowired
    private AuthSessionService authSessionService;
    @Autowired
    private AulaRepository aulaRepository;
    @Autowired
    private MatriculaRepository matriculaRepository;
    @Autowired
    private EntityMapper mapper;

    public Map<String, Object> getStats() {
        Map<String, Object> res = new HashMap<>();

        long estudiantes = userRepository.countByRol("ESTUDIANTE");
        long docentes = userRepository.countByRol("DOCENTE");
        long padres = userRepository.countByRol("PADRE");
        long admins = userRepository.countByRol("ADMINISTRADOR");

        res.put("totalUsuarios", estudiantes + docentes + padres + admins);
        res.put("totalEstudiantes", estudiantes);
        res.put("totalDocentes", docentes);
        res.put("totalPadres", padres);

        var cursosActivos = cursoRepository.findAll().stream().filter(this::esCursoActivo).toList();
        long aulasTotal = cursosActivos.stream()
                .map(c -> c.getNivel() + "|" + c.getGrado() + "|" + c.getSeccion() + "|" + c.getTurno())
                .distinct().count();
        long aulasPrimaria = contarAulasPorNivel(cursosActivos, "PRIMARIA");
        long aulasSecundaria = contarAulasPorNivel(cursosActivos, "SECUNDARIA");

        res.put("totalAulas", aulasTotal);
        res.put("aulasPrimaria", aulasPrimaria);
        res.put("aulasSecundaria", aulasSecundaria);
        res.put("totalCursos", cursosActivos.size());
        res.put("totalMensajes", mensajeRepository.count());
        return res;
    }

    public List<UserDTO> getAllUsuarios(String rol) {
        List<UserEntity> lista = (rol != null && !rol.isBlank())
                ? userRepository.findByRol(rol.toUpperCase())
                : userRepository.findAll();
        return lista.stream().map(mapper::toDTO).toList();
    }

    public UserDTO getUsuario(Long id) {
        return mapper.toDTO(userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado")));
    }

    public UserDTO createUsuario(UserEntity user) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            throw new BadRequestException("El correo electrónico es obligatorio.");
        }
        String emailNorm = user.getEmail().trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByEmail(emailNorm).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un usuario con ese correo electrónico.");
        }
        user.setEmail(emailNorm);

        if (user.getRol() != null && !user.getRol().isBlank()) {
            String rolNorm = user.getRol().trim().toUpperCase(Locale.ROOT);
            if (!ROLES_ADMIN_VALIDOS.contains(rolNorm)) {
                throw new BadRequestException("Rol de usuario no permitido: " + user.getRol());
            }
            user.setRol("ADMIN".equals(rolNorm) ? "ADMINISTRADOR" : rolNorm);
        } else {
            throw new BadRequestException("El rol del usuario es obligatorio.");
        }

        if (user.getPassword() != null && !user.getPassword().isBlank()) {
            if (user.getPassword().trim().length() < 6) {
                throw new BadRequestException("La contraseña debe tener al menos 6 caracteres.");
            }
            user.setPassword(authSessionService.hashPassword(user.getPassword()));
        }
        UserEntity savedUser = userRepository.save(user);
        asegurarMatriculaSiEstudiante(savedUser, user.getNivel(), user.getGrado(), user.getSeccion(), user.getTurno());
        return mapper.toDTO(savedUser);
    }

    public UserDTO updateUsuario(Long id, UserEntity datos) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        if (datos.getNombres() != null) user.setNombres(datos.getNombres());
        if (datos.getApellidos() != null) user.setApellidos(datos.getApellidos());
        if (datos.getDni() != null) user.setDni(datos.getDni());
        if (datos.getTelefono() != null) user.setTelefono(datos.getTelefono());
        if (datos.getFechaNacimiento() != null) user.setFechaNacimiento(datos.getFechaNacimiento());
        if (datos.getSexo() != null) user.setSexo(datos.getSexo());
        if (datos.getDireccion() != null) user.setDireccion(datos.getDireccion());
        if (datos.getTipoSangre() != null) user.setTipoSangre(datos.getTipoSangre());
        if (datos.getEstadoCivil() != null) user.setEstadoCivil(datos.getEstadoCivil());
        if (datos.getEmail() != null && !datos.getEmail().isBlank()) {
            String emailNorm = datos.getEmail().trim().toLowerCase(Locale.ROOT);
            if (!emailNorm.equalsIgnoreCase(user.getEmail())) {
                userRepository.findByEmail(emailNorm).ifPresent(existing -> {
                    if (!Objects.equals(existing.getId(), user.getId())) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otro usuario con ese correo electrónico.");
                    }
                });
            }
            user.setEmail(emailNorm);
        }
        if (datos.getRol() != null && !datos.getRol().isBlank()) {
            String rolNorm = datos.getRol().trim().toUpperCase(Locale.ROOT);
            if (!ROLES_ADMIN_VALIDOS.contains(rolNorm)) {
                throw new BadRequestException("Rol de usuario no permitido: " + datos.getRol());
            }
            user.setRol("ADMIN".equals(rolNorm) ? "ADMINISTRADOR" : rolNorm);
        }
        if (datos.getNivel() != null) user.setNivel(datos.getNivel());
        if (datos.getGrado() != null) user.setGrado(datos.getGrado());
        if (datos.getSeccion() != null) user.setSeccion(datos.getSeccion());
        if (datos.getTurno() != null) user.setTurno(datos.getTurno());
        if (datos.getFotoPerfil() != null) user.setFotoPerfil(datos.getFotoPerfil());
        if (datos.getPadre() != null) user.setPadre(datos.getPadre());
        if (datos.getTutor() != null) user.setTutor(datos.getTutor());
        if (datos.getPassword() != null && !datos.getPassword().isBlank()) {
            if (datos.getPassword().trim().length() < 6) {
                throw new BadRequestException("La contraseña debe tener al menos 6 caracteres.");
            }
            user.setPassword(authSessionService.hashPassword(datos.getPassword()));
        }

        UserEntity savedUser = userRepository.save(user);
        asegurarMatriculaSiEstudiante(savedUser, datos.getNivel(), datos.getGrado(), datos.getSeccion(), datos.getTurno());
        return mapper.toDTO(savedUser);
    }

    @Transactional
    public void deleteUsuario(Long id) {
        deleteUsuario(id, null);
    }

    @Transactional
    public void deleteUsuario(Long id, UserEntity authUser) {
        if (authUser != null && Objects.equals(authUser.getId(), id)) {
            throw new BadRequestException("No puedes eliminar tu propia cuenta administrativa.");
        }
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        List<Curso> cursosAsignados = cursoRepository.findByProfesor(user);
        if (cursosAsignados != null && !cursosAsignados.isEmpty()) {
            throw new IllegalStateException("El docente tiene " + cursosAsignados.size()
                    + " cursos asignados. Reasígnalos antes de eliminar su cuenta.");
        }
        List<Matricula> matriculas = matriculaRepository.findByEstudiante(user);
        if (matriculas != null && !matriculas.isEmpty()) {
            matriculaRepository.deleteAll(matriculas);
        }
        userRepository.deleteById(id);
    }

    public List<CursoDTO> getAllCursos() {
        return cursoRepository.findAll().stream()
                .filter(this::esCursoActivo)
                .map(mapper::toDTO)
                .toList();
    }

    public CursoDTO updateCurso(Long id, Curso datos) {
        Curso curso = cursoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));

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
            UserEntity prof = userRepository.findById(datos.getProfesor().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Docente asignado no encontrado."));
            curso.setProfesor(prof);
        } else {
            curso.setProfesor(null);
        }

        validarChoqueHorarios(curso);
        return mapper.toDTO(cursoRepository.save(curso));
    }

    public List<CursoDTO> clonarCursos(String nivel, String grado, String turno, String seccionOrigen, String seccionDestino) {
        if (nivel == null || grado == null || turno == null || seccionOrigen == null || seccionDestino == null) {
            throw new BadRequestException("Todos los campos son obligatorios.");
        }
        if (seccionOrigen.equalsIgnoreCase(seccionDestino)) {
            throw new BadRequestException("La sección origen y destino no pueden ser iguales.");
        }

        List<Curso> origenCursos = cursoRepository.findByGrupoAcademico(nivel, grado, seccionOrigen, turno);
        if (origenCursos.isEmpty()) {
            throw new BadRequestException("No hay cursos en la sección origen para clonar.");
        }

        List<Curso> destinoCursos = cursoRepository.findByGrupoAcademico(nivel, grado, seccionDestino, turno);
        if (!destinoCursos.isEmpty()) {
            throw new BadRequestException("La sección destino ya tiene cursos creados.");
        }

        Aula aulaDestino = resolverOCrearAula(nivel, grado, seccionDestino, turno);
        List<Curso> clones = new ArrayList<>();
        for (Curso c : origenCursos) {
            Curso clone = new Curso();
            clone.setNombre(c.getNombre());
            clone.setAula(aulaDestino);
            clone.setColor(c.getColor());
            clone.setIcono(c.getIcono());
            clone.setDiaSemana(c.getDiaSemana());
            clone.setHoraInicio(c.getHoraInicio());
            clone.setHoraFin(c.getHoraFin());
            clone.setProfesor(null);
            clones.add(clone);
        }

        return cursoRepository.saveAll(clones).stream().map(mapper::toDTO).toList();
    }

    public List<UserDTO> getHijos(Long padreId) {
        return userRepository.findByPadreId(padreId).stream().map(mapper::toDTO).toList();
    }

    public void prohibirCreacionCurso() {
        throw new ForbiddenException("La malla de cursos es fija. Edita cursos existentes para ajustar docente u horario.");
    }

    public void prohibirEliminacionCurso() {
        throw new ForbiddenException("La malla de cursos es fija. Los cursos no se eliminan desde administración.");
    }

    private long contarAulasPorNivel(List<Curso> cursosActivos, String nivel) {
        return cursosActivos.stream()
                .filter(c -> nivel.equalsIgnoreCase(c.getNivel()))
                .map(c -> c.getGrado() + "|" + c.getSeccion())
                .distinct()
                .count();
    }

    private void asegurarMatriculaSiEstudiante(UserEntity user, String nivel, String grado, String seccion, String turno) {
        if (!"ESTUDIANTE".equalsIgnoreCase(user.getRol()) || nivel == null) {
            return;
        }
        Aula aula = resolverOCrearAula(nivel, grado, seccion, turno);
        Matricula m = matriculaRepository.findByEstudianteAndAnioEscolar(user, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL)
                .orElseGet(Matricula::new);
        m.setEstudiante(user);
        m.setAula(aula);
        if (m.getId() == null) {
            m.setAnioEscolar(AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL);
            m.setFechaMatricula(LocalDate.now());
            m.setEstado("ACTIVO");
        }
        matriculaRepository.save(m);
    }

    private Aula resolverOCrearAula(String nivel, String grado, String seccion, String turno) {
        return aulaRepository.findByNivelAndGradoAndSeccionAndTurnoAndAnioEscolar(
                        nivel, grado, seccion, turno, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL)
                .orElseGet(() -> aulaRepository.save(
                        new Aula(nivel, grado, seccion, turno, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL)));
    }

    private void validarChoqueHorarios(Curso curso) {
        LocalTime start1 = curso.getHoraInicioLocalTime();
        LocalTime end1 = curso.getHoraFinLocalTime();
        if (start1 == null || end1 == null) return;
        if (!start1.isBefore(end1)) {
            throw new BadRequestException("La hora de fin debe ser posterior a la hora de inicio.");
        }

        for (Curso c : cursoRepository.findAll()) {
            if (c.getId().equals(curso.getId())) continue;
            if (!Objects.equals(c.getDiaSemana(), curso.getDiaSemana())) continue;

            LocalTime start2 = c.getHoraInicioLocalTime();
            LocalTime end2 = c.getHoraFinLocalTime();
            if (start2 == null || end2 == null || !start1.isBefore(end2) || !start2.isBefore(end1)) continue;

            if (curso.getProfesor() != null && c.getProfesor() != null
                    && curso.getProfesor().getId().equals(c.getProfesor().getId())) {
                throw new BadRequestException("Choque de horario: El profesor ya dicta el curso '" + c.getNombre() + "' en ese horario.");
            }
            if (Objects.equals(curso.getNivel(), c.getNivel())
                    && Objects.equals(curso.getGrado(), c.getGrado())
                    && Objects.equals(curso.getSeccion(), c.getSeccion())
                    && Objects.equals(curso.getTurno(), c.getTurno())) {
                throw new BadRequestException("Choque de horario: El aula ya tiene el curso '" + c.getNombre() + "' en ese horario.");
            }
        }
    }

    private boolean esCursoActivo(Curso curso) {
        return curso != null && !"ARCHIVADO".equalsIgnoreCase(curso.getTurno());
    }
}
