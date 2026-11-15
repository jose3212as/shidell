package org.example.shidell.util;

import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.entity.*;
import org.example.shidell.repository.*;
import org.example.shidell.service.AsistenciaService;
import org.example.shidell.service.DocenteService;
import org.example.shidell.service.NotificacionService;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - Perfil automático de estudiante para docente")
class StudentProfileHelperTest {

    @Mock private CursoRepository cursoRepository;
    @Mock private UserRepository userRepository;
    @Mock private AsistenciaRepository asistenciaRepository;
    @Mock private CalificacionRepository calificacionRepository;
    @Mock private TareaRepository tareaRepository;
    @Mock private EventoRepository eventoRepository;
    @Mock private MaterialCursoRepository materialCursoRepository;
    @Mock private NotificacionService notificacionService;
    @Mock private MatriculaRepository matriculaRepository;
    @Mock private EntregaRepository entregaRepository;
    @Mock private AsistenciaService asistenciaService;
    @Mock private ForoSemanaMensajeRepository foroSemanaMensajeRepository;

    private DocenteService docenteService;
    private UserEntity docente;
    private UserEntity otroDocente;
    private UserEntity padre;
    private UserEntity estudiante;
    private Aula aula;
    private Curso cursoMio;
    private Curso cursoOtro;

