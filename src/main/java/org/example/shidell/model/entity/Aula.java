package org.example.shidell.model.entity;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

@Entity
@Table(name = "aulas")
public class Aula {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nivel;   // PRIMARIA o SECUNDARIA
    private String grado;   // 1, 2, 3...
    private String seccion; // A, B, C...
    private String turno;   // MAÑANA o TARDE
    private Integer anioEscolar; // ej: 2026

    @ManyToOne
    @JoinColumn(name = "tutor_id")
    private UserEntity tutor;

    @JsonIgnore
    @OneToMany(mappedBy = "aula", cascade = CascadeType.ALL)
    private List<Curso> cursos;

    public Aula() {}

    public Aula(String nivel, String grado, String seccion, String turno, Integer anioEscolar) {
        this.nivel = nivel;
        this.grado = grado;
        this.seccion = seccion;
        this.turno = turno;
        this.anioEscolar = anioEscolar;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNivel() { return nivel; }
    public void setNivel(String nivel) { this.nivel = nivel; }

    public String getGrado() { return grado; }
    public void setGrado(String grado) { this.grado = grado; }

    public String getSeccion() { return seccion; }
    public void setSeccion(String seccion) { this.seccion = seccion; }

    public String getTurno() { return turno; }
    public void setTurno(String turno) { this.turno = turno; }

    public Integer getAnioEscolar() { return anioEscolar; }
    public void setAnioEscolar(Integer anioEscolar) { this.anioEscolar = anioEscolar; }

    public UserEntity getTutor() { return tutor; }
    public void setTutor(UserEntity tutor) { this.tutor = tutor; }

    public List<Curso> getCursos() { return cursos; }
    public void setCursos(List<Curso> cursos) { this.cursos = cursos; }
}
