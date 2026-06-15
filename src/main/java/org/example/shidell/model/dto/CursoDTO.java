package org.example.shidell.model.dto;

public class CursoDTO {
    private Long id;
    private String nombre;
    private String icono;
    private String color;
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
    public UserDTO getProfesor() { return profesor; }
    public void setProfesor(UserDTO profesor) { this.profesor = profesor; }
}
