package org.example.shidell.service;

import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.entity.Mensaje;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.repository.MensajeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDateTime;

@SpringBootTest
@ActiveProfiles("test")
public class ContactosTest {

    @Autowired
    private MensajeService mensajeService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MensajeRepository mensajeRepository;

    @Test
    public void testContactosRecientes() {
        UserEntity u1 = new UserEntity();
        u1.setNombres("Test 1");
        u1.setEmail("t1@test.com");
        u1.setPassword("123");
        userRepository.save(u1);

        UserEntity u2 = new UserEntity();
        u2.setNombres("Test 2");
        u2.setEmail("t2@test.com");
        u2.setPassword("123");
        userRepository.save(u2);

        Mensaje m = new Mensaje();
        m.setRemitente(u1);
        m.setDestinatario(u2);
        m.setContenido("Hola");
        m.setFechaEnvio(LocalDateTime.now());
        m.setLeido(false);
        mensajeRepository.save(m);

        mensajeService.obtenerContactosRecientes(u1.getId());
    }
}
