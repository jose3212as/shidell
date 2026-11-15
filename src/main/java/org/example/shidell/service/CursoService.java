package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.exception.ForbiddenException;
import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.CursoDTO;
import org.example.shidell.model.dto.TareaDTO;
import org.example.shidell.model.entity.*;
import org.example.shidell.repository.*;
import org.example.shidell.util.AcademicCalendarUtil;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.CourseProgressHelper;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Lógica de negocio de cursos, malla horaria semanal, progreso y foros por semana.
 */
@Service
public class CursoService {

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
    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;
    @Autowired
    private EntregaRepository entregaRepository;
    @Autowired(required = false)
    private NotificacionService notificacionService;
    @Autowired
    private EntityMapper mapper;

    public List<CursoDTO> getAllCursos() {
        return cursoRepository.findAll().stream()
                .filter(c -> !"ARCHIVADO".equalsIgnoreCase(c.getTurno()))
                .map(mapper::toDTO)
                .toList();
    }

    public CursoDTO getCursoById(Long id) {
        Curso c = cursoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        return mapper.toDTO(c);
    }

    public Map<String, Object> getCursoDetalleById(Long id) {
        Curso c = cursoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));
        return construirDetalleCurso(c);
    }

    public List<CursoDTO> getCursosBySeccion(String nivel, String grado, String seccion, String turno) {
        return AcademicGroupHelper.preferActiveCourses(
                        cursoRepository.findByGrupoAcademico(nivel, grado, seccion, turno))
                .stream()
                .map(mapper::toDTO)
                .toList();
    }

    public Map<String, Object> getCursosDetalleEstudiante(Long estudianteId) {
        return getCursosDetalleEstudiante(estudianteId, null);
    }

    public Map<String, Object> getCursosDetalleEstudiante(Long estudianteId, UserEntity authUser) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        if (authUser != null) {
            AccessControlHelper.requireStudentAccess(
                    authUser,
                    estudiante,
                    cursoRepository,
                    matriculaRepository,
                    "No tienes permiso para ver los cursos de este estudiante."
            );
        }

        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);
        List<Curso> cursos = resolverCursosEstudiante(grupo);

        List<Tarea> tareasSeccion = grupo.isComplete()
                ? tareaRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno())
                : tareaRepository.findAll();

        Set<Long> tareasEntregadasIds = new HashSet<>();
        for (Entrega ent : entregaRepository.findByEstudiante(estudiante)) {
            if (ent.getTarea() != null && ent.getTarea().getId() != null) {
                tareasEntregadasIds.add(ent.getTarea().getId());
            }
        }

        List<Map<String, Object>> detalles = consolidarCursosDetalle(
                estudiante.getId(), cursos, tareasSeccion, tareasEntregadasIds);
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

    public List<Map<String, Object>> getForoSemana(Long cursoId, Integer semana) {
        Curso curso = cursoRepository.findById(cursoId).orElse(null);
        if (curso == null) return List.of();
        List<Long> ids = idsMismaMateria(curso, cursoId);
        return foroSemanaMensajeRepository.findByCursoIdInAndSemanaOrderByFechaAsc(ids, semana).stream()
                .map(mapper::toDTO)
                .toList();
    }

    public Map<String, Object> crearMensajeForo(Long cursoId, Integer semana, Map<String, Object> body) {
        return crearMensajeForo(cursoId, semana, body, null);
    }

    public Map<String, Object> crearMensajeForo(Long cursoId, Integer semana, Map<String, Object> body, UserEntity authUser) {
        if (semana == null || semana < 1 || semana > AcademicCalendarUtil.TOTAL_SEMANAS) {
            throw new BadRequestException("La semana debe estar entre 1 y " + AcademicCalendarUtil.TOTAL_SEMANAS + ".");
        }
        String contenido = TextUtils.limpiarTexto(String.valueOf(body != null ? body.getOrDefault("contenido", "") : ""));
        if (contenido.isBlank()) {
            throw new BadRequestException("El mensaje del foro no puede estar vacío.");
        }

        Curso curso = cursoRepository.findById(cursoId)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado"));

        if (authUser != null) {
            String rol = AccessControlHelper.normalizedRole(authUser);
            if ("ESTUDIANTE".equals(rol)) {
                if (!AccessControlHelper.sameAcademicGroup(authUser, curso, matriculaRepository)) {
                    throw new ForbiddenException("No perteneces a este curso para publicar en su foro.");
                }
            } else if ("DOCENTE".equals(rol)) {
                AccessControlHelper.requireCourseOwnerOrAdmin(authUser, curso);
            } else if (!AccessControlHelper.isAdmin(authUser)) {
                throw new ForbiddenException("No tienes permiso para participar en este foro.");
            }
        }

        ForoSemanaMensaje mensaje = new ForoSemanaMensaje();
        mensaje.setCurso(curso);
        mensaje.setSemana(semana);
        if (authUser != null) {
            mensaje.setAutorId(authUser.getId());
            String nombreCompleto = TextUtils.limpiarTexto(
                    (authUser.getNombres() != null ? authUser.getNombres() : "") + " "
                            + (authUser.getApellidos() != null ? authUser.getApellidos() : "")).trim();
            mensaje.setAutorNombre(nombreCompleto.isBlank() ? "Usuario" : nombreCompleto);
        } else {
            mensaje.setAutorId(body != null && body.get("autorId") instanceof Number n ? n.longValue() : null);
            mensaje.setAutorNombre(TextUtils.limpiarTexto(String.valueOf(body != null ? body.getOrDefault("autorNombre", "Docente") : "Docente")));
        }
        mensaje.setContenido(contenido);
        mensaje.setFecha(LocalDateTime.now());
        ForoSemanaMensaje guardado = foroSemanaMensajeRepository.save(mensaje);

        if (notificacionService != null && curso.getProfesor() != null
                && (authUser == null || !Objects.equals(curso.getProfesor().getId(), authUser.getId()))) {
            String preview = contenido.length() > 90 ? contenido.substring(0, 87) + "..." : contenido;
            notificacionService.crearNotificacion(
                    curso.getProfesor(),
                    "Nuevo aporte en foro · " + TextUtils.limpiarTexto(curso.getNombre()) + " (Sem. " + semana + ")",
                    guardado.getAutorNombre() + ": " + preview
            );
        }
        return mapper.toDTO(guardado);
    }

    public boolean eliminarMensajeForo(Long mensajeId) {
        return eliminarMensajeForo(mensajeId, null);
    }

    public boolean eliminarMensajeForo(Long mensajeId, UserEntity authUser) {
        ForoSemanaMensaje mensaje = foroSemanaMensajeRepository.findById(mensajeId).orElse(null);
        if (mensaje == null) {
            return false;
        }
        if (authUser != null) {
            boolean esAutor = mensaje.getAutorId() != null && Objects.equals(mensaje.getAutorId(), authUser.getId());
            boolean esDocenteCurso = mensaje.getCurso() != null
                    && mensaje.getCurso().getProfesor() != null
                    && Objects.equals(mensaje.getCurso().getProfesor().getId(), authUser.getId());
            if (!AccessControlHelper.isAdmin(authUser) && !esAutor && !esDocenteCurso) {
                throw new ForbiddenException("No tienes permiso para eliminar este mensaje del foro.");
            }
        }
        foroSemanaMensajeRepository.deleteById(mensajeId);
        return true;
    }

    public List<Map<String, Object>> getResumenForos(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElse(null);
        if (curso == null) return List.of();

        List<Long> ids = idsMismaMateria(curso, cursoId);
        List<ForoSemanaMensaje> todos = foroSemanaMensajeRepository.findByCursoIdInOrderBySemanaAscFechaAsc(ids);
        Map<Integer, List<ForoSemanaMensaje>> porSemana = new LinkedHashMap<>();
        for (ForoSemanaMensaje m : todos) {
            porSemana.computeIfAbsent(m.getSemana(), k -> new ArrayList<>()).add(m);
        }

        List<Map<String, Object>> resumen = new ArrayList<>();
        for (Map.Entry<Integer, List<ForoSemanaMensaje>> entry : porSemana.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("semana", entry.getKey());
            item.put("totalMensajes", entry.getValue().size());
            item.put("primerMensaje", mapper.toDTO(entry.getValue().get(0)));
            item.put("ultimoMensaje", mapper.toDTO(entry.getValue().get(entry.getValue().size() - 1)));
            resumen.add(item);
        }
        return resumen;
    }

    private List<Curso> resolverCursosEstudiante(AcademicGroupHelper.AcademicGroup grupo) {
        List<Curso> cursos = grupo.isComplete()
                ? AcademicGroupHelper.preferActiveCourses(
                        cursoRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno()))
                : new ArrayList<>();

        if (cursos.isEmpty() && grupo.aula() != null) {
            cursos = AcademicGroupHelper.preferActiveCourses(cursoRepository.findByAula(grupo.aula()));
        }
        if (cursos.isEmpty()) {
            cursos = cursoRepository.findAll().stream()
                    .filter(c -> !"ARCHIVADO".equalsIgnoreCase(c.getTurno()))
                    .toList();
        }
        return cursos;
    }

    private List<Map<String, Object>> consolidarCursosDetalle(
            Long estudianteId, List<Curso> cursos, List<Tarea> tareasSeccion, Set<Long> tareasEntregadasIds) {
        Map<String, List<Curso>> cursosPorMateria = new LinkedHashMap<>();
        for (Curso curso : cursos) {
            String key = TextUtils.normalizar(curso.getNombre());
            cursosPorMateria.computeIfAbsent(key, k -> new ArrayList<>()).add(curso);
        }

        Map<Long, List<ForoSemanaMensaje>> forosPorCursoId =
                CourseProgressHelper.cargarForosPorCursoId(cursos, foroSemanaMensajeRepository);
        LocalDate hoy = LocalDate.now();
        List<Map<String, Object>> resultado = new ArrayList<>(cursosPorMateria.size());

        for (Map.Entry<String, List<Curso>> entry : cursosPorMateria.entrySet()) {
            String key = entry.getKey();
            List<Curso> grupoCursos = entry.getValue();
            Curso cursoBase = grupoCursos.stream()
                    .filter(c -> c.getProfesor() != null)
                    .findFirst()
                    .orElse(grupoCursos.get(0));

            Map<String, Object> detalle = construirDetalleCurso(cursoBase);
            int totalSemanas = ((Number) detalle.getOrDefault("totalClases", AcademicCalendarUtil.TOTAL_SEMANAS)).intValue();
            CourseProgressHelper.WeeklyProgressSummary summary = CourseProgressHelper.calcularProgresoMateria(
                    estudianteId, key, grupoCursos, tareasSeccion, tareasEntregadasIds, forosPorCursoId, totalSemanas, hoy);

            detalle.put("semanasTotales", summary.totalSemanas());
            detalle.put("semanasConActividades", summary.semanasConActividades());
            detalle.put("semanasCompletadas", summary.semanasCompletadas());
            detalle.put("tareasTotalesCurso", summary.tareasTotales());
            detalle.put("tareasCompletadasCurso", summary.tareasCompletadas());
            detalle.put("forosAbiertosCurso", summary.forosAbiertos());
            detalle.put("forosParticipadosCurso", summary.forosParticipados());
            detalle.put("progresoClases", summary.porcentajeAvance());
            resultado.add(detalle);
        }
        return resultado;
    }

    private List<Curso> cursosMismaMateria(Curso curso, boolean excluirArchivados) {
        if (curso.getAula() == null) {
            return List.of(curso);
        }
        String clave = TextUtils.normalizar(curso.getNombre());
        return cursoRepository.findByAula(curso.getAula()).stream()
                .filter(c -> !excluirArchivados || !"ARCHIVADO".equalsIgnoreCase(c.getTurno()))
                .filter(c -> TextUtils.normalizar(c.getNombre()).equalsIgnoreCase(clave))
                .toList();
    }

    private List<Long> idsMismaMateria(Curso curso, Long fallbackId) {
        List<Long> ids = cursosMismaMateria(curso, false).stream().map(Curso::getId).toList();
        return ids.isEmpty() ? List.of(fallbackId) : ids;
    }

    private Map<String, Object> construirDetalleCurso(Curso curso) {
        List<Map<String, Object>> clases = construirClasesCurso(curso);
        List<Curso> cursosMismaMateria = cursosMismaMateria(curso, false);

        List<Tarea> todasTareas = new ArrayList<>();
        for (Curso cm : cursosMismaMateria) {
            todasTareas.addAll(tareaRepository.findByCurso(cm));
        }
        if (todasTareas.isEmpty()) {
            todasTareas.addAll(tareaRepository.findByCurso(curso));
        }
        List<TareaDTO> tareas = todasTareas.stream().distinct().map(mapper::toDTO).toList();

        long realizadas = clases.stream().filter(c -> "REALIZADA".equals(c.get("estado"))).count();
        int progreso = clases.isEmpty() ? 0 : (int) Math.round((double) realizadas / clases.size() * 100.0);

        Map<String, Object> detalle = new HashMap<>();
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
        detalle.put("semanaActual", AcademicCalendarUtil.semanaActualLectiva(hoy));
        detalle.put("proximaClase", calcularProximaClase(curso, clases, hoy));
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

    private Map<String, Object> calcularProximaClase(Curso curso, List<Map<String, Object>> clases, LocalDate hoy) {
        List<Curso> sesionesHermanas = cursosMismaMateria(curso, true);
        List<Map<String, Object>> todasClasesFuturas = new ArrayList<>();
        for (Curso s : sesionesHermanas) {
            for (Map<String, Object> c : construirClasesCurso(s)) {
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

        if (!todasClasesFuturas.isEmpty()) return todasClasesFuturas.get(0);
        return clases.isEmpty() ? null : clases.get(clases.size() - 1);
    }

    private String buscarProfesorParaCurso(Curso curso) {
        if (curso.getAula() != null) {
            for (Curso h : cursosMismaMateria(curso, false)) {
                if (h.getProfesor() != null) {
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
                int indice = AcademicCalendarUtil.indiceSemanaLectiva(p.getFechaInicio().toLocalDate());
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
        List<LocalDate> iniciosBloques = AcademicCalendarUtil.iniciosBloquesLectivos(hoy.getYear());

        int diaSemana = (curso.getDiaSemana() != null && curso.getDiaSemana() >= 1 && curso.getDiaSemana() <= 7)
                ? curso.getDiaSemana() : 1;
        String hora = (curso.getHoraInicio() != null && !curso.getHoraInicio().isBlank())
                ? curso.getHoraInicio() : "08:00";

        for (int b = 0; b < iniciosBloques.size(); b++) {
            LocalDate inicioBloque = iniciosBloques.get(b);
            for (int s = 0; s < 9; s++) {
                int semana = b * 9 + s + 1;
                LocalDate fechaInicioSemana = inicioBloque.plusWeeks(s);
                LocalDate fechaFinSemana = fechaInicioSemana.plusDays(6);
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
