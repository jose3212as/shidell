package org.example.shidell.util;

import org.example.shidell.model.dto.CalificacionDTO;
import org.example.shidell.model.dto.UserDTO;
import org.example.shidell.model.entity.*;

import java.time.LocalDate;
import java.time.Period;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Construye automáticamente el perfil integral de un estudiante para la vista docente,
 * consolidando ficha personal, apoderado, cursos, calificaciones, tareas, asistencia e indicadores.
 */
public final class StudentProfileHelper {

    private static final String ESTADO_PRESENTES = "PRESENTE";
    private static final String ESTADO_TARDE = "TARDE";
    private static final String ESTADO_AUSENTE = "AUSENTE";
    private static final String ESTADO_JUSTIFICADO = "JUSTIFICADO";

    private StudentProfileHelper() {}

    public static Map<String, Object> build(
            UserEntity estudiante,
            UserDTO estudianteDto,
            Long docenteId,
            AcademicGroupHelper.AcademicGroup grupo,
            List<Curso> cursosAula,
            List<Calificacion> calificaciones,
            List<Tarea> tareas,
            List<Entrega> entregas,
            List<Asistencia> asistenciasRegistradas,
            List<Asistencia> asistenciasCompletas,
            Map<Long, List<ForoSemanaMensaje>> forosPorCursoId,
            List<UserEntity> companerosAula,
            List<CalificacionDTO> calificacionDtos,
            LocalDate hoy) {

        LocalDate fechaRef = hoy != null ? hoy : LocalDate.now();
        List<Curso> activos = (cursosAula == null ? List.<Curso>of() : cursosAula).stream()
                .filter(c -> c != null && !"ARCHIVADO".equalsIgnoreCase(c.getTurno()))
                .toList();
        List<Calificacion> califsList = calificaciones != null ? calificaciones : List.of();
        List<Tarea> tareasList = tareas != null ? tareas : List.of();
        List<Entrega> entregasList = entregas != null ? entregas : List.of();

        Map<Long, Entrega> entregaPorTarea = new HashMap<>();
        for (Entrega e : entregasList) {
            if (e != null && e.getTarea() != null && e.getTarea().getId() != null) {
                entregaPorTarea.putIfAbsent(e.getTarea().getId(), e);
            }
        }
        Set<Long> tareasEntregadasIds = entregaPorTarea.keySet();

        Set<String> misMateriasNorm = new HashSet<>();
        Map<String, List<Curso>> cursosPorMateria = new LinkedHashMap<>();
        for (Curso c : activos) {
            String key = TextUtils.normalizar(c.getNombre());
            cursosPorMateria.computeIfAbsent(key, _ -> new ArrayList<>()).add(c);
            if (docenteId != null && c.getProfesor() != null && docenteId.equals(c.getProfesor().getId())) {
                misMateriasNorm.add(key);
            }
        }

        List<Map<String, Object>> cursosResumen = buildCursosResumen(
                estudiante.getId(), docenteId, misMateriasNorm, cursosPorMateria,
                califsList, tareasList, tareasEntregadasIds,
                forosPorCursoId != null ? forosPorCursoId : Map.of(), fechaRef);

        Map<String, Object> asistenciaResumen = buildAsistenciaResumen(
                asistenciasRegistradas != null ? asistenciasRegistradas : List.of(),
                asistenciasCompletas != null ? asistenciasCompletas : List.of());

        List<Map<String, Object>> tareasYEntregas = buildTareasYEntregas(
                tareasList, entregaPorTarea, misMateriasNorm, fechaRef);

        List<Map<String, Object>> evaluacionesResumen = buildEvaluaciones(
                califsList, calificacionDtos, misMateriasNorm);

        Map<String, Object> resumenAcademico = buildResumenAcademico(
                califsList, misMateriasNorm, cursosResumen, tareasYEntregas, asistenciaResumen,
                estudiante.getPadre() != null);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("estudiante", estudianteDto);
        result.put("edad", calcularEdad(estudiante.getFechaNacimiento(), fechaRef));
        result.put("apoderado", buildApoderado(estudiante.getPadre()));
        result.put("tutorAula", buildTutor(grupo != null && grupo.aula() != null ? grupo.aula().getTutor() : null, estudiante.getTutor()));
        result.put("aula", buildAulaInfo(grupo));
        result.put("resumenAcademico", resumenAcademico);
        result.put("cursos", cursosResumen);
        result.put("evaluaciones", evaluacionesResumen);
        result.put("tareasYEntregas", tareasYEntregas);
        result.put("asistenciasRecientes", asistenciaResumen.get("recientes"));
        result.put("companerosAula", buildCompaneros(companerosAula, estudiante));
        return result;
    }

