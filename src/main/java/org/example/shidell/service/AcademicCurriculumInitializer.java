package org.example.shidell.service;

import org.example.shidell.model.entity.Aula;
import org.example.shidell.model.entity.Calificacion;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.entity.Evaluacion;
import org.example.shidell.model.entity.Evento;
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
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * Normaliza e inicializa de forma idempotente la estructura curricular anual por bimestres (EBR - MINEDU):
 * - 4 bimestres lectivos de 9 semanas (36 semanas en total)
 * - Exactamente 1 tarea por semana lectiva (1..36) por asignatura y sección
 * - 2 exámenes formales por bimestre (Examen Parcial + Examen Bimestral = 8 exámenes/año por asignatura)
 * - Notas reales vigesimales (0..20) sin PDFs en blanco para verificar evaluaciones en cuentas demo.
 */
@Service
public class AcademicCurriculumInitializer {

    private static final String[] ROMANOS = {"", "I", "II", "III", "IV"};

    private static final List<String> TEMAS_MATEMATICA = List.of(
            "Conjuntos y operaciones básicas", "Sistemas de numeración y propiedades", "Múltiplos, divisores y divisibilidad",
            "Fracciones equivalentes y orden", "Operaciones con números decimales", "Razones y proporciones",
            "Regla de tres simple y porcentajes", "Expresiones algebraicas iniciales", "Ecuaciones lineales de primer grado",
            "Inecuaciones y representación gráfica", "Sistema de ecuaciones lineales", "Productos notables básicos",
            "Ángulos y rectas paralelas", "Triángulos: clasificación y propiedades", "Cuadriláteros y polígonos",
            "Perímetro y áreas de figuras planas", "Circunferencia y círculo", "Cuerpos geométricos y volumen",
            "Plano cartesiano y traslaciones", "Funciones lineales y proporcionalidad", "Pendiente e intercepto de una recta",
            "Tablas de frecuencias estadísticas", "Gráficos de barras y circulares", "Medidas de tendencia central",
            "Sucesiones numéricas y patrones", "Resolución de problemas contextualizados", "Probabilidad y sucesos aleatorios",
            "Teorema de Pitágoras aplicado", "Triángulos notables y razones", "Gráficos estadísticos comparativos",
            "Ecuaciones con valor absoluto", "Modelado algebraico de situaciones", "Sistemas métricos y conversiones",
            "Optimización de áreas y perímetros", "Repaso integral por competencias", "Proyecto de modelamiento matemático"
    );

    private static final List<String> TEMAS_COMUNICACION = List.of(
            "Comprensión lectora: idea principal", "Estructura del texto narrativo", "El texto expositivo y sus conectores",
            "Reglas generales de tildación", "Sinónimos, antónimos y campo semántico", "Uso de mayúsculas y signos de puntuación",
            "El sustantivo, adjetivo y determinantes", "El verbo: tiempo, modo y aspecto", "Sujeto y predicado en la oración",
            "Texto argumentativo: tesis y argumentos", "Crónica periodística y reportaje", "El resumen y los mapas conceptuales",
            "Figuras literarias en la poesía", "Géneros literarios: épico y lírico", "Técnicas de exposición oral efectiva",
            "Infografía: lectura y diseño textual", "Conectores lógicos y cohesión", "Oración compuesta coordinada",
            "Lectura crítica de textos discontinuos", "Debate escolar y argumentación", "Redacción de ensayo breve",
            "Uso de grafías c, s, z, b y v", "Tildación diacrítica y especial", "Análisis de cuento peruano contemporáneo",
            "Guion teatral y diálogo dramático", "Entrevista y ficha de registro", "Coherencia y adecuación textual",
            "Textos instructivos y manuales", "Publicidad responsable y análisis visual", "Carta formal y solicitud académica",
            "Lectura inferencial y propósito comunicativo", "Crítica literaria de obra leída", "Ortografía avanzada en párrafos",
            "Exposición multimedia estructurada", "Síntesis anual de producción escrita", "Portafolio final de lectoescritura"
    );

