package org.example.shidell.service;

import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.*;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.repository.*;
import org.example.shidell.util.FileUploadUtil;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class DocenteService {
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AsistenciaRepository asistenciaRepository;
    @Autowired
    private CalificacionRepository calificacionRepository;
    @Autowired
    private TareaRepository tareaRepository;
    @Autowired
    private EventoRepository eventoRepository;
    @Autowired
    private MaterialCursoRepository materialCursoRepository;
    @Autowired
    private NotificacionService notificacionService;
    @Autowired
    private EntityMapper mapper;
    public List<CursoDTO> obtenerCursosPorDocente(Long docenteId) {
        UserEntity docente = userRepository.findById(docenteId).orElse(null);
        if (docente == null) return List.of();
        
        List<Curso> cursosUnicos = deduplicarCursos(cursoRepository.findByProfesor(docente));
        return cursosUnicos.stream().map(mapper::toDTO).toList();
    }
    public Map<String, Object> obtenerDashboardDocente(Long docenteId) {
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        List<Curso> cursos = deduplicarCursos(cursoRepository.findByProfesor(docente));
        
        List<Map<String, Object>> cursosMap = new ArrayList<>();
        Set<Long> estudiantesUnicos = new HashSet<>();
        int totalTareas = 0;

        for (Curso curso : cursos) {
            List<UserEntity> estudiantes = obtenerEstudiantesPorCurso(curso.getId());
            estudiantes.forEach(e -> estudiantesUnicos.add(e.getId()));
            
            List<Tarea> tareasCurso = tareaRepository.findByCurso(curso);
            totalTareas += tareasCurso.size();

            Map<String, Object> item = new HashMap<>();
            item.put("curso", mapper.toDTO(curso));
            item.put("alumnos", estudiantes.size());
            item.put("tareas", tareasCurso.size());
            cursosMap.add(item);
        }

        LocalDate hoy = LocalDate.now();
        List<EventoDTO> clasesHoy = eventoRepository.findByUsuarioAndTipo(docente, "CLASE").stream()
                .filter(e -> e.getFechaInicio() != null && e.getFechaInicio().toLocalDate().equals(hoy))
                .sorted(Comparator.comparing(Evento::getFechaInicio))
                .map(mapper::toDTO)
                .toList();

        Map<String, Object> res = new HashMap<>();
        res.put("docente", mapper.toDTO(docente));
        res.put("cursos", cursosMap);
        res.put("horarioHoy", clasesHoy);
        res.put("metricas", Map.of(
            "cursos", cursosMap.size(),
            "estudiantes", estudiantesUnicos.size(),
            "clasesHoy", clasesHoy.size(),
            "tareas", totalTareas
        ));
        return res;
    }

    public List<UserEntity> obtenerEstudiantesPorCurso(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElse(null);
        if (curso == null) return List.of();
        return userRepository.findByGrupoAcademico(curso.getNivel(), curso.getGrado(), curso.getSeccion(), curso.getTurno())
                .stream().filter(u -> "ESTUDIANTE".equalsIgnoreCase(u.getRol())).toList();
    }

    public void registrarAsistencia(Long cursoId, Long estudianteId, String estado) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        LocalDate fecha = LocalDate.now();
        validarVentanaAsistencia(curso, fecha);

        UserEntity estudiante = userRepository.findById(estudianteId).orElseThrow();
        Asistencia asistencia = asistenciaRepository.findByCursoAndEstudianteAndFecha(curso, estudiante, fecha).orElseGet(Asistencia::new);
        asistencia.setCurso(curso);
        asistencia.setEstudiante(estudiante);
        asistencia.setFecha(fecha);
        asistencia.setEstado(normalizarEstadoAsistencia(estado));
        asistenciaRepository.save(asistencia);
        
        notificacionService.alertarPadrePorFalta(asistencia);
    }

    public Map<String, Object> obtenerListaAsistencia(Long cursoId, LocalDate fecha) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        List<UserEntity> estudiantes = obtenerEstudiantesPorCurso(cursoId);
        List<Asistencia> asistencias = asistenciaRepository.findByCursoAndFecha(curso, fecha);
        Map<Long, Asistencia> asistenciaMap = new HashMap<>();
        asistencias.forEach(a -> asistenciaMap.put(a.getEstudiante().getId(), a));

        List<Map<String, Object>> filas = estudiantes.stream().map(e -> {
            Asistencia a = asistenciaMap.get(e.getId());
            return Map.<String, Object>of(
                "estudianteId", e.getId(),
                "nombres", e.getNombres(),
                "apellidos", e.getApellidos(),
                "email", e.getEmail() != null ? e.getEmail() : "",
                "estado", a != null ? a.getEstado() : "PRESENTE",
                "registrado", a != null
            );
        }).toList();

        return Map.of("cursoId", curso.getId(), "cursoNombre", curso.getNombre(), "fecha", fecha.toString(), "estudiantes", filas);
    }

    public Calificacion guardarCalificacion(Long cursoId, Long estudianteId, String actividad, Double nota) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        UserEntity estudiante = userRepository.findById(estudianteId).orElseThrow();

        Calificacion c = new Calificacion();
        c.setCurso(curso);
        c.setEstudiante(estudiante);
        c.setActividad(actividad);
        c.setNota(nota);
        c.setNotaMaxima(20.0);
        c.setFecha(LocalDate.now());

        Calificacion guardada = calificacionRepository.save(c);
        notificacionService.alertarPadrePorBajaNota(guardada);
        return guardada;
    }

    public List<Calificacion> obtenerCalificacionesPorCurso(Long cursoId) {
        return calificacionRepository.findByCursoId(cursoId);
    }

    public Tarea crearTarea(Tarea tarea, MultipartFile archivo) {
        if (tarea.getEstado() == null) tarea.setEstado("Pendiente");
        String pdfUrl = FileUploadUtil.saveFile("tareas", archivo);
        if (pdfUrl != null) tarea.setPdfUrl(pdfUrl);
        return tareaRepository.save(tarea);
    }

    public List<Asistencia> guardarAsistencias(Long cursoId, LocalDate fecha, List<RegistroAsistencia> registros) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        validarVentanaAsistencia(curso, fecha);

        List<Asistencia> guardadas = new ArrayList<>();
        for (RegistroAsistencia r : registros) {
            if (r.estudianteId() == null) continue;
            UserEntity estudiante = userRepository.findById(r.estudianteId()).orElseThrow();
            Asistencia a = asistenciaRepository.findByCursoAndEstudianteAndFecha(curso, estudiante, fecha).orElseGet(Asistencia::new);
            a.setCurso(curso);
            a.setEstudiante(estudiante);
            a.setFecha(fecha);
            a.setEstado(normalizarEstadoAsistencia(r.estado()));
            Asistencia guardada = asistenciaRepository.save(a);
            guardadas.add(guardada);
            notificacionService.alertarPadrePorFalta(guardada);
        }
        return guardadas;
    }

    private void validarVentanaAsistencia(Curso curso, LocalDate fechaClase) {
        LocalDate hoy = LocalDate.now();
        if (fechaClase.isAfter(hoy)) {
            throw new RuntimeException("No puede tomar asistencia para fechas futuras.");
        }
        if (fechaClase.isBefore(hoy)) {
            throw new RuntimeException("El tiempo para registrar faltas expiró. Todos los alumnos quedaron presentes por defecto.");
        }
        
        java.time.LocalTime horaInicio = curso.getHoraInicioLocalTime();
        java.time.LocalTime horaFin = curso.getHoraFinLocalTime();
        java.time.LocalTime ahora = java.time.LocalTime.now();
        
        if (horaInicio != null && horaFin != null) {
            java.time.LocalTime inicioPermitido = horaInicio.minusMinutes(15);
            if (ahora.isBefore(inicioPermitido) || ahora.isAfter(horaFin)) {
                throw new RuntimeException("Fuera de horario. Puede tomar asistencia desde 15 min antes de iniciar hasta el fin de la clase.");
            }
        }
    }

    public List<Map<String, Object>> obtenerDiasClaseAsistencia(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        if (curso.getProfesor() == null) return List.of();
        List<Evento> clases = eventoRepository.findByUsuarioAndTipo(curso.getProfesor(), "CLASE");
        Map<String, Map<String, Object>> dias = new LinkedHashMap<>();
        for (Evento clase : clases) {
            if (!esClaseDelCurso(clase, curso) || clase.getFechaInicio() == null) continue;
            LocalDateTime inicio = clase.getFechaInicio();
            LocalDate fecha = inicio.toLocalDate();
            LocalDate finClases = LocalDate.of(fecha.getYear(), 12, 20);
            while (!fecha.isAfter(finClases)) {
                String key = fecha + "|" + inicio.toLocalTime();
                Map<String, Object> dia = new HashMap<>();
                dia.put("fecha", fecha.toString());
                dia.put("hora", inicio.toLocalTime().toString().substring(0, 5));
                dia.put("titulo", TextUtils.limpiarTexto(clase.getTitulo()));
                dia.put("registrados", asistenciaRepository.findByCursoAndFecha(curso, fecha).size());
                dia.put("totalEstudiantes", obtenerEstudiantesPorCurso(cursoId).size());
                dias.putIfAbsent(key, dia);
                fecha = fecha.plusWeeks(1);
            }
        }
        return dias.values().stream().sorted(Comparator.comparing((Map<String, Object> d) -> String.valueOf(d.get("fecha"))).thenComparing(d -> String.valueOf(d.get("hora")))).toList();
    }

    public MaterialCurso crearMaterial(Long docenteId, Long cursoId, String titulo, String descripcion, MultipartFile archivo) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();

        MaterialCurso m = new MaterialCurso();
        m.setCurso(curso);
        m.setDocente(docente);
        m.setTitulo(titulo);
        m.setDescripcion(descripcion != null ? descripcion : "");
        m.setFechaPublicacion(LocalDateTime.now());

        String archivoUrl = FileUploadUtil.saveFile("materiales", archivo);
        if (archivoUrl != null) {
            m.setArchivoUrl(archivoUrl);
            m.setArchivoNombre(archivo.getOriginalFilename());
        }

        return materialCursoRepository.save(m);
    }

    private List<Curso> deduplicarCursos(List<Curso> cursos) {
        LinkedHashMap<String, Curso> unicos = new LinkedHashMap<>();
        for (Curso c : cursos) {
            String key = String.format("%s-%s-%s-%s-%s", 
                c.getNombre(), c.getNivel(), c.getGrado(), c.getSeccion(), c.getTurno()
            ).toLowerCase();
            unicos.putIfAbsent(key, c);
        }
        return new ArrayList<>(unicos.values());
    }

    private boolean esClaseDelCurso(Evento clase, Curso curso) {
        String titulo = TextUtils.normalizar(clase.getTitulo());
        String nombreCurso = TextUtils.normalizar(curso.getNombre());
        if (!titulo.isBlank() && !nombreCurso.isBlank() && (titulo.contains(nombreCurso) || nombreCurso.contains(titulo))) return true;
        return clase.getColor() != null && curso.getColor() != null && Objects.equals(clase.getColor(), curso.getColor());
    }

    private String normalizarEstadoAsistencia(String estado) {
        if (estado == null) return "PRESENTE";
        String val = estado.trim().toUpperCase();
        return List.of("PRESENTE", "AUSENTE", "TARDE", "JUSTIFICADO").contains(val) ? val : "PRESENTE";
    }

    public List<Tarea> obtenerTareasPorCurso(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        return tareaRepository.findByCurso(curso);
    }

    public List<MaterialCurso> obtenerMaterialesPorCurso(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        return materialCursoRepository.findByCursoOrderByFechaPublicacionDesc(curso);
    }

    public boolean eliminarTarea(Long id) {
        if (tareaRepository.existsById(id)) {
            tareaRepository.deleteById(id);
            return true;
        }
        return false;
    }

    public List<Evento> obtenerEventosPorDocente(Long docenteId) {
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        return eventoRepository.findByUsuario(docente);
    }

    public List<Evento> obtenerEventosPorDocenteYTipo(Long docenteId, String tipo) {
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        return eventoRepository.findByUsuarioAndTipo(docente, tipo);
    }

    public Evento guardarEvento(Evento evento) {
        return eventoRepository.save(evento);
    }
}
