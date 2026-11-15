package org.example.shidell.service;

import org.example.shidell.exception.BadRequestException;
import org.example.shidell.model.entity.*;
import org.example.shidell.model.dto.*;
import org.example.shidell.mapper.EntityMapper;
import org.example.shidell.repository.*;
import org.example.shidell.util.AcademicGroupHelper;
import org.example.shidell.util.AccessControlHelper;
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
    private org.example.shidell.repository.MatriculaRepository matriculaRepository;
    @Autowired(required = false)
    private NotificacionService notificacionService;
    @Autowired
    private EntityMapper mapper;
    public Long contarMensajesNoLeidos(Long usuarioId) {
        UserEntity u = userRepository.findById(usuarioId).orElseThrow();
        return mensajeRepository.countByDestinatarioAndLeidoFalse(u);
    }

    public MensajeDTO enviarMensaje(Long remitenteId, Long destinatarioId, Long cursoId, String contenido, MultipartFile archivo) {
        return enviarMensaje(remitenteId, destinatarioId, cursoId, contenido, archivo, null);
    }

    public MensajeDTO enviarMensaje(Long remitenteId, Long destinatarioId, Long cursoId, String contenido, MultipartFile archivo, UserEntity authUser) {
        if (authUser != null) {
            AccessControlHelper.requireSelfOrAdmin(authUser, remitenteId, "No puedes enviar mensajes en nombre de otro usuario.");
        }
        if (Objects.equals(remitenteId, destinatarioId)) {
            throw new BadRequestException("No puedes enviarte mensajes a ti mismo.");
        }
        String textoLimpio = contenido != null ? TextUtils.limpiarTexto(contenido) : "";
        boolean hasArchivo = archivo != null && !archivo.isEmpty();
        if (textoLimpio.isBlank() && !hasArchivo) {
            throw new BadRequestException("Escribe un mensaje o adjunta un archivo antes de enviar.");
        }

        UserEntity remitente = userRepository.findById(remitenteId).orElseThrow();
        UserEntity destinatario = userRepository.findById(destinatarioId).orElseThrow();

        Mensaje mensaje = new Mensaje();
        mensaje.setRemitente(remitente);
        mensaje.setDestinatario(destinatario);
        mensaje.setContenido(textoLimpio);
        mensaje.setFechaEnvio(LocalDateTime.now());
        mensaje.setLeido(false);

        if (cursoId != null) {
            mensaje.setCurso(cursoRepository.findById(cursoId).orElse(null));
        }

        String archivoUrl = FileUploadUtil.saveFile("mensajes", archivo);
        if (archivoUrl != null) {
            mensaje.setArchivoUrl(archivoUrl);
        }

        MensajeDTO guardado = mapper.toDTO(mensajeRepository.save(mensaje));
        if (notificacionService != null) {
            String nombreRem = TextUtils.limpiarTexto(remitente.getNombres() != null ? remitente.getNombres() : "Usuario");
            String preview = !textoLimpio.isBlank() ? textoLimpio : "Archivo adjunto";
            if (preview.length() > 90) {
                preview = preview.substring(0, 87) + "...";
            }
            notificacionService.crearNotificacion(
                    destinatario,
                    "Nuevo mensaje de " + nombreRem,
                    preview
            );
        }
        return guardado;
    }

    public List<MensajeDTO> obtenerConversacion(Long u1Id, Long u2Id, Long cursoId) {
        UserEntity u1 = userRepository.findById(u1Id).orElseThrow();
        UserEntity u2 = userRepository.findById(u2Id).orElseThrow();
        
        List<Mensaje> conversation = mensajeRepository.findConversation(u1, u2, cursoId);
        
        // Marcación en lote atómica en 1 sola consulta SQL en vez de N updates individuales
        mensajeRepository.marcarComoLeidosBatch(u1, u2, cursoId);
        conversation.forEach(m -> {
            if (!Boolean.TRUE.equals(m.getLeido()) && m.getDestinatario() != null && u1Id.equals(m.getDestinatario().getId())) {
                m.setLeido(true);
            }
        });
            
        return conversation.stream().map(mapper::toDTO).toList();
    }

    public Map<String, Object> obtenerConversacionConMetadata(Long usuarioId, Long contactoId, Long cursoId) {
        UserEntity usuario = userRepository.findById(usuarioId).orElseThrow();
        UserEntity contacto = userRepository.findById(contactoId).orElseThrow();

        List<MensajeDTO> mensajes = obtenerConversacion(usuarioId, contactoId, cursoId);
        List<Curso> cursosVisor = "DOCENTE".equalsIgnoreCase(usuario.getRol()) ? cursosDelDocente(usuario) : List.of();
        UserDTO contactoDto = mapper.toDTO(contacto);

        Map<String, Object> res = new HashMap<>();
        res.put("usuario", mapper.toDTO(usuario));
        res.put("contacto", contactoDto);
        res.put("contexto", construirContextoContacto(usuario, contacto, contactoDto, cursosVisor, Map.of()));
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
                .map(contacto -> resumenConversacion(estudiante, contacto, cursoFiltrado, List.of(), Map.of()))
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

        Map<Long, List<UserEntity>> hijosEnMisSalones = new HashMap<>();
        List<UserEntity> permitidos = (cursoFiltrado != null)
                ? estudiantesDelCurso(cursoRepository.findById(cursoFiltrado).orElse(null))
                : contactosDocente(cursos, docenteId, hijosEnMisSalones);
        permitidos.forEach(c -> {
            if (c != null && !c.getId().equals(docenteId)) contactos.putIfAbsent(c.getId(), c);
        });

        List<Map<String, Object>> conversaciones = contactos.values().stream()
                .map(contacto -> resumenConversacion(docente, contacto, cursoFiltrado, cursos, hijosEnMisSalones))
                .sorted((a, b) -> String.valueOf(b.get("fechaUltimoMensaje")).compareTo(String.valueOf(a.get("fechaUltimoMensaje"))))
                .toList();

        Map<String, Object> res = new HashMap<>();
        res.put("docente", mapper.toDTO(docente));
        res.put("cursos", cursos.stream().map(mapper::toDTO).toList());
        res.put("salones", construirSalonesDocente(cursos, conversaciones));
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
        if (estudiante == null) return List.of();
        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);
        if (!grupo.isComplete()) return List.of();

        LinkedHashMap<String, Curso> cursos = new LinkedHashMap<>();
        cursoRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno())
                .forEach(c -> cursos.putIfAbsent(TextUtils.claveCurso(c.getNombre(), c.getId()), c));
        return new ArrayList<>(cursos.values());
    }

    private List<Curso> cursosDelDocente(UserEntity docente) {
        if (docente == null) return List.of();
        LinkedHashMap<String, Curso> unicos = new LinkedHashMap<>();
        for (Curso c : cursoRepository.findByProfesor(docente)) {
            if (c == null || "ARCHIVADO".equalsIgnoreCase(c.getTurno())) {
                continue;
            }
            String key = String.format("%s|%s|%s|%s|%s",
                    safeLower(c.getNombre()), safeLower(c.getNivel()), safeLower(c.getGrado()),
                    safeLower(c.getSeccion()), safeLower(c.getTurno()));
            unicos.putIfAbsent(key, c);
        }
        return new ArrayList<>(unicos.values());
    }

    private List<UserEntity> estudiantesDelCurso(Curso curso) {
        if (curso == null || curso.getNivel() == null || curso.getGrado() == null || curso.getSeccion() == null) return List.of();
        return userRepository.findByGrupoAcademico(curso.getNivel(), curso.getGrado(), curso.getSeccion(), curso.getTurno())
                .stream().filter(u -> "ESTUDIANTE".equalsIgnoreCase(u.getRol())).toList();
    }

    private List<UserEntity> contactosDocente(List<Curso> cursos, Long docenteId, Map<Long, List<UserEntity>> hijosEnMisSalones) {
        LinkedHashMap<Long, UserEntity> contactos = new LinkedHashMap<>();
        Set<Long> hijosVistos = new HashSet<>();
        for (Curso c : cursos) {
            for (UserEntity u : estudiantesDelCurso(c)) {
                if (u.getId() != null && !u.getId().equals(docenteId)) {
                    contactos.putIfAbsent(u.getId(), u);
                }
                UserEntity padre = u.getPadre();
                if (padre != null && padre.getId() != null && !padre.getId().equals(docenteId)
                        && !"ARCHIVADO".equalsIgnoreCase(padre.getRol())) {
                    contactos.putIfAbsent(padre.getId(), padre);
                    if (u.getId() != null && hijosVistos.add(u.getId())) {
                        hijosEnMisSalones.computeIfAbsent(padre.getId(), k -> new ArrayList<>()).add(u);
                    }
                }
            }
        }
        return new ArrayList<>(contactos.values());
    }

    private List<UserEntity> contactosAcademicos(UserEntity estudiante, List<Curso> cursos) {
        LinkedHashMap<Long, UserEntity> contactos = new LinkedHashMap<>();
        AcademicGroupHelper.AcademicGroup grupo = AcademicGroupHelper.resolve(estudiante, matriculaRepository);
        if (grupo.isComplete()) {
            userRepository.findByGrupoAcademico(grupo.nivel(), grupo.grado(), grupo.seccion(), grupo.turno())
                    .stream().filter(u -> !u.getId().equals(estudiante.getId())).forEach(u -> contactos.putIfAbsent(u.getId(), u));
        }
        cursos.stream().map(Curso::getProfesor).filter(Objects::nonNull).forEach(u -> contactos.putIfAbsent(u.getId(), u));
        if (estudiante.getTutor() != null) contactos.putIfAbsent(estudiante.getTutor().getId(), estudiante.getTutor());
        return new ArrayList<>(contactos.values());
    }

    private Map<String, Object> resumenConversacion(
            UserEntity usuario,
            UserEntity contacto,
            Long cursoId,
            List<Curso> cursosVisor,
            Map<Long, List<UserEntity>> hijosEnMisSalones) {
        List<Mensaje> mensajes = mensajeRepository.findConversation(usuario, contacto, cursoId);
        Mensaje ultimo = mensajes.isEmpty() ? null : mensajes.get(mensajes.size() - 1);
        long noLeidos = mensajes.stream().filter(m -> m.getDestinatario().getId().equals(usuario.getId()) && !Boolean.TRUE.equals(m.getLeido())).count();
        UserDTO contactoDto = mapper.toDTO(contacto);

        Map<String, Object> item = new HashMap<>();
        item.put("contacto", contactoDto);
        item.put("contexto", construirContextoContacto(usuario, contacto, contactoDto, cursosVisor, hijosEnMisSalones));
        item.put("ultimoMensaje", mapper.toDTO(ultimo));
        item.put("preview", construirPreview(ultimo, contacto));
        item.put("fechaUltimoMensaje", ultimo != null ? ultimo.getFechaEnvio().toString() : "");
        item.put("noLeidos", noLeidos);
        item.put("tieneMensajes", ultimo != null);
        return item;
    }

    private List<Map<String, Object>> construirSalonesDocente(List<Curso> cursos, List<Map<String, Object>> conversaciones) {
        LinkedHashMap<String, Map<String, Object>> salones = new LinkedHashMap<>();

        for (Curso c : cursos) {
            String key = claveSalon(c.getNivel(), c.getGrado(), c.getSeccion(), c.getTurno());
            if (key.isEmpty()) continue;
            Map<String, Object> salon = salones.computeIfAbsent(key, k -> crearSalonMap(k, c.getNivel(), c.getGrado(), c.getSeccion(), c.getTurno()));
            @SuppressWarnings("unchecked")
            List<String> listaCursos = (List<String>) salon.get("cursos");
            String nombreCurso = TextUtils.limpiarTexto(c.getNombre());
            if (!nombreCurso.isBlank() && !listaCursos.contains(nombreCurso)) {
                listaCursos.add(nombreCurso);
            }
        }

        for (Map<String, Object> conv : conversaciones) {
            @SuppressWarnings("unchecked")
            Map<String, Object> ctx = (Map<String, Object>) conv.get("contexto");
            if (ctx == null) continue;
            String key = String.valueOf(ctx.getOrDefault("salonKey", ""));
            if (key.isEmpty() || salones.containsKey(key)) continue;
            salones.put(key, crearSalonMap(
                    key,
                    (String) ctx.get("nivel"),
                    (String) ctx.get("grado"),
                    (String) ctx.get("seccion"),
                    (String) ctx.get("turno")));
        }

        List<Map<String, Object>> lista = new ArrayList<>(salones.values());
        lista.sort(Comparator
                .comparing((Map<String, Object> s) -> String.valueOf(s.getOrDefault("nivel", "")))
                .thenComparing(s -> String.valueOf(s.getOrDefault("grado", "")))
                .thenComparing(s -> String.valueOf(s.getOrDefault("seccion", ""))));
        return lista;
    }

    private Map<String, Object> crearSalonMap(String key, String nivel, String grado, String seccion, String turno) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("key", key);
        map.put("nivel", nivel != null ? nivel : "");
        map.put("grado", grado != null ? grado : "");
        map.put("seccion", seccion != null ? seccion : "");
        map.put("turno", turno != null ? turno : "");
        map.put("label", formatearSalonLabel(nivel, grado, seccion));
        map.put("shortLabel", formatearSalonCorto(nivel, grado, seccion));
        map.put("turnoLabel", formatearTurno(turno));
        map.put("cursos", new ArrayList<String>());
        return map;
    }

    private Map<String, Object> construirContextoContacto(
            UserEntity visor,
            UserEntity contacto,
            UserDTO contactoDto,
            List<Curso> cursosVisor,
            Map<Long, List<UserEntity>> hijosEnMisSalones) {
        Map<String, Object> ctx = new LinkedHashMap<>();
        String rol = contacto.getRol() != null ? contacto.getRol().trim().toUpperCase(Locale.ROOT) : "";
        ctx.put("rol", rol);
        ctx.put("rolLabel", rolLegible(rol));

        if ("ESTUDIANTE".equals(rol)) {
            String nivel = contactoDto.getNivel();
            String grado = contactoDto.getGrado();
            String seccion = contactoDto.getSeccion();
            String turno = contactoDto.getTurno();
            String key = claveSalon(nivel, grado, seccion, turno);
            ctx.put("nivel", nivel != null ? nivel : "");
            ctx.put("grado", grado != null ? grado : "");
            ctx.put("seccion", seccion != null ? seccion : "");
            ctx.put("turno", turno != null ? turno : "");
            ctx.put("salonKey", key);
            ctx.put("salonLabel", formatearSalonLabel(nivel, grado, seccion));
            ctx.put("salonShort", formatearSalonCorto(nivel, grado, seccion));
            ctx.put("turnoLabel", formatearTurno(turno));
            ctx.put("cursos", cursosEnComun(cursosVisor, nivel, grado, seccion, turno));
            if (contacto.getPadre() != null && !"ARCHIVADO".equalsIgnoreCase(contacto.getPadre().getRol())) {
                UserEntity padre = contacto.getPadre();
                ctx.put("apoderado", Map.of(
                        "id", padre.getId(),
                        "nombre", unirNombre(padre.getNombres(), padre.getApellidos())
                ));
            }
            return ctx;
        }

        if ("PADRE".equals(rol)) {
            List<UserEntity> todosHijos = userRepository != null ? userRepository.findByPadreId(contacto.getId()) : List.of();
            if (todosHijos == null) todosHijos = List.of();
            List<UserEntity> preferidos = hijosEnMisSalones.getOrDefault(contacto.getId(), List.of());

            Set<String> salonesDocenteKeys = cursosVisor.stream()
                    .map(c -> claveSalon(c.getNivel(), c.getGrado(), c.getSeccion(), c.getTurno()))
                    .filter(k -> !k.isEmpty())
                    .collect(Collectors.toSet());

            List<Map<String, Object>> hijosInfo = new ArrayList<>();
            List<UserEntity> fuente = !preferidos.isEmpty() ? preferidos : todosHijos;
            List<UserEntity> enMisSalones = new ArrayList<>();
            for (UserEntity h : fuente) {
                AcademicGroupHelper.AcademicGroup g = AcademicGroupHelper.resolve(h, matriculaRepository);
                String key = claveSalon(g.nivel(), g.grado(), g.seccion(), g.turno());
                if (salonesDocenteKeys.contains(key)) {
                    enMisSalones.add(h);
                }
            }
            List<UserEntity> hijosFinales = !enMisSalones.isEmpty() ? enMisSalones : fuente;

            LinkedHashSet<String> cursosComunes = new LinkedHashSet<>();
            String primaryKey = "";
            String primaryNivel = "";
            String primaryGrado = "";
            String primarySeccion = "";
            String primaryTurno = "";

            for (UserEntity h : hijosFinales) {
                if ("ARCHIVADO".equalsIgnoreCase(h.getRol())) continue;
                AcademicGroupHelper.AcademicGroup g = AcademicGroupHelper.resolve(h, matriculaRepository);
                String key = claveSalon(g.nivel(), g.grado(), g.seccion(), g.turno());
                boolean coincideDocente = salonesDocenteKeys.contains(key);
                Map<String, Object> hijoMap = new LinkedHashMap<>();
                hijoMap.put("id", h.getId());
                hijoMap.put("nombres", TextUtils.limpiarTexto(h.getNombres()));
                hijoMap.put("apellidos", TextUtils.limpiarTexto(h.getApellidos()));
                hijoMap.put("nombreCompleto", unirNombre(h.getNombres(), h.getApellidos()));
                hijoMap.put("salonKey", key);
                hijoMap.put("salonLabel", formatearSalonLabel(g.nivel(), g.grado(), g.seccion()));
                hijoMap.put("salonShort", formatearSalonCorto(g.nivel(), g.grado(), g.seccion()));
                hijoMap.put("turnoLabel", formatearTurno(g.turno()));
                hijoMap.put("enMisSalones", coincideDocente);
                hijosInfo.add(hijoMap);

                if (primaryKey.isEmpty() && !key.isEmpty()) {
                    primaryKey = key;
                    primaryNivel = g.nivel() != null ? g.nivel() : "";
                    primaryGrado = g.grado() != null ? g.grado() : "";
                    primarySeccion = g.seccion() != null ? g.seccion() : "";
                    primaryTurno = g.turno() != null ? g.turno() : "";
                }
                cursosComunes.addAll(cursosEnComun(cursosVisor, g.nivel(), g.grado(), g.seccion(), g.turno()));
            }

            hijosInfo.sort(Comparator.comparing(h -> String.valueOf(h.getOrDefault("nombreCompleto", ""))));
            ctx.put("nivel", primaryNivel);
            ctx.put("grado", primaryGrado);
            ctx.put("seccion", primarySeccion);
            ctx.put("turno", primaryTurno);
            ctx.put("salonKey", primaryKey);
            ctx.put("salonLabel", formatearSalonLabel(primaryNivel, primaryGrado, primarySeccion));
            ctx.put("salonShort", formatearSalonCorto(primaryNivel, primaryGrado, primarySeccion));
            ctx.put("turnoLabel", formatearTurno(primaryTurno));
            ctx.put("cursos", new ArrayList<>(cursosComunes));
            ctx.put("hijos", hijosInfo);
            return ctx;
        }

        String key = claveSalon(contactoDto.getNivel(), contactoDto.getGrado(), contactoDto.getSeccion(), contactoDto.getTurno());
        ctx.put("nivel", contactoDto.getNivel() != null ? contactoDto.getNivel() : "");
        ctx.put("grado", contactoDto.getGrado() != null ? contactoDto.getGrado() : "");
        ctx.put("seccion", contactoDto.getSeccion() != null ? contactoDto.getSeccion() : "");
        ctx.put("turno", contactoDto.getTurno() != null ? contactoDto.getTurno() : "");
        ctx.put("salonKey", key);
        ctx.put("salonLabel", formatearSalonLabel(contactoDto.getNivel(), contactoDto.getGrado(), contactoDto.getSeccion()));
        ctx.put("salonShort", formatearSalonCorto(contactoDto.getNivel(), contactoDto.getGrado(), contactoDto.getSeccion()));
        ctx.put("turnoLabel", formatearTurno(contactoDto.getTurno()));
        ctx.put("cursos", List.of());
        return ctx;
    }

    private List<String> cursosEnComun(List<Curso> cursosVisor, String nivel, String grado, String seccion, String turno) {
        String target = claveSalon(nivel, grado, seccion, turno);
        if (target.isEmpty() || cursosVisor == null || cursosVisor.isEmpty()) return List.of();
        LinkedHashSet<String> nombres = new LinkedHashSet<>();
        for (Curso c : cursosVisor) {
            if (target.equals(claveSalon(c.getNivel(), c.getGrado(), c.getSeccion(), c.getTurno()))) {
                String n = TextUtils.limpiarTexto(c.getNombre());
                if (!n.isBlank()) nombres.add(n);
            }
        }
        return new ArrayList<>(nombres);
    }

    private String claveSalon(String nivel, String grado, String seccion, String turno) {
        if (nivel == null || grado == null || seccion == null || nivel.isBlank() || grado.isBlank() || seccion.isBlank()) {
            return "";
        }
        return String.format("%s|%s|%s|%s",
                safeLower(nivel), safeLower(grado), safeLower(seccion), safeLower(turno));
    }

    private String safeLower(String val) {
        return val == null ? "" : TextUtils.sinAcentos(val).trim().toLowerCase(Locale.ROOT);
    }

    private String formatearSalonLabel(String nivel, String grado, String seccion) {
        if (grado == null || grado.isBlank() || seccion == null || seccion.isBlank()) return "";
        String g = formatGrado(grado);
        String n = formatearNivel(nivel);
        return n.isEmpty() ? g + " " + seccion.trim() : g + " " + seccion.trim() + " · " + n;
    }

    private String formatearSalonCorto(String nivel, String grado, String seccion) {
        if (grado == null || grado.isBlank() || seccion == null || seccion.isBlank()) return "";
        String g = formatGrado(grado);
        String niv = safeLower(nivel);
        String nivShort = switch (niv) {
            case "primaria" -> "Prim.";
            case "secundaria" -> "Sec.";
            case "inicial" -> "Inic.";
            default -> formatearNivel(nivel);
        };
        return nivShort.isEmpty() ? g + " " + seccion.trim() : g + " " + seccion.trim() + " · " + nivShort;
    }

    private String formatGrado(String grado) {
        String g = grado.trim();
        return (g.endsWith("°") || g.endsWith("º")) ? g : g + "°";
    }

    private String formatearNivel(String nivel) {
        if (nivel == null || nivel.isBlank()) return "";
        String s = nivel.trim().toLowerCase(Locale.ROOT);
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private String formatearTurno(String turno) {
        if (turno == null || turno.isBlank()) return "";
        String t = TextUtils.sinAcentos(turno).trim().toUpperCase(Locale.ROOT);
        return switch (t) {
            case "MANANA" -> "Mañana";
            case "TARDE" -> "Tarde";
            case "NOCHE" -> "Noche";
            case "ARCHIVADO" -> "";
            default -> turno.trim();
        };
    }

    private String rolLegible(String rol) {
        return switch (rol) {
            case "ESTUDIANTE" -> "Estudiante";
            case "PADRE" -> "Apoderado";
            case "DOCENTE" -> "Docente";
            case "ADMINISTRADOR" -> "Dirección";
            default -> rol.isEmpty() ? "Contacto" : rol;
        };
    }

    private String unirNombre(String nombres, String apellidos) {
        return (TextUtils.limpiarTexto(nombres) + " " + TextUtils.limpiarTexto(apellidos)).trim();
    }

    private String construirPreview(Mensaje mensaje, UserEntity contacto) {
        if (mensaje == null) return "DOCENTE".equals(contacto.getRol()) ? "Docente" : "Contacto académico";
        if (mensaje.getContenido() != null && !mensaje.getContenido().isBlank()) return TextUtils.limpiarTexto(mensaje.getContenido());
        return "Archivo adjunto";
    }

    public List<Map<String, Object>> obtenerContactosRecientes(Long usuarioId) {
        UserEntity usuario = userRepository.findById(usuarioId).orElseThrow();
        List<Mensaje> mensajes = mensajeRepository.findAllByUser(usuario, null);
        java.util.LinkedHashMap<Long, UserEntity> contactosMap = new java.util.LinkedHashMap<>();
        for (Mensaje m : mensajes) {
            UserEntity otro = m.getRemitente().getId().equals(usuarioId) ? m.getDestinatario() : m.getRemitente();
            if (otro != null && !otro.getId().equals(usuarioId)) {
                contactosMap.putIfAbsent(otro.getId(), otro);
            }
        }
        List<UserEntity> contactos = new ArrayList<>(contactosMap.values());
        
        List<Map<String, Object>> res = new ArrayList<>();
        for (UserEntity c : contactos) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", c.getId());
            map.put("nombres", TextUtils.limpiarTexto(c.getNombres()));
            map.put("apellidos", TextUtils.limpiarTexto(c.getApellidos()));
            map.put("rol", c.getRol());
            map.put("fotoPerfil", c.getFotoPerfil());
            map.put("ultimaConexion", c.getUltimaConexion());

            List<Mensaje> conv = mensajeRepository.findConversation(usuario, c, null);
            Mensaje ultimo = conv.isEmpty() ? null : conv.get(conv.size() - 1);
            long noLeidos = conv.stream()
                .filter(m -> m.getDestinatario().getId().equals(usuarioId) && !Boolean.TRUE.equals(m.getLeido()))
                .count();
            map.put("noLeidos", noLeidos);
            map.put("ultimoMensaje", construirPreview(ultimo, c));
            map.put("fechaUltimoMensaje", ultimo != null && ultimo.getFechaEnvio() != null ? ultimo.getFechaEnvio().toString() : "");
            res.add(map);
        }
        return res;
    }
}
