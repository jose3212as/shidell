document.addEventListener('DOMContentLoaded', () => {
    instalarAuthFetch();
    const API_BASE = location.host.includes('localhost') ? '' : 'http://localhost:8080';
    const user = leerUsuario();
    const teacherEmail = user?.rol?.toUpperCase() === 'DOCENTE' && user.email ? user.email : '';

    const state = {
        docente: null,
        cursos: [],
        horarioHoy: [],
        metricas: {}
    };

    const $ = id => document.getElementById(id);

    iniciar();

    async function iniciar() {
        pintarFecha();
        conectarBotonesBase();

        if (!teacherEmail) {
            location.href = '/login.html';
            return;
        }

        try {
            state.docente = await api(`/api/docente/buscar?email=${encodeURIComponent(teacherEmail)}`);
            if (!state.docente?.id || state.docente.rol?.toUpperCase() !== 'DOCENTE') {
                throw new Error('Sesion docente invalida');
            }

            const nombre = limpiar(`${state.docente.nombres || ''} ${state.docente.apellidos || ''}`).trim() || 'Docente';
            $('docente-nombre').textContent = nombre;
            $('docente-saludo').textContent = nombre.split(' ')[0] || 'Docente';
            pintarAvatarDocente(state.docente);

            const dashboard = await api(`/api/docente/${state.docente.id}/dashboard`);
            state.docente = dashboard.docente || state.docente;
            state.cursos = Array.isArray(dashboard.cursos) ? dashboard.cursos.map(item => ({
                ...(item.curso || {}),
                alumnos: item.alumnos || 0,
                tareas: item.tareas || 0
            })) : [];
            state.horarioHoy = Array.isArray(dashboard.horarioHoy) ? dashboard.horarioHoy : [];
            state.metricas = dashboard.metricas || {};

            render();
            $('estado-servidor').textContent = 'Conectado';
        } catch (error) {
            console.error(error);
            $('estado-servidor').textContent = 'Error de conexión';
            $('docente-cursos').innerHTML = empty('No se pudieron cargar los cursos.');
            $('docente-horario').innerHTML = empty('No se pudo cargar el horario.');
        }
    }

    function conectarBotonesBase() {
        $('btn-logout')?.addEventListener('click', event => {
            event.preventDefault();
            localStorage.removeItem('shidell_user');
            location.href = '/login.html';
        });

        $('btn-mensajes')?.addEventListener('click', () => {
            location.href = 'mensajes.html';
        });

        $('buscar-portal')?.addEventListener('input', renderCursos);
    }

    function pintarFecha() {
        $('fecha-actual').textContent = new Date().toLocaleDateString('es-PE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    function render() {
        renderMetricas();
        renderCursos();
        renderHorario();
        renderTabla();
    }

    function renderMetricas() {
        $('metric-cursos').textContent = state.metricas.cursos ?? state.cursos.length;
        $('metric-estudiantes').textContent = state.metricas.estudiantes ?? 0;
        $('metric-clases').textContent = state.metricas.clasesHoy ?? state.horarioHoy.length;
        $('metric-tareas').textContent = state.metricas.tareas ?? 0;
    }

    function renderCursos() {
        const texto = normalizar($('buscar-portal')?.value || '');
        const cursos = state.cursos.filter(curso => {
            const base = normalizar(`${curso.nombre || ''} ${curso.nivel || ''} ${curso.grado || ''} ${curso.seccion || ''}`);
            return !texto || base.includes(texto);
        });

        if (!cursos.length) {
            $('docente-cursos').innerHTML = empty('No hay cursos con esa búsqueda.');
            return;
        }

        $('docente-cursos').innerHTML = cursos.map(curso => {
            const alumnos = curso.alumnos || 0;
            const tareas = curso.tareas || 0;
            const color = colorValido(curso.color);
            return `
                <article class="docente-curso-card ${color}">
                    <div class="docente-curso-icon"><i class="ph-fill ${escapeHtml(curso.icono || 'ph-books')}"></i></div>
                    <div>
                        <h3>${escapeHtml(limpiar(curso.nombre || 'Curso'))}</h3>
                        <p>${escapeHtml(curso.nivel || '')} ${escapeHtml(curso.grado || '')}-${escapeHtml(curso.seccion || '')}</p>
                    </div>
                    <div class="docente-curso-meta">
                        <span><i class="ph ph-users"></i> ${alumnos} alumnos</span>
                        <span><i class="ph ph-notebook"></i> ${tareas} tareas</span>
                    </div>
                    <div class="docente-card-actions">
                        <a href="misclases.html?curso=${curso.id}" class="mini-action">Clase</a>
                        <a href="misclases.html?curso=${curso.id}&asistencia=1" class="mini-action">Asistencia</a>
                        <a href="calificaciones.html?curso=${curso.id}" class="mini-action">Notas</a>
                    </div>
                </article>`;
        }).join('');
    }

    function renderHorario() {
        const eventos = [...state.horarioHoy].sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));

        if (!eventos.length) {
            $('docente-horario').innerHTML = empty('No tienes clases programadas para hoy.');
            return;
        }

        $('docente-horario').innerHTML = eventos.map(evento => {
            const inicio = new Date(evento.fechaInicio);
            const fin = new Date(evento.fechaFin || evento.fechaInicio);
            return `
                <div class="schedule-item">
                    <div class="time-box">
                        <div class="time">${hora(inicio)}</div>
                        <div class="ampm">${hora(fin)}</div>
                    </div>
                    <div class="course-info">
                        <h4>${escapeHtml(limpiar(evento.titulo || 'Clase'))}</h4>
                        <p><i class="ph ph-map-pin"></i> ${escapeHtml(evento.ubicacion || 'Aula virtual')}</p>
                    </div>
                </div>`;
        }).join('');
    }

    function renderTabla() {
        if (!state.cursos.length) {
            $('docente-tabla-cursos').innerHTML = '<tr><td colspan="4">No hay cursos asignados.</td></tr>';
            return;
        }

        $('docente-tabla-cursos').innerHTML = state.cursos.map(curso => {
            const alumnos = curso.alumnos || 0;
            return `
                <tr>
                    <td><strong>${escapeHtml(limpiar(curso.nombre || 'Curso'))}</strong></td>
                    <td>${escapeHtml(curso.grado || '')}-${escapeHtml(curso.seccion || '')}</td>
                    <td>${alumnos}</td>
                    <td><a href="estudiantes.html?curso=${curso.id}" class="mini-action">Abrir</a></td>
                </tr>`;
        }).join('');
    }

    async function api(path) {
        const response = await fetch(`${API_BASE}${path}`);
        if (!response.ok) {
            if (response.status === 401 || response.status === 404) {
                localStorage.removeItem('shidell_user');
                location.href = '/login.html';
                return null;
            }
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    }

    function leerUsuario() {
        try {
            const user = JSON.parse(localStorage.getItem('shidell_user') || 'null');
            if (user && !user.sessionToken) {
                localStorage.removeItem('shidell_user');
                return null;
            }
            return user;
        } catch {
            return null;
        }
    }

    function instalarAuthFetch() {
        if (window.__shidellAuthFetch) return;
        window.__shidellAuthFetch = true;
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init = {}) => {
            const user = leerUsuario();
            if (!user?.sessionToken) return originalFetch(input, init);
            const headers = new Headers(init.headers || {});
            if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${user.sessionToken}`);
            return originalFetch(input, { ...init, headers });
        };
    }

    function pintarAvatarDocente(docente) {
        const avatar = document.querySelector('.top-user-info .avatar');
        const foto = docente?.fotoPerfil || docente?.foto_perfil || '';
        if (!avatar || !esFotoValida(foto)) return;
        avatar.innerHTML = `<img src="${escapeHtml(foto)}" alt="Foto de perfil">`;
    }

    function empty(texto) {
        return `<div class="teacher-empty compact"><i class="ph ph-info"></i><p>${escapeHtml(texto)}</p></div>`;
    }

    function fechaISO(date) {
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function esFotoValida(value) {
        return typeof value === 'string' && (
            value.startsWith('data:image/') ||
            value.startsWith('/uploads/') ||
            value.startsWith('http://') ||
            value.startsWith('https://')
        );
    }

    function hora(date) {
        return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    }

    function limpiar(texto) {
        let valor = String(texto || '');
        for (let i = 0; i < 3 && /[\u00C3\u00C2]/.test(valor); i++) {
            try {
                const decoded = decodeURIComponent(escape(valor));
                if (decoded === valor) break;
                valor = decoded;
            } catch {
                break;
            }
        }
        return valor;
    }

    function normalizar(texto) {
        return limpiar(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    function colorValido(color) {
        return ['blue', 'green', 'purple', 'yellow', 'orange', 'red'].includes(color) ? color : 'blue';
    }

    function escapeHtml(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }
});
