package org.example.shidell.model.dto;

public class AuthResponseDTO {
    private UserDTO user;
    private String token;

    public AuthResponseDTO(UserDTO user, String token) {
        this.user = user;
        this.token = token;
    }

    // Getters and Setters
    public UserDTO getUser() { return user; }
    public void setUser(UserDTO user) { this.user = user; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}
