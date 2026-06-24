package org.example.shidell.service;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Evento;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class CalendarioMineduService {

    // Feriados en Perú para 2026
    private static final List<LocalDate> FERIADOS_2026 = List.of(
            LocalDate.of(2026, 4, 2),  // Jueves Santo
            LocalDate.of(2026, 4, 3),  // Viernes Santo
            LocalDate.of(2026, 5, 1),  // Día del Trabajo
            LocalDate.of(2026, 6, 29), // San Pedro y San Pablo
            LocalDate.of(2026, 7, 28), // Fiestas Patrias
            LocalDate.of(2026, 7, 29), // Fiestas Patrias
            LocalDate.of(2026, 8, 6),  // Batalla de Junín
            LocalDate.of(2026, 10, 8), // Batalla de Angamos
            LocalDate.of(2026, 12, 8), // Inmaculada Concepción
            LocalDate.of(2026, 12, 9)  // Batalla de Ayacucho
    );

    // Final de clases de cada bimestre (la semana de exámenes es esta semana)
    private static final List<LocalDate> FINES_BIMESTRE_2026 = List.of(
            LocalDate.of(2026, 5, 15),  // Fin I Bimestre
            LocalDate.of(2026, 7, 24),  // Fin II Bimestre
            LocalDate.of(2026, 10, 9),  // Fin III Bimestre
            LocalDate.of(2026, 12, 18)  // Fin IV Bimestre
    );

    public List<Evento> generarExamenesBimestrales(Curso curso) {
        List<Evento> examenes = new ArrayList<>();
        if (curso.getDiaSemana() == null || curso.getDiaSemana() < 1 || curso.getDiaSemana() > 7) {
            return examenes; // No se puede programar si no tiene un día válido
        }
        if (curso.getProfesor() == null) {
            return examenes;
        }

        DayOfWeek diaCurso = DayOfWeek.of(curso.getDiaSemana());
        int bimestre = 1;

        for (LocalDate finBimestre : FINES_BIMESTRE_2026) {
            // Buscamos el día correspondiente en la última semana del bimestre
            LocalDate fechaExamen = finBimestre;
            
            // Retrocedemos hasta encontrar el día de la semana que toca el curso
            while (fechaExamen.getDayOfWeek() != diaCurso) {
                fechaExamen = fechaExamen.minusDays(1);
            }

            // Si es feriado, adelantamos el examen una semana antes
            while (FERIADOS_2026.contains(fechaExamen)) {
                fechaExamen = fechaExamen.minusWeeks(1);
            }

            // Crear el evento de tipo EXAMEN
            Evento examen = new Evento();
            examen.setTitulo("Examen Bimestral " + bimestre + " - " + curso.getNombre());
            examen.setDescripcion("Examen fijo programado por el calendario MINEDU.");
            examen.setTipo("EXAMEN");
            examen.setColor("red"); // Los exámenes los marcamos en rojo para que destaquen
            examen.setUsuario(curso.getProfesor());

            LocalTime horaInicio = curso.getHoraInicioLocalTime();
            LocalTime horaFin = curso.getHoraFinLocalTime();
            if (horaInicio == null) horaInicio = LocalTime.of(8, 0);
            if (horaFin == null) horaFin = LocalTime.of(9, 30);

            examen.setFechaInicio(LocalDateTime.of(fechaExamen, horaInicio));
            examen.setFechaFin(LocalDateTime.of(fechaExamen, horaFin));

            examenes.add(examen);
            bimestre++;
        }

        return examenes;
    }
}
