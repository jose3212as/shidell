package org.example.shidell.repository;

import org.example.shidell.model.entity.Evaluacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EvaluacionRepository extends JpaRepository<Evaluacion, Long> {
    List<Evaluacion> findByCursoIdOrderByBimestreAscFechaAscIdAsc(Long cursoId);
    Optional<Evaluacion> findFirstByCursoIdAndTituloIgnoreCase(Long cursoId, String titulo);
}
