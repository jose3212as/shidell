package org.example.shidell.repository;

import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByEmail(String email);
    List<UserEntity> findByRol(String rol);
    List<UserEntity> findByNivelAndGradoAndSeccion(String nivel, String grado, String seccion);
    List<UserEntity> findByPadreId(Long padreId);
}
