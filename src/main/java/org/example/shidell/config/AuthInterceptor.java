package org.example.shidell.config;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.service.AuthSessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Set;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Autowired
    private ObjectProvider<AuthSessionService> authSessionServiceProvider;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || path.startsWith("/api/auth/")) return true;

        AuthSessionService authSessionService = authSessionServiceProvider.getIfAvailable();
        if (authSessionService == null) return true;

        UserEntity user = authSessionService.authenticate(extractToken(request)).orElse(null);
        if (user == null) {
            if ("GET".equals(request.getMethod()) && !path.startsWith("/api/admin/")) {
                return true;
            }
            if ("GET".equals(request.getMethod()) && path.startsWith("/api/admin/padres/")) {
                return true;
            }
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED, "Sesión inválida o expirada");
        }

        request.setAttribute("authUser", user);
        if (!isAllowed(user, request.getMethod(), path)) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN, "No tienes permisos para esta acción");
        }
        return true;
    }

    private String extractToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        String headerToken = request.getHeader("X-Shidell-Token");
        if (headerToken != null && !headerToken.isBlank()) {
            return headerToken;
        }
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if ("SHIDELL_SESSION".equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private boolean isAllowed(UserEntity user, String method, String path) {
        String rol = user.getRol() == null ? "" : user.getRol().toUpperCase();
        if (isAdmin(rol)) return true;

        if (path.startsWith("/api/admin/padres/") && "GET".equals(method)) {
            return "PADRE".equals(rol);
        }

        if (path.startsWith("/api/admin/")) return false;

        if (path.startsWith("/api/docente/")) {
            return "DOCENTE".equals(rol);
        }

        if (path.startsWith("/api/entregas")) {
            if (path.endsWith("/calificar")) return "DOCENTE".equals(rol);
            return Set.of("GET", "POST").contains(method) && Set.of("ESTUDIANTE", "DOCENTE").contains(rol);
        }

        if (path.startsWith("/api/tareas")) {
            if (Set.of("POST", "PUT", "DELETE").contains(method)) return "DOCENTE".equals(rol);
            return Set.of("ESTUDIANTE", "DOCENTE", "PADRE").contains(rol);
        }

        if (path.startsWith("/api/calificaciones")) {
            if (Set.of("POST", "PUT", "DELETE").contains(method)) return "DOCENTE".equals(rol);
            return Set.of("ESTUDIANTE", "DOCENTE", "PADRE").contains(rol);
        }

        if (path.startsWith("/api/users")) {
            return Set.of("GET", "PUT").contains(method) && Set.of("ESTUDIANTE", "DOCENTE", "PADRE").contains(rol);
        }

        if (path.startsWith("/api/notificaciones") || path.startsWith("/api/mensajes")
                || path.startsWith("/api/progreso") || path.startsWith("/api/asistencia")
                || path.startsWith("/api/calendario")
                || path.startsWith("/api/cursos")) {
            return Set.of("ESTUDIANTE", "DOCENTE", "PADRE").contains(rol);
        }

        return true;
    }

    private boolean isAdmin(String rol) {
        return "ADMIN".equals(rol) || "ADMINISTRADOR".equals(rol);
    }

    private boolean reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"" + message + "\"}");
        return false;
    }
}
