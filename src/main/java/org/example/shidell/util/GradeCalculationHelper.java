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
}
