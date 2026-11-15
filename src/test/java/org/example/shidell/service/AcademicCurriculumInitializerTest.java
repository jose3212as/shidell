package org.example.shidell.service;

import org.example.shidell.model.entity.Aula;
import org.example.shidell.model.entity.Calificacion;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.entity.Evaluacion;
import org.example.shidell.model.entity.Matricula;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.AulaRepository;
import org.example.shidell.repository.CalificacionRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.EntregaRepository;
import org.example.shidell.repository.EvaluacionRepository;
import org.example.shidell.repository.EventoRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.repository.TareaRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.util.AcademicCalendarUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Pruebas Unitarias - AcademicCurriculumInitializer")
class AcademicCurriculumInitializerTest {

    @Mock private AulaRepository aulaRepository;
    @Mock private CursoRepository cursoRepository;
    @Mock private TareaRepository tareaRepository;
    @Mock private EvaluacionRepository evaluacionRepository;
    @Mock private CalificacionRepository calificacionRepository;
    @Mock private EntregaRepository entregaRepository;
    @Mock private EventoRepository eventoRepository;
    @Mock private UserRepository userRepository;
    @Mock private MatriculaRepository matriculaRepository;
    @Spy  private CalendarioMineduService mineduService = new CalendarioMineduService();

    @InjectMocks
    private AcademicCurriculumInitializer initializer;

    @Test
    @DisplayName("normalizarMallaTareasYExamenes deja exactamente 1 tarea por semana en 36 semanas y corrige los 8 exámenes")
    void normaliza36SemanasY8Examenes() {
        LocalDate ref = LocalDate.of(2026, 11, 14);
        Aula aula = new Aula("PRIMARIA", "6", "D", "MAÑANA", 2026);
        aula.setId(39L);

        UserEntity doc = new UserEntity();
        doc.setId(100L);

        Curso curso = new Curso();
        curso.setId(500L);
        curso.setNombre("Matemática");
        curso.setAula(aula);
        curso.setDiaSemana(1);
        curso.setHoraInicio("07:45");
        curso.setHoraFin("09:15");
        curso.setProfesor(doc);

        LocalDate sem2Inicio = CalendarioMineduService.fechaInicioEnSemana(2026, 2);
        LocalDate sem2Fin = CalendarioMineduService.fechaVencimientoEnSemana(2026, 2);

        Tarea conEntrega = new Tarea();
        conEntrega.setId(10L);
        conEntrega.setTitulo("Actividad entregada S2");
        conEntrega.setCurso(curso);
        conEntrega.setFechaInicio(sem2Inicio);
        conEntrega.setFechaVencimiento(sem2Fin);

        Tarea extraDuplicada = new Tarea();
        extraDuplicada.setId(11L);
        extraDuplicada.setTitulo("Duplicada sin entrega S2");
        extraDuplicada.setCurso(curso);
        extraDuplicada.setFechaInicio(sem2Inicio);
        extraDuplicada.setFechaVencimiento(sem2Fin);

        Evaluacion parcial3MalEtiquetado = new Evaluacion();
        parcial3MalEtiquetado.setId(70L);
        parcial3MalEtiquetado.setTitulo("Examen Parcial III - Matemática");
        parcial3MalEtiquetado.setTipo("EXAMEN");
        parcial3MalEtiquetado.setBimestre(4);
        parcial3MalEtiquetado.setPeso(1.5);
        parcial3MalEtiquetado.setNotaMaxima(20.0);
        parcial3MalEtiquetado.setFecha(LocalDate.of(2026, 9, 10));
        parcial3MalEtiquetado.setCurso(curso);

        when(aulaRepository.findAll()).thenReturn(List.of(aula));
        when(cursoRepository.findAll()).thenReturn(List.of(curso));
        when(tareaRepository.findAll()).thenReturn(List.of(conEntrega, extraDuplicada));
        when(evaluacionRepository.findAll()).thenReturn(List.of(parcial3MalEtiquetado));
        when(entregaRepository.findDistinctTareaIdsWithEntregas()).thenReturn(List.of(10L));
        when(cursoRepository.findByGrupoAcademico(anyString(), anyString(), anyString(), anyString())).thenReturn(List.of());

        initializer.normalizarMallaTareasYExamenes(ref);

        ArgumentCaptor<List<Tarea>> elimCaptor = ArgumentCaptor.forClass(List.class);
        verify(tareaRepository).deleteAllInBatch(elimCaptor.capture());
        assertEquals(1, elimCaptor.getValue().size());
        assertEquals(11L, elimCaptor.getValue().get(0).getId());

        ArgumentCaptor<List<Tarea>> saveTareasCaptor = ArgumentCaptor.forClass(List.class);
        verify(tareaRepository, atLeastOnce()).saveAll(saveTareasCaptor.capture());
        List<Tarea> creadas = saveTareasCaptor.getAllValues().stream().flatMap(List::stream).toList();
        assertEquals(35, creadas.size(), "Debe completar exactamente las 35 semanas faltantes");
        assertTrue(creadas.stream().allMatch(t -> t.getPdfUrl() == null), "Sin PDFs en blanco por defecto");

        Set<Integer> semanasFinales = new HashSet<>();
        semanasFinales.add(2);
        creadas.forEach(t -> semanasFinales.add(
                AcademicCalendarUtil.resolverSemanaTarea(t.getFechaVencimiento(), t.getFechaInicio(), ref)));
        assertEquals(36, semanasFinales.size());

        ArgumentCaptor<List<Evaluacion>> evalCaptor = ArgumentCaptor.forClass(List.class);
        verify(evaluacionRepository).saveAll(evalCaptor.capture());
        assertEquals(3, parcial3MalEtiquetado.getBimestre(), "Parcial III debe corregirse a bimestre 3");
        assertEquals(8, evalCaptor.getValue().size(), "1 corregida + 7 nuevas = 8 slots cubiertos");
    }

