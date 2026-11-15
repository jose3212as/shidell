package org.example.shidell.mapper;

import org.example.shidell.model.dto.*;
import org.example.shidell.model.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Pruebas Unitarias - EntityMapper")
class EntityMapperTest {

    private EntityMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new EntityMapper();
    }

    // ── UserEntity → UserDTO ───────────────────────────────────────

    @Test
    @DisplayName("toDTO(UserEntity) mapea todos los campos correctamente")
    void toDTO_userEntity_mapeaCorrectamente() {
        UserEntity entity = new UserEntity();
        entity.setId(1L);
        entity.setNombres("  Ana  ");
        entity.setApellidos("García");
        entity.setEmail("ana@shidell.com");
        entity.setRol("ESTUDIANTE");
        entity.setNivel("SECUNDARIA");
        entity.setGrado("3");
        entity.setSeccion("B");

        UserDTO dto = mapper.toDTO(entity);

        assertThat(dto.getId()).isEqualTo(1L);
        assertThat(dto.getNombres()).isEqualTo("Ana"); // limpia espacios
        assertThat(dto.getApellidos()).isEqualTo("García");
        assertThat(dto.getEmail()).isEqualTo("ana@shidell.com");
        assertThat(dto.getRol()).isEqualTo("ESTUDIANTE");
        assertThat(dto.getNivel()).isEqualTo("SECUNDARIA");
        assertThat(dto.getGrado()).isEqualTo("3");
        assertThat(dto.getSeccion()).isEqualTo("B");
    }

    @Test
    @DisplayName("toDTO(UserEntity) retorna null si la entidad es null")
    void toDTO_userEntityNull_retornaNull() {
        assertThat(mapper.toDTO((UserEntity) null)).isNull();
    }

    @Test
    @DisplayName("toDTO(UserEntity) incluye padreId si el usuario tiene padre asignado")
    void toDTO_userEntityConPadre_incluyePadreId() {
        UserEntity padre = new UserEntity();
        padre.setId(99L);

        UserEntity estudiante = new UserEntity();
        estudiante.setId(10L);
        estudiante.setNombres("Luis");
        estudiante.setPadre(padre);

        UserDTO dto = mapper.toDTO(estudiante);

        assertThat(dto.getPadreId()).isEqualTo(99L);
    }

    // ── Notificacion → NotificacionDTO ────────────────────────────

    @Test
    @DisplayName("toDTO(Notificacion) mapea titulo, mensaje, fecha y leida correctamente")
    void toDTO_notificacion_mapeaCorrectamente() {
        Notificacion notif = new Notificacion();
        notif.setId(5L);
        notif.setTitulo("Nueva tarea");
        notif.setMensaje("Tienes una tarea pendiente");
        notif.setLeida(false);
        notif.setFecha(LocalDateTime.of(2025, 6, 15, 10, 30));

        NotificacionDTO dto = mapper.toDTO(notif);

        assertThat(dto.getId()).isEqualTo(5L);
        assertThat(dto.getTitulo()).isEqualTo("Nueva tarea");
        assertThat(dto.getMensaje()).isEqualTo("Tienes una tarea pendiente");
        assertThat(dto.getLeida()).isFalse();
        assertThat(dto.getFecha()).isEqualTo(LocalDateTime.of(2025, 6, 15, 10, 30));
    }

    @Test
    @DisplayName("toDTO(Notificacion) retorna null si la entidad es null")
    void toDTO_notificacionNull_retornaNull() {
        assertThat(mapper.toDTO((Notificacion) null)).isNull();
    }

    // ── Calificacion → CalificacionDTO ────────────────────────────

    @Test
    @DisplayName("toDTO(Calificacion) calcula nota sobre 20 correctamente")
    void toDTO_calificacion_calculaNota20Correctamente() {
        Calificacion cal = new Calificacion();
        cal.setId(1L);
        cal.setActividad("Examen Parcial");
        cal.setNota(15.0);
        cal.setNotaMaxima(20.0);
        cal.setFecha(LocalDate.now());

        Curso curso = new Curso();
        curso.setId(1L);
        curso.setNombre("Matemáticas");
        cal.setCurso(curso);

        CalificacionDTO dto = mapper.toDTO(cal);

        assertThat(dto.getNota()).isEqualTo(15.0);
        assertThat(dto.getNota20()).isEqualTo(15.0); // 15/20 * 20 = 15
        assertThat(dto.getEstado()).isEqualTo("Aprobado");
    }

    @Test
    @DisplayName("toDTO(Calificacion) marca como Desaprobado cuando nota20 es menor a 11")
    void toDTO_calificacion_marcaDesaprobado() {
        Calificacion cal = new Calificacion();
        cal.setId(2L);
        cal.setActividad("Control");
        cal.setNota(8.0);
        cal.setNotaMaxima(20.0);

        Curso curso = new Curso();
        curso.setId(1L);
        curso.setNombre("Historia");
        cal.setCurso(curso);

        CalificacionDTO dto = mapper.toDTO(cal);

        assertThat(dto.getEstado()).isEqualTo("Desaprobado");
        assertThat(dto.getNota20()).isLessThan(11.0);
    }

    @Test
    @DisplayName("toDTO(Calificacion) usa notaMaxima de 20 por defecto si es null")
    void toDTO_calificacion_notaMaximaDefaultEs20() {
        Calificacion cal = new Calificacion();
        cal.setNota(10.0);
        cal.setNotaMaxima(null); // no especificada

        Curso curso = new Curso();
        curso.setNombre("Arte");
        cal.setCurso(curso);

        CalificacionDTO dto = mapper.toDTO(cal);

        assertThat(dto.getNotaMaxima()).isEqualTo(20.0);
    }

    @Test
    @DisplayName("toDTO(Calificacion) incluye estudiante y metadatos de evaluacion")
    void toDTO_calificacion_incluyeEstudianteYEvaluacion() {
        UserEntity est = new UserEntity();
        est.setId(44L);
        est.setNombres("Lucía");
        est.setApellidos("Castillo");
        est.setRol("ESTUDIANTE");

        Evaluacion ev = new Evaluacion();
        ev.setId(9L);
        ev.setTitulo("Examen Bimestral 1");
        ev.setTipo("EXAMEN");
        ev.setPeso(2.0);

        Calificacion cal = new Calificacion();
        cal.setId(3L);
        cal.setActividad("Examen Bimestral 1");
        cal.setNota(17.0);
        cal.setNotaMaxima(20.0);
        cal.setEstudiante(est);
        cal.setEvaluacion(ev);

        CalificacionDTO dto = mapper.toDTO(cal);

        assertThat(dto.getEstudiante()).isNotNull();
        assertThat(dto.getEstudiante().getId()).isEqualTo(44L);
        assertThat(dto.getEstudiante().getNombres()).isEqualTo("Lucía");
        assertThat(dto.getEvaluacionId()).isEqualTo(9L);
        assertThat(dto.getTipo()).isEqualTo("EXAMEN");
        assertThat(dto.getPeso()).isEqualTo(2.0);
    }

    @Test
    @DisplayName("toDTO(Evaluacion) mapea titulo, tipo, bimestre, peso y cursoId")
    void toDTO_evaluacion_mapeaCorrectamente() {
        Curso curso = new Curso();
        curso.setId(909L);

        Evaluacion ev = new Evaluacion();
        ev.setId(12L);
        ev.setTitulo("  Práctica 1  ");
        ev.setTipo("PRACTICA");
        ev.setBimestre(2);
        ev.setPeso(1.5);
        ev.setNotaMaxima(20.0);
        ev.setFecha(LocalDate.of(2026, 6, 10));
        ev.setCurso(curso);

        EvaluacionDTO dto = mapper.toDTO(ev);

        assertThat(dto.getId()).isEqualTo(12L);
        assertThat(dto.getTitulo()).isEqualTo("Práctica 1");
        assertThat(dto.getTipo()).isEqualTo("PRACTICA");
        assertThat(dto.getBimestre()).isEqualTo(2);
        assertThat(dto.getPeso()).isEqualTo(1.5);
        assertThat(dto.getCursoId()).isEqualTo(909L);
    }

    // ── Tarea → TareaDTO ──────────────────────────────────────────

    @Test
    @DisplayName("toDTO(Tarea) mapea campos correctamente")
    void toDTO_tarea_mapeaCorrectamente() {
        Curso curso = new Curso();
        curso.setId(1L);
        curso.setNombre("Lengua");

        Tarea tarea = new Tarea();
        tarea.setId(7L);
        tarea.setTitulo("Redacción");
        tarea.setDescripcion("Escribir un ensayo");
        tarea.setPrioridad("Alta");
        tarea.setEstado("Pendiente");
        tarea.setFechaInicio(LocalDate.of(2025, 6, 1));
        tarea.setFechaVencimiento(LocalDate.of(2025, 6, 15));
        tarea.setCurso(curso);

        TareaDTO dto = mapper.toDTO(tarea);

        assertThat(dto.getId()).isEqualTo(7L);
        assertThat(dto.getTitulo()).isEqualTo("Redacción");
        assertThat(dto.getPrioridad()).isEqualTo("Alta");
        assertThat(dto.getEstado()).isEqualTo("Pendiente");
        assertThat(dto.getCurso().getNombre()).isEqualTo("Lengua");
    }

    // ── Asistencia → AsistenciaDTO ────────────────────────────────

    @Test
    @DisplayName("toDTO(Asistencia) asistio es false cuando estado es AUSENTE")
    void toDTO_asistencia_ausenteAsistioEsFalse() {
        Asistencia asistencia = new Asistencia();
        asistencia.setId(1L);
        asistencia.setEstado("AUSENTE");
        asistencia.setFecha(LocalDate.now());

        Curso curso = new Curso();
        curso.setNombre("Física");
        asistencia.setCurso(curso);

        AsistenciaDTO dto = mapper.toDTO(asistencia);

        assertThat(dto.isAsistio()).isFalse();
    }

    @Test
    @DisplayName("toDTO(Asistencia) asistio es true cuando estado es PRESENTE")
    void toDTO_asistencia_presenteAsistioEsTrue() {
        Asistencia asistencia = new Asistencia();
        asistencia.setId(2L);
        asistencia.setEstado("PRESENTE");
        asistencia.setFecha(LocalDate.now());

        Curso curso = new Curso();
        curso.setNombre("Química");
        asistencia.setCurso(curso);

        AsistenciaDTO dto = mapper.toDTO(asistencia);

        assertThat(dto.isAsistio()).isTrue();
    }
}
