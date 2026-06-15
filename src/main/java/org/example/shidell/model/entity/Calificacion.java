package org.example.shidell.model.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "calificaciones")
public class Calificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String actividad; // ej. "Examen Parcial"
    private Double nota;
    private Double notaMaxima;
    private LocalDate fecha;

    @ManyToOne
    @JoinColumn(name = "curso_id")
    private Curso curso;

    @ManyToOne
    @JoinColumn(name = "estudiante_id")
    private UserEntity estudiante;

    public Calificacion() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getActividad() { return actividad; }
    public void setActividad(String actividad) { this.actividad = actividad; }
    public Double getNota() { return nota; }
    public void setNota(Double nota) { this.nota = nota; }
    public Double getNotaMaxima() { return notaMaxima; }
    public void setNotaMaxima(Double notaMaxima) { this.notaMaxima = notaMaxima; }
    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public Curso getCurso() { return curso; }
    public void setCurso(Curso curso) { this.curso = curso; }
    public UserEntity getEstudiante() { return estudiante; }
    public void setEstudiante(UserEntity estudiante) { this.estudiante = estudiante; }
}
