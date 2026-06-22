package org.example.shidell.service;

import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Service
public class AuthSessionService {

    private static final String SECRET = "shidell-local-session-secret-v1";
    private static final long SESSION_SECONDS = 60L * 60L * 8L;
    private static final String HASH_PREFIX = "{SHA256}";

    @Autowired
    private UserRepository userRepository;

    public String issueToken(UserEntity user) {
        long expiresAt = Instant.now().plusSeconds(SESSION_SECONDS).getEpochSecond();
        String payload = user.getId() + ":" + user.getRol() + ":" + expiresAt;
        String signature = sign(payload);
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString((payload + ":" + signature).getBytes(StandardCharsets.UTF_8));
    }

    public Optional<UserEntity> authenticate(String token) {
        if (token == null || token.isBlank()) return Optional.empty();

        try {
            String decoded = new String(Base64.getUrlDecoder().decode(token), StandardCharsets.UTF_8);
            String[] parts = decoded.split(":", 4);
            if (parts.length != 4) return Optional.empty();

            String payload = parts[0] + ":" + parts[1] + ":" + parts[2];
            if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8), parts[3].getBytes(StandardCharsets.UTF_8))) {
                return Optional.empty();
            }

            long expiresAt = Long.parseLong(parts[2]);
            if (expiresAt < Instant.now().getEpochSecond()) return Optional.empty();

            Long userId = Long.parseLong(parts[0]);
            return userRepository.findById(userId)
                    .filter(user -> parts[1].equals(user.getRol()));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }
    public boolean matchesPassword(String stored, String raw) {
        if (stored == null || raw == null) return false;
        if (stored.startsWith(HASH_PREFIX)) {
            return stored.equals(hashPassword(raw));
        }
        return stored.equals(raw);
    }
    public String hashPassword(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HASH_PREFIX + Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo cifrar la contraseña", e);
        }
    }
    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo firmar la sesión", e);
        }
    }
}
