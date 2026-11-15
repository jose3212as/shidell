package org.example.shidell.service;

import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.CalificacionDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.Calificacion;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Evaluacion;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CalificacionRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.EvaluacionRepository;
import org.example.shidell.repository.MatriculaRepository;
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
@DisplayName("Pruebas Unitarias - CalificacionService")
class CalificacionServiceTest {

    @Mock
    private CalificacionRepository calificacionRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private CursoRepository cursoRepository;
    @Mock
    private MatriculaRepository matriculaRepository;
    @Mock
    private EvaluacionRepository evaluacionRepository;
    @Mock
    private EntityMapper mapper;

    private CalificacionService calificacionService;

    private UserEntity estudiante;
    private Curso curso;
    private Calificacion calificacion;
    private UserDTO estudianteDTO;
    private CalificacionDTO calificacionDTO;

    @BeforeEach
    void setUp() {
        calificacionService = new CalificacionService();
        ReflectionTestUtils.setField(calificacionService, "calificacionRepository", calificacionRepository);
        ReflectionTestUtils.setField(calificacionService, "userRepository", userRepository);
        ReflectionTestUtils.setField(calificacionService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(calificacionService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(calificacionService, "evaluacionRepository", evaluacionRepository);
        ReflectionTestUtils.setField(calificacionService, "mapper", mapper);

        estudiante = new UserEntity();
        estudiante.setId(1L);
        estudiante.setNombres("Juan");
        estudiante.setRol("ESTUDIANTE");
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
    @DisplayName("getCalificacionesByEstudiante calcula promedio general, cursos aprobados y evaluaciones")
    void getCalificacionesByEstudiante_calculaResumenCorrectamente() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(estudiante));
        when(matriculaRepository.findByEstudianteAndAnioEscolar(estudiante, 2026)).thenReturn(Optional.empty());
        when(matriculaRepository.findByEstudiante(estudiante)).thenReturn(List.of());
        when(calificacionRepository.findByEstudianteId(1L)).thenReturn(List.of(calificacion));
        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "3", "A", "MAÑANA")).thenReturn(List.of(curso));
        when(mapper.toDTO(estudiante)).thenReturn(estudianteDTO);
        when(mapper.toDTO(calificacion)).thenReturn(calificacionDTO);

        Map<String, Object> res = calificacionService.getCalificacionesByEstudiante(1L);

        assertThat(res.get("promedioGeneral")).isEqualTo(15.0);
        assertThat(res.get("cursosAprobados")).isEqualTo(1L);
        assertThat(res.get("cursosTotales")).isEqualTo(1);
        assertThat((List<?>) res.get("evaluaciones")).hasSize(1);
    }

    @Test
    @DisplayName("getCalificacionesByEstudiante incluye evaluaciones programadas calificadas y pendientes")
    @SuppressWarnings("unchecked")
    void getCalificacionesByEstudiante_incluyeEvaluacionesProgramadas() {
        Evaluacion evCalificada = new Evaluacion();
        evCalificada.setId(201L);
        evCalificada.setTitulo("Examen Parcial");
        evCalificada.setTipo("EXAMEN");
        evCalificada.setBimestre(4);
        evCalificada.setPeso(2.0);
        evCalificada.setNotaMaxima(20.0);
        evCalificada.setFecha(LocalDate.of(2026, 11, 12));
        evCalificada.setCurso(curso);

        Evaluacion evPendiente = new Evaluacion();
        evPendiente.setId(202L);
        evPendiente.setTitulo("Examen Final");
        evPendiente.setTipo("EXAMEN");
        evPendiente.setBimestre(4);
        evPendiente.setPeso(2.0);
        evPendiente.setNotaMaxima(20.0);
        evPendiente.setFecha(LocalDate.of(2026, 11, 20));
        evPendiente.setCurso(curso);

        calificacion.setEvaluacion(evCalificada);

        when(userRepository.findById(1L)).thenReturn(Optional.of(estudiante));
        when(matriculaRepository.findByEstudianteAndAnioEscolar(estudiante, 2026)).thenReturn(Optional.empty());
        when(matriculaRepository.findByEstudiante(estudiante)).thenReturn(List.of());
        when(calificacionRepository.findByEstudianteId(1L)).thenReturn(List.of(calificacion));
        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "3", "A", "MAÑANA")).thenReturn(List.of(curso));
        when(evaluacionRepository.findByCursoIdOrderByBimestreAscFechaAscIdAsc(10L))
                .thenReturn(List.of(evCalificada, evPendiente));
        when(mapper.toDTO(estudiante)).thenReturn(estudianteDTO);
        when(mapper.toDTO(calificacion)).thenReturn(calificacionDTO);

        Map<String, Object> res = calificacionService.getCalificacionesByEstudiante(1L);

        List<Map<String, Object>> programadas = (List<Map<String, Object>>) res.get("evaluacionesProgramadas");
        assertThat(programadas).hasSize(2);
        assertThat(programadas.get(0).get("titulo")).isEqualTo("Examen Final");
        assertThat(programadas.get(0).get("calificada")).isEqualTo(false);
        assertThat(programadas.get(0).get("nota")).isNull();
        assertThat(programadas.get(1).get("titulo")).isEqualTo("Examen Parcial");
        assertThat(programadas.get(1).get("calificada")).isEqualTo(true);
        assertThat(programadas.get(1).get("nota")).isEqualTo(15.0);
    }
}
