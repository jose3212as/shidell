package org.example.shidell.util;

import org.springframework.web.multipart.MultipartFile;
import java.nio.file.*;
import java.util.UUID;

public class FileUploadUtil {

    private static final String UPLOAD_DIR = "uploads/";

    public static String saveFile(String subDir, MultipartFile file) {
        if (file == null || file.isEmpty()) return null;
        try {
            // Sanitize filename for Windows
            String originalName = file.getOriginalFilename();
            if (originalName == null) originalName = "upload.jpg";
            String cleanName = originalName.replaceAll("[^a-zA-Z0-9.\\-_]", "_");
            String fileName = UUID.randomUUID().toString() + "_" + cleanName;
            
            Path path = Paths.get(UPLOAD_DIR + subDir + "/" + fileName);
            Files.createDirectories(path.getParent());
            Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
            return "/" + UPLOAD_DIR + subDir + "/" + fileName;
        } catch (Exception e) {
            System.err.println("Error saving file: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
}
