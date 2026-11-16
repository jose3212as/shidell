package org.example.shidell.controller;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.example.shidell.exception.GlobalExceptionHandler;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Controlador unificado de errores HTTP para evitar pantallas técnicas por defecto
 * y servir diseños amigables según el portal o JSON limpio si la petición viene de fetch.
 */
@Controller
public class CustomErrorController implements ErrorController {

    @RequestMapping("/error")
    public ResponseEntity<Object> handleError(HttpServletRequest request) {
        Object statusAttr = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int statusCode = 500;
        if (statusAttr != null) {
            try {
                statusCode = Integer.parseInt(statusAttr.toString());
            } catch (NumberFormatException ignored) {
                statusCode = 500;
            }
        }
        String message = GlobalExceptionHandler.fallbackForCode(statusCode);
        return GlobalExceptionHandler.respondCode(request, statusCode, message);
    }
}
