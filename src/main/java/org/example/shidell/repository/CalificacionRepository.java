package org.example.shidell.repository;

import org.example.shidell.model.entity.Calificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CalificacionRepository extends JpaRepository<Calificacion, Long> {
    List<Calificacion> findByEstudianteId(Long estudianteId);
    List<Calificacion> findByCursoId(Long cursoId);
    Optional<Calificacion> findFirstByCursoIdAndEstudianteIdAndEvaluacionId(Long cursoId, Long estudianteId, Long evaluacionId);
    Optional<Calificacion> findFirstByCursoIdAndEstudianteIdAndActividadIgnoreCase(Long cursoId, Long estudianteId, String actividad);
    List<Calificacion> findByEvaluacionId(Long evaluacionId);
    void deleteByEvaluacionId(Long evaluacionId);
}
