package org.example.shidell.util;

import org.example.shidell.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Pruebas Unitarias - GradeCalculationHelper (Escala Numérica / Literal CNEB)")
class GradeCalculationHelperTest {

    @Test
    @DisplayName("Convierte notas vigesimales a letras CNEB respetando exactamente los límites")
    void toLiteral_limitesExactosCneb() {
        assertEquals("AD", GradeCalculationHelper.toLiteral(20.0));
        assertEquals("AD", GradeCalculationHelper.toLiteral(18.0));
        assertEquals("A", GradeCalculationHelper.toLiteral(17.9));
        assertEquals("A", GradeCalculationHelper.toLiteral(14.0));
        assertEquals("B", GradeCalculationHelper.toLiteral(13.9));
        assertEquals("B", GradeCalculationHelper.toLiteral(11.0));
        assertEquals("C", GradeCalculationHelper.toLiteral(10.9));
        assertEquals("C", GradeCalculationHelper.toLiteral(0.0));
        assertEquals("—", GradeCalculationHelper.toLiteral(Double.NaN));
    }

    @Test
    @DisplayName("Convierte letras CNEB a su valor numérico representativo sobre 20")
    void literalToNota20_mapeoCanonico() {
        assertEquals(19.0, GradeCalculationHelper.literalToNota20("AD"));
        assertEquals(16.0, GradeCalculationHelper.literalToNota20(" a "));
        assertEquals(12.5, GradeCalculationHelper.literalToNota20("b"));
        assertEquals(9.0, GradeCalculationHelper.literalToNota20("C"));
        assertNull(GradeCalculationHelper.literalToNota20("XYZ"));
        assertNull(GradeCalculationHelper.literalToNota20("   "));
    }

    @Test
    @DisplayName("parseNotaInput acepta números, decimales y letras CNEB escalando según notaMaxima")
    void parseNotaInput_numéricoYLiteral() {
        assertNull(GradeCalculationHelper.parseNotaInput(null, 20.0));
        assertNull(GradeCalculationHelper.parseNotaInput("   ", 20.0));
        assertEquals(19.0, GradeCalculationHelper.parseNotaInput("AD", 20.0));
        assertEquals(95.0, GradeCalculationHelper.parseNotaInput("AD", 100.0));
        assertEquals(12.5, GradeCalculationHelper.parseNotaInput("b", 20.0));
        assertEquals(14.5, GradeCalculationHelper.parseNotaInput("14,5", 20.0));

        assertThrows(IllegalArgumentException.class, () -> GradeCalculationHelper.parseNotaInput("-0.5", 20.0));
        assertThrows(IllegalArgumentException.class, () -> GradeCalculationHelper.parseNotaInput("20.5", 20.0));
        assertThrows(IllegalArgumentException.class, () -> GradeCalculationHelper.parseNotaInput("ZZ", 20.0));
        assertThrows(BadRequestException.class, () -> GradeCalculationHelper.parseRequiredNota20(""));
    }

    @Test
    @DisplayName("normalizeScale normaliza escalas válidas y rechaza valores desconocidos")
    void normalizeScale_validaEntrada() {
        assertEquals("NUMERICO", GradeCalculationHelper.normalizeScale(null));
        assertEquals("NUMERICO", GradeCalculationHelper.normalizeScale(""));
        assertEquals("NUMERICO", GradeCalculationHelper.normalizeScale("numerico"));
        assertEquals("LITERAL", GradeCalculationHelper.normalizeScale(" literal "));
        assertThrows(IllegalArgumentException.class, () -> GradeCalculationHelper.normalizeScale("PORCENTUAL"));
    }
}
