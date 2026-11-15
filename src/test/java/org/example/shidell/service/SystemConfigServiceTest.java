package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.model.entity.SystemConfig;
import org.example.shidell.repository.SystemConfigRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - SystemConfigService")
class SystemConfigServiceTest {

    @Mock
    private SystemConfigRepository systemConfigRepository;

    @InjectMocks
    private SystemConfigService systemConfigService;

    private final List<Path> createdFiles = new ArrayList<>();

    @AfterEach
    void cleanupFiles() {
        for (Path p : createdFiles) {
            try {
                Files.deleteIfExists(p);
            } catch (Exception ignored) {
            }
        }
        createdFiles.clear();
    }

    @Test
    @DisplayName("Devuelve configuración por defecto cuando no existe fila en BD")
    void getConfig_devuelveValoresPorDefecto() {
        when(systemConfigRepository.findById(SystemConfig.SINGLETON_ID)).thenReturn(Optional.empty());

        Map<String, Object> config = systemConfigService.toPublicConfigMap();

        assertEquals("Shidell", config.get("tabTitle"));
        assertEquals("Shidell", config.get("nombreInstitucion"));
        assertNull(config.get("iconUrl"));
        assertEquals("/favicon.ico", config.get("effectiveIconUrl"));

        SystemConfigService.FaviconPayload payload = systemConfigService.resolveFavicon();
        assertTrue(payload.bytes().length > 0);
        assertEquals(MediaType.valueOf("image/svg+xml"), payload.mediaType());
    }

    @Test
    @DisplayName("Actualiza nombre de pestaña validando espacios, HTML y longitud")
    void updateTabTitle_normalizaYGuarda() {
        when(systemConfigRepository.findById(SystemConfig.SINGLETON_ID)).thenReturn(Optional.empty());
        when(systemConfigRepository.save(any(SystemConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        SystemConfig saved = systemConfigService.updateTabTitle("  Colegio   San Marcos <>  ");
        assertEquals("Colegio San Marcos", saved.getTabTitle());
        assertNotNull(saved.getUpdatedAt());

        assertThrows(BadRequestException.class, () -> systemConfigService.updateTabTitle("   "));
        assertThrows(BadRequestException.class, () -> systemConfigService.updateTabTitle("A".repeat(85)));
    }

    @Test
    @DisplayName("Sube imagen de ícono, resuelve bytes y la elimina al restablecer")
    void updateIcon_y_resetIcon_funcionanLimpiamente() {
        SystemConfig row = new SystemConfig(SystemConfig.SINGLETON_ID, "Shidell", null, null);
        when(systemConfigRepository.findById(SystemConfig.SINGLETON_ID)).thenReturn(Optional.of(row));
        when(systemConfigRepository.save(any(SystemConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        byte[] fakePng = new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        MockMultipartFile file = new MockMultipartFile("file", "logo-colegio.png", "image/png", fakePng);

        SystemConfig updated = systemConfigService.updateIcon(file);
        assertNotNull(updated.getIconUrl());
        assertTrue(updated.getIconUrl().startsWith("/uploads/branding/"));

        Path savedFile = Paths.get("uploads", "branding", updated.getIconUrl().substring("/uploads/branding/".length()));
        createdFiles.add(savedFile);
        assertTrue(Files.exists(savedFile));

        SystemConfigService.FaviconPayload payload = systemConfigService.resolveFavicon();
        assertArrayEquals(fakePng, payload.bytes());
        assertEquals(MediaType.IMAGE_PNG, payload.mediaType());

        SystemConfig reset = systemConfigService.resetIcon();
        assertNull(reset.getIconUrl());
        assertFalse(Files.exists(savedFile));
    }

    @Test
    @DisplayName("Rechaza extensiones no permitidas y archivos mayores a 2 MB")
    void updateIcon_rechazaArchivoInvalido() {
        MockMultipartFile exe = new MockMultipartFile("file", "bad.exe", "application/octet-stream", new byte[] {1, 2, 3});
        assertThrows(ResponseStatusException.class, () -> systemConfigService.updateIcon(exe));

        byte[] oversize = new byte[(2 * 1024 * 1024) + 10];
        MockMultipartFile bigPng = new MockMultipartFile("file", "big.png", "image/png", oversize);
        assertThrows(BadRequestException.class, () -> systemConfigService.updateIcon(bigPng));
    }
}
