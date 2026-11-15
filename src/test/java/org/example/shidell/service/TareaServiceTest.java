package org.example.shidell.service;

import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.TareaDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.EntregaRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.repository.TareaRepository;
import org.example.shidell.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - TareaService")
class TareaServiceTest {

    @Mock
    private TareaRepository tareaRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private EntregaRepository entregaRepository;
    @Mock
    private MatriculaRepository matriculaRepository;
    @Mock
    private EntityMapper mapper;
    @Mock
    private DocenteService docenteService;
    @Mock
    private NotificacionService notificacionService;

    private TareaService tareaService;

    @BeforeEach
    void setUp() {
        tareaService = new TareaService();
        ReflectionTestUtils.setField(tareaService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(tareaService, "userRepository", userRepository);
        ReflectionTestUtils.setField(tareaService, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(tareaService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(tareaService, "mapper", mapper);
        ReflectionTestUtils.setField(tareaService, "docenteService", docenteService);
        ReflectionTestUtils.setField(tareaService, "notificacionService", notificacionService);
    }

    @Test
    @DisplayName("getAllTareas retorna DTOs mapeados")
    void getAllTareas_retornaLista() {
        Tarea tarea = new Tarea();
        tarea.setId(10L);
        tarea.setTitulo("Ejercicios algebra");
        TareaDTO dto = new TareaDTO();
        dto.setId(10L);
        dto.setTitulo("Ejercicios algebra");

        when(tareaRepository.findAll()).thenReturn(List.of(tarea));
        when(mapper.toDTO(tarea)).thenReturn(dto);

        List<TareaDTO> res = tareaService.getAllTareas();

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getTitulo()).isEqualTo("Ejercicios algebra");
    }

    @Test
    @DisplayName("getTareasByEstudiante calcula estados Pendiente y Vencido usando fallback de grupo")
    void getTareasByEstudiante_calculaResumen() {
        UserEntity est = new UserEntity();
        est.setId(1L);
        est.setRol("ESTUDIANTE");
        est.setNivel("SECUNDARIA");
        est.setGrado("1");
        est.setSeccion("A");
        est.setTurno("TARDE");

        Tarea pendiente = new Tarea();
        pendiente.setId(5L);
        pendiente.setFechaVencimiento(LocalDate.now().plusDays(3));
        TareaDTO dto = new TareaDTO();
        dto.setId(5L);

        when(userRepository.findById(1L)).thenReturn(Optional.of(est));
        when(entregaRepository.findByEstudiante(est)).thenReturn(List.of());
        when(matriculaRepository.findByEstudianteAndAnioEscolar(est, 2026)).thenReturn(Optional.empty());
        when(matriculaRepository.findByEstudiante(est)).thenReturn(List.of());
        when(tareaRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE")).thenReturn(List.of(pendiente));
        when(mapper.toDTO(pendiente)).thenReturn(dto);
        when(mapper.toDTO(est)).thenReturn(new UserDTO());

        Map<String, Object> res = tareaService.getTareasByEstudiante(1L);
        @SuppressWarnings("unchecked")
        Map<String, Object> resumen = (Map<String, Object>) res.get("resumen");
        assertThat(resumen.get("total")).isEqualTo(1);
        assertThat(resumen.get("pendientes")).isEqualTo(1L);
    }
}
