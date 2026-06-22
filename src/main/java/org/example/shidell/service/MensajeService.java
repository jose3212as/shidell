package org.example.shidell.service;

import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.*;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.repository.*;
import org.example.shidell.util.FileUploadUtil;
import org.example.shidell.util.TextUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MensajeService {
    @Autowired
    private MensajeRepository mensajeRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CursoRepository cursoRepository;
    @Autowired
    private EntityMapper mapper;
    public Long contarMensajesNoLeidos(Long usuarioId) {
        UserEntity u = userRepository.findById(usuarioId).orElseThrow();
        return (long) mensajeRepository.findByDestinatarioAndLeidoFalse(u).size();
    }

    public MensajeDTO enviarMensaje(Long remitenteId, Long destinatarioId, Long cursoId, String contenido, MultipartFile archivo) {
        UserEntity remitente = userRepository.findById(remitenteId).orElseThrow();
        UserEntity destinatario = userRepository.findById(destinatarioId).orElseThrow();

        Mensaje mensaje = new Mensaje();
        mensaje.setRemitente(remitente);
        mensaje.setDestinatario(destinatario);
        mensaje.setContenido(contenido);
        mensaje.setFechaEnvio(LocalDateTime.now());
        mensaje.setLeido(false);

        if (cursoId != null) {
            mensaje.setCurso(cursoRepository.findById(cursoId).orElse(null));
        }

        String archivoUrl = FileUploadUtil.saveFile("mensajes", archivo);
        if (archivoUrl != null) {
            mensaje.setArchivoUrl(archivoUrl);
        }

        return mapper.toDTO(mensajeRepository.save(mensaje));
    }

    public List<MensajeDTO> obtenerConversacion(Long u1Id, Long u2Id, Long cursoId) {
        UserEntity u1 = userRepository.findById(u1Id).orElseThrow();
        UserEntity u2 = userRepository.findById(u2Id).orElseThrow();
        
        List<Mensaje> conversation = mensajeRepository.findConversation(u1, u2, cursoId);
        
        conversation.stream()
            .filter(m -> m.getDestinatario().getId().equals(u1Id) && !m.getLeido())
            .forEach(m -> {
                m.setLeido(true);
                mensajeRepository.save(m);
            });
            
        return conversation.stream().map(mapper::toDTO).toList();
    }

    public Map<String, Object> obtenerConversacionConMetadata(Long usuarioId, Long contactoId, Long cursoId) {
        UserEntity usuario = userRepository.findById(usuarioId).orElseThrow();
        UserEntity contacto = userRepository.findById(contactoId).orElseThrow();
        
        List<MensajeDTO> mensajes = obtenerConversacion(usuarioId, contactoId, cursoId);

        Map<String, Object> res = new HashMap<>();
        res.put("usuario", mapper.toDTO(usuario));
        res.put("contacto", mapper.toDTO(contacto));
        res.put("cursoSeleccionado", cursoId);
        res.put("mensajes", mensajes);
        return res;
    }

    public Map<String, Object> obtenerBandejaEstudiante(Long estudianteId, Long cursoId) {
        UserEntity estudiante = userRepository.findById(estudianteId).orElseThrow();
        List<Curso> cursos = cursosDelEstudiante(estudiante);
        Set<Long> cursosPermitidos = cursos.stream().map(Curso::getId).filter(Objects::nonNull).collect(Collectors.toSet());

        Long cursoFiltrado = (cursoId != null && cursosPermitidos.contains(cursoId)) ? cursoId : null;
        LinkedHashMap<Long, UserEntity> contactos = new LinkedHashMap<>();

        mensajeRepository.findAllByUser(estudiante, cursoFiltrado).forEach(mensaje -> {
            UserEntity otro = mensaje.getRemitente().getId().equals(estudianteId) ? mensaje.getDestinatario() : mensaje.getRemitente();
            if (otro != null && !otro.getId().equals(estudianteId)) {
                contactos.putIfAbsent(otro.getId(), otro);
            }
        });

        List<UserEntity> permitidos = (cursoFiltrado != null) ? obtenerParticipantesCurso(cursoFiltrado) : contactosAcademicos(estudiante, cursos);
        permitidos.forEach(c -> {
            if (c != null && !c.getId().equals(estudianteId)) contactos.putIfAbsent(c.getId(), c);
        });

        List<Map<String, Object>> conversaciones = contactos.values().stream()
                .map(contacto -> resumenConversacion(estudiante, contacto, cursoFiltrado))
                .sorted((a, b) -> String.valueOf(b.get("fechaUltimoMensaje")).compareTo(String.valueOf(a.get("fechaUltimoMensaje"))))
                .toList();

        Map<String, Object> res = new HashMap<>();
        res.put("estudiante", mapper.toDTO(estudiante));
        res.put("cursos", cursos.stream().map(mapper::toDTO).toList());
        res.put("conversaciones", conversaciones);
        res.put("cursoSeleccionado", cursoFiltrado);
        res.put("noLeidos", contarMensajesNoLeidos(estudianteId));
        return res;
    }

    public Map<String, Object> obtenerBandejaDocente(Long docenteId, Long cursoId) {
        UserEntity docente = userRepository.findById(docenteId).orElseThrow();
        List<Curso> cursos = cursosDelDocente(docente);
        Set<Long> cursosPermitidos = cursos.stream().map(Curso::getId).filter(Objects::nonNull).collect(Collectors.toSet());

        Long cursoFiltrado = (cursoId != null && cursosPermitidos.contains(cursoId)) ? cursoId : null;
        LinkedHashMap<Long, UserEntity> contactos = new LinkedHashMap<>();

        mensajeRepository.findAllByUser(docente, cursoFiltrado).forEach(mensaje -> {
            UserEntity otro = mensaje.getRemitente().getId().equals(docenteId) ? mensaje.getDestinatario() : mensaje.getRemitente();
            if (otro != null && !otro.getId().equals(docenteId)) contactos.putIfAbsent(otro.getId(), otro);
        });

        List<UserEntity> permitidos = (cursoFiltrado != null) ? estudiantesDelCurso(cursoRepository.findById(cursoFiltrado).orElse(null)) : contactosDocente(cursos, docenteId);
        permitidos.forEach(c -> {
            if (c != null && !c.getId().equals(docenteId)) contactos.putIfAbsent(c.getId(), c);
        });

        List<Map<String, Object>> conversaciones = contactos.values().stream()
                .map(contacto -> resumenConversacion(docente, contacto, cursoFiltrado))
                .sorted((a, b) -> String.valueOf(b.get("fechaUltimoMensaje")).compareTo(String.valueOf(a.get("fechaUltimoMensaje"))))
                .toList();

        Map<String, Object> res = new HashMap<>();
        res.put("docente", mapper.toDTO(docente));
        res.put("cursos", cursos.stream().map(mapper::toDTO).toList());
        res.put("conversaciones", conversaciones);
        res.put("cursoSeleccionado", cursoFiltrado);
        res.put("noLeidos", contarMensajesNoLeidos(docenteId));
        return res;
    }

    public List<UserEntity> obtenerParticipantesCurso(Long cursoId) {
        Curso curso = cursoRepository.findById(cursoId).orElseThrow();
        List<UserEntity> participants = new ArrayList<>();
        if (curso.getProfesor() != null) participants.add(curso.getProfesor());
        participants.addAll(userRepository.findByGrupoAcademico(curso.getNivel(), curso.getGrado(), curso.getSeccion(), curso.getTurno()));
        return participants;
    }

    private List<Curso> cursosDelEstudiante(UserEntity estudiante) {
        if (estudiante.getNivel() == null || estudiante.getGrado() == null || estudiante.getSeccion() == null) return List.of();
        LinkedHashMap<String, Curso> cursos = new LinkedHashMap<>();
        cursoRepository.findByGrupoAcademico(estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion(), estudiante.getTurno())
                .forEach(c -> cursos.putIfAbsent(TextUtils.claveCurso(c.getNombre(), c.getId()), c));
        return new ArrayList<>(cursos.values());
    }

    private List<Curso> cursosDelDocente(UserEntity docente) {
        if (docente == null) return List.of();
        LinkedHashMap<String, Curso> unicos = new LinkedHashMap<>();
        cursoRepository.findByProfesor(docente).forEach(c -> unicos.putIfAbsent(TextUtils.claveCurso(c.getNombre(), c.getId()), c));
        return new ArrayList<>(unicos.values());
    }

    private List<UserEntity> estudiantesDelCurso(Curso curso) {
        if (curso == null || curso.getNivel() == null || curso.getGrado() == null || curso.getSeccion() == null) return List.of();
        return userRepository.findByGrupoAcademico(curso.getNivel(), curso.getGrado(), curso.getSeccion(), curso.getTurno())
                .stream().filter(u -> "ESTUDIANTE".equalsIgnoreCase(u.getRol())).toList();
    }

    private List<UserEntity> contactosDocente(List<Curso> cursos, Long docenteId) {
        LinkedHashMap<Long, UserEntity> contactos = new LinkedHashMap<>();
        for (Curso c : cursos) {
            estudiantesDelCurso(c).forEach(u -> {
                if (u.getId() != null && !u.getId().equals(docenteId)) contactos.putIfAbsent(u.getId(), u);
            });
        }
        return new ArrayList<>(contactos.values());
    }

    private List<UserEntity> contactosAcademicos(UserEntity estudiante, List<Curso> cursos) {
        LinkedHashMap<Long, UserEntity> contactos = new LinkedHashMap<>();
        if (estudiante.getNivel() != null && estudiante.getGrado() != null && estudiante.getSeccion() != null) {
            userRepository.findByGrupoAcademico(estudiante.getNivel(), estudiante.getGrado(), estudiante.getSeccion(), estudiante.getTurno())
                    .stream().filter(u -> !u.getId().equals(estudiante.getId())).forEach(u -> contactos.putIfAbsent(u.getId(), u));
        }
        cursos.stream().map(Curso::getProfesor).filter(Objects::nonNull).forEach(u -> contactos.putIfAbsent(u.getId(), u));
        if (estudiante.getTutor() != null) contactos.putIfAbsent(estudiante.getTutor().getId(), estudiante.getTutor());
        return new ArrayList<>(contactos.values());
    }

    private Map<String, Object> resumenConversacion(UserEntity usuario, UserEntity contacto, Long cursoId) {
        List<Mensaje> mensajes = mensajeRepository.findConversation(usuario, contacto, cursoId);
        Mensaje ultimo = mensajes.isEmpty() ? null : mensajes.get(mensajes.size() - 1);
        long noLeidos = mensajes.stream().filter(m -> m.getDestinatario().getId().equals(usuario.getId()) && !Boolean.TRUE.equals(m.getLeido())).count();

        Map<String, Object> item = new HashMap<>();
        item.put("contacto", mapper.toDTO(contacto));
        item.put("ultimoMensaje", mapper.toDTO(ultimo));
        item.put("preview", construirPreview(ultimo, contacto));
        item.put("fechaUltimoMensaje", ultimo != null ? ultimo.getFechaEnvio().toString() : "");
        item.put("noLeidos", noLeidos);
        item.put("tieneMensajes", ultimo != null);
        return item;
    }

    private String construirPreview(Mensaje mensaje, UserEntity contacto) {
        if (mensaje == null) return "DOCENTE".equals(contacto.getRol()) ? "Docente" : "Contacto académico";
        if (mensaje.getContenido() != null && !mensaje.getContenido().isBlank()) return TextUtils.limpiarTexto(mensaje.getContenido());
        return "Archivo adjunto";
    }

    public List<Map<String, Object>> obtenerContactosRecientes(Long usuarioId) {
        UserEntity usuario = userRepository.findById(usuarioId).orElseThrow();
        List<UserEntity> contactos = mensajeRepository.findDistinctContacts(usuario, null);
        
        List<Map<String, Object>> res = new ArrayList<>();
        for (UserEntity c : contactos) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", c.getId());
            map.put("nombres", TextUtils.limpiarTexto(c.getNombres()));
            map.put("apellidos", TextUtils.limpiarTexto(c.getApellidos()));
            map.put("rol", c.getRol());
            map.put("fotoPerfil", c.getFotoPerfil());
            
            long noLeidos = mensajeRepository.findConversation(usuario, c, null).stream()
                .filter(m -> m.getDestinatario().getId().equals(usuarioId) && !Boolean.TRUE.equals(m.getLeido()))
                .count();
            map.put("noLeidos", noLeidos);
            res.add(map);
        }
        return res;
    }
}
