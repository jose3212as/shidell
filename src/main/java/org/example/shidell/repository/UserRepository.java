package org.example.shidell.repository;

import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByCodigoPlaza(String codigoPlaza);
    List<UserEntity> findByRol(String rol);
    List<UserEntity> findByPadreId(Long padreId);

    @Query("SELECT m.estudiante FROM Matricula m WHERE m.aula.nivel = :nivel AND m.aula.grado = :grado AND m.aula.seccion = :seccion")
    List<UserEntity> findByNivelAndGradoAndSeccion(@org.springframework.data.repository.query.Param("nivel") String nivel, @org.springframework.data.repository.query.Param("grado") String grado, @org.springframework.data.repository.query.Param("seccion") String seccion);

    @Query("SELECT m.estudiante FROM Matricula m WHERE m.aula.nivel = :nivel AND m.aula.grado = :grado AND m.aula.seccion = :seccion AND m.aula.turno = :turno")
    List<UserEntity> findByNivelAndGradoAndSeccionAndTurno(@org.springframework.data.repository.query.Param("nivel") String nivel, @org.springframework.data.repository.query.Param("grado") String grado, @org.springframework.data.repository.query.Param("seccion") String seccion, @org.springframework.data.repository.query.Param("turno") String turno);

    @Query("SELECT m.estudiante FROM Matricula m WHERE m.aula.nivel = :nivel AND m.aula.grado = :grado AND m.aula.seccion = :seccion AND (:turno IS NULL OR m.aula.turno = :turno)")
    List<UserEntity> findByGrupoAcademico(@org.springframework.data.repository.query.Param("nivel") String nivel, @org.springframework.data.repository.query.Param("grado") String grado, @org.springframework.data.repository.query.Param("seccion") String seccion, @org.springframework.data.repository.query.Param("turno") String turno);
}
