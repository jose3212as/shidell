package org.example.shidell.service;

import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.CursoDTO;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - CalendarioService")
class CalendarioServiceTest {

    @Mock
    private EventoRepository eventoRepository;
    @Mock
    private TareaRepository tareaRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private CursoRepository cursoRepository;
    @Mock
    private MatriculaRepository matriculaRepository;
    @Mock
    private EntregaRepository entregaRepository;

    private CalendarioService calendarioService;
    private UserEntity estudiante;
    private UserEntity profesorMat;
    private UserEntity profesorCom;

    @BeforeEach
    void setUp() {
        calendarioService = new CalendarioService();
        ReflectionTestUtils.setField(calendarioService, "eventoRepository", eventoRepository);
        ReflectionTestUtils.setField(calendarioService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(calendarioService, "userRepository", userRepository);
        ReflectionTestUtils.setField(calendarioService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(calendarioService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(calendarioService, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(calendarioService, "mapper", new EntityMapper());

        estudiante = new UserEntity();
        estudiante.setId(472L);
        estudiante.setRol("ESTUDIANTE");
        estudiante.setNombres("María");
        estudiante.setApellidos("López");
        estudiante.setNivel("SECUNDARIA");
        estudiante.setGrado("1");
        estudiante.setSeccion("A");
        estudiante.setTurno("TARDE");

        profesorMat = new UserEntity();
        profesorMat.setId(10L);
        profesorMat.setNombres("Carlos");
        profesorMat.setApellidos("Mendoza");

        profesorCom = new UserEntity();
        profesorCom.setId(11L);
        profesorCom.setNombres("Sonia");
        profesorCom.setApellidos("Cárdenas");

        when(userRepository.findById(472L)).thenReturn(Optional.of(estudiante));
        when(matriculaRepository.findByEstudiante(estudiante)).thenReturn(List.of());
    }

    @Test
    @DisplayName("Filtra cursos huérfanos/sábado, fusiona bloques contiguos y respeta feriados y recesos")
    @SuppressWarnings("unchecked")
    void getCalendarioEstudiante_limpiaFantasmasYFusionaBloques() {
        int anio = LocalDate.now().getYear();

        Curso mat1 = crearCurso(907L, "Matemática", 1, "13:30", "14:15", "blue", profesorMat);
        Curso mat2 = crearCurso(908L, "Matemática", 1, "14:15", "15:00", "blue", profesorMat);
        Curso com1 = crearCurso(917L, "Comunicación", 2, "17:00", "17:45", "purple", profesorCom);
        Curso ghostNull = crearCurso(2L, "Comunicación", null, null, null, "purple", profesorCom);
        Curso ghostSabado = crearCurso(1L, "Matemática", 6, "08:30", "10:00", "blue", profesorMat);

        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE"))
                .thenReturn(List.of(mat1, mat2, com1, ghostNull, ghostSabado));
        when(eventoRepository.findByUsuario(any())).thenReturn(List.of());
        when(tareaRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE")).thenReturn(List.of());

        Map<String, Object> res = calendarioService.getCalendarioEstudiante(472L);

        List<CursoDTO> cursosUnicos = (List<CursoDTO>) res.get("cursos");
        assertThat(cursosUnicos).extracting(CursoDTO::getNombre)
                .containsExactly("Comunicación", "Matemática");

        List<Map<String, Object>> horariosBase = (List<Map<String, Object>>) res.get("horariosBase");
        assertThat(horariosBase).hasSize(2);
        Map<String, Object> bloqueMat = horariosBase.stream()
                .filter(b -> "matematica".equals(b.get("cursoKey"))).findFirst().orElseThrow();
        assertThat(bloqueMat.get("horaInicio")).isEqualTo("13:30");
        assertThat(bloqueMat.get("horaFin")).isEqualTo("15:00");

        List<Map<String, Object>> eventos = (List<Map<String, Object>>) res.get("eventos");
        // No se generan clases el 8 de diciembre (feriado Inmaculada Concepción, martes) ni el 29 de junio (lunes)
        assertThat(eventos)
                .noneMatch(e -> (anio + "-12-08").equals(e.get("fecha")) && "CLASE".equals(e.get("tipo")))
                .noneMatch(e -> (anio + "-06-29").equals(e.get("fecha")) && "CLASE".equals(e.get("tipo")))
                // No se generan clases en semana de receso escolar (3 al 7 de agosto)
                .noneMatch(e -> (anio + "-08-03").equals(e.get("fecha")) && "CLASE".equals(e.get("tipo")))
                // Tampoco hay clases fantasma de sábado
                .noneMatch(e -> (anio + "-03-21").equals(e.get("fecha")) && "CLASE".equals(e.get("tipo")));

        // Lunes lectivo válido sí tiene el bloque fusionado 13:30-15:00
        assertThat(eventos).anyMatch(e ->
                (anio + "-03-16").equals(e.get("fecha"))
                        && "CLASE".equals(e.get("tipo"))
                        && "13:30".equals(e.get("hora"))
                        && "15:00".equals(e.get("horaFin")));
    }

    @Test
    @DisplayName("Excluye exámenes de turno distinto y suprime la clase superpuesta del mismo horario")
    @SuppressWarnings("unchecked")
    void getCalendarioEstudiante_filtraExamenesOtroTurnoYEvitaColisiones() {
        int anio = LocalDate.now().getYear();
        Curso mat = crearCurso(909L, "Matemática", 1, "15:15", "16:45", "blue", profesorMat);

        Evento examenTarde = new Evento();
        examenTarde.setId(1988L);
        examenTarde.setTitulo("Examen Bimestral 4 - Matemática");
        examenTarde.setTipo("EXAMEN");
        examenTarde.setUsuario(profesorMat);
        examenTarde.setFechaInicio(LocalDateTime.of(anio, 12, 14, 15, 15));
        examenTarde.setFechaFin(LocalDateTime.of(anio, 12, 14, 16, 0));

        Evento examenMananaLeak = new Evento();
        examenMananaLeak.setId(1920L);
        examenMananaLeak.setTitulo("Examen Bimestral 4 - Matemática");
        examenMananaLeak.setTipo("EXAMEN");
        examenMananaLeak.setUsuario(profesorMat);
        examenMananaLeak.setFechaInicio(LocalDateTime.of(anio, 12, 15, 7, 45));
        examenMananaLeak.setFechaFin(LocalDateTime.of(anio, 12, 15, 8, 30));

        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE")).thenReturn(List.of(mat));
        when(eventoRepository.findByUsuario(profesorMat)).thenReturn(List.of(examenTarde, examenMananaLeak));
        when(tareaRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE")).thenReturn(List.of());

        Map<String, Object> res = calendarioService.getCalendarioEstudiante(472L);
        List<Map<String, Object>> eventos = (List<Map<String, Object>>) res.get("eventos");

        List<Map<String, Object>> examenes = eventos.stream()
                .filter(e -> "EXAMEN".equals(e.get("tipo"))).toList();
        assertThat(examenes).hasSize(1);
        assertThat(examenes.get(0).get("id")).isEqualTo(1988L);

        // El lunes 14 de diciembre a las 15:15 no debe tener una CLASE encima del EXAMEN
        assertThat(eventos).noneMatch(e ->
                (anio + "-12-14").equals(e.get("fecha")) && "CLASE".equals(e.get("tipo")));
        // Pero el lunes anterior 7 de diciembre sí conserva su CLASE regular
        assertThat(eventos).anyMatch(e ->
                (anio + "-12-07").equals(e.get("fecha")) && "CLASE".equals(e.get("tipo")));
    }

    @Test
    @DisplayName("Enriquece tareas con estado de entrega y enlaza al curso activo vigente")
    @SuppressWarnings("unchecked")
    void getCalendarioEstudiante_enriqueceTareasConEstadoYCursoActivo() {
        Curso matActiva = crearCurso(909L, "Matemática", 1, "15:15", "16:45", "blue", profesorMat);
        Curso matLegacy = crearCurso(1L, "Matemática", 6, "08:30", "10:00", "blue", profesorMat);
        Curso comActiva = crearCurso(917L, "Comunicación", 2, "17:00", "17:45", "purple", profesorCom);

        Tarea tareaPendiente = new Tarea();
        tareaPendiente.setId(39L);
        tareaPendiente.setTitulo("Guía de ecuaciones");
        tareaPendiente.setDescripcion("Resolver ficha 4");
        tareaPendiente.setCurso(matLegacy);
        tareaPendiente.setFechaVencimiento(LocalDate.now().plusDays(3));
        tareaPendiente.setPrioridad("Alta");

        Tarea tareaCompletada = new Tarea();
        tareaCompletada.setId(40L);
        tareaCompletada.setTitulo("Ensayo literario");
        tareaCompletada.setCurso(comActiva);
        tareaCompletada.setFechaVencimiento(LocalDate.now().plusDays(5));

        Entrega entrega = new Entrega();
        entrega.setId(77L);
        entrega.setEstudiante(estudiante);
        entrega.setTarea(tareaCompletada);

        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE"))
                .thenReturn(List.of(matLegacy, matActiva, comActiva));
        when(eventoRepository.findByUsuario(any())).thenReturn(List.of());
        when(tareaRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE"))
                .thenReturn(List.of(tareaPendiente, tareaCompletada));
        when(entregaRepository.findByEstudiante(estudiante)).thenReturn(List.of(entrega));

        Map<String, Object> res = calendarioService.getCalendarioEstudiante(472L);
        List<Map<String, Object>> eventos = (List<Map<String, Object>>) res.get("eventos");

        Map<String, Object> evPendiente = eventos.stream()
                .filter(e -> "t-39".equals(e.get("id"))).findFirst().orElseThrow();
        assertThat(evPendiente.get("estado")).isEqualTo("Pendiente");
        assertThat(evPendiente.get("entregada")).isEqualTo(false);
        assertThat(evPendiente.get("cursoId")).isEqualTo(909L);
        assertThat(evPendiente.get("cursoKey")).isEqualTo("matematica");
        assertThat(evPendiente.get("descripcion")).isEqualTo("Resolver ficha 4");

        Map<String, Object> evCompletada = eventos.stream()
                .filter(e -> "t-40".equals(e.get("id"))).findFirst().orElseThrow();
        assertThat(evCompletada.get("estado")).isEqualTo("Completada");
        assertThat(evCompletada.get("entregada")).isEqualTo(true);
    }

    private Curso crearCurso(Long id, String nombre, Integer diaSemana, String inicio, String fin,
                             String color, UserEntity profesor) {
        Curso c = new Curso();
        c.setId(id);
        c.setNombre(nombre);
        c.setNivel("SECUNDARIA");
        c.setGrado("1");
        c.setSeccion("A");
        c.setTurno("TARDE");
        c.setDiaSemana(diaSemana);
        c.setHoraInicio(inicio);
        c.setHoraFin(fin);
        c.setColor(color);
        c.setProfesor(profesor);
        return c;
    }
}
