package org.example.shidell.service;

import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.EntregaRepository;
import org.example.shidell.repository.TareaRepository;
import org.example.shidell.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

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

    public Entrega subirEntrega(Long tareaId, Long estudianteId, String comentario, MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona un archivo para entregar la tarea.");
        }
        Tarea tarea = tareaRepository.findById(tareaId).orElseThrow();
        UserEntity estudiante = userRepository.findById(estudianteId).orElseThrow();
        // Verificar si ya existe una entrega
        Entrega entrega = entregaRepository.findByTareaAndEstudiante(tarea, estudiante)
                .orElse(new Entrega());
        entrega.setTarea(tarea);
        entrega.setEstudiante(estudiante);
        entrega.setComentarioEstudiante(comentario);
        entrega.setFechaEntrega(LocalDateTime.now());
        entrega.setEstado("ENTREGADO");

        try {
            String original = StringUtils.cleanPath(archivo.getOriginalFilename() == null ? "entrega.pdf" : archivo.getOriginalFilename());
            String extension = original.contains(".") ? original.substring(original.lastIndexOf('.') + 1).toLowerCase() : "";
            if (!List.of("pdf", "doc", "docx").contains(extension)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo debe ser PDF, DOC o DOCX.");
            }
            String fileName = UUID.randomUUID() + "_" + original.replaceAll("[^a-zA-Z0-9._-]", "_");
            Path path = Paths.get("uploads", "entregas", fileName);
            Files.createDirectories(path.getParent());
            Files.copy(archivo.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
            entrega.setArchivoUrl("/uploads/entregas/" + fileName);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar el archivo de la entrega.");
        }

        Entrega saved = entregaRepository.save(entrega);
        
        // Notificar al profesor
        if (tarea.getCurso() != null && tarea.getCurso().getProfesor() != null) {
            notificacionService.crearNotificacion(
                tarea.getCurso().getProfesor(),
                "Nueva entrega recibida",
                estudiante.getNombres() + " ha entregado la tarea: " + tarea.getTitulo()
            );
        }
        
        return saved;
    }

    public List<Entrega> obtenerEntregasPorTarea(Long tareaId) {
        Tarea tarea = tareaRepository.findById(tareaId).orElseThrow();
        return entregaRepository.findByTarea(tarea);
    }

    public List<Entrega> obtenerEntregasPorEstudiante(Long estudianteId) {
        UserEntity estudiante = userRepository.findById(estudianteId).orElseThrow();
        return entregaRepository.findByEstudiante(estudiante);
    }

    public Entrega calificarEntrega(Long entregaId, Double nota, String comentarioProfesor) {
        Entrega entrega = entregaRepository.findById(entregaId).orElseThrow();
        entrega.setNota(nota);
        entrega.setComentarioProfesor(comentarioProfesor);
        entrega.setEstado("CALIFICADO");
        Entrega saved = entregaRepository.save(entrega);
        
        // Notificar al estudiante
        notificacionService.crearNotificacion(
            entrega.getEstudiante(),
            "Tarea calificada",
            "Tu entrega de '" + entrega.getTarea().getTitulo() + "' ha sido calificada con " + nota
        );
        
        return saved;
    }
}
