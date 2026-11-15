package org.example.shidell;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.exception.GlobalExceptionHandler;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.CalificacionDTO;
import org.example.shidell.model.entity.*;
import org.example.shidell.repository.*;
import org.example.shidell.service.*;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.GradeCalculationHelper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DomainLogicHardeningTest {

    @Mock private UserRepository userRepository;
    @Mock private CursoRepository cursoRepository;
    @Mock private MatriculaRepository matriculaRepository;
    @Mock private CalificacionRepository calificacionRepository;
    @Mock private EvaluacionRepository evaluacionRepository;
    @Mock private TareaRepository tareaRepository;
    @Mock private EntregaRepository entregaRepository;
    @Mock private AsistenciaRepository asistenciaRepository;
    @Mock private ForoSemanaMensajeRepository foroSemanaMensajeRepository;
    @Mock private NotificacionRepository notificacionRepository;
    @Mock private MensajeRepository mensajeRepository;
    @Mock private AulaRepository aulaRepository;
    @Mock private AuthSessionService authSessionService;
    @Mock private DocenteService docenteService;
    @Mock private NotificacionService notificacionServiceMock;
    @Mock private AsistenciaService asistenciaServiceMock;

    private UserEntity user(Long id, String nombres, String rol) {
        UserEntity u = new UserEntity();
        u.setId(id);
        u.setNombres(nombres);
        u.setApellidos("Prueba");
        u.setRol(rol);
        u.setNivel("SECUNDARIA");
        u.setGrado("3");
        u.setSeccion("A");
        u.setTurno("MAÑANA");
        return u;
    }

    private Curso curso(Long id, String nombre, UserEntity profesor) {
        Curso c = new Curso();
        c.setId(id);
        c.setNombre(nombre);
        c.setAula(new Aula("SECUNDARIA", "3", "A", "MAÑANA", 2026));
        c.setProfesor(profesor);
        c.setDiaSemana(1);
        return c;
    }

    @Test
    void gradeCalculationAndServicesStayUnifiedWithWeightedFormula() {
        UserEntity est = user(10L, "Lucia", "ESTUDIANTE");
        UserEntity prof = user(20L, "Carlos", "DOCENTE");
        Curso mat = curso(1L, "Matemática", prof);

        Evaluacion exam = new Evaluacion();
        exam.setId(5L);
        exam.setTitulo("Examen Parcial");
        exam.setPeso(3.0);
        exam.setNotaMaxima(20.0);

        Calificacion c1 = new Calificacion();
        c1.setId(1L);
        c1.setCurso(mat);
        c1.setEstudiante(est);
        c1.setEvaluacion(exam);
        c1.setActividad("Examen Parcial");
        c1.setNota(18.0);
        c1.setNotaMaxima(20.0);
        c1.setFecha(LocalDate.now());

        Calificacion c2 = new Calificacion();
        c2.setId(2L);
        c2.setCurso(mat);
        c2.setEstudiante(est);
        c2.setActividad("Práctica 1");
        c2.setNota(5.0);
        c2.setNotaMaxima(10.0); // equivalente a 10.0 / 20 con peso 1.0
        c2.setFecha(LocalDate.now().minusDays(1));

        List<Calificacion> notas = List.of(c1, c2);
        // Ponderado: (18*3 + 10*1) / 4 = 64 / 4 = 16.0
        assertEquals(16.0, GradeCalculationHelper.promedioPonderadoNota20(notas), 0.001);

        CalificacionService calService = new CalificacionService();
        EntityMapper mapper = new EntityMapper();
        ReflectionTestUtils.setField(calService, "calificacionRepository", calificacionRepository);
        ReflectionTestUtils.setField(calService, "userRepository", userRepository);
        ReflectionTestUtils.setField(calService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(calService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(calService, "mapper", mapper);

        ProgresoService progService = new ProgresoService();
        ReflectionTestUtils.setField(progService, "userRepository", userRepository);
        ReflectionTestUtils.setField(progService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(progService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(progService, "calificacionRepository", calificacionRepository);
        ReflectionTestUtils.setField(progService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(progService, "asistenciaService", asistenciaServiceMock);
        ReflectionTestUtils.setField(progService, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(progService, "foroSemanaMensajeRepository", foroSemanaMensajeRepository);
        ReflectionTestUtils.setField(progService, "mapper", mapper);

        when(userRepository.findById(10L)).thenReturn(Optional.of(est));
        when(calificacionRepository.findByEstudianteId(10L)).thenReturn(notas);
        when(cursoRepository.findByGrupoAcademico(any(), any(), any(), any())).thenReturn(List.of(mat));
        when(tareaRepository.findByGrupoAcademico(any(), any(), any(), any())).thenReturn(List.of());
        when(entregaRepository.findByEstudiante(est)).thenReturn(List.of());

        Asistencia a1 = new Asistencia();
        a1.setEstado("PRESENTE");
        a1.setFecha(LocalDate.now());
        Asistencia a2 = new Asistencia();
        a2.setEstado("JUSTIFICADO");
        a2.setFecha(LocalDate.now().minusDays(1));
        when(asistenciaServiceMock.getAsistenciasCompletas(est)).thenReturn(List.of(a1, a2));

        Map<String, Object> calRes = calService.getCalificacionesByEstudiante(10L, est);
        Map<String, Object> progRes = progService.getProgresoEstudiante(10L, est);

        assertEquals(16.0, ((Number) calRes.get("promedioGeneral")).doubleValue(), 0.01);
        assertEquals(16.0, ((Number) progRes.get("promedioGeneral")).doubleValue(), 0.01);
        assertEquals(100L, ((Number) progRes.get("asistenciaPorcentaje")).longValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void calificacionServiceShowsEmptyStateMessageWhenNoEvaluationsExist() {
        UserEntity est = user(11L, "Ana", "ESTUDIANTE");
        CalificacionService calService = new CalificacionService();
        ReflectionTestUtils.setField(calService, "calificacionRepository", calificacionRepository);
        ReflectionTestUtils.setField(calService, "userRepository", userRepository);
        ReflectionTestUtils.setField(calService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(calService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(calService, "mapper", new EntityMapper());

        when(userRepository.findById(11L)).thenReturn(Optional.of(est));
        when(calificacionRepository.findByEstudianteId(11L)).thenReturn(List.of());
        when(cursoRepository.findByGrupoAcademico(any(), any(), any(), any())).thenReturn(List.of());

        Map<String, Object> res = calService.getCalificacionesByEstudiante(11L, est);
        Map<String, Object> msg = (Map<String, Object>) res.get("mensaje");
        assertEquals("Sin evaluaciones aún", msg.get("titulo"));
    }

    @Test
    void entregaServiceMarksLateSubmissionAndLocksGradedResubmissionAndSyncsGrade() {
        UserEntity prof = user(20L, "Carlos", "DOCENTE");
        UserEntity padre = user(30L, "Marta", "PADRE");
        UserEntity est = user(10L, "Lucia", "ESTUDIANTE");
        est.setPadre(padre);

        Curso mat = curso(1L, "Matemática", prof);
        Tarea tareaVencida = new Tarea();
        tareaVencida.setId(50L);
        tareaVencida.setTitulo("Ensayo Final");
        tareaVencida.setCurso(mat);
        tareaVencida.setFechaVencimiento(LocalDate.now().minusDays(2));

        EntregaService service = new EntregaService();
        ReflectionTestUtils.setField(service, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(service, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        ReflectionTestUtils.setField(service, "notificacionService", notificacionServiceMock);
        ReflectionTestUtils.setField(service, "calificacionRepository", calificacionRepository);
        ReflectionTestUtils.setField(service, "evaluacionRepository", evaluacionRepository);
        ReflectionTestUtils.setField(service, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(service, "matriculaRepository", matriculaRepository);

        when(tareaRepository.findById(50L)).thenReturn(Optional.of(tareaVencida));
        when(userRepository.findById(10L)).thenReturn(Optional.of(est));
        when(entregaRepository.findByTareaAndEstudiante(tareaVencida, est)).thenReturn(Optional.empty());
        when(entregaRepository.save(any(Entrega.class))).thenAnswer(inv -> {
            Entrega e = inv.getArgument(0);
            e.setId(77L);
            return e;
        });

        MockMultipartFile pdf = new MockMultipartFile("archivo", "ensayo.pdf", "application/pdf", new byte[]{1, 2, 3});
        Entrega tardia = service.subirEntrega(50L, 10L, "Disculpe la demora", pdf, est);
        assertEquals("ENTREGADO_TARDE", tardia.getEstado());

        // Calificar sincroniza Calificacion y alerta al padre si es < 11
        when(entregaRepository.findById(77L)).thenReturn(Optional.of(tardia));
        when(evaluacionRepository.findFirstByCursoIdAndTituloIgnoreCase(1L, "Ensayo Final")).thenReturn(Optional.empty());
        when(calificacionRepository.findFirstByCursoIdAndEstudianteIdAndActividadIgnoreCase(1L, 10L, "Ensayo Final"))
                .thenReturn(Optional.empty());
        when(calificacionRepository.save(any(Calificacion.class))).thenAnswer(inv -> inv.getArgument(0));

        Entrega calificada = service.calificarEntrega(77L, 9.5, "Mejorar sustento", prof);
        assertEquals("CALIFICADO", calificada.getEstado());
        assertEquals(9.5, calificada.getNota());

        ArgumentCaptor<Calificacion> calCaptor = ArgumentCaptor.forClass(Calificacion.class);
        verify(calificacionRepository).save(calCaptor.capture());
        assertEquals(9.5, calCaptor.getValue().getNota());
        assertEquals("Ensayo Final", calCaptor.getValue().getActividad());
        verify(notificacionServiceMock).alertarPadrePorBajaNota(any(Calificacion.class));

        // Intentar re-subir después de calificada debe retornar 409 CONFLICT
        when(entregaRepository.findByTareaAndEstudiante(tareaVencida, est)).thenReturn(Optional.of(calificada));
        ResponseStatusException conflict = assertThrows(ResponseStatusException.class,
                () -> service.subirEntrega(50L, 10L, "Nuevo intento", pdf, est));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
    }

    @Test
    void accessControlEnforcesAntiIdorAcrossRoles() {
        UserEntity padre1 = user(100L, "PadreUno", "PADRE");
        UserEntity padre2 = user(200L, "PadreDos", "PADRE");
        UserEntity est1 = user(10L, "HijoUno", "ESTUDIANTE");
        est1.setPadre(padre1);
        UserEntity est2 = user(11L, "OtroAlumno", "ESTUDIANTE");
        UserEntity profOwner = user(20L, "ProfOwner", "DOCENTE");
        UserEntity profOther = user(21L, "ProfOther", "DOCENTE");
        Curso mat = curso(1L, "Matemática", profOwner);

        when(cursoRepository.findByProfesor(profOwner)).thenReturn(List.of(mat));
        when(cursoRepository.findByProfesor(profOther)).thenReturn(List.of());

        assertDoesNotThrow(() -> AccessControlHelper.requireStudentAccess(est1, est1, cursoRepository, matriculaRepository, "denied"));
        assertDoesNotThrow(() -> AccessControlHelper.requireStudentAccess(padre1, est1, cursoRepository, matriculaRepository, "denied"));
        assertDoesNotThrow(() -> AccessControlHelper.requireStudentAccess(profOwner, est1, cursoRepository, matriculaRepository, "denied"));

        assertThrows(ForbiddenException.class,
                () -> AccessControlHelper.requireStudentAccess(est2, est1, cursoRepository, matriculaRepository, "denied"));
        assertThrows(ForbiddenException.class,
                () -> AccessControlHelper.requireStudentAccess(padre2, est1, cursoRepository, matriculaRepository, "denied"));
        assertThrows(ForbiddenException.class,
                () -> AccessControlHelper.requireStudentAccess(profOther, est1, cursoRepository, matriculaRepository, "denied"));
        assertThrows(ForbiddenException.class,
                () -> AccessControlHelper.requireCourseOwnerOrAdmin(profOther, mat));
    }

    @Test
    void asistenciaServiceSkipsNationalHolidaysAndInterBlockRecesses() {
        UserEntity est = user(10L, "Lucia", "ESTUDIANTE");
        UserEntity prof = user(20L, "Carlos", "DOCENTE");
        Curso cursoViernes = curso(1L, "Historia", prof);
        // 1 de mayo 2026 cayó viernes y es Día del Trabajo (feriado)
        cursoViernes.setDiaSemana(DayOfWeek.FRIDAY.getValue());

        AsistenciaService service = new AsistenciaService();
        ReflectionTestUtils.setField(service, "asistenciaRepository", asistenciaRepository);
        ReflectionTestUtils.setField(service, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(service, "matriculaRepository", matriculaRepository);

        when(cursoRepository.findByGrupoAcademico(any(), any(), any(), any())).thenReturn(List.of(cursoViernes));
        when(asistenciaRepository.findByEstudiante(est)).thenReturn(List.of());
        when(matriculaRepository.findByEstudianteAndAnioEscolar(eq(est), anyInt())).thenReturn(Optional.empty());

        List<Asistencia> asistencias = service.getAsistenciasCompletas(est);
        LocalDate diaTrabajo = LocalDate.of(LocalDate.now().getYear(), 5, 1);
        LocalDate preClases = LocalDate.of(LocalDate.now().getYear(), 3, 6);

        assertFalse(asistencias.isEmpty());
        assertFalse(asistencias.stream().anyMatch(a -> diaTrabajo.equals(a.getFecha())),
                "No debe generar asistencia en feriado oficial 1 de mayo");
        assertFalse(asistencias.stream().anyMatch(a -> preClases.equals(a.getFecha())),
                "No debe generar asistencia antes del inicio oficial de clases (16 de marzo)");
    }

    @Test
    void cursoForumAndMensajeServiceValidateContentAndOwnership() {
        UserEntity estA = user(10L, "Lucia", "ESTUDIANTE");
        UserEntity estAjeno = user(99L, "Ajeno", "ESTUDIANTE");
        estAjeno.setSeccion("Z");
        UserEntity prof = user(20L, "Carlos", "DOCENTE");
        Curso mat = curso(1L, "Matemática", prof);

        CursoService cursoService = new CursoService();
        ReflectionTestUtils.setField(cursoService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(cursoService, "foroSemanaMensajeRepository", foroSemanaMensajeRepository);
        ReflectionTestUtils.setField(cursoService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(cursoService, "notificacionService", notificacionServiceMock);
        ReflectionTestUtils.setField(cursoService, "mapper", new EntityMapper());

        when(cursoRepository.findById(1L)).thenReturn(Optional.of(mat));
        assertThrows(BadRequestException.class,
                () -> cursoService.crearMensajeForo(1L, 40, Map.of("contenido", "Hola"), estA));
        assertThrows(BadRequestException.class,
                () -> cursoService.crearMensajeForo(1L, 1, Map.of("contenido", "   "), estA));
        assertThrows(ForbiddenException.class,
                () -> cursoService.crearMensajeForo(1L, 1, Map.of("contenido", "Hola"), estAjeno));

        MensajeService mensajeService = new MensajeService();
        ReflectionTestUtils.setField(mensajeService, "mensajeRepository", mensajeRepository);
        ReflectionTestUtils.setField(mensajeService, "userRepository", userRepository);
        ReflectionTestUtils.setField(mensajeService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(mensajeService, "notificacionService", notificacionServiceMock);
        ReflectionTestUtils.setField(mensajeService, "mapper", new EntityMapper());

        assertThrows(BadRequestException.class,
                () -> mensajeService.enviarMensaje(10L, 10L, null, "Hola", null, estA));
        assertThrows(BadRequestException.class,
                () -> mensajeService.enviarMensaje(10L, 20L, null, "   ", null, estA));
    }

    @Test
    void notificacionServiceGeneratesOverdueAlertsWithoutDuplicates() {
        UserEntity padre = user(30L, "Marta", "PADRE");
        UserEntity est = user(10L, "Lucia", "ESTUDIANTE");
        est.setPadre(padre);
        UserEntity prof = user(20L, "Carlos", "DOCENTE");
        Curso mat = curso(1L, "Matemática", prof);

        Tarea tVencida = new Tarea();
        tVencida.setId(1L);
        tVencida.setTitulo("Práctica 2");
        tVencida.setCurso(mat);
        tVencida.setFechaVencimiento(LocalDate.now().minusDays(1));

        NotificacionService notifService = new NotificacionService();
        ReflectionTestUtils.setField(notifService, "notificacionRepository", notificacionRepository);
        ReflectionTestUtils.setField(notifService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(notifService, "userRepository", userRepository);
        ReflectionTestUtils.setField(notifService, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(notifService, "mapper", new EntityMapper());

        when(tareaRepository.findAll()).thenReturn(List.of(tVencida));
        when(userRepository.findByGrupoAcademico(any(), any(), any(), any())).thenReturn(List.of(est));
        when(entregaRepository.findByTareaAndEstudiante(tVencida, est)).thenReturn(Optional.empty());
        when(notificacionRepository.existsByUsuarioAndTituloAndMensaje(eq(padre), anyString(), anyString()))
                .thenReturn(false)
                .thenReturn(true);

        assertEquals(1, notifService.verificarYAlertarTareasVencidas());
        assertEquals(0, notifService.verificarYAlertarTareasVencidas());
        verify(notificacionRepository, times(1)).save(any(Notificacion.class));
    }

    @Test
    void adminServiceValidatesEmailsRolesHoursAndTeacherCourseDependencies() {
        UserEntity admin = user(1L, "Root", "ADMINISTRADOR");
        UserEntity prof = user(20L, "Carlos", "DOCENTE");
        Curso mat = curso(1L, "Matemática", prof);

        AdminService adminService = new AdminService();
        ReflectionTestUtils.setField(adminService, "userRepository", userRepository);
        ReflectionTestUtils.setField(adminService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(adminService, "mensajeRepository", mensajeRepository);
        ReflectionTestUtils.setField(adminService, "authSessionService", authSessionService);
        ReflectionTestUtils.setField(adminService, "aulaRepository", aulaRepository);
        ReflectionTestUtils.setField(adminService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(adminService, "mapper", new EntityMapper());

        // Email duplicado -> 409 CONFLICT
        UserEntity nuevo = user(null, "Nuevo", "ESTUDIANTE");
        nuevo.setEmail("dup@shidell.edu.pe");
        when(userRepository.findByEmail("dup@shidell.edu.pe")).thenReturn(Optional.of(prof));
        ResponseStatusException dupEx = assertThrows(ResponseStatusException.class,
                () -> adminService.createUsuario(nuevo));
        assertEquals(HttpStatus.CONFLICT, dupEx.getStatusCode());

        // Docente con cursos asignados -> IllegalStateException (409)
        when(userRepository.findById(20L)).thenReturn(Optional.of(prof));
        when(cursoRepository.findByProfesor(prof)).thenReturn(List.of(mat));
        assertThrows(IllegalStateException.class, () -> adminService.deleteUsuario(20L, admin));

        // Auto-eliminación bloqueada -> BadRequestException
        assertThrows(BadRequestException.class, () -> adminService.deleteUsuario(1L, admin));

        // Hora fin <= Hora inicio -> BadRequestException
        when(cursoRepository.findById(1L)).thenReturn(Optional.of(mat));
        Curso cursoInvalido = new Curso();
        cursoInvalido.setHoraInicio("10:00");
        cursoInvalido.setHoraFin("09:00");
        assertThrows(BadRequestException.class, () -> adminService.updateCurso(1L, cursoInvalido));
    }

    @Test
    void tareaServiceEnforcesSectionAccessAndCascadeDelete() {
        UserEntity padre = user(30L, "Marta", "PADRE");
        UserEntity hijo = user(10L, "Lucia", "ESTUDIANTE");
        UserEntity otroAlumno = user(11L, "Ajeno", "ESTUDIANTE");
        otroAlumno.setSeccion("Z");

        UserEntity prof = user(20L, "Carlos", "DOCENTE");
        Curso mat = curso(1L, "Matemática", prof);

        Tarea tarea = new Tarea();
        tarea.setId(55L);
        tarea.setTitulo("Guía 1");
        tarea.setCurso(mat);
        tarea.setFechaInicio(LocalDate.now());
        tarea.setFechaVencimiento(LocalDate.now().plusDays(3));

        Entrega entrega = new Entrega();
        entrega.setId(88L);
        entrega.setTarea(tarea);
        entrega.setEstudiante(hijo);

        TareaService tareaService = new TareaService();
        ReflectionTestUtils.setField(tareaService, "tareaRepository", tareaRepository);
        ReflectionTestUtils.setField(tareaService, "userRepository", userRepository);
        ReflectionTestUtils.setField(tareaService, "entregaRepository", entregaRepository);
        ReflectionTestUtils.setField(tareaService, "cursoRepository", cursoRepository);
        ReflectionTestUtils.setField(tareaService, "matriculaRepository", matriculaRepository);
        ReflectionTestUtils.setField(tareaService, "mapper", new EntityMapper());
        ReflectionTestUtils.setField(tareaService, "docenteService", docenteService);
        ReflectionTestUtils.setField(tareaService, "notificacionService", notificacionServiceMock);

        when(userRepository.findByPadreId(30L)).thenReturn(List.of(hijo));
        when(tareaRepository.findByGrupoAcademico("SECUNDARIA", "3", "A", null)).thenReturn(List.of(tarea));

        assertEquals(1, tareaService.getTareasBySeccion("SECUNDARIA", "3", "A", null, padre).size());
        assertThrows(ForbiddenException.class,
                () -> tareaService.getTareasBySeccion("SECUNDARIA", "3", "A", null, otroAlumno));

        // Fechas inválidas -> BadRequestException
        Tarea invalida = new Tarea();
        invalida.setTitulo("Bad");
        invalida.setCurso(mat);
        invalida.setFechaInicio(LocalDate.now().plusDays(5));
        invalida.setFechaVencimiento(LocalDate.now());
        assertThrows(BadRequestException.class, () -> tareaService.createTarea(invalida, prof));

        // Cascade delete de entregas al borrar tarea
        when(tareaRepository.findById(55L)).thenReturn(Optional.of(tarea));
        when(entregaRepository.findByTarea(tarea)).thenReturn(List.of(entrega));
        assertTrue(tareaService.deleteTarea(55L, prof));
        verify(entregaRepository).deleteAll(List.of(entrega));
        verify(tareaRepository).delete(tarea);
    }

    @Test
    void globalExceptionHandlerMapsStandardExceptionsProperly() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        ResponseEntity<Object> r404 = handler.handleNoSuchElement(new NoSuchElementException("No hallado"));
        ResponseEntity<Object> r400 = handler.handleIllegalArgument(new IllegalArgumentException("Dato inválido"));
        ResponseEntity<Object> r409 = handler.handleIllegalState(new IllegalStateException("Conflicto"));
        ResponseEntity<Object> rStatus = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.CONFLICT, "Ya calificada"));

        assertEquals(HttpStatus.NOT_FOUND, r404.getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, r400.getStatusCode());
        assertEquals(HttpStatus.CONFLICT, r409.getStatusCode());
        assertEquals(HttpStatus.CONFLICT, rStatus.getStatusCode());
    }

    @Test
    void userServiceAllowsPersonalProfileEditsButLocksInstitutionalFieldsForDocente() {
        UserEntity docente = user(20L, "Carlos", "DOCENTE");
        docente.setEmail("docente@shidell.edu");
        docente.setCodigoPlaza("PLZ-001");
        docente.setDni("70123456");

        UserService userService = new UserService();
        ReflectionTestUtils.setField(userService, "userRepository", userRepository);
        ReflectionTestUtils.setField(userService, "authSessionService", authSessionService);
        ReflectionTestUtils.setField(userService, "mapper", new EntityMapper());

        when(userRepository.findById(20L)).thenReturn(Optional.of(docente));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(authSessionService.hashPassword("claveNueva123")).thenReturn("$2a$hashed");

        // 1. Docente puede actualizar nombres, apellidos, teléfono, dirección y contraseña
        UserEntity patch = new UserEntity();
        patch.setNombres("  Carlos Alberto  ");
        patch.setApellidos(" Mendoza ");
        patch.setEmail("docente@shidell.edu"); // mismo correo -> permitido
        patch.setTelefono("987654321");
        patch.setDireccion("Av. Cultura 420");
        patch.setNivel("PRIMARIA"); // intento de cambio académico -> ignorado para docente
        patch.setPassword("claveNueva123");

        org.example.shidell.model.dto.UserDTO updated = userService.updateUser(20L, patch, docente);
        assertEquals("Carlos Alberto", updated.getNombres());
        assertEquals("Mendoza", updated.getApellidos());
        assertEquals("987654321", updated.getTelefono());
        assertEquals("Av. Cultura 420", updated.getDireccion());
        assertEquals("SECUNDARIA", updated.getNivel()); // bloqueado para no-admin
        assertEquals("$2a$hashed", docente.getPassword());

        // 2. Docente NO puede modificar su correo institucional -> 403 ForbiddenException
        UserEntity emailTamper = new UserEntity();
        emailTamper.setEmail("otro@shidell.edu");
        assertThrows(ForbiddenException.class, () -> userService.updateUser(20L, emailTamper, docente));

        // 3. Admin SÍ puede actualizar correo y nivel del docente
        UserEntity admin = user(1L, "Root", "ADMINISTRADOR");
        UserEntity adminPatch = new UserEntity();
        adminPatch.setEmail("nuevo.docente@shidell.edu");
        adminPatch.setNivel("PRIMARIA");
        when(userRepository.findByEmail("nuevo.docente@shidell.edu")).thenReturn(Optional.empty());
        org.example.shidell.model.dto.UserDTO adminUpdated = userService.updateUser(20L, adminPatch, admin);
        assertEquals("nuevo.docente@shidell.edu", adminUpdated.getEmail());
        assertEquals("PRIMARIA", adminUpdated.getNivel());
    }
}
