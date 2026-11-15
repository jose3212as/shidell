package org.example.shidell.controller;

import org.example.shidell.model.dto.CalificacionDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.service.CalificacionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CalificacionController.class)
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Pruebas de Integración - CalificacionController")
class CalificacionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CalificacionService calificacionService;

    private UserDTO estudianteDTO;
    private CalificacionDTO calificacionDTO;

    @BeforeEach
    void setUp() {
        estudianteDTO = new UserDTO();
        estudianteDTO.setId(1L);
        estudianteDTO.setNombres("Juan");

        calificacionDTO = new CalificacionDTO();
        calificacionDTO.setId(100L);
        calificacionDTO.setActividad("Tarea 1");
        calificacionDTO.setNota(15.0);
        calificacionDTO.setNota20(15.0);
        calificacionDTO.setEstado("Aprobado");
    }

    @Test
    @DisplayName("GET /api/calificaciones/estudiante/{id} retorna el resumen completo de calificaciones")
    void getCalificacionesByEstudiante_retornaResumen() throws Exception {
        when(calificacionService.getCalificacionesByEstudiante(1L)).thenReturn(Map.of(
                "estudiante", estudianteDTO,
                "evaluaciones", List.of(calificacionDTO),
                "promedioGeneral", 15.0,
                "cursosAprobados", 1,
                "cursosTotales", 1
        ));

        mockMvc.perform(get("/api/calificaciones/estudiante/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estudiante.nombres").value("Juan"))
                .andExpect(jsonPath("$.evaluaciones[0].actividad").value("Tarea 1"))
                .andExpect(jsonPath("$.promedioGeneral").value(15.0))
                .andExpect(jsonPath("$.cursosAprobados").value(1))
                .andExpect(jsonPath("$.cursosTotales").value(1));

        verify(calificacionService, times(1)).getCalificacionesByEstudiante(1L);
    }
}
