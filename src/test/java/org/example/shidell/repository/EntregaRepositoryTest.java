package org.example.shidell.repository;

import org.example.shidell.model.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@DisplayName("Pruebas de Integración - EntregaRepository (H2)")
class EntregaRepositoryTest {

    @Autowired
    private EntregaRepository entregaRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TareaRepository tareaRepository;

    @Autowired
    private CursoRepository cursoRepository;

    private UserEntity estudiante1;
    private UserEntity estudiante2;
    private UserEntity profesor;
    private Curso curso;
    private Tarea tarea;

    @BeforeEach
    void setUp() {
        entregaRepository.deleteAll();
        tareaRepository.deleteAll();
        cursoRepository.deleteAll();
        userRepository.deleteAll();

        profesor = new UserEntity();
        profesor.setNombres("Marta");
        profesor.setEmail("marta@shidell.com");
        profesor.setPassword("{SHA256}hash");
        profesor.setRol("DOCENTE");
        profesor = userRepository.save(profesor);

        estudiante1 = new UserEntity();
        estudiante1.setNombres("Pedro");
        estudiante1.setEmail("pedro@shidell.com");
        estudiante1.setPassword("{SHA256}hash");
        estudiante1.setRol("ESTUDIANTE");
        estudiante1 = userRepository.save(estudiante1);

        estudiante2 = new UserEntity();
        estudiante2.setNombres("María");
        estudiante2.setEmail("maria@shidell.com");
        estudiante2.setPassword("{SHA256}hash");
        estudiante2.setRol("ESTUDIANTE");
        estudiante2 = userRepository.save(estudiante2);

        curso = new Curso();
        curso.setNombre("Álgebra");
        curso.setProfesor(profesor);
        curso = cursoRepository.save(curso);

        tarea = new Tarea();
        tarea.setTitulo("Ejercicios Cap. 3");
        tarea.setCurso(curso);
        tarea = tareaRepository.save(tarea);
    }

    // ── findByTarea ────────────────────────────────────────────────

    @Test
    @DisplayName("findByTarea retorna todas las entregas de esa tarea")
    void findByTarea_retornaEntregasDeLaTarea() {
        Entrega e1 = crearEntrega(tarea, estudiante1, "ENTREGADO");
        Entrega e2 = crearEntrega(tarea, estudiante2, "ENTREGADO");
        entregaRepository.saveAll(List.of(e1, e2));

        List<Entrega> entregas = entregaRepository.findByTarea(tarea);

        assertThat(entregas).hasSize(2);
        assertThat(entregas).extracting(e -> e.getEstudiante().getNombres())
                .containsExactlyInAnyOrder("Pedro", "María");
    }

    @Test
    @DisplayName("findByTarea retorna vacío si nadie ha entregado")
    void findByTarea_sinEntregas_retornaVacio() {
        List<Entrega> entregas = entregaRepository.findByTarea(tarea);
        assertThat(entregas).isEmpty();
    }

    // ── findByEstudiante ───────────────────────────────────────────

    @Test
    @DisplayName("findByEstudiante retorna todas las entregas del estudiante")
    void findByEstudiante_retornaEntregasDelEstudiante() {
        // Crear una segunda tarea
        Tarea tarea2 = new Tarea();
        tarea2.setTitulo("Tarea 2");
        tarea2.setCurso(curso);
        tarea2 = tareaRepository.save(tarea2);

        Entrega e1 = crearEntrega(tarea, estudiante1, "ENTREGADO");
        Entrega e2 = crearEntrega(tarea2, estudiante1, "CALIFICADO");
        entregaRepository.saveAll(List.of(e1, e2));

        List<Entrega> entregas = entregaRepository.findByEstudiante(estudiante1);

        assertThat(entregas).hasSize(2);
        assertThat(entregas).extracting(e -> e.getTarea().getTitulo())
                .containsExactlyInAnyOrder("Ejercicios Cap. 3", "Tarea 2");
    }

    @Test
    @DisplayName("findByEstudiante no retorna entregas de otros estudiantes")
    void findByEstudiante_noRetornaEntregasDeOtros() {
        Entrega e1 = crearEntrega(tarea, estudiante1, "ENTREGADO");
        entregaRepository.save(e1);

        List<Entrega> entregas = entregaRepository.findByEstudiante(estudiante2);

        assertThat(entregas).isEmpty();
    }

    // ── findByTareaAndEstudiante ───────────────────────────────────

    @Test
    @DisplayName("findByTareaAndEstudiante retorna la entrega específica")
    void findByTareaAndEstudiante_retornaEntregaEspecifica() {
        Entrega entrega = crearEntrega(tarea, estudiante1, "ENTREGADO");
        entregaRepository.save(entrega);

        Optional<Entrega> resultado = entregaRepository.findByTareaAndEstudiante(tarea, estudiante1);

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getEstado()).isEqualTo("ENTREGADO");
    }

    @Test
    @DisplayName("findByTareaAndEstudiante retorna vacío si el estudiante no ha entregado")
    void findByTareaAndEstudiante_noEntregada_retornaVacio() {
        Optional<Entrega> resultado = entregaRepository.findByTareaAndEstudiante(tarea, estudiante1);
        assertThat(resultado).isEmpty();
    }

    @Test
    @DisplayName("Actualizar estado de entrega a CALIFICADO funciona correctamente")
    void actualizarEstadoCalificado_persisteCorrectamente() {
        Entrega entrega = crearEntrega(tarea, estudiante1, "ENTREGADO");
        entrega = entregaRepository.save(entrega);

        entrega.setEstado("CALIFICADO");
        entrega.setNota(18.5);
        entrega.setComentarioProfesor("Excelente trabajo");
        entregaRepository.save(entrega);

        Entrega actualizada = entregaRepository.findById(entrega.getId()).orElseThrow();
        assertThat(actualizada.getEstado()).isEqualTo("CALIFICADO");
        assertThat(actualizada.getNota()).isEqualTo(18.5);
        assertThat(actualizada.getComentarioProfesor()).isEqualTo("Excelente trabajo");
    }

    // ── Helpers ───────────────────────────────────────────────────

    private Entrega crearEntrega(Tarea tarea, UserEntity estudiante, String estado) {
        Entrega e = new Entrega();
        e.setTarea(tarea);
        e.setEstudiante(estudiante);
        e.setEstado(estado);
        e.setFechaEntrega(LocalDateTime.now());
        e.setArchivoUrl("/uploads/entregas/test.pdf");
        return e;
    }
}
