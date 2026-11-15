package org.example.shidell.util;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Utilidades de calendario escolar (bloques lectivos, feriados y cálculo de semanas).
 */
public final class AcademicCalendarUtil {

    public static final int TOTAL_SEMANAS = 36;
    public static final int SEMANAS_POR_BLOQUE = 9;

    public record BloqueLectivo(int numero, String nombre, LocalDate inicio, LocalDate fin, LocalDate finClases) {}

    private AcademicCalendarUtil() {}

    /**
     * Retorna las fechas de inicio de los cuatro bloques lectivos del año escolar indicado.
     */
    public static List<LocalDate> iniciosBloquesLectivos(int anio) {
        return List.of(
                LocalDate.of(anio, 3, 16),
                LocalDate.of(anio, 5, 25),
                LocalDate.of(anio, 8, 10),
                LocalDate.of(anio, 10, 19)
        );
    }

    /**
     * Retorna la definición completa de los 4 bloques lectivos del año escolar indicado.
     */
    public static List<BloqueLectivo> bloquesLectivos(int anio) {
        List<LocalDate> inicios = iniciosBloquesLectivos(anio);
        BloqueLectivo[] bloques = new BloqueLectivo[inicios.size()];
        for (int i = 0; i < inicios.size(); i++) {
            LocalDate inicio = inicios.get(i);
            LocalDate fin = inicio.plusWeeks(SEMANAS_POR_BLOQUE).minusDays(1);
            LocalDate finClases = inicio.plusWeeks(SEMANAS_POR_BLOQUE).minusDays(3);
            bloques[i] = new BloqueLectivo(i + 1, "Bloque " + (i + 1), inicio, fin, finClases);
        }
        return List.of(bloques);
    }

    public static int bloqueDeSemana(int semana) {
        int acotada = Math.max(1, Math.min(semana, TOTAL_SEMANAS));
        return ((acotada - 1) / SEMANAS_POR_BLOQUE) + 1;
    }

    public static boolean esSemanaLectiva(LocalDate fecha) {
        return indiceSemanaLectiva(fecha) >= 0;
    }

    /**
     * Feriados nacionales oficiales del calendario escolar peruano para el año indicado.
     */
    public static Map<LocalDate, String> feriados(int anio) {
        TreeMap<LocalDate, String> ordenados = new TreeMap<>();
        LocalDate pascua = calcularDomingoPascua(anio);
        ordenados.put(pascua.minusDays(3), "Jueves Santo");
        ordenados.put(pascua.minusDays(2), "Viernes Santo");
        ordenados.put(LocalDate.of(anio, 5, 1), "Día del Trabajo");
        ordenados.put(LocalDate.of(anio, 6, 29), "San Pedro y San Pablo");
        ordenados.put(LocalDate.of(anio, 7, 28), "Fiestas Patrias");
        ordenados.put(LocalDate.of(anio, 7, 29), "Fiestas Patrias");
        ordenados.put(LocalDate.of(anio, 8, 6), "Batalla de Junín");
        ordenados.put(LocalDate.of(anio, 10, 8), "Combate de Angamos");
        ordenados.put(LocalDate.of(anio, 12, 8), "Inmaculada Concepción");
        ordenados.put(LocalDate.of(anio, 12, 9), "Batalla de Ayacucho");
        return Collections.unmodifiableMap(new LinkedHashMap<>(ordenados));
    }

    public static boolean esFeriado(LocalDate fecha) {
        return fecha != null && feriados(fecha.getYear()).containsKey(fecha);
    }

    public static String nombreFeriado(LocalDate fecha) {
        return fecha != null ? feriados(fecha.getYear()).get(fecha) : null;
    }

    private static LocalDate calcularDomingoPascua(int anio) {
        int a = anio % 19;
        int b = anio / 100;
        int c = anio % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int mes = (h + l - 7 * m + 114) / 31;
        int dia = ((h + l - 7 * m + 114) % 31) + 1;
        return LocalDate.of(anio, mes, dia);
    }

    /**
     * Calcula el índice base 0 (0..35) de la semana lectiva a la que pertenece la fecha,
     * o -1 si está fuera de los cuatro bloques lectivos.
     */
    public static int indiceSemanaLectiva(LocalDate fecha) {
        if (fecha == null) {
            return -1;
        }
        List<LocalDate> inicios = iniciosBloquesLectivos(fecha.getYear());
        for (int b = 0; b < inicios.size(); b++) {
            LocalDate inicio = inicios.get(b);
            LocalDate fin = inicio.plusWeeks(9).minusDays(1);
            if (!fecha.isBefore(inicio) && !fecha.isAfter(fin)) {
                return b * 9 + (int) ((fecha.toEpochDay() - inicio.toEpochDay()) / 7);
            }
        }
        return -1;
    }

    public static int semanaActualLectiva(LocalDate fecha) {
        int indice = indiceSemanaLectiva(fecha);
        int semana = indice >= 0 ? (indice + 1) : 1;
        return Math.min(semana, TOTAL_SEMANAS);
    }

    /**
     * Resuelve la semana lectiva (1..36) correspondiente a una fecha de actividad.
     * Si la fecha cae fuera de los 4 bloques lectivos (por ejemplo, días previos o vacacionales),
     * selecciona la semana lectiva más cercana del calendario escolar.
     */
    public static int resolverSemanaLectiva(LocalDate fecha, LocalDate fallback) {
        if (fecha == null) {
            return semanaActualLectiva(fallback != null ? fallback : LocalDate.now());
        }
        int indice = indiceSemanaLectiva(fecha);
        if (indice >= 0) {
            return Math.min(indice + 1, TOTAL_SEMANAS);
        }

        List<LocalDate> inicios = iniciosBloquesLectivos(fecha.getYear());
        int mejorSemana = 1;
        long menorDistancia = Long.MAX_VALUE;

        for (int b = 0; b < inicios.size(); b++) {
            LocalDate inicioBloque = inicios.get(b);
            for (int s = 0; s < SEMANAS_POR_BLOQUE; s++) {
                int semana = b * SEMANAS_POR_BLOQUE + s + 1;
                LocalDate ini = inicioBloque.plusWeeks(s);
                LocalDate fin = ini.plusDays(6);
                long distancia = distanciaIntervaloDias(fecha, ini, fin);
                if (distancia < menorDistancia) {
                    menorDistancia = distancia;
                    mejorSemana = semana;
                }
            }
        }
        return Math.min(mejorSemana, TOTAL_SEMANAS);
    }

    public static int resolverSemanaTarea(LocalDate fechaVencimiento, LocalDate fechaInicio, LocalDate fallback) {
        LocalDate fechaObjetivo = fechaVencimiento != null ? fechaVencimiento : fechaInicio;
        return resolverSemanaLectiva(fechaObjetivo, fallback);
    }

    private static long distanciaIntervaloDias(LocalDate fecha, LocalDate inicio, LocalDate fin) {
        if (fecha.isBefore(inicio)) {
            return ChronoUnit.DAYS.between(fecha, inicio);
        }
        if (fecha.isAfter(fin)) {
            return ChronoUnit.DAYS.between(fin, fecha);
        }
        return 0;
    }
}
