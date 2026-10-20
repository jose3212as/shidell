package org.example.shidell.service;

import org.example.shidell.model.entity.Asistencia;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.AsistenciaRepository;
import org.example.shidell.repository.CursoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AsistenciaService {

    @Autowired
    private AsistenciaRepository asistenciaRepository;
    
    @Autowired
    private CursoRepository cursoRepository;

    @Autowired
    private org.example.shidell.repository.MatriculaRepository matriculaRepository;

    public List<Asistencia> getAsistenciasCompletas(UserEntity estudiante) {
        String nivel = estudiante.getNivel();
        String grado = estudiante.getGrado();
        String seccion = estudiante.getSeccion();
        String turno = estudiante.getTurno();

        if (nivel == null || grado == null || seccion == null) {
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
            }
        }

        // 1. Obtener cursos del estudiante
        List<Curso> cursos = (nivel != null && grado != null && seccion != null)
                ? cursoRepository.findByGrupoAcademico(nivel, grado, seccion, turno)
                : List.of();

        // 2. Obtener asistencias reales guardadas en DB
        List<Asistencia> registradas = asistenciaRepository.findByEstudiante(estudiante);
        Map<String, Asistencia> mapaRegistradas = registradas.stream()
                .collect(Collectors.toMap(
                        a -> (a.getCurso() != null ? a.getCurso().getId() : "0") + "|" + a.getFecha().toString(),
                        a -> a,
                        (existing, replacement) -> existing
                ));

        List<Asistencia> completas = new ArrayList<>(registradas);

        // 3. Definir rango escolar (Marzo 1 hasta HOY)
        LocalDate inicioClases = LocalDate.of(LocalDate.now().getYear(), 3, 1);
        LocalDate hoy = LocalDate.now();

        // 4. Inyectar "PRESENTE" en días pasados donde hubo clase pero el profesor no guardó nada
        for (Curso curso : cursos) {
            if (curso.getDiaSemana() == null) continue;
            
            LocalDate fecha = inicioClases;
            while (!fecha.isAfter(hoy)) {
                if (fecha.getDayOfWeek().getValue() == curso.getDiaSemana()) {
                    String clave = curso.getId() + "|" + fecha.toString();
                    if (!mapaRegistradas.containsKey(clave)) {
                        Asistencia asis = new Asistencia();
                        asis.setEstudiante(estudiante);
                        asis.setCurso(curso);
                        asis.setFecha(fecha);
                        asis.setEstado("PRESENTE");
                        completas.add(asis);
                    }
                }
                fecha = fecha.plusDays(1);
            }
        }
        
        return completas;
    }
}
