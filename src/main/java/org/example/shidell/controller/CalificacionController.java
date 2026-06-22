package org.example.shidell.controller;

import org.example.shidell.model.entity.Calificacion;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.dto.CalificacionDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.repository.CalificacionRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.util.TextUtils;
import org.example.shidell.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/calificaciones")
@CrossOrigin(origins = "*")
public class CalificacionController {
    @Autowired
    private CalificacionRepository calificacionRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired
    private EntityMapper mapper;
    @GetMapping("/estudiante/{id}")
    public Map<String, Object> getCalificacionesByEstudiante(@PathVariable Long id) {
        UserEntity estudiante = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        
        List<Calificacion> calificaciones = calificacionRepository.findByEstudianteId(id);
        List<Curso> cursos = cursoRepository.findByGrupoAcademico(
                estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion(), estudiante.getTurno());

        List<CalificacionDTO> evaluaciones = calificaciones.stream()
                .sorted(Comparator.comparing((Calificacion c) -> c.getFecha() == null ? LocalDate.MIN : c.getFecha()).reversed())
                .map(mapper::toDTO)
                .toList();

        List<Map<String, Object>> cursosResumen = construirCursosResumen(cursos, calificaciones);
        double promedio = promedioNota20(calificaciones);
        long aprobados = cursosResumen.stream()
                .filter(c -> ((Number) c.getOrDefault("promedio", 0)).doubleValue() >= 11.0)
                .count();

        Map<String, Object> res = new HashMap<>();
        res.put("estudiante", mapper.toDTO(estudiante));
        res.put("evaluaciones", evaluaciones);
        res.put("cursos", cursosResumen);
        res.put("promedioGeneral", redondear(promedio));
        res.put("cursosTotales", cursosResumen.size());
        res.put("cursosAprobados", aprobados);
        res.put("mejoraPromedio", calcularMejora(calificaciones));
        res.put("distribucion", construirDistribucion(calificaciones));
        res.put("evaluacionesTotales", evaluaciones.size());
        res.put("mensaje", construirMensaje(promedio, aprobados, cursosResumen.size()));
        return res;
    }

    @PostMapping
    public ResponseEntity<CalificacionDTO> createCalificacion(@RequestBody Calificacion datos) {
        if (datos.getEstudiante() == null || datos.getEstudiante().getId() == null
                || datos.getCurso() == null || datos.getCurso().getId() == null) {
            return ResponseEntity.badRequest().build();
        }

        UserEntity estudiante = userRepository.findById(datos.getEstudiante().getId()).orElseThrow();
        Curso curso = cursoRepository.findById(datos.getCurso().getId()).orElseThrow();

        Calificacion calificacion = new Calificacion();
        calificacion.setEstudiante(estudiante);
        calificacion.setCurso(curso);
        calificacion.setActividad(datos.getActividad());
        calificacion.setNota(datos.getNota());
        calificacion.setNotaMaxima(datos.getNotaMaxima() == null ? 20.0 : datos.getNotaMaxima());
        calificacion.setFecha(datos.getFecha() == null ? LocalDate.now() : datos.getFecha());
        
        return ResponseEntity.ok(mapper.toDTO(calificacionRepository.save(calificacion)));
    }

    private List<Map<String, Object>> construirCursosResumen(List<Curso> cursos, List<Calificacion> calificaciones) {
        Map<Long, Map<String, Object>> map = new LinkedHashMap<>();

        for (Curso curso : cursos) {
            Map<String, Object> cMap = new HashMap<>();
            cMap.put("id", curso.getId());
            cMap.put("nombre", TextUtils.limpiarTexto(curso.getNombre()));
            cMap.put("icono", curso.getIcono());
            cMap.put("color", curso.getColor());
            cMap.put("evaluaciones", 0);
            cMap.put("promedio", 0.0);
            cMap.put("estado", "Sin notas");
            map.put(curso.getId(), cMap);
        }

        for (Calificacion cal : calificaciones) {
            if (cal.getCurso() == null) continue;
            Map<String, Object> cMap = map.computeIfAbsent(cal.getCurso().getId(), id -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", cal.getCurso().getId());
                m.put("nombre", TextUtils.limpiarTexto(cal.getCurso().getNombre()));
                m.put("evaluaciones", 0);
                m.put("promedio", 0.0);
                return m;
            });
            
            List<Calificacion> notasCurso = calificaciones.stream()
                    .filter(c -> c.getCurso() != null && c.getCurso().getId().equals(cal.getCurso().getId()))
                    .toList();
            
            double promedio = promedioNota20(notasCurso);
            cMap.put("evaluaciones", notasCurso.size());
            cMap.put("promedio", redondear(promedio));
            cMap.put("estado", notasCurso.isEmpty() ? "Sin notas" : (promedio >= 11 ? "Aprobado" : "Desaprobado"));
        }

        return new ArrayList<>(map.values());
    }

    private List<Map<String, Object>> construirDistribucion(List<Calificacion> calificaciones) {
        int[] counts = new int[4]; // 18-20, 14-17, 11-13, 0-10
        for (Calificacion cal : calificaciones) {
            double n20 = nota20(cal);
            if (n20 >= 18) counts[0]++;
            else if (n20 >= 14) counts[1]++;
            else if (n20 >= 11) counts[2]++;
            else counts[3]++;
        }

        String[] labels = {"18 - 20", "14 - 17", "11 - 13", "0 - 10"};
        String[] colors = {"green", "blue", "yellow", "red"};
        List<Map<String, Object>> dist = new ArrayList<>();
        int total = calificaciones.size();
        for (int i = 0; i < 4; i++) {
            Map<String, Object> item = new HashMap<>();
            item.put("label", labels[i]);
            item.put("color", colors[i]);
            item.put("cantidad", counts[i]);
            item.put("porcentaje", total == 0 ? 0 : Math.round((double) counts[i] / total * 100.0));
            dist.add(item);
        }
        return dist;
    }

    private double promedioNota20(List<Calificacion> calificaciones) {
        return calificaciones.stream()
                .filter(c -> c.getNota() != null)
                .mapToDouble(this::nota20)
                .average()
                .orElse(0.0);
    }

    private double nota20(Calificacion cal) {
        double nota = cal.getNota() == null ? 0.0 : cal.getNota();
        double max = cal.getNotaMaxima() == null || cal.getNotaMaxima() <= 0 ? 20.0 : cal.getNotaMaxima();
        return Math.max(0.0, Math.min(20.0, nota / max * 20.0));
    }

    private double calcularMejora(List<Calificacion> calificaciones) {
        List<Calificacion> notas = calificaciones.stream()
                .filter(c -> c.getNota() != null)
                .sorted(Comparator.comparing(c -> c.getFecha() == null ? LocalDate.MIN : c.getFecha()))
                .toList();
        if (notas.size() < 2) return 0.0;
        int mitad = notas.size() / 2;
        double ant = promedioNota20(notas.subList(0, mitad));
        double act = promedioNota20(notas.subList(mitad, notas.size()));
        return redondear(act - ant);
    }

    private Map<String, Object> construirMensaje(double promedio, long aprobados, int total) {
        Map<String, Object> m = new HashMap<>();
        if (promedio >= 18) {
            m.put("titulo", "Excelente rendimiento");
            m.put("texto", "Tus calificaciones están en un nivel sobresaliente.");
        } else if (promedio >= 11) {
            m.put("titulo", "Buen avance");
            m.put("texto", "Estás aprobando, sigue así.");
        } else {
            m.put("titulo", "Necesitas refuerzo");
            m.put("texto", "Revisa tus materias pendientes.");
        }
        return m;
    }

    private double redondear(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
