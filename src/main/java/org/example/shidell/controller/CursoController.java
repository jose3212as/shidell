package org.example.shidell.controller;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Evento;
import org.example.shidell.model.entity.ForoSemanaMensaje;
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
@RequestMapping("/api/cursos")
@CrossOrigin(origins = "*")
public class CursoController {

    private static final List<LocalDate> INICIOS_BLOQUES_LECTIVOS_2026 = List.of(
            LocalDate.of(2026, 3, 16),
            LocalDate.of(2026, 5, 25),
            LocalDate.of(2026, 8, 10),
            LocalDate.of(2026, 10, 19)
    );

    @Autowired
    private CursoRepository cursoRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EventoRepository eventoRepository;

    @Autowired
    private TareaRepository tareaRepository;

    @Autowired
    private MaterialCursoRepository materialCursoRepository;

    @Autowired
    private ForoSemanaMensajeRepository foroSemanaMensajeRepository;

    @Autowired
    private EntityMapper mapper;

    @GetMapping
    public List<CursoDTO> getAllCursos() {
        return cursoRepository.findAll().stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/seccion")
    public List<CursoDTO> getCursosBySeccion(
            @RequestParam String nivel,
            @RequestParam String grado,
            @RequestParam String seccion,
            @RequestParam(required = false) String turno) {
        return cursoRepository.findByGrupoAcademico(nivel, grado, seccion, turno).stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/estudiante/{estudianteId}/detalle")
    public Map<String, Object> getCursosDetalleEstudiante(@PathVariable Long estudianteId) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        
        List<Curso> cursos = cursoRepository.findByGrupoAcademico(
                estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion(), estudiante.getTurno());

        Map<String, Map<String, Object>> cursosUnicos = new LinkedHashMap<>();

        for (Curso curso : cursos) {
            String key = TextUtils.claveCurso(curso.getNombre(), curso.getId());
            Map<String, Object> detalle = construirDetalleCurso(curso);

            if (!cursosUnicos.containsKey(key)) {
                cursosUnicos.put(key, detalle);
                continue;
            }

            int actual = ((Number) cursosUnicos.get(key).getOrDefault("progresoClases", 0)).intValue();
            int siguiente = ((Number) detalle.getOrDefault("progresoClases", 0)).intValue();
            if (siguiente > actual) {
                cursosUnicos.put(key, detalle);
            }
        }

        List<Map<String, Object>> detalles = new ArrayList<>(cursosUnicos.values());
        int total = detalles.size();
        long completados = detalles.stream()
                .filter(c -> ((Number) c.getOrDefault("progresoClases", 0)).intValue() >= 100)
                .count();
        int promedio = total == 0 ? 0 : (int) Math.round(detalles.stream()
                .mapToInt(c -> ((Number) c.getOrDefault("progresoClases", 0)).intValue())
                .average()
                .orElse(0));

        Map<String, Object> res = new HashMap<>();
        res.put("cursos", detalles);
        res.put("totalCursos", total);
        res.put("cursosCompletados", completados);
        res.put("progresoPromedio", promedio);
        return res;
    }

    @GetMapping("/{cursoId}/semanas/{semana}/foro")
    public List<Map<String, Object>> getForoSemana(@PathVariable Long cursoId, @PathVariable Integer semana) {
        return foroSemanaMensajeRepository.findByCursoIdAndSemanaOrderByFechaAsc(cursoId, semana).stream()
                .map(mapper::toDTO)
                .toList();
    }

    @PostMapping("/{cursoId}/semanas/{semana}/foro")
    public Map<String, Object> crearMensajeForo(
            @PathVariable Long cursoId,
            @PathVariable Integer semana,
            @RequestBody Map<String, Object> body) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        ForoSemanaMensaje mensaje = new ForoSemanaMensaje();
        mensaje.setCurso(curso);
        mensaje.setSemana(semana);
        mensaje.setAutorId(body.get("autorId") instanceof Number ? ((Number) body.get("autorId")).longValue() : null);
        mensaje.setAutorNombre(TextUtils.limpiarTexto(String.valueOf(body.getOrDefault("autorNombre", "Estudiante"))));
        mensaje.setContenido(TextUtils.limpiarTexto(String.valueOf(body.getOrDefault("contenido", ""))));
        mensaje.setFecha(LocalDateTime.now());
        return mapper.toDTO(foroSemanaMensajeRepository.save(mensaje));
    }

