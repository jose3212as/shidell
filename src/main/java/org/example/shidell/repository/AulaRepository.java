package org.example.shidell.repository;

import org.example.shidell.model.entity.Aula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AulaRepository extends JpaRepository<Aula, Long> {
    Optional<Aula> findByNivelAndGradoAndSeccionAndTurnoAndAnioEscolar(
            String nivel, String grado, String seccion, String turno, Integer anioEscolar);
}
