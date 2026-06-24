package org.example.shidell.controller;

import org.example.shidell.model.dto.CalificacionDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.Calificacion;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CalificacionRepository;
import org.example.shidell.repository.CursoRepository;
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

@WebMvcTest(CalificacionController.class)
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Pruebas de Integración - CalificacionController")
class CalificacionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CalificacionRepository calificacionRepository;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private CursoRepository cursoRepository;

    @MockBean
    private EntityMapper mapper;

    private UserEntity estudiante;
    private Curso curso;
    private Calificacion calificacion;
    private UserDTO estudianteDTO;
    private CalificacionDTO calificacionDTO;

    @BeforeEach
    void setUp() {
        estudiante = new UserEntity();
        estudiante.setId(1L);
        estudiante.setNombres("Juan");
        estudiante.setNivel("SECUNDARIA");
        estudiante.setGrado("3");
        estudiante.setSeccion("A");
        estudiante.setTurno("MAÑANA");

        curso = new Curso();
        curso.setId(10L);
        curso.setNombre("Algebra");

        calificacion = new Calificacion();
        calificacion.setId(100L);
        calificacion.setEstudiante(estudiante);
        calificacion.setCurso(curso);
        calificacion.setActividad("Tarea 1");
        calificacion.setNota(15.0);
        calificacion.setNotaMaxima(20.0);
        calificacion.setFecha(LocalDate.now());

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
        when(userRepository.findById(1L)).thenReturn(Optional.of(estudiante));
        when(calificacionRepository.findByEstudianteId(1L)).thenReturn(List.of(calificacion));
        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "3", "A", "MAÑANA")).thenReturn(List.of(curso));
        when(mapper.toDTO(estudiante)).thenReturn(estudianteDTO);
        when(mapper.toDTO(calificacion)).thenReturn(calificacionDTO);

        mockMvc.perform(get("/api/calificaciones/estudiante/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estudiante.nombres").value("Juan"))
                .andExpect(jsonPath("$.evaluaciones[0].actividad").value("Tarea 1"))
                .andExpect(jsonPath("$.promedioGeneral").value(15.0))
                .andExpect(jsonPath("$.cursosAprobados").value(1))
                .andExpect(jsonPath("$.cursosTotales").value(1));

        verify(calificacionRepository, times(1)).findByEstudianteId(1L);
    }
}
