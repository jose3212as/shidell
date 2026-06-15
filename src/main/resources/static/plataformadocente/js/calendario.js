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
    const defaultTeacherEmail = 'profesor@shidell.edu';

    const grid = document.getElementById('calendar-grid');
    const monthDisplay = document.getElementById('month-display');
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const courseStrip = document.getElementById('course-strip');
    const courseList = document.getElementById('course-list');
    const upcomingList = document.getElementById('upcoming-list');
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const state = {
        docente: null,
        cursos: [],
        eventos: [],
        cursosFiltro: new Set(),
        currentDate: new Date()
    };

    prevBtn.onclick = () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        renderCalendar();
        renderSummary();
    };
    nextBtn.onclick = () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        renderCalendar();
        renderSummary();
    };

    document.getElementById('btn-logout')?.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('shidell_user');
        location.href = '../login.html';
    });

    inicializar();

    async function inicializar() {
        renderLoading();
        try {
            const docente = await api(`/api/docente/buscar?email=${encodeURIComponent(getTeacherEmail())}`);
            if (!docente?.id || docente.rol?.toUpperCase() !== 'DOCENTE') {
                throw new Error('No se encontró una cuenta docente válida.');
            }

            state.docente = docente;
            renderTeacher(docente);

            const cursosApi = await api(`/api/docente/${docente.id}/cursos`);
            state.cursos = deduplicarCursos(Array.isArray(cursosApi) ? cursosApi : []);
            state.cursosFiltro = new Set(state.cursos.map((curso) => String(curso.id)));

            await cargarEventosDocente();
            renderCursos();
            renderCalendar();
            renderUpcoming();
            renderSummary();
        } catch (error) {
            grid.innerHTML = `<div style="grid-column:1/-1; padding:40px; text-align:center; color:var(--red);">${escapeHtml(error.message || 'No se pudo cargar el calendario.')}</div>`;
            document.getElementById('teacher-context').textContent = 'Error al conectar con el API del docente';
        }
    }

    async function cargarEventosDocente() {
        const tareasPorCurso = await Promise.all(state.cursos.map(async (curso) => {
            const tareas = await api(`/api/docente/curso/${curso.id}/tareas`);
            return (Array.isArray(tareas) ? tareas : [])
                .filter((tarea) => tarea.fechaVencimiento)
                .map((tarea) => ({
                    titulo: tarea.titulo || 'Tarea',
                    fecha: tarea.fechaVencimiento,
                    tipo: 'TASK',
                    curso: tarea.curso || curso,
                    cursoId: (tarea.curso || curso)?.id || null
                }));
        }));

        const examenesApi = await api(`/api/docente/${state.docente.id}/eventos?tipo=EXAMEN`);
        const examenes = (Array.isArray(examenesApi) ? examenesApi : [])
            .filter((evento) => evento.fechaInicio)
            .map((evento) => ({
                titulo: evento.titulo || 'Examen',
                fecha: String(evento.fechaInicio).split('T')[0],
                tipo: 'EXAM',
                curso: cursoDelEvento(evento),
                cursoId: cursoDelEvento(evento)?.id || null
            }));

        const clasesApi = await api(`/api/docente/${state.docente.id}/eventos?tipo=CLASE`);
        const clases = (Array.isArray(clasesApi) ? clasesApi : [])
            .filter((evento) => evento.fechaInicio)
            .map((evento) => {
                const curso = cursoDelEvento(evento);
                return {
                    titulo: evento.titulo || 'Clase',
                    fecha: String(evento.fechaInicio).split('T')[0],
                    hora: String(evento.fechaInicio).split('T')[1]?.slice(0, 5) || '',
                    tipo: 'CLASS',
                    curso,
                    cursoId: curso?.id || null
                };
            });

        state.eventos = [
            ...deduplicarPorClave(tareasPorCurso.flat()),
            ...deduplicarPorClave(examenes),
            ...deduplicarPorClave(clases)
        ];
    }

    function renderCalendar() {
        grid.innerHTML = '';
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();

        monthDisplay.textContent = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(state.currentDate);

        dayNames.forEach((name) => {
            const header = document.createElement('div');
            header.className = 'day-header';
            header.textContent = name;
            grid.appendChild(header);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement('div'));
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (new Date().toISOString().split('T')[0] === dateStr) cell.classList.add('today');
            cell.innerHTML = `<span class="day-number">${day}</span>`;

            state.eventos
                .filter((evento) => evento.fecha === dateStr && eventoVisible(evento))
                .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')))
                .forEach((evento) => {
                    const tag = document.createElement('span');
                    tag.className = `event-tag ${eventClass(evento.tipo)}`;
                    tag.textContent = `${evento.hora ? evento.hora + ' ' : ''}${limpiarTexto(evento.titulo)}`;
                    tag.title = evento.curso ? `${limpiarTexto(evento.titulo)} · ${nombreCurso(evento.curso)}` : limpiarTexto(evento.titulo);
                    cell.appendChild(tag);
                });

            grid.appendChild(cell);
        }
    }

    function renderLoading() {
        grid.innerHTML = '<div style="grid-column:1/-1; padding:40px; text-align:center;">Cargando calendario desde el API...</div>';
    }

    function renderTeacher(docente) {
        const nombre = nombreCompleto(docente);
        document.getElementById('user-name-label').textContent = nombre;
        document.getElementById('teacher-context').textContent = `${nombre} · calendario sincronizado con sus cursos`;
        renderAvatar(document.getElementById('profile-avatar'), docente);
    }

    function renderCursos() {
        if (!state.cursos.length) {
            courseStrip.innerHTML = '';
            courseList.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">Este docente no tiene cursos asignados.</p>';
            return;
        }

        const allActive = state.cursosFiltro.size === state.cursos.length;
        courseStrip.innerHTML = `
            <button class="course-pill ${allActive ? 'active' : ''}" data-course="all">
                <span class="course-dot"></span>Todos los cursos
            </button>
            ${state.cursos.map((curso) => `
                <button class="course-pill ${state.cursosFiltro.has(String(curso.id)) ? 'active' : ''}" data-course="${curso.id}">
                    <span class="course-dot" style="background:${colorCurso(curso.color)}"></span>${escapeHtml(limpiarTexto(curso.nombre))}
                </button>
            `).join('')}
        `;

        courseStrip.querySelectorAll('.course-pill').forEach((button) => {
            button.addEventListener('click', () => toggleCurso(button.dataset.course));
        });

        courseList.innerHTML = state.cursos.map((curso) => {
            const count = state.eventos.filter((evento) => String(evento.cursoId) === String(curso.id)).length;
            return `
                <div class="course-card">
                    <div class="course-card-icon" style="background:${colorCurso(curso.color)}">
                        <i class="ph ${escapeHtml(curso.icono || 'ph-book-open')}"></i>
                    </div>
                    <div class="course-card-body">
                        <h4>${escapeHtml(limpiarTexto(curso.nombre || 'Curso'))}</h4>
                        <p>${escapeHtml(curso.nivel || 'Nivel')} · ${escapeHtml(curso.grado || '')}° ${escapeHtml(curso.seccion || '')}</p>
                    </div>
                    <span class="course-card-count">${count}</span>
                </div>
            `;
        }).join('');
    }

    function toggleCurso(id) {
        if (id === 'all') {
            state.cursosFiltro = state.cursosFiltro.size === state.cursos.length
                ? new Set()
                : new Set(state.cursos.map((curso) => String(curso.id)));
        } else if (state.cursosFiltro.has(String(id))) {
            state.cursosFiltro.delete(String(id));
        } else {
            state.cursosFiltro.add(String(id));
        }
        renderCursos();
        renderCalendar();
        renderUpcoming();
        renderSummary();
    }

    function renderUpcoming() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const próximos = state.eventos
            .filter(eventoVisible)
            .filter((evento) => new Date(`${evento.fecha}T00:00:00`) >= today)
            .sort((a, b) => `${a.fecha} ${a.hora || ''}`.localeCompare(`${b.fecha} ${b.hora || ''}`))
            .slice(0, 6);

        if (!próximos.length) {
            upcomingList.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">No hay próximos eventos para los cursos seleccionados.</p>';
            return;
        }

        upcomingList.innerHTML = próximos.map((evento) => `
            <div class="event-row">
                <div class="event-icon" style="background:${eventColor(evento.tipo)}"><i class="ph ${eventIcon(evento.tipo)}"></i></div>
                <div class="event-info">
                    <h4>${escapeHtml(limpiarTexto(evento.titulo))}</h4>
                    <p>${escapeHtml(evento.curso ? nombreCurso(evento.curso) : tipoLabel(evento.tipo))}</p>
                    <div class="e-date">${escapeHtml(formatDate(evento.fecha))}${evento.hora ? ', ' + escapeHtml(evento.hora) : ''}</div>
                </div>
            </div>
        `).join('');
    }

    function renderSummary() {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        const eventosMes = state.eventos.filter((evento) => {
            if (!eventoVisible(evento)) return false;
            const date = new Date(`${evento.fecha}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        document.getElementById('sum-classes').textContent = eventosMes.filter((e) => e.tipo === 'CLASS').length;
        document.getElementById('sum-tasks').textContent = eventosMes.filter((e) => e.tipo === 'TASK').length;
        document.getElementById('sum-exams').textContent = eventosMes.filter((e) => e.tipo === 'EXAM').length;
        document.getElementById('sum-total').textContent = eventosMes.length;
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

    function getTeacherEmail() {
        try {
            const user = JSON.parse(localStorage.getItem('shidell_user') || 'null');
            return user?.rol?.toUpperCase() === 'DOCENTE' && user.email ? user.email : defaultTeacherEmail;
        } catch (error) {
            return defaultTeacherEmail;
        }
    }

    function deduplicarCursos(cursos) {
        const map = new Map();
        cursos.forEach((curso) => {
            const key = [normalizar(curso.nombre), curso.nivel, curso.grado, curso.seccion].join('|');
            if (!map.has(key) || Number(curso.id) < Number(map.get(key).id)) map.set(key, curso);
        });
        return Array.from(map.values());
    }

    function deduplicarPorClave(items) {
        const map = new Map();
        items.forEach((item) => map.set(`${item.tipo}|${item.fecha}|${normalizar(item.titulo)}`, item));
        return Array.from(map.values());
    }

    function cursoDelEvento(evento = {}) {
        const titulo = normalizar(evento.titulo);
        const porNombre = state.cursos.find((curso) => titulo.includes(normalizar(curso.nombre)));
        if (porNombre) return porNombre;
        return state.cursos.find((curso) => evento.color && curso.color === evento.color) || null;
    }

    function eventoVisible(evento) {
        if (!evento.cursoId) return true;
        return state.cursosFiltro.has(String(evento.cursoId));
    }

    function eventClass(tipo) {
        if (tipo === 'TASK') return 'event-task';
        if (tipo === 'EXAM') return 'event-exam';
        if (tipo === 'CLASS') return 'event-class';
        return 'event-other';
    }

    function eventColor(tipo) {
        if (tipo === 'TASK') return '#4f46e5';
        if (tipo === 'EXAM') return '#ef4444';
        if (tipo === 'CLASS') return '#3b82f6';
        return '#64748b';
    }

    function eventIcon(tipo) {
        if (tipo === 'TASK') return 'ph-clipboard-text';
        if (tipo === 'EXAM') return 'ph-exam';
        if (tipo === 'CLASS') return 'ph-book-open';
        return 'ph-calendar-blank';
    }

    function tipoLabel(tipo) {
        if (tipo === 'TASK') return 'Tarea';
        if (tipo === 'EXAM') return 'Examen';
        if (tipo === 'CLASS') return 'Clase';
        return 'Evento';
    }

    function colorCurso(color) {
        const colors = {
            purple: '#7c3aed',
            green: '#10b981',
            blue: '#3b82f6',
            yellow: '#f59e0b',
            red: '#ef4444',
            orange: '#f97316'
        };
        return colors[color] || color || '#4f46e5';
    }

    function formatDate(value) {
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-PE', { day: '2-digit', month: 'long' });
    }

    function renderAvatar(container, user) {
        if (!container) return;
        const foto = primeraFotoValida(user?.fotoPerfil, user?.foto_perfil);
        container.innerHTML = foto ? `<img src="${escapeHtml(foto)}" alt="Foto de perfil">` : '<i class="ph-fill ph-user-circle" style="font-size: 32px;"></i>';
    }

    function nombreCurso(curso = {}) {
        return [limpiarTexto(curso.nombre || 'Curso'), curso.grado ? `${curso.grado}° ${curso.seccion || ''}`.trim() : ''].filter(Boolean).join(' - ');
    }

    function nombreCompleto(user = {}) {
        return limpiarTexto(`${user.nombres || ''} ${user.apellidos || ''}`).trim() || 'Docente';
    }

    function normalizar(value) {
        return limpiarTexto(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    function limpiarTexto(value) {
        let text = String(value ?? '');
        for (let i = 0; i < 2 && /Ã|Â/.test(text); i++) {
            try {
                const fixed = decodeURIComponent(escape(text));
                if (!fixed || fixed === text) break;
                text = fixed;
            } catch (error) {
                break;
            }
        }
        return text.replace(/Â/g, '');
    }

    function primeraFotoValida(...values) {
        return values.find((value) => typeof value === 'string' && (
            value.startsWith('data:image/') ||
            value.startsWith('/uploads/') ||
            value.startsWith('http://') ||
            value.startsWith('https://')
        )) || '';
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }
});
