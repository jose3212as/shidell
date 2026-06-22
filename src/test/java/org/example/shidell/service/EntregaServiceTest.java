package org.example.shidell.service;

import org.example.shidell.model.entity.*;
import org.example.shidell.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - EntregaService (calificarEntrega)")
class EntregaServiceTest {

    @Mock
    private EntregaRepository entregaRepository;
    @Mock
    private TareaRepository tareaRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificacionService notificacionService;

    // Instanciación manual para Java 25 compatibility
    private EntregaService entregaService;

    private UserEntity estudiante;
    private UserEntity profesor;
    private Curso curso;
    private Tarea tarea;
    private Entrega entrega;

    @BeforeEach
    void setUp() {
        // Instanciación y campo-inyección manual
        entregaService = new EntregaService();
        ReflectionTestUtils.setField(entregaService, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(entregaService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(entregaService, "userRepository", userRepository);
        ReflectionTestUtils.setField(entregaService, "notificacionService", notificacionService);

        profesor = new UserEntity();
        profesor.setId(10L);
        profesor.setNombres("Marta");
        profesor.setApellidos("Ríos");
        profesor.setRol("DOCENTE");

        estudiante = new UserEntity();
        estudiante.setId(20L);
        estudiante.setNombres("Pedro");
        estudiante.setApellidos("Mamani");
        estudiante.setRol("ESTUDIANTE");

        curso = new Curso();
        curso.setId(1L);
        curso.setNombre("Matemáticas");
        curso.setProfesor(profesor);

        tarea = new Tarea();
        tarea.setId(5L);
        tarea.setTitulo("Ejercicios de álgebra");
        tarea.setCurso(curso);

        entrega = new Entrega();
        entrega.setId(100L);
        entrega.setTarea(tarea);
        entrega.setEstudiante(estudiante);
        entrega.setEstado("ENTREGADO");
        entrega.setArchivoUrl("/uploads/entregas/tarea.pdf");
    }

    // ── calificarEntrega ───────────────────────────────────────────

    @Test
    @DisplayName("calificarEntrega debe guardar nota, comentario y cambiar estado a CALIFICADO")
    void calificarEntrega_actualizaCorrectamente() {
        when(entregaRepository.findById(100L)).thenReturn(Optional.of(entrega));
        when(entregaRepository.save(any(Entrega.class))).thenAnswer(inv -> inv.getArgument(0));

        Entrega resultado = entregaService.calificarEntrega(100L, 18.5, "Excelente trabajo");

        assertThat(resultado.getNota()).isEqualTo(18.5);
        assertThat(resultado.getComentarioProfesor()).isEqualTo("Excelente trabajo");
        assertThat(resultado.getEstado()).isEqualTo("CALIFICADO");
    }

    @Test
    @DisplayName("calificarEntrega debe notificar al estudiante después de calificar")
    void calificarEntrega_notificaAlEstudiante() {
        when(entregaRepository.findById(100L)).thenReturn(Optional.of(entrega));
        when(entregaRepository.save(any(Entrega.class))).thenAnswer(inv -> inv.getArgument(0));

        entregaService.calificarEntrega(100L, 15.0, "Bien");

        verify(notificacionService, times(1)).crearNotificacion(
                eq(estudiante),
                contains("calificada"),
                contains("15.0")
        );
    }

    @Test
    @DisplayName("calificarEntrega lanza excepción si la entrega no existe")
    void calificarEntrega_entregaNoExiste_lanzaExcepcion() {
        when(entregaRepository.findById(999L)).thenReturn(Optional.empty());

        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.NoSuchElementException.class,
                () -> entregaService.calificarEntrega(999L, 10.0, "Sin comentario")
        );
        verify(notificacionService, never()).crearNotificacion(any(), any(), any());
    }

    @Test
    @DisplayName("calificarEntrega persiste los cambios en el repositorio")
    void calificarEntrega_guardaEnRepositorio() {
        when(entregaRepository.findById(100L)).thenReturn(Optional.of(entrega));
        when(entregaRepository.save(any(Entrega.class))).thenAnswer(inv -> inv.getArgument(0));

        entregaService.calificarEntrega(100L, 20.0, "Perfecto");

        ArgumentCaptor<Entrega> captor = ArgumentCaptor.forClass(Entrega.class);
        verify(entregaRepository).save(captor.capture());
        assertThat(captor.getValue().getNota()).isEqualTo(20.0);
        assertThat(captor.getValue().getEstado()).isEqualTo("CALIFICADO");
    }

    // ── obtenerEntregasPorEstudiante ───────────────────────────────

    @Test
    @DisplayName("obtenerEntregasPorEstudiante retorna entregas del estudiante")
    void obtenerEntregasPorEstudiante_retornaEntregas() {
        when(userRepository.findById(20L)).thenReturn(Optional.of(estudiante));
        when(entregaRepository.findByEstudiante(estudiante)).thenReturn(List.of(entrega));

        var resultado = entregaService.obtenerEntregasPorEstudiante(20L);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getEstudiante().getNombres()).isEqualTo("Pedro");
    }

    @Test
    @DisplayName("obtenerEntregasPorTarea retorna entregas de la tarea")
    void obtenerEntregasPorTarea_retornaEntregas() {
        when(tareaRepository.findById(5L)).thenReturn(Optional.of(tarea));
        when(entregaRepository.findByTarea(tarea)).thenReturn(List.of(entrega));

        var resultado = entregaService.obtenerEntregasPorTarea(5L);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getTarea().getTitulo()).isEqualTo("Ejercicios de álgebra");
    }
}
