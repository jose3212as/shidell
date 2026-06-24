package org.example.shidell.config;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.service.AuthSessionService;
import org.example.shidell.model.entity.Tarea;
import org.example.shidell.repository.TareaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDate;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Configuration
public class DataSeeder {

    private static final String DEFAULT_PASSWORD = "123456";
    private static final String[] SECCIONES = {"A", "B", "C"};
    // Perú: Primaria siempre en turno MAÑANA, Secundaria siempre en turno TARDE
    private static final String TURNO_PRIMARIA  = "MAÑANA";
    private static final String TURNO_SECUNDARIA = "TARDE";
    private static final String[][] HORAS_MANANA = {
            {"07:45", "08:30"}, {"08:30", "09:15"}, {"09:30", "10:15"},
            {"10:15", "11:00"}, {"11:15", "12:00"}, {"12:00", "12:45"}
    };
    private static final String[][] HORAS_TARDE = {
            {"13:30", "14:15"}, {"14:15", "15:00"}, {"15:15", "16:00"},
            {"16:00", "16:45"}, {"17:00", "17:45"}, {"17:45", "18:30"}
    };

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Bean
    CommandLineRunner initDatabase(
            CursoRepository cursoRepository,
            UserRepository userRepository,
            AuthSessionService authSessionService,
            TareaRepository tareaRepository,
            org.example.shidell.repository.EventoRepository eventoRepository,
            org.example.shidell.service.CalendarioMineduService mineduService) {
        return args -> {
            deduplicarDatosAntiguos();
            normalizarTurnosCursosExistentes(cursoRepository);

            UserEntity admin = asegurarAdministrador(userRepository, authSessionService);
            UserEntity padre = asegurarPadre(userRepository, "José", "Carlos", "padre@gmail.com", authSessionService);
            UserEntity tutorDemo = asegurarDocente(userRepository, authSessionService,
                    codigoPrimaria("1", "A", TURNO_PRIMARIA), "Docente Primaria", "1A Mañana");

            asegurarEstudianteDemo(userRepository, "Carlos", "Mendoza", "estudiante@shidell.edu", padre, tutorDemo, authSessionService, "SECUNDARIA", "1", "A", TURNO_SECUNDARIA);
            
            // Generate some random students for testing all classrooms
            // generarEstudiantesAleatorios(userRepository, padre, authSessionService);

            asegurarMallaAcademica(cursoRepository, userRepository, authSessionService, eventoRepository, mineduService);
            asegurarTareasDemo(cursoRepository, tareaRepository);
            limpiarDocentesHuerfanos();

            System.out.println("=================================================");
            System.out.println(">>> SHIDELL: malla semanal completa y docentes relacionados <<<");
            System.out.println(">>> Administrador: " + admin.getEmail() + " / " + DEFAULT_PASSWORD);
            System.out.println(">>> Estudiante demo: estudiante@shidell.edu / " + DEFAULT_PASSWORD);
            System.out.println(">>> Se han generado estudiantes ficticios para todas las aulas.");
            System.out.println("=================================================");
        };
    }

    private void deduplicarDatosAntiguos() {
        try {
            jdbcTemplate.execute("DELETE FROM cursos a USING cursos b " +
                    "WHERE a.id > b.id AND a.nombre = b.nombre AND a.nivel = b.nivel " +
                    "AND a.grado = b.grado AND a.seccion = b.seccion " +
                    "AND COALESCE(a.turno, '') = COALESCE(b.turno, '') " +
                    "AND COALESCE(a.dia_semana, 0) = COALESCE(b.dia_semana, 0) " +
                    "AND COALESCE(a.hora_inicio, '') = COALESCE(b.hora_inicio, '')");

            jdbcTemplate.execute("DELETE FROM usuarios a USING usuarios b " +
                    "WHERE a.id > b.id AND a.email = b.email");
                    
            // Eliminar estudiantes duplicados por el error de reinicios sucesivos (deja solo 3 por aula)
            jdbcTemplate.execute("DELETE FROM usuarios WHERE id NOT IN (" +
                    "SELECT id FROM (" +
                    "SELECT id, row_number() over(partition by nivel, grado, seccion, turno order by id) as rn " +
                    "FROM usuarios WHERE rol = 'ESTUDIANTE' AND email LIKE '%@shidell.edu' AND email != 'estudiante@shidell.edu'" +
                    ") t WHERE rn <= 3" +
                    ") AND rol = 'ESTUDIANTE' AND email LIKE '%@shidell.edu' AND email != 'estudiante@shidell.edu'");
        } catch (Exception e) {
            System.out.println(">>> [INFO] Limpieza inicial omitida: " + e.getMessage());
        }
    }

