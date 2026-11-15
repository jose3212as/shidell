package org.example.shidell.model.dto;

import java.time.LocalDate;

public class EvaluacionDTO {
    private Long id;
    private String titulo;
    private String tipo;
    private Integer bimestre;
    private Double peso;
    private Double notaMaxima;
    private LocalDate fecha;
    private Long cursoId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }

    public Integer getBimestre() { return bimestre; }
    public void setBimestre(Integer bimestre) { this.bimestre = bimestre; }

    public Double getPeso() { return peso; }
    public void setPeso(Double peso) { this.peso = peso; }

    public Double getNotaMaxima() { return notaMaxima; }
    public void setNotaMaxima(Double notaMaxima) { this.notaMaxima = notaMaxima; }

    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }

    public Long getCursoId() { return cursoId; }
    public void setCursoId(Long cursoId) { this.cursoId = cursoId; }
}
