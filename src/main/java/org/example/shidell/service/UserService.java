package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.FileUploadUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;
    @Autowired(required = false)
    private CursoRepository cursoRepository;
    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;
    @Autowired(required = false)
    private AuthSessionService authSessionService;
    @Autowired(required = false)
    private EntityMapper mapper;

    public List<UserEntity> getAllUsers() {
        return userRepository.findAll();
    }

    public List<UserDTO> getAllUserDTOs() {
        return userRepository.findAll().stream().map(mapper::toDTO).toList();
    }

    public UserDTO getUserById(Long id) {
        return getUserById(id, null);
    }

    public UserDTO getUserById(Long id, UserEntity authUser) {
        UserEntity target = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        if (authUser != null && !AccessControlHelper.isAdmin(authUser) && !Objects.equals(authUser.getId(), target.getId())) {
            if ("ESTUDIANTE".equalsIgnoreCase(target.getRol())) {
                AccessControlHelper.requireStudentAccess(
                        authUser,
                        target,
                        cursoRepository,
                        matriculaRepository,
                        "No tienes permiso para ver este perfil."
                );
            } else {
                AccessControlHelper.requireSelfOrAdmin(authUser, id, "No tienes permiso para ver este perfil.");
            }
        }
        return mapper.toDTO(target);
    }

    public UserDTO updateUser(Long id, UserEntity datos) {
        return updateUser(id, datos, null);
    }

    public UserDTO updateUser(Long id, UserEntity datos, UserEntity authUser) {
        if (authUser != null) {
            AccessControlHelper.requireSelfOrAdmin(authUser, id, "No tienes permiso para editar el perfil de otro usuario.");
        }
        UserEntity user = userRepository.findById(id).orElseThrow();

        if (datos.getNombres() != null) {
            String nombres = datos.getNombres().trim();
            if (nombres.isEmpty()) {
                throw new BadRequestException("El nombre no puede estar vacío.");
            }
            user.setNombres(nombres);
        }
        if (datos.getApellidos() != null) {
            String apellidos = datos.getApellidos().trim();
            if (apellidos.isEmpty()) {
                throw new BadRequestException("Los apellidos no pueden estar vacíos.");
            }
            user.setApellidos(apellidos);
        }
        if (datos.getEmail() != null && !datos.getEmail().isBlank()) {
            String emailNorm = datos.getEmail().trim().toLowerCase(Locale.ROOT);
            if (!emailNorm.equalsIgnoreCase(user.getEmail())) {
                if (authUser != null && !AccessControlHelper.isAdmin(authUser)) {
                    throw new ForbiddenException("El correo institucional solo puede ser modificado por Administración Académica.");
                }
                userRepository.findByEmail(emailNorm).ifPresent(existing -> {
                    if (!Objects.equals(existing.getId(), user.getId())) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "El correo ya está registrado por otro usuario.");
                    }
                });
                user.setEmail(emailNorm);
            }
        }
        if (AccessControlHelper.isAdmin(authUser) || authUser == null) {
            if (datos.getNivel() != null) user.setNivel(datos.getNivel());
            if (datos.getGrado() != null) user.setGrado(datos.getGrado());
            if (datos.getSeccion() != null) user.setSeccion(datos.getSeccion());
            if (datos.getTurno() != null) user.setTurno(datos.getTurno());
        }
        if (datos.getTelefono() != null) {
            String tel = datos.getTelefono().trim();
            if (tel.length() > 30) {
                throw new BadRequestException("El teléfono no puede superar 30 caracteres.");
            }
            user.setTelefono(tel.isEmpty() ? null : tel);
        }
        if (datos.getDireccion() != null) {
            String dir = datos.getDireccion().trim();
            if (dir.length() > 160) {
                throw new BadRequestException("La dirección no puede superar 160 caracteres.");
            }
            user.setDireccion(dir.isEmpty() ? null : dir);
        }
        if (datos.getFotoPerfil() != null) {
            String fp = datos.getFotoPerfil().trim();
            if (fp.toLowerCase(Locale.ROOT).startsWith("javascript:")) {
                throw new BadRequestException("URL de imagen inválida.");
            }
            user.setFotoPerfil(fp.isEmpty() ? null : fp);
        }
        if (datos.getPassword() != null && !datos.getPassword().isBlank()) {
            if (authUser != null && datos.getPassword().trim().length() < 6) {
                throw new BadRequestException("La contraseña debe tener al menos 6 caracteres.");
            }
            user.setPassword(authSessionService.hashPassword(datos.getPassword()));
        }

        return mapper.toDTO(userRepository.save(user));
    }

    /**
     * Cambia la contraseña de un usuario verificando su contraseña actual (excepto si un admin restablece a un tercero).
     */
    public void changePassword(Long id, String currentPassword, String newPassword, UserEntity authUser) {
        if (authUser != null) {
            AccessControlHelper.requireSelfOrAdmin(authUser, id, "No tienes permiso para cambiar la contraseña de otro usuario.");
        }
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        String actual = currentPassword == null ? "" : currentPassword;
        String nueva = newPassword == null ? "" : newPassword.trim();

        boolean requiereValidarActual = authUser == null
                || !AccessControlHelper.isAdmin(authUser)
                || Objects.equals(authUser.getId(), id);

        if (requiereValidarActual) {
            if (actual.isBlank()) {
                throw new BadRequestException("Debes ingresar tu contraseña actual.");
            }
            if (authSessionService == null || !authSessionService.matchesPassword(user.getPassword(), actual)) {
                throw new BadRequestException("La contraseña actual es incorrecta.");
            }
        }
        if (nueva.length() < 6) {
            throw new BadRequestException("La nueva contraseña debe tener al menos 6 caracteres.");
        }
        if (!actual.isEmpty() && actual.equals(nueva)) {
            throw new BadRequestException("La nueva contraseña debe ser diferente a la actual.");
        }

        user.setPassword(authSessionService.hashPassword(nueva));
        userRepository.save(user);
    }

    public UserDTO updateFotoPerfil(Long id, MultipartFile file) {
        UserEntity user = userRepository.findById(id).orElseThrow();
        String fotoUrl = FileUploadUtil.saveFile("perfiles", file);
        if (fotoUrl == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar la imagen en el servidor.");
        }
        user.setFotoPerfil(fotoUrl);
        return mapper.toDTO(userRepository.save(user));
    }

    public void pingUser(Long id) {
        userRepository.findById(id).ifPresent(user -> {
            user.setUltimaConexion(LocalDateTime.now());
            userRepository.save(user);
        });
    }

    public List<UserDTO> getContacts(Long id) {
        return getContacts(id, null);
    }

    public List<UserDTO> getContacts(Long id, UserEntity authUser) {
        UserEntity user = userRepository.findById(id).orElseThrow();
        if (authUser != null) {
            AccessControlHelper.requireParentOrSelfOrAdmin(
                    authUser, user, "No tienes permiso para consultar los contactos de otro usuario.");
        }
        boolean soloDocentesYTutor = "PADRE".equals(AccessControlHelper.normalizedRole(authUser));
        List<UserEntity> contacts = new ArrayList<>();
        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(user, matriculaRepository);

        if (grupo.isComplete()) {
            if (!soloDocentesYTutor) {
                List<UserEntity> classmates = userRepository.findByGrupoAcademico(
                        grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno());
                classmates.removeIf(u -> u.getId().equals(id));
                contacts.addAll(classmates);
            }

            for (Curso curso : AcademicGroupHelper.preferActiveCourses(
                    cursoRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno()))) {
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

    public List<UserDTO> getContactsByCourse(Long courseId) {
        Curso curso = cursoRepository.findById(courseId).orElseThrow();
        List<UserEntity> contacts = new ArrayList<>();

        if (curso.getProfesor() != null) {
            contacts.add(curso.getProfesor());
        }

        contacts.addAll(userRepository.findByGrupoAcademico(
                curso.getNivel(), curso.getGrado(), curso.getSeccion(), curso.getTurno()));

        return contacts.stream().map(mapper::toDTO).toList();
    }
}
