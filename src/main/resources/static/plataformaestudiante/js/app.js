let usuarioSesionActual = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await obtenerUsuarioSesion();
    if (!user) return;

    usuarioSesionActual = user;
    actualizarIdentidad(user);
    sincronizarUsuarioDesdeBackend(user);
    iniciarPing(user.id);
    configurarLogout();
    configurarMenuCuenta();
    cargarConfiguracionGlobal();

    if (document.getElementById('dashboard-cursos')) cargarResumenDashboard(user);
    if (document.getElementById('upcomingClassesList')) cargarClasesDashboard(user);
    if (document.getElementById('taskList')) cargarTareasDashboard(user);
    if (document.getElementById('messageList')) cargarMensajesDashboard(user);
    if (document.getElementById('progreso-promedio') && !window.__shidellProgresoPage) cargarProgreso(user);
});

async function sincronizarUsuarioDesdeBackend(user) {
    if (!user?.id) return;

    try {
        const res = await fetch(`/api/users/${user.id}`);
        if (!res.ok) return;

        const freshUser = await res.json();
        const backendFoto = freshUser.fotoPerfil || '';
        const fotoPerfil = primeraFotoValida(user.fotoPerfil, freshUser.fotoPerfil);

        if (fotoPerfil) {
            freshUser.fotoPerfil = fotoPerfil;
            if (backendFoto !== fotoPerfil) {
                guardarFotoPerfilBackend(freshUser.id, fotoPerfil);
            }
        } else if (freshUser.fotoPerfil && !esFotoValida(freshUser.fotoPerfil)) {
            freshUser.fotoPerfil = '';
            guardarFotoPerfilBackend(freshUser.id, '');
        }

        usuarioSesionActual = freshUser;
        actualizarIdentidad(freshUser);
    } catch (error) {
        console.warn('No se pudo sincronizar el usuario.', error);
    }
}

async function obtenerUsuarioSesion() {
    if (window.shidellSession?.obtenerUsuario) {
        return await window.shidellSession.obtenerUsuario();
    }
    return null;
}

function actualizarIdentidad(user) {
    const nombreCompleto = [user.nombres, user.apellidos].filter(Boolean).join(' ').trim() || 'Estudiante';
    const saludo = document.querySelector('.greeting h1');

    if (saludo && /hola/i.test(saludo.textContent)) {
        saludo.textContent = `¡Hola, ${user.nombres || 'Estudiante'}! 👋`;
    }
    document.querySelectorAll('.user-name').forEach(el => {
        el.textContent = nombreCompleto;
    });

    // Grado y Sección dinámicos
    const infoAcademica = document.getElementById('user-academic-info');
    if (infoAcademica && user.grado) {
        const gradoStr = user.grado === '1' ? '1er' : user.grado === '2' ? '2do' : user.grado === '3' ? '3er' : `${user.grado}to`;
        const nivelStr = (user.nivel || 'SECUNDARIA').toLowerCase();
        const nivelCapitalizado = nivelStr.charAt(0).toUpperCase() + nivelStr.slice(1);
        infoAcademica.textContent = `${gradoStr} Grado de ${nivelCapitalizado} - Sección ${user.seccion || 'A'}`;
    }

    normalizarPerfilSuperior(nombreCompleto);
    actualizarAvatarPerfil(user);
}

function normalizarPerfilSuperior(nombreCompleto) {
    document.querySelectorAll('.top-user-info').forEach(menu => {
        let detalles = menu.querySelector('.user-details');
        if (!detalles) {
            detalles = document.createElement('div');
            detalles.className = 'user-details';
            menu.prepend(detalles);
        }

        let nombre = detalles.querySelector('.user-name');
        if (!nombre) {
            nombre = document.createElement('span');
            nombre.className = 'user-name';
            detalles.prepend(nombre);
        }
        nombre.textContent = nombreCompleto;

        if (!detalles.querySelector('.user-action')) {
            const enlace = document.createElement('a');
            enlace.href = 'configuracion.html';
            enlace.style.textDecoration = 'none';
            enlace.innerHTML = '<span class="user-action">Ver perfil <i class="ph ph-caret-right"></i></span>';
            detalles.appendChild(enlace);
        }

        if (!menu.querySelector('.avatar')) {
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            menu.appendChild(avatar);
        }
    });
}

