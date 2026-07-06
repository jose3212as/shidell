package org.example.shidell.model.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "matriculas")
public class Matricula {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "estudiante_id", nullable = false)
    private UserEntity estudiante;

    @ManyToOne
    @JoinColumn(name = "aula_id", nullable = false)
    private Aula aula;

    private Integer anioEscolar;
    private LocalDate fechaMatricula;
    private String estado; // ACTIVO, RETIRADO, TRASLADADO

    public Matricula() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public UserEntity getEstudiante() { return estudiante; }
    public void setEstudiante(UserEntity estudiante) { this.estudiante = estudiante; }

    public Aula getAula() { return aula; }
    public void setAula(Aula aula) { this.aula = aula; }

    public Integer getAnioEscolar() { return anioEscolar; }
    public void setAnioEscolar(Integer anioEscolar) { this.anioEscolar = anioEscolar; }

    public LocalDate getFechaMatricula() { return fechaMatricula; }
    public void setFechaMatricula(LocalDate fechaMatricula) { this.fechaMatricula = fechaMatricula; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}
