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
    const state = { docente: null, cursos: [], dashboard: null, estudiantesPorCurso: new Map(), notasPorEstudiante: new Map() };

    $('btn-logout')?.addEventListener('click', event => {
        event.preventDefault();
        localStorage.removeItem('shidell_user');
        location.href = '../login.html';
    });
    $('btn-print')?.addEventListener('click', () => window.print());

    iniciar();

    async function iniciar() {
        try {
            const user = leerUsuario();
            if (!user || user.rol?.toUpperCase() !== 'DOCENTE') {
                location.href = '../login.html';
                return;
            }
            const docente = await api(`/api/docente/buscar?email=${encodeURIComponent(user.email)}`);
            if (!docente?.id) throw new Error('No se encontró el docente.');
            state.docente = docente;
            renderDocente(docente);

            state.dashboard = await api(`/api/docente/${docente.id}/dashboard`);
            state.cursos = Array.isArray(state.dashboard.cursos) ? state.dashboard.cursos.map(item => ({
                ...(item.curso || {}),
                alumnos: item.alumnos || 0,
                tareas: item.tareas || 0
            })) : [];
            await cargarDetalleCursos();
            render();
            setStatus(`Conectado como ${nombreCompleto(docente)}`);
        } catch (error) {
            console.error(error);
            setStatus('Error de conexión');
            $('courses-report').innerHTML = `<p class="empty-report">${escapeHtml(error.message || 'No se pudieron cargar reportes.')}</p>`;
        }
    }

    async function cargarDetalleCursos() {
        await Promise.all(state.cursos.map(async curso => {
            const estudiantes = await api(`/api/docente/curso/${curso.id}/estudiantes`).catch(() => []);
            state.estudiantesPorCurso.set(curso.id, Array.isArray(estudiantes) ? estudiantes : []);
            await Promise.all((Array.isArray(estudiantes) ? estudiantes : []).map(async estudiante => {
                if (state.notasPorEstudiante.has(estudiante.id)) return;
                const data = await api(`/api/calificaciones/estudiante/${estudiante.id}`).catch(() => ({ evaluaciones: [] }));
                state.notasPorEstudiante.set(estudiante.id, Array.isArray(data.evaluaciones) ? data.evaluaciones : []);
            }));
        }));
    }

    function render() {
        const metricas = state.dashboard?.metricas || {};
        const todasNotas = notasCursos();
        $('metric-courses').textContent = metricas.cursos ?? state.cursos.length;
        $('metric-students').textContent = metricas.estudiantes ?? contarEstudiantesUnicos();
        $('metric-tasks').textContent = metricas.tareas ?? sumarTareas();
        $('metric-average').textContent = promedio(todasNotas) || '--';
        renderCursos();
        renderDistribucion();
    }

    function renderCursos() {
        if (!state.cursos.length) {
            $('courses-report').innerHTML = '<p class="empty-report">No hay cursos asignados.</p>';
            return;
        }
        $('courses-report').innerHTML = state.cursos.map(curso => {
            const estudiantes = state.estudiantesPorCurso.get(curso.id) || [];
            const notas = notasCurso(curso.id);
            const avg = promedio(notas);
            return `
                <div class="course-report">
                    <div>
                        <h4>${escapeHtml(nombreCurso(curso))}</h4>
                        <p>${estudiantes.length} estudiantes · ${curso.tareas || 0} tareas · ${notas.length} notas registradas</p>
                    </div>
                    <span class="report-badge">${avg || '--'}</span>
                </div>`;
        }).join('');
    }

    function renderDistribucion() {
        const items = state.cursos.map(curso => ({
            nombre: nombreCurso(curso),
            valor: Math.min(100, Math.round((Number(promedio(notasCurso(curso.id))) || 0) * 5))
        }));
        $('distribution-report').innerHTML = items.length ? items.map(item => `
            <div class="mini-bar">
                <label><span>${escapeHtml(item.nombre)}</span><strong>${item.valor}%</strong></label>
                <div class="bar-track"><div class="bar-fill" style="width:${item.valor}%"></div></div>
            </div>`).join('') : '<p class="empty-report">Sin datos para graficar.</p>';
    }

    function renderDocente(docente) {
        const nombre = nombreCompleto(docente);
        $('user-name-label').textContent = nombre;
        $('report-context').textContent = `${nombre} · reportes sincronizados con el API`;
        $('reports-title').textContent = `Reporte de ${nombre.split(' ')[0] || 'docente'}`;
        renderAvatar($('profile-avatar'), docente);
    }

    function notasCursos() {
        return state.cursos.flatMap(curso => notasCurso(curso.id));
    }

    function notasCurso(cursoId) {
        return Array.from(state.notasPorEstudiante.values())
            .flat()
            .filter(cal => String(cal.curso?.id) === String(cursoId))
            .map(cal => Number(cal.nota20 ?? cal.nota))
            .filter(Number.isFinite);
    }

    function contarEstudiantesUnicos() {
        const ids = new Set();
        state.estudiantesPorCurso.forEach(lista => lista.forEach(estudiante => ids.add(estudiante.id)));
        return ids.size;
    }

    function sumarTareas() {
        return state.cursos.reduce((sum, curso) => sum + Number(curso.tareas || 0), 0);
    }

    async function api(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, options);
        if (!response.ok) {
            if (response.status === 401 || response.status === 404) {
                localStorage.removeItem('shidell_user');
                location.href = '../login.html';
                return null;
            }
            throw new Error(`Error HTTP ${response.status}`);
        }
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

    function promedio(values) {
        if (!values.length) return '';
        return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
    }

    function nombreCurso(curso = {}) {
        return [limpiarTexto(curso.nombre || 'Curso'), curso.grado ? `${curso.grado}° ${curso.seccion || ''}`.trim() : ''].filter(Boolean).join(' - ');
    }

    function nombreCompleto(user = {}) {
        return limpiarTexto(`${user.nombres || ''} ${user.apellidos || ''}`).trim() || 'Docente';
    }

    function renderAvatar(container, user) {
        if (!container) return;
        const foto = primeraFotoValida(user?.fotoPerfil, user?.foto_perfil);
        container.innerHTML = foto ? `<img src="${escapeHtml(foto)}" alt="Foto de perfil">` : '<i class="ph-fill ph-user-circle" style="font-size:32px;"></i>';
    }

    function primeraFotoValida(...values) {
        return values.find(value => typeof value === 'string' && /^(data:image\/|\/uploads\/|https?:\/\/)/i.test(value)) || '';
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
        $('server-status').textContent = `Estado: ${text}`;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }
});
