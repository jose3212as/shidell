package org.example.shidell.model.dto;

public class CursoDTO {
    private Long id;
    private String nombre;
    private String icono;
    private String color;
    private String nivel;
    private String grado;
    private String seccion;
    private String turno;
    private String horaInicio;
    private String horaFin;
    private Integer diaSemana;
    private UserDTO profesor;

    public CursoDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getIcono() { return icono; }
    public void setIcono(String icono) { this.icono = icono; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
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
    public UserDTO getProfesor() { return profesor; }
    public void setProfesor(UserDTO profesor) { this.profesor = profesor; }
}
