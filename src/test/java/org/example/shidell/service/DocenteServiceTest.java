package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    private EvaluacionRepository evaluacionRepository;
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
        ReflectionTestUtils.setField(docenteService, "evaluacionRepository", evaluacionRepository);
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
    @DisplayName("obtenerCursosPorDocente retorna lista de DTOs del docente excluyendo archivados")
    void obtenerCursosPorDocente_retornaListaDeCursos() {
        Curso archivado = new Curso();
        archivado.setId(99L);
        archivado.setNombre("Comunicación Antigua");
        archivado.setProfesor(docente);
        archivado.setNivel("SECUNDARIA");
        archivado.setGrado("1");
        archivado.setSeccion("A");
        archivado.setTurno("ARCHIVADO");

        when(userRepository.findById(1L)).thenReturn(Optional.of(docente));
        when(cursoRepository.findByProfesor(docente)).thenReturn(List.of(archivado, curso));

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

    @Test
    @DisplayName("crearEvaluacion replica en otras secciones cuando aplicarTodasSecciones es true")
    void crearEvaluacion_multiSeccion_creaEnTodas() {
        Curso seccionB = new Curso();
        seccionB.setId(11L);
        seccionB.setNombre("Algebra");
        seccionB.setProfesor(docente);
        seccionB.setNivel("SECUNDARIA");
        seccionB.setGrado("3");
        seccionB.setSeccion("B");
        seccionB.setTurno("MAÑANA");

        when(cursoRepository.findById(10L)).thenReturn(Optional.of(curso));
        when(cursoRepository.findByProfesor(docente)).thenReturn(List.of(curso, seccionB));
        when(evaluacionRepository.findFirstByCursoIdAndTituloIgnoreCase(anyLong(), eq("Examen Parcial")))
                .thenReturn(Optional.empty());
        when(evaluacionRepository.save(any(Evaluacion.class))).thenAnswer(inv -> {
            Evaluacion e = inv.getArgument(0);
            e.setId(e.getCurso().getId() * 10);
            return e;
        });

        Map<String, Object> res = docenteService.crearEvaluacion(10L, Map.of(
                "titulo", "Examen Parcial",
                "tipo", "EXAMEN",
                "bimestre", 1,
                "peso", 2,
                "aplicarTodasSecciones", true
        ), docente);

        assertThat(res.get("cursosCreados")).isEqualTo(2);
        verify(evaluacionRepository, times(2)).save(any(Evaluacion.class));
    }

    @Test
    @DisplayName("guardarCalificacionesLote crea, actualiza y borra notas en una sola llamada")
    void guardarCalificacionesLote_upsertYElimina() {
        Evaluacion ev = new Evaluacion();
        ev.setId(50L);
        ev.setTitulo("Examen Parcial");
        ev.setTipo("EXAMEN");
        ev.setNotaMaxima(20.0);
        ev.setCurso(curso);

        UserEntity est3 = new UserEntity();
        est3.setId(3L);
        est3.setNombres("Luis");
        est3.setRol("ESTUDIANTE");

        Calificacion existenteEst2 = new Calificacion();
        existenteEst2.setId(200L);
        existenteEst2.setCurso(curso);
        existenteEst2.setEstudiante(estudiante);
        existenteEst2.setEvaluacion(ev);
        existenteEst2.setActividad("Examen Parcial");
        existenteEst2.setNota(12.0);

        Calificacion existenteEst3 = new Calificacion();
        existenteEst3.setId(201L);
        existenteEst3.setCurso(curso);
        existenteEst3.setEstudiante(est3);
        existenteEst3.setEvaluacion(ev);
        existenteEst3.setActividad("Examen Parcial");
        existenteEst3.setNota(10.0);

        when(cursoRepository.findById(10L)).thenReturn(Optional.of(curso));
        when(evaluacionRepository.findById(50L)).thenReturn(Optional.of(ev));
        when(userRepository.findById(2L)).thenReturn(Optional.of(estudiante));
        when(calificacionRepository.findFirstByCursoIdAndEstudianteIdAndEvaluacionId(10L, 2L, 50L))
                .thenReturn(Optional.of(existenteEst2));
        when(calificacionRepository.findFirstByCursoIdAndEstudianteIdAndEvaluacionId(10L, 3L, 50L))
                .thenReturn(Optional.of(existenteEst3));
        when(calificacionRepository.save(any(Calificacion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(calificacionRepository.findByCursoId(10L)).thenReturn(List.of(existenteEst2));

        Map<String, Object> res = docenteService.guardarCalificacionesLote(10L, Map.of(
                "evaluacionId", 50L,
                "notas", List.of(
                        Map.of("estudianteId", 2L, "nota", 18.0),
                        Map.of("estudianteId", 3L, "nota", "")
                )
        ), docente);

        assertThat(res.get("actualizadas")).isEqualTo(1);
        assertThat(res.get("eliminadas")).isEqualTo(1);
        assertThat(existenteEst2.getNota()).isEqualTo(18.0);
        verify(calificacionRepository).delete(existenteEst3);
        verify(notificacionService).notificarNuevaCalificacionAEstudiante(existenteEst2);
    }

    @Test
    @DisplayName("registrarAsistencia permite regularizar fechas pasadas solo con override de admin")
    void registrarAsistencia_adminOverridePermitePasadasYRechazaFuturas() {
        LocalDate ayer = LocalDate.now().minusDays(1);
        LocalDate manana = LocalDate.now().plusDays(1);

        when(cursoRepository.findById(10L)).thenReturn(Optional.of(curso));
        when(userRepository.findById(2L)).thenReturn(Optional.of(estudiante));
        when(asistenciaRepository.findByCursoAndEstudianteAndFecha(curso, estudiante, ayer))
                .thenReturn(Optional.empty());
        when(asistenciaRepository.save(any(Asistencia.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThrows(BadRequestException.class,
                () -> docenteService.registrarAsistencia(10L, 2L, "JUSTIFICADO", ayer, false));
        assertThrows(BadRequestException.class,
                () -> docenteService.registrarAsistencia(10L, 2L, "JUSTIFICADO", manana, true));

        Asistencia saved = docenteService.registrarAsistencia(10L, 2L, "justificado", ayer, true);
        assertThat(saved.getEstado()).isEqualTo("JUSTIFICADO");
        assertThat(saved.getFecha()).isEqualTo(ayer);
        verify(asistenciaRepository).save(any(Asistencia.class));
    }

    @Test
    @DisplayName("obtenerListaAsistencia retorna metadatos de curso, estudianteId, estado por defecto y guardados")
    void obtenerListaAsistencia_retornaEstructuraCompleta() {
        LocalDate hoy = LocalDate.now();
        curso.setDiaSemana(2);
        curso.setHoraInicio("08:00");
        curso.setHoraFin("09:30");

        UserEntity est2 = new UserEntity();
        est2.setId(3L);
        est2.setNombres("Ana");
        est2.setApellidos("Alvarado");
        est2.setRol("ESTUDIANTE");

        estudiante.setApellidos("Zapata");

        Asistencia guardada = new Asistencia();
        guardada.setId(77L);
        guardada.setCurso(curso);
        guardada.setEstudiante(est2);
        guardada.setFecha(hoy);
        guardada.setEstado("TARDE");

        when(cursoRepository.findById(10L)).thenReturn(Optional.of(curso));
        when(userRepository.findByGrupoAcademico("SECUNDARIA", "3", "A", "MAÑANA"))
                .thenReturn(List.of(estudiante, est2));
        when(asistenciaRepository.findByCursoAndFecha(curso, hoy)).thenReturn(List.of(guardada));

        Map<String, Object> res = docenteService.obtenerListaAsistencia(10L, hoy);
        assertThat(res.get("horaInicio")).isEqualTo("08:00");
        assertThat(res.get("horaFin")).isEqualTo("09:30");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> filas = (List<Map<String, Object>>) res.get("estudiantes");
        assertThat(filas).hasSize(2);
        assertThat(filas.get(0).get("estudianteId")).isEqualTo(3L);
        assertThat(filas.get(0).get("estado")).isEqualTo("TARDE");
        assertThat(filas.get(0).get("registrado")).isEqualTo(true);

        assertThat(filas.get(1).get("estudianteId")).isEqualTo(2L);
        assertThat(filas.get(1).get("estado")).isEqualTo("PRESENTE");
        assertThat(filas.get(1).get("registrado")).isEqualTo(false);
    }
}
