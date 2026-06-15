instalarAuthFetchDocente();

function instalarAuthFetchDocente() {
    if (window.__shidellAuthFetch) return;
    window.__shidellAuthFetch = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('shidell_user') || 'null'); } catch {}
        if (!user?.sessionToken) return originalFetch(input, init);
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${user.sessionToken}`);
        return originalFetch(input, { ...init, headers });
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '' : 'http://localhost:8080';
    const $ = id => document.getElementById(id);
    let docente = null;
    let fotoTemporal = '';

    $('btn-logout')?.addEventListener('click', event => {
        event.preventDefault();
        localStorage.removeItem('shidell_user');
        location.href = '../login.html';
    });
    $('cfg-foto')?.addEventListener('change', cambiarFoto);
    $('btn-remove-photo')?.addEventListener('click', () => {
        fotoTemporal = '';
        renderPerfil();
        setStatus('La foto se quitará al guardar.');
    });
    $('btn-save-settings')?.addEventListener('click', guardar);

    iniciar();

    async function iniciar() {
        try {
            const user = leerUsuario();
            if (!user || user.rol !== 'DOCENTE') {
                location.href = '../login.html';
                return;
            }
            const fresh = await api(`/api/docente/buscar?email=${encodeURIComponent(user.email)}`);
            if (!fresh?.id) throw new Error('No se encontró el docente.');
            docente = { ...user, ...fresh, sessionToken: user.sessionToken };
            fotoTemporal = primeraFotoValida(docente.fotoPerfil, docente.foto_perfil);
            localStorage.setItem('shidell_user', JSON.stringify(docente));
            llenarFormulario();
            renderPerfil();
            setStatus('Conectado');
        } catch (error) {
            console.error(error);
            setStatus('Error de conexión');
        }
    }

    function llenarFormulario() {
        $('cfg-nombres').value = docente?.nombres || '';
        $('cfg-apellidos').value = docente?.apellidos || '';
        $('cfg-email').value = docente?.email || '';
    }

    function renderPerfil() {
        const nombre = nombreCompleto(docente);
        $('user-name-label').textContent = nombre;
        $('settings-name').textContent = nombre;
        $('settings-email').textContent = docente?.email || '';
        renderAvatar($('profile-avatar'), { ...docente, fotoPerfil: fotoTemporal });
        renderAvatar($('profile-preview'), { ...docente, fotoPerfil: fotoTemporal }, iniciales(docente));
    }

    async function cambiarFoto() {
        const file = $('cfg-foto').files?.[0];
        if (!file) return;
        try {
            fotoTemporal = await procesarFoto(file);
            renderPerfil();
            setStatus('Foto lista. Guarda los cambios para publicarla.');
        } catch (error) {
            setStatus(error.message || 'No se pudo procesar la foto.');
        } finally {
            $('cfg-foto').value = '';
        }
    }

    async function guardar() {
        if (!docente?.id) return;
        const nombres = $('cfg-nombres').value.trim();
        const apellidos = $('cfg-apellidos').value.trim();
        const password = $('cfg-password').value;
        const confirm = $('cfg-password-confirm').value;
        if (!nombres || !apellidos) return setStatus('Completa nombres y apellidos.');
        if ((password || confirm) && password !== confirm) return setStatus('Las contraseñas no coinciden.');

        const payload = { nombres, apellidos, fotoPerfil: fotoTemporal || '' };
        if (password) payload.password = password;
        setStatus('Guardando...');
        $('btn-save-settings').disabled = true;
        try {
            const actualizado = await api(`/api/users/${docente.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            docente = { ...docente, ...actualizado, sessionToken: docente.sessionToken };
            localStorage.setItem('shidell_user', JSON.stringify(docente));
            $('cfg-password').value = '';
            $('cfg-password-confirm').value = '';
            llenarFormulario();
            renderPerfil();
            setStatus('Perfil actualizado.');
        } catch (error) {
            setStatus(error.message || 'No se pudo guardar.');
        } finally {
            $('btn-save-settings').disabled = false;
        }
    }

    function procesarFoto(file) {
        if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida.');
        if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB.');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
                img.onload = () => {
                    const size = 384;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    const side = Math.min(img.width, img.height);
                    const sx = (img.width - side) / 2;
                    const sy = (img.height - side) / 2;
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
                    resolve(canvas.toDataURL('image/jpeg', 0.84));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function api(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, options);
        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    function leerUsuario() {
        try {
            const user = JSON.parse(localStorage.getItem('shidell_user') || 'null');
            if (user && !user.sessionToken) return null;
            return user;
        } catch { return null; }
    }

    function renderAvatar(container, user, fallback = '') {
        if (!container) return;
        const foto = primeraFotoValida(user?.fotoPerfil, user?.foto_perfil);
        container.innerHTML = foto ? `<img src="${escapeHtml(foto)}" alt="Foto de perfil">` : escapeHtml(fallback || '<i class="ph-fill ph-user-circle"></i>');
        if (!foto && !fallback) container.innerHTML = '<i class="ph-fill ph-user-circle" style="font-size:32px;"></i>';
    }

    function primeraFotoValida(...values) {
        return values.find(value => typeof value === 'string' && /^(data:image\/|\/uploads\/|https?:\/\/)/i.test(value)) || '';
    }

    function iniciales(user = {}) {
        return (((user.nombres || '?')[0] || '?') + ((user.apellidos || '?')[0] || '?')).toUpperCase();
    }

    function nombreCompleto(user = {}) {
        return limpiarTexto(`${user.nombres || ''} ${user.apellidos || ''}`).trim() || 'Docente';
    }

    function limpiarTexto(value) {
        let text = String(value ?? '');
        for (let i = 0; i < 2 && /Ã|Â/.test(text); i++) {
            try {
                const fixed = decodeURIComponent(escape(text));
                if (!fixed || fixed === text) break;
                text = fixed;
            } catch { break; }
        }
        return text.replace(/Â/g, '');
    }

    function setStatus(text) {
        $('save-status').textContent = text;
        $('server-status').textContent = `Estado: ${text || 'Listo'}`;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }
});
