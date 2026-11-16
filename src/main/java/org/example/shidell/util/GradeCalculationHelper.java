package org.example.shidell.util;

import org.example.shidell.model.entity.Calificacion;

import java.util.List;

/**
 * Fuente única de verdad para el cálculo de notas vigesimales (0..20)
 * y promedios ponderados por evaluación en todo el sistema Shidell.
 */
public final class GradeCalculationHelper {

    public static final double NOTA_MINIMA = 0.0;
    public static final double NOTA_MAXIMA_VIGESIMAL = 20.0;
    public static final double NOTA_APROBATORIA = 11.0;

    public static final String ESCALA_NUMERICA = "NUMERICO";
    public static final String ESCALA_LITERAL = "LITERAL";

    private GradeCalculationHelper() {}

    /** Escala una calificación individual a la escala vigesimal [0, 20]. */
    public static double notaSobre20(Calificacion cal) {
        if (cal == null || cal.getNota() == null || Double.isNaN(cal.getNota())) {
            return 0.0;
        }
        double max = (cal.getNotaMaxima() == null || cal.getNotaMaxima() <= 0.0)
                ? NOTA_MAXIMA_VIGESIMAL
                : cal.getNotaMaxima();
        double escalada = (cal.getNota() / max) * NOTA_MAXIMA_VIGESIMAL;
        return Math.max(NOTA_MINIMA, Math.min(NOTA_MAXIMA_VIGESIMAL, escalada));
    }

    /** Calcula el promedio ponderado por el peso de cada evaluación (sobre 20). */
    public static double promedioPonderadoNota20(List<Calificacion> calificaciones) {
        if (calificaciones == null || calificaciones.isEmpty()) {
            return 0.0;
        }
        double suma = 0.0;
        double totalPeso = 0.0;
        for (Calificacion c : calificaciones) {
            if (c == null || c.getNota() == null || Double.isNaN(c.getNota())) {
                continue;
            }
            double peso = (c.getEvaluacion() != null
                    && c.getEvaluacion().getPeso() != null
                    && c.getEvaluacion().getPeso() > 0.0)
                    ? c.getEvaluacion().getPeso()
                    : 1.0;
            suma += notaSobre20(c) * peso;
            totalPeso += peso;
        }
        return totalPeso > 0.0 ? (suma / totalPeso) : 0.0;
    }

    public static double redondear1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    public static double redondear2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    /** Normaliza la escala solicitada al valor canónico ("NUMERICO" o "LITERAL"). */
    public static String normalizeScale(String raw) {
        if (raw == null || raw.isBlank()) {
            return ESCALA_NUMERICA;
        }
        String norm = raw.trim().toUpperCase(java.util.Locale.ROOT);
        if (ESCALA_LITERAL.equals(norm) || ESCALA_NUMERICA.equals(norm)) {
            return norm;
        }
        throw new IllegalArgumentException("Escala de calificación inválida. Usa NUMERICO o LITERAL.");
    }

    /** Convierte una nota vigesimal [0, 20] al equivalente literal CNEB (AD, A, B, C). */
    public static String toLiteral(double nota20) {
        if (Double.isNaN(nota20) || Double.isInfinite(nota20)) {
            return "—";
        }
        if (nota20 >= 18.0) return "AD";
        if (nota20 >= 14.0) return "A";
        if (nota20 >= 11.0) return "B";
        return "C";
    }

    /** Mapea una calificación literal CNEB (AD, A, B, C) a su nota representativa sobre 20. */
    public static Double literalToNota20(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return switch (raw.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "AD" -> 19.0;
            case "A" -> 16.0;
            case "B" -> 12.5;
            case "C" -> 9.0;
            default -> null;
        };
    }

    /**
     * Interpreta una nota ingresada como número o como literal (AD, A, B, C) y valida rango [0, notaMaxima].
     * Retorna null cuando el valor es nulo o en blanco.
     */
    public static Double parseNotaInput(Object raw, double notaMaxima) {
        if (raw == null) {
            return null;
        }
        String text = raw.toString().trim();
        if (text.isEmpty()) {
            return null;
        }
        double max = notaMaxima > 0.0 ? notaMaxima : NOTA_MAXIMA_VIGESIMAL;
        Double literalNota20 = literalToNota20(text);
        if (literalNota20 != null) {
            return redondear2((literalNota20 / NOTA_MAXIMA_VIGESIMAL) * max);
        }
        double numeric;
        try {
            numeric = Double.parseDouble(text.replace(',', '.'));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Valor de nota inválido: " + text);
        }
        if (Double.isNaN(numeric) || Double.isInfinite(numeric) || numeric < NOTA_MINIMA || numeric > max) {
            throw new IllegalArgumentException("Cada nota debe estar entre 0 y " + (max == Math.floor(max) ? String.valueOf((int) max) : max) + ".");
        }
        return numeric;
    }

    /** Igual a parseNotaInput pero exigiendo que el valor exista y lanzando BadRequestException si falla. */
    public static double parseRequiredNota20(Object raw) {
        try {
            Double parsed = parseNotaInput(raw, NOTA_MAXIMA_VIGESIMAL);
            if (parsed == null) {
                throw new org.example.shidell.exception.BadRequestException("Debes ingresar una calificación válida.");
            }
            return parsed;
        } catch (IllegalArgumentException e) {
            throw new org.example.shidell.exception.BadRequestException(e.getMessage());
        }
    }
}
