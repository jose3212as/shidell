// Shidell - Portal Padres de Familia
// FIXED: clave sesión, evento hijo-cargado, campo nota20, asistencia via progreso
instalarAuthFetchPadres();

function instalarAuthFetchPadres() {
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

    // ── 1. Sesión ──────────────────────────────────────────
    // El login guarda con 'shidell_user' — usamos esa clave
    const storedUser = localStorage.getItem('shidell_user');
    if (!storedUser) { window.location.href = '/login.html'; return; }
    const padre = JSON.parse(storedUser);
    if (!padre.sessionToken) {
        localStorage.removeItem('shidell_user');
        window.location.href = '/login.html';
        return;
    }
    if (padre.rol !== 'PADRE') { window.location.href = '/login.html'; return; }

    // Exponemos al padre globalmente para que otras páginas lo usen
    window._padreActual = padre;
    refrescarPadreDesdeBackend(padre);

    // ── 2. Rellenar UI con datos del padre ─────────────────
    document.querySelectorAll('.padre-nombre').forEach(el => {
        el.textContent = (padre.nombres || '') + ' ' + (padre.apellidos || '');
    });
    renderAvatarPadre(padre);

    // ── 3. Cargar hijo activo ──────────────────────────────
    let hijoActivo = null;
    window._hijoActivo = null;

    async function cargarHijos() {
        try {
            const res = await fetch(`/api/admin/padres/${padre.id}/hijos`);
            if (!res.ok) return;
            const hijos = await res.json();
            if (hijos.length === 0) {
                // Mostrar mensaje de sin hijos vinculados
                const hijoNombreEl = document.getElementById('hijo-nombre');
                if (hijoNombreEl) hijoNombreEl.textContent = 'Sin hijos vinculados';
                const hijoInfoEl = document.getElementById('hijo-info');
                if (hijoInfoEl) hijoInfoEl.textContent = 'Contacta al administrador para vincular a tu hijo/a';
                return;
            }

            hijoActivo = hijos[0];
            window._hijoActivo = hijoActivo;
            renderHijoActivo();

            // Selector de hijos (si tiene más de uno)
            const selectorHijo = document.getElementById('hijo-selector-list');
            if (selectorHijo && hijos.length > 1) {
                selectorHijo.innerHTML = '';
                hijos.forEach((h, i) => {
                    const btn = document.createElement('button');
                    btn.className = `btn-hijo${i === 0 ? ' active' : ''}`;
                    btn.textContent = h.nombres;
                    btn.onclick = () => {
                        hijoActivo = h;
                        window._hijoActivo = h;
                        document.querySelectorAll('.btn-hijo').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        renderHijoActivo();
                        dispararHijoCargado(h);
                        cargarTodosDatos();
                    };
                    selectorHijo.appendChild(btn);
                });
                document.getElementById('hijo-switch-wrap').style.display = 'flex';
            }

            // FIXED: disparar evento hijo-cargado para que las subpáginas lo reciban
            dispararHijoCargado(hijoActivo);
            await cargarTodosDatos();

        } catch (e) { console.error('Error cargarHijos:', e); }
    }

    function dispararHijoCargado(hijo) {
        window.dispatchEvent(new CustomEvent('hijo-cargado', { detail: hijo }));
    }

    function renderHijoActivo() {
        if (!hijoActivo) return;
        const nombres   = hijoActivo.nombres   || '';
        const apellidos = hijoActivo.apellidos  || '';
        const initials  = ((nombres[0] || '') + (apellidos[0] || '')).toUpperCase();
        const elAvatar  = document.getElementById('hijo-avatar');
        const elNombre  = document.getElementById('hijo-nombre');
        const elInfo    = document.getElementById('hijo-info');
        if (elAvatar) renderAvatarEnContenedor(elAvatar, hijoActivo, initials || '?');
        if (elNombre) elNombre.textContent = `${nombres} ${apellidos}`.trim();
        if (elInfo)   elInfo.textContent   = [hijoActivo.nivel, hijoActivo.grado ? hijoActivo.grado + '°' : '', hijoActivo.seccion].filter(Boolean).join(' · ');
    }

    // ── 4. Cargar todos los datos del hijo activo ──────────
    async function cargarTodosDatos() {
        if (!hijoActivo) return;
        await Promise.all([
            cargarCalificaciones(),
            cargarTareas(),
            cargarAsistencia(),
            cargarMensajesRecientes(),
            cargarNotificaciones()
        ]);
    }

    // ── 5. Calificaciones del hijo ─────────────────────────
    // FIXED: usa campo nota20 (no nota)
    async function cargarCalificaciones() {
        const container = document.getElementById('calificaciones-list');
        if (!container) return;
        try {
            const res  = await fetch(`/api/calificaciones/estudiante/${hijoActivo.id}`);
            const payload = res.ok ? await res.json() : {};
            const cals = Array.isArray(payload) ? payload : (payload.evaluaciones || []);

            if (cals.length > 0) {
                // FIXED: campo correcto es nota20
                const promedio = Number(payload.promedioGeneral ?? (cals.reduce((s, c) => s + Number(c.nota20 || c.nota || 0), 0) / cals.length)).toFixed(1);
                const elProm = document.getElementById('stat-promedio');
                if (elProm) elProm.textContent = promedio;
            }

            container.innerHTML = '';
            if (cals.length === 0) {
                container.innerHTML = '<p style="padding:16px; color:#94a3b8; text-align:center;">Sin calificaciones.</p>';
                return;
            }
            cals.slice(0, 6).forEach(c => {
                const nota  = Number(c.nota20 || c.nota || 0); // FIXED: nota20
                const grade = nota >= 17 ? 'a' : nota >= 14 ? 'b' : nota >= 11 ? 'c' : 'd';
                const curso = c.tarea?.curso?.nombre || c.curso?.nombre || 'Curso';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${curso}</td>
                    <td><span class="grade-badge grade-${grade}">${nota.toFixed(1)}</span></td>
                    <td style="color:var(--text-secondary); font-size:13px;">${c.tarea?.titulo || c.actividad || '—'}</td>
                `;
                container.appendChild(tr);
            });
        } catch (e) { console.error('Error calificaciones:', e); }
    }

    // ── 6. Tareas del hijo ─────────────────────────────────
    async function cargarTareas() {
        const container = document.getElementById('tareas-list');
        if (!container || !hijoActivo) return;
        try {
            if (!hijoActivo.nivel || !hijoActivo.grado || !hijoActivo.seccion) {
                container.innerHTML = '<p style="color:#94a3b8; padding:16px; text-align:center;">Sin sección asignada.</p>';
                return;
            }
            const res    = await fetch(`/api/tareas/estudiante/${hijoActivo.id}`);
            const payload = res.ok ? await res.json() : {};
            const tareasRaw = payload.tareas || [];
            const tareas = tareasRaw.filter(item => item.status !== 'Completada').map(item => item.tarea);

            const elTareas = document.getElementById('stat-tareas');
            if (elTareas) elTareas.textContent = tareas.length;

            container.innerHTML = '';
            if (tareas.length === 0) {
                container.innerHTML = '<p style="padding:16px; color:#94a3b8; text-align:center;">Sin tareas pendientes.</p>';
                return;
            }
            tareas.slice(0, 4).forEach(t => {
                const color  = t.curso?.color || 'blue';
                const icon   = t.curso?.icono || 'ph-clipboard-text';
                const priCol = t.prioridad === 'Alta' ? 'red' : t.prioridad === 'Media' ? 'yellow' : 'green';
                const div = document.createElement('div');
                div.className = 'panel-item';
                div.innerHTML = `
                    <div class="item-icon-box bg-${color}-light"><i class="ph-fill ${icon}"></i></div>
                    <div class="item-main">
                        <h4 class="item-title">${t.titulo}</h4>
                        <div class="item-subtitle"><i class="ph ph-calendar-blank"></i> ${t.fechaVencimiento || '—'} · ${t.curso?.nombre || ''}</div>
                    </div>
                    <span class="item-badge bg-${priCol}-light">${t.prioridad || 'Normal'}</span>
                `;
                container.appendChild(div);
            });
        } catch (e) { console.error('Error tareas:', e); }
    }

    // ── 7. Asistencia ──────────────────────────────────────
    // FIXED: usa /api/progreso/estudiante/{id} ya que /api/asistencia/estudiante/{id} no existe
    async function cargarAsistencia() {
        const container = document.getElementById('asistencia-list');
        if (!container || !hijoActivo) return;
        try {
            const res = await fetch(`/api/progreso/estudiante/${hijoActivo.id}`);
            if (!res.ok) {
                container.innerHTML = '<p style="color:#94a3b8; padding:10px;">Sin datos de asistencia.</p>';
                return;
            }
            const progreso = await res.json();
            const pct = progreso.asistenciaPorcentaje || 0;

            const elAsist = document.getElementById('stat-asistencia');
            if (elAsist) elAsist.textContent = pct + '%';

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:14px; font-weight:600;">Asistencia general</span>
                    <span style="font-size:22px; font-weight:700; color:var(--primary);">${pct}%</span>
                </div>
                <div class="asist-bar-wrap">
                    <div class="asist-bar-fill" style="width:${pct}%;"></div>
                </div>
                <div style="display:flex; gap:16px; margin-top:16px; font-size:13px;">
                    <span style="color:var(--green); font-weight:600;"><i class="ph ph-check-circle"></i> ${pct >= 90 ? 'Excelente' : pct >= 75 ? 'Buena' : 'Mejorar'} asistencia</span>
                    <span style="color:var(--text-secondary);">Racha: ${progreso.rachaDias || 0} días</span>
                </div>
            `;
        } catch (e) {
            if (container) container.innerHTML = '<p style="color:#94a3b8; padding:10px;">Sin datos de asistencia.</p>';
        }
    }

    // ── 8. Mensajes recientes ──────────────────────────────
    async function cargarMensajesRecientes() {
        const container = document.getElementById('mensajes-list');
        if (!container) return;
        try {
            const res = await fetch(`/api/mensajes/recientes/${padre.id}`);
            const contactos = res.ok ? await res.json() : [];
            container.innerHTML = '';
            if (contactos.length === 0) {
                container.innerHTML = '<p style="padding:16px; color:#94a3b8; text-align:center;">Sin mensajes recientes.</p>';
                return;
            }
            for (const c of contactos.slice(0, 3)) {
                const resMsg = await fetch(`/api/mensajes/conversacion?u1=${padre.id}&u2=${c.id}`);
                const msgs   = resMsg.ok ? await resMsg.json() : [];
                const ultimo = msgs[msgs.length - 1];
                const initials = ((c.nombres || '?')[0] + (c.apellidos || '?')[0]).toUpperCase();
                const div = document.createElement('div');
                div.className = 'message-card';
                div.onclick   = () => window.location.href = `mensajes.html?chatId=${c.id}`;
                div.innerHTML = `
                    <div class="msg-avatar">${avatarPersona(c, initials)}</div>
                    <div class="msg-body">
                        <div class="msg-header">
                            <span class="msg-author">${(c.rol === 'DOCENTE' ? 'Prof. ' : '') + c.nombres + ' ' + c.apellidos}</span>
                            <span class="msg-role">${c.rol === 'DOCENTE' ? 'Docente' : c.rol}</span>
                        </div>
                        <p class="msg-snippet">${ultimo ? ultimo.contenido : 'Sin mensajes'}</p>
                    </div>
                    <div class="msg-meta">
                        <span class="msg-time">${ultimo ? new Date(ultimo.fechaEnvio).toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                `;
                container.appendChild(div);
            }

            // Actualizar stat de mensajes sin leer
            const noLeidos = contactos.filter(c => c.noLeidos > 0).length;
            const elMsg = document.getElementById('stat-mensajes');
            if (elMsg) elMsg.textContent = noLeidos;

        } catch (e) { console.error('Error mensajes:', e); }
    }

    // ── 9. Notificaciones ──────────────────────────────────
    async function cargarNotificaciones() {
        try {
            const res = await fetch(`/api/notificaciones/usuario/${padre.id}`);
            if (!res.ok) return;
            const nots     = await res.json();
            const noLeidas = nots.filter(n => !n.leida).length;
            const badge    = document.querySelector('.notification-btn .badge');
            if (badge) {
                badge.textContent   = noLeidas > 9 ? '9+' : noLeidas;
                badge.style.display = noLeidas > 0 ? 'block' : 'none';
            }

            // Render list
            const notifList = document.getElementById('notif-list');
            if (notifList) {
                notifList.innerHTML = '';
                if (nots.length === 0) {
                    notifList.innerHTML = `
                        <div class="empty-state" style="padding:30px">
                            <i class="ph ph-bell-slash"></i>
                            <h3>Sin notificaciones</h3>
                        </div>`;
                } else {
                    nots.slice(0, 15).forEach(n => {
                        let icon = 'ph-bell';
                        let colorClass = 'bg-blue-light text-blue';
                        
                        // Sistema Experto: Parsed from title
                        let titulo = n.titulo;
                        if (titulo.includes('[CRITICO]')) {
                            icon = 'ph-warning-circle';
                            colorClass = 'bg-red-light text-red';
                            titulo = titulo.replace('[CRITICO]', '').trim();
                        } else if (titulo.includes('[ALERTA]')) {
                            icon = 'ph-info';
                            colorClass = 'bg-yellow-light text-yellow';
                            titulo = titulo.replace('[ALERTA]', '').trim();
                        }

                        const opacity = n.leida ? '0.6' : '1';
                        const dot = n.leida ? '' : '<div style="width:8px; height:8px; background:var(--primary); border-radius:50%;"></div>';

                        const div = document.createElement('div');
                        div.className = 'notif-item';
                        div.style.opacity = opacity;
                        div.innerHTML = `
                            <div style="width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;" class="${colorClass}">
                                <i class="ph-fill ${icon}" style="font-size:20px;"></i>
                            </div>
                            <div style="flex:1;">
                                <h4 style="font-size:13px; margin:0 0 4px; color:var(--text-primary); display:flex; justify-content:space-between; align-items:center;">
                                    ${titulo}
                                    ${dot}
                                </h4>
                                <p style="font-size:12px; margin:0; color:var(--text-secondary); line-height:1.4;">${n.mensaje}</p>
                                <small style="font-size:10px; color:var(--text-tertiary); margin-top:4px; display:block;">
                                    ${new Date(n.fecha).toLocaleString('es-PE')}
                                </small>
                            </div>
                        `;
                        div.onclick = async () => {
                            if (!n.leida) {
                                await fetch(`/api/notificaciones/${n.id}/leer`, { method: 'PUT' });
                                cargarNotificaciones();
                            }
                        };
                        notifList.appendChild(div);
                    });
                }
            }
        } catch (e) { console.error('Error notificaciones:', e); }
    }

    // ── 10. Logout ─────────────────────────────────────────
    // FIXED: eliminar la clave correcta 'shidell_user'
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            localStorage.removeItem('shidell_user');
            localStorage.removeItem('shidell_admin');
            window.location.href = '/login.html';
        };
    }

    // ── Arrancar ───────────────────────────────────────────
    cargarHijos();
    setInterval(cargarNotificaciones, 30000);
});

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function esFotoValida(src) {
    return typeof src === 'string' && /^(data:image\/|\/uploads\/|https?:\/\/)/i.test(src.trim());
}

