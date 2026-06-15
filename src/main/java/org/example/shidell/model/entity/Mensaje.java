package org.example.shidell.model.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "mensajes")
public class Mensaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String contenido;
    
    private LocalDateTime fechaEnvio;
    private Boolean leido = false;
    private String archivoUrl;
    
    @ManyToOne
    @JoinColumn(name = "remitente_id")
    private UserEntity remitente;

    @ManyToOne
    @JoinColumn(name = "destinatario_id")
    private UserEntity destinatario;

    @ManyToOne
    @JoinColumn(name = "curso_id")
    private Curso curso;

    public Mensaje() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }
    public LocalDateTime getFechaEnvio() { return fechaEnvio; }
    public void setFechaEnvio(LocalDateTime fechaEnvio) { this.fechaEnvio = fechaEnvio; }
    public Boolean getLeido() { return leido; }
    public void setLeido(Boolean leido) { this.leido = leido; }
    public String getArchivoUrl() { return archivoUrl; }
    public void setArchivoUrl(String archivoUrl) { this.archivoUrl = archivoUrl; }
    public UserEntity getRemitente() { return remitente; }
    public void setRemitente(UserEntity remitente) { this.remitente = remitente; }
    public UserEntity getDestinatario() { return destinatario; }
    public void setDestinatario(UserEntity destinatario) { this.destinatario = destinatario; }
    public Curso getCurso() { return curso; }
    public void setCurso(Curso curso) { this.curso = curso; }
}
