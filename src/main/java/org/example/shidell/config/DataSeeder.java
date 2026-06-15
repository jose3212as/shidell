package org.example.shidell.config;

import org.example.shidell.model.entity.*;
import org.example.shidell.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.*;

@Configuration
public class DataSeeder {

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Bean
    CommandLineRunner initDatabase(
            CursoRepository cursoRepository, 
            UserRepository userRepository) {
        return args -> {
            try {
                // 1. Eliminar cursos exactamente iguales (nombre, nivel, grado, seccion, dia, hora)
                jdbcTemplate.execute("DELETE FROM cursos a USING cursos b " +
                    "WHERE a.id > b.id AND a.nombre = b.nombre AND a.nivel = b.nivel " +
                    "AND a.grado = b.grado AND a.seccion = b.seccion " +
                    "AND a.dia_semana = b.dia_semana AND a.hora_inicio = b.hora_inicio");
                
                // 2. Eliminar usuarios repetidos por email
                jdbcTemplate.execute("DELETE FROM usuarios a USING usuarios b " +
                    "WHERE a.id > b.id AND a.email = b.email");
            } catch (Exception e) {
                System.out.println(">>> [!] Error en deduplicación: " + e.getMessage());
            }

            // Verificar si faltan datos base
            long totalUsuarios = userRepository.count();
            long totalCursos = cursoRepository.count();

            asegurarAdministrador(userRepository);
            
            // Asegurar estudiante de prueba (para que siempre esté disponible para el usuario)
            UserEntity pMat = asegurarDocente(userRepository, "Ana", "López", "ana@shidell.edu");
            UserEntity padre = repoPadre(userRepository, "José", "Carlos", "padre@gmail.com");
            repoEstudiante(userRepository, "Carlos", "Mendoza", "estudiante@shidell.edu", padre, pMat);

            if (totalUsuarios > 0 || totalCursos > 0) {
                System.out.println(">>> [INFO] Datos detectados. Saltando seeder inicial.");
                return;
            }

            System.out.println(">>> [INFO] Base de datos vacía. Iniciando carga inicial...");

            // 1. CREAR STAFF DE PROFESORES
            pMat = asegurarDocente(userRepository, "Ana", "López", "ana@shidell.edu");
            UserEntity pLet = asegurarDocente(userRepository, "Pedro", "García", "pedro@shidell.edu");
            UserEntity pCien = asegurarDocente(userRepository, "Marta", "Ruiz", "marta@shidell.edu");
            UserEntity pArt = asegurarDocente(userRepository, "Luis", "Torres", "luis@shidell.edu");

            // 2. MALLA BASE
            Object[][] baseMalla = {
                {"Matemática", 1, "13:30", "15:30", pMat},
                {"Inglés", 1, "15:45", "18:00", pLet},
                {"Comunicación", 2, "13:30", "15:30", pLet},
                {"Arte y Cultura", 2, "15:45", "18:00", pArt},
                {"Ciencia y Tecnología", 3, "13:30", "15:30", pCien},
                {"Educación Física", 3, "15:45", "18:00", pArt},
                {"Ciencias Sociales", 4, "13:30", "15:30", pCien},
                {"Religión", 4, "15:45", "17:15", pCien},
                {"Tutoría", 4, "17:15", "18:15", pMat},
                {"DPCC", 5, "13:30", "15:30", pCien},
                {"EPT", 5, "15:45", "18:15", pMat}
            };

            String[] secciones = {"A", "B", "C"};
            Set<String> ocupacionProfesores = new HashSet<>();

            for (String seccion : secciones) {
                for (Object[] row : baseMalla) {
                    String nombre = (String) row[0];
                    Integer dia = (Integer) row[1];
                    String inicio = (String) row[2];
                    String fin = (String) row[3];
                    UserEntity prof = (UserEntity) row[4];

                    int diaAjustado = dia;
                    while (ocupacionProfesores.contains(prof.getId() + "-" + diaAjustado + "-" + inicio)) {
                        diaAjustado = (diaAjustado % 5) + 1; 
                    }
                    ocupacionProfesores.add(prof.getId() + "-" + diaAjustado + "-" + inicio);

                    Curso c = new Curso();
                    c.setNombre(nombre);
                    c.setDiaSemana(diaAjustado);
                    c.setHoraInicio(inicio);
                    c.setHoraFin(fin);
                    c.setProfesor(prof);
                    c.setNivel("SECUNDARIA");
                    c.setGrado("1");
                    c.setSeccion(seccion);
                    c.setIcono("ph-book");
                    c.setColor("blue");
                    c.setProgreso(15);
                    cursoRepository.save(c);
                }
            }

            System.out.println("=================================================");
            System.out.println(">>> CARGA INICIAL COMPLETADA CON ÉXITO <<<");
            System.out.println(">>> Estudiante: estudiante@shidell.edu / 123456");
            System.out.println(">>> Administrador: admin@shidell.edu / 123456");
            System.out.println("=================================================");
        };
    }

    private UserEntity asegurarDocente(UserRepository repo, String nom, String ape, String email) {
        UserEntity u = repo.findByEmail(email).orElse(new UserEntity());
        u.setNombres(nom); u.setApellidos(ape); u.setEmail(email); u.setPassword("123456"); u.setRol("DOCENTE");
        return repo.save(u);
    }

    private UserEntity repoPadre(UserRepository repo, String nom, String ape, String email) {
        UserEntity u = repo.findByEmail(email).orElse(new UserEntity());
        u.setNombres(nom); u.setApellidos(ape); u.setEmail(email); u.setPassword("123456"); u.setRol("PADRE");
        return repo.save(u);
    }

    private UserEntity repoEstudiante(UserRepository repo, String nom, String ape, String email, UserEntity padre, UserEntity tutor) {
        UserEntity u = repo.findByEmail(email).orElse(new UserEntity());
        u.setNombres(nom); u.setApellidos(ape); u.setEmail(email); u.setPassword("123456"); u.setRol("ESTUDIANTE");
        u.setNivel("SECUNDARIA"); u.setGrado("1"); u.setSeccion("A");
        u.setPadre(padre); u.setTutor(tutor);
        return repo.save(u);
    }

    private UserEntity asegurarAdministrador(UserRepository repo) {
        UserEntity u = repo.findByEmail("admin@shidell.edu").orElse(new UserEntity());
        u.setNombres("Administrador");
        u.setApellidos("Shidell");
        u.setEmail("admin@shidell.edu");
        u.setPassword("123456");
        u.setRol("ADMINISTRADOR");
        return repo.save(u);
    }
}
