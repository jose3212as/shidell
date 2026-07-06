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
    
    @ManyToOne
    @JoinColumn(name = "aula_id")
    private Aula aula;
    
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

    public Aula getAula() { return aula; }
    public void setAula(Aula aula) { this.aula = aula; }

    public String getHoraInicio() { return horaInicio; }
    public void setHoraInicio(String horaInicio) { this.horaInicio = horaInicio; }
    public String getHoraFin() { return horaFin; }
    public void setHoraFin(String horaFin) { this.horaFin = horaFin; }

    public Integer getDiaSemana() { return diaSemana; }
    public void setDiaSemana(Integer diaSemana) { this.diaSemana = diaSemana; }

    @Transient private String tempNivel;
    @Transient private String tempGrado;
    @Transient private String tempSeccion;
    @Transient private String tempTurno;

    @Transient
    public String getNivel() { return aula != null ? aula.getNivel() : tempNivel; }
    public void setNivel(String nivel) { this.tempNivel = nivel; }

    @Transient
    public String getGrado() { return aula != null ? aula.getGrado() : tempGrado; }
    public void setGrado(String grado) { this.tempGrado = grado; }

    @Transient
    public String getSeccion() { return aula != null ? aula.getSeccion() : tempSeccion; }
    public void setSeccion(String seccion) { this.tempSeccion = seccion; }

    @Transient
    public String getTurno() { return aula != null ? aula.getTurno() : tempTurno; }
    public void setTurno(String turno) { this.tempTurno = turno; }

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