    @BeforeEach
    void setUp() {
        docenteService = new DocenteService();
        EntityMapper mapper = new EntityMapper();
        ReflectionTestUtils.setField(mapper, "matriculaRepository", matriculaRepository);

        ReflectionTestUtils.setField(docenteService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(docenteService, "userRepository", userRepository);
        ReflectionTestUtils.setField(docenteService, "asistenciaRepository", asistenciaRepository);
        ReflectionTestUtils.setField(docenteService, "calificacionRepository", calificacionRepository);
        ReflectionTestUtils.setField(docenteService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(docenteService, "eventoRepository", eventoRepository);
        ReflectionTestUtils.setField(docenteService, "materialCursoRepository", materialCursoRepository);
        ReflectionTestUtils.setField(docenteService, "notificacionService", notificacionService);
        ReflectionTestUtils.setField(docenteService, "mapper", mapper);
        ReflectionTestUtils.setField(docenteService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(docenteService, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(docenteService, "asistenciaService", asistenciaService);
        ReflectionTestUtils.setField(docenteService, "foroSemanaMensajeRepository", foroSemanaMensajeRepository);

        docente = crearUsuario(10L, "Roberto", "Alvarado", "roberto@shidell.edu", "DOCENTE");
        otroDocente = crearUsuario(11L, "Ana", "García", "ana@shidell.edu", "DOCENTE");
        padre = crearUsuario(20L, "José", "Mendoza", "padre@gmail.com", "PADRE");
        padre.setTelefono("999111222");

        estudiante = crearUsuario(100L, "Carlos", "Mendoza", "carlos@shidell.edu", "ESTUDIANTE");
        estudiante.setDni("70012345");
        estudiante.setFechaNacimiento(LocalDate.now().minusYears(13));
        estudiante.setPadre(padre);

        aula = new Aula("SECUNDARIA", "1", "A", "TARDE", AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL);
        aula.setId(5L);
        aula.setTutor(otroDocente);

        cursoMio = crearCurso(50L, "Matemática", aula, docente, "purple");
        cursoOtro = crearCurso(51L, "Comunicación", aula, otroDocente, "blue");
    }

    @Test
    @DisplayName("Construye perfil automático completo con apoderado, cursos, notas, entregas e insights")
    @SuppressWarnings("unchecked")
    void obtenerPerfilEstudiante_construyePerfilCompleto() {
        Matricula matricula = new Matricula();
        matricula.setEstudiante(estudiante);
        matricula.setAula(aula);
        matricula.setAnioEscolar(AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL);
        UserEntity companero = crearUsuario(101L, "Lucía", "Acosta", "lucia@shidell.edu", "ESTUDIANTE");

        Tarea tareaVencida = new Tarea();
        tareaVencida.setId(200L);
        tareaVencida.setTitulo("Práctica 1");
        tareaVencida.setCurso(cursoMio);
        tareaVencida.setFechaVencimiento(LocalDate.now().minusDays(2));

        Calificacion notaMio = new Calificacion();
        notaMio.setId(300L);
        notaMio.setCurso(cursoMio);
        notaMio.setEstudiante(estudiante);
        notaMio.setActividad("Examen Parcial");
        notaMio.setNota(18.0);
        notaMio.setNotaMaxima(20.0);
        notaMio.setFecha(LocalDate.now().minusDays(1));

        Asistencia presente = new Asistencia();
        presente.setCurso(cursoMio);
        presente.setEstudiante(estudiante);
        presente.setFecha(LocalDate.now().minusDays(1));
        presente.setEstado("PRESENTE");

        when(userRepository.findById(100L)).thenReturn(Optional.of(estudiante));
        when(matriculaRepository.findByEstudianteAndAnioEscolar(estudiante, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL))
                .thenReturn(Optional.of(matricula));
        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE"))
                .thenReturn(List.of(cursoOtro, cursoMio));
        when(calificacionRepository.findByEstudianteId(100L)).thenReturn(List.of(notaMio));
        when(tareaRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE")).thenReturn(List.of(tareaVencida));
        when(entregaRepository.findByEstudiante(estudiante)).thenReturn(List.of());
        when(asistenciaRepository.findByEstudiante(estudiante)).thenReturn(List.of(presente));
        when(asistenciaService.getAsistenciasCompletas(estudiante)).thenReturn(List.of(presente));
        when(foroSemanaMensajeRepository.findByCursoIdInOrderBySemanaAscFechaAsc(List.of(51L, 50L)))
                .thenReturn(List.of());
        when(userRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE"))
                .thenReturn(List.of(estudiante, companero));

        Map<String, Object> perfil = docenteService.obtenerPerfilEstudianteParaDocente(100L, 10L);

        assertThat(perfil.get("edad")).isEqualTo(13);
        Map<String, Object> apoderado = (Map<String, Object>) perfil.get("apoderado");
        assertThat(apoderado.get("nombres")).isEqualTo("José");
        assertThat(apoderado.get("telefono")).isEqualTo("999111222");

        Map<String, Object> resumen = (Map<String, Object>) perfil.get("resumenAcademico");
        assertThat(resumen.get("promedioGeneral")).isEqualTo(18.0);
        assertThat(resumen.get("promedioEnMisCursos")).isEqualTo(18.0);
        assertThat(resumen.get("asistenciaPorcentaje")).isEqualTo(100);
        assertThat(resumen.get("tareasAtrasadas")).isEqualTo(1L);
        assertThat(resumen.get("estadoGeneral")).isEqualTo("ATENCION");

        List<Map<String, Object>> cursos = (List<Map<String, Object>>) perfil.get("cursos");
        assertThat(cursos).hasSize(2);
        assertThat(cursos.get(0).get("nombre")).isEqualTo("Matemática");
        assertThat(cursos.get(0).get("esMiCurso")).isEqualTo(true);

        List<Map<String, Object>> companeros = (List<Map<String, Object>>) perfil.get("companerosAula");
        assertThat(companeros).hasSize(2);
        assertThat(companeros.get(0).get("apellidos")).isEqualTo("Acosta");
    }

    @Test
    @DisplayName("Estudiante sin calificaciones ni faltas reporta estado SIN_EVALUACIONES de forma automática")
    @SuppressWarnings("unchecked")
    void obtenerPerfilEstudiante_sinNotasMuestraSeguimientoActivo() {
        when(userRepository.findById(100L)).thenReturn(Optional.of(estudiante));
        when(matriculaRepository.findByEstudianteAndAnioEscolar(estudiante, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL))
                .thenReturn(Optional.empty());
        when(matriculaRepository.findByEstudiante(estudiante)).thenReturn(List.of());
        when(calificacionRepository.findByEstudianteId(100L)).thenReturn(List.of());
        when(entregaRepository.findByEstudiante(estudiante)).thenReturn(List.of());
        when(asistenciaRepository.findByEstudiante(estudiante)).thenReturn(List.of());
        when(asistenciaService.getAsistenciasCompletas(estudiante)).thenReturn(List.of());

        Map<String, Object> perfil = docenteService.obtenerPerfilEstudianteParaDocente(100L, 10L);
        Map<String, Object> resumen = (Map<String, Object>) perfil.get("resumenAcademico");

        assertThat(resumen.get("tieneEvaluaciones")).isEqualTo(false);
        assertThat(resumen.get("asistenciaPorcentaje")).isEqualTo(100);
        assertThat(resumen.get("estadoGeneral")).isEqualTo("SIN_EVALUACIONES");
    }

    @Test
    @DisplayName("Rechaza usuarios que no tienen rol ESTUDIANTE")
    void obtenerPerfilEstudiante_noEstudianteLanzaNotFound() {
        when(userRepository.findById(10L)).thenReturn(Optional.of(docente));

        assertThatThrownBy(() -> docenteService.obtenerPerfilEstudianteParaDocente(10L, 10L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private UserEntity crearUsuario(Long id, String nombres, String apellidos, String email, String rol) {
        UserEntity u = new UserEntity();
        u.setId(id);
        u.setNombres(nombres);
        u.setApellidos(apellidos);
        u.setEmail(email);
        u.setRol(rol);
        return u;
    }

    private Curso crearCurso(Long id, String nombre, Aula aula, UserEntity prof, String color) {
        Curso c = new Curso();
        c.setId(id);
        c.setNombre(nombre);
        c.setAula(aula);
        c.setProfesor(prof);
        c.setColor(color);
        return c;
    }
}