    private static List<Map<String, Object>> buildCursosResumen(
            Long estudianteId,
            Long docenteId,
            Set<String> misMateriasNorm,
            Map<String, List<Curso>> cursosPorMateria,
            List<Calificacion> califs,
            List<Tarea> tareas,
            Set<Long> tareasEntregadasIds,
            Map<Long, List<ForoSemanaMensaje>> forosPorCursoId,
            LocalDate fechaRef) {

        List<Map<String, Object>> list = new ArrayList<>();
        for (Map.Entry<String, List<Curso>> entry : cursosPorMateria.entrySet()) {
            String key = entry.getKey();
            List<Curso> grupoCursos = entry.getValue();
            Curso representante = grupoCursos.stream()
                    .filter(c -> docenteId != null && c.getProfesor() != null && docenteId.equals(c.getProfesor().getId()))
                    .findFirst()
                    .orElse(grupoCursos.get(0));

            boolean esMiCurso = misMateriasNorm.contains(key);
            CourseProgressHelper.WeeklyProgressSummary progress = CourseProgressHelper.calcularProgresoMateria(
                    estudianteId, key, grupoCursos, tareas, tareasEntregadasIds,
                    forosPorCursoId, AcademicCalendarUtil.TOTAL_SEMANAS, fechaRef);

            List<Calificacion> notasCurso = califs.stream()
                    .filter(c -> c.getCurso() != null && TextUtils.normalizar(c.getCurso().getNombre()).equals(key))
                    .toList();

            double promedio = promedioNota20(notasCurso);
            String estado = notasCurso.isEmpty() ? "Sin notas" : (promedio >= 11.0 ? "Aprobado" : "En riesgo");

            String docenteNombre = "Docente por asignar";
            String docenteEmail = "";
            if (representante.getProfesor() != null) {
                docenteNombre = TextUtils.limpiarTexto(
                        Objects.toString(representante.getProfesor().getNombres(), "") + " "
                                + Objects.toString(representante.getProfesor().getApellidos(), ""));
                docenteEmail = Objects.toString(representante.getProfesor().getEmail(), "");
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", representante.getId());
            item.put("nombre", TextUtils.limpiarTexto(representante.getNombre()));
            item.put("icono", representante.getIcono());
            item.put("color", representante.getColor());
            item.put("docenteNombre", docenteNombre);
            item.put("docenteEmail", docenteEmail);
            item.put("esMiCurso", esMiCurso);
            item.put("promedio", redondear(promedio));
            item.put("evaluacionesCount", notasCurso.size());
            item.put("estado", estado);
            item.put("porcentajeAvance", progress.porcentajeAvance());
            item.put("semanasCompletadas", progress.semanasCompletadas());
            item.put("tareasCount", progress.tareasTotales());
            item.put("entregasCount", progress.tareasCompletadas());
            list.add(item);
        }

        list.sort(Comparator
                .comparing((Map<String, Object> m) -> !(Boolean.TRUE.equals(m.get("esMiCurso"))))
                .thenComparing(m -> String.valueOf(m.get("nombre"))));
        return list;
    }

    private static Map<String, Object> buildAsistenciaResumen(
            List<Asistencia> registradas,
            List<Asistencia> completas) {

        List<Asistencia> base = completas.isEmpty() ? registradas : completas;
        Set<String> keysManuales = registradas.stream()
                .filter(a -> a.getFecha() != null)
                .map(a -> (a.getCurso() != null ? a.getCurso().getId() : 0L) + "|" + a.getFecha())
                .collect(Collectors.toSet());

        long presentes = 0;
        long tardanzas = 0;
        long ausentes = 0;
        long justificados = 0;
        TreeSet<LocalDate> fechasAsistidas = new TreeSet<>();

        for (Asistencia a : base) {
            String estado = normalizarEstado(a.getEstado());
            switch (estado) {
                case ESTADO_TARDE -> { tardanzas++; if (a.getFecha() != null) fechasAsistidas.add(a.getFecha()); }
                case ESTADO_JUSTIFICADO -> { justificados++; if (a.getFecha() != null) fechasAsistidas.add(a.getFecha()); }
                case ESTADO_AUSENTE -> ausentes++;
                default -> { presentes++; if (a.getFecha() != null) fechasAsistidas.add(a.getFecha()); }
            }
        }

        long total = base.size();
        long asistenciasValidas = presentes + tardanzas + justificados;
        int porcentaje = total == 0 ? 100 : (int) Math.round((double) asistenciasValidas / total * 100.0);

        int racha = 0;
        if (!fechasAsistidas.isEmpty()) {
            LocalDate cursor = fechasAsistidas.last();
            while (fechasAsistidas.contains(cursor)) {
                racha++;
                cursor = cursor.minusDays(1);
            }
        }

        List<Map<String, Object>> recientes = base.stream()
                .sorted(Comparator
                        .comparing((Asistencia a) -> a.getFecha() == null ? LocalDate.MIN : a.getFecha(), Comparator.reverseOrder())
                        .thenComparing(a -> !isRegistroManual(a, keysManuales)))
                .limit(25)
                .map(a -> {
                    String est = normalizarEstado(a.getEstado());
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("fecha", a.getFecha() != null ? a.getFecha().toString() : null);
                    row.put("cursoId", a.getCurso() != null ? a.getCurso().getId() : null);
                    row.put("cursoNombre", a.getCurso() != null ? TextUtils.limpiarTexto(a.getCurso().getNombre()) : "General");
                    row.put("estado", est);
                    row.put("asistio", !ESTADO_AUSENTE.equals(est));
                    row.put("registradoManual", isRegistroManual(a, keysManuales));
                    row.put("descripcion", descripcionEstadoAsistencia(est));
                    return row;
                })
                .toList();

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("porcentaje", porcentaje);
        map.put("presentes", presentes);
        map.put("tardanzas", tardanzas);
        map.put("ausentes", ausentes);
        map.put("justificados", justificados);
        map.put("totalRegistros", total);
        map.put("registrosManuales", registradas.size());
        map.put("rachaDias", racha);
        map.put("recientes", recientes);
        return map;
    }

    private static List<Map<String, Object>> buildTareasYEntregas(
            List<Tarea> tareas,
            Map<Long, Entrega> entregaPorTarea,
            Set<String> misMateriasNorm,
            LocalDate hoy) {

        return tareas.stream()
                .sorted(Comparator
                        .comparing((Tarea t) -> t.getCurso() == null || !misMateriasNorm.contains(TextUtils.normalizar(t.getCurso().getNombre())))
                        .thenComparing(t -> t.getFechaVencimiento() == null ? LocalDate.MAX : t.getFechaVencimiento(), Comparator.reverseOrder()))
                .map(t -> {
                    Entrega e = t.getId() != null ? entregaPorTarea.get(t.getId()) : null;
                    String estadoEntrega;
                    if (e != null) {
                        if (e.getNota() != null || "CALIFICADO".equalsIgnoreCase(e.getEstado())) {
                            estadoEntrega = "CALIFICADA";
                        } else if ("ENTREGADO_TARDE".equalsIgnoreCase(e.getEstado())) {
                            estadoEntrega = "ENTREGADA_TARDE";
                        } else {
                            estadoEntrega = "ENTREGADA";
                        }
                    } else if (t.getFechaVencimiento() != null && t.getFechaVencimiento().isBefore(hoy)) {
                        estadoEntrega = "ATRASADA";
                    } else {
                        estadoEntrega = "PENDIENTE";
                    }

                    boolean esMiCurso = t.getCurso() != null
                            && misMateriasNorm.contains(TextUtils.normalizar(t.getCurso().getNombre()));

                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("tareaId", t.getId());
                    row.put("titulo", TextUtils.limpiarTexto(t.getTitulo()));
                    row.put("cursoId", t.getCurso() != null ? t.getCurso().getId() : null);
                    row.put("cursoNombre", t.getCurso() != null ? TextUtils.limpiarTexto(t.getCurso().getNombre()) : "Curso");
                    row.put("esMiCurso", esMiCurso);
                    row.put("prioridad", Objects.toString(t.getPrioridad(), "Media"));
                    row.put("fechaInicio", t.getFechaInicio() != null ? t.getFechaInicio().toString() : null);
                    row.put("fechaVencimiento", t.getFechaVencimiento() != null ? t.getFechaVencimiento().toString() : null);
                    row.put("estadoEntrega", estadoEntrega);
                    row.put("nota", e != null ? e.getNota() : null);
                    row.put("comentarioDocente", e != null ? e.getComentarioProfesor() : null);
                    row.put("fechaEntrega", e != null && e.getFechaEntrega() != null ? e.getFechaEntrega().toString() : null);
                    row.put("archivoUrl", e != null ? e.getArchivoUrl() : null);
                    return row;
                })
                .toList();
    }

    private static List<Map<String, Object>> buildEvaluaciones(
            List<Calificacion> califs,
            List<CalificacionDTO> dtos,
            Set<String> misMateriasNorm) {

        List<Map<String, Object>> result = new ArrayList<>();
        List<Calificacion> ordenadas = califs.stream()
                .sorted(Comparator.comparing((Calificacion c) -> c.getFecha() == null ? LocalDate.MIN : c.getFecha()).reversed())
                .limit(30)
                .toList();

        for (Calificacion c : ordenadas) {
            String cursoNombre = c.getCurso() != null ? TextUtils.limpiarTexto(c.getCurso().getNombre()) : "Curso";
            boolean esMiCurso = c.getCurso() != null && misMateriasNorm.contains(TextUtils.normalizar(c.getCurso().getNombre()));
            double nota20 = notaSobre20(c);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", c.getId());
            row.put("cursoId", c.getCurso() != null ? c.getCurso().getId() : null);
            row.put("cursoNombre", cursoNombre);
            row.put("esMiCurso", esMiCurso);
            row.put("actividad", TextUtils.limpiarTexto(c.getActividad()));
            row.put("nota", c.getNota());
            row.put("notaMaxima", c.getNotaMaxima() != null ? c.getNotaMaxima() : 20.0);
            row.put("nota20", redondear(nota20));
            row.put("estado", nota20 >= 11.0 ? "Aprobado" : "Desaprobado");
            row.put("fecha", c.getFecha() != null ? c.getFecha().toString() : null);
            result.add(row);
        }
        return result;
    }

    private static Map<String, Object> buildResumenAcademico(
            List<Calificacion> califs,
            Set<String> misMateriasNorm,
            List<Map<String, Object>> cursosResumen,
            List<Map<String, Object>> tareasYEntregas,
            Map<String, Object> asistenciaResumen,
            boolean tieneApoderado) {

        boolean tieneEval = !califs.isEmpty();
        double promedioGeneral = promedioNota20(califs);

        List<Calificacion> califsMias = califs.stream()
                .filter(c -> c.getCurso() != null && misMateriasNorm.contains(TextUtils.normalizar(c.getCurso().getNombre())))
                .toList();
        boolean tieneEvalMias = !califsMias.isEmpty();
        double promedioMio = promedioNota20(califsMias);

        long aprobados = cursosResumen.stream().filter(c -> "Aprobado".equals(c.get("estado"))).count();
        long cursosAlerta = cursosResumen.stream().filter(c -> "En riesgo".equals(c.get("estado"))).count();
        int avancePromedio = cursosResumen.isEmpty() ? 0 : (int) Math.round(cursosResumen.stream()
                .mapToInt(c -> ((Number) c.get("porcentajeAvance")).intValue())
                .average().orElse(0.0));

        long tareasTotales = tareasYEntregas.size();
        long tareasCompletadas = tareasYEntregas.stream()
                .filter(t -> "ENTREGADA".equals(t.get("estadoEntrega"))
                        || "ENTREGADA_TARDE".equals(t.get("estadoEntrega"))
                        || "CALIFICADA".equals(t.get("estadoEntrega")))
                .count();
        long tareasAtrasadas = tareasYEntregas.stream().filter(t -> "ATRASADA".equals(t.get("estadoEntrega"))).count();
        long tareasPendientes = tareasYEntregas.stream().filter(t -> "PENDIENTE".equals(t.get("estadoEntrega"))).count();

        int asistenciaPct = ((Number) asistenciaResumen.get("porcentaje")).intValue();
        long tardanzas = ((Number) asistenciaResumen.get("tardanzas")).longValue();
        long ausentes = ((Number) asistenciaResumen.get("ausentes")).longValue();

        String estadoGeneral = clasificarEstado(tieneEval, promedioGeneral, cursosAlerta, asistenciaPct, tareasAtrasadas, ausentes);
        List<Map<String, Object>> insights = buildInsights(
                tieneEval, promedioGeneral, cursosResumen, asistenciaPct, tardanzas, ausentes,
                tareasTotales, tareasCompletadas, tareasAtrasadas, tareasPendientes, tieneApoderado);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("promedioGeneral", redondear(promedioGeneral));
        map.put("tieneEvaluaciones", tieneEval);
        map.put("promedioEnMisCursos", redondear(promedioMio));
        map.put("tieneEvaluacionesMias", tieneEvalMias);
        map.put("asistenciaPorcentaje", asistenciaPct);
        map.put("presentes", asistenciaResumen.get("presentes"));
        map.put("tardanzas", tardanzas);
        map.put("ausentes", ausentes);
        map.put("justificados", asistenciaResumen.get("justificados"));
        map.put("totalRegistrosAsistencia", asistenciaResumen.get("totalRegistros"));
        map.put("rachaDias", asistenciaResumen.get("rachaDias"));
        map.put("tareasTotales", tareasTotales);
        map.put("tareasCompletadas", tareasCompletadas);
        map.put("tareasAtrasadas", tareasAtrasadas);
        map.put("tareasPendientes", tareasPendientes);
        map.put("cursosTotales", cursosResumen.size());
        map.put("cursosAprobados", aprobados);
        map.put("cursosConAlerta", cursosAlerta);
        map.put("avancePromedio", avancePromedio);
        map.put("estadoGeneral", estadoGeneral);
        map.put("estadoEtiqueta", etiquetaEstado(estadoGeneral));
        map.put("insights", insights);
        return map;
    }

    private static List<Map<String, Object>> buildInsights(
            boolean tieneEval,
            double promedioGeneral,
            List<Map<String, Object>> cursosResumen,
            int asistenciaPct,
            long tardanzas,
            long ausentes,
            long tareasTotales,
            long tareasCompletadas,
            long tareasAtrasadas,
            long tareasPendientes,
            boolean tieneApoderado) {

        List<Map<String, Object>> list = new ArrayList<>();
        if (tieneEval) {
            if (promedioGeneral >= 17.0) {
                list.add(insight("success", "ph-medal", "Desempeño sobresaliente",
                        "Mantiene un promedio general destacado de " + redondear(promedioGeneral) + "/20."));
            } else if (promedioGeneral < 11.0) {
                list.add(insight("danger", "ph-warning-circle", "Prioridad académica",
                        "Su promedio general actual es " + redondear(promedioGeneral) + "/20 y requiere plan de mejora."));
            }
            List<String> enRiesgo = cursosResumen.stream()
                    .filter(c -> "En riesgo".equals(c.get("estado")))
                    .map(c -> String.valueOf(c.get("nombre")))
                    .toList();
            if (!enRiesgo.isEmpty()) {
                list.add(insight("warning", "ph-trend-down", "Áreas por reforzar",
                        "Promedio por debajo de 11 en: " + String.join(", ", enRiesgo) + "."));
            }
        } else {
            list.add(insight("info", "ph-notepad", "Sin calificaciones registradas",
                    "Aún no registra notas en este periodo; el seguimiento se basa en asistencia y entregas."));
        }

        if (ausentes > 0 || tardanzas >= 2) {
            list.add(insight(ausentes >= 3 ? "danger" : "warning", "ph-calendar-x", "Alerta de puntualidad",
                    "Registra " + ausentes + " inasistencia(s) y " + tardanzas + " tardanza(s) en el ciclo."));
        } else {
            list.add(insight("success", "ph-calendar-check", "Asistencia favorable",
                    "Mantiene " + asistenciaPct + "% de asistencia en las sesiones programadas."));
        }

        if (tareasAtrasadas > 0) {
            list.add(insight("danger", "ph-clock-countdown", "Entregas vencidas",
                    "Tiene " + tareasAtrasadas + " actividad(es) vencida(s) pendiente(s) de envío."));
        } else if (tareasPendientes > 0) {
            list.add(insight("info", "ph-hourglass", "Tareas activas",
                    "Tiene " + tareasPendientes + " actividad(es) en plazo por entregar."));
        } else if (tareasTotales > 0 && tareasCompletadas == tareasTotales) {
            list.add(insight("success", "ph-check-circle", "Entregas al día",
                    "Completó el 100% de las actividades asignadas (" + tareasTotales + ")."));
        }

        if (tieneApoderado) {
            list.add(insight("info", "ph-users", "Apoderado vinculado",
                    "Cuenta con contacto familiar activo para coordinar seguimiento."));
        }
        return list;
    }

    private static Map<String, Object> insight(String tipo, String icono, String titulo, String detalle) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tipo", tipo);
        m.put("icono", icono);
        m.put("titulo", titulo);
        m.put("detalle", detalle);
        return m;
    }

