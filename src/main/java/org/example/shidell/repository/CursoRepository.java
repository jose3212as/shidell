package org.example.shidell.repository;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface CursoRepository extends JpaRepository<Curso, Long> {
    List<Curso> findByProfesor(UserEntity profesor);
    
    @Query("SELECT c FROM Curso c WHERE c.nombre = :nombre AND c.aula.nivel = :nivel AND c.aula.grado = :grado AND c.aula.seccion = :seccion AND c.aula.turno = :turno AND c.diaSemana = :dia AND c.horaInicio = :hora")
    Optional<Curso> findByUniqueSession(
            @Param("nombre") String nombre, @Param("nivel") String nivel, @Param("grado") String grado, 
            @Param("seccion") String seccion, @Param("turno") String turno, 
            @Param("dia") Integer diaSemana, @Param("hora") String horaInicio);

    @Query("SELECT c FROM Curso c WHERE c.aula.nivel = :nivel AND c.aula.grado = :grado AND c.aula.seccion = :seccion AND (:turno IS NULL OR c.aula.turno = :turno)")
    List<Curso> findByGrupoAcademico(@Param("nivel") String nivel, @Param("grado") String grado, @Param("seccion") String seccion, @Param("turno") String turno);
}
