package org.example.shidell.service;

import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - AuthSessionService")
class AuthSessionServiceTest {

    @Mock
    private UserRepository userRepository;

    // Instanciación manual para compatibilidad con Java 25
    private AuthSessionService authSessionService;

    private UserEntity usuario;

    @BeforeEach
    void setUp() {
        authSessionService = new AuthSessionService();
        ReflectionTestUtils.setField(authSessionService, "userRepository", userRepository);

        usuario = new UserEntity();
        usuario.setId(1L);
        usuario.setEmail("admin@shidell.com");
        usuario.setRol("ADMINISTRADOR");
        usuario.setNombres("Carlos");
        usuario.setApellidos("López");
    }

    // ── hashPassword ───────────────────────────────────────────────

    @Test
    @DisplayName("hashPassword debe retornar hash con prefijo {SHA256}")
    void hashPassword_debeRetornarHashConPrefijo() {
        String hash = authSessionService.hashPassword("mi_password_123");

        assertThat(hash).startsWith("{SHA256}");
        assertThat(hash.length()).isGreaterThan(10);
    }

    @Test
    @DisplayName("hashPassword produce hashes iguales para la misma contraseña")
    void hashPassword_mismaEntradaProduceMismoHash() {
        String hash1 = authSessionService.hashPassword("abc123");
        String hash2 = authSessionService.hashPassword("abc123");

        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    @DisplayName("hashPassword produce hashes distintos para contraseñas diferentes")
    void hashPassword_diferentesEntradaProducenHashesDiferentes() {
        String hash1 = authSessionService.hashPassword("password1");
        String hash2 = authSessionService.hashPassword("password2");

        assertThat(hash1).isNotEqualTo(hash2);
    }

    // ── matchesPassword ────────────────────────────────────────────

    @Test
    @DisplayName("matchesPassword retorna true para contraseña con hash correcta")
    void matchesPassword_conHashCorrecto_retornaTrue() {
        String hash = authSessionService.hashPassword("secreto123");

        boolean resultado = authSessionService.matchesPassword(hash, "secreto123");

        assertThat(resultado).isTrue();
    }

    @Test
    @DisplayName("matchesPassword retorna false para contraseña con hash incorrecta")
    void matchesPassword_conHashIncorrecto_retornaFalse() {
        String hash = authSessionService.hashPassword("secreto123");

        boolean resultado = authSessionService.matchesPassword(hash, "contraseñaEquivocada");

        assertThat(resultado).isFalse();
    }

    @Test
    @DisplayName("matchesPassword retorna false si la contraseña almacenada es null")
    void matchesPassword_storedNull_retornaFalse() {
        assertThat(authSessionService.matchesPassword(null, "cualquiera")).isFalse();
    }

    @Test
    @DisplayName("matchesPassword retorna false si la contraseña raw es null")
    void matchesPassword_rawNull_retornaFalse() {
        String hash = authSessionService.hashPassword("abc");
        assertThat(authSessionService.matchesPassword(hash, null)).isFalse();
    }

    @Test
    @DisplayName("matchesPassword soporta contraseñas en texto plano (legado)")
    void matchesPassword_textoPLano_retornaTrue() {
        // Sin prefijo {SHA256} → comparación directa
        assertThat(authSessionService.matchesPassword("plaintext", "plaintext")).isTrue();
    }

    // ── issueToken + authenticate ──────────────────────────────────

    @Test
    @DisplayName("issueToken genera un token no nulo y no vacío")
    void issueToken_generaTokenValido() {
        String token = authSessionService.issueToken(usuario);

        assertThat(token).isNotNull().isNotBlank();
    }

    @Test
    @DisplayName("authenticate recupera el usuario con un token válido")
    void authenticate_tokenValido_retornaUsuario() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(usuario));

        String token = authSessionService.issueToken(usuario);
        Optional<UserEntity> resultado = authSessionService.authenticate(token);

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getEmail()).isEqualTo("admin@shidell.com");
        verify(userRepository, times(1)).findById(1L);
    }

    @Test
    @DisplayName("authenticate retorna vacío para token null")
    void authenticate_tokenNull_retornaVacio() {
        Optional<UserEntity> resultado = authSessionService.authenticate(null);

        assertThat(resultado).isEmpty();
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("authenticate retorna vacío para token vacío")
    void authenticate_tokenVacio_retornaVacio() {
        Optional<UserEntity> resultado = authSessionService.authenticate("   ");

        assertThat(resultado).isEmpty();
    }

    @Test
    @DisplayName("authenticate retorna vacío para token manipulado/inválido")
    void authenticate_tokenManipulado_retornaVacio() {
        Optional<UserEntity> resultado = authSessionService.authenticate("token.invalido.manipulado");

        assertThat(resultado).isEmpty();
    }

    @Test
    @DisplayName("authenticate retorna vacío si el rol del token no coincide con el usuario en BD")
    void authenticate_rolDistinto_retornaVacio() {
        // Usuario cambió de rol en BD después de emitir el token
        UserEntity usuarioModificado = new UserEntity();
        usuarioModificado.setId(1L);
        usuarioModificado.setEmail("admin@shidell.com");
        usuarioModificado.setRol("ESTUDIANTE"); // rol diferente al token
        when(userRepository.findById(1L)).thenReturn(Optional.of(usuarioModificado));

        String token = authSessionService.issueToken(usuario); // token con rol ADMINISTRADOR
        Optional<UserEntity> resultado = authSessionService.authenticate(token);

        assertThat(resultado).isEmpty();
    }
}