    private static final List<String> TEMAS_CYT = List.of(
            "Método científico e hipótesis", "La célula: estructura y organelos", "Niveles de organización biológica",
            "Nutrición celular y fotosíntesis", "Ecosistemas y factores bióticos", "Cadenas tróficas y flujo de energía",
            "Propiedades generales de la materia", "Estados de agregación y cambios físicos", "Átomos, elementos y tabla periódica",
            "Mezclas homogéneas y heterogéneas", "Movimiento rectilíneo uniforme", "Fuerzas, masa y leyes de Newton",
            "Formas y transformación de energía", "Calor, temperatura y equilibrio térmico", "El sistema digestivo y nutrientes",
            "Sistema respiratorio y cuidado pulmonar", "Circulación sanguínea y corazón", "Sistema nervioso y órganos sensoriales",
            "Ciclo del agua y cuencas hidrográficas", "Suelo, rocas y recursos minerales", "Cambio climático y huella ecológica",
            "Biodiversidad en regiones del Perú", "Energías renovables y sostenibilidad", "Electricidad y circuitos simples",
            "Magnetismo y aplicaciones cotidianas", "Ondas, sonido y propagación de la luz", "Genética básica y herencia biológica",
            "Reacciones químicas cotidianas", "Soluciones, acidez y escala de pH", "Tecnología y ambiente en la comunidad",
            "Informe experimental de ecosistemas", "Indagación sobre densidad y flotación", "Salud preventiva y microbiología",
            "Óptica geométrica: espejos y lentes", "Feria de indagación científica", "Evaluación de proyecto experimental"
    );

    private static final List<String> TEMAS_SOCIALES = List.of(
            "Espacio geográfico y cartografía básica", "Las ocho regiones naturales del Perú", "Relieve costero, andino y amazónico",
            "Primeras culturas peruanas: Caral y Chavín", "Culturas Paracas, Nazca y Moche", "Horizonte Medio: Wari y Tiahuanaco",
            "El Tahuantinsuyo: organización social", "Economía y reciprocidad en el Incario", "Encuentro cultural y Virreinato",
            "Recursos hídricos y gestión del riesgo", "Actividades económicas del Perú", "Corrientes libertadoras e Independencia",
            "Formación de la República Peruana", "Era del guano y siglo XIX", "Defensa civil ante desastres naturales",
            "Cuencas hidrográficas y cambio climático", "Población, migración y urbanización", "Patrimonio cultural material e inmaterial",
            "Derechos humanos y convivencia escolar", "Organización del Estado peruano", "Economía familiar y ahorro responsable",
            "Globalización y comercio exterior", "Historia regional y memoria local", "Biodiversidad y áreas protegidas",
            "Cultura Chimú e Inca en el norte y sur", "Proceso constitucional del Perú", "Democracia y participación ciudadana",
            "Impacto ambiental de industrias locales", "Consumo responsable y presupuesto", "Identidad pluricultural peruana",
            "Análisis de fuentes históricas primarias", "Uso sostenible del territorio", "Desafíos urbanos contemporáneos",
            "Lectura de mapas temáticos", "Línea de tiempo de la historia nacional", "Síntesis ciudadana e histórica"
    );

    private static final List<String> TEMAS_INGLES = List.of(
            "Greetings and personal introductions", "Verb to be in affirmative and negative", "Present simple: daily routines",
            "Classroom objects and prepositions", "Family members and possessives", "Telling the time and school schedule",
            "Countable and uncountable nouns", "There is / There are with places", "Modal verb Can for abilities",
            "Present continuous for actions now", "Comparing Present Simple vs Continuous", "Clothes, colors and descriptions",
            "Weather, seasons and months", "Food vocabulary and healthy habits", "Past simple of verb to be",
            "Regular verbs in Past Simple", "Irregular verbs story practice", "Past continuous and time clauses",
            "Asking directions in town", "Comparatives and superlatives", "Future plans with Going to",
            "Future predictions with Will", "Should and Must for advice and rules", "Reading short biographies",
            "Listening comprehension: travel dialog", "Hobbies, sports and free time", "Professions and workplace verbs",
            "Environmental care vocabulary", "Writing an email to a friend", "Making invitations and polite requests",
            "Modal verbs review and dialogue", "Peruvian culture in English", "Verb tense review workshop",
            "Short oral presentation script", "Reading comprehension mock quiz", "Final English portfolio review"
    );

