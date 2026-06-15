(function () {
    let usuario = null;
    let vistaActual = 'perfil';
    let fotoPerfilTemporal = '';
    let notificacionesEstado = {};
    let configExtra = {};

    document.addEventListener('DOMContentLoaded', iniciar);

    async function iniciar() {
        usuario = await window.shidellSession?.obtenerUsuario();
        conectarEventosBase();

        if (!usuario) {
            renderSinSesion();
            return;
        }

        await refrescarUsuario();
        renderVista('perfil');
    }

    function conectarEventosBase() {
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => renderVista(tab.dataset.view));
        });

        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => cerrarModal(btn.dataset.close));
        });

        document.querySelectorAll('.settings-modal').forEach(modal => {
            modal.addEventListener('click', event => {
                if (event.target === modal) cerrarModal(modal.id);
            });
        });

        document.getElementById('form-perfil')?.addEventListener('submit', guardarPerfil);
        document.getElementById('form-password')?.addEventListener('submit', guardarPassword);
        document.getElementById('cfg-foto')?.addEventListener('change', cambiarFotoPerfil);
        document.getElementById('btn-quitar-foto')?.addEventListener('click', quitarFotoPerfil);
        configurarMenuCuenta();
    }

    function configurarMenuCuenta() {
        const menu = document.querySelector('.top-user-info');
        const toggle = menu?.querySelector('.user-action');
        if (!menu || !toggle) return;

        toggle.classList.add('account-menu-toggle');
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('aria-haspopup', 'true');
        toggle.setAttribute('aria-expanded', 'false');

        toggle.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const abierto = menu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(abierto));
        });

        document.getElementById('account-ver-perfil')?.addEventListener('click', event => {
            event.preventDefault();
            menu.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
            renderVista('perfil');
        });

        document.getElementById('account-cerrar-sesion')?.addEventListener('click', event => {
            event.preventDefault();
            cerrarSesion();
        });

        document.addEventListener('click', () => {
            menu.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        });

        menu.querySelector('.account-dropdown')?.addEventListener('click', event => event.stopPropagation());
    }

    async function refrescarUsuario() {
        try {
            const res = await fetch(`/api/users/${usuario.id}`);
            if (!res.ok) return;
            const fotoActual = obtenerFotoPerfilLocal();
            usuario = await res.json();
            if (fotoActual) usuario.fotoPerfil = fotoActual;
            actualizarAvatares();
        } catch (error) {
            console.error('No se pudo cargar usuario:', error);
        }
    }

    function renderVista(view) {
        if (!usuario) {
            renderSinSesion();
            return;
        }

        vistaActual = view || 'perfil';
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === vistaActual);
        });

        const vistas = {
            perfil: renderPerfil,
            notificaciones: renderNotificaciones,
            seguridad: renderSeguridad,
            cuenta: renderCuenta
        };

        const viewEl = document.getElementById('settings-view');
        viewEl.innerHTML = (vistas[vistaActual] || renderPerfil)();
        conectarEventosVista();
    }

    function conectarEventosVista() {
        document.getElementById('btn-editar-perfil')?.addEventListener('click', abrirPerfil);

        document.querySelectorAll('[data-notif]').forEach(row => {
            const key = row.dataset.notif;
            const toggle = row.querySelector('.toggle-switch');
            toggle?.addEventListener('click', () => {
                const estado = estadoNotificaciones();
                estado[key] = !estado[key];
                notificacionesEstado = estado;
                renderVista('notificaciones');
                toast(estado[key] ? 'Notificacion activada.' : 'Notificacion desactivada.');
            });
        });

        document.getElementById('btn-ver-notificaciones')?.addEventListener('click', () => {
            document.querySelector('.notification-btn')?.click();
        });
        document.getElementById('btn-cambiar-password')?.addEventListener('click', () => abrirModal('modal-password'));
        document.getElementById('btn-sesiones')?.addEventListener('click', mostrarSesion);
        document.getElementById('btn-2fa')?.addEventListener('click', alternarDosPasos);
        document.getElementById('btn-info-cuenta')?.addEventListener('click', () => toast(`ID ${usuario.id} - ${usuario.rol || 'ESTUDIANTE'}`));
        document.getElementById('btn-descargar-datos')?.addEventListener('click', generarReportePdf);
        document.getElementById('btn-cerrar-sesion')?.addEventListener('click', cerrarSesion);
    }

    function renderPerfil() {
        const extra = configExtra;
        const nombre = nombreCompleto();
        const iniciales = `${(usuario.nombres || 'E')[0] || 'E'}${(usuario.apellidos || 'S')[0] || 'S'}`.toUpperCase();
        const grupo = [usuario.nivel, usuario.grado ? `${usuario.grado} grado` : '', usuario.seccion ? `Seccion ${usuario.seccion}` : ''].filter(Boolean).join(' - ') || 'Sin grupo asignado';
        const fotoPerfil = obtenerFotoPerfilLocal();

        document.querySelectorAll('.user-name').forEach(el => el.textContent = nombre);
        actualizarAvatares();

        return `
            <div class="settings-section">
                <div class="settings-header">
                    <div><span class="settings-kicker">Mi perfil</span><h2>Datos del estudiante</h2></div>
                    <div class="settings-header-actions">
                        <button class="btn-secondary-settings" id="btn-descargar-datos"><i class="ph ph-download-simple"></i> Reporte PDF</button>
                        <button class="btn-primary-settings" id="btn-editar-perfil"><i class="ph ph-pencil-simple"></i> Editar perfil</button>
                    </div>
                </div>
                <div class="profile-summary">
                    ${fotoPerfil ? `<img class="profile-photo" src="${escapeHtml(fotoPerfil)}" alt="Foto de perfil">` : `<div class="profile-initials">${escapeHtml(iniciales)}</div>`}
                    <div>
                        <h3>${escapeHtml(nombre)}</h3>
                        <p>${escapeHtml(usuario.email || 'Sin correo')}</p>
                        <div class="pill-row">
                            <span class="pill">${escapeHtml(usuario.rol || 'ESTUDIANTE')}</span>
                            <span class="pill">${escapeHtml(grupo)}</span>
                            <span class="pill">${escapeHtml(usuario.turno || 'Sin turno')}</span>
                        </div>
                    </div>
                </div>
                <div class="info-grid">
                    ${info('Nivel', usuario.nivel || 'Sin asignar')}
                    ${info('Grado', usuario.grado ? `${usuario.grado} grado` : 'Sin asignar')}
                    ${info('Seccion', usuario.seccion || 'Sin asignar')}
                    ${info('Fecha de nacimiento', extra.fechaNacimiento ? fechaLarga(extra.fechaNacimiento) : 'No registrado')}
                    ${info('Institucion', 'Shidell')}
                    ${info('Estado', usuario.ultimaConexion ? 'Activo recientemente' : 'Activo')}
                </div>
            </div>`;
    }

    function renderNotificaciones() {
        const estado = estadoNotificaciones();
        const rows = [
            ['tareas', 'ph-calendar-check', 'Tareas y actividades', 'Entregas, vencimientos y actividades nuevas.'],
            ['clases', 'ph-alarm', 'Recordatorios de clases', 'Avisos antes de iniciar una clase.'],
            ['mensajes', 'ph-chat-circle-dots', 'Mensajes', 'Mensajes nuevos de docentes y companeros.'],
            ['anuncios', 'ph-megaphone', 'Anuncios importantes', 'Comunicados generales.'],
            ['calificaciones', 'ph-star', 'Calificaciones', 'Notas nuevas o cambios publicados.']
        ];

        return `
            <div class="settings-section">
                <div class="settings-header">
                    <div><span class="settings-kicker">Notificaciones</span><h2>Alertas del portal</h2></div>
                    <button class="btn-secondary-settings" id="btn-ver-notificaciones"><i class="ph ph-bell-ringing"></i> Abrir panel</button>
                </div>
                <div class="toggle-list">
                    ${rows.map(([key, icon, title, desc]) => `
                        <div class="toggle-row" data-notif="${key}">
                            <div><i class="ph ${icon}"></i><strong>${title}</strong><span>${desc}</span></div>
                            <button type="button" class="toggle-switch${estado[key] ? '' : ' off'}"></button>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    function renderSeguridad() {
        const extra = configExtra;
        const estado = extra.dosPasos === false ? 'Desactivado' : 'Activado';
        return `
            <div class="settings-section">
                <div class="settings-header">
                    <div><span class="settings-kicker">Seguridad</span><h2>Protege tu cuenta</h2></div>
                </div>
                <div class="action-list">
                    <button class="action-row" id="btn-cambiar-password"><i class="ph ph-lock-key"></i><span><strong>Cambiar contrasena</strong><small>Actualiza tu clave cuando lo necesites.</small></span><i class="ph ph-caret-right"></i></button>
                    <button class="action-row" id="btn-sesiones"><i class="ph ph-monitor"></i><span><strong>Ver sesiones activas</strong><small>Consulta la ultima conexion registrada.</small></span><i class="ph ph-caret-right"></i></button>
                    <button class="action-row" id="btn-2fa"><i class="ph ph-shield-check"></i><span><strong>Autenticacion en dos pasos</strong><small>Control local de seguridad adicional.</small></span><span class="status-pill">${estado}</span></button>
                </div>
            </div>`;
    }

    function renderCuenta() {
        return `
            <div class="settings-section">
                <div class="settings-header">
                    <div><span class="settings-kicker">Cuenta</span><h2>Opciones de cuenta</h2></div>
                </div>
                <div class="account-grid">
                    <button class="account-card" id="btn-info-cuenta"><i class="ph ph-identification-card"></i><strong>Informacion de la cuenta</strong><span>Ver ID, rol y datos basicos.</span></button>
                    <button class="account-card" id="btn-descargar-datos"><i class="ph ph-download-simple"></i><strong>Reporte PDF del estudiante</strong><span>Genera un PDF con tu resumen academico.</span></button>
                    <a class="account-card" href="mensajes.html"><i class="ph ph-lifebuoy"></i><strong>Centro de ayuda</strong><span>Contacta a tus docentes desde mensajes.</span></a>
                    <button class="account-card danger" id="btn-cerrar-sesion"><i class="ph ph-sign-out"></i><strong>Cerrar sesion</strong><span>Salir de tu cuenta.</span></button>
                </div>
            </div>`;
    }

    function renderSinSesion() {
        document.getElementById('settings-view').innerHTML = `
            <div class="settings-empty">
                <i class="ph ph-warning-circle"></i>
                <strong>No hay sesion activa</strong>
                <span>Inicia sesion para ver tu configuracion.</span>
                <a class="btn-primary-settings" href="../login.html">Ir al login</a>
            </div>`;
    }

    function info(label, value) {
        return `<div class="info-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    }

    function estadoNotificaciones() {
        return {
            tareas: true,
            clases: true,
            mensajes: true,
            anuncios: true,
            calificaciones: true,
            ...notificacionesEstado
        };
    }

    function abrirPerfil() {
        const extra = configExtra;
        setValue('cfg-nombres', usuario.nombres || '');
        setValue('cfg-apellidos', usuario.apellidos || '');
        setValue('cfg-email', usuario.email || '');
        setValue('cfg-nivel', usuario.nivel || '');
        setValue('cfg-grado', usuario.grado || '');
        setValue('cfg-seccion', usuario.seccion || '');
        setValue('cfg-turno', usuario.turno || '');
        setValue('cfg-nacimiento', extra.fechaNacimiento || '');
        fotoPerfilTemporal = obtenerFotoPerfilLocal();
        actualizarPreviewFoto(fotoPerfilTemporal);
        abrirModal('modal-perfil');
    }

    async function cambiarFotoPerfil(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            fotoPerfilTemporal = await procesarFotoPerfil(file);
            guardarFotoPerfilLocal(fotoPerfilTemporal);
            await guardarFotoPerfilBackend(fotoPerfilTemporal);
            actualizarPreviewFoto(fotoPerfilTemporal);
            actualizarAvatares();
            actualizarFotoResumen();
            toast('Foto de perfil actualizada.');
        } catch (error) {
            event.target.value = '';
            toast(error.message || 'No se pudo cargar la foto.', true);
        }
    }

    function quitarFotoPerfil() {
        fotoPerfilTemporal = '';
        const input = document.getElementById('cfg-foto');
        if (input) input.value = '';
        guardarFotoPerfilLocal('');
        guardarFotoPerfilBackend('');
        actualizarPreviewFoto('');
        actualizarAvatares();
        actualizarFotoResumen();
        toast('Foto quitada.');
    }

    async function guardarPerfil(event) {
        event.preventDefault();
        const payload = {
            nombres: getValue('cfg-nombres'),
            apellidos: getValue('cfg-apellidos'),
            email: getValue('cfg-email'),
            nivel: getValue('cfg-nivel') || null,
            grado: getValue('cfg-grado') || null,
            seccion: getValue('cfg-seccion') || null,
            turno: getValue('cfg-turno') || null
        };

        try {
            const res = await fetch(`/api/users/${usuario.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('No se pudo guardar');
            usuario = await res.json();

            const extra = configExtra;
            extra.fechaNacimiento = getValue('cfg-nacimiento');
            extra.fotoPerfil = fotoPerfilTemporal;
            configExtra = extra;

            cerrarModal('modal-perfil');
            actualizarAvatares();
            renderVista(vistaActual);
            toast('Perfil actualizado.');
        } catch (error) {
            toast('No se pudo guardar el perfil.', true);
        }
    }

    async function guardarPassword(event) {
        event.preventDefault();
        const password = getValue('cfg-password');
        const confirm = getValue('cfg-password-confirm');
        if (password !== confirm) {
            toast('Las contrasenas no coinciden.', true);
            return;
        }

        try {
            const res = await fetch(`/api/users/${usuario.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (!res.ok) throw new Error('No se pudo actualizar');
            usuario = await res.json();
            document.getElementById('form-password').reset();
            cerrarModal('modal-password');
            toast('Contrasena actualizada.');
        } catch (error) {
            toast('No se pudo actualizar la contrasena.', true);
        }
    }

    function mostrarSesion() {
        const fecha = usuario.ultimaConexion ? new Date(usuario.ultimaConexion).toLocaleString() : 'Sesion actual';
        toast(`Ultima conexion: ${fecha}`);
    }

    function alternarDosPasos() {
        const extra = configExtra;
        extra.dosPasos = !(extra.dosPasos !== false);
        configExtra = extra;
        renderVista('seguridad');
        toast(extra.dosPasos ? 'Autenticacion activada.' : 'Autenticacion desactivada.');
    }

    function cargarJsPdf() {
        if (window.jspdf?.jsPDF) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existente = document.querySelector('script[data-jspdf]');
            if (existente) {
                existente.addEventListener('load', resolve, { once: true });
                existente.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = '/vendor/jspdf.umd.min.js';
            script.dataset.jspdf = 'true';
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
            document.head.appendChild(script);
        });
    }

    async function generarReportePdf() {
        const botones = Array.from(document.querySelectorAll('#btn-descargar-datos'));
        const originales = botones.map(boton => boton.innerHTML);
        botones.forEach(boton => {
            boton.disabled = true;
            boton.innerHTML = boton.classList.contains('account-card')
                ? '<i class="ph ph-circle-notch"></i><strong>Preparando PDF</strong><span>Generando reporte profesional...</span>'
                : '<i class="ph ph-circle-notch"></i> Generando PDF';
        });

        try {
            const [progresoRes, calificacionesRes, tareasRes, asistenciaRes] = await Promise.all([
                fetch(`/api/progreso/estudiante/${usuario.id}`).catch(() => null),
                fetch(`/api/calificaciones/estudiante/${usuario.id}`).catch(() => null),
                fetch(`/api/tareas/estudiante/${usuario.id}`).catch(() => null),
                fetch(`/api/asistencia/estudiante/${usuario.id}`).catch(() => null)
            ]);

            const progreso = progresoRes?.ok ? await progresoRes.json() : {};
            const calificaciones = calificacionesRes?.ok ? await calificacionesRes.json() : {};
            const tareas = tareasRes?.ok ? await tareasRes.json() : {};
            const asistencia = asistenciaRes?.ok ? await asistenciaRes.json() : [];

            await descargarReportePdfProfesional({ progreso, calificaciones, tareas, asistencia });
            toast('Reporte PDF descargado.');
        } catch (error) {
            console.error(error);
            toast(error.message || 'No se pudo generar el reporte.', true);
        } finally {
            botones.forEach((boton, index) => {
                boton.disabled = false;
                boton.innerHTML = originales[index];
            });
        }
    }

    async function descargarReportePdfProfesional({ progreso = {}, calificaciones = {}, tareas = {}, asistencia = [] }) {
        await cargarJsPdf();
        const jsPDF = window.jspdf?.jsPDF;
        if (!jsPDF) throw new Error('No se pudo cargar el generador de PDF.');

        const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 16;
        const contentWidth = pageWidth - margin * 2;
        const colors = {
            primary: [37, 99, 235],
            primaryDark: [30, 64, 175],
            ink: [15, 23, 42],
            muted: [100, 116, 139],
            line: [226, 232, 240],
            soft: [239, 246, 255],
            green: [22, 163, 74],
            amber: [217, 119, 6],
            red: [220, 38, 38]
        };
        let y = 18;

        const estudianteApi = progreso.estudiante || calificaciones.estudiante || tareas.estudiante || {};
        const estudiante = { ...usuario, ...estudianteApi };
        const nombre = limpiarTexto([estudiante.nombres, estudiante.apellidos].filter(Boolean).join(' ')).trim() || nombreCompleto();
        const grupo = [
            estudiante.nivel || usuario.nivel,
            estudiante.grado || usuario.grado ? `${estudiante.grado || usuario.grado} grado` : '',
            estudiante.seccion || usuario.seccion ? `Seccion ${estudiante.seccion || usuario.seccion}` : '',
            estudiante.turno || usuario.turno || ''
        ].filter(Boolean).join(' - ') || 'Sin grupo asignado';

        const evaluaciones = normalizarLista(calificaciones.evaluaciones);
        const cursos = normalizarLista(calificaciones.cursos).length
            ? normalizarLista(calificaciones.cursos)
            : normalizarLista(progreso.progresoPorCurso);
        const tareasLista = normalizarLista(tareas.tareas).length ? normalizarLista(tareas.tareas) : normalizarLista(tareas);
        const asistenciaLista = normalizarLista(asistencia);
        const resumenTareas = tareas.resumen || {};
        const promedio = numero(progreso.promedioGeneral, calificaciones.promedioGeneral, promedioNotas(evaluaciones));
        const asistenciaPct = numero(progreso.asistenciaPorcentaje, calcularAsistencia(asistenciaLista), 0);
        const completadas = numero(progreso.tareasCompletadas, resumenTareas.completadas, tareasLista.filter(t => /complet|entreg/i.test(String(t.estado || t.status || ''))).length);
        const totalTareas = numero(progreso.tareasTotales, resumenTareas.total, tareasLista.length);
        const cursosActivos = numero(progreso.cursosActivos, progreso.cursosTotales, cursos.length);
        const fechaEmision = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: '2-digit' });

        portada();
        resumenEjecutivo();
        detalleCursos();
        detalleCalificaciones();
        detalleTareas();
        detalleAsistencia();
        observacion();
        piePaginas();
        descargarBlob();

        function portada() {
            doc.setFillColor(...colors.primary);
            doc.rect(0, 0, pageWidth, 62, 'F');
            doc.setFillColor(...colors.primaryDark);
            doc.rect(0, 52, pageWidth, 10, 'F');

            doc.setFillColor(255, 255, 255);
            doc.roundedRect(margin, 18, 14, 14, 3, 3, 'F');
            text('S', margin + 4.6, 27.8, { size: 12, bold: true, color: colors.primary });
            text('SHIDELL', margin + 20, 24, { size: 10, bold: true, color: [255, 255, 255] });
            text('Reporte academico integral', margin + 20, 36, { size: 22, bold: true, color: [255, 255, 255] });
            text('Documento generado desde el Portal Estudiante', margin + 20, 45, { size: 10, color: [219, 234, 254] });

            y = 78;
            text(nombre, margin, y, { size: 24, bold: true });
            text(estudiante.email || 'Sin correo registrado', margin, y + 8, { color: colors.muted });
            text(grupo, margin, y + 15, { color: colors.muted });

            doc.setDrawColor(...colors.line);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(margin, y + 27, contentWidth, 34, 5, 5, 'FD');
            text('Fecha de emision', margin + 6, y + 39, { size: 8, bold: true, color: colors.muted });
            text(fechaEmision, margin + 6, y + 49, { size: 13, bold: true });
            text('Codigo de estudiante', pageWidth - margin - 6, y + 39, { size: 8, bold: true, color: colors.muted, align: 'right' });
            text(String(estudiante.id || usuario.id || '-'), pageWidth - margin - 6, y + 49, { size: 13, bold: true, align: 'right' });

            y += 76;
            metricCards([
                ['Promedio general', `${promedio.toFixed(1)}/20`, estadoPromedio(promedio)],
                ['Asistencia', `${Math.round(asistenciaPct)}%`, estadoAsistencia(asistenciaPct)],
                ['Tareas', `${completadas}/${totalTareas}`, totalTareas ? `${Math.round((completadas / totalTareas) * 100)}% completado` : 'Sin tareas'],
                ['Cursos activos', String(cursosActivos), 'Periodo vigente']
            ]);
        }

        function resumenEjecutivo() {
            section('Resumen ejecutivo');
            const mensaje = progreso.mensajeMotivacional || {};
            paragraph(limpiarTexto(mensaje.texto || construirComentario()), margin, contentWidth, { size: 10, color: colors.ink });
            y += 2;
            tabla([
                ['Campo', 'Detalle'],
                ['Nivel', estudiante.nivel || 'Sin asignar'],
                ['Grado y seccion', [estudiante.grado ? `${estudiante.grado} grado` : '', estudiante.seccion ? `Seccion ${estudiante.seccion}` : ''].filter(Boolean).join(' - ') || 'Sin asignar'],
                ['Turno', estudiante.turno || 'Sin asignar'],
                ['Fecha de nacimiento', configExtra.fechaNacimiento ? fechaLarga(configExtra.fechaNacimiento) : 'No registrada']
            ], [42, contentWidth - 42]);
        }

        function detalleCursos() {
            section('Avance por cursos');
            if (!cursos.length) {
                empty('No hay cursos registrados para mostrar.');
                return;
            }
            cursos.slice(0, 10).forEach(curso => {
                ensure(18);
                const nombreCurso = limpiarTexto(curso.nombre || 'Curso');
                const valor = clamp(numero(curso.porcentaje, curso.progresoClases, curso.promedio ? Number(curso.promedio) * 5 : 0), 0, 100);
                text(nombreCurso, margin, y, { size: 10, bold: true });
                text(limpiarTexto(curso.profesor || curso.estado || 'Curso activo'), margin, y + 5.5, { size: 8.5, color: colors.muted });
                progressBar(margin + 82, y - 2, 78, valor, colors.primary);
                text(`${Math.round(valor)}%`, pageWidth - margin, y + 1, { size: 9, bold: true, align: 'right' });
                y += 15;
            });
        }

        function detalleCalificaciones() {
            section('Calificaciones recientes');
            const rows = evaluaciones.slice(0, 12).map(ev => [
                limpiarTexto(ev.curso?.nombre || ev.cursoNombre || 'Curso'),
                limpiarTexto(ev.actividad || 'Evaluacion'),
                String(ev.nota20 ?? ev.nota ?? '-'),
                ev.fecha || '-',
                limpiarTexto(ev.estado || evaluarNota(Number(ev.nota20 ?? ev.nota)))
            ]);
            tabla([['Curso', 'Actividad', 'Nota', 'Fecha', 'Estado'], ...rows], [42, 55, 18, 28, contentWidth - 143], 'No hay calificaciones registradas.');
        }

        function detalleTareas() {
            section('Tareas y entregas');
            const rows = tareasLista.slice(0, 12).map(tarea => [
                limpiarTexto(tarea.titulo || tarea.nombre || 'Tarea'),
                limpiarTexto(tarea.curso?.nombre || tarea.cursoNombre || 'Curso'),
                tarea.fechaVencimiento || tarea.fecha || '-',
                limpiarTexto(tarea.status || tarea.estado || 'Pendiente')
            ]);
            tabla([['Tarea', 'Curso', 'Vencimiento', 'Estado'], ...rows], [58, 46, 34, contentWidth - 138], 'No hay tareas registradas.');
        }

        function detalleAsistencia() {
            section('Asistencia');
            const total = asistenciaLista.length;
            const presentes = asistenciaLista.filter(a => /presente|tarde|justificado/i.test(String(a.estado || ''))).length;
            const ausentes = total ? total - presentes : 0;
            metricCards([
                ['Registros', String(total), 'Asistencias tomadas'],
                ['Presentes', String(presentes), 'Incluye tardanzas justificadas'],
                ['Ausencias', String(ausentes), 'Requieren seguimiento'],
                ['Porcentaje', `${Math.round(asistenciaPct)}%`, estadoAsistencia(asistenciaPct)]
            ], 20);
        }

        function observacion() {
            section('Recomendacion');
            doc.setFillColor(...colors.soft);
            doc.setDrawColor(191, 219, 254);
            doc.roundedRect(margin, y, contentWidth, 34, 4, 4, 'FD');
            y += 9;
            text(tituloRecomendacion(), margin + 5, y, { size: 11, bold: true, color: colors.primaryDark });
            y += 7;
            paragraph(construirComentario(), margin + 5, contentWidth - 10, { size: 9, color: colors.primaryDark });
        }

        function metricCards(items, height = 24) {
            ensure(height + 6);
            const gap = 3;
            const width = (contentWidth - gap * (items.length - 1)) / items.length;
            items.forEach(([label, value, hint], index) => {
                const x = margin + index * (width + gap);
                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(...colors.line);
                doc.roundedRect(x, y, width, height, 3, 3, 'FD');
                text(label, x + 4, y + 7, { size: 7, bold: true, color: colors.muted });
                text(value, x + 4, y + 16, { size: 13, bold: true });
                if (hint) text(hint, x + 4, y + height - 4, { size: 6.5, color: colors.muted });
            });
            y += height + 10;
        }

        function tabla(rows, widths, emptyMessage = '') {
            if (rows.length <= 1 && emptyMessage) {
                empty(emptyMessage);
                return;
            }
            ensure(14);
            const header = rows[0];
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(...colors.line);
            doc.rect(margin, y, contentWidth, 8, 'FD');
            let x = margin;
            header.forEach((cell, index) => {
                text(cell, x + 2, y + 5.4, { size: 7.5, bold: true, color: colors.muted });
                x += widths[index];
            });
            y += 8;
            rows.slice(1).forEach(row => {
                const lineSets = row.map((cell, index) => doc.splitTextToSize(String(cell ?? '-'), widths[index] - 4).slice(0, 2));
                const rowHeight = Math.max(10, Math.max(...lineSets.map(lines => lines.length)) * 4.2 + 4);
                ensure(rowHeight + 2);
                doc.setDrawColor(...colors.line);
                doc.line(margin, y, pageWidth - margin, y);
                x = margin;
                lineSets.forEach((lines, index) => {
                    text(lines, x + 2, y + 5, { size: 7.8 });
                    x += widths[index];
                });
                y += rowHeight;
            });
            y += 4;
        }

        function section(title) {
            ensure(22);
            y += 5;
            text(title, margin, y, { size: 13, bold: true });
            y += 5;
            doc.setDrawColor(...colors.line);
            doc.line(margin, y, pageWidth - margin, y);
            y += 7;
        }

        function paragraph(value, x, width, options = {}) {
            const lines = doc.splitTextToSize(String(value || ''), width);
            text(lines, x, y, options);
            y += lines.length * 4.8 + 3;
        }

        function empty(message) {
            ensure(12);
            text(message, margin, y, { color: colors.muted });
            y += 10;
        }

        function ensure(height) {
            if (y + height <= pageHeight - 18) return;
            doc.addPage();
            y = 18;
        }

        function progressBar(x, yy, width, value, rgb) {
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(x, yy, width, 4, 2, 2, 'F');
            if (value > 0) {
                doc.setFillColor(...rgb);
                doc.roundedRect(x, yy, Math.max(1, width * value / 100), 4, 2, 2, 'F');
            }
        }

        function text(value, x, yy, options = {}) {
            doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
            doc.setFontSize(options.size || 9);
            doc.setTextColor(...(options.color || colors.ink));
            doc.text(value, x, yy, options);
        }

        function piePaginas() {
            const pages = doc.getNumberOfPages();
            for (let page = 1; page <= pages; page++) {
                doc.setPage(page);
                doc.setDrawColor(...colors.line);
                doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
                text('Shidell Portal Estudiante', margin, pageHeight - 9, { size: 7.5, color: colors.muted });
                text(`Pagina ${page} de ${pages}`, pageWidth - margin, pageHeight - 9, { size: 7.5, color: colors.muted, align: 'right' });
            }
        }

        function descargarBlob() {
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `reporte-academico-${slug(nombre)}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function construirComentario() {
            if (promedio >= 16 && asistenciaPct >= 90) return 'El estudiante mantiene un rendimiento destacado y una asistencia consistente. Se recomienda continuar con el mismo ritmo y asumir actividades de mayor desafio.';
            if (promedio >= 13) return 'El estudiante presenta un avance favorable. Conviene reforzar las areas con notas menores y sostener la entrega puntual de tareas.';
            if (evaluaciones.length) return 'El estudiante necesita seguimiento academico. Se recomienda revisar calificaciones bajas, completar pendientes y coordinar apoyo con los docentes.';
            return 'Aun no hay suficiente evidencia academica registrada. Este reporte se actualizara conforme se publiquen notas, tareas y asistencias.';
        }

        function tituloRecomendacion() {
            if (promedio >= 16) return 'Rendimiento sobresaliente';
            if (promedio >= 13) return 'Buen avance academico';
            if (evaluaciones.length) return 'Plan de refuerzo recomendado';
            return 'Seguimiento inicial';
        }

        function normalizarLista(value) {
            if (Array.isArray(value)) return value;
            if (Array.isArray(value?.items)) return value.items;
            if (Array.isArray(value?.data)) return value.data;
            return [];
        }

        function numero(...values) {
            for (const value of values) {
                const parsed = Number(value);
                if (Number.isFinite(parsed)) return parsed;
            }
            return 0;
        }

        function promedioNotas(items) {
            const notas = items.map(ev => Number(ev.nota20 ?? ev.nota)).filter(Number.isFinite);
            return notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
        }

        function calcularAsistencia(items) {
            if (!items.length) return 0;
            const ok = items.filter(a => /presente|tarde|justificado/i.test(String(a.estado || ''))).length;
            return ok / items.length * 100;
        }

        function evaluarNota(nota) {
            if (!Number.isFinite(nota)) return '-';
            if (nota >= 17) return 'Destacado';
            if (nota >= 14) return 'Logrado';
            if (nota >= 11) return 'En proceso';
            return 'En refuerzo';
        }

        function estadoPromedio(value) {
            if (value >= 16) return 'Excelente rendimiento';
            if (value >= 13) return 'Buen avance';
            if (value > 0) return 'Requiere refuerzo';
            return 'Sin notas';
        }

        function estadoAsistencia(value) {
            if (value >= 90) return 'Muy constante';
            if (value >= 75) return 'Adecuada';
            if (value > 0) return 'Por mejorar';
            return 'Sin registros';
        }

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, Number(value) || 0));
        }

        function slug(value) {
            return limpiarTexto(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'estudiante';
        }
    }

    function nombreCompleto() {
        return [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ').trim() || 'Estudiante';
    }

    function limpiarTexto(value) {
        let texto = String(value ?? '');

        for (let intento = 0; intento < 2 && /Ã|Â/.test(texto); intento += 1) {
            try {
                const corregido = decodeURIComponent(escape(texto));
                if (!corregido || corregido === texto) break;
                texto = corregido;
            } catch (error) {
                break;
            }
        }

        return texto.replace(/Â/g, '').trim();
    }

    function fechaLarga(value) {
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function abrirModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    function cerrarModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function getValue(id) {
        return document.getElementById(id)?.value.trim() || '';
    }

    function cerrarSesion() {
        window.shidellSession?.cerrarSesion?.();
    }

    function actualizarPreviewFoto(src) {
        const preview = document.getElementById('cfg-foto-preview');
        if (!preview) return;
        preview.innerHTML = src
            ? `<img src="${escapeHtml(src)}" alt="Vista previa de foto">`
            : '<i class="ph-fill ph-user"></i>';
    }

    function guardarFotoPerfilLocal(src) {
        const extra = configExtra;
        extra.fotoPerfil = src || '';
        configExtra = extra;

        usuario = usuario || {};
        usuario.fotoPerfil = src || '';
    }

    async function guardarFotoPerfilBackend(src) {
        if (!usuario?.id) return;

        try {
            const res = await fetch(`/api/users/${usuario.id}/foto-perfil`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotoPerfil: src || '' })
            });
            if (!res.ok) return;

            const actualizado = await res.json();
            usuario = { ...actualizado, fotoPerfil: src || actualizado.fotoPerfil || '' };
        } catch (error) {
            console.warn('La foto se guardo localmente, pero no en la base de datos.', error);
        }
    }

    function actualizarAvatares() {
        const fotoPerfil = obtenerFotoPerfilLocal();
        document.querySelectorAll('.top-user-info .avatar, .user-profile-card .avatar').forEach(avatar => {
            avatar.innerHTML = fotoPerfil
                ? `<img src="${escapeHtml(fotoPerfil)}" alt="Foto de perfil">`
                : '<i class="ph-fill ph-user" style="font-size:24px;color:var(--primary);"></i>';
        });
    }

    function actualizarFotoResumen() {
        if (vistaActual !== 'perfil') return;
        const fotoPerfil = obtenerFotoPerfilLocal();
        const summary = document.querySelector('.profile-summary');
        if (!summary) return;

        const actual = summary.querySelector('.profile-photo, .profile-initials');
        if (!actual) return;

        if (fotoPerfil) {
            actual.outerHTML = `<img class="profile-photo" src="${escapeHtml(fotoPerfil)}" alt="Foto de perfil">`;
            return;
        }

        const iniciales = `${(usuario.nombres || 'E')[0] || 'E'}${(usuario.apellidos || 'S')[0] || 'S'}`.toUpperCase();
        actual.outerHTML = `<div class="profile-initials">${escapeHtml(iniciales)}</div>`;
    }

    function obtenerFotoPerfilLocal() {
        return configExtra.fotoPerfil || usuario?.fotoPerfil || '';
    }

    function procesarFotoPerfil(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('Selecciona una imagen valida.'));
                return;
            }

            if (file.size > 8 * 1024 * 1024) {
                reject(new Error('La imagen debe pesar menos de 8 MB.'));
                return;
            }

            const reader = new FileReader();
            reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('La imagen no se pudo procesar.'));
                img.onload = () => {
                    const size = Math.min(img.width, img.height);
                    const sx = Math.max(0, (img.width - size) / 2);
                    const sy = Math.max(0, (img.height - size) / 2);
                    const canvas = document.createElement('canvas');
                    canvas.width = 512;
                    canvas.height = 512;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.86));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function toast(message, error = false) {
        const el = document.createElement('div');
        el.className = `settings-toast${error ? ' error' : ''}`;
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2600);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }
})();