    @Test
    @DisplayName("asegurarNotasYEntregasEstudiantesDemo asigna notas vigesimales a evaluaciones ya rendidas y deja pendientes las futuras")
    void asignaNotasRealesYSinPdfEnEntregas() {
        LocalDate ref = LocalDate.of(2026, 11, 14);
        Aula aula = new Aula("PRIMARIA", "6", "D", "MAÑANA", 2026);
        aula.setId(39L);

        UserEntity est = new UserEntity();
        est.setId(433L);
        est.setEmail("estudiante.p240@shidell.com");
        est.setRol("ESTUDIANTE");

        Matricula mat = new Matricula();
        mat.setEstudiante(est);
        mat.setAula(aula);
        mat.setAnioEscolar(2026);
        mat.setEstado("ACTIVO");

        Curso matCurso = new Curso();
        matCurso.setId(600L);
        matCurso.setNombre("Matemática");
        matCurso.setAula(aula);
        matCurso.setDiaSemana(2);

        List<Evaluacion> plan8 = mineduService.construirEvaluacionesBimestrales(matCurso, 2026);
        for (int i = 0; i < plan8.size(); i++) {
            plan8.get(i).setId(1000L + i);
        }

        Tarea tPasada = new Tarea();
        tPasada.setId(2001L);
        tPasada.setCurso(matCurso);
        tPasada.setFechaInicio(CalendarioMineduService.fechaInicioEnSemana(2026, 5));
        tPasada.setFechaVencimiento(CalendarioMineduService.fechaVencimientoEnSemana(2026, 5));

        Tarea tReciente = new Tarea();
        tReciente.setId(2002L);
        tReciente.setCurso(matCurso);
        int semAct = AcademicCalendarUtil.semanaActualLectiva(ref);
        tReciente.setFechaInicio(CalendarioMineduService.fechaInicioEnSemana(2026, semAct));
        tReciente.setFechaVencimiento(CalendarioMineduService.fechaVencimientoEnSemana(2026, semAct));

        when(userRepository.findByEmail("estudiante.p240@shidell.com")).thenReturn(Optional.of(est));
        when(matriculaRepository.findByEstudiante(est)).thenReturn(List.of(mat));
        when(cursoRepository.findByGrupoAcademico("PRIMARIA", "6", "D", "MAÑANA")).thenReturn(List.of(matCurso));
        when(calificacionRepository.findByEstudianteId(433L)).thenReturn(List.of());
        when(entregaRepository.findByEstudiante(est)).thenReturn(List.of());
        when(evaluacionRepository.findByCursoIdOrderByBimestreAscFechaAscIdAsc(600L)).thenReturn(plan8);
        when(tareaRepository.findByCurso(matCurso)).thenReturn(List.of(tPasada, tReciente));

        initializer.asegurarNotasYEntregasEstudiantesDemo(List.of("estudiante.p240@shidell.com"), ref);

        ArgumentCaptor<List<Calificacion>> calsCaptor = ArgumentCaptor.forClass(List.class);
        verify(calificacionRepository).saveAll(calsCaptor.capture());
        List<Calificacion> guardadas = calsCaptor.getValue();
        long esperadasRendidas = plan8.stream().filter(ev -> !ev.getFecha().isAfter(ref)).count();
        assertEquals(esperadasRendidas, guardadas.size());
        assertTrue(guardadas.stream().allMatch(c -> c.getNota() >= 0.0 && c.getNota() <= 20.0));
        assertTrue(guardadas.stream().noneMatch(c -> c.getFecha().isAfter(ref)),
                "El Examen Bimestral IV futuro (diciembre) debe quedar Programado sin nota");

        ArgumentCaptor<List<Entrega>> entregasCaptor = ArgumentCaptor.forClass(List.class);
        verify(entregaRepository).saveAll(entregasCaptor.capture());
        assertEquals(1, entregasCaptor.getValue().size());
        assertNull(entregasCaptor.getValue().get(0).getArchivoUrl(), "No debe generar PDF falso/en blanco");
    }
}
