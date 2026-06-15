package org.example.shidell.repository;

import org.example.shidell.model.entity.Evento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.example.shidell.model.entity.UserEntity;
import java.util.List;

@Repository
public interface EventoRepository extends JpaRepository<Evento, Long> {
    List<Evento> findByUsuario(UserEntity usuario);
    List<Evento> findByUsuarioAndTipo(UserEntity usuario, String tipo);
}
