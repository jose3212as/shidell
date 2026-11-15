package org.example.shidell.service;

import org.example.shidell.exception.ResourceNotFoundException;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.model.dto.CursoDTO;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.entity.Evento;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.*;
import org.example.shidell.util.AcademicCalendarUtil;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Construye el calendario consolidado del estudiante (clases, exámenes, tareas y recordatorios).
 */
@Service
public class CalendarioService {

    private static final LocalTime CORTE_TURNO_MANANA = LocalTime.of(13, 30);
    private static final LocalTime INICIO_TURNO_TARDE = LocalTime.of(12, 30);

    private record BloqueHorario(
            Long cursoId,
            String cursoKey,
            String filterKey,
            String nombre,
            String cursoLabel,
            String aulaLabel,
            String turno,
            String color,
            String docente,
            Long profesorId,
            int diaSemana,
            LocalTime horaInicio,
            LocalTime horaFin,
            Integer alumnos
    ) {}

    private record ExamenSlot(LocalDate fecha, String cursoKey, String filterKey, LocalTime inicio, LocalTime fin) {}

    @Autowired
    private EventoRepository eventoRepository;
    @Autowired
    private TareaRepository tareaRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired(required = false)
    private MatriculaRepository matriculaRepository;
    @Autowired(required = false)
    private EntregaRepository entregaRepository;
    @Autowired
    private EntityMapper mapper;

    public Map<String, Object> getCalendarioEstudiante(Long estudianteId) {
        return getCalendarioEstudiante(estudianteId, null);
    }

    public Map<String, Object> getCalendarioEstudiante(Long estudianteId, UserEntity authUser) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        if (authUser != null) {
            AccessControlHelper.requireStudentAccess(
                    authUser,
                    estudiante,
                    cursoRepository,
                    matriculaRepository,
                    "No tienes permiso para ver el calendario de este estudiante."
            );
        }

        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolveWithDefaultTurno(estudiante, matriculaRepository);
        List<Curso> todosCursos = new ArrayList<>(cursoRepository.findByGrupoAcademico(
                grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno()));
        todosCursos.removeIf(c -> "ARCHIVADO".equalsIgnoreCase(c.getTurno()));

        List<Curso> cursosVigentes = filtrarCursosVigentes(todosCursos, grupo);
        Map<String, Curso> cursosPorKey = construirMapaCursosPorClave(cursosVigentes, todosCursos);
        List<BloqueHorario> bloquesSemanales = fusionarBloquesContiguos(cursosVigentes, false, Map.of(), Map.of());

        List<Map<String, Object>> eventos = new ArrayList<>();
        List<ExamenSlot> examenes = agregarEventosDocentes(cursosVigentes, grupo, cursosPorKey, eventos);
        int anio = LocalDate.now().getYear();
        agregarClasesProgramadas(bloquesSemanales, examenes, anio, eventos, false);
        agregarRecordatoriosPropios(estudiante, eventos);
        agregarTareas(estudiante, grupo, cursosPorKey, eventos);

