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

    private String dni;
    private String telefono;

    private java.time.LocalDate fechaNacimiento;
    private String sexo;

    private String direccion;
    private String tipoSangre;
    private String estadoCivil;

    // Educación (Perú) - Campos Transitorios mapeados desde Matricula
    @Transient
    private String nivel;   // PRIMARIA o SECUNDARIA
    
    @Transient
    private String grado;   // 1, 2, 3, 4, 5
    
    @Transient
    private String seccion; // A, B, C...
    
    @Transient
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
