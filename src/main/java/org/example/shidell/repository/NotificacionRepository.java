package org.example.shidell.repository;

import org.example.shidell.model.entity.Notificacion;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificacionRepository extends JpaRepository<Notificacion, Long> {

    List<Notificacion> findByUsuarioOrderByFechaDesc(UserEntity usuario);

    long countByUsuarioAndLeidaFalse(UserEntity usuario);

    boolean existsByUsuarioAndTituloAndMensaje(UserEntity usuario, String titulo, String mensaje);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("UPDATE Notificacion n SET n.leida = true WHERE n.usuario = :usuario AND n.leida = false")
    int marcarTodasComoLeidasBatch(@org.springframework.data.repository.query.Param("usuario") UserEntity usuario);
}
