package org.example.shidell.controller;

import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.service.AuthSessionService;
import org.example.shidell.mapper.EntityMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuthSessionService authSessionService;

    @Autowired
    private EntityMapper mapper;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");

        Optional<UserEntity> userOptional = userRepository.findByEmail(email);

        if (userOptional.isPresent()) {
            UserEntity user = userOptional.get();
            if (authSessionService.matchesPassword(user.getPassword(), password)) {
                String token = authSessionService.issueToken(user);
                UserDTO dto = mapper.toDTO(user);
                dto.setSessionToken(token);
                
                return ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE, crearCookieSesion(token).toString())
                        .body(dto);
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Credenciales incorrectas"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody UserEntity user) {
        if (user.getEmail() == null || user.getEmail().isBlank() || user.getPassword() == null || user.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email y contraseña son obligatorios"));
        }
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El correo ya está registrado"));
        }

        user.setPassword(authSessionService.hashPassword(user.getPassword()));
        UserEntity saved = userRepository.save(user);
        String token = authSessionService.issueToken(saved);
        UserDTO dto = mapper.toDTO(saved);
        dto.setSessionToken(token);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, crearCookieSesion(token).toString())
                .body(dto);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        return authSessionService.authenticate(extraerToken(request))
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(mapper.toDTO(user)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Sesión inválida")));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        ResponseCookie cookie = ResponseCookie.from("SHIDELL_SESSION", "")
                .httpOnly(true).secure(false).sameSite("Lax").path("/").maxAge(Duration.ZERO).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(Map.of("ok", true));
    }

    private ResponseCookie crearCookieSesion(String token) {
        return ResponseCookie.from("SHIDELL_SESSION", token)
                .httpOnly(true).secure(false).sameSite("Lax").path("/").maxAge(Duration.ofHours(8)).build();
    }

    private String extraerToken(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) return auth.substring(7);
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) if ("SHIDELL_SESSION".equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
