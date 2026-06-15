package org.example.shidell.repository;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.MaterialCurso;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialCursoRepository extends JpaRepository<MaterialCurso, Long> {
    List<MaterialCurso> findByCursoOrderByFechaPublicacionDesc(Curso curso);
    List<MaterialCurso> findByDocenteOrderByFechaPublicacionDesc(UserEntity docente);
}
