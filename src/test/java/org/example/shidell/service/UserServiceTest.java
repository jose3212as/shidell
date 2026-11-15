package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    @Test
    @DisplayName("changePassword valida la contraseña actual y cifra la nueva para un padre de familia")
    void changePassword_actualValida_actualizaPasswordCifrada() {
        AuthSessionService authSessionService = mock(AuthSessionService.class);
        ReflectionTestUtils.setField(userService, "authSessionService", authSessionService);

        UserEntity padre = new UserEntity();
        padre.setId(434L);
        padre.setRol("PADRE");
        padre.setPassword("{SHA256}hashActual");

        when(userRepository.findById(434L)).thenReturn(Optional.of(padre));
        when(authSessionService.matchesPassword("{SHA256}hashActual", "123456")).thenReturn(true);
        when(authSessionService.hashPassword("nuevaClave2026")).thenReturn("{SHA256}hashNueva");

        userService.changePassword(434L, "123456", "nuevaClave2026", padre);

        assertThat(padre.getPassword()).isEqualTo("{SHA256}hashNueva");
        verify(userRepository).save(padre);
    }

    @Test
    @DisplayName("changePassword rechaza contraseña actual incorrecta")
    void changePassword_actualIncorrecta_lanzaBadRequest() {
        AuthSessionService authSessionService = mock(AuthSessionService.class);
        ReflectionTestUtils.setField(userService, "authSessionService", authSessionService);

        UserEntity padre = new UserEntity();
        padre.setId(434L);
        padre.setRol("PADRE");
        padre.setPassword("{SHA256}hashActual");

        when(userRepository.findById(434L)).thenReturn(Optional.of(padre));
        when(authSessionService.matchesPassword("{SHA256}hashActual", "claveErronea")).thenReturn(false);

        assertThatThrownBy(() -> userService.changePassword(434L, "claveErronea", "nuevaClave2026", padre))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("incorrecta");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("changePassword impide cambiar la contraseña de otro usuario")
    void changePassword_otroUsuario_lanzaForbidden() {
        UserEntity padre = new UserEntity();
        padre.setId(434L);
        padre.setRol("PADRE");

        assertThatThrownBy(() -> userService.changePassword(1L, "123456", "nuevaClave2026", padre))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("getContacts permite al padre consultar docentes de su hijo sin exponer companeros")
    void getContacts_padreVinculado_retornaDocentesDelHijo() {
        CursoRepository cursoRepository = mock(CursoRepository.class);
        MatriculaRepository matriculaRepository = mock(MatriculaRepository.class);
        ReflectionTestUtils.setField(userService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(userService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(userService, "mapper", new EntityMapper());

        UserEntity padre = new UserEntity();
        padre.setId(434L);
        padre.setRol("PADRE");

        estudiante1.setPadre(padre);
        estudiante1.setNivel("SECUNDARIA");
        estudiante1.setGrado("1");
        estudiante1.setSeccion("A");
        estudiante1.setTurno("TARDE");

        UserEntity docente = new UserEntity();
        docente.setId(459L);
        docente.setNombres("Prof. Roberto");
        docente.setRol("DOCENTE");

        Curso curso = new Curso();
        curso.setId(909L);
        curso.setNombre("Matemática");
        curso.setProfesor(docente);

        when(userRepository.findById(1L)).thenReturn(Optional.of(estudiante1));
        when(matriculaRepository.findByEstudianteAndAnioEscolar(eq(estudiante1), anyInt())).thenReturn(Optional.empty());
        when(matriculaRepository.findByEstudiante(estudiante1)).thenReturn(List.of());
        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE")).thenReturn(List.of(curso));

        List<UserDTO> contactos = userService.getContacts(1L, padre);

        assertThat(contactos).hasSize(1);
        assertThat(contactos.get(0).getId()).isEqualTo(459L);
        verify(userRepository, never()).findByGrupoAcademico(any(), any(), any(), any());
    }

    @Test
    @DisplayName("getContacts rechaza a un padre no vinculado al estudiante")
    void getContacts_padreNoVinculado_lanzaForbidden() {
        UserEntity otroPadre = new UserEntity();
        otroPadre.setId(999L);
        otroPadre.setRol("PADRE");
        UserEntity padreReal = new UserEntity();
        padreReal.setId(434L);
        estudiante1.setPadre(padreReal);

        when(userRepository.findById(1L)).thenReturn(Optional.of(estudiante1));

        assertThatThrownBy(() -> userService.getContacts(1L, otroPadre))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("getContacts prioriza cursos activos y omite docentes de cursos ARCHIVADO si existen activos")
    void getContacts_cursosMixtos_excluyeArchivadosSiHayActivos() {
        CursoRepository cursoRepository = mock(CursoRepository.class);
        MatriculaRepository matriculaRepository = mock(MatriculaRepository.class);
        ReflectionTestUtils.setField(userService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(userService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(userService, "mapper", new EntityMapper());

        UserEntity padre = new UserEntity();
        padre.setId(434L);
        padre.setRol("PADRE");

        estudiante1.setPadre(padre);
        estudiante1.setNivel("SECUNDARIA");
        estudiante1.setGrado("1");
        estudiante1.setSeccion("A");
        estudiante1.setTurno("TARDE");

        UserEntity docenteArchivado = new UserEntity();
        docenteArchivado.setId(455L);
        docenteArchivado.setNombres("Prof. Sonia");
        docenteArchivado.setRol("DOCENTE");

        Curso cursoArchivado = new Curso();
        cursoArchivado.setId(1L);
        cursoArchivado.setNombre("Matemática");
        cursoArchivado.setTurno("ARCHIVADO");
        cursoArchivado.setProfesor(docenteArchivado);

        UserEntity docenteActivo = new UserEntity();
        docenteActivo.setId(459L);
        docenteActivo.setNombres("Prof. Roberto");
        docenteActivo.setRol("DOCENTE");

        Curso cursoActivo = new Curso();
        cursoActivo.setId(909L);
        cursoActivo.setNombre("Matemática");
        cursoActivo.setTurno("TARDE");
        cursoActivo.setProfesor(docenteActivo);

        when(userRepository.findById(1L)).thenReturn(Optional.of(estudiante1));
        when(matriculaRepository.findByEstudianteAndAnioEscolar(eq(estudiante1), anyInt())).thenReturn(Optional.empty());
        when(matriculaRepository.findByEstudiante(estudiante1)).thenReturn(List.of());
        when(cursoRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE"))
                .thenReturn(List.of(cursoArchivado, cursoActivo));

        List<UserDTO> contactos = userService.getContacts(1L, padre);

        assertThat(contactos).hasSize(1);
        assertThat(contactos.get(0).getId()).isEqualTo(459L);
        assertThat(AcademicGroupHelper.preferActiveCourses(List.of(cursoArchivado)))
                .containsExactly(cursoArchivado);
    }
}
