package org.example.shidell.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class MainController {

    @GetMapping("/status")
    public String getStatus() {
        return "{\"status\": \"ok\", \"message\": \"Backend is running!\"}";
    }

    @GetMapping("/config")
    public java.util.Map<String, Object> getConfig() {
        java.util.Map<String, Object> config = new java.util.HashMap<>();
        config.put("año", 2026);
        config.put("nombreInstitucion", "Shidell");
        config.put("totalSemanas", 36);
        config.put("mensajeGlobal", "Bienvenido al ciclo académico 2026");
        return config;
    }
}