function actualizarAvatarPerfil(user = usuarioSesionActual) {
    const fotoPerfil = primeraFotoValida(user?.fotoPerfil);

    document.querySelectorAll('.top-user-info .avatar, .user-profile-card .avatar').forEach(avatar => {
        avatar.innerHTML = fotoPerfil
            ? `<img src="${escapeHtml(fotoPerfil)}" alt="Foto de perfil">`
            : '<i class="ph-fill ph-user" style="font-size:24px;color:var(--primary);"></i>';
    });
}

function configurarMenuCuenta() {
    document.querySelectorAll('.top-user-info').forEach(menu => {
        if (menu.dataset.accountMenuReady === 'true') return;

        const action = menu.querySelector('.user-action');
        const actionLink = action?.closest('a');
        if (!action) return;
        menu.dataset.accountMenuReady = 'true';

        action.classList.add('account-menu-toggle');
        action.setAttribute('role', 'button');
        action.setAttribute('aria-haspopup', 'true');
        action.setAttribute('aria-expanded', 'false');
        actionLink?.setAttribute('href', '#');

        const dropdown = document.createElement('div');
        dropdown.className = 'account-dropdown';
        dropdown.innerHTML = `
            <a href="configuracion.html"><i class="ph ph-user-circle"></i> Ver perfil</a>
            <button type="button" class="account-logout"><i class="ph ph-sign-out"></i> Cerrar sesion</button>
        `;
        menu.appendChild(dropdown);

        const toggle = event => {
            event.preventDefault();
            event.stopPropagation();
            const isOpen = menu.classList.toggle('open');
            action.setAttribute('aria-expanded', String(isOpen));
        };

        action.addEventListener('click', toggle);
        actionLink?.addEventListener('click', toggle);
        dropdown.querySelector('.account-logout')?.addEventListener('click', event => {
            event.preventDefault();
            cerrarSesion();
        });
    });

    if (!window.__shidellAccountMenuCloseReady) {
        window.__shidellAccountMenuCloseReady = true;
        document.addEventListener('click', () => {
            document.querySelectorAll('.top-user-info.open').forEach(menu => {
                menu.classList.remove('open');
                menu.querySelector('.account-menu-toggle')?.setAttribute('aria-expanded', 'false');
            });
        });
    }
}

function iniciarPing(userId) {
    if (!userId) return;

    const ping = () => fetch(`/api/users/${userId}/ping`, { method: 'PUT' }).catch(() => {});
    ping();
    setInterval(ping, 30000);
}

function configurarLogout() {
    const logoutBtn = document.getElementById('btn-logout');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', event => {
        event.preventDefault();
        cerrarSesion();
    });
}

