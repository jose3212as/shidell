package org.example.shidell.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final Map<String, byte[]> ERROR_HTML_CACHE = new ConcurrentHashMap<>();

    private static final String MSG_NOT_FOUND = "No pudimos encontrar lo que buscabas. Verifica e intenta otra vez.";
    private static final String MSG_BAD_REQUEST = "Revisa los datos ingresados e intenta nuevamente.";
    private static final String MSG_FORBIDDEN = "No cuentas con permiso para entrar o realizar esta acción.";
    private static final String MSG_CONFLICT = "Esta acción no se puede completar en este momento.";
    private static final String MSG_SERVER = "Algo no salió como esperábamos. Por favor, intenta de nuevo en unos momentos.";
    private static final String MSG_FILE_TOO_LARGE = "El archivo es demasiado pesado. Por favor, elige uno más liviano.";

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Object> handleNotFound(ResourceNotFoundException ex) {
        return respond(currentRequest(), HttpStatus.NOT_FOUND, sanitizeUserMessage(ex.getMessage(), MSG_NOT_FOUND));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Object> handleNoSuchElement(NoSuchElementException ex) {
        return respond(currentRequest(), HttpStatus.NOT_FOUND, sanitizeUserMessage(ex.getMessage(), MSG_NOT_FOUND));
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<Object> handleBadRequest(BadRequestException ex) {
        return respond(currentRequest(), HttpStatus.BAD_REQUEST, sanitizeUserMessage(ex.getMessage(), MSG_BAD_REQUEST));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Object> handleIllegalArgument(IllegalArgumentException ex) {
        return respond(currentRequest(), HttpStatus.BAD_REQUEST, sanitizeUserMessage(ex.getMessage(), MSG_BAD_REQUEST));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Object> handleIllegalState(IllegalStateException ex) {
        return respond(currentRequest(), HttpStatus.CONFLICT, sanitizeUserMessage(ex.getMessage(), MSG_CONFLICT));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Object> handleForbidden(ForbiddenException ex) {
        return respond(currentRequest(), HttpStatus.FORBIDDEN, sanitizeUserMessage(ex.getMessage(), MSG_FORBIDDEN));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Object> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return respond(currentRequest(), HttpStatus.PAYLOAD_TOO_LARGE, MSG_FILE_TOO_LARGE);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Object> handleResponseStatus(ResponseStatusException ex) {
        int code = ex.getStatusCode().value();
        String fallback = fallbackForCode(code);
        String msg = sanitizeUserMessage(ex.getReason(), fallback);
        return respondCode(currentRequest(), code, msg);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Object> handleNoResourceFound(NoResourceFoundException ex) {
        return respond(currentRequest(), HttpStatus.NOT_FOUND, MSG_NOT_FOUND);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Object> handleRuntimeException(RuntimeException ex) {
        HttpServletRequest req = currentRequest();
        log.error("Error de ejecución no controlado en {}: {}", safeUri(req), ex.getMessage(), ex);
        return respond(req, HttpStatus.INTERNAL_SERVER_ERROR, MSG_SERVER);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGeneralException(Exception ex) {
        HttpServletRequest req = currentRequest();
        log.error("Error inesperado en {}: {}", safeUri(req), ex.getMessage(), ex);
        return respond(req, HttpStatus.INTERNAL_SERVER_ERROR, MSG_SERVER);
    }

    private static HttpServletRequest currentRequest() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes servletAttrs) {
            return servletAttrs.getRequest();
        }
        return null;
    }

    public static ResponseEntity<Object> respond(HttpServletRequest request, HttpStatus status, String message) {
        return respondCode(request, status.value(), message);
    }

    public static ResponseEntity<Object> respondCode(HttpServletRequest request, int statusCode, String message) {
        if (wantsHtmlPage(request)) {
            byte[] html = loadHtmlPage(statusCode);
            if (html != null) {
                return ResponseEntity.status(statusCode)
                        .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                        .body(html);
            }
        }
        return ResponseEntity.status(statusCode)
                .contentType(MediaType.APPLICATION_JSON)
                .body(buildBody(statusCode, message));
    }

    public static String sanitizeUserMessage(String raw, String fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String trimmed = raw.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if ("null".equals(lower)
                || lower.contains("exception")
                || lower.contains("sql")
                || lower.contains("jdbc")
                || lower.contains("hibernate")
                || lower.contains("org.springframework")
                || lower.contains("org.example")
                || lower.contains("java.lang")
                || lower.contains("stacktrace")
                || lower.contains("unexpected token")
                || lower.contains("failed to convert")
                || lower.contains("no value present")) {
            return fallback;
        }
        return trimmed;
    }

    public static String fallbackForCode(int code) {
        return switch (code) {
            case 401 -> "Tu sesión venció. Inicia sesión nuevamente para continuar.";
            case 403 -> MSG_FORBIDDEN;
            case 404 -> MSG_NOT_FOUND;
            case 409 -> MSG_CONFLICT;
            case 413 -> MSG_FILE_TOO_LARGE;
            case 400 -> MSG_BAD_REQUEST;
            default -> MSG_SERVER;
        };
    }

    public static boolean wantsHtmlPage(HttpServletRequest request) {
        if (request == null) return false;
        String uri = request.getRequestURI();
        if (uri != null && uri.startsWith("/api/")) {
            return false;
        }
        String accept = request.getHeader("Accept");
        if (accept != null && accept.toLowerCase(Locale.ROOT).contains("text/html")) {
            return true;
        }
        return uri != null && (uri.endsWith(".html") || !uri.contains("."));
    }

    private static byte[] loadHtmlPage(int statusCode) {
        String name = switch (statusCode) {
            case 401, 403 -> "403.html";
            case 404 -> "404.html";
            case 500, 502, 503, 504 -> "500.html";
            default -> "error.html";
        };
        return ERROR_HTML_CACHE.computeIfAbsent(name, key -> {
            byte[] bytes = readStatic("static/error/" + key);
            return bytes != null ? bytes : readStatic("static/error/error.html");
        });
    }

    private static byte[] readStatic(String classpathLocation) {
        try {
            ClassPathResource res = new ClassPathResource(classpathLocation);
            if (res.exists()) {
                return res.getContentAsByteArray();
            }
        } catch (IOException ignored) {
        }
        return null;
    }

    private static String safeUri(HttpServletRequest request) {
        return request != null ? String.valueOf(request.getRequestURI()) : "-";
    }

    private static Map<String, Object> buildBody(int status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("error", message);
        body.put("message", message);
        body.put("status", status);
        return body;
    }
}
