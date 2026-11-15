package org.example.shidell.util;

import org.example.shidell.model.entity.Aula;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.AulaRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.util.AcademicGroupHelper.AcademicGroup;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

/**
 * Deriva el alcance académico (nivel, grado, sección y turno) de un docente
 * sin almacenarlo como columnas redundantes/nulas en la tabla usuarios:
 * 1) Tutoría de aula fija (modelo Primaria -> aulas.tutor_id).
 * 2) Aulas de cursos asignados (modelo Secundaria / especialidades -> cursos.docente_id -> aulas).
 */
public final class DocenteScopeHelper {

    public static final String MULTIPLE = "Múltiple";
    public static final String POR_ASIGNAR = "POR ASIGNAR";
    private static final String TURNO_ARCHIVADO = "ARCHIVADO";

    private DocenteScopeHelper() {}

    /**
     * Resuelve el grupo o resumen académico activo del docente a partir de sus tutorías y cursos.
     */
    public static AcademicGroup resolve(UserEntity docente, AulaRepository aulaRepository, CursoRepository cursoRepository) {
        if (docente == null) {
            return new AcademicGroup(null, null, null, null, null);
        }

        List<Aula> distinctAulas = collectDistinctActiveAulas(docente, aulaRepository, cursoRepository);
        if (distinctAulas.size() == 1) {
            Aula unica = distinctAulas.get(0);
            return new AcademicGroup(unica.getNivel(), unica.getGrado(), unica.getSeccion(), unica.getTurno(), unica);
        }

        if (distinctAulas.size() > 1) {
            String nivel = summarizeDimension(distinctAulas, Aula::getNivel, true);
            String grado = summarizeDimension(distinctAulas, Aula::getGrado, false);
            String seccion = summarizeDimension(distinctAulas, Aula::getSeccion, false);
            String turno = summarizeDimension(distinctAulas, Aula::getTurno, true);
            return new AcademicGroup(nivel, grado, seccion, turno, null);
        }

        if (hasAnyText(docente.getNivel(), docente.getGrado(), docente.getSeccion(), docente.getTurno())) {
            return new AcademicGroup(docente.getNivel(), docente.getGrado(), docente.getSeccion(), docente.getTurno(), null);
        }

        return new AcademicGroup(POR_ASIGNAR, POR_ASIGNAR, POR_ASIGNAR, POR_ASIGNAR, null);
    }

    private static List<Aula> collectDistinctActiveAulas(UserEntity docente, AulaRepository aulaRepository, CursoRepository cursoRepository) {
        Map<String, Aula> byKey = new LinkedHashMap<>();

        if (docente.getId() != null) {
            for (Aula aula : resolveTutorAulas(docente, aulaRepository)) {
                addIfActive(byKey, aula);
            }
            if (cursoRepository != null) {
                List<Curso> cursos = cursoRepository.findByProfesor(docente);
                if (cursos != null) {
                    for (Curso curso : cursos) {
                        if (curso != null && !isArchived(curso.getTurno())) {
                            addIfActive(byKey, curso.getAula());
                        }
                    }
                }
            }
        }

        return new ArrayList<>(byKey.values());
    }

    private static List<Aula> resolveTutorAulas(UserEntity docente, AulaRepository aulaRepository) {
        if (aulaRepository == null) {
            return List.of();
        }
        List<Aula> aulas = aulaRepository.findByTutorAndAnioEscolar(docente, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL);
        if (aulas != null && !aulas.isEmpty()) {
            return aulas;
        }
        List<Aula> fallback = aulaRepository.findByTutor(docente);
        return fallback != null ? fallback : List.of();
    }

    private static void addIfActive(Map<String, Aula> target, Aula aula) {
        if (aula == null || isArchived(aula.getTurno())) {
            return;
        }
        String key = String.join("|",
                normalize(aula.getNivel()),
                normalize(aula.getGrado()),
                normalize(aula.getSeccion()),
                normalize(aula.getTurno()));
        target.putIfAbsent(key, aula);
    }

    private static String summarizeDimension(List<Aula> aulas, Function<Aula, String> extractor, boolean joinDistinct) {
        Set<String> values = new LinkedHashSet<>();
        for (Aula aula : aulas) {
            String value = extractor.apply(aula);
            if (value != null && !value.isBlank()) {
                values.add(value.trim());
            }
        }
        if (values.isEmpty()) {
            return POR_ASIGNAR;
        }
        if (values.size() == 1) {
            return values.iterator().next();
        }
        return joinDistinct ? String.join(" / ", values) : MULTIPLE;
    }

    private static boolean isArchived(String turno) {
        return TURNO_ARCHIVADO.equalsIgnoreCase(turno != null ? turno.trim() : null);
    }

    private static String normalize(String value) {
        return Objects.toString(value, "").trim().toUpperCase(Locale.ROOT);
    }

    private static boolean hasAnyText(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return true;
            }
        }
        return false;
    }
}
