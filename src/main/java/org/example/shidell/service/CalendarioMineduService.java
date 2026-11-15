package org.example.shidell.service;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Evaluacion;
import org.example.shidell.model.entity.Evento;
import org.example.shidell.util.AcademicCalendarUtil;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Genera el calendario oficial de exámenes y evaluaciones del año escolar peruano (EBR - MINEDU),
 * dividido en 4 bimestres de 9 semanas lectivas cada uno: 2 exámenes formales por bimestre
 * (Examen Parcial a mitad de bimestre en semana 5 y Examen Bimestral al cierre en semana 9).
 */
@Service
public class CalendarioMineduService {

    private static final String[] ROMANOS = {"", "I", "II", "III", "IV"};

    public List<Evento> generarExamenesBimestrales(Curso curso) {
        int anio = LocalDate.now().getYear();
        return generarEventosExamenesAnuales(curso, anio);
    }

    /**
     * Genera los eventos de calendario (Examen Parcial y Examen Bimestral) para los 4 bimestres
     * del año escolar indicado (8 exámenes anuales por asignatura).
     */
    public List<Evento> generarEventosExamenesAnuales(Curso curso, int anio) {
        List<Evento> examenes = new ArrayList<>();
        if (curso == null || curso.getDiaSemana() == null || curso.getDiaSemana() < 1 || curso.getDiaSemana() > 7) {
            return examenes;
        }
        if (curso.getProfesor() == null) {
            return examenes;
        }

        LocalTime horaInicio = curso.getHoraInicioLocalTime();
        LocalTime horaFin = curso.getHoraFinLocalTime();
        if (horaInicio == null) horaInicio = LocalTime.of(8, 0);
        if (horaFin == null) horaFin = LocalTime.of(9, 30);

        for (Evaluacion ev : construirEvaluacionesBimestrales(curso, anio)) {
            Evento evento = new Evento();
            String prefix = ev.getPeso() != null && ev.getPeso() >= 2.0
                    ? "Examen Bimestral " + ev.getBimestre()
                    : "Examen Parcial " + ev.getBimestre();
            evento.setTitulo(prefix + " - " + curso.getNombre());
            evento.setDescripcion("Evaluación oficial por bimestre (calendario MINEDU EBR).");
            evento.setTipo("EXAMEN");
            evento.setColor("red");
            evento.setUsuario(curso.getProfesor());
            evento.setFechaInicio(LocalDateTime.of(ev.getFecha(), horaInicio));
            evento.setFechaFin(LocalDateTime.of(ev.getFecha(), horaFin));
            examenes.add(evento);
        }
        return examenes;
    }

    /**
     * Construye las 8 evaluaciones oficiales de examen del curso (2 por bimestre x 4 bimestres):
     * - Examen Parcial (semana 5 de cada bloque lectivo, peso 1.5, nota máxima 20)
     * - Examen Bimestral (semana 9 de cada bloque lectivo, peso 2.0, nota máxima 20)
     */
    public List<Evaluacion> construirEvaluacionesBimestrales(Curso curso, int anio) {
        List<Evaluacion> plan = new ArrayList<>(8);
        if (curso == null) {
            return plan;
        }
        int diaSemana = (curso.getDiaSemana() != null && curso.getDiaSemana() >= 1 && curso.getDiaSemana() <= 5)
                ? curso.getDiaSemana()
                : 1;
        List<AcademicCalendarUtil.BloqueLectivo> bloques = AcademicCalendarUtil.bloquesLectivos(anio);
        for (AcademicCalendarUtil.BloqueLectivo bloque : bloques) {
            int bimestre = bloque.numero();
            String romano = ROMANOS[Math.max(1, Math.min(4, bimestre))];

            LocalDate fechaParcial = resolverFechaHabilEnBloque(bloque.inicio(), 4, diaSemana);
            Evaluacion parcial = new Evaluacion();
            parcial.setTitulo("Examen Parcial - " + romano + " Bimestre");
            parcial.setTipo("EXAMEN");
            parcial.setBimestre(bimestre);
            parcial.setPeso(1.5);
            parcial.setNotaMaxima(20.0);
            parcial.setFecha(fechaParcial);
            parcial.setCurso(curso);
            plan.add(parcial);

            LocalDate fechaBimestral = resolverFechaHabilEnBloque(bloque.inicio(), 8, diaSemana);
            Evaluacion bimestral = new Evaluacion();
            bimestral.setTitulo("Examen Bimestral - " + romano + " Bimestre");
            bimestral.setTipo("EXAMEN");
            bimestral.setBimestre(bimestre);
            bimestral.setPeso(2.0);
            bimestral.setNotaMaxima(20.0);
            bimestral.setFecha(fechaBimestral);
            bimestral.setCurso(curso);
            plan.add(bimestral);
        }
        return plan;
    }

