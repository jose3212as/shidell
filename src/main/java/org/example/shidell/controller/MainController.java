package org.example.shidell.controller;

import org.example.shidell.service.SystemConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class MainController {

    @Autowired
    private SystemConfigService systemConfigService;

    @GetMapping("/status")
    public String getStatus() {
        return "{\"status\": \"ok\", \"message\": \"Backend is running!\"}";
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore().mustRevalidate())
                .body(systemConfigService.toPublicConfigMap());
    }
}
