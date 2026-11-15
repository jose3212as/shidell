package org.example.shidell.service;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Evaluacion;
import org.example.shidell.model.entity.Evento;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.util.AcademicCalendarUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Pruebas Unitarias - CalendarioMineduService (Perú 4 Bimestres)")
class CalendarioMineduServiceTest {

    private final CalendarioMineduService service = new CalendarioMineduService();

    private Curso buildCursoDemo() {
        UserEntity docente = new UserEntity();
        docente.setId(99L);
        docente.setNombres("Prof. Roberto");
        docente.setApellidos("Alvarado");

        Curso c = new Curso();
        c.setId(10L);
        c.setNombre("Matemática");
        c.setDiaSemana(3);
        c.setHoraInicio("13:30");
        c.setHoraFin("15:00");
        c.setProfesor(docente);
        return c;
    }

    @Test
    @DisplayName("Construye exactamente 8 exámenes formales por año: Parcial + Bimestral por cada uno de los 4 bimestres")
    void construyeOchoExamenesPorBimestre() {
        Curso curso = buildCursoDemo();
        List<Evaluacion> plan = service.construirEvaluacionesBimestrales(curso, 2026);

        assertEquals(8, plan.size());

        Set<Integer> bimestres = plan.stream().map(Evaluacion::getBimestre).collect(Collectors.toSet());
        assertEquals(Set.of(1, 2, 3, 4), bimestres);

        for (int b = 1; b <= 4; b++) {
            final int bim = b;
            List<Evaluacion> delBim = plan.stream().filter(e -> e.getBimestre() == bim).toList();
            assertEquals(2, delBim.size(), "Cada bimestre debe tener Examen Parcial y Examen Bimestral");
            assertTrue(delBim.stream().anyMatch(e -> e.getTitulo().startsWith("Examen Parcial") && Double.valueOf(1.5).equals(e.getPeso())));
            assertTrue(delBim.stream().anyMatch(e -> e.getTitulo().startsWith("Examen Bimestral") && Double.valueOf(2.0).equals(e.getPeso())));
        }

        for (Evaluacion ev : plan) {
            assertEquals("EXAMEN", ev.getTipo());
            assertEquals(20.0, ev.getNotaMaxima());
            assertNotNull(ev.getFecha());
            assertFalse(AcademicCalendarUtil.esFeriado(ev.getFecha()), "El examen no debe caer en feriado nacional");
            assertNotEquals(DayOfWeek.SATURDAY, ev.getFecha().getDayOfWeek());
            assertNotEquals(DayOfWeek.SUNDAY, ev.getFecha().getDayOfWeek());
        }
    }

    @Test
    @DisplayName("Genera 8 eventos EXAMEN de calendario consistentes con los 4 bimestres")
    void generaOchoEventosExamenEnCalendario() {
        Curso curso = buildCursoDemo();
        List<Evento> eventos = service.generarEventosExamenesAnuales(curso, 2026);

        assertEquals(8, eventos.size());
        assertTrue(eventos.stream().allMatch(e -> "EXAMEN".equals(e.getTipo())));
        assertTrue(eventos.stream().anyMatch(e -> e.getTitulo().equals("Examen Parcial 1 - Matemática")));
        assertTrue(eventos.stream().anyMatch(e -> e.getTitulo().equals("Examen Bimestral 4 - Matemática")));
    }

    @Test
    @DisplayName("Las 36 fechas de entrega semanales corresponden biunívocamente a las semanas lectivas 1..36 y evitan feriados")
    void fechasSemanalesMapeanASuSemanaExacta() {
        LocalDate ref = LocalDate.of(2026, 11, 14);
        for (int semana = 1; semana <= AcademicCalendarUtil.TOTAL_SEMANAS; semana++) {
            LocalDate ini = CalendarioMineduService.fechaInicioEnSemana(2026, semana);
            LocalDate fin = CalendarioMineduService.fechaVencimientoEnSemana(2026, semana);

            assertFalse(fin.isBefore(ini));
            assertEquals(semana, AcademicCalendarUtil.resolverSemanaTarea(fin, ini, ref),
                    "Semana " + semana + " debe resolver exactamente al mismo índice");
            if (!ini.equals(fin)) {
                assertFalse(AcademicCalendarUtil.esFeriado(fin));
            }
        }
    }
}