    private static final List<String> TEMAS_GENERALES = List.of(
            "Exploración diagnóstica de saberes previos", "Taller práctico guiado de la unidad", "Análisis de caso aplicado",
            "Actividad colaborativa de consolidación", "Preparación integral para evaluación parcial", "Resolución de ficha práctica",
            "Socialización de evidencias de aprendizaje", "Proyecto formativo de mitad de bimestre", "Cierre y reflexión metacognitiva",
            "Desarrollo de competencias del II bimestre", "Taller experiencial en equipo", "Práctica de aplicación contextualizada",
            "Elaboración de organizador visual", "Repaso estructurado de desempeño", "Producción creativa guiada",
            "Autoevaluación y coevaluación crítica", "Investigación breve con fuentes confiables", "Consolidación del II bimestre",
            "Introducción temática del III bimestre", "Laboratorio o práctica demostrativa", "Resolución de retos por niveles",
            "Presentación parcial de avance", "Preparación de examen parcial III", "Profundización de habilidades clave",
            "Registro reflexivo de aprendizajes", "Producto integrador de la unidad", "Evaluación formativa del III bimestre",
            "Planificación de metas del IV bimestre", "Taller práctico de desempeño autónomo", "Solución aplicada al entorno escolar",
            "Revisión de avances de proyecto", "Repaso dirigido para parcial IV", "Demostración práctica de competencias",
            "Análisis reflexivo de resultados", "Ensayo y pulido de evidencia final", "Socialización de portafolio anual"
    );

    @Autowired private AulaRepository aulaRepository;
    @Autowired private CursoRepository cursoRepository;
    @Autowired private TareaRepository tareaRepository;
    @Autowired private EvaluacionRepository evaluacionRepository;
    @Autowired private CalificacionRepository calificacionRepository;
    @Autowired private EntregaRepository entregaRepository;
    @Autowired private EventoRepository eventoRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private MatriculaRepository matriculaRepository;
    @Autowired private CalendarioMineduService mineduService;

