package org.example.shidell.service;

import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.TareaDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.*;
import org.example.shidell.repository.*;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - CursoService avance por semanas")
class CursoServiceTest {

    @Mock
    private CursoRepository cursoRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private EventoRepository eventoRepository;
    @Mock
    private TareaRepository tareaRepository;
    @Mock
    private MaterialCursoRepository materialCursoRepository;
    @Mock
    private ForoSemanaMensajeRepository foroSemanaMensajeRepository;
    @Mock
    private MatriculaRepository matriculaRepository;
    @Mock
    private EntregaRepository entregaRepository;
    @Mock
    private EntityMapper mapper;

    private CursoService cursoService;

    @BeforeEach
    void setUp() {
        cursoService = new CursoService();
        ReflectionTestUtils.setField(cursoService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(cursoService, "userRepository", userRepository);
        ReflectionTestUtils.setField(cursoService, "eventoRepository", eventoRepository);
        ReflectionTestUtils.setField(cursoService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(cursoService, "materialCursoRepository", materialCursoRepository);
        ReflectionTestUtils.setField(cursoService, "foroSemanaMensajeRepository", foroSemanaMensajeRepository);
        ReflectionTestUtils.setField(cursoService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(cursoService, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(cursoService, "mapper", mapper);
    }

    @Test
    @DisplayName("getCursosDetalleEstudiante calcula avance por semanas completadas sobre 36 e incluye foros")
    void getCursosDetalleEstudiante_calculaPorSemanasCompletadas() {
        Aula aula = new Aula("SECUNDARIA", "1", "A", "TARDE", 2026);

        UserEntity docente = new UserEntity();
        docente.setId(50L);
        docente.setNombres("Sonia");
        docente.setApellidos("Cárdenas");

        UserEntity estudiante = new UserEntity();
        estudiante.setId(10L);
        estudiante.setNivel("SECUNDARIA");
        estudiante.setGrado("1");
        estudiante.setSeccion("A");
        estudiante.setTurno("TARDE");

        Curso sesion1 = new Curso();
        sesion1.setId(2L);
        sesion1.setNombre("Comunicación");
        sesion1.setAula(aula);
        sesion1.setProfesor(docente);
        sesion1.setDiaSemana(1);

        Curso sesion2 = new Curso();
        sesion2.setId(15L);
        sesion2.setNombre("Comunicación");
        sesion2.setAula(aula);
        sesion2.setProfesor(docente);
        sesion2.setDiaSemana(3);

        Tarea tareaSem28 = new Tarea();
        tareaSem28.setId(40L);
        tareaSem28.setTitulo("Ensayo");
        tareaSem28.setCurso(sesion1);
        tareaSem28.setFechaInicio(LocalDate.of(2026, 10, 19));
        tareaSem28.setFechaVencimiento(LocalDate.of(2026, 10, 21));

        Entrega entrega = new Entrega();
        entrega.setId(1L);
        entrega.setTarea(tareaSem28);
        entrega.setEstudiante(estudiante);

        ForoSemanaMensaje foroDocente = new ForoSemanaMensaje();
        foroDocente.setCurso(sesion1);
        foroDocente.setSemana(28);
        foroDocente.setAutorId(50L);

        when(userRepository.findById(10L)).thenReturn(Optional.of(estudiante));
        when(matriculaRepository.findByEstudianteAndAnioEscolar(estudiante, 2026)).thenReturn(Optional.empty());
        when(matriculaRepository.findByEstudiante(estudiante)).thenReturn(List.of());
        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE"))
                .thenReturn(List.of(sesion1, sesion2));
        when(cursoRepository.findByAula(aula)).thenReturn(List.of(sesion1, sesion2));
        when(tareaRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE"))
                .thenReturn(List.of(tareaSem28));
        when(tareaRepository.findByCurso(any(Curso.class))).thenReturn(List.of(tareaSem28));
        when(materialCursoRepository.findByCursoOrderByFechaPublicacionDesc(any())).thenReturn(List.of());
        when(eventoRepository.findByUsuarioAndTipo(any(), any())).thenReturn(List.of());
        when(entregaRepository.findByEstudiante(estudiante)).thenReturn(List.of(entrega));
        when(mapper.toDTO(docente)).thenReturn(new UserDTO());
        when(mapper.toDTO(any(Tarea.class))).thenReturn(new TareaDTO());

        // Caso 1: docente abrió foro en semana 28 pero estudiante aún no participa -> 0%
        when(foroSemanaMensajeRepository.findByCursoIdInOrderBySemanaAscFechaAsc(anyList()))
                .thenReturn(List.of(foroDocente));

        Map<String, Object> sinForo = cursoService.getCursosDetalleEstudiante(10L);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cursos1 = (List<Map<String, Object>>) sinForo.get("cursos");
        assertThat(cursos1).hasSize(1);
        assertThat(cursos1.get(0).get("semanasTotales")).isEqualTo(36);
        assertThat(cursos1.get(0).get("semanasConActividades")).isEqualTo(1);
        assertThat(cursos1.get(0).get("semanasCompletadas")).isEqualTo(0);
        assertThat(cursos1.get(0).get("progresoClases")).isEqualTo(0);

        // Caso 2: estudiante participa en foro semana 28 -> semana 28 completa (1/36 = 3%)
        ForoSemanaMensaje foroEstudiante = new ForoSemanaMensaje();
        foroEstudiante.setCurso(sesion2);
        foroEstudiante.setSemana(28);
        foroEstudiante.setAutorId(10L);

        when(foroSemanaMensajeRepository.findByCursoIdInOrderBySemanaAscFechaAsc(anyList()))
                .thenReturn(List.of(foroDocente, foroEstudiante));

        Map<String, Object> conForo = cursoService.getCursosDetalleEstudiante(10L);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cursos2 = (List<Map<String, Object>>) conForo.get("cursos");
        assertThat(cursos2.get(0).get("semanasCompletadas")).isEqualTo(1);
        assertThat(cursos2.get(0).get("forosParticipadosCurso")).isEqualTo(1);
        assertThat(cursos2.get(0).get("progresoClases")).isEqualTo(3);
    }
}
