package org.example.shidell.repository;

import org.example.shidell.model.entity.Asistencia;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AsistenciaRepository extends JpaRepository<Asistencia, Long> {
    List<Asistencia> findByCursoAndFecha(Curso curso, LocalDate fecha);
    List<Asistencia> findByEstudiante(UserEntity estudiante);
    Optional<Asistencia> findByCursoAndEstudianteAndFecha(Curso curso, UserEntity estudiante, LocalDate fecha);
}
