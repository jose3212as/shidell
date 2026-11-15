package org.example.shidell.util;

import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.Aula;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.AulaRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.util.AcademicGroupHelper.AcademicGroup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - DocenteScopeHelper y mapeo de DOCENTE")
class DocenteScopeHelperTest {

    @Mock
    private AulaRepository aulaRepository;

    @Mock
    private CursoRepository cursoRepository;

    @Test
    @DisplayName("Docente de Primaria tutor de aula fija resuelve su aula exacta sin duplicar cursos")
    void docentePrimariaTutorDeAulaResuelveAulaExacta() {
        UserEntity docente = crearDocente(10L, "Maritza", "Poma");
        Aula primaria1A = crearAula("PRIMARIA", "1", "A", "MAÑANA");
        Curso matematica = crearCurso("Matemática", primaria1A, "");
        Curso comunicacion = crearCurso("Comunicación", primaria1A, null);

        when(aulaRepository.findByTutorAndAnioEscolar(docente, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL))
                .thenReturn(List.of(primaria1A));
        when(cursoRepository.findByProfesor(docente)).thenReturn(List.of(matematica, comunicacion));

        AcademicGroup scope = DocenteScopeHelper.resolve(docente, aulaRepository, cursoRepository);

        assertThat(scope.nivel()).isEqualTo("PRIMARIA");
        assertThat(scope.grado()).isEqualTo("1");
        assertThat(scope.seccion()).isEqualTo("A");
        assertThat(scope.turno()).isEqualTo("MAÑANA");
        assertThat(scope.aula()).isSameAs(primaria1A);
    }

    @Test
    @DisplayName("Docente de Secundaria con múltiples secciones deriva nivel/turno comunes y grado/sección Múltiple")
    void docenteSecundariaMultiplesSeccionesResuelveResumen() {
        UserEntity docente = crearDocente(20L, "Roberto", "Alvarado");
        Aula sec1A = crearAula("SECUNDARIA", "1", "A", "TARDE");
        Aula sec2B = crearAula("SECUNDARIA", "2", "B", "TARDE");
        Curso archivado = crearCurso("Antiguo", crearAula("PRIMARIA", "6", "A", "MAÑANA"), "ARCHIVADO");

        when(aulaRepository.findByTutorAndAnioEscolar(docente, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL))
                .thenReturn(List.of());
        when(aulaRepository.findByTutor(docente)).thenReturn(List.of());
        when(cursoRepository.findByProfesor(docente))
                .thenReturn(List.of(crearCurso("Matemática", sec1A, ""), crearCurso("Matemática", sec2B, ""), archivado));

        AcademicGroup scope = DocenteScopeHelper.resolve(docente, aulaRepository, cursoRepository);

        assertThat(scope.nivel()).isEqualTo("SECUNDARIA");
        assertThat(scope.grado()).isEqualTo(DocenteScopeHelper.MULTIPLE);
        assertThat(scope.seccion()).isEqualTo(DocenteScopeHelper.MULTIPLE);
        assertThat(scope.turno()).isEqualTo("TARDE");
    }

    @Test
    @DisplayName("Docente sin tutorías ni cursos asignados retorna POR ASIGNAR y nunca null")
    void docenteSinAsignacionRetornaPorAsignar() {
        UserEntity docente = crearDocente(30L, "Nuevo", "Docente");
        when(aulaRepository.findByTutorAndAnioEscolar(docente, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL))
                .thenReturn(List.of());
        when(aulaRepository.findByTutor(docente)).thenReturn(List.of());
        when(cursoRepository.findByProfesor(docente)).thenReturn(List.of());

        EntityMapper mapper = new EntityMapper();
        ReflectionTestUtils.setField(mapper, "aulaRepository", aulaRepository);
        ReflectionTestUtils.setField(mapper, "cursoRepository", cursoRepository);

        UserDTO dto = mapper.toDTO(docente);

        assertThat(dto.getNivel()).isEqualTo(DocenteScopeHelper.POR_ASIGNAR);
        assertThat(dto.getGrado()).isEqualTo(DocenteScopeHelper.POR_ASIGNAR);
        assertThat(dto.getSeccion()).isEqualTo(DocenteScopeHelper.POR_ASIGNAR);
        assertThat(dto.getTurno()).isEqualTo(DocenteScopeHelper.POR_ASIGNAR);
    }

    @Test
    @DisplayName("Sin repositorios inyectados conserva valores transitorios si existen o usa POR ASIGNAR")
    void sinRepositoriosFuncionaDeFormaSegura() {
        UserEntity conTransitorios = crearDocente(null, "Test", "Unit");
        conTransitorios.setNivel("PRIMARIA");
        conTransitorios.setGrado("4");
        conTransitorios.setSeccion("B");
        conTransitorios.setTurno("MAÑANA");

        AcademicGroup conValores = DocenteScopeHelper.resolve(conTransitorios, null, null);
        assertThat(conValores.nivel()).isEqualTo("PRIMARIA");
        assertThat(conValores.grado()).isEqualTo("4");
        assertThat(conValores.seccion()).isEqualTo("B");

        UserEntity vacio = crearDocente(null, "Sin", "Repos");
        AcademicGroup fallback = DocenteScopeHelper.resolve(vacio, null, null);
        assertThat(fallback.nivel()).isEqualTo(DocenteScopeHelper.POR_ASIGNAR);
        assertThat(fallback.seccion()).isEqualTo(DocenteScopeHelper.POR_ASIGNAR);
    }

    private UserEntity crearDocente(Long id, String nombres, String apellidos) {
        UserEntity u = new UserEntity();
        u.setId(id);
        u.setNombres(nombres);
        u.setApellidos(apellidos);
        u.setRol("DOCENTE");
        return u;
    }

    private Aula crearAula(String nivel, String grado, String seccion, String turno) {
        return new Aula(nivel, grado, seccion, turno, AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL);
    }

    private Curso crearCurso(String nombre, Aula aula, String turno) {
        Curso c = new Curso();
        c.setNombre(nombre);
        c.setAula(aula);
        c.setTurno(turno);
        return c;
    }
}
