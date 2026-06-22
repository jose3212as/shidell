package org.example.shidell.model.entity;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@Entity
@Table(name = "usuarios")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombres;
    private String apellidos;

    // Educación (Perú)
    private String nivel;   // PRIMARIA o SECUNDARIA
    private String grado;   // 1, 2, 3, 4, 5
    private String seccion; // A, B, C...
    private String turno;   // MAÑANA o TARDE

    @Column(unique = true)
    private String email;

    private String password;

    @Column(name = "foto_perfil", columnDefinition = "TEXT")
    private String fotoPerfil;

    // Roles: ADMINISTRADOR, DOCENTE, ESTUDIANTE, PADRE
    private String rol;

    @Column(name = "codigo_plaza", unique = true)
    private String codigoPlaza;

    // Tutor (docente asignado al estudiante)
    @JsonIgnoreProperties({"tutor", "padre"})
    @ManyToOne
    @JoinColumn(name = "tutor_id")
    private UserEntity tutor;

    // Padre de familia vinculado al estudiante
    @JsonIgnoreProperties({"tutor", "padre"})
    @ManyToOne
    @JoinColumn(name = "padre_id")
    private UserEntity padre;

    private java.time.LocalDateTime ultimaConexion;

    @Transient
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String sessionToken;

    public UserEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombres() { return nombres; }
    public void setNombres(String nombres) { this.nombres = nombres; }

    public String getApellidos() { return apellidos; }
    public void setApellidos(String apellidos) { this.apellidos = apellidos; }

    public String getNivel() { return nivel; }
    public void setNivel(String nivel) { this.nivel = nivel; }

    public String getGrado() { return grado; }
    public void setGrado(String grado) { this.grado = grado; }

    public String getSeccion() { return seccion; }
    public void setSeccion(String seccion) { this.seccion = seccion; }

    public String getTurno() { return turno; }
    public void setTurno(String turno) { this.turno = turno; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getFotoPerfil() { return fotoPerfil; }
    public void setFotoPerfil(String fotoPerfil) { this.fotoPerfil = fotoPerfil; }

    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }

    public String getCodigoPlaza() { return codigoPlaza; }
    public void setCodigoPlaza(String codigoPlaza) { this.codigoPlaza = codigoPlaza; }

    public UserEntity getTutor() { return tutor; }
    public void setTutor(UserEntity tutor) { this.tutor = tutor; }

    public UserEntity getPadre() { return padre; }
    public void setPadre(UserEntity padre) { this.padre = padre; }

    public java.time.LocalDateTime getUltimaConexion() { return ultimaConexion; }
    public void setUltimaConexion(java.time.LocalDateTime ultimaConexion) { this.ultimaConexion = ultimaConexion; }
    public String getSessionToken() { return sessionToken; }
    public void setSessionToken(String sessionToken) { this.sessionToken = sessionToken; }
}
