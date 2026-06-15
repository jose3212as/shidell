(function () {
    let usuarioPromise = null;
    let usuarioCache = null;
    const originalFetch = window.fetch.bind(window);

    function leerUsuarioLocal() {
        try {
            return JSON.parse(localStorage.getItem('shidell_user') || 'null');
        } catch (error) {
            return null;
        }
    }

    function guardarUsuarioLocal(user) {
        if (user?.id) localStorage.setItem('shidell_user', JSON.stringify(user));
    }

    window.fetch = function (input, init = {}) {
        const url = typeof input === 'string' ? input : input?.url || '';
        const user = usuarioCache || leerUsuarioLocal();
        const token = user?.sessionToken;

        if (!token || !url.startsWith('/api/')) {
            return originalFetch(input, init);
        }

        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        return originalFetch(input, { ...init, headers });
    };

    document.addEventListener('click', event => {
        const navLink = event.target.closest?.('.sidebar-nav a.nav-item');
        if (navLink) {
            event.preventDefault();
            event.stopImmediatePropagation();
            window.location.href = navLink.href;
        }
    }, true);

    async function obtenerUsuarioApi() {
        if (usuarioCache) return usuarioCache;
        if (!usuarioPromise) {
            usuarioPromise = fetch('/api/auth/me', { credentials: 'same-origin' })
                .then(async response => {
                    if (!response.ok) {
                        usuarioCache = leerUsuarioLocal();
                        return usuarioCache;
                    }
                    const apiUser = await response.json();
                    const localUser = leerUsuarioLocal();
                    usuarioCache = { ...localUser, ...apiUser, sessionToken: localUser?.sessionToken || apiUser.sessionToken };
                    guardarUsuarioLocal(usuarioCache);
                    return usuarioCache;
                })
                .catch(() => {
                    usuarioCache = leerUsuarioLocal();
                    return usuarioCache;
                });
        }
        return usuarioPromise;
    }

    async function cerrarSesionApi() {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        }).catch(() => {});
        window.location.href = '/login.html';
    }

    window.shidellSession = {
        obtenerUsuario: obtenerUsuarioApi,
        cerrarSesion: cerrarSesionApi
    };

    window.cerrarSesion = cerrarSesionApi;
})();