function primeraFotoValida(...fotos) {
    return fotos.find(esFotoValida) || '';
}

function avatarPersona(persona, fallbackIniciales = '') {
    const foto = primeraFotoValida(persona?.fotoPerfil, persona?.foto_perfil);
    if (foto) return `<img src="${escapeHtml(foto)}" alt="Foto de perfil">`;
    const iniciales = fallbackIniciales || (((persona?.nombres || '?')[0] || '?') + ((persona?.apellidos || '?')[0] || '?')).toUpperCase();
    return escapeHtml(iniciales);
}

function renderAvatarEnContenedor(contenedor, persona, fallbackIniciales = '') {
    if (!contenedor) return;
    contenedor.innerHTML = avatarPersona(persona, fallbackIniciales);
}

function renderAvatarPadre(padre) {
    const iniciales = (((padre?.nombres || '?')[0] || '?') + ((padre?.apellidos || '?')[0] || '?')).toUpperCase();
    document.querySelectorAll('.top-user-info .avatar').forEach(avatar => {
        renderAvatarEnContenedor(avatar, padre, iniciales);
    });
}

async function refrescarPadreDesdeBackend(padre) {
    if (!padre?.id) return;
    try {
        const res = await fetch(`/api/users/${padre.id}`);
        if (!res.ok) return;
        const fresh = await res.json();
        if (!fresh || fresh.rol !== 'PADRE') return;
        const actualizado = { ...padre, ...fresh, sessionToken: padre.sessionToken };
        localStorage.setItem('shidell_user', JSON.stringify(actualizado));
        window._padreActual = actualizado;
        document.querySelectorAll('.padre-nombre').forEach(el => {
            el.textContent = `${actualizado.nombres || ''} ${actualizado.apellidos || ''}`.trim();
        });
        renderAvatarPadre(actualizado);
    } catch (e) {
        console.warn('No se pudo refrescar el perfil del padre:', e);
    }
}
