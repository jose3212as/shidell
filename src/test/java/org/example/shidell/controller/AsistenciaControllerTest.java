package org.example.shidell.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.model.dto.AsistenciaDTO;
import org.example.shidell.model.entity.Asistencia;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.AsistenciaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.mapper.EntityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AsistenciaController.class)
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Pruebas de Integración - AsistenciaController")
class AsistenciaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AsistenciaRepository asistenciaRepository;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private EntityMapper mapper;

    private UserEntity estudiante;
    private UserEntity padre;
    private Asistencia asistencia;
    private AsistenciaDTO asistenciaDTO;

    @BeforeEach
    void setUp() {
        padre = new UserEntity();
        padre.setId(10L);
        padre.setRol("PADRE");

        estudiante = new UserEntity();
        estudiante.setId(2L);
        estudiante.setNombres("Sofia");
        estudiante.setRol("ESTUDIANTE");
        estudiante.setPadre(padre);

        asistencia = new Asistencia();
        asistencia.setId(100L);
        asistencia.setEstudiante(estudiante);
        asistencia.setFecha(LocalDate.now());
        asistencia.setEstado("PRESENTE");

        asistenciaDTO = new AsistenciaDTO();
        asistenciaDTO.setId(100L);
        asistenciaDTO.setFecha(LocalDate.now());
        asistenciaDTO.setEstado("PRESENTE");
    }

    @Test
    @DisplayName("GET /api/asistencia/estudiante/{estudianteId} - Estudiante accede a su propia asistencia")
    void getAsistenciaEstudiante_estudianteAccedeASuPropiaAsistencia_retornaLista() throws Exception {
        when(userRepository.findById(2L)).thenReturn(Optional.of(estudiante));
        when(asistenciaRepository.findByEstudiante(estudiante)).thenReturn(List.of(asistencia));
        when(mapper.toDTO(asistencia)).thenReturn(asistenciaDTO);

        mockMvc.perform(get("/api/asistencia/estudiante/2")
                        .requestAttr("authUser", estudiante))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(100))
                .andExpect(jsonPath("$[0].asistio").value(true))
                .andExpect(jsonPath("$[0].descripcion").value("Asistió"));

        verify(asistenciaRepository, times(1)).findByEstudiante(estudiante);
    }

    @Test
    @DisplayName("GET /api/asistencia/estudiante/{estudianteId} - Padre accede a la asistencia de su hijo")
    void getAsistenciaEstudiante_padreAccedeAHijo_retornaLista() throws Exception {
        when(userRepository.findById(2L)).thenReturn(Optional.of(estudiante));
        when(asistenciaRepository.findByEstudiante(estudiante)).thenReturn(List.of(asistencia));
        when(mapper.toDTO(asistencia)).thenReturn(asistenciaDTO);

        mockMvc.perform(get("/api/asistencia/estudiante/2")
                        .requestAttr("authUser", padre))
                .andExpect(status().isOk());

        verify(asistenciaRepository, times(1)).findByEstudiante(estudiante);
    }

    @Test
    @DisplayName("GET /api/asistencia/estudiante/{estudianteId} - Retorna 403 si el usuario no tiene permisos")
    void getAsistenciaEstudiante_sinAcceso_retorna403() throws Exception {
        UserEntity otroEstudiante = new UserEntity();
        otroEstudiante.setId(99L);
        otroEstudiante.setRol("ESTUDIANTE");

        when(userRepository.findById(2L)).thenReturn(Optional.of(estudiante));

        mockMvc.perform(get("/api/asistencia/estudiante/2")
                        .requestAttr("authUser", otroEstudiante))
                .andExpect(status().isForbidden());

        verifyNoInteractions(asistenciaRepository);
    }
}
