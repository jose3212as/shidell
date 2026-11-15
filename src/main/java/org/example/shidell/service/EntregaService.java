package org.example.shidell.service;

import org.example.shidell.model.entity.Calificacion;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.entity.Evaluacion;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CalificacionRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.EntregaRepository;
import org.example.shidell.repository.EvaluacionRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.repository.TareaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.FileUploadUtil;
import org.example.shidell.util.GradeCalculationHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class EntregaService {

    @Autowired
    private EntregaRepository entregaRepository;

    @Autowired
    private TareaRepository tareaRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificacionService notificacionService;

    @Autowired(required = false)
    private CalificacionRepository calificacionRepository;

    @Autowired(required = false)
    private EvaluacionRepository evaluacionRepository;

    @Autowired(required = false)
    private CursoRepository cursoRepository;

    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;

    public Entrega subirEntrega(Long tareaId, Long estudianteId, String comentario, MultipartFile archivo) {
        return subirEntrega(tareaId, estudianteId, comentario, archivo, null);
    }

    public Entrega subirEntrega(Long tareaId, Long estudianteId, String comentario, MultipartFile archivo, UserEntity authUser) {
        if (archivo == null || archivo.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona un archivo para entregar la tarea.");
        }
        if (authUser != null) {
            AccessControlHelper.requireSelfOrAdmin(
                    authUser, estudianteId, "No puedes registrar entregas a nombre de otro estudiante.");
        }
        Tarea tarea = tareaRepository.findById(tareaId).orElseThrow();
        UserEntity estudiante = userRepository.findById(estudianteId).orElseThrow();

        if (tarea.getCurso() != null
                && (authUser != null || AcademicGroupHelper.resolve(estudiante, matriculaRepository).isComplete())
                && !AccessControlHelper.sameAcademicGroup(estudiante, tarea.getCurso(), matriculaRepository)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No perteneces al aula o grupo asignado para esta tarea.");
        }

        // Verificar si ya existe una entrega
        Entrega entrega = entregaRepository.findByTareaAndEstudiante(tarea, estudiante)
                .orElse(new Entrega());
        if ("CALIFICADO".equalsIgnoreCase(entrega.getEstado()) || entrega.getNota() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Esta entrega ya fue calificada y no puede modificarse.");
        }

        boolean fueraDePlazo = tarea.getFechaVencimiento() != null
                && LocalDate.now().isAfter(tarea.getFechaVencimiento());
        entrega.setTarea(tarea);
        entrega.setEstudiante(estudiante);
        entrega.setComentarioEstudiante(comentario);
        entrega.setFechaEntrega(LocalDateTime.now());
        entrega.setEstado(fueraDePlazo ? "ENTREGADO_TARDE" : "ENTREGADO");

        String archivoUrl = FileUploadUtil.saveRequiredFile(
                "entregas",
                archivo,
                List.of("pdf", "doc", "docx"),
                "entrega.pdf",
                "El archivo debe ser PDF, DOC o DOCX."
        );
        entrega.setArchivoUrl(archivoUrl);

        Entrega saved = entregaRepository.save(entrega);

        // Notificar al profesor y confirmar al padre
        if (notificacionService != null && tarea.getCurso() != null && tarea.getCurso().getProfesor() != null) {
            String estadoTexto = fueraDePlazo ? " ha entregado fuera de plazo la tarea: " : " ha entregado la tarea: ";
            notificacionService.crearNotificacion(
                    tarea.getCurso().getProfesor(),
                    "Nueva entrega recibida",
                    estudiante.getNombres() + estadoTexto + tarea.getTitulo()
            );
        }
        if (notificacionService != null) {
            notificacionService.notificarEntregaDeTareaAPadre(saved);
        }

        return saved;
    }

    public List<Entrega> obtenerEntregasPorTarea(Long tareaId) {
        return obtenerEntregasPorTarea(tareaId, null);
    }

    public List<Entrega> obtenerEntregasPorTarea(Long tareaId, UserEntity authUser) {
        Tarea tarea = tareaRepository.findById(tareaId).orElseThrow();
        if (authUser != null) {
            AccessControlHelper.requireCourseOwnerOrAdmin(authUser, tarea.getCurso());
        }
        return entregaRepository.findByTarea(tarea);
    }

    public List<Entrega> obtenerEntregasPorEstudiante(Long estudianteId) {
        return obtenerEntregasPorEstudiante(estudianteId, null);
    }

    public List<Entrega> obtenerEntregasPorEstudiante(Long estudianteId, UserEntity authUser) {
        UserEntity estudiante = userRepository.findById(estudianteId).orElseThrow();
        if (authUser != null) {
            AccessControlHelper.requireStudentAccess(
                    authUser,
                    estudiante,
                    cursoRepository,
                    matriculaRepository,
                    "No tienes permiso para ver las entregas de este estudiante."
            );
        }
        return entregaRepository.findByEstudiante(estudiante);
    }

    public Entrega calificarEntrega(Long entregaId, Double nota, String comentarioProfesor) {
        return calificarEntrega(entregaId, nota, comentarioProfesor, null);
    }

    public Entrega calificarEntrega(Long entregaId, Double nota, String comentarioProfesor, UserEntity authUser) {
        if (nota == null || Double.isNaN(nota) || Double.isInfinite(nota)
                || nota < GradeCalculationHelper.NOTA_MINIMA
                || nota > GradeCalculationHelper.NOTA_MAXIMA_VIGESIMAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nota debe estar entre 0 y 20.");
        }
        double notaNormalizada = GradeCalculationHelper.redondear2(nota);

        Entrega entrega = entregaRepository.findById(entregaId).orElseThrow();
        if (authUser != null && entrega.getTarea() != null) {
            AccessControlHelper.requireCourseOwnerOrAdmin(authUser, entrega.getTarea().getCurso());
        }

        entrega.setNota(notaNormalizada);
        entrega.setComentarioProfesor(comentarioProfesor);
        entrega.setEstado("CALIFICADO");
        Entrega saved = entregaRepository.save(entrega);

        Calificacion calificacionSincronizada = sincronizarCalificacionDesdeEntrega(saved, notaNormalizada);

        // Notificar al estudiante y alertar al padre si es baja nota
        if (notificacionService != null && saved.getEstudiante() != null && saved.getTarea() != null) {
            notificacionService.crearNotificacion(
                    saved.getEstudiante(),
                    "Tarea calificada",
                    "Tu entrega de '" + saved.getTarea().getTitulo() + "' ha sido calificada con " + notaNormalizada
            );
            if (calificacionSincronizada != null && calificacionSincronizada.getCurso() != null) {
                notificacionService.alertarPadrePorBajaNota(calificacionSincronizada);
                notificacionService.notificarCalificacionAPadre(calificacionSincronizada);
            }
        }

        return saved;
    }

    private Calificacion sincronizarCalificacionDesdeEntrega(Entrega entrega, double notaNormalizada) {
        if (calificacionRepository == null
                || entrega == null
                || entrega.getEstudiante() == null
                || entrega.getTarea() == null
                || entrega.getTarea().getCurso() == null) {
            return null;
        }
        Curso curso = entrega.getTarea().getCurso();
        UserEntity estudiante = entrega.getEstudiante();
        String titulo = entrega.getTarea().getTitulo();
        String actividad = (titulo != null && !titulo.isBlank())
                ? titulo.trim()
                : "Tarea #" + entrega.getTarea().getId();

        Evaluacion evaluacion = null;
        if (evaluacionRepository != null && curso.getId() != null) {
            evaluacion = evaluacionRepository
                    .findFirstByCursoIdAndTituloIgnoreCase(curso.getId(), actividad)
                    .orElse(null);
        }

        Calificacion cal = null;
        if (evaluacion != null && evaluacion.getId() != null && curso.getId() != null && estudiante.getId() != null) {
            cal = calificacionRepository
                    .findFirstByCursoIdAndEstudianteIdAndEvaluacionId(curso.getId(), estudiante.getId(), evaluacion.getId())
                    .orElse(null);
        }
        if (cal == null && curso.getId() != null && estudiante.getId() != null) {
            cal = calificacionRepository
                    .findFirstByCursoIdAndEstudianteIdAndActividadIgnoreCase(curso.getId(), estudiante.getId(), actividad)
                    .orElse(null);
        }
        if (cal == null) {
            cal = new Calificacion();
            cal.setCurso(curso);
            cal.setEstudiante(estudiante);
        }
        cal.setActividad(evaluacion != null && evaluacion.getTitulo() != null ? evaluacion.getTitulo() : actividad);
        if (evaluacion != null) {
            cal.setEvaluacion(evaluacion);
        }
        cal.setNota(notaNormalizada);
        cal.setNotaMaxima(GradeCalculationHelper.NOTA_MAXIMA_VIGESIMAL);
        cal.setFecha(LocalDate.now());
        return calificacionRepository.save(cal);
    }
}
