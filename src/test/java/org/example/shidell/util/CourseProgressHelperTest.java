package org.example.shidell.util;

import org.example.shidell.model.entity.ForoSemanaMensaje;
import org.example.shidell.model.entity.Tarea;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Pruebas Unitarias - CourseProgressHelper y AcademicCalendarUtil")
class CourseProgressHelperTest {

    private static final Long ESTUDIANTE_ID = 100L;
    private static final Long DOCENTE_ID = 200L;
    private static final LocalDate REF_DATE = LocalDate.of(2026, 11, 12);

    private Tarea crearTarea(Long id, LocalDate vencimiento) {
        Tarea t = new Tarea();
        t.setId(id);
        t.setTitulo("Tarea " + id);
        t.setFechaInicio(vencimiento.minusDays(2));
        t.setFechaVencimiento(vencimiento);
        return t;
    }

    private ForoSemanaMensaje crearForo(int semana, Long autorId) {
        ForoSemanaMensaje m = new ForoSemanaMensaje();
        m.setSemana(semana);
        m.setAutorId(autorId);
        m.setContenido("Mensaje semana " + semana);
        return m;
    }

    @Test
    @DisplayName("1 semana con todas las tareas completadas sobre 36 semanas equivale a 3%")
    void unaSemanaCompleta_retorna3PorCiento() {
        Tarea semana28 = crearTarea(1L, LocalDate.of(2026, 10, 21));

        CourseProgressHelper.WeeklyProgressSummary summary = CourseProgressHelper.calcularProgresoSemanal(
                ESTUDIANTE_ID,
                List.of(semana28),
                Set.of(1L),
                List.of(),
                AcademicCalendarUtil.TOTAL_SEMANAS,
                REF_DATE
        );

        assertThat(summary.totalSemanas()).isEqualTo(36);
        assertThat(summary.semanasConActividades()).isEqualTo(1);
        assertThat(summary.semanasCompletadas()).isEqualTo(1);
        assertThat(summary.porcentajeAvance()).isEqualTo(3);
    }

    @Test
    @DisplayName("Semana con 2 tareas y solo 1 entregada no cuenta como semana completada")
    void semanaParcial_noSumaComoCompletada() {
        Tarea t1 = crearTarea(1L, LocalDate.of(2026, 10, 20));
        Tarea t2 = crearTarea(2L, LocalDate.of(2026, 10, 22));

        CourseProgressHelper.WeeklyProgressSummary summary = CourseProgressHelper.calcularProgresoSemanal(
                ESTUDIANTE_ID,
                List.of(t1, t2),
                Set.of(1L),
                List.of(),
                36,
                REF_DATE
        );

        assertThat(summary.semanasConActividades()).isEqualTo(1);
        assertThat(summary.semanasCompletadas()).isEqualTo(0);
        assertThat(summary.tareasTotales()).isEqualTo(2);
        assertThat(summary.tareasCompletadas()).isEqualTo(1);
        assertThat(summary.porcentajeAvance()).isEqualTo(0);
    }

    @Test
    @DisplayName("Si el docente abrió foro en la semana, exige participación del estudiante además de las tareas")
    void semanaConForoAbierto_exigeParticipacion() {
        Tarea t1 = crearTarea(1L, LocalDate.of(2026, 10, 20));
        ForoSemanaMensaje aperturaDocente = crearForo(28, DOCENTE_ID);

        CourseProgressHelper.WeeklyProgressSummary sinForo = CourseProgressHelper.calcularProgresoSemanal(
                ESTUDIANTE_ID, List.of(t1), Set.of(1L), List.of(aperturaDocente), 36, REF_DATE);
        assertThat(sinForo.forosAbiertos()).isEqualTo(1);
        assertThat(sinForo.forosParticipados()).isEqualTo(0);
        assertThat(sinForo.semanasCompletadas()).isEqualTo(0);
        assertThat(sinForo.porcentajeAvance()).isEqualTo(0);

        ForoSemanaMensaje aporteAlumno = crearForo(28, ESTUDIANTE_ID);
        CourseProgressHelper.WeeklyProgressSummary conForo = CourseProgressHelper.calcularProgresoSemanal(
                ESTUDIANTE_ID, List.of(t1), Set.of(1L), List.of(aperturaDocente, aporteAlumno), 36, REF_DATE);
        assertThat(conForo.forosAbiertos()).isEqualTo(1);
        assertThat(conForo.forosParticipados()).isEqualTo(1);
        assertThat(conForo.semanasCompletadas()).isEqualTo(1);
        assertThat(conForo.porcentajeAvance()).isEqualTo(3);
    }

    @Test
    @DisplayName("2 semanas completadas (una solo foro y otra tarea+foro) suman 2/36 = 6% y excluyen semanas vacías")
    void dosSemanasCompletadas_retorna6PorCiento() {
        Tarea tSemana19 = crearTarea(10L, LocalDate.of(2026, 8, 13));
        List<ForoSemanaMensaje> foros = List.of(
                crearForo(19, DOCENTE_ID),
                crearForo(19, ESTUDIANTE_ID),
                crearForo(28, DOCENTE_ID),
                crearForo(28, ESTUDIANTE_ID)
        );

        CourseProgressHelper.WeeklyProgressSummary summary = CourseProgressHelper.calcularProgresoSemanal(
                ESTUDIANTE_ID, List.of(tSemana19), Set.of(10L), foros, 36, REF_DATE);

        assertThat(summary.semanasConActividades()).isEqualTo(2);
        assertThat(summary.semanasCompletadas()).isEqualTo(2);
        assertThat(summary.porcentajeAvance()).isEqualTo(6);
    }

    @Test
    @DisplayName("AcademicCalendarUtil mapea fechas dentro y fuera de bloque a su semana 1..36")
    void resolverSemanaLectiva_mapeaCorrectamente() {
        assertThat(AcademicCalendarUtil.resolverSemanaLectiva(LocalDate.of(2026, 3, 18), REF_DATE)).isEqualTo(1);
        assertThat(AcademicCalendarUtil.resolverSemanaLectiva(LocalDate.of(2026, 8, 8), REF_DATE)).isEqualTo(19);
        assertThat(AcademicCalendarUtil.resolverSemanaLectiva(LocalDate.of(2026, 10, 19), REF_DATE)).isEqualTo(28);
    }
}
