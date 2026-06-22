package org.example.shidell.service;

import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.*;
import org.example.shidell.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - MensajeService")
class MensajeServiceTest {

    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private CursoRepository cursoRepository;

    private final EntityMapper mapper = new EntityMapper();

    private MensajeService mensajeService;

    private UserEntity u1;
    private UserEntity u2;
    private Curso curso;
    private Mensaje msg;

    @BeforeEach
    void setUp() {
        mensajeService = new MensajeService();
        ReflectionTestUtils.setField(mensajeService, "mensajeRepository", mensajeRepository);
        ReflectionTestUtils.setField(mensajeService, "userRepository", userRepository);
        ReflectionTestUtils.setField(mensajeService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(mensajeService, "mapper", mapper);

        u1 = new UserEntity();
        u1.setId(1L);
        u1.setNombres("Juan");
        u1.setRol("ESTUDIANTE");

        u2 = new UserEntity();
        u2.setId(2L);
        u2.setNombres("Ana");
        u2.setRol("DOCENTE");

        curso = new Curso();
        curso.setId(10L);
        curso.setNombre("Matematicas");

        msg = new Mensaje();
        msg.setId(100L);
        msg.setRemitente(u1);
        msg.setDestinatario(u2);
        msg.setContenido("Hola profesor");
        msg.setFechaEnvio(LocalDateTime.now());
        msg.setLeido(false);
        msg.setCurso(curso);
    }

    @Test
    @DisplayName("contarMensajesNoLeidos retorna conteo correcto de no leídos")
    void contarMensajesNoLeidos_retornaConteo() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(u2));
        when(mensajeRepository.findByDestinatarioAndLeidoFalse(u2)).thenReturn(List.of(msg));

        Long noLeidos = mensajeService.contarMensajesNoLeidos(2L);

        assertThat(noLeidos).isEqualTo(1L);
        verify(mensajeRepository).findByDestinatarioAndLeidoFalse(u2);
    }

    @Test
    @DisplayName("enviarMensaje guarda y retorna DTO del mensaje enviado")
    void enviarMensaje_guardaYRetornaDTO() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(u1));
        when(userRepository.findById(2L)).thenReturn(Optional.of(u2));
        when(cursoRepository.findById(10L)).thenReturn(Optional.of(curso));
        when(mensajeRepository.save(any(Mensaje.class))).thenAnswer(inv -> {
            Mensaje m = inv.getArgument(0);
            m.setId(150L);
            return m;
        });

        MockMultipartFile file = new MockMultipartFile("archivo", "test.txt", "text/plain", "datos".getBytes());

        MensajeDTO result = mensajeService.enviarMensaje(1L, 2L, 10L, "Mensaje de texto", file);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(150L);
        assertThat(result.getContenido()).isEqualTo("Mensaje de texto");
        verify(mensajeRepository).save(any(Mensaje.class));
    }

    @Test
    @DisplayName("obtenerConversacion retorna mensajes y marca como leídos los del destinatario")
    void obtenerConversacion_retornaYMarcaLeidos() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(u1));
        when(userRepository.findById(2L)).thenReturn(Optional.of(u2));
        
        // Mensaje dirigido a u1 (que es el consultante) está sin leer
        Mensaje msgParaU1 = new Mensaje();
        msgParaU1.setId(200L);
        msgParaU1.setRemitente(u2);
        msgParaU1.setDestinatario(u1);
        msgParaU1.setContenido("Hola alumno");
        msgParaU1.setLeido(false);

        when(mensajeRepository.findConversation(u1, u2, 10L)).thenReturn(List.of(msgParaU1));

        List<MensajeDTO> resultado = mensajeService.obtenerConversacion(1L, 2L, 10L);

        assertThat(resultado).hasSize(1);
        verify(mensajeRepository).save(msgParaU1);
        assertThat(msgParaU1.getLeido()).isTrue();
    }
}
