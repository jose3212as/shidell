package org.example.shidell.repository;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CursoRepository extends JpaRepository<Curso, Long> {
    List<Curso> findByProfesor(UserEntity profesor);
    Optional<Curso> findByNombreAndNivelAndGradoAndSeccionAndTurnoAndDiaSemanaAndHoraInicio(
            String nombre, String nivel, String grado, String seccion, String turno, Integer diaSemana, String horaInicio);
    List<Curso> findByNivelAndGradoAndSeccion(String nivel, String grado, String seccion);
    List<Curso> findByNivelAndGradoAndSeccionAndTurno(String nivel, String grado, String seccion, String turno);

    default List<Curso> findByGrupoAcademico(String nivel, String grado, String seccion, String turno) {
        if (turno == null || turno.isBlank()) {
            return findByNivelAndGradoAndSeccion(nivel, grado, seccion);
        }
        return findByNivelAndGradoAndSeccionAndTurno(nivel, grado, seccion, turno);
    }
}
