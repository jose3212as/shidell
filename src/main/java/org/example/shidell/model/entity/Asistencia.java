package org.example.shidell.model.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "asistencias")
public class Asistencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate fecha;
    
    // ESTADO: PRESENTE, AUSENTE, TARDE, JUSTIFICADO
    private String estado;

    @ManyToOne
    @JoinColumn(name = "estudiante_id")
    private UserEntity estudiante;

    @ManyToOne
    @JoinColumn(name = "curso_id")
    private Curso curso;

    public Asistencia() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public UserEntity getEstudiante() { return estudiante; }
    public void setEstudiante(UserEntity estudiante) { this.estudiante = estudiante; }

    public Curso getCurso() { return curso; }
    public void setCurso(Curso curso) { this.curso = curso; }
}
