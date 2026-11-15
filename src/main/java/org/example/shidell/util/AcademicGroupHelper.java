package org.example.shidell.util;

import org.example.shidell.model.entity.Aula;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Matricula;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.MatriculaRepository;

import java.util.List;

/**
 * Resuelve de forma uniforme el grupo académico (nivel, grado, sección, turno y aula)
 * de un estudiante, priorizando su matrícula vigente y haciendo fallback a los campos
 * transitorios de {@link UserEntity}.
 */
public final class AcademicGroupHelper {

    public static final int ANIO_ESCOLAR_ACTUAL = 2026;

    private AcademicGroupHelper() {}

    public record AcademicGroup(String nivel, String grado, String seccion, String turno, Aula aula) {
        public boolean isComplete() {
            return nivel != null && grado != null && seccion != null;
        }
    }

    public static AcademicGroup resolve(UserEntity estudiante, MatriculaRepository matriculaRepository) {
        if (estudiante == null) {
            return new AcademicGroup(null, null, null, null, null);
        }

        Matricula matricula = findActiveMatricula(estudiante, matriculaRepository);
        if (matricula != null && matricula.getAula() != null) {
            Aula aula = matricula.getAula();
            return new AcademicGroup(
                    aula.getNivel(),
                    aula.getGrado(),
                    aula.getSeccion(),
                    aula.getTurno(),
                    aula
            );
        }

        return new AcademicGroup(
                estudiante.getNivel(),
                estudiante.getGrado(),
                estudiante.getSeccion(),
                estudiante.getTurno(),
                null
        );
    }

    public static AcademicGroup resolveWithDefaultTurno(UserEntity estudiante, MatriculaRepository matriculaRepository) {
        AcademicGroup base = resolve(estudiante, matriculaRepository);
        String turno = base.turno();
        if (turno == null || turno.isBlank()) {
            turno = "PRIMARIA".equalsIgnoreCase(base.nivel()) ? "MAÑANA" : "TARDE";
        }
        return new AcademicGroup(base.nivel(), base.grado(), base.seccion(), turno, base.aula());
    }

    /**
     * Prioriza cursos activos (turno != ARCHIVADO) sobre cursos heredados archivados;
     * si un aula solo posee cursos archivados, los conserva para no dejarla sin materias.
     */
    public static List<Curso> preferActiveCourses(List<Curso> cursos) {
        if (cursos == null || cursos.isEmpty()) {
            return List.of();
        }
        List<Curso> activos = cursos.stream()
                .filter(c -> c != null && !"ARCHIVADO".equalsIgnoreCase(c.getTurno()))
                .toList();
        return activos.isEmpty() ? cursos : activos;
    }

    private static Matricula findActiveMatricula(UserEntity estudiante, MatriculaRepository matriculaRepository) {
        if (matriculaRepository == null) {
            return null;
        }
        Matricula actual = matriculaRepository.findByEstudianteAndAnioEscolar(estudiante, ANIO_ESCOLAR_ACTUAL)
                .orElse(null);
        if (actual != null) {
            return actual;
        }
        List<Matricula> historial = matriculaRepository.findByEstudiante(estudiante);
        return (historial != null && !historial.isEmpty()) ? historial.get(0) : null;
    }
}
