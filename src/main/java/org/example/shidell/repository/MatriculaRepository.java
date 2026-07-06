package org.example.shidell.repository;

import org.example.shidell.model.entity.Matricula;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.entity.Aula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MatriculaRepository extends JpaRepository<Matricula, Long> {
    List<Matricula> findByAula(Aula aula);
    List<Matricula> findByEstudiante(UserEntity estudiante);
    Optional<Matricula> findByEstudianteAndAnioEscolar(UserEntity estudiante, Integer anioEscolar);
    List<Matricula> findByAula_NivelAndAula_GradoAndAula_SeccionAndAnioEscolar(
            String nivel, String grado, String seccion, Integer anioEscolar);
    List<Matricula> findByAula_NivelAndAula_GradoAndAula_SeccionAndAula_TurnoAndAnioEscolar(
            String nivel, String grado, String seccion, String turno, Integer anioEscolar);
}
