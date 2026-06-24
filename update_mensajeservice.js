const fs = require('fs');

const file = 'c:/Users/carlo/Desktop/proyectoshidel/shidell/src/main/java/org/example/shidell/service/MensajeService.java';
let content = fs.readFileSync(file, 'utf8');

const target = `    public List<Map<String, Object>> obtenerContactosRecientes(Long usuarioId) {
        UserEntity usuario = userRepository.findById(usuarioId).orElseThrow();
        List<UserEntity> contactos = mensajeRepository.findDistinctContacts(usuario, null);`;

const replacement = `    public List<Map<String, Object>> obtenerContactosRecientes(Long usuarioId) {
        UserEntity usuario = userRepository.findById(usuarioId).orElseThrow();
        
        List<Mensaje> mensajes = mensajeRepository.findAllByUser(usuario, null);
        java.util.LinkedHashMap<Long, UserEntity> contactosMap = new java.util.LinkedHashMap<>();
        for (Mensaje m : mensajes) {
            UserEntity otro = m.getRemitente().getId().equals(usuarioId) ? m.getDestinatario() : m.getRemitente();
            if (otro != null && !otro.getId().equals(usuarioId)) {
                contactosMap.putIfAbsent(otro.getId(), otro);
            }
        }
        List<UserEntity> contactos = new ArrayList<>(contactosMap.values());`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log("Replaced successfully");
} else {
    console.log("Target not found!");
}
