package org.example.shidell.config;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.model.entity.Aula;
import org.example.shidell.model.entity.Matricula;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.repository.AulaRepository;
import org.example.shidell.repository.MatriculaRepository;
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
    private static final String TURNO_PRIMARIA  = "MAÑANA";
    private static final String TURNO_SECUNDARIA = "TARDE";
    private static final Integer ANIO_ESCOLAR = 2026;
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
            AulaRepository aulaRepository,
            MatriculaRepository matriculaRepository,
            AuthSessionService authSessionService,
            TareaRepository tareaRepository,
            org.example.shidell.repository.EventoRepository eventoRepository,
            org.example.shidell.service.CalendarioMineduService mineduService) {
        return args -> {
            try {
                jdbcTemplate.execute("DELETE FROM cursos a USING cursos b " +
                        "WHERE a.id > b.id AND a.nombre = b.nombre AND a.aula_id = b.aula_id " +
                        "AND COALESCE(a.dia_semana, 0) = COALESCE(b.dia_semana, 0) " +
                        "AND COALESCE(a.hora_inicio, '') = COALESCE(b.hora_inicio, '')");

                jdbcTemplate.execute("DELETE FROM usuarios a USING usuarios b " +
                        "WHERE a.id > b.id AND a.email = b.email");
            } catch (Exception e) {
                System.out.println(">>> [INFO] Limpieza inicial omitida: " + e.getMessage());
            }

            UserEntity admin = asegurarAdministrador(userRepository, authSessionService);
            UserEntity padre = asegurarPadre(userRepository, "José", "Carlos", "padre@gmail.com", authSessionService);
            UserEntity tutorDemo = asegurarDocente(userRepository, authSessionService,
                    codigoPrimaria("1", "A", TURNO_PRIMARIA), "Docente Primaria", "1A Mañana");

            asegurarMallaAcademica(cursoRepository, userRepository, aulaRepository, authSessionService, eventoRepository, mineduService);
            
            Aula aulaDemo = asegurarAula(aulaRepository, "SECUNDARIA", "1", "A", TURNO_SECUNDARIA, ANIO_ESCOLAR);
            asegurarEstudianteDemo(userRepository, matriculaRepository, "Carlos", "Mendoza", "estudiante@shidell.edu", padre, tutorDemo, authSessionService, aulaDemo);

            asegurarTareasDemo(cursoRepository, tareaRepository);
            
            try {
                jdbcTemplate.execute("UPDATE usuarios SET rol = 'ARCHIVADO' WHERE rol = 'DOCENTE' AND email LIKE '%@shidell.edu' AND id NOT IN (SELECT DISTINCT docente_id FROM cursos WHERE docente_id IS NOT NULL)");
            } catch (Exception e) {
                System.out.println(">>> [INFO] Limpieza de docentes omitida: " + e.getMessage());
            }

            System.out.println("=================================================");
            System.out.println(">>> SHIDELL: malla semanal completa con Aulas y Matriculas <<<");
            System.out.println("=================================================");
        };
    }

    private Aula asegurarAula(AulaRepository repo, String nivel, String grado, String seccion, String turno, Integer anio) {
        return repo.findByNivelAndGradoAndSeccionAndTurnoAndAnioEscolar(nivel, grado, seccion, turno, anio)
                .orElseGet(() -> repo.save(new Aula(nivel, grado, seccion, turno, anio)));
    }

    private void asegurarMallaAcademica(CursoRepository cursoRepo, UserRepository userRepo, AulaRepository aulaRepo, AuthSessionService auth, org.example.shidell.repository.EventoRepository eventoRepo, org.example.shidell.service.CalendarioMineduService minedu) {
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
            crearHorarioNivel(cursoRepo, userRepo, aulaRepo, auth, mallaEsperada, examenesGenerados, eventoRepo, minedu, "PRIMARIA", String.valueOf(grado), primaria);
        }
        for (int grado = 1; grado <= 5; grado++) {
            crearHorarioNivel(cursoRepo, userRepo, aulaRepo, auth, mallaEsperada, examenesGenerados, eventoRepo, minedu, "SECUNDARIA", String.valueOf(grado), secundaria);
        }
    }

    private void crearHorarioNivel(
            CursoRepository cursoRepo, UserRepository userRepo, AulaRepository aulaRepo, AuthSessionService auth,
            Set<String> mallaEsperada, Set<String> examenesGenerados, org.example.shidell.repository.EventoRepository eventoRepo,
            org.example.shidell.service.CalendarioMineduService minedu, String nivel, String grado, List<AreaPlan> plan) {
        String turno = "PRIMARIA".equals(nivel) ? TURNO_PRIMARIA : TURNO_SECUNDARIA;
        String[][] horas = TURNO_SECUNDARIA.equals(turno) ? HORAS_TARDE : HORAS_MANANA;
        for (String seccion : SECCIONES) {
            Aula aula = asegurarAula(aulaRepo, nivel, grado, seccion, turno, ANIO_ESCOLAR);
            String semilla = nivel + grado + seccion;
            List<AreaPlan> semana = expandirSemana(plan, semilla);
            for (int i = 0; i < semana.size(); i++) {
                AreaPlan area = semana.get(i);
                int dia = (i / horas.length) + 1;
                String[] bloque = horas[i % horas.length];
                UserEntity docente = docentePara(userRepo, auth, nivel, grado, seccion, turno, area.nombre());
                crearSesion(cursoRepo, area, docente, aula, dia, bloque[0], bloque[1], examenesGenerados, eventoRepo, minedu);
                mallaEsperada.add(claveCurso(area.nombre(), nivel, grado, seccion, turno, dia, bloque[0]));
            }
        }
    }

    private List<AreaPlan> expandirSemana(List<AreaPlan> plan, String semilla) {
        AreaPlan[] semana = new AreaPlan[30];
        java.util.Random rand = new java.util.Random(semilla.hashCode());

        List<AreaPlan> bloques2h = new java.util.ArrayList<>();
        List<AreaPlan> bloques1h = new java.util.ArrayList<>();
        for (AreaPlan area : plan) {
            int horas = area.horasSemanales();
            while (horas >= 2) { bloques2h.add(area); horas -= 2; }
            if (horas == 1) bloques1h.add(area);
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
                    semana[d * 6 + pos] = bloque; semana[d * 6 + pos + 1] = bloque;
                    colocado = true; break;
                }
            }
            if (!colocado) {
                bloques1h.add(bloque); bloques1h.add(bloque);
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
                    colocado = true; break;
                }
            }
            if (!colocado) {
                for (int i = 0; i < 30; i++) {
                    if (semana[i] == null) { semana[i] = bloque; break; }
                }
            }
        }
        for (int i = 0; i < 30; i++) if (semana[i] == null) semana[i] = plan.get(0);
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
        int contiguos = 0, inicio = -1;
        for (int i = 0; i < 6; i++) {
            if (semana[dia * 6 + i] == null) {
                if (contiguos == 0) inicio = i;
                contiguos++;
                if (contiguos == tam) return inicio;
            } else { contiguos = 0; }
        }
        return -1;
    }

    private UserEntity docentePara(UserRepository repo, AuthSessionService auth, String nivel, String grado, String seccion, String turno, String area) {
        int g = 0; try { g = Integer.parseInt(grado); } catch (Exception ignored) {}
        String t = abreviar(turno);
        if ("PRIMARIA".equals(nivel)) {
            if (esAreaDeAulaPrimaria(area)) return asegurarDocente(repo, auth, "PLZ-PRI-AULA-" + grado + seccion + "-" + t, "Prof. de Aula", grado + "°" + seccion + " " + etiquetaTurno(turno));
            if ("Religión".equals(area)) return asegurarDocente(repo, auth, "PLZ-PRI-REL-ESCUELA", "Docente Religión", "Primaria");
            return asegurarDocente(repo, auth, "PLZ-PRI-" + abreviar(area) + "-" + t, "Docente " + area, "Primaria " + etiquetaTurno(turno));
        }
        if ("Religión".equals(area) || "Tutoría".equals(area) || "DPCC".equals(area) || "EPT".equals(area) || "Educación Física".equals(area) || "Arte y Cultura".equals(area) || "Ciencias Sociales".equals(area) || "Inglés".equals(area)) {
            return asegurarDocente(repo, auth, "PLZ-SEC-" + abreviar(area) + "-" + t, "Docente " + area, "Secundaria " + etiquetaTurno(turno));
        }
        if ("Ciencia y Tecnología".equals(area)) {
            String grupo = (g <= 3) ? "1-3" : "4-5";
            return asegurarDocente(repo, auth, "PLZ-SEC-CYT-G" + grupo + "-" + t, "Docente CyT", "G" + grupo + " " + etiquetaTurno(turno));
        }
        String grupo = (g <= 2) ? "1-2" : "3-5";
        return asegurarDocente(repo, auth, "PLZ-SEC-" + abreviar(area) + "-G" + grupo + "-" + t, "Docente " + area, "G" + grupo + " " + etiquetaTurno(turno));
    }

    private boolean esAreaDeAulaPrimaria(String area) {
        return List.of("Comunicación", "Matemática", "Ciencia y Tecnología", "Personal Social", "Tutoría", "Refuerzo Escolar").contains(area);
    }

    private void crearSesion(CursoRepository repo, AreaPlan area, UserEntity docente, Aula aula, Integer dia, String horaInicio, String horaFin, Set<String> examenesGenerados, org.example.shidell.repository.EventoRepository eventoRepo, org.example.shidell.service.CalendarioMineduService minedu) {
        Curso curso = repo.findByUniqueSession(area.nombre(), aula.getNivel(), aula.getGrado(), aula.getSeccion(), aula.getTurno(), dia, horaInicio).orElseGet(Curso::new);
        curso.setNombre(area.nombre());
        curso.setAula(aula);
        curso.setDiaSemana(dia);
        curso.setHoraInicio(horaInicio);
        curso.setHoraFin(horaFin);
        curso.setProfesor(docente);
        curso.setIcono(area.icono());
        curso.setColor(area.color());
        if (curso.getProgreso() == null) curso.setProgreso(0);
        repo.save(curso);
        
        String claveExamen = aula.getNivel() + "|" + aula.getGrado() + "|" + aula.getSeccion() + "|" + area.nombre();
        if (!examenesGenerados.contains(claveExamen)) {
            long count = eventoRepo.findByUsuarioAndTipo(docente, "EXAMEN").stream().filter(e -> e.getTitulo() != null && e.getTitulo().contains(area.nombre())).count();
            if (count == 0) eventoRepo.saveAll(minedu.generarExamenesBimestrales(curso));
            examenesGenerados.add(claveExamen);
        }
    }

    private String claveCurso(String nombre, String nivel, String grado, String seccion, String turno, Integer dia, String horaInicio) {
        return String.join("|", normalizar(nombre).toUpperCase(), String.valueOf(nivel), String.valueOf(grado), String.valueOf(seccion), String.valueOf(turno), String.valueOf(dia), String.valueOf(horaInicio));
    }

    private String codigoPrimaria(String grado, String seccion, String turno) {
        return "PLZ-PRI-AULA-" + grado + seccion + "-" + abreviar(turno);
    }

    private UserEntity asegurarDocente(UserRepository repo, AuthSessionService auth, String codigo, String nombres, String apellidos) {
        UserEntity u = repo.findByCodigoPlaza(codigo).orElseGet(UserEntity::new);
        u.setCodigoPlaza(codigo);
        if (u.getNombres() == null) u.setNombres(nombres);
        if (u.getApellidos() == null) u.setApellidos(apellidos);
        if (u.getEmail() == null) u.setEmail(emailPara(codigo));
        if (u.getPassword() == null) u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("DOCENTE");
        return repo.save(u);
    }

    private String emailPara(String codigo) { return normalizar(codigo).toLowerCase().replaceAll("[^a-z0-9]+", ".") + "@shidell.edu"; }

    private String abreviar(String valor) {
        String n = normalizar(valor).toUpperCase();
        Map<String, String> map = new HashMap<>();
        map.put("MANANA", "M"); map.put("TARDE", "T"); map.put("PRIMARIA", "PRI"); map.put("SECUNDARIA", "SEC");
        map.put("COMUNICACION", "COM"); map.put("MATEMATICA", "MAT"); map.put("CIENCIA Y TECNOLOGIA", "CYT");
        map.put("PERSONAL SOCIAL", "PSO"); map.put("CIENCIAS SOCIALES", "SOC"); map.put("INGLES", "ING");
        map.put("ARTE Y CULTURA", "ART"); map.put("EDUCACION FISICA", "EFI"); map.put("RELIGION", "REL");
        map.put("TUTORIA", "TUT"); map.put("REFUERZO ESCOLAR", "REF");
        return map.getOrDefault(n, n.replaceAll("[^A-Z0-9]", ""));
    }

    private String etiquetaTurno(String turno) { return "TARDE".equals(turno) ? "Tarde" : "Mañana"; }

    private String normalizar(String valor) { return Normalizer.normalize(valor == null ? "" : valor, Normalizer.Form.NFD).replaceAll("\\p{M}", ""); }

    private UserEntity asegurarAdministrador(UserRepository repo, AuthSessionService auth) {
        UserEntity u = repo.findByEmail("admin@shidell.edu").orElseGet(UserEntity::new);
        u.setNombres("Administrador"); u.setApellidos("Shidell"); u.setEmail("admin@shidell.edu");
        u.setPassword(auth.hashPassword(DEFAULT_PASSWORD)); u.setRol("ADMINISTRADOR");
        return repo.save(u);
    }

    private UserEntity asegurarPadre(UserRepository repo, String nombres, String apellidos, String email, AuthSessionService auth) {
        UserEntity u = repo.findByEmail(email).orElseGet(UserEntity::new);
        u.setNombres(nombres); u.setApellidos(apellidos); u.setEmail(email);
        if (u.getPassword() == null) u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("PADRE");
        return repo.save(u);
    }

    private void asegurarEstudianteDemo(UserRepository userRepo, MatriculaRepository matRepo, String nombres, String apellidos, String email, UserEntity padre, UserEntity tutor, AuthSessionService auth, Aula aula) {
        UserEntity u = userRepo.findByEmail(email).orElseGet(UserEntity::new);
        u.setNombres(nombres); u.setApellidos(apellidos); u.setEmail(email);
        if (u.getPassword() == null) u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("ESTUDIANTE"); u.setPadre(padre); u.setTutor(tutor);
        u = userRepo.save(u);

        Matricula m = matRepo.findByEstudianteAndAnioEscolar(u, aula.getAnioEscolar()).orElseGet(Matricula::new);
        m.setEstudiante(u); m.setAula(aula); m.setAnioEscolar(aula.getAnioEscolar());
        m.setFechaMatricula(LocalDate.now()); m.setEstado("ACTIVO");
        matRepo.save(m);
    }

    private record AreaPlan(String nombre, int horasSemanales, String icono, String color) {}

    private void asegurarTareasDemo(CursoRepository cursoRepo, TareaRepository tareaRepo) {
        List<Curso> cursosSecundaria = cursoRepo.findByGrupoAcademico("SECUNDARIA", "1", "A", "TARDE");
        if (cursosSecundaria.isEmpty()) return;
        List<Tarea> existingTasks = tareaRepo.findAll();
        if (!existingTasks.isEmpty()) return;
        
        java.util.List<Tarea> tareas = new java.util.ArrayList<>();
        Curso matematica = cursosSecundaria.stream().filter(c -> c.getNombre().equalsIgnoreCase("Matemática")).findFirst().orElse(cursosSecundaria.get(0));
        tareas.add(crearTareaPrueba("Resolver Ejercicios de Álgebra", "Resolver página 45", "Alta", LocalDate.now().minusDays(2), LocalDate.now().plusDays(3), matematica));
        tareaRepo.saveAll(tareas);
    }
    
    private Tarea crearTareaPrueba(String titulo, String desc, String prioridad, LocalDate inicio, LocalDate fin, Curso curso) {
        Tarea t = new Tarea(); t.setTitulo(titulo); t.setDescripcion(desc); t.setPrioridad(prioridad); t.setEstado("Pendiente");
        t.setFechaInicio(inicio); t.setFechaVencimiento(fin); t.setCurso(curso);
        return t;
    }
}
