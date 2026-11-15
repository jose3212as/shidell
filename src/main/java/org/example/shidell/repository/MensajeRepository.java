package org.example.shidell.repository;

import org.example.shidell.model.entity.Mensaje;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MensajeRepository extends JpaRepository<Mensaje, Long> {
    
    @Query("SELECT m FROM Mensaje m WHERE ((m.remitente = :u1 AND m.destinatario = :u2) OR (m.remitente = :u2 AND m.destinatario = :u1)) AND (:cursoId IS NULL OR m.curso.id = :cursoId) ORDER BY m.fechaEnvio ASC")
    List<Mensaje> findConversation(UserEntity u1, UserEntity u2, Long cursoId);
    
    List<Mensaje> findByDestinatarioAndLeidoFalse(UserEntity destinatario);
    
    long countByDestinatarioAndLeidoFalse(UserEntity destinatario);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("UPDATE Mensaje m SET m.leido = true WHERE m.destinatario = :destinatario AND m.remitente = :remitente AND (:cursoId IS NULL OR m.curso.id = :cursoId) AND m.leido = false")
    int marcarComoLeidosBatch(@org.springframework.data.repository.query.Param("destinatario") UserEntity destinatario, @org.springframework.data.repository.query.Param("remitente") UserEntity remitente, @org.springframework.data.repository.query.Param("cursoId") Long cursoId);
    
    @Query("SELECT m FROM Mensaje m WHERE (m.remitente = :u OR m.destinatario = :u) AND (:cursoId IS NULL OR m.curso.id = :cursoId) ORDER BY m.fechaEnvio DESC")
    List<Mensaje> findAllByUser(UserEntity u, Long cursoId);

    @Query("SELECT CASE WHEN m.remitente = :u THEN m.destinatario ELSE m.remitente END FROM Mensaje m WHERE (m.remitente = :u OR m.destinatario = :u) AND (:cursoId IS NULL OR m.curso.id = :cursoId) GROUP BY CASE WHEN m.remitente = :u THEN m.destinatario ELSE m.remitente END ORDER BY MAX(m.fechaEnvio) DESC")
    List<UserEntity> findDistinctContacts(UserEntity u, Long cursoId);
}
