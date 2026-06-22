package org.example.shidell.service;

import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.entity.*;
import org.example.shidell.repository.NotificacionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - NotificacionService")
class NotificacionServiceTest {

    @Mock
    private NotificacionRepository notificacionRepository;

    // EntityMapper no necesita ser mockeado: no tiene dependencias externas.
    // Se crea una instancia real y se inyecta via ReflectionTestUtils para
    // evitar problemas de Mockito con Java 25 y clases finales/sealed.
    private final EntityMapper mapper = new EntityMapper();

    private NotificacionService notificacionService;

    private UserEntity estudiante;
    private UserEntity padre;
    private UserEntity profesor;
    private Curso curso;

    @BeforeEach
    void setUp() {
        // Instanciación manual para evitar @InjectMocks con Java 25
        notificacionService = new NotificacionService();
        ReflectionTestUtils.setField(notificacionService, "notificacionRepository", notificacionRepository);
        ReflectionTestUtils.setField(notificacionService, "mapper", mapper);

        padre = new UserEntity();
        padre.setId(1L);
        padre.setNombres("Roberto");
        padre.setRol("PADRE");

        estudiante = new UserEntity();
        estudiante.setId(2L);
        estudiante.setNombres("Sofia");
        estudiante.setRol("ESTUDIANTE");
        estudiante.setPadre(padre);

        profesor = new UserEntity();
        profesor.setId(3L);
        profesor.setNombres("Lucia");
        profesor.setRol("DOCENTE");

        curso = new Curso();
        curso.setId(1L);
        curso.setNombre("Ciencias Naturales");
        curso.setProfesor(profesor);
    }

    // ── crearNotificacion ──────────────────────────────────────────

    @Test
    @DisplayName("crearNotificacion debe persistir con datos correctos")
    void crearNotificacion_persisteCorrectamente() {
        notificacionService.crearNotificacion(estudiante, "Tarea calificada", "Tu nota es 18");

        ArgumentCaptor<Notificacion> captor = ArgumentCaptor.forClass(Notificacion.class);
        verify(notificacionRepository).save(captor.capture());

        Notificacion guardada = captor.getValue();
        assertThat(guardada.getUsuario()).isEqualTo(estudiante);
        assertThat(guardada.getTitulo()).isEqualTo("Tarea calificada");
        assertThat(guardada.getMensaje()).isEqualTo("Tu nota es 18");
        assertThat(guardada.getLeida()).isFalse();
        assertThat(guardada.getFecha()).isNotNull();
    }

    // ── marcarComoLeida ────────────────────────────────────────────

    @Test
    @DisplayName("marcarComoLeida debe marcar la notificación como leída")
    void marcarComoLeida_marcaCorrectamente() {
        Notificacion notif = new Notificacion();
        notif.setId(10L);
        notif.setLeida(false);
        when(notificacionRepository.findById(10L)).thenReturn(Optional.of(notif));

        notificacionService.marcarComoLeida(10L);

        ArgumentCaptor<Notificacion> captor = ArgumentCaptor.forClass(Notificacion.class);
        verify(notificacionRepository).save(captor.capture());
        assertThat(captor.getValue().getLeida()).isTrue();
    }

    @Test
    @DisplayName("marcarComoLeida no hace nada si no existe la notificación")
    void marcarComoLeida_noExiste_noLanzaExcepcion() {
        when(notificacionRepository.findById(999L)).thenReturn(Optional.empty());

        notificacionService.marcarComoLeida(999L);

        verify(notificacionRepository, never()).save(any());
    }

    // ── Sistema Experto: alertarPadrePorFalta ──────────────────────

    @Test
    @DisplayName("alertarPadrePorFalta AUSENTE debe notificar al padre con etiqueta [CRITICO]")
    void alertarPadrePorFalta_ausente_notificaConCritico() {
        Asistencia asistencia = new Asistencia();
        asistencia.setEstudiante(estudiante);
        asistencia.setCurso(curso);
        asistencia.setFecha(LocalDate.now());
        asistencia.setEstado("AUSENTE");

        notificacionService.alertarPadrePorFalta(asistencia);

        ArgumentCaptor<Notificacion> captor = ArgumentCaptor.forClass(Notificacion.class);
        verify(notificacionRepository).save(captor.capture());
        assertThat(captor.getValue().getUsuario()).isEqualTo(padre);
        assertThat(captor.getValue().getTitulo()).contains("[CRITICO]");
        assertThat(captor.getValue().getMensaje()).contains("AUSENTE");
    }

    @Test
    @DisplayName("alertarPadrePorFalta TARDE debe notificar al padre con etiqueta [ALERTA]")
    void alertarPadrePorFalta_tarde_notificaConAlerta() {
        Asistencia asistencia = new Asistencia();
        asistencia.setEstudiante(estudiante);
        asistencia.setCurso(curso);
        asistencia.setFecha(LocalDate.now());
        asistencia.setEstado("TARDE");

        notificacionService.alertarPadrePorFalta(asistencia);

        ArgumentCaptor<Notificacion> captor = ArgumentCaptor.forClass(Notificacion.class);
        verify(notificacionRepository).save(captor.capture());
        assertThat(captor.getValue().getTitulo()).contains("[ALERTA]");
    }

