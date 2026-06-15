package org.example.shidell.model.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "entregas")
public class Entrega {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "tarea_id")
    private Tarea tarea;

    @ManyToOne
    @JoinColumn(name = "estudiante_id")
    private UserEntity estudiante;

    private LocalDateTime fechaEntrega;
    private String archivoUrl;
    
    @Column(length = 1000)
    private String comentarioEstudiante;
    
    @Column(length = 1000)
    private String comentarioProfesor;
    
    private Double nota; // Nota específica para esta entrega
    
    private String estado; // "ENTREGADO", "CALIFICADO", "CORREGIR"

    public Entrega() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Tarea getTarea() { return tarea; }
    public void setTarea(Tarea tarea) { this.tarea = tarea; }
    public UserEntity getEstudiante() { return estudiante; }
    public void setEstudiante(UserEntity estudiante) { this.estudiante = estudiante; }
    public LocalDateTime getFechaEntrega() { return fechaEntrega; }
    public void setFechaEntrega(LocalDateTime fechaEntrega) { this.fechaEntrega = fechaEntrega; }
    public String getArchivoUrl() { return archivoUrl; }
    public void setArchivoUrl(String archivoUrl) { this.archivoUrl = archivoUrl; }
    public String getComentarioEstudiante() { return comentarioEstudiante; }
    public void setComentarioEstudiante(String comentarioEstudiante) { this.comentarioEstudiante = comentarioEstudiante; }
    public String getComentarioProfesor() { return comentarioProfesor; }
    public void setComentarioProfesor(String comentarioProfesor) { this.comentarioProfesor = comentarioProfesor; }
    public Double getNota() { return nota; }
    public void setNota(Double nota) { this.nota = nota; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}
