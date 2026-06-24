package org.example.shidell.model.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "cursos")
public class Curso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;
    
    @ManyToOne
    @JoinColumn(name = "docente_id")
    private UserEntity profesor;
    
    private String icono; // e.g., "ph-flask"
    private String color; // e.g., "green"
    private Integer progreso; // percentage 0-100
    
    // Target Group
    private String nivel;   // PRIMARIA o SECUNDARIA
    private String grado;   // 1, 2, 3, 4, 5
    private String seccion; // A, B, C...
    private String turno;   // MANANA o TARDE
    
    @Column(name = "hora_inicio")
    private String horaInicio; // e.g., "08:00"

    @Column(name = "hora_fin")
    private String horaFin;    // e.g., "09:30"

    @Column(name = "dia_semana")
    private Integer diaSemana; // 1=Lunes, 2=Martes... 5=Viernes

    public Curso() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public UserEntity getProfesor() { return profesor; }
    public void setProfesor(UserEntity profesor) { this.profesor = profesor; }
    public String getIcono() { return icono; }
    public void setIcono(String icono) { this.icono = icono; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Integer getProgreso() { return progreso; }
    public void setProgreso(Integer progreso) { this.progreso = progreso; }

    public String getNivel() { return nivel; }
    public void setNivel(String nivel) { this.nivel = nivel; }
    public String getGrado() { return grado; }
    public void setGrado(String grado) { this.grado = grado; }
    public String getSeccion() { return seccion; }
    public void setSeccion(String seccion) { this.seccion = seccion; }
    public String getTurno() { return turno; }
    public void setTurno(String turno) { this.turno = turno; }

    public String getHoraInicio() { return horaInicio; }
    public void setHoraInicio(String horaInicio) { this.horaInicio = horaInicio; }
    public String getHoraFin() { return horaFin; }
    public void setHoraFin(String horaFin) { this.horaFin = horaFin; }

    public Integer getDiaSemana() { return diaSemana; }
    public void setDiaSemana(Integer diaSemana) { this.diaSemana = diaSemana; }

    @Transient
    public java.time.LocalTime getHoraInicioLocalTime() {
        if (horaInicio == null || horaInicio.isBlank()) return null;
        try {
            return java.time.LocalTime.parse(horaInicio);
        } catch (Exception e) {
            return null;
        }
    }

    @Transient
    public java.time.LocalTime getHoraFinLocalTime() {
        if (horaFin == null || horaFin.isBlank()) return null;
        try {
            return java.time.LocalTime.parse(horaFin);
        } catch (Exception e) {
            return null;
        }
    }
}
