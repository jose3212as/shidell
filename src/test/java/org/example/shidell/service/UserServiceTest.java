package org.example.shidell.service;

import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - UserService")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    // Instanciación manual para compatibilidad con Java 25
    private UserService userService;

    private UserEntity estudiante1;
    private UserEntity estudiante2;

    @BeforeEach
    void setUp() {
        userService = new UserService();
        ReflectionTestUtils.setField(userService, "userRepository", userRepository);

        estudiante1 = new UserEntity();
        estudiante1.setId(1L);
        estudiante1.setNombres("Ana");
        estudiante1.setApellidos("García");
        estudiante1.setEmail("ana@shidell.com");
        estudiante1.setRol("ESTUDIANTE");

        estudiante2 = new UserEntity();
        estudiante2.setId(2L);
        estudiante2.setNombres("Luis");
        estudiante2.setApellidos("Pérez");
        estudiante2.setEmail("luis@shidell.com");
        estudiante2.setRol("ESTUDIANTE");
    }

    @Test
    @DisplayName("getAllUsers debe retornar todos los usuarios de la base de datos")
    void getAllUsers_retornaTodosLosUsuarios() {
        when(userRepository.findAll()).thenReturn(List.of(estudiante1, estudiante2));

        List<UserEntity> resultado = userService.getAllUsers();

        assertThat(resultado).hasSize(2);
        assertThat(resultado).extracting(UserEntity::getEmail)
                .containsExactlyInAnyOrder("ana@shidell.com", "luis@shidell.com");
        verify(userRepository, times(1)).findAll();
    }

    @Test
    @DisplayName("getAllUsers retorna lista vacía cuando no hay usuarios")
    void getAllUsers_retornaListaVaciaSiNoHayUsuarios() {
        when(userRepository.findAll()).thenReturn(List.of());

        List<UserEntity> resultado = userService.getAllUsers();

        assertThat(resultado).isEmpty();
        verify(userRepository, times(1)).findAll();
    }

    @Test
    @DisplayName("getAllUsers delega correctamente al repositorio")
    void getAllUsers_delegaAlRepositorio() {
        when(userRepository.findAll()).thenReturn(List.of(estudiante1));

        userService.getAllUsers();

        verify(userRepository).findAll();
        verifyNoMoreInteractions(userRepository);
    }
}
