package org.example.shidell.repository;

import org.example.shidell.model.entity.Aula;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AulaRepository extends JpaRepository<Aula, Long> {
    Optional<Aula> findByNivelAndGradoAndSeccionAndTurnoAndAnioEscolar(
            String nivel, String grado, String seccion, String turno, Integer anioEscolar);

    List<Aula> findByTutorAndAnioEscolar(UserEntity tutor, Integer anioEscolar);

    List<Aula> findByTutor(UserEntity tutor);
}