    /**
     * Normaliza toda la malla curricular anual para todas las aulas:
     * 1) Mantiene exactamente 1 tarea por semana (Semanas 1..36) por asignatura y sección, sin PDFs vacíos.
     * 2) Garantiza los 8 exámenes por bimestre (Parcial + Bimestral x 4 bimestres) en Evaluacion y Evento.
     */
    @Transactional
    public void normalizarMallaTareasYExamenes(LocalDate fechaRef) {
        LocalDate ref = fechaRef != null ? fechaRef : LocalDate.now();
        int anio = ref.getYear();

        List<Aula> aulas = aulaRepository.findAll();
        if (aulas.isEmpty()) {
            return;
        }

        List<Curso> todosCursos = cursoRepository.findAll();
        List<Tarea> todasTareas = tareaRepository.findAll();
        List<Evaluacion> todasEvaluaciones = evaluacionRepository.findAll();
        Set<Long> tareasConEntregas = new HashSet<>(entregaRepository.findDistinctTareaIdsWithEntregas());

        Map<Long, List<Curso>> cursosPorAulaId = new HashMap<>();
        for (Curso c : todosCursos) {
            if (c.getAula() != null && c.getAula().getId() != null) {
                cursosPorAulaId.computeIfAbsent(c.getAula().getId(), k -> new ArrayList<>()).add(c);
            }
        }

        Map<Long, List<Tarea>> tareasPorCursoId = new HashMap<>();
        for (Tarea t : todasTareas) {
            if (t.getCurso() != null && t.getCurso().getId() != null) {
                tareasPorCursoId.computeIfAbsent(t.getCurso().getId(), k -> new ArrayList<>()).add(t);
            }
        }

        Map<Long, List<Evaluacion>> evalsPorCursoId = new HashMap<>();
        for (Evaluacion ev : todasEvaluaciones) {
            if (ev.getCurso() != null && ev.getCurso().getId() != null) {
                evalsPorCursoId.computeIfAbsent(ev.getCurso().getId(), k -> new ArrayList<>()).add(ev);
            }
        }

        List<Tarea> tareasAGuardar = new ArrayList<>();
        List<Tarea> tareasAEliminar = new ArrayList<>();
        List<Evaluacion> evalsAGuardar = new ArrayList<>();

        for (Aula aula : aulas) {
            List<Curso> cursosAula = cursosPorAulaId.getOrDefault(aula.getId(), List.of());
            if (cursosAula.isEmpty()) continue;

            List<Curso> activosAula = AcademicGroupHelper.preferActiveCourses(cursosAula);
            // Mapear todos los bloques (activos + heredados) por materia normalizada
            Map<String, List<Curso>> todosPorMateria = new LinkedHashMap<>();
            for (Curso c : cursosAula) {
                if (c.getNombre() == null) continue;
                todosPorMateria.computeIfAbsent(TextUtils.normalizar(c.getNombre()), k -> new ArrayList<>()).add(c);
            }

            // Elegir el curso canónico por materia (primer activo ordenado por id ascendente)
            Map<String, Curso> canonicoPorMateria = new LinkedHashMap<>();
            activosAula.stream()
                    .filter(c -> c.getNombre() != null)
                    .sorted(Comparator.comparing(Curso::getId, Comparator.nullsLast(Long::compareTo)))
                    .forEach(c -> canonicoPorMateria.putIfAbsent(TextUtils.normalizar(c.getNombre()), c));

            for (Map.Entry<String, Curso> entry : canonicoPorMateria.entrySet()) {
                String materiaNorm = entry.getKey();
                Curso canonical = entry.getValue();
                List<Curso> hermanas = todosPorMateria.getOrDefault(materiaNorm, List.of(canonical));

                sincronizarTareas36Semanas(
                        canonical, hermanas, tareasPorCursoId, tareasConEntregas,
                        anio, ref, tareasAGuardar, tareasAEliminar);

                sincronizarEvaluacionesBimestrales(
                        canonical, hermanas, evalsPorCursoId, anio, evalsAGuardar);
            }
        }

        if (!tareasAEliminar.isEmpty()) {
            tareaRepository.deleteAllInBatch(tareasAEliminar);
        }
        if (!tareasAGuardar.isEmpty()) {
            guardarTareasEnLotes(tareasAGuardar);
        }
        if (!evalsAGuardar.isEmpty()) {
            evaluacionRepository.saveAll(evalsAGuardar);
        }

        sincronizarEventosExamenParaEstudiantesDemo(anio);
    }

    /**
     * Garantiza que los estudiantes demo especificados cuenten con calificaciones vigesimales reales (0..20)
     * en las evaluaciones ya transcurridas de los bimestres I..III (y cualquier evaluación ya rendida),
     * además de entregas registradas en semanas cerradas para mostrar avance verídico sin spam ni PDFs en blanco.
     */
    @Transactional
    public void asegurarNotasYEntregasEstudiantesDemo(List<String> emailsObjetivo, LocalDate fechaRef) {
        if (emailsObjetivo == null || emailsObjetivo.isEmpty()) return;
        LocalDate ref = fechaRef != null ? fechaRef : LocalDate.now();
        int semanaActual = AcademicCalendarUtil.semanaActualLectiva(ref);
        int limiteSemanaEntregada = Math.max(1, semanaActual - 2);

        List<Calificacion> nuevasCalificaciones = new ArrayList<>();
        List<Entrega> nuevasEntregas = new ArrayList<>();

        for (String email : emailsObjetivo) {
            UserEntity estudiante = userRepository.findByEmail(email).orElse(null);
            if (estudiante == null || !"ESTUDIANTE".equalsIgnoreCase(estudiante.getRol())) continue;

            AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);
            if (!grupo.isComplete()) continue;

            List<Curso> cursosActivos = AcademicGroupHelper.preferActiveCourses(
                    cursoRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno()));

