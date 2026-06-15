package org.example.shidell.repository;

import org.example.shidell.model.entity.ForoSemanaMensaje;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ForoSemanaMensajeRepository extends JpaRepository<ForoSemanaMensaje, Long> {
    List<ForoSemanaMensaje> findByCursoIdAndSemanaOrderByFechaAsc(Long cursoId, Integer semana);
}
