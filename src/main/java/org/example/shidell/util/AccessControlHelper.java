package org.example.shidell.util;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.MatriculaRepository;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Validaciones centralizadas de propiedad y alcance académico (anti-IDOR) para endpoints API.
 */
public final class AccessControlHelper {

    private AccessControlHelper() {}

    public static UserEntity getAuthUser(HttpServletRequest request) {
        if (request == null) return null;
        Object attr = request.getAttribute("authUser");
        return (attr instanceof UserEntity user) ? user : null;
    }

    public static String normalizedRole(UserEntity user) {
        return (user != null && user.getRol() != null)
                ? user.getRol().trim().toUpperCase(Locale.ROOT)
                : "";
    }

    public static boolean isAdmin(UserEntity user) {
        String rol = normalizedRole(user);
        return "ADMIN".equals(rol) || "ADMINISTRADOR".equals(rol);
    }

    public static void requireAdmin(UserEntity authUser) {
        if (authUser == null) return;
        if (!isAdmin(authUser)) {
            throw new ForbiddenException("Acción restringida a administradores.");
        }
    }

    public static void requireSelfOrAdmin(UserEntity authUser, Long targetUserId, String message) {
        if (authUser == null || isAdmin(authUser)) return;
        if (targetUserId != null && Objects.equals(authUser.getId(), targetUserId)) return;
        throw new ForbiddenException(message);
    }

    public static void requireStudentAccess(
            UserEntity authUser,
            UserEntity estudiante,
            CursoRepository cursoRepository,
            MatriculaRepository matriculaRepository,
            String message) {
        if (authUser == null || isAdmin(authUser)) return;
        if (estudiante == null) {
            throw new ForbiddenException(message);
        }

        String rol = normalizedRole(authUser);
        if ("ESTUDIANTE".equals(rol) && Objects.equals(authUser.getId(), estudiante.getId())) {
            return;
        }
        if ("PADRE".equals(rol)
                && estudiante.getPadre() != null
                && Objects.equals(estudiante.getPadre().getId(), authUser.getId())) {
            return;
        }
        if ("DOCENTE".equals(rol) && docenteHasStudentAccess(authUser, estudiante, cursoRepository, matriculaRepository)) {
            return;
        }
        throw new ForbiddenException(message);
    }

    public static void requireParentOrSelfOrAdmin(UserEntity authUser, UserEntity estudiante, String message) {
        if (authUser == null || isAdmin(authUser)) return;
        if (estudiante == null) {
            throw new ForbiddenException(message);
        }
        String rol = normalizedRole(authUser);
        if ("ESTUDIANTE".equals(rol) && Objects.equals(authUser.getId(), estudiante.getId())) {
            return;
        }
        if ("PADRE".equals(rol)
                && estudiante.getPadre() != null
                && Objects.equals(estudiante.getPadre().getId(), authUser.getId())) {
            return;
        }
        throw new ForbiddenException(message);
    }

    public static void requireCourseOwnerOrAdmin(UserEntity authUser, Curso curso) {
        if (authUser == null || isAdmin(authUser)) return;
        String rol = normalizedRole(authUser);
        if ("DOCENTE".equals(rol)
                && curso != null
                && curso.getProfesor() != null
                && Objects.equals(curso.getProfesor().getId(), authUser.getId())) {
            return;
        }
        throw new ForbiddenException("No tienes permiso para gestionar este curso.");
    }

    public static boolean sameAcademicGroup(
            UserEntity estudiante, Curso curso, MatriculaRepository matriculaRepository) {
        if (estudiante == null || curso == null) return false;
        boolean cursoHasGroup = curso.getNivel() != null && curso.getGrado() != null && curso.getSeccion() != null;
        if (!cursoHasGroup) return true;
        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);
        if (!grupo.isComplete()) return false;
        return matchesGroup(grupo, curso);
    }

    public static boolean docenteHasStudentAccess(
            UserEntity docente,
            UserEntity estudiante,
            CursoRepository cursoRepository,
            MatriculaRepository matriculaRepository) {
        if (docente == null) return false;
        if (cursoRepository == null) return true;
        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);
        if (!grupo.isComplete()) return true;
        List<Curso> cursosDocente = cursoRepository.findByProfesor(docente);
        if (cursosDocente == null) return false;
        for (Curso curso : cursosDocente) {
            if (curso == null || "ARCHIVADO".equalsIgnoreCase(curso.getTurno())) continue;
            if (matchesGroup(grupo, curso)) return true;
        }
        return false;
    }

    private static boolean matchesGroup(AcademicGroupHelper.AcademicGroup grupo, Curso curso) {
        if (curso == null || !grupo.isComplete()) return false;
        boolean baseMatch = TextUtils.normalizar(grupo.nivel()).equals(TextUtils.normalizar(curso.getNivel()))
                && TextUtils.normalizar(grupo.grado()).equals(TextUtils.normalizar(curso.getGrado()))
                && TextUtils.normalizar(grupo.seccion()).equals(TextUtils.normalizar(curso.getSeccion()));
        if (!baseMatch) return false;

        String tGrupo = TextUtils.normalizar(grupo.turno());
        String tCurso = TextUtils.normalizar(curso.getTurno());
        return tGrupo.isBlank() || tCurso.isBlank() || tGrupo.equals(tCurso);
    }
}