            Map<String, Curso> canonicoPorMateria = new LinkedHashMap<>();
            cursosActivos.stream()
                    .filter(c -> c.getNombre() != null)
                    .sorted(Comparator.comparing(Curso::getId, Comparator.nullsLast(Long::compareTo)))
                    .forEach(c -> canonicoPorMateria.putIfAbsent(TextUtils.normalizar(c.getNombre()), c));

            List<Calificacion> calsExistentes = calificacionRepository.findByEstudianteId(estudiante.getId());
            Set<Long> evalsYaCalificadas = new HashSet<>();
            Set<String> actividadesYaCalificadas = new HashSet<>();
            for (Calificacion cal : calsExistentes) {
                if (cal.getEvaluacion() != null && cal.getEvaluacion().getId() != null) {
                    evalsYaCalificadas.add(cal.getEvaluacion().getId());
                }
                if (cal.getCurso() != null && cal.getActividad() != null) {
                    actividadesYaCalificadas.add(TextUtils.normalizar(cal.getCurso().getNombre()) + "|" + TextUtils.normalizar(cal.getActividad()));
                }
            }

            List<Entrega> entregasExistentes = entregaRepository.findByEstudiante(estudiante);
            Set<Long> tareasYaEntregadas = new HashSet<>();
            for (Entrega ent : entregasExistentes) {
                if (ent.getTarea() != null && ent.getTarea().getId() != null) {
                    tareasYaEntregadas.add(ent.getTarea().getId());
                }
            }

