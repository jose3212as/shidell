package org.example.shidell.repository;

import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.Curso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface TareaRepository extends JpaRepository<Tarea, Long> {
    List<Tarea> findByEstado(String estado);
    List<Tarea> findByCurso(Curso curso);
    
    @Query("SELECT t FROM Tarea t WHERE t.curso.aula.nivel = :nivel AND t.curso.aula.grado = :grado AND t.curso.aula.seccion = :seccion")
    List<Tarea> findByCursoNivelAndCursoGradoAndCursoSeccion(@Param("nivel") String nivel, @Param("grado") String grado, @Param("seccion") String seccion);

    @Query("SELECT t FROM Tarea t WHERE t.curso.aula.nivel = :nivel AND t.curso.aula.grado = :grado AND t.curso.aula.seccion = :seccion AND t.curso.aula.turno = :turno")
    List<Tarea> findByCursoNivelAndCursoGradoAndCursoSeccionAndCursoTurno(@Param("nivel") String nivel, @Param("grado") String grado, @Param("seccion") String seccion, @Param("turno") String turno);

    @Query("SELECT t FROM Tarea t WHERE t.curso.aula.nivel = :nivel AND t.curso.aula.grado = :grado AND t.curso.aula.seccion = :seccion AND (:turno IS NULL OR t.curso.aula.turno = :turno)")
    List<Tarea> findByGrupoAcademico(@Param("nivel") String nivel, @Param("grado") String grado, @Param("seccion") String seccion, @Param("turno") String turno);
}
