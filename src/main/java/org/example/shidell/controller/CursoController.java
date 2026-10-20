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
    private MatriculaRepository matriculaRepository;

    @Autowired
    private EntregaRepository entregaRepository;

    @Autowired
    private EntityMapper mapper;

    @GetMapping
    public List<CursoDTO> getAllCursos() {
        return cursoRepository.findAll().stream()
                .filter(c -> !"ARCHIVADO".equalsIgnoreCase(c.getTurno()))
                .map(mapper::toDTO).toList();
    }

    @GetMapping("/{id}")
    public CursoDTO getCursoById(@PathVariable Long id) {
        Curso c = cursoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        return mapper.toDTO(c);
    }

    @GetMapping("/{id}/detalle")
    public Map<String, Object> getCursoDetalleById(@PathVariable Long id) {
        Curso c = cursoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        return construirDetalleCurso(c);
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
        
        String nivel = estudiante.getNivel();
        String grado = estudiante.getGrado();
        String seccion = estudiante.getSeccion();
        String turno = estudiante.getTurno();

        org.example.shidell.model.entity.Matricula m = matriculaRepository.findByEstudianteAndAnioEscolar(estudiante, 2026).orElse(null);
        if (m == null) {
            List<org.example.shidell.model.entity.Matricula> list = matriculaRepository.findByEstudiante(estudiante);
            if (!list.isEmpty()) m = list.get(0);
        }

        if (m != null && m.getAula() != null) {
            nivel = m.getAula().getNivel();
            grado = m.getAula().getGrado();
            seccion = m.getAula().getSeccion();
            turno = m.getAula().getTurno();
            estudiante.setNivel(nivel);
            estudiante.setGrado(grado);
            estudiante.setSeccion(seccion);
            estudiante.setTurno(turno);
        }

        List<Curso> cursos = (nivel != null && grado != null && seccion != null)
                ? cursoRepository.findByGrupoAcademico(nivel, grado, seccion, turno)
                : new ArrayList<>();

        if (cursos.isEmpty() && m != null && m.getAula() != null) {
            cursos = cursoRepository.findByAula(m.getAula());
        }

        if (cursos.isEmpty()) {
            cursos = cursoRepository.findAll().stream()
                    .filter(c -> !"ARCHIVADO".equalsIgnoreCase(c.getTurno()))
                    .toList();
        }

        List< org.example.shidell.model.entity.Tarea > tareasSeccion = (nivel != null && grado != null && seccion != null)
                ? tareaRepository.findByGrupoAcademico(nivel, grado, seccion, turno)
                : tareaRepository.findAll();
        List< org.example.shidell.model.entity.Entrega > entregasEstudiante = entregaRepository.findByEstudiante(estudiante);
        Set<Long> tareasEntregadasIds = new HashSet<>();
        for (org.example.shidell.model.entity.Entrega ent : entregasEstudiante) {
            if (ent.getTarea() != null && ent.getTarea().getId() != null) {
                tareasEntregadasIds.add(ent.getTarea().getId());
            }
        }

        Map<String, Map<String, Object>> cursosUnicos = new LinkedHashMap<>();

        for (Curso curso : cursos) {
            String key = TextUtils.normalizar(curso.getNombre());
            Map<String, Object> detalle = construirDetalleCurso(curso);

            List<Long> idsGrupo = cursos.stream()
                    .filter(c -> TextUtils.normalizar(c.getNombre()).equals(key))
                    .map(Curso::getId)
                    .toList();

            long totalTareasCurso = tareasSeccion.stream()
                    .filter(t -> t.getCurso() != null && (idsGrupo.contains(t.getCurso().getId()) || TextUtils.normalizar(t.getCurso().getNombre()).equals(key)))
                    .count();
            long completadasCurso = tareasSeccion.stream()
                    .filter(t -> t.getCurso() != null && (idsGrupo.contains(t.getCurso().getId()) || TextUtils.normalizar(t.getCurso().getNombre()).equals(key)))
                    .filter(t -> tareasEntregadasIds.contains(t.getId()))
                    .count();
            int progresoReal = totalTareasCurso > 0 ? (int) Math.round((double) completadasCurso / totalTareasCurso * 100.0) : 0;

            detalle.put("tareasTotalesCurso", totalTareasCurso);
            detalle.put("tareasCompletadasCurso", completadasCurso);
            detalle.put("progresoClases", progresoReal);

            if (!cursosUnicos.containsKey(key)) {
                cursosUnicos.put(key, detalle);
                continue;
            }

            Map<String, Object> existente = cursosUnicos.get(key);
            if ("Profesor sin asignar".equals(existente.get("profesor")) && !"Profesor sin asignar".equals(detalle.get("profesor"))) {
                existente.put("profesor", detalle.get("profesor"));
            }

            int actual = ((Number) existente.getOrDefault("progresoClases", 0)).intValue();
            int siguiente = ((Number) detalle.getOrDefault("progresoClases", 0)).intValue();
            if (siguiente > actual) {
                if ("Profesor sin asignar".equals(detalle.get("profesor")) && !"Profesor sin asignar".equals(existente.get("profesor"))) {
                    detalle.put("profesor", existente.get("profesor"));
                }
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
            String n = curso.getProfesor().getNombres() != null ? curso.getProfesor().getNombres() : "";
            String a = curso.getProfesor().getApellidos() != null ? curso.getProfesor().getApellidos() : "";
            String prof = (n + " " + a).trim();
            if (prof.isBlank()) prof = curso.getProfesor().getEmail() != null ? curso.getProfesor().getEmail() : "Docente Asignado";
            detalle.put("profesor", TextUtils.limpiarTexto(prof));
            detalle.put("profesorNombres", TextUtils.limpiarTexto(n));
            detalle.put("profesorApellidos", TextUtils.limpiarTexto(a));
            detalle.put("docenteId", curso.getProfesor().getId());
            detalle.put("docenteEmail", curso.getProfesor().getEmail());
            detalle.put("docenteFoto", curso.getProfesor().getFotoPerfil());
            detalle.put("docente", mapper.toDTO(curso.getProfesor()));
        } else {
            String prof = buscarProfesorParaCurso(curso);
            detalle.put("profesor", prof);
            detalle.put("profesorNombres", prof);
            detalle.put("profesorApellidos", "");
        }

        LocalDate hoy = LocalDate.now();
        int indiceSemana = indiceSemanaLectiva(hoy);
        int semanaActual = indiceSemana >= 0 ? (indiceSemana + 1) : 1;
        if (semanaActual > 36) semanaActual = 36;
        detalle.put("semanaActual", semanaActual);

        List<Curso> sesionesHermanas = curso.getAula() != null
                ? cursoRepository.findByAula(curso.getAula()).stream()
                    .filter(c -> !"ARCHIVADO".equalsIgnoreCase(c.getTurno()))
                    .filter(c -> TextUtils.normalizar(c.getNombre()).equalsIgnoreCase(TextUtils.normalizar(curso.getNombre())))
                    .toList()
                : List.of(curso);

        Map<String, Object> proxima = null;
        List<Map<String, Object>> todasClasesFuturas = new ArrayList<>();
        for (Curso s : sesionesHermanas) {
            List<Map<String, Object>> cl = construirClasesCurso(s);
            for (Map<String, Object> c : cl) {
                LocalDate f = LocalDate.parse((String) c.get("fecha"));
                if (!f.isBefore(hoy)) {
                    todasClasesFuturas.add(c);
                }
            }
        }
        todasClasesFuturas.sort((c1, c2) -> {
            int cmp = String.valueOf(c1.get("fecha")).compareTo(String.valueOf(c2.get("fecha")));
            if (cmp != 0) return cmp;
            return String.valueOf(c1.getOrDefault("hora", "00:00")).compareTo(String.valueOf(c2.getOrDefault("hora", "00:00")));
        });

        if (!todasClasesFuturas.isEmpty()) {
            proxima = todasClasesFuturas.get(0);
        } else if (!clases.isEmpty()) {
            proxima = clases.get(clases.size() - 1);
        }
        detalle.put("proximaClase", proxima);

        detalle.put("diaSemana", curso.getDiaSemana() != null ? curso.getDiaSemana() : 1);
        detalle.put("horaInicio", curso.getHoraInicio() != null ? curso.getHoraInicio() : "08:00");
        detalle.put("horaFin", curso.getHoraFin() != null ? curso.getHoraFin() : "09:30");
        detalle.put("totalClases", clases.size());
        detalle.put("clasesRealizadas", realizadas);
        detalle.put("progresoClases", progreso);
        detalle.put("clases", clases);
        detalle.put("tareas", tareas);
        detalle.put("materiales", materialCursoRepository.findByCursoOrderByFechaPublicacionDesc(curso).stream().map(mapper::toDTO).toList());
        detalle.put("examenes", construirExamenesCurso(curso));
        return detalle;
    }

    private String buscarProfesorParaCurso(Curso curso) {
        if (curso.getAula() != null) {
            List<Curso> hermanos = cursoRepository.findByAula(curso.getAula());
            for (Curso h : hermanos) {
                if (h.getProfesor() != null && TextUtils.normalizar(h.getNombre()).equalsIgnoreCase(TextUtils.normalizar(curso.getNombre()))) {
                    String n = h.getProfesor().getNombres() != null ? h.getProfesor().getNombres() : "";
                    String a = h.getProfesor().getApellidos() != null ? h.getProfesor().getApellidos() : "";
                    String p = (n + " " + a).trim();
                    if (!p.isBlank()) return TextUtils.limpiarTexto(p);
                }
            }
        }
        return "Docente Asignado";
    }

    private List<Map<String, Object>> construirClasesCurso(Curso curso) {
        LocalDate hoy = LocalDate.now();
        List<Map<String, Object>> clases = construirSemanasLectivasBase(curso, hoy);

        if (curso.getProfesor() != null) {
            List<Evento> plantillas = eventoRepository.findByUsuarioAndTipo(curso.getProfesor(), "CLASE").stream()
                    .filter(e -> esEventoDelCurso(e, curso))
                    .filter(e -> e.getFechaInicio() != null)
                    .toList();

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
        }
        return clases;
    }

    private List<Map<String, Object>> construirSemanasLectivasBase(Curso curso, LocalDate hoy) {
        List<Map<String, Object>> clases = new ArrayList<>();
        int anio = hoy.getYear();
        List<LocalDate> iniciosBloques = List.of(
                LocalDate.of(anio, 3, 16),
                LocalDate.of(anio, 5, 25),
                LocalDate.of(anio, 8, 10),
                LocalDate.of(anio, 10, 19)
        );

        int diaSemana = (curso.getDiaSemana() != null && curso.getDiaSemana() >= 1 && curso.getDiaSemana() <= 7)
                ? curso.getDiaSemana() : 1;
        String hora = (curso.getHoraInicio() != null && !curso.getHoraInicio().isBlank())
                ? curso.getHoraInicio() : "08:00";

        for (int b = 0; b < 4; b++) {
            LocalDate inicioBloque = iniciosBloques.get(b);
            for (int s = 0; s < 9; s++) {
                int semana = b * 9 + s + 1;
                LocalDate fechaInicioSemana = inicioBloque.plusWeeks(s);
                LocalDate fechaFinSemana = fechaInicioSemana.plusDays(4);
                LocalDate fechaClase = fechaInicioSemana.plusDays(diaSemana - 1);
                
                Map<String, Object> c = new HashMap<>();
                c.put("semana", semana);
                c.put("bloque", b + 1);
                c.put("fecha", fechaClase.toString());
                c.put("fechaInicio", fechaInicioSemana.toString());
                c.put("fechaFin", fechaFinSemana.toString());
                c.put("hora", hora);
                c.put("estado", fechaClase.isBefore(hoy) ? "REALIZADA" : "PROGRAMADA");
                c.put("publicadoPorDocente", false);
                clases.add(c);
            }
        }
        return clases;
    }

    private int indiceSemanaLectiva(LocalDate fecha) {
        int anio = fecha.getYear();
        List<LocalDate> iniciosBloques = List.of(
                LocalDate.of(anio, 3, 16),
                LocalDate.of(anio, 5, 25),
                LocalDate.of(anio, 8, 10),
                LocalDate.of(anio, 10, 19)
        );

        for (int b = 0; b < 4; b++) {
            LocalDate inicio = iniciosBloques.get(b);
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
