package org.example.shidell.repository;

import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByCodigoPlaza(String codigoPlaza);
    List<UserEntity> findByRol(String rol);
    List<UserEntity> findByNivelAndGradoAndSeccion(String nivel, String grado, String seccion);
    List<UserEntity> findByNivelAndGradoAndSeccionAndTurno(String nivel, String grado, String seccion, String turno);
    List<UserEntity> findByPadreId(Long padreId);

    default List<UserEntity> findByGrupoAcademico(String nivel, String grado, String seccion, String turno) {
        if (turno == null || turno.isBlank()) {
            return findByNivelAndGradoAndSeccion(nivel, grado, seccion);
        }
        return findByNivelAndGradoAndSeccionAndTurno(nivel, grado, seccion, turno);
    }
}
