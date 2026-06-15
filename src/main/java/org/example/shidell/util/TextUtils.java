package org.example.shidell.util;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;

public class TextUtils {

    /**
     * Normaliza un texto eliminando acentos y convirtiéndolo a minúsculas
     * con separación por espacios simples.
     */
    public static String normalizar(String valor) {
        String texto = limpiarTexto(valor);
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    /**
     * Limpia un texto de posibles errores de codificación (ISO-8859-1 a UTF-8)
     */
    public static String limpiarTexto(String valor) {
        if (valor == null) return "";
        String texto = valor;

        // Intentar corregir caracteres mal codificados comunes (Ã, Â)
        for (int i = 0; i < 3 && (texto.indexOf('\u00C3') >= 0 || texto.indexOf('\u00C2') >= 0); i++) {
            try {
                String decodificado = new String(texto.getBytes(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8);
                if (decodificado.equals(texto)) break;
                texto = decodificado;
            } catch (Exception ignored) {
                break;
            }
        }

        return texto;
    }

    /**
     * Genera una clave única para un curso basada en su nombre normalizado.
     */
    public static String claveCurso(String nombre, Long id) {
        String limpio = limpiarTexto(nombre);
        if (limpio.isBlank() && id != null) {
            return "curso-" + id;
        }

        String sinAcentos = Normalizer.normalize(limpio, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return sinAcentos.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }
}
