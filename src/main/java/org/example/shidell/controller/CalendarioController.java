package org.example.shidell.controller;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Evento;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.dto.*;
import org.example.shidell.repository.*;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.util.TextUtils;
import org.example.shidell.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/calendario")
@CrossOrigin(origins = "*")
public class CalendarioController {

    @Autowired
    private EventoRepository eventoRepository;
    @Autowired
    private TareaRepository tareaRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired
    private EntityMapper mapper;

    @GetMapping("/estudiante/{estudianteId}")
    public Map<String, Object> getCalendarioEstudiante(@PathVariable Long estudianteId) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        
        List<Map<String, Object>> eventos = new ArrayList<>();
        List<Curso> cursos = cursoRepository.findByNivelAndGradoAndSeccion(
                estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion());

        // 1. Clases y Eventos
        for (Curso curso : cursos) {
            if (curso.getProfesor() != null) {
                List<Evento> evs = eventoRepository.findByUsuario(curso.getProfesor());
                for (Evento e : evs) {
                    if (e.getFechaInicio() == null) continue;
                    eventos.add(eventoAMap(e, curso));
                }
            }
            // Clases basadas en horario de curso
            if (curso.getDiaSemana() != null && curso.getHoraInicio() != null) {
                eventos.addAll(expandirCurso(curso));
            }
        }

        // 2. Tareas
        List<Tarea> tareas = tareaRepository.findByCursoNivelAndCursoGradoAndCursoSeccion(
                estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion());
        for (Tarea t : tareas) {
            if (t.getFechaVencimiento() == null) continue;
            eventos.add(tareaAMap(t));
        }

        Map<String, Object> res = new HashMap<>();
        res.put("estudiante", mapper.toDTO(estudiante));
        res.put("eventos", eventos);
        return res;
    }

    private Map<String, Object> eventoAMap(Evento e, Curso c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", e.getId());
        m.put("titulo", TextUtils.limpiarTexto(e.getTitulo()));
        m.put("tipo", e.getTipo());
        m.put("color", c != null ? c.getColor() : (e.getColor() != null ? e.getColor() : "blue"));
        m.put("fechaInicio", e.getFechaInicio().toString());
        m.put("curso", c != null ? TextUtils.limpiarTexto(c.getNombre()) : "");
        return m;
    }

    private Map<String, Object> tareaAMap(Tarea t) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", "t-" + t.getId());
        m.put("titulo", TextUtils.limpiarTexto(t.getTitulo()));
        m.put("tipo", "TAREA");
        m.put("color", t.getCurso() != null ? t.getCurso().getColor() : "yellow");
        m.put("fechaInicio", t.getFechaVencimiento().toString());
        m.put("curso", t.getCurso() != null ? TextUtils.limpiarTexto(t.getCurso().getNombre()) : "");
        return m;
    }

    private List<Map<String, Object>> expandirCurso(Curso c) {
        List<Map<String, Object>> evs = new ArrayList<>();
        LocalDate fecha = LocalDate.of(2026, 3, 16); // Inicio estimado
        LocalDate fin = LocalDate.of(2026, 12, 20);
        
        while (fecha.getDayOfWeek().getValue() != c.getDiaSemana()) fecha = fecha.plusDays(1);
        
        while (!fecha.isAfter(fin)) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", "c-" + c.getId() + "-" + fecha);
            m.put("titulo", TextUtils.limpiarTexto(c.getNombre()));
            m.put("tipo", "CLASE");
            m.put("color", c.getColor());
            m.put("fechaInicio", fecha.toString());
            m.put("hora", c.getHoraInicio());
            evs.add(m);
            fecha = fecha.plusWeeks(1);
        }
        return evs;
    }
}