    private Map<String, Object> construirDetalleCurso(Curso curso) {
        List<Map<String, Object>> clases = construirClasesCurso(curso);
        List<TareaDTO> tareas = tareaRepository.findByCurso(curso).stream().map(mapper::toDTO).toList();

        long realizadas = clases.stream().filter(c -> "REALIZADA".equals(c.get("estado"))).count();
        int progreso = clases.isEmpty() ? 0 : (int) Math.round((double) realizadas / clases.size() * 100.0);

        Map<String, Object> detalle = new HashMap<>();
        // Atributos directos para el frontend (Flattened)
        detalle.put("id", curso.getId());
        detalle.put("nombre", TextUtils.limpiarTexto(curso.getNombre()));
        detalle.put("icono", curso.getIcono());
        detalle.put("color", curso.getColor());
        detalle.put("nivel", curso.getNivel());
        detalle.put("grado", curso.getGrado());
        detalle.put("seccion", curso.getSeccion());
        detalle.put("turno", curso.getTurno());
        
        if (curso.getProfesor() != null) {
            String prof = (curso.getProfesor().getNombres() + " " + curso.getProfesor().getApellidos()).trim();
            detalle.put("profesor", TextUtils.limpiarTexto(prof));
        } else {
            detalle.put("profesor", "Profesor sin asignar");
        }

        detalle.put("totalClases", clases.size());
        detalle.put("clasesRealizadas", realizadas);
        detalle.put("progresoClases", progreso);
        detalle.put("clases", clases);
        detalle.put("tareas", tareas);
        detalle.put("materiales", materialCursoRepository.findByCursoOrderByFechaPublicacionDesc(curso).stream().map(mapper::toDTO).toList());
        detalle.put("examenes", construirExamenesCurso(curso));
        return detalle;
    }

    private List<Map<String, Object>> construirClasesCurso(Curso curso) {
        if (curso.getProfesor() == null) return List.of();

        List<Evento> plantillas = eventoRepository.findByUsuarioAndTipo(curso.getProfesor(), "CLASE").stream()
                .filter(e -> esEventoDelCurso(e, curso))
                .filter(e -> e.getFechaInicio() != null)
                .toList();

        LocalDate hoy = LocalDate.now();
        List<Map<String, Object>> clases = construirSemanasLectivasBase(curso, hoy);

        for (Evento p : plantillas) {
            LocalDate fecha = p.getFechaInicio().toLocalDate();
            int indice = indiceSemanaLectiva(fecha);
            if (indice >= 0 && indice < clases.size()) {
                Map<String, Object> c = clases.get(indice);
                c.put("titulo", TextUtils.limpiarTexto(p.getTitulo()));
                c.put("hora", p.getFechaInicio().toLocalTime().toString().substring(0, 5));
                c.put("publicadoPorDocente", true);
            }
        }
        return clases;
    }

    private List<Map<String, Object>> construirSemanasLectivasBase(Curso curso, LocalDate hoy) {
        List<Map<String, Object>> clases = new ArrayList<>();
        for (int b = 0; b < 4; b++) {
            LocalDate inicioBloque = INICIOS_BLOQUES_LECTIVOS_2026.get(b);
            for (int s = 0; s < 9; s++) {
                int semana = b * 9 + s + 1;
                LocalDate fecha = inicioBloque.plusWeeks(s).plusDays((curso.getDiaSemana() != null ? curso.getDiaSemana() : 1) - 1);
                Map<String, Object> c = new HashMap<>();
                c.put("semana", semana);
                c.put("fecha", fecha.toString());
                c.put("estado", fecha.isBefore(hoy) ? "REALIZADA" : "PROGRAMADA");
                c.put("publicadoPorDocente", false);
                clases.add(c);
            }
        }
        return clases;
    }

    private int indiceSemanaLectiva(LocalDate fecha) {
        for (int b = 0; b < 4; b++) {
            LocalDate inicio = INICIOS_BLOQUES_LECTIVOS_2026.get(b);
            LocalDate fin = inicio.plusWeeks(9).minusDays(1);
            if (!fecha.isBefore(inicio) && !fecha.isAfter(fin)) {
                return b * 9 + (int) ((fecha.toEpochDay() - inicio.toEpochDay()) / 7);
            }
        }
        return -1;
    }

    private List<Map<String, Object>> construirExamenesCurso(Curso curso) {
        if (curso.getProfesor() == null) return List.of();
        LocalDate hoy = LocalDate.now();
        return eventoRepository.findByUsuarioAndTipo(curso.getProfesor(), "EXAMEN").stream()
                .filter(e -> esEventoDelCurso(e, curso))
                .filter(e -> e.getFechaInicio() != null && !e.getFechaInicio().toLocalDate().isBefore(hoy))
                .map(e -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("titulo", TextUtils.limpiarTexto(e.getTitulo()));
                    item.put("fecha", e.getFechaInicio().toLocalDate().toString());
                    return item;
                }).toList();
    }

    private boolean esEventoDelCurso(Evento e, Curso c) {
        if (e == null || c == null) return false;
        String t = TextUtils.normalizar(e.getTitulo());
        String n = TextUtils.normalizar(c.getNombre());
        return (!n.isBlank() && t.contains(n)) || (e.getColor() != null && e.getColor().equalsIgnoreCase(c.getColor()));
    }
}