async function cargarTareasDashboard(user) {
    const container = document.getElementById('taskList');
    if (!container) return;

    try {
        const response = await fetch(`/api/tareas/estudiante/${user.id}`);
        const data = response.ok ? await response.json() : {};
        const tareas = Array.isArray(data.tareas) ? data.tareas : [];
        const pendientes = tareas.filter(tarea => tarea.status === 'Pendiente');

        if (!pendientes.length) {
            container.innerHTML = '<p style="padding:20px;color:var(--text-muted);">No hay tareas pendientes.</p>';
            return;
        }

        container.innerHTML = pendientes.slice(0, 4).map(tarea => {
            const prioridad = tarea.prioridad || 'Media';
            const priorityClass = prioridad === 'Alta' ? 'bg-red-light' : prioridad === 'Media' ? 'bg-yellow-light' : 'bg-green-light';
            const priorityIcon = prioridad === 'Alta' ? '^' : prioridad === 'Media' ? '-' : 'v';
            const curso = tarea.curso?.nombre || 'General';

            return `
                <div class="task-item">
                    <div class="check-circle"></div>
                    <div class="task-main">
                        <h4 class="item-title">${escapeHtml(tarea.titulo || 'Tarea')}</h4>
                        <div class="item-subtitle">${escapeHtml(curso)} <span>-</span> Vence: ${escapeHtml(tarea.fechaVencimiento || '')}</div>
                    </div>
                    <span class="priority-tag ${priorityClass}">${priorityIcon} ${escapeHtml(prioridad)}</span>
                </div>`;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p style="padding:20px;color:var(--red);">No se pudieron cargar las tareas.</p>';
    }
}

async function cargarResumenDashboard(user) {
    try {
        const [progresoRes, tareasRes] = await Promise.all([
            fetch(`/api/progreso/estudiante/${user.id}`),
            fetch(`/api/tareas/estudiante/${user.id}`)
        ]);

        const progreso = progresoRes.ok ? await progresoRes.json() : {};
        const tareasData = tareasRes.ok ? await tareasRes.json() : {};
        const resumenTareas = tareasData.resumen || {};

        actualizarTexto('dashboard-cursos', progreso.cursosActivos ?? progreso.cursosTotales ?? 0);
        actualizarTexto('dashboard-tareas', resumenTareas.pendientes ?? 0);
        actualizarTexto('dashboard-horas', (progreso.horasEstudioSemana ?? 0) + 'h');
        actualizarTexto('dashboard-promedio', numero(progreso.promedioGeneral, 1));

        const mensaje = progreso.mensajeMotivacional || {};
        actualizarTexto('home-banner-title', mensaje.titulo || 'Tu panel refleja tus cursos, tareas y notas actuales.');
        actualizarTexto('home-banner-text', mensaje.texto || `Promedio ${numero(progreso.promedioGeneral, 1)} de 20 · ${resumenTareas.pendientes ?? 0} tareas pendientes`);
        actualizarMotivacionSidebar(mensaje);
    } catch (error) {
        console.warn('No se pudo cargar el resumen del estudiante.', error);
    }
}

function actualizarMotivacionSidebar(mensaje) {
    const titulo = mensaje.titulo || 'Sigue avanzando';
    const texto = mensaje.texto || 'Revisa tu reporte para ver tus notas, tareas y asistencia.';
    const icono = mensaje.icono || 'ph-target';

    actualizarTexto('motivacion-titulo', titulo);
    actualizarTexto('motivacion-texto', texto);

    const icon = document.getElementById('motivacion-icono');
    if (icon) icon.innerHTML = `<i class="ph-fill ${escapeHtml(icono)}"></i>`;
}

async function cargarClasesDashboard(user) {
    const container = document.getElementById('upcomingClassesList');
    if (!container) return;

    try {
        const response = await fetch(`/api/calendario/estudiante/${user.id}`);
        const data = response.ok ? await response.json() : {};
        const eventos = Array.isArray(data.eventos) ? data.eventos : [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const clases = eventos
            .filter(evento => {
                const tipo = String(evento.tipo || '').toUpperCase();
                const fecha = new Date((evento.fechaInicio || evento.fecha) + 'T12:00:00');
                fecha.setHours(0, 0, 0, 0);
                return tipo === 'CLASE' && fecha >= hoy;
            })
            .sort((a, b) => new Date((a.fechaInicio || a.fecha) + 'T12:00:00') - new Date((b.fechaInicio || b.fecha) + 'T12:00:00'))
            .slice(0, 3);

        if (!clases.length) {
            container.innerHTML = '<p style="padding:20px;color:var(--text-muted);">No hay clases próximas registradas.</p>';
            return;
        }

        container.innerHTML = clases.map(evento => {
            const color = colorCursoValido(evento.color);
            const icono = evento.icono || 'ph-book-open';
            const fecha = new Date(evento.fechaInicio || evento.fecha);
            const etiqueta = fecha.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' });
            const horario = evento.hora || 'Horario por confirmar';

            return `
                <div class="panel-item">
                    <div class="item-icon-box bg-${escapeHtml(color)}-light"><i class="ph-fill ${escapeHtml(icono)}"></i></div>
                    <div class="item-main">
                        <h4 class="item-title">${escapeHtml(evento.curso || evento.titulo || 'Clase')}</h4>
                        <div class="item-subtitle"><i class="ph ph-clock"></i> ${escapeHtml(horario)}</div>
                    </div>
                    <span class="item-badge bg-blue-light">${escapeHtml(etiqueta)}</span>
                </div>`;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p style="padding:20px;color:var(--red);">No se pudieron cargar las clases.</p>';
    }
}

async function cargarMensajesDashboard(user) {
    const container = document.getElementById('messageList');
    if (!container || !user.id) return;

    try {
        const response = await fetch(`/api/mensajes/recientes/${user.id}`);
        const contactos = response.ok ? await response.json() : [];

        if (!contactos.length) {
            container.innerHTML = '<p style="padding:20px;color:var(--text-muted);">No hay mensajes recientes.</p>';
            return;
        }

        const cards = await Promise.all(contactos.slice(0, 2).map(async contacto => {
            const mensajesRes = await fetch(`/api/mensajes/conversacion?u1=${user.id}&u2=${contacto.id}`).catch(() => null);
            const mensajes = mensajesRes && mensajesRes.ok ? await mensajesRes.json() : [];
            const ultimo = mensajes[mensajes.length - 1];
            const nombre = [contacto.nombres, contacto.apellidos].filter(Boolean).join(' ').trim();

            return `
                <div class="message-card" onclick="window.location.href='mensajes.html?chatId=${contacto.id}'" style="cursor:pointer;">
                    <div class="msg-avatar">
                        <i class="ph-fill ph-user-circle" style="font-size:40px;color:var(--primary);"></i>
                    </div>
                    <div class="msg-body">
                        <div class="msg-header">
                            <span class="msg-author">${escapeHtml(nombre || 'Contacto')}</span>
                            <span class="msg-role">${escapeHtml(contacto.rol || '')}</span>
                        </div>
                        <p class="msg-snippet">${escapeHtml(ultimo?.contenido || 'Sin mensajes')}</p>
                    </div>
                    <div class="msg-meta">
                        <span class="msg-time">Reciente</span>
                        <div class="msg-status"></div>
                    </div>
                </div>`;
        }));

        container.innerHTML = cards.join('');
    } catch (error) {
        container.innerHTML = '<p style="padding:20px;color:var(--red);">No se pudieron cargar los mensajes.</p>';
    }
}

async function cargarProgreso(user) {
    try {
        const response = await fetch(`/api/progreso/estudiante/${user.id}`);
        if (!response.ok) return;

        const data = await response.json();
        actualizarTexto('progreso-promedio', `${numero(data.promedioGeneral, 1)} <span>/ 20</span>`, true);
        actualizarTexto('progreso-cursos', `${data.cursosTotales || 0} <span>/ ${data.cursosTotales || 0}</span>`, true);
        actualizarProgresoTareas(data);
        actualizarBadgeProgreso(data.promedioGeneral || 0);
        renderProgresoPorCurso(data.progresoPorCurso || []);
        actualizarTexto('racha-valor', data.rachaDias || 0);
        actualizarTexto('racha-mejor', `Mejor racha: ${data.mejorRacha || 0} dias`);

        const mejora = document.getElementById('progreso-mejora-texto');
        if (mejora) {
            mejora.innerHTML = `Has mejorado <strong>+${numero(data.mejoradoPuntos, 1)} puntos</strong> en tu promedio general comparado con el semestre anterior.`;
        }
    } catch (error) {
        console.error('Error cargando progreso:', error);
    }
}

function actualizarProgresoTareas(data) {
    const completadas = data.tareasCompletadas || 0;
    const total = data.tareasTotales || 0;
    const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

    actualizarTexto('progreso-tareas-count', `${completadas} <span>/ ${total}</span>`, true);
    actualizarTexto('progreso-tareas-pct', porcentaje);

    const barra = document.getElementById('progreso-tareas-bar');
    if (barra) barra.style.width = `${porcentaje}%`;
}

function actualizarBadgeProgreso(promedio) {
    const badge = document.getElementById('progreso-badge');
    if (!badge) return;

    if (promedio >= 17) {
        badge.textContent = 'Excelente';
        badge.style.color = 'var(--green)';
    } else if (promedio >= 14) {
        badge.textContent = 'Muy bueno';
        badge.style.color = 'var(--blue)';
    } else if (promedio >= 11) {
        badge.textContent = 'Regular';
        badge.style.color = 'var(--yellow)';
    } else {
        badge.textContent = 'Necesita mejorar';
        badge.style.color = 'var(--red)';
    }
}

function renderProgresoPorCurso(cursos) {
    const courseList = document.querySelector('.p-course-list');
    if (!courseList) return;

    cursos = normalizarCursosProgreso(cursos);

    if (!cursos.length) {
        courseList.innerHTML = '<p style="padding:16px;color:var(--text-muted);">No hay cursos para mostrar.</p>';
        return;
    }

    courseList.innerHTML = cursos.map(curso => {
        const color = colorCursoValido(curso.color);
        const icono = curso.icono || 'ph-book-open';
        const porcentaje = Math.max(0, Math.min(100, Number(curso.porcentaje || 0)));

        return `
            <div class="p-course-item">
                <div class="p-course-icon bg-${escapeHtml(color)}-light" style="color:var(--${escapeHtml(color)});">
                    <i class="ph-fill ${escapeHtml(icono)}"></i>
                </div>
                <div class="p-course-name">${escapeHtml(limpiarTexto(curso.nombre || 'Curso'))}</div>
                <div class="p-course-bar-container">
                    <div class="p-course-bar-fill bg-${escapeHtml(color)}" style="width:${porcentaje}%;"></div>
                </div>
                <div class="p-course-pct">${porcentaje}%</div>
            </div>`;
    }).join('');
}

function normalizarCursosProgreso(cursos) {
    const map = new Map();

    (Array.isArray(cursos) ? cursos : []).forEach(curso => {
        const nombre = limpiarTexto(curso.nombre || 'Curso');
        const key = quitarAcentos(nombre).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || `curso-${curso.id || map.size}`;
        const porcentaje = Math.max(0, Math.min(100, Number(curso.porcentaje || 0)));

        if (!map.has(key) || porcentaje > Number(map.get(key).porcentaje || 0)) {
            map.set(key, { ...curso, nombre, porcentaje });
        }
    });

    return [...map.values()];
}

function limpiarTexto(texto) {
    let valor = String(texto || '');
    for (let i = 0; i < 3 && /[\u00C3\u00C2]/.test(valor); i++) {
        try {
            const decodificado = decodeURIComponent(escape(valor));
            if (decodificado === valor) break;
            valor = decodificado;
        } catch (error) {
            break;
        }
    }
    return valor;
}

async function cargarConfiguracionGlobal() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) return;
        const config = await response.json();
        
        // Actualizar nombres de la institución y año en todo el portal
        document.querySelectorAll('.logo-text h2').forEach(el => el.textContent = config.nombreInstitucion || 'Shidell');
        
        const elAño = document.getElementById('school-year-display');
        if (elAño) {
            elAño.innerHTML = `<i class="ph ph-calendar-dots"></i>
                <div>
                    <strong>Año escolar Perú ${config.año}: ${config.totalSemanas} semanas lectivas</strong>
                    <span>Organizado en 4 bloques de 9 semanas. Cada semana queda fija y el docente puede publicar tema, foro, actividades y archivos.</span>
                </div>`;
        }
        
        const elBannerTitle = document.getElementById('home-banner-title');
        if (elBannerTitle && config.mensajeGlobal) {
            elBannerTitle.innerHTML = `<i class="ph-fill ph-chart-line-up"></i> ${config.mensajeGlobal}`;
        }
    } catch (e) {
        console.warn('No se pudo cargar la configuración global:', e);
    }
}

function quitarAcentos(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function colorCursoValido(color) {
    return ['purple', 'green', 'blue', 'yellow', 'red', 'orange', 'teal', 'indigo'].includes(color) ? color : 'blue';
}

function actualizarTexto(id, valor, html = false) {
    const el = document.getElementById(id);
    if (!el) return;
    if (html) el.innerHTML = valor;
    else el.textContent = valor;
}

function numero(valor, decimales) {
    return Number(valor || 0).toFixed(decimales);
}

function primeraFotoValida(...values) {
    return values.find(esFotoValida) || '';
}

function esFotoValida(value) {
    return typeof value === 'string' && (
        value.startsWith('data:image/') ||
        value.startsWith('/uploads/') ||
        value.startsWith('http://') ||
        value.startsWith('https://')
    );
}

async function guardarFotoPerfilBackend(userId, fotoPerfil) {
    if (!userId) return;
    try {
        await fetch(`/api/users/${userId}/foto-perfil`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fotoPerfil: fotoPerfil || '' })
        });
    } catch (error) {
        console.warn('No se pudo actualizar la foto en la base de datos.', error);
    }
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

window.cerrarSesion = function () {
    window.shidellSession?.cerrarSesion?.();
};
