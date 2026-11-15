package org.example.shidell.service;

import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.NotificacionDTO;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.repository.EntregaRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.repository.NotificacionRepository;
import org.example.shidell.repository.TareaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.GradeCalculationHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class NotificacionService {

    @Autowired
    private NotificacionRepository notificacionRepository;

    @Autowired
    private EntityMapper mapper;

    @Autowired(required = false)
    private TareaRepository tareaRepository;

    @Autowired(required = false)
    private UserRepository userRepository;

    @Autowired(required = false)
    private EntregaRepository entregaRepository;

    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;

    public void crearNotificacion(UserEntity usuario, String titulo, String mensaje) {
        Notificacion notificacion = new Notificacion();
        notificacion.setUsuario(usuario);
        notificacion.setTitulo(titulo);
        notificacion.setMensaje(mensaje);
        notificacion.setFecha(LocalDateTime.now());
        notificacion.setLeida(false);
        notificacionRepository.save(notificacion);
    }

    public List<NotificacionDTO> obtenerNotificaciones(UserEntity usuario) {
        return notificacionRepository.findByUsuarioOrderByFechaDesc(usuario).stream()
                .map(mapper::toDTO)
                .toList();
    }

    public void marcarComoLeida(Long id) {
        notificacionRepository.findById(id).ifPresent(n -> {
            n.setLeida(true);
            notificacionRepository.save(n);
        });
    }

    public void marcarTodasComoLeidas(UserEntity usuario) {
        if (usuario != null) {
            notificacionRepository.marcarTodasComoLeidasBatch(usuario);
        }
    }

    // --- SISTEMA EXPERTO DE ALERTAS PARA PADRES ---

    public void alertarPadrePorFalta(Asistencia asistencia) {
        if (asistencia == null) return;
        UserEntity estudiante = asistencia.getEstudiante();
        if (estudiante == null || estudiante.getPadre() == null) return;

        UserEntity padre = estudiante.getPadre();
        String estado = asistencia.getEstado();
        String cursoNombre = (asistencia.getCurso() != null && asistencia.getCurso().getNombre() != null)
                ? asistencia.getCurso().getNombre()
                : "su curso";
        String fechaTexto = asistencia.getFecha() != null ? asistencia.getFecha().toString() : "";

        if ("AUSENTE".equals(estado) || "TARDE".equals(estado)) {
            String severidad = "AUSENTE".equals(estado) ? "[CRITICO]" : "[ALERTA]";
            String titulo = severidad + " Problema de Asistencia: " + estudiante.getNombres();
            String mensaje = "El estudiante " + estudiante.getNombres() + " fue marcado como " + estado +
                             " en el curso de " + cursoNombre +
                             " el día " + fechaTexto + ".";
            crearNotificacion(padre, titulo, mensaje);
        } else if ("JUSTIFICADO".equals(estado)) {
            String titulo = "[AVISO] Asistencia justificada: " + estudiante.getNombres();
            String mensaje = "La asistencia de " + estudiante.getNombres() + " en el curso de " + cursoNombre +
                             " (" + fechaTexto + ") quedó registrada como JUSTIFICADO.";
            crearNotificacion(padre, titulo, mensaje);
        }
    }

    public void alertarPadrePorBajaNota(Calificacion calificacion) {
        UserEntity estudiante = calificacion.getEstudiante();
        if (estudiante == null || estudiante.getPadre() == null) return;

        UserEntity padre = estudiante.getPadre();
        if (calificacion.getNota() != null && calificacion.getNota() < 11.0) {
            String titulo = "[ALERTA] Bajo rendimiento: " + estudiante.getNombres();
            String mensaje = "El estudiante " + estudiante.getNombres() + " obtuvo una calificación de " + 
                             calificacion.getNota() + " en la evaluación '" + calificacion.getActividad() + 
                             "' del curso " + calificacion.getCurso().getNombre() + ". Se recomienda supervisión.";
            crearNotificacion(padre, titulo, mensaje);
        }
    }

    /**
     * Notifica al padre de familia cuando el estudiante obtiene una calificación aprobatoria (>= 11).
     * Las notas menores a 11 continúan notificándose como alerta en {@link #alertarPadrePorBajaNota}.
     */
    public void notificarCalificacionAPadre(Calificacion calificacion) {
        if (calificacion == null || calificacion.getNota() == null) return;
        if (calificacion.getNota() < GradeCalculationHelper.NOTA_APROBATORIA) return;
        UserEntity estudiante = calificacion.getEstudiante();
        if (estudiante == null || estudiante.getPadre() == null) return;
        UserEntity padre = estudiante.getPadre();
        if ("ARCHIVADO".equalsIgnoreCase(padre.getRol())) return;

        String cursoNombre = (calificacion.getCurso() != null && calificacion.getCurso().getNombre() != null)
                ? calificacion.getCurso().getNombre()
                : "su curso";
        double notaMax = calificacion.getNotaMaxima() != null ? calificacion.getNotaMaxima() : 20.0;
        String titulo = "Calificación publicada (" + estudiante.getNombres() + "): " + cursoNombre;
        String mensaje = estudiante.getNombres() + " obtuvo " + calificacion.getNota() + "/" + notaMax +
                         " en \"" + calificacion.getActividad() + "\".";
        crearNotificacion(padre, titulo, mensaje);
    }

    /**
     * Informa al padre cuando el estudiante adjunta y envía la entrega de una tarea.
     */
    public void notificarEntregaDeTareaAPadre(Entrega entrega) {
        if (entrega == null || entrega.getEstudiante() == null || entrega.getTarea() == null) return;
        UserEntity estudiante = entrega.getEstudiante();
        UserEntity padre = estudiante.getPadre();
        if (padre == null || "ARCHIVADO".equalsIgnoreCase(padre.getRol())) return;

        Tarea tarea = entrega.getTarea();
        String cursoNombre = (tarea.getCurso() != null && tarea.getCurso().getNombre() != null)
                ? tarea.getCurso().getNombre()
                : "su curso";
        boolean tarde = "ENTREGADO_TARDE".equalsIgnoreCase(entrega.getEstado());
        String titulo = "Tarea entregada (" + estudiante.getNombres() + "): " + cursoNombre;
        String mensaje = estudiante.getNombres() + (tarde ? " envió fuera de plazo " : " envió con archivo PDF ") +
                         "la tarea \"" + tarea.getTitulo() + "\".";
        crearNotificacion(padre, titulo, mensaje);
    }

    public void alertarPadrePorTareaNoEntregada(Tarea tarea, UserEntity estudiante) {
        if (estudiante == null || estudiante.getPadre() == null) return;

        UserEntity padre = estudiante.getPadre();
        String titulo = "[CRITICO] Tarea no entregada: " + estudiante.getNombres();
        String mensaje = "El estudiante " + estudiante.getNombres() + " no presentó la tarea '" + 
                         tarea.getTitulo() + "' del curso " + tarea.getCurso().getNombre() + 
                         " (Vencimiento: " + tarea.getFechaVencimiento().toString() + ").";
        crearNotificacion(padre, titulo, mensaje);
    }

    @Scheduled(cron = "0 0 8 * * *")
    public int verificarYAlertarTareasVencidas() {
        if (tareaRepository == null || userRepository == null || entregaRepository == null) {
            return 0;
        }
        LocalDate hoy = LocalDate.now();
        LocalDate limiteAntiguedad = hoy.minusDays(14);
        int generadas = 0;
        Map<String, List<UserEntity>> estudiantesPorGrupo = new HashMap<>();

        for (Tarea tarea : tareaRepository.findAll()) {
            if (tarea == null || tarea.getFechaVencimiento() == null || tarea.getCurso() == null) continue;
            LocalDate vence = tarea.getFechaVencimiento();
            if (!vence.isBefore(hoy) || vence.isBefore(limiteAntiguedad)) continue;

            Curso curso = tarea.getCurso();
            if (curso.getNivel() == null || curso.getGrado() == null || curso.getSeccion() == null) continue;

            String key = curso.getNivel() + "|" + curso.getGrado() + "|" + curso.getSeccion() + "|" + curso.getTurno();
            List<UserEntity> estudiantes = estudiantesPorGrupo.computeIfAbsent(key, k ->
                    userRepository.findByGrupoAcademico(curso.getNivel(), curso.getGrado(), curso.getSeccion(), curso.getTurno()));
            for (UserEntity estudiante : estudiantes) {
                if (verificarYAlertarSiVencidaSinEntrega(tarea, estudiante, hoy, limiteAntiguedad)) {
                    generadas++;
                }
            }
        }
        return generadas;
    }

    /**
     * Evalúa bajo demanda las tareas vencidas y sin entrega de todos los hijos vinculados al padre,
     * garantizando alertas actualizadas sin duplicar notificaciones existentes.
     */
    public int verificarYAlertarTareasVencidasParaPadre(UserEntity padre) {
        if (padre == null || padre.getId() == null || tareaRepository == null || userRepository == null || entregaRepository == null) {
            return 0;
        }
        LocalDate hoy = LocalDate.now();
        LocalDate limiteAntiguedad = hoy.minusDays(14);
        int generadas = 0;

        List<UserEntity> hijos = userRepository.findByPadreId(padre.getId());
        for (UserEntity hijo : hijos) {
            if (hijo == null || !"ESTUDIANTE".equalsIgnoreCase(hijo.getRol())) continue;
            AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(hijo, matriculaRepository);
            if (!grupo.isComplete()) continue;

            List<Tarea> tareas = tareaRepository.findByGrupoAcademico(
                    grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno());
            for (Tarea tarea : tareas) {
                if (verificarYAlertarSiVencidaSinEntrega(tarea, hijo, hoy, limiteAntiguedad)) {
                    generadas++;
                }
            }
        }
        return generadas;
    }

    private boolean verificarYAlertarSiVencidaSinEntrega(
            Tarea tarea, UserEntity estudiante, LocalDate hoy, LocalDate limiteAntiguedad) {
        if (tarea == null || tarea.getFechaVencimiento() == null || tarea.getCurso() == null) return false;
        LocalDate vence = tarea.getFechaVencimiento();
        if (!vence.isBefore(hoy) || vence.isBefore(limiteAntiguedad)) return false;
        if (estudiante == null
                || !"ESTUDIANTE".equalsIgnoreCase(estudiante.getRol())
                || estudiante.getPadre() == null
                || "ARCHIVADO".equalsIgnoreCase(estudiante.getPadre().getRol())) {
            return false;
        }
        if (entregaRepository.findByTareaAndEstudiante(tarea, estudiante).isPresent()) {
            return false;
        }
        UserEntity padre = estudiante.getPadre();
        String titulo = "[CRITICO] Tarea no entregada: " + estudiante.getNombres();
        String mensaje = "El estudiante " + estudiante.getNombres() + " no presentó la tarea '" +
                tarea.getTitulo() + "' del curso " + tarea.getCurso().getNombre() +
                " (Vencimiento: " + vence + ").";
        if (notificacionRepository.existsByUsuarioAndTituloAndMensaje(padre, titulo, mensaje)) {
            return false;
        }
        alertarPadrePorTareaNoEntregada(tarea, estudiante);
        return true;
    }

    // --- NOTIFICACIONES AUTOMÁTICAS PARA ESTUDIANTES Y PADRES ---

    public void notificarNuevaTareaAEstudiantes(Tarea tarea, List<UserEntity> estudiantes) {
        if (tarea == null || estudiantes == null || estudiantes.isEmpty()) return;
        String cursoNombre = (tarea.getCurso() != null && tarea.getCurso().getNombre() != null)
                ? tarea.getCurso().getNombre()
                : "tu curso";
        String vencimiento = tarea.getFechaVencimiento() != null
                ? " (Entrega hasta: " + tarea.getFechaVencimiento() + ")"
                : "";
        String titulo = "Nueva tarea: " + cursoNombre;
        String mensaje = "Tu docente publicó la tarea \"" + tarea.getTitulo() + "\"" + vencimiento + ".";
        Set<String> padresNotificados = new HashSet<>();

        for (UserEntity estudiante : estudiantes) {
            if (estudiante == null || !"ESTUDIANTE".equalsIgnoreCase(estudiante.getRol())) continue;
            crearNotificacion(estudiante, titulo, mensaje);

            UserEntity padre = estudiante.getPadre();
            if (padre != null && padre.getId() != null && !"ARCHIVADO".equalsIgnoreCase(padre.getRol())) {
                String dedupe = padre.getId() + ":" + estudiante.getId();
                if (padresNotificados.add(dedupe)) {
                    crearNotificacion(
                            padre,
                            "Nueva tarea asignada a " + estudiante.getNombres() + ": " + cursoNombre,
                            "El docente publicó la tarea \"" + tarea.getTitulo() + "\"" + vencimiento + "."
                    );
                }
            }
        }
    }

    /**
     * Notifica al estudiante y a su padre vinculado cuando el docente programa un examen o evaluación.
     */
    public void notificarNuevaEvaluacion(Evaluacion evaluacion, List<UserEntity> estudiantes) {
        if (evaluacion == null || estudiantes == null || estudiantes.isEmpty()) return;
        String cursoNombre = (evaluacion.getCurso() != null && evaluacion.getCurso().getNombre() != null)
                ? evaluacion.getCurso().getNombre()
                : "tu curso";
        String tipo = evaluacion.getTipo() != null ? evaluacion.getTipo() : "EVALUACIÓN";
        String fechaTxt = evaluacion.getFecha() != null ? " para el " + evaluacion.getFecha() : "";
        String bimestreTxt = evaluacion.getBimestre() != null ? " (Bimestre " + evaluacion.getBimestre() + ")" : "";
        Set<String> padresNotificados = new HashSet<>();

        for (UserEntity estudiante : estudiantes) {
            if (estudiante == null || !"ESTUDIANTE".equalsIgnoreCase(estudiante.getRol())) continue;
            crearNotificacion(
                    estudiante,
                    "Evaluación programada (" + tipo + "): " + cursoNombre,
                    "Se programó \"" + evaluacion.getTitulo() + "\"" + fechaTxt + bimestreTxt + "."
            );
            UserEntity padre = estudiante.getPadre();
            if (padre != null && padre.getId() != null && !"ARCHIVADO".equalsIgnoreCase(padre.getRol())) {
                String dedupe = padre.getId() + ":" + estudiante.getId();
                if (padresNotificados.add(dedupe)) {
                    crearNotificacion(
                            padre,
                            "Evaluación programada (" + estudiante.getNombres() + "): " + cursoNombre,
                            estudiante.getNombres() + " tiene " + tipo.toLowerCase() + " \"" + evaluacion.getTitulo() + "\"" + fechaTxt + bimestreTxt + "."
                    );
                }
            }
        }
    }

    public void notificarNuevoMaterialAEstudiantes(MaterialCurso material, List<UserEntity> estudiantes) {
        if (material == null || estudiantes == null || estudiantes.isEmpty()) return;
        String cursoNombre = (material.getCurso() != null && material.getCurso().getNombre() != null)
                ? material.getCurso().getNombre()
                : "tu curso";
        String titulo = "Nuevo material: " + cursoNombre;
        String mensaje = "Se publicó el material \"" + material.getTitulo() + "\" en el aula virtual.";

        for (UserEntity estudiante : estudiantes) {
            if (estudiante != null && "ESTUDIANTE".equalsIgnoreCase(estudiante.getRol())) {
                crearNotificacion(estudiante, titulo, mensaje);
            }
        }
    }

    public void notificarNuevaCalificacionAEstudiante(Calificacion calificacion) {
        if (calificacion == null || calificacion.getEstudiante() == null) return;
        String cursoNombre = (calificacion.getCurso() != null && calificacion.getCurso().getNombre() != null)
                ? calificacion.getCurso().getNombre()
                : "tu curso";
        String titulo = "Calificación registrada: " + cursoNombre;
        String mensaje = "Obtuviste " + calificacion.getNota() + " en \"" + calificacion.getActividad() + "\".";
        crearNotificacion(calificacion.getEstudiante(), titulo, mensaje);
    }
}

