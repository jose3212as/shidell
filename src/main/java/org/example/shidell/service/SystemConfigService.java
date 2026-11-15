package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.model.entity.SystemConfig;
import org.example.shidell.repository.SystemConfigRepository;
import org.example.shidell.util.FileUploadUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class SystemConfigService {

    public static final int MAX_TAB_TITLE_LENGTH = 80;
    public static final long MAX_ICON_SIZE_BYTES = 2L * 1024 * 1024;
    private static final String BRANDING_SUBDIR = "branding";
    private static final String BRANDING_URL_PREFIX = "/uploads/branding/";
    private static final List<String> ALLOWED_ICON_EXTENSIONS = List.of("png", "jpg", "jpeg", "webp", "svg", "ico", "gif");

    private static final byte[] DEFAULT_FAVICON_SVG = (
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\">" +
            "<defs><linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
            "<stop offset=\"0%\" stop-color=\"#6366F1\"/><stop offset=\"100%\" stop-color=\"#0D9488\"/>" +
            "</linearGradient></defs>" +
            "<rect width=\"64\" height=\"64\" rx=\"16\" fill=\"url(#g)\"/>" +
            "<path d=\"M32 16L12 26l20 10 16-8v11h4V26L32 16zm-12 16.4V41c0 4 5.4 7 12 7s12-3 12-7v-8.6l-12 6-12-6z\" fill=\"#ffffff\"/>" +
            "</svg>"
    ).getBytes(StandardCharsets.UTF_8);

    public record FaviconPayload(byte[] bytes, MediaType mediaType) {}

    @Autowired
    private SystemConfigRepository systemConfigRepository;

    public SystemConfig getConfig() {
        return systemConfigRepository.findById(SystemConfig.SINGLETON_ID)
                .map(cfg -> {
                    if (cfg.getTabTitle() == null || cfg.getTabTitle().isBlank()) {
                        cfg.setTabTitle(SystemConfig.DEFAULT_TAB_TITLE);
                    }
                    return cfg;
                })
                .orElseGet(() -> new SystemConfig(SystemConfig.SINGLETON_ID, SystemConfig.DEFAULT_TAB_TITLE, null, null));
    }

    public Map<String, Object> toPublicConfigMap() {
        SystemConfig cfg = getConfig();
        String tabTitle = (cfg.getTabTitle() == null || cfg.getTabTitle().isBlank())
                ? SystemConfig.DEFAULT_TAB_TITLE
                : cfg.getTabTitle();
        String iconUrl = (cfg.getIconUrl() != null && !cfg.getIconUrl().isBlank())
                ? cfg.getIconUrl()
                : null;

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("año", 2026);
        map.put("nombreInstitucion", tabTitle);
        map.put("tabTitle", tabTitle);
        map.put("defaultTabTitle", SystemConfig.DEFAULT_TAB_TITLE);
        map.put("iconUrl", iconUrl);
        map.put("effectiveIconUrl", iconUrl != null ? iconUrl : "/favicon.ico");
        map.put("updatedAt", cfg.getUpdatedAt());
        map.put("totalSemanas", 36);
        map.put("mensajeGlobal", "Bienvenido al ciclo académico 2026");
        return map;
    }

    public SystemConfig updateTabTitle(String rawTabTitle) {
        String normalized = sanitizeTabTitle(rawTabTitle);
        SystemConfig cfg = getOrCreateRow();
        cfg.setTabTitle(normalized);
        cfg.setUpdatedAt(LocalDateTime.now());
        return systemConfigRepository.save(cfg);
    }

    public SystemConfig updateIcon(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Debes seleccionar una imagen para el ícono.");
        }
        if (file.getSize() > MAX_ICON_SIZE_BYTES) {
            throw new BadRequestException("La imagen del ícono no debe superar 2 MB.");
        }

        String savedUrl = FileUploadUtil.saveRequiredFile(
                BRANDING_SUBDIR,
                file,
                ALLOWED_ICON_EXTENSIONS,
                "favicon.png",
                "Formato no permitido. Sube una imagen PNG, ICO, SVG, JPG, WEBP o GIF.");

        SystemConfig cfg = getOrCreateRow();
        String previousUrl = cfg.getIconUrl();
        cfg.setIconUrl(savedUrl);
        cfg.setUpdatedAt(LocalDateTime.now());
        SystemConfig saved = systemConfigRepository.save(cfg);

        if (previousUrl != null && !previousUrl.equals(savedUrl)) {
            deleteOldBrandingFile(previousUrl);
        }
        return saved;
    }

    public SystemConfig resetIcon() {
        SystemConfig cfg = getOrCreateRow();
        String previousUrl = cfg.getIconUrl();
        cfg.setIconUrl(null);
        cfg.setUpdatedAt(LocalDateTime.now());
        SystemConfig saved = systemConfigRepository.save(cfg);
        deleteOldBrandingFile(previousUrl);
        return saved;
    }

    public FaviconPayload resolveFavicon() {
        SystemConfig cfg = getConfig();
        Path filePath = resolveBrandingFilePath(cfg.getIconUrl());
        if (filePath != null && Files.isRegularFile(filePath)) {
            try {
                byte[] bytes = Files.readAllBytes(filePath);
                if (bytes.length > 0) {
                    return new FaviconPayload(bytes, mediaTypeForFile(filePath.getFileName().toString()));
                }
            } catch (IOException ignored) {
                // Fallback a ícono SVG predeterminado si el archivo en disco no está disponible
            }
        }
        return new FaviconPayload(DEFAULT_FAVICON_SVG, MediaType.valueOf("image/svg+xml"));
    }

    private SystemConfig getOrCreateRow() {
        return systemConfigRepository.findById(SystemConfig.SINGLETON_ID)
                .orElseGet(() -> {
                    SystemConfig created = new SystemConfig();
                    created.setId(SystemConfig.SINGLETON_ID);
                    created.setTabTitle(SystemConfig.DEFAULT_TAB_TITLE);
                    return created;
                });
    }

    private String sanitizeTabTitle(String rawTabTitle) {
        if (rawTabTitle == null) {
            throw new BadRequestException("El nombre de la pestaña no puede estar vacío.");
        }
        String collapsed = rawTabTitle.replaceAll("[\\r\\n\\t]+", " ")
                .replaceAll("\\s{2,}", " ")
                .replaceAll("[<>]", "")
                .trim();
        if (collapsed.isBlank()) {
            throw new BadRequestException("El nombre de la pestaña no puede estar vacío.");
        }
        if (collapsed.length() > MAX_TAB_TITLE_LENGTH) {
            throw new BadRequestException("El nombre de la pestaña no puede superar los " + MAX_TAB_TITLE_LENGTH + " caracteres.");
        }
        return collapsed;
    }

    private Path resolveBrandingFilePath(String iconUrl) {
        if (iconUrl == null || !iconUrl.startsWith(BRANDING_URL_PREFIX)) {
            return null;
        }
        String fileName = iconUrl.substring(BRANDING_URL_PREFIX.length());
        if (fileName.isBlank() || fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")) {
            return null;
        }
        Path brandingDir = Paths.get("uploads", BRANDING_SUBDIR).normalize().toAbsolutePath();
        Path target = brandingDir.resolve(fileName).normalize().toAbsolutePath();
        if (!target.startsWith(brandingDir)) {
            return null;
        }
        return target;
    }

    private void deleteOldBrandingFile(String previousUrl) {
        Path oldPath = resolveBrandingFilePath(previousUrl);
        if (oldPath != null) {
            try {
                Files.deleteIfExists(oldPath);
            } catch (IOException ignored) {
            }
        }
    }

    private MediaType mediaTypeForFile(String filename) {
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".svg")) return MediaType.valueOf("image/svg+xml");
        if (lower.endsWith(".ico")) return MediaType.valueOf("image/x-icon");
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
        if (lower.endsWith(".webp")) return MediaType.valueOf("image/webp");
        if (lower.endsWith(".gif")) return MediaType.IMAGE_GIF;
        return MediaType.IMAGE_PNG;
    }
}
