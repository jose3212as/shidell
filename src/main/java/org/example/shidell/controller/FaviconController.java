package org.example.shidell.controller;

import org.example.shidell.service.SystemConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
public class FaviconController {

    @Autowired
    private SystemConfigService systemConfigService;

    @GetMapping("/favicon.ico")
    public ResponseEntity<byte[]> getFavicon() {
        SystemConfigService.FaviconPayload payload = systemConfigService.resolveFavicon();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .contentType(payload.mediaType())
                .body(payload.bytes());
    }
}
