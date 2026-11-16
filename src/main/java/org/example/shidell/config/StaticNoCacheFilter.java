package org.example.shidell.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
public class StaticNoCacheFilter extends OncePerRequestFilter {

    private static final Set<String> BLOCKED_CACHE_HEADERS = Set.of("cache-control", "pragma", "expires");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();

        // Agregar cabeceras de seguridad (Mitigación DAST - OWASP)
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("X-XSS-Protection", "1; mode=block");
        response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

        if (isRevalidateAsset(path)) {
            response.setHeader("Cache-Control", "no-cache, must-revalidate");

            HttpServletResponse wrapped = new HttpServletResponseWrapper(response) {
                @Override
                public void setHeader(String name, String value) {
                    if (name != null && BLOCKED_CACHE_HEADERS.contains(name.toLowerCase())) return;
                    super.setHeader(name, value);
                }

                @Override
                public void addHeader(String name, String value) {
                    if (name != null && BLOCKED_CACHE_HEADERS.contains(name.toLowerCase())) return;
                    super.addHeader(name, value);
                }

                @Override
                public void setDateHeader(String name, long date) {
                    if (name != null && BLOCKED_CACHE_HEADERS.contains(name.toLowerCase())) return;
                    super.setDateHeader(name, date);
                }

                @Override
                public void addDateHeader(String name, long date) {
                    if (name != null && BLOCKED_CACHE_HEADERS.contains(name.toLowerCase())) return;
                    super.addDateHeader(name, date);
                }
            };
            filterChain.doFilter(request, wrapped);
            return;
        }
        if (isLongCacheAsset(path)) {
            response.setHeader("Cache-Control", "public, max-age=604800");
        }
        filterChain.doFilter(request, response);
    }

    private boolean isRevalidateAsset(String path) {
        return path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css");
    }

    private boolean isLongCacheAsset(String path) {
        return path.startsWith("/assets/")
                || path.endsWith(".png")
                || path.endsWith(".jpg")
                || path.endsWith(".jpeg")
                || path.endsWith(".webp")
                || path.endsWith(".svg")
                || path.endsWith(".woff2");
    }
}
