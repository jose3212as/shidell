package org.example.shidell.util;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.ForoSemanaMensaje;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.repository.ForoSemanaMensajeRepository;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Calcula el porcentaje de avance de un curso en base a las semanas lectivas
 * (sobre las 36 semanas del ciclo) en las que el estudiante completó todas sus actividades:
 * tareas entregadas y participación en el foro cuando el docente lo inició en esa semana.
 */
public final class CourseProgressHelper {

    private CourseProgressHelper() {}

    public record WeeklyProgressSummary(
            int totalSemanas,
            int semanasConActividades,
            int semanasCompletadas,
            int tareasTotales,
            int tareasCompletadas,
            int forosAbiertos,
            int forosParticipados,
            int porcentajeAvance
    ) {}

    public static WeeklyProgressSummary calcularProgresoMateria(
            Long estudianteId,
            String keyMateria,
            List<Curso> grupoCursos,
            List<Tarea> tareasSeccion,
            Set<Long> tareasEntregadasIds,
            Map<Long, List<ForoSemanaMensaje>> forosPorCursoId,
            int totalSemanas,
            LocalDate fechaReferencia) {

        Set<Long> idsGrupo = grupoCursos.stream()
                .map(Curso::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Tarea> tareasMateria = (tareasSeccion == null ? List.<Tarea>of() : tareasSeccion).stream()
                .filter(t -> t.getCurso() != null && (idsGrupo.contains(t.getCurso().getId())
                        || TextUtils.normalizar(t.getCurso().getNombre()).equals(keyMateria)))
                .toList();

        List<ForoSemanaMensaje> forosMateria = idsGrupo.stream()
                .flatMap(cid -> forosPorCursoId.getOrDefault(cid, List.of()).stream())
                .toList();

        return calcularProgresoSemanal(
                estudianteId, tareasMateria, tareasEntregadasIds, forosMateria, totalSemanas, fechaReferencia);
    }

    public static Map<Long, List<ForoSemanaMensaje>> cargarForosPorCursoId(
            List<Curso> cursos, ForoSemanaMensajeRepository foroRepo) {
        if (foroRepo == null || cursos == null || cursos.isEmpty()) {
            return Map.of();
        }
        List<Long> allCursoIds = cursos.stream()
                .map(Curso::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (allCursoIds.isEmpty()) {
            return Map.of();
        }
        return foroRepo.findByCursoIdInOrderBySemanaAscFechaAsc(allCursoIds).stream()
                .filter(m -> m.getCurso() != null && m.getCurso().getId() != null)
                .collect(Collectors.groupingBy(m -> m.getCurso().getId()));
    }

    public static WeeklyProgressSummary calcularProgresoSemanal(
            Long estudianteId,
            List<Tarea> tareasCurso,
            Set<Long> tareasEntregadasIds,
            List<ForoSemanaMensaje> mensajesForoCurso,
            int totalSemanas,
            LocalDate fechaReferencia) {

        int semanasValidas = Math.max(totalSemanas, 1);
        Set<Long> entregadas = tareasEntregadasIds != null ? tareasEntregadasIds : Set.of();
        LocalDate referencia = fechaReferencia != null ? fechaReferencia : LocalDate.now();

        Map<Integer, List<Tarea>> tareasPorSemana = agruparTareasPorSemana(tareasCurso, semanasValidas, referencia);
        Map<Integer, List<ForoSemanaMensaje>> forosPorSemana = agruparForosPorSemana(mensajesForoCurso, semanasValidas);

        int semanasConActividades = 0;
        int semanasCompletadas = 0;
        int tareasTotales = 0;
        int tareasCompletadas = 0;
        int forosAbiertos = 0;
        int forosParticipados = 0;

        for (int semana = 1; semana <= semanasValidas; semana++) {
            List<Tarea> tareasSemana = tareasPorSemana.getOrDefault(semana, List.of());
            List<ForoSemanaMensaje> msgsSemana = forosPorSemana.getOrDefault(semana, List.of());

            boolean tieneTareas = !tareasSemana.isEmpty();
            boolean tieneForoAbierto = !msgsSemana.isEmpty();
            if (!tieneTareas && !tieneForoAbierto) {
                continue;
            }

            semanasConActividades++;

            int hechas = 0;
            for (Tarea tarea : tareasSemana) {
                if (tarea.getId() != null && entregadas.contains(tarea.getId())) {
                    hechas++;
                }
            }
            tareasTotales += tareasSemana.size();
            tareasCompletadas += hechas;

            boolean foroCompletado = true;
            if (tieneForoAbierto) {
                forosAbiertos++;
                boolean participo = estudianteId != null
                        && msgsSemana.stream().anyMatch(m -> Objects.equals(m.getAutorId(), estudianteId));
                if (participo) {
                    forosParticipados++;
                }
                foroCompletado = participo;
            }

            if (hechas == tareasSemana.size() && foroCompletado) {
                semanasCompletadas++;
            }
        }

        int porcentajeAvance = (int) Math.round((double) semanasCompletadas / semanasValidas * 100.0);
        return new WeeklyProgressSummary(
                semanasValidas,
                semanasConActividades,
                semanasCompletadas,
                tareasTotales,
                tareasCompletadas,
                forosAbiertos,
                forosParticipados,
                porcentajeAvance
        );
    }

    private static Map<Integer, List<Tarea>> agruparTareasPorSemana(
            List<Tarea> tareasCurso, int semanasValidas, LocalDate referencia) {
        Map<Integer, List<Tarea>> mapa = new HashMap<>();
        if (tareasCurso == null || tareasCurso.isEmpty()) {
            return mapa;
        }
        Set<Long> idsVistos = new HashSet<>();
        for (Tarea t : tareasCurso) {
            if (t == null) continue;
            if (t.getId() != null && !idsVistos.add(t.getId())) continue;
            int semana = AcademicCalendarUtil.resolverSemanaTarea(t.getFechaVencimiento(), t.getFechaInicio(), referencia);
            semana = Math.max(1, Math.min(semana, semanasValidas));
            mapa.computeIfAbsent(semana, k -> new ArrayList<>()).add(t);
        }
        return mapa;
    }

    private static Map<Integer, List<ForoSemanaMensaje>> agruparForosPorSemana(
            List<ForoSemanaMensaje> mensajesForoCurso, int semanasValidas) {
        Map<Integer, List<ForoSemanaMensaje>> mapa = new HashMap<>();
        if (mensajesForoCurso == null || mensajesForoCurso.isEmpty()) {
            return mapa;
        }
        for (ForoSemanaMensaje m : mensajesForoCurso) {
            if (m == null || m.getSemana() == null) continue;
            int semana = m.getSemana();
            if (semana < 1 || semana > semanasValidas) continue;
            mapa.computeIfAbsent(semana, k -> new ArrayList<>()).add(m);
        }
        return mapa;
    }
}