    /**
     * Calcula una fecha hábil (Lunes-Viernes, evitando feriados nacionales) dentro del bloque lectivo
     * para la semana relativa {@code offsetSemanas} (0..8) y el día de curso indicado.
     */
    public static LocalDate resolverFechaHabilEnBloque(LocalDate inicioBloque, int offsetSemanas, int diaSemana) {
        int diaClamped = Math.max(1, Math.min(5, diaSemana));
        LocalDate candidato = inicioBloque.plusWeeks(offsetSemanas).plusDays(diaClamped - 1L);
        if (!AcademicCalendarUtil.esFeriado(candidato)) {
            return candidato;
        }
        // Intentar otro día hábil dentro de la misma semana lectiva
        LocalDate lunesSemana = inicioBloque.plusWeeks(offsetSemanas);
        for (int offset = 4; offset >= 0; offset--) {
            LocalDate alt = lunesSemana.plusDays(offset);
            if (!AcademicCalendarUtil.esFeriado(alt)) {
                return alt;
            }
        }
        // Fallback: retroceder una semana manteniendo día hábil
        LocalDate semanaPrevia = candidato.minusWeeks(1);
        while (AcademicCalendarUtil.esFeriado(semanaPrevia) || semanaPrevia.getDayOfWeek() == DayOfWeek.SATURDAY || semanaPrevia.getDayOfWeek() == DayOfWeek.SUNDAY) {
            semanaPrevia = semanaPrevia.minusDays(1);
        }
        return semanaPrevia;
    }

    /**
     * Calcula la fecha de entrega (Lunes-Viernes dentro de la semana lectiva 1..36) evitando feriados,
     * garantizando siempre pertenecer al rango lunes-domingo de esa semana exacta.
     */
    public static LocalDate fechaVencimientoEnSemana(int anio, int semanaLectiva) {
        int s = Math.max(1, Math.min(AcademicCalendarUtil.TOTAL_SEMANAS, semanaLectiva));
        int bloqueIdx = (s - 1) / AcademicCalendarUtil.SEMANAS_POR_BLOQUE;
        int semEnBloque = (s - 1) % AcademicCalendarUtil.SEMANAS_POR_BLOQUE;
        LocalDate lunes = AcademicCalendarUtil.iniciosBloquesLectivos(anio).get(bloqueIdx).plusWeeks(semEnBloque);
        for (int offset = 4; offset >= 0; offset--) {
            LocalDate dia = lunes.plusDays(offset);
            if (!AcademicCalendarUtil.esFeriado(dia)) {
                return dia;
            }
        }
        return lunes.plusDays(4);
    }

    public static LocalDate fechaInicioEnSemana(int anio, int semanaLectiva) {
        int s = Math.max(1, Math.min(AcademicCalendarUtil.TOTAL_SEMANAS, semanaLectiva));
        int bloqueIdx = (s - 1) / AcademicCalendarUtil.SEMANAS_POR_BLOQUE;
        int semEnBloque = (s - 1) % AcademicCalendarUtil.SEMANAS_POR_BLOQUE;
        return AcademicCalendarUtil.iniciosBloquesLectivos(anio).get(bloqueIdx).plusWeeks(semEnBloque);
    }
}