    @Test
    @DisplayName("alertarPadrePorFalta PRESENTE no debe notificar al padre")
    void alertarPadrePorFalta_presente_noNotifica() {
        Asistencia asistencia = new Asistencia();
        asistencia.setEstudiante(estudiante);
        asistencia.setCurso(curso);
        asistencia.setFecha(LocalDate.now());
        asistencia.setEstado("PRESENTE");

        notificacionService.alertarPadrePorFalta(asistencia);

        verify(notificacionRepository, never()).save(any());
    }

    @Test
    @DisplayName("alertarPadrePorFalta no notifica si el estudiante no tiene padre asignado")
    void alertarPadrePorFalta_sinPadre_noNotifica() {
        estudiante.setPadre(null);
        Asistencia asistencia = new Asistencia();
        asistencia.setEstudiante(estudiante);
        asistencia.setCurso(curso);
        asistencia.setFecha(LocalDate.now());
        asistencia.setEstado("AUSENTE");

        notificacionService.alertarPadrePorFalta(asistencia);

        verify(notificacionRepository, never()).save(any());
    }

    // ── Sistema Experto: alertarPadrePorBajaNota ──────────────────

    @Test
    @DisplayName("alertarPadrePorBajaNota con nota menor a 11 debe notificar al padre")
    void alertarPadrePorBajaNota_notaBaja_notificaPadre() {
        Calificacion calificacion = new Calificacion();
        calificacion.setEstudiante(estudiante);
        calificacion.setCurso(curso);
        calificacion.setActividad("Examen Mensual");
        calificacion.setNota(8.0);

        notificacionService.alertarPadrePorBajaNota(calificacion);

        ArgumentCaptor<Notificacion> captor = ArgumentCaptor.forClass(Notificacion.class);
        verify(notificacionRepository).save(captor.capture());
        assertThat(captor.getValue().getUsuario()).isEqualTo(padre);
        assertThat(captor.getValue().getTitulo()).contains("[ALERTA]");
        assertThat(captor.getValue().getMensaje()).contains("8.0");
    }

    @Test
    @DisplayName("alertarPadrePorBajaNota con nota 11 o más NO debe notificar al padre")
    void alertarPadrePorBajaNota_notaAprobada_noNotifica() {
        Calificacion calificacion = new Calificacion();
        calificacion.setEstudiante(estudiante);
        calificacion.setCurso(curso);
        calificacion.setActividad("Práctica");
        calificacion.setNota(15.0);

        notificacionService.alertarPadrePorBajaNota(calificacion);

        verify(notificacionRepository, never()).save(any());
    }

    @Test
    @DisplayName("alertarPadrePorBajaNota con nota exactamente 11 NO notifica")
    void alertarPadrePorBajaNota_notaLimite11_noNotifica() {
        Calificacion calificacion = new Calificacion();
        calificacion.setEstudiante(estudiante);
        calificacion.setCurso(curso);
        calificacion.setActividad("Control");
        calificacion.setNota(11.0);

        notificacionService.alertarPadrePorBajaNota(calificacion);

        verify(notificacionRepository, never()).save(any());
    }

    // ── Sistema Experto: alertarPadrePorTareaNoEntregada ──────────

    @Test
    @DisplayName("alertarPadrePorTareaNoEntregada debe notificar al padre con etiqueta [CRITICO]")
    void alertarPadrePorTareaNoEntregada_notificaConCritico() {
        Tarea tarea = new Tarea();
        tarea.setTitulo("Informe Final");
        tarea.setCurso(curso);
        tarea.setFechaVencimiento(LocalDate.now().minusDays(1));

        notificacionService.alertarPadrePorTareaNoEntregada(tarea, estudiante);

        ArgumentCaptor<Notificacion> captor = ArgumentCaptor.forClass(Notificacion.class);
        verify(notificacionRepository).save(captor.capture());
        assertThat(captor.getValue().getUsuario()).isEqualTo(padre);
        assertThat(captor.getValue().getTitulo()).contains("[CRITICO]");
        assertThat(captor.getValue().getMensaje()).contains("Informe Final");
    }

    @Test
    @DisplayName("alertarPadrePorTareaNoEntregada no notifica si estudiante no tiene padre")
    void alertarPadrePorTareaNoEntregada_sinPadre_noNotifica() {
        estudiante.setPadre(null);
        Tarea tarea = new Tarea();
        tarea.setTitulo("Ejercicio");
        tarea.setCurso(curso);
        tarea.setFechaVencimiento(LocalDate.now());

        notificacionService.alertarPadrePorTareaNoEntregada(tarea, estudiante);

        verify(notificacionRepository, never()).save(any());
    }
}
