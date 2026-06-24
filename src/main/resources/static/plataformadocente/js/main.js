import { Auth } from './services/auth.js';
import { Router } from './core/router.js';
import { NotificacionesService } from './services/notificacionesService.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify Authentication
    const user = Auth.getUser();
    if (!user || user.rol !== 'DOCENTE') {
        window.location.href = '../login.html';
        return;
    }

    // 2. Setup Topbar UI
    document.getElementById('topbar-subtitle').textContent = new Date().toLocaleDateString('es-PE', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const topbarName = document.getElementById('topbar-name');
    const topbarRole = document.getElementById('topbar-role');
    const topbarAvatar = document.getElementById('topbar-avatar');

    if (topbarName) {
        topbarName.textContent = `${user.nombres} ${user.apellidos}`;
    }
    if (topbarRole) {
        let roleText = 'Docente';
        if (user.grado && user.seccion) {
            roleText += ` | ${user.grado} ${user.seccion} - ${user.nivel || ''}`;
        }
        topbarRole.textContent = roleText;
    }
    if (topbarAvatar && user.fotoPerfil) {
        const fotoUrl = (user.fotoPerfil.startsWith('/') || user.fotoPerfil.startsWith('http')) 
            ? user.fotoPerfil 
            : '/uploads/perfiles/' + user.fotoPerfil;
        topbarAvatar.innerHTML = `<img src="${fotoUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    }

    document.getElementById('btn-logout').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
    });

    // 3. Notificaciones
    NotificacionesService.init();

    // 4. Initialize Router
    Router.init();
});
