package org.example.shidell.config;

import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.UserRepository;
import org.example.shidell.service.AuthSessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Configuration
public class DataSeeder {

    private static final String DEFAULT_PASSWORD = "123456";
    private static final String[] SECCIONES = {"A", "B", "C"};
    private static final String[] TURNOS = {"MAÑANA", "TARDE"};
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
            AuthSessionService authSessionService) {
        return args -> {
            deduplicarDatosAntiguos();
            normalizarTurnosCursosExistentes(cursoRepository);

            UserEntity admin = asegurarAdministrador(userRepository, authSessionService);
            Map<String, UserEntity> docentes = asegurarPlazasDocentes(userRepository, authSessionService);

            UserEntity docenteTutor = docentes.get("PLZ-PRI-AULA-01");
            UserEntity padre = asegurarPadre(userRepository, "José", "Carlos", "padre@gmail.com", authSessionService);
            asegurarEstudianteDemo(userRepository, "Carlos", "Mendoza", "estudiante@shidell.edu", padre, docenteTutor, authSessionService);

            asegurarMallaAcademica(cursoRepository, docentes);

            System.out.println("=================================================");
            System.out.println(">>> SHIDELL: malla fija y plazas docentes listas <<<");
            System.out.println(">>> Administrador: " + admin.getEmail() + " / " + DEFAULT_PASSWORD);
            System.out.println(">>> Estudiante demo: estudiante@shidell.edu / " + DEFAULT_PASSWORD);
            System.out.println("=================================================");
        };
    }

    private void deduplicarDatosAntiguos() {
        try {
            jdbcTemplate.execute("DELETE FROM cursos a USING cursos b " +
                    "WHERE a.id > b.id AND a.nombre = b.nombre AND a.nivel = b.nivel " +
                    "AND a.grado = b.grado AND a.seccion = b.seccion " +
                    "AND COALESCE(a.turno, '') = COALESCE(b.turno, '')");

            jdbcTemplate.execute("DELETE FROM usuarios a USING usuarios b " +
                    "WHERE a.id > b.id AND a.email = b.email");
        } catch (Exception e) {
            System.out.println(">>> [INFO] Limpieza inicial omitida: " + e.getMessage());
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

    private Map<String, UserEntity> asegurarPlazasDocentes(UserRepository repo, AuthSessionService auth) {
        Map<String, UserEntity> docentes = new HashMap<>();
        docentes.put("PLZ-PRI-AULA-01", asegurarDocente(repo, auth, "PLZ-PRI-AULA-01", "María", "Quispe", "primaria1@shidell.edu"));
        docentes.put("PLZ-PRI-AULA-02", asegurarDocente(repo, auth, "PLZ-PRI-AULA-02", "Jorge", "Ramos", "primaria2@shidell.edu"));
        docentes.put("PLZ-MAT", asegurarDocente(repo, auth, "PLZ-MAT", "Ana", "López", "ana@shidell.edu"));
        docentes.put("PLZ-COM", asegurarDocente(repo, auth, "PLZ-COM", "Pedro", "García", "pedro@shidell.edu"));
        docentes.put("PLZ-CIE", asegurarDocente(repo, auth, "PLZ-CIE", "Marta", "Ruiz", "marta@shidell.edu"));
        docentes.put("PLZ-ING", asegurarDocente(repo, auth, "PLZ-ING", "Sofía", "Torres", "sofia@shidell.edu"));
        docentes.put("PLZ-EFI", asegurarDocente(repo, auth, "PLZ-EFI", "Luis", "Torres", "luis@shidell.edu"));
        docentes.put("PLZ-ART", asegurarDocente(repo, auth, "PLZ-ART", "Carla", "Vega", "carla@shidell.edu"));
        docentes.put("PLZ-SOC", asegurarDocente(repo, auth, "PLZ-SOC", "Diego", "Flores", "diego@shidell.edu"));
        docentes.put("PLZ-REL", asegurarDocente(repo, auth, "PLZ-REL", "Elena", "Paz", "elena@shidell.edu"));
        docentes.put("PLZ-EPT", asegurarDocente(repo, auth, "PLZ-EPT", "Raúl", "Medina", "raul@shidell.edu"));
        docentes.put("PLZ-TUT", asegurarDocente(repo, auth, "PLZ-TUT", "Laura", "Salazar", "laura@shidell.edu"));
        return docentes;
    }

    private UserEntity asegurarDocente(UserRepository repo, AuthSessionService auth, String codigo, String nombres, String apellidos, String email) {
        UserEntity u = repo.findByCodigoPlaza(codigo)
                .or(() -> repo.findByEmail(email))
                .orElseGet(UserEntity::new);
        u.setCodigoPlaza(codigo);
        if (u.getNombres() == null || u.getNombres().isBlank()) u.setNombres(nombres);
        if (u.getApellidos() == null || u.getApellidos().isBlank()) u.setApellidos(apellidos);
        if (u.getEmail() == null || u.getEmail().isBlank()) u.setEmail(email);
        if (u.getPassword() == null || u.getPassword().isBlank()) u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("DOCENTE");
        return repo.save(u);
    }

    private void asegurarMallaAcademica(CursoRepository repo, Map<String, UserEntity> docentes) {
        List<Asignatura> primaria = List.of(
                new Asignatura("Comunicación", "PLZ-PRI-AULA-01", "ph-book-open", "blue"),
                new Asignatura("Matemática", "PLZ-PRI-AULA-01", "ph-calculator", "purple"),
                new Asignatura("Ciencia y Tecnología", "PLZ-PRI-AULA-02", "ph-flask", "green"),
                new Asignatura("Personal Social", "PLZ-PRI-AULA-02", "ph-globe", "cyan"),
                new Asignatura("Inglés", "PLZ-ING", "ph-translate", "yellow"),
                new Asignatura("Arte y Cultura", "PLZ-ART", "ph-paint-brush", "orange"),
                new Asignatura("Educación Física", "PLZ-EFI", "ph-soccer-ball", "red"),
                new Asignatura("Religión", "PLZ-REL", "ph-hands-praying", "green"),
                new Asignatura("Tutoría", "PLZ-TUT", "ph-users-three", "purple")
        );

        List<Asignatura> secundaria = List.of(
                new Asignatura("Comunicación", "PLZ-COM", "ph-book-open", "blue"),
                new Asignatura("Matemática", "PLZ-MAT", "ph-calculator", "purple"),
                new Asignatura("Inglés", "PLZ-ING", "ph-translate", "yellow"),
                new Asignatura("Ciencia y Tecnología", "PLZ-CIE", "ph-flask", "green"),
                new Asignatura("Ciencias Sociales", "PLZ-SOC", "ph-globe", "cyan"),
                new Asignatura("DPCC", "PLZ-SOC", "ph-scales", "orange"),
                new Asignatura("EPT", "PLZ-EPT", "ph-wrench", "red"),
                new Asignatura("Educación Física", "PLZ-EFI", "ph-soccer-ball", "green"),
                new Asignatura("Arte y Cultura", "PLZ-ART", "ph-paint-brush", "orange"),
                new Asignatura("Religión", "PLZ-REL", "ph-hands-praying", "green"),
                new Asignatura("Tutoría", "PLZ-TUT", "ph-users-three", "purple")
        );

        for (int grado = 1; grado <= 6; grado++) {
            crearCursosNivel(repo, docentes, "PRIMARIA", String.valueOf(grado), primaria);
        }
        for (int grado = 1; grado <= 5; grado++) {
            crearCursosNivel(repo, docentes, "SECUNDARIA", String.valueOf(grado), secundaria);
        }
    }

    private void crearCursosNivel(CursoRepository repo, Map<String, UserEntity> docentes, String nivel, String grado, List<Asignatura> asignaturas) {
        for (String seccion : SECCIONES) {
            for (String turno : TURNOS) {
                String[][] horas = "TARDE".equals(turno) ? HORAS_TARDE : HORAS_MANANA;
                for (int i = 0; i < asignaturas.size(); i++) {
                    Asignatura asignatura = asignaturas.get(i);
                    int dia = (i % 5) + 1;
                    String[] bloque = horas[(i / 5) % horas.length];
                    Curso curso = repo.findByNombreAndNivelAndGradoAndSeccionAndTurno(
                            asignatura.nombre(), nivel, grado, seccion, turno).orElseGet(Curso::new);

                    curso.setNombre(asignatura.nombre());
                    curso.setNivel(nivel);
                    curso.setGrado(grado);
                    curso.setSeccion(seccion);
                    curso.setTurno(turno);
                    curso.setDiaSemana(dia);
                    curso.setHoraInicio(bloque[0]);
                    curso.setHoraFin(bloque[1]);
                    curso.setProfesor(docentes.get(asignatura.codigoDocente()));
                    curso.setIcono(asignatura.icono());
                    curso.setColor(asignatura.color());
                    if (curso.getProgreso() == null) curso.setProgreso(0);
                    repo.save(curso);
                }
            }
        }
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
            AuthSessionService auth) {
        UserEntity u = repo.findByEmail(email).orElseGet(UserEntity::new);
        u.setNombres(nombres);
        u.setApellidos(apellidos);
        u.setEmail(email);
        if (u.getPassword() == null || u.getPassword().isBlank()) u.setPassword(auth.hashPassword(DEFAULT_PASSWORD));
        u.setRol("ESTUDIANTE");
        u.setNivel("SECUNDARIA");
        u.setGrado("1");
        u.setSeccion("A");
        u.setTurno("TARDE");
        u.setPadre(padre);
        u.setTutor(tutor);
        return repo.save(u);
    }

    private record Asignatura(String nombre, String codigoDocente, String icono, String color) {}
}
