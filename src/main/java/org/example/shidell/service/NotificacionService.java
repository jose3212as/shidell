package org.example.shidell.service;

import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.NotificacionDTO;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.repository.NotificacionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificacionService {

    @Autowired
    private NotificacionRepository notificacionRepository;

    @Autowired
    private EntityMapper mapper;

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

    // --- SISTEMA EXPERTO DE ALERTAS PARA PADRES ---

    public void alertarPadrePorFalta(Asistencia asistencia) {
        UserEntity estudiante = asistencia.getEstudiante();
        if (estudiante == null || estudiante.getPadre() == null) return;

        UserEntity padre = estudiante.getPadre();
        String estado = asistencia.getEstado();
        
        if ("AUSENTE".equals(estado) || "TARDE".equals(estado)) {
            String severidad = "AUSENTE".equals(estado) ? "[CRITICO]" : "[ALERTA]";
            String titulo = severidad + " Problema de Asistencia: " + estudiante.getNombres();
            String mensaje = "El estudiante " + estudiante.getNombres() + " fue marcado como " + estado + 
                             " en el curso de " + asistencia.getCurso().getNombre() + 
                             " el día " + asistencia.getFecha().toString() + ".";
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

    public void alertarPadrePorTareaNoEntregada(Tarea tarea, UserEntity estudiante) {
        if (estudiante == null || estudiante.getPadre() == null) return;

        UserEntity padre = estudiante.getPadre();
        String titulo = "[CRITICO] Tarea no entregada: " + estudiante.getNombres();
        String mensaje = "El estudiante " + estudiante.getNombres() + " no presentó la tarea '" + 
                         tarea.getTitulo() + "' del curso " + tarea.getCurso().getNombre() + 
                         " (Vencimiento: " + tarea.getFechaVencimiento().toString() + ").";
        crearNotificacion(padre, titulo, mensaje);
    }
}
