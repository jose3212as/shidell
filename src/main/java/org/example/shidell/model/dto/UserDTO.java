package org.example.shidell.model.dto;

import java.time.LocalDateTime;

public class UserDTO {
    private Long id;
    private String nombres;
    private String apellidos;
    private String email;
    private String dni;
    private String telefono;
    private java.time.LocalDate fechaNacimiento;
    private String sexo;
    private String direccion;
    private String tipoSangre;
    private String estadoCivil;
    private String rol;
    private String fotoPerfil;
    private String codigoPlaza;
    private String nivel;
    private String grado;
    private String seccion;
    private String turno;
    private LocalDateTime ultimaConexion;
    private String sessionToken;
    private Long padreId;

    public UserDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombres() { return nombres; }
    public void setNombres(String nombres) { this.nombres = nombres; }
    public String getApellidos() { return apellidos; }
    public void setApellidos(String apellidos) { this.apellidos = apellidos; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDni() { return dni; }
    public void setDni(String dni) { this.dni = dni; }
    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }
    public java.time.LocalDate getFechaNacimiento() { return fechaNacimiento; }
    public void setFechaNacimiento(java.time.LocalDate fechaNacimiento) { this.fechaNacimiento = fechaNacimiento; }
    public String getSexo() { return sexo; }
    public void setSexo(String sexo) { this.sexo = sexo; }

    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }

    public String getTipoSangre() { return tipoSangre; }
    public void setTipoSangre(String tipoSangre) { this.tipoSangre = tipoSangre; }

    public String getEstadoCivil() { return estadoCivil; }
    public void setEstadoCivil(String estadoCivil) { this.estadoCivil = estadoCivil; }
    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }
    public String getFotoPerfil() { return fotoPerfil; }
    public void setFotoPerfil(String fotoPerfil) { this.fotoPerfil = fotoPerfil; }
    public String getCodigoPlaza() { return codigoPlaza; }
    public void setCodigoPlaza(String codigoPlaza) { this.codigoPlaza = codigoPlaza; }
    public String getNivel() { return nivel; }
    public void setNivel(String nivel) { this.nivel = nivel; }
    public String getGrado() { return grado; }
    public void setGrado(String grado) { this.grado = grado; }
    public String getSeccion() { return seccion; }
    public void setSeccion(String seccion) { this.seccion = seccion; }
    public String getTurno() { return turno; }
    public void setTurno(String turno) { this.turno = turno; }
    public LocalDateTime getUltimaConexion() { return ultimaConexion; }
    public void setUltimaConexion(LocalDateTime ultimaConexion) { this.ultimaConexion = ultimaConexion; }
    public String getSessionToken() { return sessionToken; }
    public void setSessionToken(String sessionToken) { this.sessionToken = sessionToken; }
    public Long getPadreId() { return padreId; }
    public void setPadreId(Long padreId) { this.padreId = padreId; }
}
