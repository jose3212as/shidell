package org.example.shidell.service;

import org.example.shidell.model.entity.Asistencia;
import org.example.shidell.model.entity.Curso;
import org.example.shidell.model.entity.Matricula;
import org.example.shidell.model.entity.UserEntity;
import org.example.shidell.repository.AsistenciaRepository;
import org.example.shidell.repository.CursoRepository;
import org.example.shidell.repository.MatriculaRepository;
import org.example.shidell.util.AcademicCalendarUtil;
import org.example.shidell.util.AcademicGroupHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
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
    private MatriculaRepository matriculaRepository;

    public List<Asistencia> getAsistenciasCompletas(UserEntity estudiante) {
        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);

        // 1. Obtener cursos del estudiante
        List<Curso> cursos = grupo.isComplete()
                ? cursoRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno())
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

        // 3. Definir rango según bloques lectivos oficiales MINEDU (excluyendo vacaciones inter-bloque y feriados)
        LocalDate hoy = LocalDate.now();
        int anioEscolar = hoy.getYear();
        LocalDate fechaMatricula = (matriculaRepository != null && estudiante != null)
                ? matriculaRepository.findByEstudianteAndAnioEscolar(estudiante, anioEscolar)
                        .map(Matricula::getFechaMatricula)
                        .orElse(null)
                : null;
        List<AcademicCalendarUtil.BloqueLectivo> bloques = AcademicCalendarUtil.bloquesLectivos(anioEscolar);

        // 4. Inyectar "PRESENTE" únicamente en días lectivos programados hasta hoy (sin feriados ni recesos)
        for (Curso curso : cursos) {
            if (curso.getDiaSemana() == null || curso.getDiaSemana() < 1 || curso.getDiaSemana() > 7) continue;

            DayOfWeek diaObjetivo = DayOfWeek.of(curso.getDiaSemana());
            for (AcademicCalendarUtil.BloqueLectivo bloque : bloques) {
                if (bloque.inicio().isAfter(hoy)) {
                    break;
                }
                LocalDate techoBloque = bloque.fin().isBefore(hoy) ? bloque.fin() : hoy;
                LocalDate inicioBloque = (fechaMatricula != null && fechaMatricula.isAfter(bloque.inicio()))
                        ? fechaMatricula
                        : bloque.inicio();
                if (inicioBloque.isAfter(techoBloque)) {
                    continue;
                }

                LocalDate fecha = inicioBloque.with(TemporalAdjusters.nextOrSame(diaObjetivo));
                while (!fecha.isAfter(techoBloque)) {
                    String clave = curso.getId() + "|" + fecha.toString();
                    if (!AcademicCalendarUtil.esFeriado(fecha) && !mapaRegistradas.containsKey(clave)) {
                        Asistencia asis = new Asistencia();
                        asis.setEstudiante(estudiante);
                        asis.setCurso(curso);
                        asis.setFecha(fecha);
                        asis.setEstado("PRESENTE");
                        completas.add(asis);
                    }
                    fecha = fecha.plusWeeks(1);
                }
            }
        }

        return completas;
    }
}
