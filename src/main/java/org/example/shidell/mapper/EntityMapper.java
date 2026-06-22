package org.example.shidell.mapper;

import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.*;
import org.example.shidell.util.TextUtils;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class EntityMapper {

    public UserDTO toDTO(UserEntity entity) {
        if (entity == null) return null;
        UserDTO dto = new UserDTO();
        dto.setId(entity.getId());
        dto.setNombres(TextUtils.limpiarTexto(entity.getNombres()));
        dto.setApellidos(TextUtils.limpiarTexto(entity.getApellidos()));
        dto.setEmail(entity.getEmail());
        dto.setRol(entity.getRol());
        dto.setFotoPerfil(entity.getFotoPerfil());
        dto.setCodigoPlaza(entity.getCodigoPlaza());
        dto.setNivel(entity.getNivel());
        dto.setGrado(entity.getGrado());
        dto.setSeccion(entity.getSeccion());
        dto.setTurno(entity.getTurno());
        dto.setUltimaConexion(entity.getUltimaConexion());
        if (entity.getPadre() != null) {
            dto.setPadreId(entity.getPadre().getId());
        }
        return dto;
    }

    public CursoDTO toDTO(Curso entity) {
        if (entity == null) return null;
        CursoDTO dto = new CursoDTO();
        dto.setId(entity.getId());
        dto.setNombre(TextUtils.limpiarTexto(entity.getNombre()));
        dto.setIcono(entity.getIcono());
        dto.setColor(entity.getColor());
        dto.setNivel(entity.getNivel());
        dto.setGrado(entity.getGrado());
        dto.setSeccion(entity.getSeccion());
        dto.setTurno(entity.getTurno());
        dto.setHoraInicio(entity.getHoraInicio());
        dto.setHoraFin(entity.getHoraFin());
        dto.setDiaSemana(entity.getDiaSemana());
        dto.setProfesor(toDTO(entity.getProfesor()));
        return dto;
    }

    public MensajeDTO toDTO(Mensaje entity) {
        if (entity == null) return null;
        MensajeDTO dto = new MensajeDTO();
        dto.setId(entity.getId());
        dto.setContenido(TextUtils.limpiarTexto(entity.getContenido()));
        dto.setFechaEnvio(entity.getFechaEnvio());
        dto.setLeido(entity.getLeido());
        dto.setArchivoUrl(entity.getArchivoUrl());
        dto.setRemitente(toDTO(entity.getRemitente()));
        dto.setDestinatario(toDTO(entity.getDestinatario()));
        dto.setCurso(toDTO(entity.getCurso()));
        return dto;
    }

    public NotificacionDTO toDTO(Notificacion entity) {
        if (entity == null) return null;
        NotificacionDTO dto = new NotificacionDTO();
        dto.setId(entity.getId());
        dto.setTitulo(TextUtils.limpiarTexto(entity.getTitulo()));
        dto.setMensaje(TextUtils.limpiarTexto(entity.getMensaje()));
        dto.setFecha(entity.getFecha());
        dto.setLeida(entity.getLeida());
        return dto;
    }

    public EventoDTO toDTO(Evento entity) {
        if (entity == null) return null;
        EventoDTO dto = new EventoDTO();
        dto.setId(entity.getId());
        dto.setTitulo(TextUtils.limpiarTexto(entity.getTitulo()));
        dto.setDescripcion(TextUtils.limpiarTexto(entity.getDescripcion()));
        dto.setTipo(entity.getTipo());
        dto.setColor(entity.getColor());
        dto.setFechaInicio(entity.getFechaInicio());
        dto.setFechaFin(entity.getFechaFin());
        return dto;
    }

    public AsistenciaDTO toDTO(Asistencia entity) {
        if (entity == null) return null;
        AsistenciaDTO dto = new AsistenciaDTO();
        dto.setId(entity.getId());
        dto.setFecha(entity.getFecha());
        dto.setEstado(entity.getEstado());
        dto.setAsistio(!"AUSENTE".equalsIgnoreCase(entity.getEstado()));
        dto.setDescripcion(entity.getEstado());
        dto.setCurso(toDTO(entity.getCurso()));
        return dto;
    }

    public CalificacionDTO toDTO(Calificacion entity) {
        if (entity == null) return null;
        CalificacionDTO dto = new CalificacionDTO();
        dto.setId(entity.getId());
        dto.setActividad(TextUtils.limpiarTexto(entity.getActividad()));
        dto.setNota(entity.getNota());
        dto.setNotaMaxima(entity.getNotaMaxima() == null ? 20.0 : entity.getNotaMaxima());
        
        double nota = entity.getNota() == null ? 0.0 : entity.getNota();
        double maxima = dto.getNotaMaxima();
        double nota20 = nota / maxima * 20.0;
        dto.setNota20(Math.round(nota20 * 10.0) / 10.0);
        
        dto.setFecha(entity.getFecha());
        dto.setEstado(nota20 >= 11 ? "Aprobado" : "Desaprobado");
        dto.setCurso(toDTO(entity.getCurso()));
        return dto;
    }

    public TareaDTO toDTO(Tarea entity) {
        if (entity == null) return null;
        TareaDTO dto = new TareaDTO();
        dto.setId(entity.getId());
        dto.setTitulo(TextUtils.limpiarTexto(entity.getTitulo()));
        dto.setDescripcion(TextUtils.limpiarTexto(entity.getDescripcion()));
        dto.setFechaInicio(entity.getFechaInicio());
        dto.setFechaVencimiento(entity.getFechaVencimiento());
        dto.setPrioridad(entity.getPrioridad());
        dto.setEstado(entity.getEstado());
        dto.setPdfUrl(entity.getPdfUrl());
        dto.setCurso(toDTO(entity.getCurso()));
        return dto;
    }

    public MaterialCursoDTO toDTO(MaterialCurso entity) {
        if (entity == null) return null;
        MaterialCursoDTO dto = new MaterialCursoDTO();
        dto.setId(entity.getId());
        dto.setTitulo(TextUtils.limpiarTexto(entity.getTitulo()));
        dto.setDescripcion(TextUtils.limpiarTexto(entity.getDescripcion()));
        dto.setArchivoUrl(entity.getArchivoUrl());
        dto.setArchivoNombre(TextUtils.limpiarTexto(entity.getArchivoNombre()));
        dto.setFechaPublicacion(entity.getFechaPublicacion());
        return dto;
    }

    public Map<String, Object> toDTO(ForoSemanaMensaje entity) {
        if (entity == null) return null;
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", entity.getId());
        dto.put("autorId", entity.getAutorId());
        dto.put("autorNombre", TextUtils.limpiarTexto(entity.getAutorNombre()));
        dto.put("contenido", TextUtils.limpiarTexto(entity.getContenido()));
        dto.put("fecha", entity.getFecha());
        return dto;
    }

    public EntregaDTO toDTO(Entrega entity) {
        if (entity == null) return null;
        EntregaDTO dto = new EntregaDTO();
        dto.setId(entity.getId());
        dto.setComentarioEstudiante(TextUtils.limpiarTexto(entity.getComentarioEstudiante()));
        dto.setArchivoUrl(entity.getArchivoUrl());
        dto.setFechaEntrega(entity.getFechaEntrega());
        dto.setComentarioProfesor(TextUtils.limpiarTexto(entity.getComentarioProfesor()));
        dto.setNota(entity.getNota());
        return dto;
    }
}