    private static String clasificarEstado(
            boolean tieneEval, double promedioGeneral, long cursosAlerta,
            int asistenciaPct, long tareasAtrasadas, long ausentes) {
        if ((tieneEval && promedioGeneral < 11.0) || asistenciaPct < 80 || tareasAtrasadas >= 2) {
            return "RIESGO";
        }
        if ((tieneEval && promedioGeneral < 14.0) || cursosAlerta > 0 || tareasAtrasadas == 1 || asistenciaPct < 90 || ausentes >= 2) {
            return "ATENCION";
        }
        if (!tieneEval) {
            return "SIN_EVALUACIONES";
        }
        if (promedioGeneral >= 17.0 && asistenciaPct >= 90) {
            return "DESTACADO";
        }
        return "BUENO";
    }

    private static String etiquetaEstado(String codigo) {
        return switch (codigo) {
            case "DESTACADO" -> "Destacado";
            case "BUENO" -> "Buen desempeño";
            case "ATENCION" -> "En proceso";
            case "RIESGO" -> "Requiere apoyo";
            default -> "Seguimiento activo";
        };
    }

    private static Map<String, Object> buildApoderado(UserEntity padre) {
        if (padre == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", padre.getId());
        m.put("nombres", padre.getNombres());
        m.put("apellidos", padre.getApellidos());
        m.put("email", padre.getEmail());
        m.put("telefono", padre.getTelefono());
        m.put("dni", padre.getDni());
        return m;
    }

    private static Map<String, Object> buildTutor(UserEntity tutorAula, UserEntity tutorUsuario) {
        UserEntity tutor = tutorAula != null ? tutorAula : tutorUsuario;
        if (tutor == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", tutor.getId());
        m.put("nombres", tutor.getNombres());
        m.put("apellidos", tutor.getApellidos());
        m.put("email", tutor.getEmail());
        m.put("codigoPlaza", tutor.getCodigoPlaza());
        return m;
    }

    private static Map<String, Object> buildAulaInfo(AcademicGroupHelper.AcademicGroup grupo) {
        if (grupo == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", grupo.aula() != null ? grupo.aula().getId() : null);
        m.put("nivel", grupo.nivel());
        m.put("grado", grupo.grado());
        m.put("seccion", grupo.seccion());
        m.put("turno", grupo.turno());
        m.put("anioEscolar", grupo.aula() != null ? grupo.aula().getAnioEscolar() : AcademicGroupHelper.ANIO_ESCOLAR_ACTUAL);
        return m;
    }

    private static List<Map<String, Object>> buildCompaneros(List<UserEntity> companeros, UserEntity actual) {
        Map<Long, UserEntity> unicos = new LinkedHashMap<>();
        if (actual != null && actual.getId() != null) {
            unicos.put(actual.getId(), actual);
        }
        if (companeros != null) {
            for (UserEntity u : companeros) {
                if (u != null && u.getId() != null && "ESTUDIANTE".equalsIgnoreCase(u.getRol())) {
                    unicos.putIfAbsent(u.getId(), u);
                }
            }
        }
        return unicos.values().stream()
                .sorted(Comparator
                        .comparing((UserEntity u) -> Objects.toString(u.getApellidos(), ""), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(u -> Objects.toString(u.getNombres(), ""), String.CASE_INSENSITIVE_ORDER))
                .map(u -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", u.getId());
                    item.put("nombres", u.getNombres());
                    item.put("apellidos", u.getApellidos());
                    return item;
                })
                .toList();
    }

    private static Integer calcularEdad(LocalDate fechaNacimiento, LocalDate hoy) {
        if (fechaNacimiento == null || fechaNacimiento.isAfter(hoy)) return null;
        return Period.between(fechaNacimiento, hoy).getYears();
    }

    private static double promedioNota20(List<Calificacion> lista) {
        return GradeCalculationHelper.promedioPonderadoNota20(lista);
    }

    private static double notaSobre20(Calificacion c) {
        return GradeCalculationHelper.notaSobre20(c);
    }

    private static boolean isRegistroManual(Asistencia a, Set<String> keysManuales) {
        if (a == null || a.getFecha() == null) return false;
        String key = (a.getCurso() != null ? a.getCurso().getId() : 0L) + "|" + a.getFecha();
        return keysManuales.contains(key);
    }

    private static String normalizarEstado(String estado) {
        if (estado == null || estado.isBlank()) return ESTADO_PRESENTES;
        return estado.trim().toUpperCase(Locale.ROOT);
    }

    private static String descripcionEstadoAsistencia(String estado) {
        return switch (estado) {
            case ESTADO_PRESENTES -> "Asistió puntualmente";
            case ESTADO_TARDE -> "Ingreso con tardanza";
            case ESTADO_JUSTIFICADO -> "Falta justificada";
            default -> "Inasistencia";
        };
    }

    private static double redondear(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
