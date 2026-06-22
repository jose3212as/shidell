package org.example.shidell.controller;

import org.example.shidell.model.dto.MensajeDTO;
import org.example.shidell.service.MensajeService;
import org.example.shidell.mapper.EntityMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MensajeController.class)
@AutoConfigureMockMvc(addFilters = false) // Desactivar filtros de seguridad si los hubiera
@ActiveProfiles("test")
@DisplayName("Pruebas de Integración - MensajeController")
class MensajeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MensajeService mensajeService;

    @MockBean
    private EntityMapper mapper;

    @Test
    @DisplayName("GET /api/mensajes/noleidos/{usuarioId} retorna el conteo de mensajes no leídos")
    void getMensajesNoLeidos_retornaConteo() throws Exception {
        when(mensajeService.contarMensajesNoLeidos(1L)).thenReturn(5L);

        mockMvc.perform(get("/api/mensajes/noleidos/1"))
                .andExpect(status().isOk())
                .andExpect(content().string("5"));

        verify(mensajeService, times(1)).contarMensajesNoLeidos(1L);
    }

    @Test
    @DisplayName("GET /api/mensajes/conversacion retorna lista de mensajes de la conversación")
    void getConversacion_retornaListaMensajes() throws Exception {
        MensajeDTO m1 = new MensajeDTO();
        m1.setId(10L);
        m1.setContenido("Hola profesor");

        when(mensajeService.obtenerConversacion(1L, 2L, null)).thenReturn(List.of(m1));

        mockMvc.perform(get("/api/mensajes/conversacion")
                        .param("u1", "1")
                        .param("u2", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].contenido").value("Hola profesor"));

        verify(mensajeService, times(1)).obtenerConversacion(1L, 2L, null);
    }

    @Test
    @DisplayName("GET /api/mensajes/estudiante/{estudianteId}/bandeja retorna la bandeja con metadatos")
    void getBandejaEstudiante_retornaBandeja() throws Exception {
        when(mensajeService.obtenerBandejaEstudiante(1L, null)).thenReturn(Map.of(
                "estudiante", Map.of("id", 1L, "nombres", "Juan"),
                "noLeidos", 2L
        ));

        mockMvc.perform(get("/api/mensajes/estudiante/1/bandeja"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estudiante.nombres").value("Juan"))
                .andExpect(jsonPath("$.noLeidos").value(2));

        verify(mensajeService, times(1)).obtenerBandejaEstudiante(1L, null);
    }
}