    private void limpiarDocentesHuerfanos() {
        try {
            // Archivar docentes huérfanos para evitar errores de llaves foráneas en asistencias/tareas
            jdbcTemplate.execute("UPDATE usuarios SET rol = 'ARCHIVADO' WHERE rol = 'DOCENTE' AND email LIKE '%@shidell.edu' AND id NOT IN (SELECT DISTINCT docente_id FROM cursos WHERE docente_id IS NOT NULL)");
        } catch (Exception e) {
            System.out.println(">>> [INFO] Limpieza de docentes omitida: " + e.getMessage());
        }
    }

    private void normalizarTurnosCursosExistentes(CursoRepository cursoRepository) {
        cursoRepository.findAll().stream()
                .filter(c -> c.getTurno() == null || c.getTurno().isBlank())
                .forEach(c -> {
                    c.setTurno(esHoraTarde(c.getHoraInicio()) ? "TARDE" : "MAÑANA");
                    cursoRepository.save(c);
                });
    }

    private boolean esHoraTarde(String horaInicio) {
        if (horaInicio == null || horaInicio.length() < 2) return false;
        try {
            return Integer.parseInt(horaInicio.substring(0, 2)) >= 13;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private void asegurarMallaAcademica(CursoRepository cursoRepo, UserRepository userRepo, AuthSessionService auth, org.example.shidell.repository.EventoRepository eventoRepo, org.example.shidell.service.CalendarioMineduService minedu) {
        Set<String> mallaEsperada = new HashSet<>();
        Set<String> examenesGenerados = new HashSet<>();
        List<AreaPlan> primaria = List.of(
                new AreaPlan("Comunicación", 6, "ph-book-open", "blue"),
                new AreaPlan("Matemática", 6, "ph-calculator", "purple"),
                new AreaPlan("Ciencia y Tecnología", 4, "ph-flask", "green"),
                new AreaPlan("Personal Social", 4, "ph-globe", "cyan"),
                new AreaPlan("Inglés", 2, "ph-translate", "yellow"),
                new AreaPlan("Arte y Cultura", 2, "ph-paint-brush", "orange"),
                new AreaPlan("Educación Física", 2, "ph-soccer-ball", "red"),
                new AreaPlan("Religión", 1, "ph-hands-praying", "green"),
                new AreaPlan("Tutoría", 1, "ph-users-three", "purple"),
                new AreaPlan("Refuerzo Escolar", 2, "ph-target", "cyan")
        );

        List<AreaPlan> secundaria = List.of(
                new AreaPlan("Matemática", 5, "ph-calculator", "purple"),
                new AreaPlan("Comunicación", 5, "ph-book-open", "blue"),
                new AreaPlan("Ciencia y Tecnología", 4, "ph-flask", "green"),
                new AreaPlan("Ciencias Sociales", 3, "ph-globe", "cyan"),
                new AreaPlan("Inglés", 3, "ph-translate", "yellow"),
                new AreaPlan("DPCC", 2, "ph-scales", "orange"),
                new AreaPlan("EPT", 2, "ph-wrench", "red"),
                new AreaPlan("Educación Física", 2, "ph-soccer-ball", "green"),
                new AreaPlan("Arte y Cultura", 2, "ph-paint-brush", "orange"),
                new AreaPlan("Religión", 1, "ph-hands-praying", "green"),
                new AreaPlan("Tutoría", 1, "ph-users-three", "purple")
        );

        for (int grado = 1; grado <= 6; grado++) {
            crearHorarioNivel(cursoRepo, userRepo, auth, mallaEsperada, examenesGenerados, eventoRepo, minedu, "PRIMARIA", String.valueOf(grado), primaria);
        }
        for (int grado = 1; grado <= 5; grado++) {
            crearHorarioNivel(cursoRepo, userRepo, auth, mallaEsperada, examenesGenerados, eventoRepo, minedu, "SECUNDARIA", String.valueOf(grado), secundaria);
        }
        limpiarCursosFueraDeMalla(cursoRepo, mallaEsperada);
    }

    private void crearHorarioNivel(
            CursoRepository cursoRepo,
            UserRepository userRepo,
            AuthSessionService auth,
            Set<String> mallaEsperada,
            Set<String> examenesGenerados,
            org.example.shidell.repository.EventoRepository eventoRepo,
            org.example.shidell.service.CalendarioMineduService minedu,
            String nivel,
            String grado,
            List<AreaPlan> plan) {
        // Perú: Primaria = MAÑANA, Secundaria = TARDE (un solo turno por nivel)
        String turno = "PRIMARIA".equals(nivel) ? TURNO_PRIMARIA : TURNO_SECUNDARIA;
        String[][] horas = TURNO_SECUNDARIA.equals(turno) ? HORAS_TARDE : HORAS_MANANA;
        for (String seccion : SECCIONES) {
            String semilla = nivel + grado + seccion;
            List<AreaPlan> semana = expandirSemana(plan, semilla);
            for (int i = 0; i < semana.size(); i++) {
                AreaPlan area = semana.get(i);
                int dia = (i / horas.length) + 1;
                String[] bloque = horas[i % horas.length];
                UserEntity docente = docentePara(userRepo, auth, nivel, grado, seccion, turno, area.nombre());
                crearSesion(cursoRepo, area, docente, nivel, grado, seccion, turno, dia, bloque[0], bloque[1], examenesGenerados, eventoRepo, minedu);
                mallaEsperada.add(claveCurso(area.nombre(), nivel, grado, seccion, turno, dia, bloque[0]));
            }
        }
    }

    private void limpiarCursosFueraDeMalla(CursoRepository repo, Set<String> mallaEsperada) {
        repo.findAll().stream()
                .filter(this::esCursoDeMallaBase)
                .filter(c -> !mallaEsperada.contains(claveCurso(c.getNombre(), c.getNivel(), c.getGrado(), c.getSeccion(), c.getTurno(), c.getDiaSemana(), c.getHoraInicio())))
                .forEach(c -> {
                    try {
                        repo.delete(c);
                    } catch (Exception e) {
                        c.setTurno("ARCHIVADO");
                        repo.save(c);
                        System.out.println(">>> [INFO] Curso heredado conservado por relaciones: " + c.getNombre() + " " + c.getNivel() + " " + c.getGrado() + c.getSeccion());
                    }
                });
    }

    private boolean esCursoDeMallaBase(Curso c) {
        if (c == null) return false;
        if (!List.of("PRIMARIA", "SECUNDARIA").contains(c.getNivel())) return false;
        if (!List.of(SECCIONES).contains(c.getSeccion())) return false;
        // Validar que el turno coincida con el nivel (Perú: Primaria=MAÑANA, Secundaria=TARDE)
        String turnoEsperado = "PRIMARIA".equals(c.getNivel()) ? TURNO_PRIMARIA : TURNO_SECUNDARIA;
        return turnoEsperado.equals(c.getTurno());
    }

    private List<AreaPlan> expandirSemana(List<AreaPlan> plan, String semilla) {
        AreaPlan[] semana = new AreaPlan[30];
        java.util.Random rand = new java.util.Random(semilla.hashCode());

        List<AreaPlan> bloques2h = new java.util.ArrayList<>();
        List<AreaPlan> bloques1h = new java.util.ArrayList<>();
        for (AreaPlan area : plan) {
            int horas = area.horasSemanales();
            while (horas >= 2) {
                bloques2h.add(area);
                horas -= 2;
            }
            if (horas == 1) {
                bloques1h.add(area);
            }
        }

        java.util.Collections.shuffle(bloques2h, rand);
        java.util.Collections.shuffle(bloques1h, rand);

        for (AreaPlan bloque : bloques2h) {
            boolean colocado = false;
            List<Integer> diasAleatorios = java.util.Arrays.asList(0, 1, 2, 3, 4);
            java.util.Collections.shuffle(diasAleatorios, rand);
            
            for (int d : diasAleatorios) {
                if (tieneMateria(semana, d, bloque.nombre())) continue;
                int pos = encontrarHuecoContiguo(semana, d, 2);
                if (pos != -1) {
                    semana[d * 6 + pos] = bloque;
                    semana[d * 6 + pos + 1] = bloque;
                    colocado = true;
                    break;
                }
            }
            if (!colocado) {
                for (int d : diasAleatorios) {
                    int pos = encontrarHuecoContiguo(semana, d, 2);
                    if (pos != -1) {
                        semana[d * 6 + pos] = bloque;
                        semana[d * 6 + pos + 1] = bloque;
                        colocado = true;
                        break;
                    }
                }
            }
            if (!colocado) {
                bloques1h.add(bloque);
                bloques1h.add(bloque);
            }
        }

        for (AreaPlan bloque : bloques1h) {
            boolean colocado = false;
            List<Integer> diasAleatorios = java.util.Arrays.asList(0, 1, 2, 3, 4);
            java.util.Collections.shuffle(diasAleatorios, rand);
            
            for (int d : diasAleatorios) {
                if (tieneMateria(semana, d, bloque.nombre())) continue;
                int pos = encontrarHuecoContiguo(semana, d, 1);
                if (pos != -1) {
                    semana[d * 6 + pos] = bloque;
                    colocado = true;
                    break;
                }
            }
            if (!colocado) {
                for (int d = 0; d < 5; d++) {
                    for (int h = 0; h < 6; h++) {
                        if (semana[d * 6 + h] == null) {
                            semana[d * 6 + h] = bloque;
                            colocado = true;
                            break;
                        }
                    }
                    if (colocado) break;
                }
            }
        }
        
        for (int i = 0; i < 30; i++) {
            if (semana[i] == null) semana[i] = plan.get(0);
        }

        return java.util.Arrays.asList(semana);
    }

    private boolean tieneMateria(AreaPlan[] semana, int dia, String nombre) {
        for (int i = 0; i < 6; i++) {
            AreaPlan p = semana[dia * 6 + i];
            if (p != null && p.nombre().equals(nombre)) return true;
        }
        return false;
    }

    private int encontrarHuecoContiguo(AreaPlan[] semana, int dia, int tam) {
        int contiguos = 0;
        int inicio = -1;
        for (int i = 0; i < 6; i++) {
            if (semana[dia * 6 + i] == null) {
                if (contiguos == 0) inicio = i;
                contiguos++;
                if (contiguos == tam) return inicio;
            } else {
                contiguos = 0;
            }
        }
        return -1;
    }

    /**
     * Asigna el docente correcto según la realidad educativa peruana:
     *
     * PRIMARIA — Polidocente Completo:
     *   - "Profesor de Aula": 1 por sección, cubre los cursos principales.
     *   - Especialistas (Inglés, Arte, EF): 1 por TURNO, cubre todos los grados 1°-6°.
     *   - Religión: 1 para TODA la escuela (ambos turnos).
     *
     * SECUNDARIA — Polidocente por Asignatura:
     *   - Materias de 5h (Mat, Com): 1 docente por turno para grados 1°-3° y otro para 4°-5°.
     *   - Materias de 3-4h (CyT, Soc, Ing): 1 docente por turno cubre todos los grados.
     *   - Materias de 2h (DPCC, EPT, EF, Arte): 1 docente por turno, todos los grados.
     *   - Religión/Tutoría (1h): 1 docente por turno, todos los grados.
     */
    private UserEntity docentePara(
            UserRepository repo,
            AuthSessionService auth,
            String nivel,
            String grado,
            String seccion,
            String turno,
            String area) {

        int g = 0;
        try { g = Integer.parseInt(grado); } catch (Exception ignored) {}
        String t = abreviar(turno);  // M o T

        // ─────────────────────────────────────────────────────────────────
        // PRIMARIA
        // ─────────────────────────────────────────────────────────────────
        if ("PRIMARIA".equals(nivel)) {

            // Áreas del Profesor de Aula (exclusivo por sección)
            if (esAreaDeAulaPrimaria(area)) {
                return asegurarDocente(repo, auth,
                        "PLZ-PRI-AULA-" + grado + seccion + "-" + t,
                        "Prof. de Aula", grado + "°" + seccion + " " + etiquetaTurno(turno));
            }

            // Religión: 1 para toda la escuela (comparte ambos turnos)
            if ("Religión".equals(area)) {
                return asegurarDocente(repo, auth,
                        "PLZ-PRI-REL-ESCUELA",
                        "Docente Religión", "Primaria");
            }

            // Especialistas (Inglés, Arte y Cultura, Educación Física):
            // 1 por turno, cubre todos los grados 1°-6°
            return asegurarDocente(repo, auth,
                    "PLZ-PRI-" + abreviar(area) + "-" + t,
                    "Docente " + area, "Primaria " + etiquetaTurno(turno));
        }

        // ─────────────────────────────────────────────────────────────────
        // SECUNDARIA
        // ─────────────────────────────────────────────────────────────────

        // Religión y Tutoría (1h): 1 docente por turno, todos los grados
        if ("Religión".equals(area) || "Tutoría".equals(area)) {
            return asegurarDocente(repo, auth,
                    "PLZ-SEC-" + abreviar(area) + "-" + t,
                    "Docente " + area, "Secundaria " + etiquetaTurno(turno));
        }

        // Materias de 2h (DPCC, EPT, Educación Física, Arte y Cultura):
        // 1 docente por turno cubre los 5 grados (2h×15 sal = 30h exacto)
        if ("DPCC".equals(area) || "EPT".equals(area)
                || "Educación Física".equals(area) || "Arte y Cultura".equals(area)) {
            return asegurarDocente(repo, auth,
                    "PLZ-SEC-" + abreviar(area) + "-" + t,
                    "Docente " + area, "Secundaria " + etiquetaTurno(turno));
        }

        // Materias de 3h (Ciencias Sociales, Inglés):
        // 1 docente por turno cubre todos los grados (3h×15 = 45h, habitual en escuelas medianas)
        if ("Ciencias Sociales".equals(area) || "Inglés".equals(area)) {
            return asegurarDocente(repo, auth,
                    "PLZ-SEC-" + abreviar(area) + "-" + t,
                    "Docente " + area, "Secundaria " + etiquetaTurno(turno));
        }

        // Ciencia y Tecnología (4h): 1 docente cubre grados 1°-3°, otro 4°-5°
        if ("Ciencia y Tecnología".equals(area)) {
            String grupo = (g <= 3) ? "1-3" : "4-5";
            return asegurarDocente(repo, auth,
                    "PLZ-SEC-CYT-G" + grupo + "-" + t,
                    "Docente CyT", "G" + grupo + " " + etiquetaTurno(turno));
        }

        // Matemática y Comunicación (5h): 1 docente para grados 1°-2°, otro para 3°-4°, otro para 5°
        // Grado 5 comparte docente con 3°-4° para no generar una plaza infrautilizada
        String grupo;
        if (g <= 2) grupo = "1-2";
        else        grupo = "3-5";   // agrupa grados 3, 4 y 5 (5h×9 sal = 45h, ±15% sobre la norma)

        return asegurarDocente(repo, auth,
                "PLZ-SEC-" + abreviar(area) + "-G" + grupo + "-" + t,
                "Docente " + area, "G" + grupo + " " + etiquetaTurno(turno));
    }

    private boolean esAreaDeAulaPrimaria(String area) {
        return List.of("Comunicación", "Matemática", "Ciencia y Tecnología",
                       "Personal Social", "Tutoría", "Refuerzo Escolar").contains(area);
    }


    private void crearSesion(
            CursoRepository repo,
            AreaPlan area,
            UserEntity docente,
            String nivel,
            String grado,
            String seccion,
            String turno,
            Integer dia,
            String horaInicio,
            String horaFin,
            Set<String> examenesGenerados,
            org.example.shidell.repository.EventoRepository eventoRepo,
            org.example.shidell.service.CalendarioMineduService minedu) {
        Curso curso = repo.findByNombreAndNivelAndGradoAndSeccionAndTurnoAndDiaSemanaAndHoraInicio(
                area.nombre(), nivel, grado, seccion, turno, dia, horaInicio).orElseGet(Curso::new);

        curso.setNombre(area.nombre());
        curso.setNivel(nivel);
        curso.setGrado(grado);
        curso.setSeccion(seccion);
        curso.setTurno(turno);
        curso.setDiaSemana(dia);
        curso.setHoraInicio(horaInicio);
        curso.setHoraFin(horaFin);
        curso.setProfesor(docente);
        curso.setIcono(area.icono());
        curso.setColor(area.color());
        if (curso.getProgreso() == null) curso.setProgreso(0);
        repo.save(curso);
        
        String claveExamen = nivel + "|" + grado + "|" + seccion + "|" + area.nombre();
        if (!examenesGenerados.contains(claveExamen)) {
            // Verificar si el profesor ya tiene eventos de tipo EXAMEN para este curso (por si reiniciamos)
            long count = eventoRepo.findByUsuarioAndTipo(docente, "EXAMEN").stream()
                    .filter(e -> e.getTitulo() != null && e.getTitulo().contains(area.nombre()))
                    .count();
            if (count == 0) {
                List<org.example.shidell.model.entity.Evento> examenes = minedu.generarExamenesBimestrales(curso);
                eventoRepo.saveAll(examenes);
            }
            examenesGenerados.add(claveExamen);
        }
    }

    private String claveCurso(String nombre, String nivel, String grado, String seccion, String turno, Integer dia, String horaInicio) {
        return String.join("|",
                normalizar(nombre).toUpperCase(),
                String.valueOf(nivel),
                String.valueOf(grado),
                String.valueOf(seccion),
                String.valueOf(turno),
                String.valueOf(dia),
                String.valueOf(horaInicio));
    }

    private String codigoPrimaria(String grado, String seccion, String turno) {
        return "PLZ-PRI-AULA-" + grado + seccion + "-" + abreviar(turno);
    }

    private UserEntity asegurarDocente(UserRepository repo, AuthSessionService auth, String codigo, String nombres, String apellidos) {
        UserEntity u = repo.findByCodigoPlaza(codigo).orElseGet(UserEntity::new);
        u.setCodigoPlaza(codigo);
        if (u.getNombres() == null || u.getNombres().isBlank()) u.setNombres(nombres);
        if (u.getApellidos() == null || u.getApellidos().isBlank()) u.setApellidos(apellidos);
        if (u.getEmail() == null || u.getEmail().isBlank()) u.setEmail(emailPara(codigo));
        if (u.getPassword() == null || u.getPassword().isBlank()) u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("DOCENTE");
        return repo.save(u);
    }

    private String emailPara(String codigo) {
        return normalizar(codigo).toLowerCase().replaceAll("[^a-z0-9]+", ".").replaceAll("^\\.|\\.$", "") + "@shidell.edu";
    }

    private String abreviar(String valor) {
        String n = normalizar(valor).toUpperCase();
        Map<String, String> map = new HashMap<>();
        map.put("MANANA", "M");
        map.put("TARDE", "T");
        map.put("PRIMARIA", "PRI");
        map.put("SECUNDARIA", "SEC");
        map.put("COMUNICACION", "COM");
        map.put("MATEMATICA", "MAT");
        map.put("CIENCIA Y TECNOLOGIA", "CYT");
        map.put("PERSONAL SOCIAL", "PSO");
        map.put("CIENCIAS SOCIALES", "SOC");
        map.put("INGLES", "ING");
        map.put("ARTE Y CULTURA", "ART");
        map.put("EDUCACION FISICA", "EFI");
        map.put("RELIGION", "REL");
        map.put("TUTORIA", "TUT");
        map.put("REFUERZO ESCOLAR", "REF");
        return map.getOrDefault(n, n.replaceAll("[^A-Z0-9]", ""));
    }

    private String etiquetaTurno(String turno) {
        return "TARDE".equals(turno) ? "Tarde" : "Mañana";
    }

    private String normalizar(String valor) {
        return Normalizer.normalize(valor == null ? "" : valor, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }

    private UserEntity asegurarAdministrador(UserRepository repo, AuthSessionService auth) {
        UserEntity u = repo.findByEmail("admin@shidell.edu").orElseGet(UserEntity::new);
        u.setNombres("Administrador");
        u.setApellidos("Shidell");
        u.setEmail("admin@shidell.edu");
        u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("ADMINISTRADOR");
        return repo.save(u);
    }

    private UserEntity asegurarPadre(UserRepository repo, String nombres, String apellidos, String email, AuthSessionService auth) {
        UserEntity u = repo.findByEmail(email).orElseGet(UserEntity::new);
        u.setNombres(nombres);
        u.setApellidos(apellidos);
        u.setEmail(email);
        if (u.getPassword() == null || u.getPassword().isBlank()) u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("PADRE");
        return repo.save(u);
    }

    private UserEntity asegurarEstudianteDemo(
            UserRepository repo,
            String nombres,
            String apellidos,
            String email,
            UserEntity padre,
            UserEntity tutor,
            AuthSessionService auth,
            String nivel,
            String grado,
            String seccion,
            String turno) {
        UserEntity u = repo.findByEmail(email).orElseGet(UserEntity::new);
        u.setNombres(nombres);
        u.setApellidos(apellidos);
        u.setEmail(email);
        if (u.getPassword() == null || u.getPassword().isBlank()) u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("ESTUDIANTE");
        u.setNivel(nivel);
        u.setGrado(grado);
        u.setSeccion(seccion);
        u.setTurno(turno);
        u.setPadre(padre);
        u.setTutor(tutor);
        return repo.save(u);
    }

    private void generarEstudiantesAleatorios(UserRepository repo, UserEntity padre, AuthSessionService auth) {
        String[] nombresArray = {"Mateo", "Valentina", "Santiago", "Camila", "Sebastián", "Luciana", "Matías", "Valeria", "Diego", "Martina", "Alejandro", "Sofía", "Daniel", "Mariana", "Joaquín"};
        String[] apellidosArray = {"García", "Rodríguez", "López", "González", "Pérez", "Martínez", "Sánchez", "Romero", "Díaz", "Torres", "Ruiz", "Flores", "Rojas", "Gómez", "Castro"};

        java.util.Random rnd = new java.util.Random();
        
        for (String nivel : List.of("PRIMARIA", "SECUNDARIA")) {
            int maxGrado = nivel.equals("PRIMARIA") ? 6 : 5;
            String turno = nivel.equals("PRIMARIA") ? TURNO_PRIMARIA : TURNO_SECUNDARIA;
            for (int grado = 1; grado <= maxGrado; grado++) {
                for (String seccion : SECCIONES) {
                    for (int i = 1; i <= 3; i++) { // 3 estudiantes aleatorios por aula
                        String nombre = nombresArray[rnd.nextInt(nombresArray.length)];
                        String apellido = apellidosArray[rnd.nextInt(apellidosArray.length)] + " " + apellidosArray[rnd.nextInt(apellidosArray.length)];
                        String email = normalizar(nombre + "." + apellido.split(" ")[0]).toLowerCase() + "." + nivel.charAt(0) + grado + seccion.toLowerCase() + i + "@shidell.edu";
                        asegurarEstudianteDemo(repo, nombre, apellido, email, padre, null, auth, nivel, String.valueOf(grado), seccion, turno);
                    }
                }
            }
        }
    }

    private record AreaPlan(String nombre, int horasSemanales, String icono, String color) {}

    private void asegurarTareasDemo(CursoRepository cursoRepo, TareaRepository tareaRepo) {
        List<Curso> cursosSecundaria = cursoRepo.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE");
        List<Curso> cursosPrimaria = cursoRepo.findByGrupoAcademico("PRIMARIA", "1", "A", "TARDE");
        
        List<Tarea> existingTasks = tareaRepo.findAll();
        if (!existingTasks.isEmpty()) return; // Solo sembrar si no hay tareas
        
        java.util.List<Tarea> tareas = new java.util.ArrayList<>();
        
        if (!cursosSecundaria.isEmpty()) {
            Curso matematica = cursosSecundaria.stream().filter(c -> c.getNombre().equalsIgnoreCase("Matemática")).findFirst().orElse(cursosSecundaria.get(0));
            Curso comunicacion = cursosSecundaria.stream().filter(c -> c.getNombre().equalsIgnoreCase("Comunicación")).findFirst().orElse(cursosSecundaria.get(1 % cursosSecundaria.size()));
            tareas.add(crearTareaPrueba("Resolver Ejercicios de Álgebra", "Resolver la página 45 del libro de actividades.", "Alta", LocalDate.now().minusDays(2), LocalDate.now().plusDays(3), matematica));
            tareas.add(crearTareaPrueba("Ensayo sobre la obra leída", "Escribir un ensayo de 2 páginas.", "Media", LocalDate.now().minusDays(5), LocalDate.now().minusDays(1), comunicacion));
            tareas.add(crearTareaPrueba("Práctica de Ecuaciones", "Ejercicios de primer grado.", "Baja", LocalDate.now().minusDays(1), LocalDate.now().plusDays(5), matematica));
        }

        if (!cursosPrimaria.isEmpty()) {
            Curso matematicaPri = cursosPrimaria.stream().filter(c -> c.getNombre().equalsIgnoreCase("Matemática")).findFirst().orElse(cursosPrimaria.get(0));
            Curso cienciaPri = cursosPrimaria.stream().filter(c -> c.getNombre().equalsIgnoreCase("Ciencia y Tecnología")).findFirst().orElse(cursosPrimaria.get(1 % cursosPrimaria.size()));
            tareas.add(crearTareaPrueba("Sumas y Restas", "Resolver hoja de trabajo.", "Alta", LocalDate.now().minusDays(1), LocalDate.now().plusDays(2), matematicaPri));
            tareas.add(crearTareaPrueba("El ciclo del agua", "Dibujar el ciclo del agua.", "Media", LocalDate.now(), LocalDate.now().plusDays(4), cienciaPri));
        }
        
        tareaRepo.saveAll(tareas);
    }
    
    private Tarea crearTareaPrueba(String titulo, String desc, String prioridad, LocalDate inicio, LocalDate fin, Curso curso) {
        Tarea t = new Tarea();
        t.setTitulo(titulo);
        t.setDescripcion(desc);
        t.setPrioridad(prioridad);
        t.setEstado("Pendiente");
        t.setFechaInicio(inicio);
        t.setFechaVencimiento(fin);
        t.setCurso(curso);
        return t;
    }
}
