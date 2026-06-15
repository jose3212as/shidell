package org.example.shidell.model.dto;

import java.time.LocalDateTime;

public class MensajeDTO {
    private Long id;
    private String contenido;
    private LocalDateTime fechaEnvio;
    private Boolean leido;
    private String archivoUrl;
    private UserDTO remitente;
    private UserDTO destinatario;
    private CursoDTO curso;

    public MensajeDTO() {}

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
    public UserDTO getRemitente() { return remitente; }
    public void setRemitente(UserDTO remitente) { this.remitente = remitente; }
    public UserDTO getDestinatario() { return destinatario; }
    public void setDestinatario(UserDTO destinatario) { this.destinatario = destinatario; }
    public CursoDTO getCurso() { return curso; }
    public void setCurso(CursoDTO curso) { this.curso = curso; }
}
