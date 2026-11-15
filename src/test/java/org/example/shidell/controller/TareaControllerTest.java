package org.example.shidell.controller;

import org.example.shidell.model.dto.TareaDTO;
import org.example.shidell.service.TareaService;
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

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TareaController.class)
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Pruebas de Integración - TareaController")
class TareaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TareaService tareaService;

    private TareaDTO tareaDTO;

    @BeforeEach
    void setUp() {
        tareaDTO = new TareaDTO();
        tareaDTO.setId(10L);
        tareaDTO.setTitulo("Ejercicios algebra");
    }

    @Test
    @DisplayName("GET /api/tareas retorna la lista de todas las tareas")
    void getAllTareas_retornaLista() throws Exception {
        when(tareaService.getAllTareas()).thenReturn(List.of(tareaDTO));

        mockMvc.perform(get("/api/tareas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].titulo").value("Ejercicios algebra"));

        verify(tareaService, times(1)).getAllTareas();
    }
}
