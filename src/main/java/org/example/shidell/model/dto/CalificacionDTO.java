package org.example.shidell.model.dto;

import java.time.LocalDate;

public class CalificacionDTO {
    private Long id;
    private String actividad;
    private Double nota;
    private Double notaMaxima;
    private Double nota20;
    private LocalDate fecha;
    private String estado;
    private CursoDTO curso;
    private UserDTO estudiante;
    private Long evaluacionId;
    private String tipo;
    private Double peso;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getActividad() { return actividad; }
    public void setActividad(String actividad) { this.actividad = actividad; }
    public Double getNota() { return nota; }
    public void setNota(Double nota) { this.nota = nota; }
    public Double getNotaMaxima() { return notaMaxima; }
    public void setNotaMaxima(Double notaMaxima) { this.notaMaxima = notaMaxima; }
    public Double getNota20() { return nota20; }
    public void setNota20(Double nota20) { this.nota20 = nota20; }
    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public CursoDTO getCurso() { return curso; }
    public void setCurso(CursoDTO curso) { this.curso = curso; }
    public UserDTO getEstudiante() { return estudiante; }
    public void setEstudiante(UserDTO estudiante) { this.estudiante = estudiante; }
    public Long getEvaluacionId() { return evaluacionId; }
    public void setEvaluacionId(Long evaluacionId) { this.evaluacionId = evaluacionId; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public Double getPeso() { return peso; }
    public void setPeso(Double peso) { this.peso = peso; }
}
