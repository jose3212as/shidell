package org.example.shidell.controller;

import org.example.shidell.config.AuthInterceptor;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.AdminService;
import org.example.shidell.service.AuthSessionService;
import org.example.shidell.service.SystemConfigService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {MainController.class, AdminController.class, FaviconController.class})
@Import(AuthInterceptor.class)
@DisplayName("Pruebas WebMvc - Configuración y Branding de Admin")
class AdminConfigControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthSessionService authSessionService;

    @MockBean
    private AdminService adminService;

    @MockBean
    private SystemConfigService systemConfigService;

    @Test
    @DisplayName("GET /api/config y /favicon.ico son públicos y devuelven datos válidos")
    void endpointsPublicos_devuelven200() throws Exception {
        when(systemConfigService.toPublicConfigMap()).thenReturn(Map.of(
                "tabTitle", "Colegio Demo",
                "iconUrl", "/uploads/branding/logo.png",
                "effectiveIconUrl", "/uploads/branding/logo.png"
        ));
        when(systemConfigService.resolveFavicon()).thenReturn(
                new SystemConfigService.FaviconPayload("<svg></svg>".getBytes(), MediaType.valueOf("image/svg+xml"))
        );

        mockMvc.perform(get("/api/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tabTitle").value("Colegio Demo"))
                .andExpect(jsonPath("$.iconUrl").value("/uploads/branding/logo.png"));

        mockMvc.perform(get("/favicon.ico"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("image/svg+xml"));
    }

    @Test
    @DisplayName("Rutas /api/admin/config rechazan usuarios no administradores")
    void adminConfig_rechazaNoAdmin() throws Exception {
        UserEntity padre = new UserEntity();
        padre.setId(50L);
        padre.setRol("PADRE");
        when(authSessionService.authenticate("padre-tok")).thenReturn(Optional.of(padre));

        mockMvc.perform(put("/api/admin/config")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tabTitle\":\"Hacker\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/admin/config")
                        .header("Authorization", "Bearer padre-tok")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tabTitle\":\"NoPermitido\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Admin autenticado puede editar tabTitle, subir ícono y restablecer ícono")
    void adminConfig_actualizaNombreEIcono() throws Exception {
        UserEntity admin = new UserEntity();
        admin.setId(1L);
        admin.setRol("ADMINISTRADOR");
        when(authSessionService.authenticate("admin-tok")).thenReturn(Optional.of(admin));
        when(systemConfigService.toPublicConfigMap()).thenReturn(Map.of(
                "tabTitle", "Instituto Alpha",
                "effectiveIconUrl", "/uploads/branding/test.png"
        ));

        mockMvc.perform(put("/api/admin/config")
                        .header("Authorization", "Bearer admin-tok")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tabTitle\":\"Instituto Alpha\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tabTitle").value("Instituto Alpha"));

        MockMultipartFile png = new MockMultipartFile("file", "icon.png", "image/png", new byte[] {1, 2, 3, 4});
        mockMvc.perform(multipart("/api/admin/config/icon")
                        .file(png)
                        .header("Authorization", "Bearer admin-tok"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effectiveIconUrl").value("/uploads/branding/test.png"));

        when(systemConfigService.toPublicConfigMap()).thenReturn(Map.of(
                "tabTitle", "Instituto Alpha",
                "effectiveIconUrl", "/favicon.ico"
        ));
        mockMvc.perform(delete("/api/admin/config/icon")
                        .header("Authorization", "Bearer admin-tok"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effectiveIconUrl").value("/favicon.ico"));
    }

    @Test
    @DisplayName("PUT /api/admin/config permite cambiar solo gradeScale sin exigir tabTitle")
    void adminActualizaSoloGradeScale() throws Exception {
        UserEntity admin = new UserEntity();
        admin.setId(1L);
        admin.setRol("ADMIN");
        when(authSessionService.authenticate("admin-tok")).thenReturn(Optional.of(admin));
        when(systemConfigService.toPublicConfigMap()).thenReturn(Map.of(
                "tabTitle", "Shidell",
                "gradeScale", "LITERAL",
                "effectiveIconUrl", "/favicon.ico"
        ));

        mockMvc.perform(put("/api/admin/config")
                        .header("Authorization", "Bearer admin-tok")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"gradeScale\":\"LITERAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gradeScale").value("LITERAL"))
                .andExpect(jsonPath("$.tabTitle").value("Shidell"));

        org.mockito.Mockito.verify(systemConfigService).updateGradeScale("LITERAL");
        org.mockito.Mockito.verify(systemConfigService, org.mockito.Mockito.never()).updateTabTitle(any());
    }
}
