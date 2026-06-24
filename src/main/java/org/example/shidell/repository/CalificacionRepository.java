package org.example.shidell.repository;

import org.example.shidell.model.entity.Calificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CalificacionRepository extends JpaRepository<Calificacion, Long> {
    List<Calificacion> findByEstudianteId(Long estudianteId);
    List<Calificacion> findByCursoId(Long cursoId);
}
