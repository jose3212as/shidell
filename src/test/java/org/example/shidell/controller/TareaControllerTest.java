package org.example.shidell.controller;

import org.example.shidell.model.dto.TareaDTO;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.EntregaRepository;
import org.example.shidell.repository.TareaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.mapper.EntityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

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
    private TareaRepository tareaRepository;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private EntregaRepository entregaRepository;

    @MockBean
    private EntityMapper mapper;

    private Tarea tarea;
    private TareaDTO tareaDTO;

    @BeforeEach
    void setUp() {
        tarea = new Tarea();
        tarea.setId(10L);
        tarea.setTitulo("Ejercicios algebra");

        tareaDTO = new TareaDTO();
        tareaDTO.setId(10L);
        tareaDTO.setTitulo("Ejercicios algebra");
    }

    @Test
    @DisplayName("GET /api/tareas retorna la lista de todas las tareas")
    void getAllTareas_retornaLista() throws Exception {
        when(tareaRepository.findAll()).thenReturn(List.of(tarea));
        when(mapper.toDTO(tarea)).thenReturn(tareaDTO);

        mockMvc.perform(get("/api/tareas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].titulo").value("Ejercicios algebra"));

        verify(tareaRepository, times(1)).findAll();
    }
}