        Map<String, Object> res = new HashMap<>();
        res.put("estudiante", mapper.toDTO(estudiante));
        res.put("grupo", Map.of(
                "nivel", grupo.nivel() != null ? grupo.nivel() : "",
                "grado", grupo.grado() != null ? grupo.grado() : "",
                "seccion", grupo.seccion() != null ? grupo.seccion() : "",
                "turno", grupo.turno() != null ? grupo.turno() : ""
        ));
        res.put("cursos", consolidarCursosUnicos(cursosVigentes));
        res.put("horariosBase", bloquesAMapas(bloquesSemanales));
        res.put("calendarioEscolar", construirResumenEscolar(anio, grupo.turno()));
        res.put("eventos", eventos);
        return res;
    }

    /**
     * Construye el calendario consolidado del docente autenticado (clases semanales por salón,
     * exámenes, entregas de tareas de sus cursos y eventos/recordatorios propios).
     */
    public Map<String, Object> getCalendarioDocente(Long docenteId) {
        UserEntity docente = userRepository.findById(docenteId)
                .orElseThrow(() -> new ResourceNotFoundException("Docente no encontrado"));

        List<Curso> cursosActivos = new ArrayList<>(cursoRepository.findByProfesor(docente));
        cursosActivos.removeIf(c -> "ARCHIVADO".equalsIgnoreCase(c.getTurno()));

        // Mapear cursos únicos (asignatura + aula) y colores distinguibles por salón
        LinkedHashMap<String, Curso> cursosUnicosMap = new LinkedHashMap<>();
        Set<String> coloresDistintos = new HashSet<>();
        List<Curso> cursosOrdenados = cursosActivos.stream()
                .sorted(Comparator
                        .comparing((Curso c) -> TextUtils.normalizar(c.getNombre()))
                        .thenComparing(c -> safeStr(c.getNivel()))
                        .thenComparing(c -> safeStr(c.getGrado()))
                        .thenComparing(c -> safeStr(c.getSeccion()))
                        .thenComparing(Curso::getId, Comparator.nullsLast(Long::compareTo)))
                .toList();

        for (Curso c : cursosOrdenados) {
            String fKey = teacherCourseKey(c);
            cursosUnicosMap.putIfAbsent(fKey, c);
            if (c.getColor() != null && !c.getColor().isBlank()) {
                coloresDistintos.add(c.getColor().trim().toLowerCase(Locale.ROOT));
            }
        }

        List<String> paletaDocente = List.of("purple", "blue", "green", "orange", "pink", "cyan", "yellow", "red");
        Map<String, String> colorPorCursoFiltro = new LinkedHashMap<>();
        int colorIdx = 0;
        boolean diversificarColores = coloresDistintos.size() <= 1 && cursosUnicosMap.size() > 1;
        for (Map.Entry<String, Curso> entry : cursosUnicosMap.entrySet()) {
            Curso c = entry.getValue();
            String assigned = diversificarColores
                    ? paletaDocente.get(colorIdx % paletaDocente.size())
                    : (c.getColor() != null && !c.getColor().isBlank() ? c.getColor() : paletaDocente.get(colorIdx % paletaDocente.size()));
            colorPorCursoFiltro.put(entry.getKey(), assigned);
            colorIdx++;
        }

        // Precomputar estudiantes por aula
        Map<String, Integer> alumnosPorAula = new HashMap<>();
        for (Curso c : cursosUnicosMap.values()) {
            String aKey = aulaKey(c);
            if (alumnosPorAula.containsKey(aKey)) continue;
            if (c.getNivel() == null || c.getGrado() == null || c.getSeccion() == null) {
                alumnosPorAula.put(aKey, 0);
                continue;
            }
            int cnt = (int) userRepository.findByGrupoAcademico(c.getNivel(), c.getGrado(), c.getSeccion(), c.getTurno())
                    .stream().filter(u -> "ESTUDIANTE".equalsIgnoreCase(u.getRol())).count();
            alumnosPorAula.put(aKey, cnt);
        }

        List<BloqueHorario> bloquesSemanales = fusionarBloquesContiguos(cursosActivos, true, colorPorCursoFiltro, alumnosPorAula);
        List<Map<String, Object>> eventos = new ArrayList<>();
        List<ExamenSlot> examenes = agregarEventosPropiosDocente(docente, cursosOrdenados, colorPorCursoFiltro, eventos);

        int anio = LocalDate.now().getYear();
        agregarClasesProgramadas(bloquesSemanales, examenes, anio, eventos, true);
        agregarTareasDocente(cursosActivos, colorPorCursoFiltro, alumnosPorAula, eventos);

        // Turno predominante del docente
        Set<String> turnos = new LinkedHashSet<>();
        for (Curso c : cursosUnicosMap.values()) {
            if (c.getTurno() != null && !c.getTurno().isBlank()) {
                turnos.add(TextUtils.limpiarTexto(c.getTurno()));
            }
        }
        String turnoResumen = String.join(" / ", turnos);

        List<Map<String, Object>> cursosPayload = new ArrayList<>();
        for (Map.Entry<String, Curso> entry : cursosUnicosMap.entrySet()) {
            Curso c = entry.getValue();
            String fKey = entry.getKey();
            String aulaTxt = formatAulaCorta(c);
            String nombreBase = TextUtils.limpiarTexto(c.getNombre());
            String label = aulaTxt.isBlank() ? nombreBase : nombreBase + " · " + aulaTxt;
            Map<String, Object> cm = new HashMap<>();
            cm.put("id", c.getId());
            cm.put("nombre", nombreBase);
            cm.put("label", label);
            cm.put("aula", formatAulaLarga(c));
            cm.put("nivel", safeStr(c.getNivel()));
            cm.put("grado", safeStr(c.getGrado()));
            cm.put("seccion", safeStr(c.getSeccion()));
            cm.put("turno", safeStr(c.getTurno()));
            cm.put("cursoKey", fKey);
            cm.put("color", colorPorCursoFiltro.getOrDefault(fKey, "blue"));
            cm.put("icono", c.getIcono() != null ? c.getIcono() : "ph-book-open");
            cm.put("alumnos", alumnosPorAula.getOrDefault(aulaKey(c), 0));
            cursosPayload.add(cm);
        }

        Map<String, Object> calEscolar = construirResumenEscolar(anio, turnoResumen);
        calEscolar.put("aulasCount", cursosUnicosMap.size());
        calEscolar.put("bloquesSemanaCount", bloquesSemanales.size());

        Map<String, Object> res = new HashMap<>();
        res.put("docente", mapper.toDTO(docente));
        res.put("cursos", cursosPayload);
        res.put("horariosBase", bloquesAMapas(bloquesSemanales));
        res.put("calendarioEscolar", calEscolar);
        res.put("eventos", eventos);
        return res;
    }

    public ResponseEntity<?> crearEventoDocente(Long docenteId, Map<String, String> body, UserEntity authUser) {
        UserEntity docente = userRepository.findById(docenteId)
                .orElseThrow(() -> new ResourceNotFoundException("Docente no encontrado"));
        if (!puedeGestionarDocente(authUser, docenteId)) {
            return ResponseEntity.status(403).body(Map.of("error", "No puedes modificar este calendario"));
        }

        String titulo = body.getOrDefault("titulo", "").trim();
        if (titulo.isEmpty() || titulo.length() > 120) {
            return ResponseEntity.badRequest().body(Map.of("error", "El título es obligatorio (máx. 120 caracteres)"));
        }

        String rawTipo = body.getOrDefault("tipo", "RECORDATORIO").trim().toUpperCase(Locale.ROOT);
        String tipo = Set.of("RECORDATORIO", "EXAMEN", "REUNION", "CLASE").contains(rawTipo) ? rawTipo : "RECORDATORIO";

        LocalDate fecha;
        LocalTime horaInicio;
        LocalTime horaFin;
        try {
            fecha = LocalDate.parse(body.get("fecha"));
            horaInicio = LocalTime.parse(body.getOrDefault("hora", "08:00"));
            String fin = body.get("horaFin");
            horaFin = (fin == null || fin.isBlank()) ? horaInicio.plusHours(1) : LocalTime.parse(fin);
        } catch (DateTimeParseException | NullPointerException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", "Fecha u hora inválida"));
        }
        if (!horaFin.isAfter(horaInicio)) {
            return ResponseEntity.badRequest().body(Map.of("error", "La hora de fin debe ser posterior a la de inicio"));
        }

        Curso cursoAsoc = null;
        String cursoIdStr = body.get("cursoId");
        if (cursoIdStr != null && !cursoIdStr.isBlank()) {
            try {
                Long cursoId = Long.parseLong(cursoIdStr.trim());
                cursoAsoc = cursoRepository.findById(cursoId)
                        .filter(c -> c.getProfesor() != null && docenteId.equals(c.getProfesor().getId()))
                        .orElse(null);
            } catch (NumberFormatException ignored) {}
        }

        // Mantener referencia al curso en descripción/título si el docente eligió un salón específico
        String descripcion = body.getOrDefault("descripcion", "").trim();
        if (cursoAsoc != null) {
            String tag = TextUtils.limpiarTexto(cursoAsoc.getNombre()) + " " + formatAulaCorta(cursoAsoc);
            if (!TextUtils.normalizar(titulo).contains(TextUtils.normalizar(cursoAsoc.getNombre()))) {
                titulo = titulo + " - " + tag;
                if (titulo.length() > 120) titulo = titulo.substring(0, 120);
            }
        }

        Evento e = new Evento();
        e.setTitulo(titulo);
        e.setDescripcion(descripcion.length() > 500 ? descripcion.substring(0, 500) : descripcion);
        e.setTipo(tipo);
        e.setColor(body.getOrDefault("color", "blue"));
        e.setFechaInicio(LocalDateTime.of(fecha, horaInicio));
        e.setFechaFin(LocalDateTime.of(fecha, horaFin));
        e.setUsuario(docente);
        e = eventoRepository.save(e);

        Map<String, Object> m = eventoAMap(e, cursoAsoc, cursoAsoc != null ? teacherCourseKey(cursoAsoc) : null);
        m.put("propio", true);
        if (cursoAsoc != null) {
            m.put("aula", formatAulaLarga(cursoAsoc));
            m.put("curso", TextUtils.limpiarTexto(cursoAsoc.getNombre()) + (formatAulaCorta(cursoAsoc).isBlank() ? "" : " · " + formatAulaCorta(cursoAsoc)));
        }
        return ResponseEntity.ok(m);
    }

    public ResponseEntity<?> eliminarEventoDocente(Long docenteId, Long eventoId, UserEntity authUser) {
        if (!puedeGestionarDocente(authUser, docenteId)) {
            return ResponseEntity.status(403).body(Map.of("error", "No puedes modificar este calendario"));
        }
        Evento e = eventoRepository.findById(eventoId)
                .orElseThrow(() -> new ResourceNotFoundException("Evento no encontrado"));
        if (e.getUsuario() == null || !docenteId.equals(e.getUsuario().getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Solo puedes eliminar tus propios eventos"));
        }
        eventoRepository.delete(e);
        return ResponseEntity.ok(Map.of("eliminado", true));
    }

    public ResponseEntity<?> crearRecordatorio(Long estudianteId, Map<String, String> body, UserEntity authUser) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        if (!puedeGestionar(authUser, estudiante)) {
            return ResponseEntity.status(403).body(Map.of("error", "No puedes modificar este calendario"));
        }

        String titulo = body.getOrDefault("titulo", "").trim();
        if (titulo.isEmpty() || titulo.length() > 120) {
            return ResponseEntity.badRequest().body(Map.of("error", "El título es obligatorio (máx. 120 caracteres)"));
        }
        LocalDate fecha;
        LocalTime horaInicio;
        LocalTime horaFin;
        try {
            fecha = LocalDate.parse(body.get("fecha"));
            horaInicio = LocalTime.parse(body.getOrDefault("hora", "08:00"));
            String fin = body.get("horaFin");
            horaFin = (fin == null || fin.isBlank()) ? horaInicio.plusHours(1) : LocalTime.parse(fin);
        } catch (DateTimeParseException | NullPointerException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", "Fecha u hora inválida"));
        }
        if (!horaFin.isAfter(horaInicio)) {
            return ResponseEntity.badRequest().body(Map.of("error", "La hora de fin debe ser posterior a la de inicio"));
        }

        Evento e = new Evento();
        e.setTitulo(titulo);
        String descripcion = body.getOrDefault("descripcion", "");
        e.setDescripcion(descripcion.length() > 500 ? descripcion.substring(0, 500) : descripcion);
        e.setTipo("RECORDATORIO");
        e.setColor(body.getOrDefault("color", "blue"));
        e.setFechaInicio(LocalDateTime.of(fecha, horaInicio));
        e.setFechaFin(LocalDateTime.of(fecha, horaFin));
        e.setUsuario(estudiante);
        e = eventoRepository.save(e);

        Map<String, Object> m = eventoAMap(e, null, null);
        m.put("tipo", "RECORDATORIO");
        m.put("color", e.getColor());
        m.put("propio", true);
        return ResponseEntity.ok(m);
    }

    public ResponseEntity<?> eliminarRecordatorio(Long estudianteId, Long eventoId, UserEntity authUser) {
        UserEntity estudiante = userRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        if (!puedeGestionar(authUser, estudiante)) {
            return ResponseEntity.status(403).body(Map.of("error", "No puedes modificar este calendario"));
        }
        Evento e = eventoRepository.findById(eventoId)
                .orElseThrow(() -> new ResourceNotFoundException("Recordatorio no encontrado"));
        if (e.getUsuario() == null || !estudiante.getId().equals(e.getUsuario().getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Solo puedes eliminar tus recordatorios"));
        }
        eventoRepository.delete(e);
        return ResponseEntity.ok(Map.of("eliminado", true));
    }

    /**
     * Filtra cursos huérfanos sin horario o heredados de otro turno cuando el aula ya tiene
     * programación lectiva regular de lunes a viernes acorde al turno del estudiante.
     */
    private List<Curso> filtrarCursosVigentes(List<Curso> todos, AcademicGroupHelper.AcademicGroup grupo) {
        if (todos.isEmpty()) return List.of();

        Set<String> clavesEntreSemana = new HashSet<>();
        for (Curso c : todos) {
            if (esDiaEntreSemana(c.getDiaSemana())
                    && c.getHoraInicioLocalTime() != null
                    && coincideTurno(c.getHoraInicioLocalTime(), grupo.turno())) {
                clavesEntreSemana.add(canonicalCourseKey(c));
            }
        }

        if (clavesEntreSemana.isEmpty()) {
            List<Curso> programados = todos.stream()
                    .filter(c -> c.getDiaSemana() != null && c.getHoraInicioLocalTime() != null)
                    .toList();
            return programados.isEmpty() ? todos : programados;
        }

        List<Curso> filtrados = new ArrayList<>();
        for (Curso c : todos) {
            Integer dia = c.getDiaSemana();
            LocalTime inicio = c.getHoraInicioLocalTime();
            if (dia == null || dia < 1 || dia > 7 || inicio == null) continue;
            if (!coincideTurno(inicio, grupo.turno())) continue;
            if (dia >= 6 && clavesEntreSemana.contains(canonicalCourseKey(c))) continue;
            filtrados.add(c);
        }
        return filtrados;
    }

    /**
     * Une bloques consecutivos de la misma asignatura, aula (cuando distinguirPorAula=true)
     * y docente en el mismo día (por ejemplo 13:30-14:15 + 14:15-15:00 -> 13:30-15:00).
     */
    private List<BloqueHorario> fusionarBloquesContiguos(
            List<Curso> cursosVigentes,
            boolean distinguirPorAula,
            Map<String, String> colorOverride,
            Map<String, Integer> alumnosPorAula
    ) {
        List<Curso> ordenados = cursosVigentes.stream()
                .filter(c -> c.getDiaSemana() != null && c.getHoraInicioLocalTime() != null)
                .sorted(Comparator
                        .comparing(Curso::getDiaSemana)
                        .thenComparing(c -> distinguirPorAula ? teacherCourseKey(c) : canonicalCourseKey(c))
                        .thenComparing(Curso::getHoraInicioLocalTime)
                        .thenComparing(Curso::getId, Comparator.nullsLast(Long::compareTo)))
                .toList();

        List<BloqueHorario> resultado = new ArrayList<>();
        Set<String> deduplicados = new HashSet<>();

        for (Curso c : ordenados) {
            LocalTime inicio = c.getHoraInicioLocalTime();
            LocalTime fin = c.getHoraFinLocalTime() != null && c.getHoraFinLocalTime().isAfter(inicio)
                    ? c.getHoraFinLocalTime() : inicio.plusMinutes(45);
            String cKey = canonicalCourseKey(c);
            String fKey = distinguirPorAula ? teacherCourseKey(c) : cKey;
            Long profesorId = c.getProfesor() != null ? c.getProfesor().getId() : null;

            String claveSlot = c.getDiaSemana() + "|" + inicio + "|" + fin + "|" + fKey;
            if (!deduplicados.add(claveSlot)) continue;

            if (!resultado.isEmpty()) {
                int lastIdx = resultado.size() - 1;
                BloqueHorario prev = resultado.get(lastIdx);
                if (prev.diaSemana() == c.getDiaSemana()
                        && prev.filterKey().equals(fKey)
                        && Objects.equals(prev.profesorId(), profesorId)
                        && !inicio.isBefore(prev.horaInicio())
                        && !inicio.isAfter(prev.horaFin())) {
                    LocalTime nuevoFin = fin.isAfter(prev.horaFin()) ? fin : prev.horaFin();
                    resultado.set(lastIdx, new BloqueHorario(
                            prev.cursoId(), prev.cursoKey(), prev.filterKey(), prev.nombre(),
                            prev.cursoLabel(), prev.aulaLabel(), prev.turno(), prev.color(),
                            prev.docente(), prev.profesorId(), prev.diaSemana(), prev.horaInicio(),
                            nuevoFin, prev.alumnos()
                    ));
                    continue;
                }
            }

            String nombre = TextUtils.limpiarTexto(c.getNombre());
            String aulaCorta = distinguirPorAula ? formatAulaCorta(c) : "";
            String cursoLabel = aulaCorta.isBlank() ? nombre : nombre + " · " + aulaCorta;
            String aulaLarga = distinguirPorAula ? formatAulaLarga(c) : "";
            String resolvedColor = (colorOverride != null && colorOverride.containsKey(fKey))
                    ? colorOverride.get(fKey)
                    : (c.getColor() != null ? c.getColor() : "blue");
            Integer alumnos = distinguirPorAula && alumnosPorAula != null
                    ? alumnosPorAula.getOrDefault(aulaKey(c), 0)
                    : null;

            resultado.add(new BloqueHorario(
                    c.getId(),
                    cKey,
                    fKey,
                    nombre,
                    cursoLabel,
                    aulaLarga,
                    safeStr(c.getTurno()),
                    resolvedColor,
                    nombreDocente(c),
                    profesorId,
                    c.getDiaSemana(),
                    inicio,
                    fin,
                    alumnos
            ));
        }

        resultado.sort(Comparator
                .comparingInt(BloqueHorario::diaSemana)
                .thenComparing(BloqueHorario::horaInicio)
                .thenComparing(BloqueHorario::cursoLabel));
        return resultado;
    }

    private List<ExamenSlot> agregarEventosDocentes(
            List<Curso> cursosVigentes,
            AcademicGroupHelper.AcademicGroup grupo,
            Map<String, Curso> cursosPorKey,
            List<Map<String, Object>> eventos
    ) {
        Map<Long, List<Curso>> cursosPorProfesor = new LinkedHashMap<>();
        for (Curso c : cursosVigentes) {
            if (c.getProfesor() == null || c.getProfesor().getId() == null) continue;
            cursosPorProfesor.computeIfAbsent(c.getProfesor().getId(), k -> new ArrayList<>()).add(c);
        }
        cursosPorProfesor.values().forEach(lista -> lista.sort((a, b) -> Integer.compare(
                TextUtils.normalizar(b.getNombre()).length(),
                TextUtils.normalizar(a.getNombre()).length())));

        Set<Long> eventosAgregados = new HashSet<>();
        Set<String> claveDedup = new HashSet<>();
        List<ExamenSlot> examenes = new ArrayList<>();

        for (Map.Entry<Long, List<Curso>> entry : cursosPorProfesor.entrySet()) {
            List<Curso> cursosDocente = entry.getValue();
            UserEntity profesor = cursosDocente.get(0).getProfesor();
            for (Evento e : eventoRepository.findByUsuario(profesor)) {
                if (e.getFechaInicio() == null || e.getId() == null || eventosAgregados.contains(e.getId())) continue;

                boolean esExamen = "EXAMEN".equalsIgnoreCase(e.getTipo());
                LocalTime horaEv = e.getFechaInicio().toLocalTime();
                if (esExamen && !coincideTurno(horaEv, grupo.turno())) continue;

                Curso asociado = buscarCursoDelEvento(e, cursosDocente);
                if (esExamen && asociado == null) continue;

                String cursoKey = asociado != null ? canonicalCourseKey(asociado) : "";
                Curso cursoPrincipal = !cursoKey.isBlank() ? cursosPorKey.getOrDefault(cursoKey, asociado) : asociado;
                String dedup = e.getTipo() + "|" + e.getFechaInicio().toLocalDate() + "|" + cursoKey + "|"
                        + TextUtils.normalizar(e.getTitulo());
                if (!claveDedup.add(dedup)) continue;

                eventosAgregados.add(e.getId());
                eventos.add(eventoAMap(e, cursoPrincipal, cursoKey));

                if (esExamen) {
                    LocalTime finEv = e.getFechaFin() != null && e.getFechaFin().isAfter(e.getFechaInicio())
                            ? e.getFechaFin().toLocalTime()
                            : horaEv.plusMinutes(45);
                    examenes.add(new ExamenSlot(e.getFechaInicio().toLocalDate(), cursoKey, cursoKey, horaEv, finEv));
                }
            }
        }
        return examenes;
    }

    private List<ExamenSlot> agregarEventosPropiosDocente(
            UserEntity docente,
            List<Curso> cursosDocente,
            Map<String, String> colorPorCursoFiltro,
            List<Map<String, Object>> eventos
    ) {
        List<ExamenSlot> examenes = new ArrayList<>();
        Set<Long> vistos = new HashSet<>();
        for (Evento e : eventoRepository.findByUsuario(docente)) {
            if (e.getFechaInicio() == null || e.getId() == null || !vistos.add(e.getId())) continue;

            Curso asociado = buscarCursoDelEventoDocente(e, cursosDocente);
            boolean tituloEspecificaAula = asociado != null && tituloMencionaAula(e.getTitulo(), asociado);
            String cKey = asociado != null ? canonicalCourseKey(asociado) : "";
            String fKey = asociado != null ? teacherCourseKey(asociado) : "";

            Map<String, Object> m = eventoAMap(e, asociado, tituloEspecificaAula ? fKey : cKey);
            m.put("propio", true);
            m.put("eventoId", e.getId());
            if (asociado != null && tituloEspecificaAula) {
                String aulaCorta = formatAulaCorta(asociado);
                m.put("curso", TextUtils.limpiarTexto(asociado.getNombre()) + (aulaCorta.isBlank() ? "" : " · " + aulaCorta));
                m.put("aula", formatAulaLarga(asociado));
                if (colorPorCursoFiltro.containsKey(fKey)) {
                    m.put("color", colorPorCursoFiltro.get(fKey));
                }
            } else if (asociado != null) {
                m.put("curso", TextUtils.limpiarTexto(asociado.getNombre()) + " · Todos los salones");
                m.put("cursoKey", "GENERAL");
            } else {
                m.put("docente", "");
            }
            eventos.add(m);

            if ("EXAMEN".equalsIgnoreCase(e.getTipo())) {
                LocalTime ini = e.getFechaInicio().toLocalTime();
                LocalTime fin = e.getFechaFin() != null && e.getFechaFin().isAfter(e.getFechaInicio())
                        ? e.getFechaFin().toLocalTime()
                        : ini.plusMinutes(45);
                examenes.add(new ExamenSlot(
                        e.getFechaInicio().toLocalDate(),
                        cKey,
                        tituloEspecificaAula ? fKey : "",
                        ini,
                        fin
                ));
            }
        }
        return examenes;
    }

    private void agregarClasesProgramadas(
            List<BloqueHorario> bloques,
            List<ExamenSlot> examenes,
            int anio,
            List<Map<String, Object>> eventos,
            boolean esDocente
    ) {
        if (bloques.isEmpty()) return;

        List<LocalDate> inicios = AcademicCalendarUtil.iniciosBloquesLectivos(anio);
        for (int bIdx = 0; bIdx < inicios.size(); bIdx++) {
            LocalDate inicioBloque = inicios.get(bIdx);
            int numBloque = bIdx + 1;
            for (int s = 0; s < AcademicCalendarUtil.SEMANAS_POR_BLOQUE; s++) {
                LocalDate inicioSemana = inicioBloque.plusWeeks(s);
                int semanaLectiva = (bIdx * AcademicCalendarUtil.SEMANAS_POR_BLOQUE) + s + 1;

                for (BloqueHorario b : bloques) {
                    LocalDate fechaClase = inicioSemana.plusDays(b.diaSemana() - 1L);
                    if (AcademicCalendarUtil.esFeriado(fechaClase)) continue;
                    if (hayExamenSuperpuesto(examenes, fechaClase, b)) continue;

                    Map<String, Object> m = new HashMap<>();
                    m.put("id", "c-" + b.cursoId() + "-" + fechaClase + "-" + b.horaInicio());
                    m.put("titulo", b.nombre());
                    m.put("tipo", "CLASE");
                    m.put("color", b.color());
                    m.put("fechaInicio", fechaClase.toString());
                    m.put("fecha", fechaClase.toString());
                    m.put("hora", hhmm(b.horaInicio()));
                    m.put("horaFin", hhmm(b.horaFin()));
                    m.put("cursoId", b.cursoId());
                    m.put("curso", b.cursoLabel());
                    m.put("cursoKey", b.filterKey());
                    m.put("semanaLectiva", semanaLectiva);
                    m.put("bloque", numBloque);
                    if (esDocente) {
                        m.put("aula", b.aulaLabel());
                        m.put("turno", b.turno());
                        if (b.alumnos() != null) m.put("alumnos", b.alumnos());
                    } else {
                        m.put("docente", b.docente());
                    }
                    eventos.add(m);
                }
            }
        }
    }

    private void agregarTareasDocente(
            List<Curso> cursosDocente,
            Map<String, String> colorPorCursoFiltro,
            Map<String, Integer> alumnosPorAula,
            List<Map<String, Object>> eventos
    ) {
        LocalDate hoy = LocalDate.now();
        Set<Long> tareasVistas = new HashSet<>();

        for (Curso curso : cursosDocente) {
            List<Tarea> tareasCurso = tareaRepository.findByCurso(curso);
            if (tareasCurso == null) continue;
            String fKey = teacherCourseKey(curso);
            String aulaCorta = formatAulaCorta(curso);
            String aulaLarga = formatAulaLarga(curso);
            int totalAlumnos = alumnosPorAula.getOrDefault(aulaKey(curso), 0);
            String color = colorPorCursoFiltro.getOrDefault(fKey, curso.getColor() != null ? curso.getColor() : "yellow");

            for (Tarea t : tareasCurso) {
                if (t.getId() == null || t.getFechaVencimiento() == null || !tareasVistas.add(t.getId())) continue;
                int entregas = entregaRepository != null ? entregaRepository.findByTarea(t).size() : 0;
                boolean vencida = t.getFechaVencimiento().isBefore(hoy);

                Map<String, Object> m = new HashMap<>();
                m.put("id", "t-" + t.getId());
                m.put("tareaId", t.getId());
                m.put("titulo", TextUtils.limpiarTexto(t.getTitulo()));
                m.put("descripcion", TextUtils.limpiarTexto(t.getDescripcion()));
                m.put("tipo", "TAREA");
                m.put("estado", (vencida ? "Fecha vencida" : "Entrega activa")
                        + " · " + entregas + "/" + totalAlumnos + " entregas");
                m.put("entregas", entregas);
                m.put("alumnos", totalAlumnos);
                if (t.getPrioridad() != null) m.put("prioridad", t.getPrioridad());
                m.put("color", color);
                m.put("fechaInicio", t.getFechaVencimiento().toString());
                m.put("fecha", t.getFechaVencimiento().toString());
                m.put("todoElDia", true);
                m.put("cursoId", curso.getId());
                m.put("cursoKey", fKey);
                m.put("curso", TextUtils.limpiarTexto(curso.getNombre()) + (aulaCorta.isBlank() ? "" : " · " + aulaCorta));
                m.put("aula", aulaLarga);
                eventos.add(m);
            }
        }
    }

    private void agregarRecordatoriosPropios(UserEntity estudiante, List<Map<String, Object>> eventos) {
        for (Evento e : eventoRepository.findByUsuario(estudiante)) {
            if (e.getFechaInicio() == null) continue;
            Map<String, Object> mapEv = eventoAMap(e, null, null);
            mapEv.put("tipo", "RECORDATORIO");
            mapEv.put("color", e.getColor() != null ? e.getColor() : "blue");
            mapEv.put("propio", true);
            eventos.add(mapEv);
        }
    }

    private void agregarTareas(
            UserEntity estudiante,
            AcademicGroupHelper.AcademicGroup grupo,
            Map<String, Curso> cursosPorKey,
            List<Map<String, Object>> eventos
    ) {
        Set<Long> entregas = obtenerTareasEntregadas(estudiante);
        List<Tarea> tareas = tareaRepository.findByGrupoAcademico(
                grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno());
        LocalDate hoy = LocalDate.now();

        for (Tarea t : tareas) {
            if (t.getFechaVencimiento() == null) continue;
            eventos.add(tareaAMap(t, entregas, cursosPorKey, hoy));
        }
    }

    private Set<Long> obtenerTareasEntregadas(UserEntity estudiante) {
        if (entregaRepository == null || estudiante == null) return Set.of();
        Set<Long> ids = new HashSet<>();
        List<Entrega> lista = entregaRepository.findByEstudiante(estudiante);
        if (lista == null) return ids;
        for (Entrega e : lista) {
            if (e.getTarea() != null && e.getTarea().getId() != null) {
                ids.add(e.getTarea().getId());
            }
        }
        return ids;
    }

    private boolean hayExamenSuperpuesto(List<ExamenSlot> examenes, LocalDate fechaClase, BloqueHorario bloque) {
        for (ExamenSlot ex : examenes) {
            if (!ex.fecha().equals(fechaClase)) continue;
            boolean mismoCurso = ex.filterKey().isBlank()
                    ? (ex.cursoKey().isBlank() || ex.cursoKey().equals(bloque.cursoKey()))
                    : ex.filterKey().equals(bloque.filterKey());
            if (!mismoCurso) continue;
            boolean solapanHoras = ex.inicio().isBefore(bloque.horaFin()) && bloque.horaInicio().isBefore(ex.fin());
            if (solapanHoras) return true;
        }
        return false;
    }

    private boolean puedeGestionar(UserEntity authUser, UserEntity estudiante) {
        return authUser != null && authUser.getId() != null && authUser.getId().equals(estudiante.getId());
    }

    private boolean puedeGestionarDocente(UserEntity authUser, Long docenteId) {
        if (authUser == null || authUser.getId() == null) return false;
        return authUser.getId().equals(docenteId) || "ADMIN".equalsIgnoreCase(authUser.getRol());
    }

    private Curso buscarCursoDelEventoDocente(Evento e, List<Curso> cursosDocente) {
        String tituloNorm = TextUtils.normalizar(e.getTitulo());
        for (Curso c : cursosDocente) {
            if (tituloMencionaAula(e.getTitulo(), c) && tituloNorm.contains(TextUtils.normalizar(c.getNombre()))) {
                return c;
            }
        }
        return buscarCursoDelEvento(e, cursosDocente);
    }

    private boolean tituloMencionaAula(String titulo, Curso c) {
        if (titulo == null || c == null || c.getGrado() == null || c.getSeccion() == null) return false;
        String t = TextUtils.normalizar(titulo).replace("°", "");
        String g = TextUtils.normalizar(c.getGrado());
        String s = TextUtils.normalizar(c.getSeccion());
        return t.contains(" " + g + " " + s) || t.endsWith(g + " " + s) || t.contains(g + s);
    }

    private static String safeStr(String s) {
        return s != null ? TextUtils.limpiarTexto(s).trim() : "";
    }

    private static String aulaKey(Curso c) {
        if (c == null) return "";
        return (safeStr(c.getNivel()) + "|" + safeStr(c.getGrado()) + "|" + safeStr(c.getSeccion()) + "|" + safeStr(c.getTurno()))
                .toUpperCase(Locale.ROOT);
    }

    private static String teacherCourseKey(Curso c) {
        return canonicalCourseKey(c) + "|" + aulaKey(c);
    }

    private static String formatAulaCorta(Curso c) {
        if (c == null) return "";
        String g = safeStr(c.getGrado());
        String s = safeStr(c.getSeccion());
        if (g.isEmpty() && s.isEmpty()) return "";
        String gTxt = g.matches("\\d+") ? (g + "°") : g;
        return (gTxt + " " + s).trim();
    }

    private static String formatAulaLarga(Curso c) {
        if (c == null) return "";
        String corta = formatAulaCorta(c);
        String n = safeStr(c.getNivel());
        String t = safeStr(c.getTurno());
        StringBuilder sb = new StringBuilder();
        if (!corta.isEmpty()) sb.append(corta);
        if (!n.isEmpty()) {
            if (!sb.isEmpty()) sb.append(" · ");
            sb.append(n.substring(0, 1).toUpperCase(Locale.ROOT)).append(n.substring(1).toLowerCase(Locale.ROOT));
        }
        if (!t.isEmpty()) {
            if (!sb.isEmpty()) sb.append(" · ");
            sb.append(t.substring(0, 1).toUpperCase(Locale.ROOT)).append(t.substring(1).toLowerCase(Locale.ROOT));
        }
        return sb.toString();
    }

    private Curso buscarCursoDelEvento(Evento e, List<Curso> cursosPorNombre) {
        String titulo = " " + TextUtils.normalizar(e.getTitulo()) + " ";
        for (Curso c : cursosPorNombre) {
            String nombre = TextUtils.normalizar(c.getNombre());
            if (!nombre.isBlank() && titulo.contains(" " + nombre + " ")) return c;
            String key = canonicalCourseKey(c);
            if (key.length() >= 3 && titulo.contains(" " + key + " ")) return c;
        }
        return null;
    }

    private Map<String, Curso> construirMapaCursosPorClave(List<Curso> vigentes, List<Curso> fallback) {
        Map<String, Curso> mapa = new LinkedHashMap<>();
        List<Curso> ordenados = new ArrayList<>(vigentes);
        ordenados.sort(Comparator.comparing(Curso::getId, Comparator.nullsLast(Long::compareTo)));
        for (Curso c : ordenados) {
            String key = canonicalCourseKey(c);
            if (!key.isBlank()) mapa.putIfAbsent(key, c);
        }
        for (Curso c : fallback) {
            String key = canonicalCourseKey(c);
            if (!key.isBlank()) mapa.putIfAbsent(key, c);
        }
        return mapa;
    }

    private List<CursoDTO> consolidarCursosUnicos(List<Curso> cursosVigentes) {
        Map<String, Curso> unicos = new LinkedHashMap<>();
        List<Curso> ordenados = new ArrayList<>(cursosVigentes);
        ordenados.sort(Comparator
                .comparing((Curso c) -> TextUtils.normalizar(c.getNombre()))
                .thenComparing(Curso::getId, Comparator.nullsLast(Long::compareTo)));

        for (Curso c : ordenados) {
            String key = canonicalCourseKey(c);
            unicos.putIfAbsent(key, c);
        }
        return unicos.values().stream().map(mapper::toDTO).toList();
    }

    private List<Map<String, Object>> bloquesAMapas(List<BloqueHorario> bloques) {
        return bloques.stream().map(b -> {
            Map<String, Object> m = new HashMap<>();
            m.put("cursoId", b.cursoId());
            m.put("cursoKey", b.filterKey());
            m.put("nombre", b.nombre());
            m.put("cursoLabel", b.cursoLabel());
            if (!b.aulaLabel().isBlank()) m.put("aula", b.aulaLabel());
            if (!b.turno().isBlank()) m.put("turno", b.turno());
            m.put("color", b.color());
            m.put("docente", b.docente());
            m.put("diaSemana", b.diaSemana());
            m.put("horaInicio", hhmm(b.horaInicio()));
            m.put("horaFin", hhmm(b.horaFin()));
            if (b.alumnos() != null) m.put("alumnos", b.alumnos());
            return m;
        }).toList();
    }

    private Map<String, Object> construirResumenEscolar(int anio, String turno) {
        LocalDate hoy = LocalDate.now();
        int semanaActual = AcademicCalendarUtil.semanaActualLectiva(hoy);
        List<Map<String, Object>> bloques = AcademicCalendarUtil.bloquesLectivos(anio).stream()
                .map(b -> Map.<String, Object>of(
                        "numero", b.numero(),
                        "nombre", b.nombre(),
                        "inicio", b.inicio().toString(),
                        "fin", b.fin().toString(),
                        "finClases", b.finClases().toString()
                )).toList();
        List<Map<String, String>> feriados = AcademicCalendarUtil.feriados(anio).entrySet().stream()
                .map(e -> Map.of("fecha", e.getKey().toString(), "nombre", e.getValue()))
                .toList();

        Map<String, Object> info = new HashMap<>();
        info.put("anio", anio);
        info.put("turno", turno != null ? turno : "");
        info.put("semanaActual", semanaActual);
        info.put("totalSemanas", AcademicCalendarUtil.TOTAL_SEMANAS);
        info.put("bloqueActual", AcademicCalendarUtil.bloqueDeSemana(semanaActual));
        info.put("enSemanaLectiva", AcademicCalendarUtil.esSemanaLectiva(hoy));
        info.put("bloques", bloques);
        info.put("feriados", feriados);
        return info;
    }

    private static boolean esDiaEntreSemana(Integer dia) {
        return dia != null && dia >= 1 && dia <= 5;
    }

    private static boolean coincideTurno(LocalTime horaInicio, String turno) {
        if (horaInicio == null || turno == null || turno.isBlank()) return true;
        String t = TextUtils.normalizar(turno).toUpperCase(Locale.ROOT);
        if (t.contains("TARDE")) {
            return !horaInicio.isBefore(INICIO_TURNO_TARDE);
        }
        if (t.contains("MANANA")) {
            return horaInicio.isBefore(CORTE_TURNO_MANANA);
        }
        return true;
    }

    private static String canonicalCourseKey(Curso c) {
        if (c == null) return "";
        String key = TextUtils.claveCurso(c.getNombre(), c.getId());
        if (key.contains("dpcc") || key.startsWith("desarrollo personal")) return "dpcc";
        if (key.equals("educacion para el trabajo") || key.equals("ept")) return "ept";
        if (key.equals("educacion religiosa") || key.equals("religion")) return "religion";
        return key;
    }

    private String nombreDocente(Curso c) {
        if (c == null || c.getProfesor() == null) return "";
        UserEntity p = c.getProfesor();
        String nombre = ((p.getNombres() == null ? "" : p.getNombres()) + " "
                + (p.getApellidos() == null ? "" : p.getApellidos())).trim();
        return TextUtils.limpiarTexto(nombre);
    }

    private static String hhmm(LocalDateTime fecha) {
        return String.format("%02d:%02d", fecha.getHour(), fecha.getMinute());
    }

    private static String hhmm(LocalTime hora) {
        return String.format("%02d:%02d", hora.getHour(), hora.getMinute());
    }

    private Map<String, Object> eventoAMap(Evento e, Curso c, String cursoKey) {
        Map<String, Object> m = new HashMap<>();
        LocalDateTime inicio = e.getFechaInicio();
        LocalDateTime fin = e.getFechaFin() != null && e.getFechaFin().isAfter(inicio)
                ? e.getFechaFin() : inicio.plusMinutes(90);
        m.put("id", e.getId());
        m.put("titulo", TextUtils.limpiarTexto(e.getTitulo()));
        m.put("descripcion", TextUtils.limpiarTexto(e.getDescripcion()));
        m.put("tipo", e.getTipo());
        m.put("color", c != null ? c.getColor() : (e.getColor() != null ? e.getColor() : "blue"));
        m.put("fechaInicio", inicio.toString());
        m.put("fecha", inicio.toLocalDate().toString());
        m.put("hora", hhmm(inicio));
        m.put("horaFin", hhmm(fin));
        m.put("curso", c != null ? TextUtils.limpiarTexto(c.getNombre()) : "");
        m.put("docente", nombreDocente(c));
        if (c != null) m.put("cursoId", c.getId());
        if (cursoKey != null && !cursoKey.isBlank()) m.put("cursoKey", cursoKey);
        return m;
    }

    private Map<String, Object> tareaAMap(
            Tarea t,
            Set<Long> entregas,
            Map<String, Curso> cursosPorKey,
            LocalDate hoy
    ) {
        Curso cursoOriginal = t.getCurso();
        String key = canonicalCourseKey(cursoOriginal);
        Curso cursoActivo = !key.isBlank() ? cursosPorKey.getOrDefault(key, cursoOriginal) : cursoOriginal;
        boolean entregada = t.getId() != null && entregas.contains(t.getId());
        LocalDate fechaVenc = t.getFechaVencimiento();
        boolean vencida = !entregada && fechaVenc.isBefore(hoy);
        String estado = entregada ? "Completada" : (vencida ? "Vencida" : "Pendiente");

        Map<String, Object> m = new HashMap<>();
        m.put("id", "t-" + t.getId());
        m.put("tareaId", t.getId());
        m.put("titulo", TextUtils.limpiarTexto(t.getTitulo()));
        m.put("descripcion", TextUtils.limpiarTexto(t.getDescripcion()));
        m.put("tipo", "TAREA");
        m.put("estado", estado);
        m.put("entregada", entregada);
        if (t.getPrioridad() != null) m.put("prioridad", t.getPrioridad());
        m.put("color", cursoActivo != null ? cursoActivo.getColor() : "yellow");
        m.put("fechaInicio", fechaVenc.toString());
        m.put("fecha", fechaVenc.toString());
        m.put("todoElDia", true);
        m.put("curso", cursoActivo != null ? TextUtils.limpiarTexto(cursoActivo.getNombre()) : "");
        m.put("docente", nombreDocente(cursoActivo));
        if (cursoActivo != null) m.put("cursoId", cursoActivo.getId());
        if (!key.isBlank()) m.put("cursoKey", key);
        return m;
    }
}
