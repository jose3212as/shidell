package org.example.shidell.repository;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CursoRepository extends JpaRepository<Curso, Long> {
    List<Curso> findByProfesor(UserEntity profesor);
    List<Curso> findByNivelAndGradoAndSeccion(String nivel, String grado, String seccion);
}
