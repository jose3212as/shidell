package org.example.shidell.repository;

import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.Curso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TareaRepository extends JpaRepository<Tarea, Long> {
    List<Tarea> findByEstado(String estado);
    List<Tarea> findByCurso(Curso curso);
    List<Tarea> findByCursoNivelAndCursoGradoAndCursoSeccion(String nivel, String grado, String seccion);
    List<Tarea> findByCursoNivelAndCursoGradoAndCursoSeccionAndCursoTurno(String nivel, String grado, String seccion, String turno);

    default List<Tarea> findByGrupoAcademico(String nivel, String grado, String seccion, String turno) {
        if (turno == null || turno.isBlank()) {
            return findByCursoNivelAndCursoGradoAndCursoSeccion(nivel, grado, seccion);
        }
        return findByCursoNivelAndCursoGradoAndCursoSeccionAndCursoTurno(nivel, grado, seccion, turno);
    }
}