            int idxCurso = 0;
            for (Curso curso : canonicoPorMateria.values()) {
                List<Evaluacion> evals = evaluacionRepository.findByCursoIdOrderByBimestreAscFechaAscIdAsc(curso.getId());
                for (Evaluacion ev : evals) {
                    if (ev.getFecha() == null || ev.getFecha().isAfter(ref)) {
                        continue; // Mantener próximas evaluaciones del IV Bimestre como programadas/pendientes
                    }
                    String keyAct = TextUtils.normalizar(curso.getNombre()) + "|" + TextUtils.normalizar(ev.getTitulo());
                    if (evalsYaCalificadas.contains(ev.getId()) || actividadesYaCalificadas.contains(keyAct)) {
                        continue;
                    }
                    Calificacion cal = new Calificacion();
                    cal.setCurso(curso);
                    cal.setEstudiante(estudiante);
                    cal.setEvaluacion(ev);
                    cal.setActividad(ev.getTitulo());
                    cal.setNotaMaxima(ev.getNotaMaxima() != null ? ev.getNotaMaxima() : 20.0);
                    cal.setNota(generarNotaVigesimalDeterminista(estudiante.getId(), idxCurso, ev));
                    cal.setFecha(ev.getFecha());
                    nuevasCalificaciones.add(cal);
                    evalsYaCalificadas.add(ev.getId());
                }

                // Entregas completadas en semanas pasadas cerradas (Semanas 1..limiteSemanaEntregada)
                List<Tarea> tareasCurso = tareaRepository.findByCurso(curso);
                for (Tarea tarea : tareasCurso) {
                    if (tarea.getId() == null || tareasYaEntregadas.contains(tarea.getId())) continue;
                    int semana = AcademicCalendarUtil.resolverSemanaTarea(tarea.getFechaVencimiento(), tarea.getFechaInicio(), ref);
                    if (semana <= limiteSemanaEntregada) {
                        LocalDate fechaBase = tarea.getFechaVencimiento() != null ? tarea.getFechaVencimiento() : ref.minusDays(7);
                        Entrega ent = new Entrega();
                        ent.setTarea(tarea);
                        ent.setEstudiante(estudiante);
                        ent.setEstado("ENTREGADO");
                        ent.setFechaEntrega(LocalDateTime.of(fechaBase, LocalTime.of(16, 15)));
                        ent.setComentarioEstudiante("Actividad semanal completada conforme a lo indicado en clase.");
                        ent.setArchivoUrl(null);
                        nuevasEntregas.add(ent);
                        tareasYaEntregadas.add(tarea.getId());
                    }
                }
                idxCurso++;
            }
        }

        if (!nuevasCalificaciones.isEmpty()) {
            calificacionRepository.saveAll(nuevasCalificaciones);
        }
        if (!nuevasEntregas.isEmpty()) {
            entregaRepository.saveAll(nuevasEntregas);
        }
    }

    private void sincronizarTareas36Semanas(
            Curso canonical,
            List<Curso> hermanas,
            Map<Long, List<Tarea>> tareasPorCursoId,
            Set<Long> tareasConEntregas,
            int anio,
            LocalDate ref,
            List<Tarea> tareasAGuardar,
            List<Tarea> tareasAEliminar) {

        Map<Integer, List<Tarea>> porSemana = new TreeMap<>();
        for (Curso hermana : hermanas) {
            for (Tarea t : tareasPorCursoId.getOrDefault(hermana.getId(), List.of())) {
                int semana = Math.max(1, Math.min(AcademicCalendarUtil.TOTAL_SEMANAS,
                        AcademicCalendarUtil.resolverSemanaTarea(t.getFechaVencimiento(), t.getFechaInicio(), ref)));
                porSemana.computeIfAbsent(semana, k -> new ArrayList<>()).add(t);
            }
        }

        for (int semana = 1; semana <= AcademicCalendarUtil.TOTAL_SEMANAS; semana++) {
            List<Tarea> existentes = porSemana.getOrDefault(semana, List.of());
            if (existentes.isEmpty()) {
                tareasAGuardar.add(construirTareaSemanal(canonical, anio, semana));
                continue;
            }
            if (existentes.size() == 1) {
                Tarea unica = existentes.get(0);
                if (unica.getCurso() == null || !Objects.equals(unica.getCurso().getId(), canonical.getId())) {
                    unica.setCurso(canonical);
                    tareasAGuardar.add(unica);
                }
                continue;
            }
            // Hay > 1 tareas en la misma semana: conservar exactamente una prioritaria y eliminar duplicadas sin entregas
            List<Tarea> ordenadas = new ArrayList<>(existentes);
            ordenadas.sort(Comparator
                    .comparing((Tarea t) -> tareasConEntregas.contains(t.getId()) ? 0 : 1)
                    .thenComparing(t -> esTituloTrivial(t.getTitulo()) ? 1 : 0)
                    .thenComparing(Tarea::getId, Comparator.nullsLast(Long::compareTo)));
            Tarea keeper = ordenadas.get(0);
            if (keeper.getCurso() == null || !Objects.equals(keeper.getCurso().getId(), canonical.getId())) {
                keeper.setCurso(canonical);
                tareasAGuardar.add(keeper);
            }
            for (int i = 1; i < ordenadas.size(); i++) {
                Tarea extra = ordenadas.get(i);
                if (!tareasConEntregas.contains(extra.getId())) {
                    tareasAEliminar.add(extra);
                }
            }
        }
    }

    private void sincronizarEvaluacionesBimestrales(
            Curso canonical,
            List<Curso> hermanas,
            Map<Long, List<Evaluacion>> evalsPorCursoId,
            int anio,
            List<Evaluacion> evalsAGuardar) {

        List<Evaluacion> existentes = new ArrayList<>();
        for (Curso hermana : hermanas) {
            for (Evaluacion ev : evalsPorCursoId.getOrDefault(hermana.getId(), List.of())) {
                existentes.add(ev);
            }
        }

        // Corregir bimestre inconsistente heredado (ej. "Examen Parcial III" etiquetado en bimestre 4)
        for (Evaluacion ev : existentes) {
            if (ev.getCurso() == null || !Objects.equals(ev.getCurso().getId(), canonical.getId())) {
                ev.setCurso(canonical);
                evalsAGuardar.add(ev);
            }
            Integer corregido = detectarBimestrePorTitulo(ev.getTitulo());
            if (corregido != null && !Objects.equals(ev.getBimestre(), corregido)) {
                ev.setBimestre(corregido);
                evalsAGuardar.add(ev);
            }
        }

        List<Evaluacion> planOficial = mineduService.construirEvaluacionesBimestrales(canonical, anio);
        for (Evaluacion plantilla : planOficial) {
            boolean esBimestral = plantilla.getPeso() != null && plantilla.getPeso() >= 2.0;
            boolean yaExiste = existentes.stream().anyMatch(ev ->
                    coincideSlotEvaluacion(ev, plantilla.getBimestre(), esBimestral, plantilla.getTitulo()));
            if (!yaExiste) {
                evalsAGuardar.add(plantilla);
                existentes.add(plantilla);
            }
        }
    }

    private void sincronizarEventosExamenParaEstudiantesDemo(int anio) {
        List<Curso> cursosDemo = new ArrayList<>();
        cursosDemo.addAll(AcademicGroupHelper.preferActiveCourses(
                cursoRepository.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE")));
        cursosDemo.addAll(AcademicGroupHelper.preferActiveCourses(
                cursoRepository.findByGrupoAcademico("PRIMARIA", "6", "D", "MAÑANA")));

        Map<Long, List<Curso>> cursosPorDocente = new LinkedHashMap<>();
        for (Curso c : cursosDemo) {
            if (c.getProfesor() != null && c.getProfesor().getId() != null) {
                cursosPorDocente.computeIfAbsent(c.getProfesor().getId(), k -> new ArrayList<>()).add(c);
            }
        }

        List<Evento> nuevosEventos = new ArrayList<>();
        for (List<Curso> lista : cursosPorDocente.values()) {
            UserEntity docente = lista.get(0).getProfesor();
            List<Evento> propios = eventoRepository.findByUsuarioAndTipo(docente, "EXAMEN");
            Set<String> titulosNorm = new HashSet<>();
            for (Evento ev : propios) {
                if (ev.getTitulo() != null) {
                    titulosNorm.add(TextUtils.normalizar(ev.getTitulo()));
                }
            }
            Map<String, Curso> porMateria = new LinkedHashMap<>();
            for (Curso c : lista) {
                porMateria.putIfAbsent(TextUtils.normalizar(c.getNombre()), c);
            }
            for (Curso canonico : porMateria.values()) {
                for (Evento cand : mineduService.generarEventosExamenesAnuales(canonico, anio)) {
                    String tNorm = TextUtils.normalizar(cand.getTitulo());
                    if (titulosNorm.add(tNorm)) {
                        nuevosEventos.add(cand);
                    }
                }
            }
        }
        if (!nuevosEventos.isEmpty()) {
            eventoRepository.saveAll(nuevosEventos);
        }
    }

    private boolean coincideSlotEvaluacion(Evaluacion existente, Integer bimestreObjetivo, boolean esBimestral, String tituloObjetivo) {
        if (existente == null || bimestreObjetivo == null) return false;
        String tituloNorm = TextUtils.normalizar(existente.getTitulo());
        if (tituloNorm.equals(TextUtils.normalizar(tituloObjetivo))) {
            return true;
        }
        if (!Objects.equals(existente.getBimestre(), bimestreObjetivo)) {
            return false;
        }
        if (!"EXAMEN".equalsIgnoreCase(existente.getTipo())) {
            return false;
        }
        if (esBimestral) {
            return tituloNorm.contains("bimestral");
        }
        return tituloNorm.contains("parcial");
    }

    private Integer detectarBimestrePorTitulo(String titulo) {
        if (titulo == null) return null;
        String norm = TextUtils.normalizar(titulo).replace("-", " ");
        if (norm.contains(" iv ") || norm.endsWith(" iv") || norm.contains("bimestre 4")) return 4;
        if (norm.contains(" iii ") || norm.endsWith(" iii") || norm.contains("bimestre 3")) return 3;
        if (norm.contains(" ii ") || norm.endsWith(" ii") || norm.contains("bimestre 2")) return 2;
        if (norm.contains(" i ") || norm.endsWith(" i") || norm.contains("bimestre 1")) return 1;
        return null;
    }

    private Tarea construirTareaSemanal(Curso curso, int anio, int semana) {
        int bimestre = AcademicCalendarUtil.bloqueDeSemana(semana);
        String romano = ROMANOS[Math.max(1, Math.min(4, bimestre))];
        LocalDate fechaInicio = CalendarioMineduService.fechaInicioEnSemana(anio, semana);
        LocalDate fechaVencimiento = CalendarioMineduService.fechaVencimientoEnSemana(anio, semana);

        String tema = seleccionarTemaSemanal(curso.getNombre(), semana);
        int semEnBloque = ((semana - 1) % AcademicCalendarUtil.SEMANAS_POR_BLOQUE) + 1;
        String prioridad = (semEnBloque == 4 || semEnBloque == 8 || semEnBloque == 9) ? "Alta" : "Media";

        Tarea tarea = new Tarea();
        tarea.setCurso(curso);
        tarea.setTitulo("Semana " + semana + ": " + tema);
        tarea.setDescripcion(String.format(
                "Actividad semanal obligatoria (%s Bimestre · Semana %d) de %s. Desarrolla la consigna indicada por el docente.",
                romano, semana, TextUtils.limpiarTexto(curso.getNombre())));
        tarea.setPrioridad(prioridad);
        tarea.setEstado("Pendiente");
        tarea.setFechaInicio(fechaInicio);
        tarea.setFechaVencimiento(fechaVencimiento);
        tarea.setPdfUrl(null);
        return tarea;
    }

    private String seleccionarTemaSemanal(String materia, int semana) {
        String norm = TextUtils.normalizar(materia);
        List<String> pool;
        if (norm.contains("matematica")) {
            pool = TEMAS_MATEMATICA;
        } else if (norm.contains("comunicacion")) {
            pool = TEMAS_COMUNICACION;
        } else if (norm.contains("ciencia y tecnologia")) {
            pool = TEMAS_CYT;
        } else if (norm.contains("social")) {
            pool = TEMAS_SOCIALES;
        } else if (norm.contains("ingles")) {
            pool = TEMAS_INGLES;
        } else {
            pool = TEMAS_GENERALES;
        }
        return pool.get((semana - 1) % pool.size());
    }

    private double generarNotaVigesimalDeterminista(Long estudianteId, int idxCurso, Evaluacion ev) {
        int bim = ev.getBimestre() != null ? ev.getBimestre() : 1;
        boolean esBimestral = ev.getPeso() != null && ev.getPeso() >= 2.0;
        long seed = Math.abs((estudianteId != null ? estudianteId : 1L) * 31L
                + idxCurso * 17L
                + bim * 13L
                + (esBimestral ? 7L : 3L));
        // Distribución realista peruana [10.5 .. 19.0] con variedad entre Excelente, Muy bueno, Aprobado y un curso en refuerzo
        double[] escala = {14.5, 16.0, 17.5, 18.5, 13.0, 15.5, 19.0, 12.5, 16.5, 10.5};
        return escala[(int) (seed % escala.length)];
    }

    private boolean esTituloTrivial(String titulo) {
        if (titulo == null) return true;
        String clean = titulo.trim().toLowerCase(Locale.ROOT);
        return clean.isBlank() || clean.equals("enviar") || clean.equals("tarea");
    }

    private void guardarTareasEnLotes(List<Tarea> tareas) {
        int batchSize = 300;
        for (int i = 0; i < tareas.size(); i += batchSize) {
            int fin = Math.min(i + batchSize, tareas.size());
            tareaRepository.saveAll(tareas.subList(i, fin));
        }
    }
}
