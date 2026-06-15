package org.example.shidell.repository;

import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EntregaRepository extends JpaRepository<Entrega, Long> {
    List<Entrega> findByEstudiante(UserEntity estudiante);
    List<Entrega> findByTarea(Tarea tarea);
    Optional<Entrega> findByTareaAndEstudiante(Tarea tarea, UserEntity estudiante);
}
