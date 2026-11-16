package org.example.shidell.util;

import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Utilidad centralizada para almacenar archivos subidos por los usuarios.
 */
public final class FileUploadUtil {

    private static final String UPLOAD_DIR = "uploads";

    private FileUploadUtil() {}

    public static String saveFile(String subDir, MultipartFile file) {
        if (file == null || file.isEmpty()) return null;
        try {
            return writeSanitizedFile(subDir, file, "upload.jpg");
        } catch (Exception e) {
            System.err.println("Error saving file: " + e.getMessage());
            return null;
        }
    }

    public static String saveRequiredFile(
            String subDir,
            MultipartFile file,
            List<String> allowedExtensions,
            String fallbackName,
            String invalidExtensionMessage) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debes seleccionar un archivo válido.");
        }
        String original = StringUtils.cleanPath(file.getOriginalFilename() == null ? fallbackName : file.getOriginalFilename());
        String extension = original.contains(".")
                ? original.substring(original.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT)
                : "";
        if (allowedExtensions != null && !allowedExtensions.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, invalidExtensionMessage);
        }
        try {
            return writeSanitizedFile(subDir, file, fallbackName);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No pudimos guardar el archivo en este momento. Verifica el formato e intenta otra vez.", e);
        }
    }

    private static String writeSanitizedFile(String subDir, MultipartFile file, String fallbackName) throws IOException {
        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? fallbackName : file.getOriginalFilename());
        String cleanName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        String fileName = UUID.randomUUID() + "_" + cleanName;
        Path path = Paths.get(UPLOAD_DIR, subDir, fileName);
        Files.createDirectories(path.getParent());
        Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
        return "/" + UPLOAD_DIR + "/" + subDir + "/" + fileName;
    }
}
