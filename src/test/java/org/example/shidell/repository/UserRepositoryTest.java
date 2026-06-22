package org.example.shidell.repository;

import org.example.shidell.model.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@DisplayName("Pruebas de Integración - UserRepository (H2)")
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    private UserEntity estudiante;
    private UserEntity docente;
    private UserEntity padre;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        padre = new UserEntity();
        padre.setNombres("Roberto");
        padre.setApellidos("Flores");
        padre.setEmail("padre@shidell.com");
        padre.setPassword("{SHA256}hash");
        padre.setRol("PADRE");
        padre = userRepository.save(padre);

        estudiante = new UserEntity();
        estudiante.setNombres("Ana");
        estudiante.setApellidos("García");
        estudiante.setEmail("ana@shidell.com");
        estudiante.setPassword("{SHA256}hash");
        estudiante.setRol("ESTUDIANTE");
        estudiante.setNivel("SECUNDARIA");
        estudiante.setGrado("3");
        estudiante.setSeccion("A");
        estudiante.setPadre(padre);
        estudiante = userRepository.save(estudiante);

        docente = new UserEntity();
        docente.setNombres("Carlos");
        docente.setApellidos("Ríos");
        docente.setEmail("docente@shidell.com");
        docente.setPassword("{SHA256}hash");
        docente.setRol("DOCENTE");
        docente = userRepository.save(docente);
    }

    // ── findByEmail ────────────────────────────────────────────────

    @Test
    @DisplayName("findByEmail retorna el usuario con el email exacto")
    void findByEmail_emailExiste_retornaUsuario() {
        Optional<UserEntity> resultado = userRepository.findByEmail("ana@shidell.com");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getNombres()).isEqualTo("Ana");
        assertThat(resultado.get().getRol()).isEqualTo("ESTUDIANTE");
    }

    @Test
    @DisplayName("findByEmail retorna vacío si el email no existe")
    void findByEmail_emailNoExiste_retornaVacio() {
        Optional<UserEntity> resultado = userRepository.findByEmail("noexiste@shidell.com");

        assertThat(resultado).isEmpty();
    }

    // ── findByRol ──────────────────────────────────────────────────

    @Test
    @DisplayName("findByRol retorna solo los usuarios con ese rol")
    void findByRol_retornaUsuariosDelRol() {
        List<UserEntity> estudiantes = userRepository.findByRol("ESTUDIANTE");
        List<UserEntity> docentes = userRepository.findByRol("DOCENTE");

        assertThat(estudiantes).hasSize(1);
        assertThat(estudiantes.get(0).getEmail()).isEqualTo("ana@shidell.com");

        assertThat(docentes).hasSize(1);
        assertThat(docentes.get(0).getEmail()).isEqualTo("docente@shidell.com");
    }

    @Test
    @DisplayName("findByRol retorna lista vacía si no hay usuarios con ese rol")
    void findByRol_rolSinUsuarios_retornaVacio() {
        List<UserEntity> admins = userRepository.findByRol("ADMINISTRADOR");
        assertThat(admins).isEmpty();
    }

    // ── findByNivelAndGradoAndSeccion ──────────────────────────────

    @Test
    @DisplayName("findByNivelAndGradoAndSeccion retorna usuarios del mismo grupo")
    void findByNivelAndGradoAndSeccion_retornaGrupo() {
        // Agregar otro estudiante del mismo grupo
        UserEntity estudiante2 = new UserEntity();
        estudiante2.setNombres("Luis");
        estudiante2.setEmail("luis@shidell.com");
        estudiante2.setPassword("{SHA256}hash");
        estudiante2.setRol("ESTUDIANTE");
        estudiante2.setNivel("SECUNDARIA");
        estudiante2.setGrado("3");
        estudiante2.setSeccion("A");
        userRepository.save(estudiante2);

        List<UserEntity> grupo = userRepository.findByNivelAndGradoAndSeccion("SECUNDARIA", "3", "A");

        assertThat(grupo).hasSize(2);
        assertThat(grupo).extracting(UserEntity::getEmail)
                .containsExactlyInAnyOrder("ana@shidell.com", "luis@shidell.com");
    }

    @Test
    @DisplayName("findByNivelAndGradoAndSeccion retorna vacío si la sección no existe")
    void findByNivelAndGradoAndSeccion_seccionNoExiste_retornaVacio() {
        List<UserEntity> grupo = userRepository.findByNivelAndGradoAndSeccion("SECUNDARIA", "3", "Z");
        assertThat(grupo).isEmpty();
    }

    // ── findByPadreId ──────────────────────────────────────────────

    @Test
    @DisplayName("findByPadreId retorna los hijos del padre")
    void findByPadreId_retornaHijos() {
        List<UserEntity> hijos = userRepository.findByPadreId(padre.getId());

        assertThat(hijos).hasSize(1);
        assertThat(hijos.get(0).getEmail()).isEqualTo("ana@shidell.com");
    }

    @Test
    @DisplayName("findByPadreId retorna vacío si el padre no tiene hijos")
    void findByPadreId_sinHijos_retornaVacio() {
        List<UserEntity> hijos = userRepository.findByPadreId(docente.getId());
        assertThat(hijos).isEmpty();
    }

    // ── Operaciones básicas CRUD ───────────────────────────────────

    @Test
    @DisplayName("save persiste un nuevo usuario y le asigna ID")
    void save_persisteNuevoUsuario() {
        UserEntity nuevo = new UserEntity();
        nuevo.setNombres("Nuevo");
        nuevo.setEmail("nuevo@shidell.com");
        nuevo.setPassword("{SHA256}hash");
        nuevo.setRol("PADRE");

        UserEntity guardado = userRepository.save(nuevo);

        assertThat(guardado.getId()).isNotNull();
        assertThat(userRepository.findById(guardado.getId())).isPresent();
    }

    @Test
    @DisplayName("delete elimina correctamente el usuario")
    void delete_eliminaUsuario() {
        Long id = docente.getId();
        userRepository.deleteById(id);

        assertThat(userRepository.findById(id)).isEmpty();
    }
}
