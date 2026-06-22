package org.example.shidell.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.shidell.config.AppConfig;
import org.example.shidell.config.AuthInterceptor;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.service.AuthSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import({EntityMapper.class})
@DisplayName("Pruebas de Integración - AuthController")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private AuthSessionService authSessionService;

    @MockBean
    private AuthInterceptor authInterceptor;

    private UserEntity adminUser;

    @BeforeEach
    void setUp() throws Exception {
        // Permitir que pasen todas las peticiones del interceptor
        when(authInterceptor.preHandle(any(), any(), any())).thenReturn(true);

        adminUser = new UserEntity();
        adminUser.setId(1L);
        adminUser.setEmail("admin@shidell.com");
        adminUser.setPassword("{SHA256}hashedPassword");
        adminUser.setRol("ADMINISTRADOR");
        adminUser.setNombres("Carlos");
        adminUser.setApellidos("López");
    }

    // ── POST /api/auth/login ───────────────────────────────────────

    @Test
    @DisplayName("POST /api/auth/login con credenciales correctas retorna 200 con token")
    void login_credencialesCorrectas_retorna200ConToken() throws Exception {
        when(userRepository.findByEmail("admin@shidell.com")).thenReturn(Optional.of(adminUser));
        when(authSessionService.matchesPassword(eq("{SHA256}hashedPassword"), eq("password123")))
                .thenReturn(true);
        when(authSessionService.issueToken(adminUser)).thenReturn("token.valido.generado");

        Map<String, String> credentials = Map.of("email", "admin@shidell.com", "password", "password123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(credentials)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@shidell.com"))
                .andExpect(jsonPath("$.rol").value("ADMINISTRADOR"))
                .andExpect(jsonPath("$.sessionToken").value("token.valido.generado"));
    }

    @Test
    @DisplayName("POST /api/auth/login con contraseña incorrecta retorna 401")
    void login_passwordIncorrecta_retorna401() throws Exception {
        when(userRepository.findByEmail("admin@shidell.com")).thenReturn(Optional.of(adminUser));
        when(authSessionService.matchesPassword(any(), eq("wrongpassword"))).thenReturn(false);

        Map<String, String> credentials = Map.of("email", "admin@shidell.com", "password", "wrongpassword");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(credentials)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Credenciales incorrectas"));
    }

    @Test
    @DisplayName("POST /api/auth/login con email inexistente retorna 401")
    void login_emailNoExiste_retorna401() throws Exception {
        when(userRepository.findByEmail("noexiste@shidell.com")).thenReturn(Optional.empty());

        Map<String, String> credentials = Map.of("email", "noexiste@shidell.com", "password", "cualquier");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(credentials)))
                .andExpect(status().isUnauthorized());
    }

    // ── POST /api/auth/register ────────────────────────────────────

    @Test
    @DisplayName("POST /api/auth/register con email nuevo retorna 200")
    void register_emailNuevo_retorna200() throws Exception {
        UserEntity nuevoUser = new UserEntity();
        nuevoUser.setId(2L);
        nuevoUser.setEmail("nuevo@shidell.com");
        nuevoUser.setPassword("pass123");
        nuevoUser.setRol("ESTUDIANTE");
        nuevoUser.setNombres("Nuevo");
        nuevoUser.setApellidos("Usuario");

        when(userRepository.findByEmail("nuevo@shidell.com")).thenReturn(Optional.empty());
        when(authSessionService.hashPassword("pass123")).thenReturn("{SHA256}hashednew");
        when(userRepository.save(any(UserEntity.class))).thenReturn(nuevoUser);
        when(authSessionService.issueToken(nuevoUser)).thenReturn("nuevo.token");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(nuevoUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("nuevo@shidell.com"));
    }

    @Test
    @DisplayName("POST /api/auth/register con email duplicado retorna 400")
    void register_emailDuplicado_retorna400() throws Exception {
        when(userRepository.findByEmail("admin@shidell.com")).thenReturn(Optional.of(adminUser));

        UserEntity duplicado = new UserEntity();
        duplicado.setEmail("admin@shidell.com");
        duplicado.setPassword("pass123");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicado)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("El correo ya está registrado"));
    }

    @Test
    @DisplayName("POST /api/auth/register sin email retorna 400")
    void register_sinEmail_retorna400() throws Exception {
        UserEntity sinEmail = new UserEntity();
        sinEmail.setPassword("pass123");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sinEmail)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    // ── POST /api/auth/logout ──────────────────────────────────────

    @Test
    @DisplayName("POST /api/auth/logout retorna 200 con ok=true")
    void logout_retorna200() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true));
    }

    // ── GET /api/auth/me ───────────────────────────────────────────

    @Test
    @DisplayName("GET /api/auth/me con token válido retorna datos del usuario")
    void me_tokenValido_retornaUsuario() throws Exception {
        when(authSessionService.authenticate("token.valido")).thenReturn(Optional.of(adminUser));

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer token.valido"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@shidell.com"));
    }

    @Test
    @DisplayName("GET /api/auth/me sin token retorna 401")
    void me_sinToken_retorna401() throws Exception {
        when(authSessionService.authenticate(null)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }
}
