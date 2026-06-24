package org.example.shidell.model.dto;

import java.time.LocalDateTime;

public class EntregaDTO {
    private Long id;
    private String comentarioEstudiante;
    private String archivoUrl;
    private LocalDateTime fechaEntrega;
    private String comentarioProfesor;
    private Double nota;
    private TareaDTO tarea;
    private UserDTO estudiante;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getComentarioEstudiante() { return comentarioEstudiante; }
    public void setComentarioEstudiante(String comentarioEstudiante) { this.comentarioEstudiante = comentarioEstudiante; }
    public String getArchivoUrl() { return archivoUrl; }
    public void setArchivoUrl(String archivoUrl) { this.archivoUrl = archivoUrl; }
    public LocalDateTime getFechaEntrega() { return fechaEntrega; }
    public void setFechaEntrega(LocalDateTime fechaEntrega) { this.fechaEntrega = fechaEntrega; }
    public String getComentarioProfesor() { return comentarioProfesor; }
    public void setComentarioProfesor(String comentarioProfesor) { this.comentarioProfesor = comentarioProfesor; }
    public Double getNota() { return nota; }
    public void setNota(Double nota) { this.nota = nota; }
    public TareaDTO getTarea() { return tarea; }
    public void setTarea(TareaDTO tarea) { this.tarea = tarea; }
    public UserDTO getEstudiante() { return estudiante; }
    public void setEstudiante(UserDTO estudiante) { this.estudiante = estudiante; }
}
