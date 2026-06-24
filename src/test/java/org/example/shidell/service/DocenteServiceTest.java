package org.example.shidell.service;

import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.*;
import org.example.shidell.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - DocenteService")
class DocenteServiceTest {

    @Mock
    private CursoRepository cursoRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AsistenciaRepository asistenciaRepository;
    @Mock
    private CalificacionRepository calificacionRepository;
    @Mock
    private TareaRepository tareaRepository;
    @Mock
    private EventoRepository eventoRepository;
    @Mock
    private MaterialCursoRepository materialCursoRepository;
    @Mock
    private NotificacionService notificacionService;

    private final EntityMapper mapper = new EntityMapper();

    private DocenteService docenteService;

    private UserEntity docente;
    private UserEntity estudiante;
    private Curso curso;

    @BeforeEach
    void setUp() {
        docenteService = new DocenteService();
        ReflectionTestUtils.setField(docenteService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(docenteService, "userRepository", userRepository);
        ReflectionTestUtils.setField(docenteService, "asistenciaRepository", asistenciaRepository);
        ReflectionTestUtils.setField(docenteService, "calificacionRepository", calificacionRepository);
        ReflectionTestUtils.setField(docenteService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(docenteService, "eventoRepository", eventoRepository);
        ReflectionTestUtils.setField(docenteService, "materialCursoRepository", materialCursoRepository);
        ReflectionTestUtils.setField(docenteService, "notificacionService", notificacionService);
        ReflectionTestUtils.setField(docenteService, "mapper", mapper);

        docente = new UserEntity();
        docente.setId(1L);
        docente.setNombres("Carlos");
        docente.setRol("DOCENTE");

        estudiante = new UserEntity();
        estudiante.setId(2L);
        estudiante.setNombres("Maria");
        estudiante.setRol("ESTUDIANTE");
        estudiante.setNivel("SECUNDARIA");
        estudiante.setGrado("3");
        estudiante.setSeccion("A");
        estudiante.setTurno("MAÑANA");

        curso = new Curso();
        curso.setId(10L);
        curso.setNombre("Algebra");
        curso.setProfesor(docente);
        curso.setNivel("SECUNDARIA");
        curso.setGrado("3");
        curso.setSeccion("A");
        curso.setTurno("MAÑANA");
    }

    @Test
    @DisplayName("obtenerCursosPorDocente retorna lista de DTOs del docente")
    void obtenerCursosPorDocente_retornaListaDeCursos() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(docente));
        when(cursoRepository.findByProfesor(docente)).thenReturn(List.of(curso));

        List<CursoDTO> resultado = docenteService.obtenerCursosPorDocente(1L);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getNombre()).isEqualTo("Algebra");
    }

    @Test
    @DisplayName("registrarAsistencia registra nueva asistencia y alerta al padre")
    void registrarAsistencia_creaNuevaYAlerta() {
        when(cursoRepository.findById(10L)).thenReturn(Optional.of(curso));
        when(userRepository.findById(2L)).thenReturn(Optional.of(estudiante));
        when(asistenciaRepository.findByCursoAndEstudianteAndFecha(eq(curso), eq(estudiante), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        docenteService.registrarAsistencia(10L, 2L, "AUSENTE");

        ArgumentCaptor<Asistencia> captor = ArgumentCaptor.forClass(Asistencia.class);
        verify(asistenciaRepository).save(captor.capture());
        verify(notificacionService).alertarPadrePorFalta(any(Asistencia.class));

        Asistencia guardada = captor.getValue();
        assertThat(guardada.getEstado()).isEqualTo("AUSENTE");
        assertThat(guardada.getCurso()).isEqualTo(curso);
        assertThat(guardada.getEstudiante()).isEqualTo(estudiante);
    }

    @Test
    @DisplayName("guardarCalificacion persiste nota y alerta al padre si es baja")
    void guardarCalificacion_guardaYAlerta() {
        when(cursoRepository.findById(10L)).thenReturn(Optional.of(curso));
        when(userRepository.findById(2L)).thenReturn(Optional.of(estudiante));
        when(calificacionRepository.save(any(Calificacion.class))).thenAnswer(inv -> inv.getArgument(0));

        Calificacion resultado = docenteService.guardarCalificacion(10L, 2L, "Examen Parcial", 10.5);

        assertThat(resultado.getNota()).isEqualTo(10.5);
        assertThat(resultado.getActividad()).isEqualTo("Examen Parcial");
        verify(calificacionRepository).save(any(Calificacion.class));
        verify(notificacionService).alertarPadrePorBajaNota(any(Calificacion.class));
    }

    @Test
    @DisplayName("obtenerEstudiantesPorCurso filtra solo los estudiantes con rol ESTUDIANTE")
    void obtenerEstudiantesPorCurso_retornaSoloEstudiantes() {
        when(cursoRepository.findById(10L)).thenReturn(Optional.of(curso));
        
        UserEntity otroDocente = new UserEntity();
        otroDocente.setId(3L);
        otroDocente.setRol("DOCENTE");
        
        when(userRepository.findByGrupoAcademico("SECUNDARIA", "3", "A", "MAÑANA"))
                .thenReturn(List.of(estudiante, otroDocente));

        List<UserEntity> resultado = docenteService.obtenerEstudiantesPorCurso(10L);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getId()).isEqualTo(2L);
    }
}
