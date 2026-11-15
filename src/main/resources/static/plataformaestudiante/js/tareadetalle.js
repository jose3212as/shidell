    let user = {};
    let tareaActual = null;
    let entregaActual = null;
    const params = new URLSearchParams(window.location.search);
    const tareaIdParam = Number(params.get('id'));
    const cursoIdOrigen = params.get('cursoId');

    document.addEventListener('DOMContentLoaded', async () => {
        user = await window.shidellSession?.obtenerUsuario() || {};
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = [user.nombres, user.apellidos].filter(Boolean).join(' ') || 'Estudiante';
        });
        const greetingH1 = document.querySelector('.greeting h1');
        if (greetingH1) {
            greetingH1.textContent = `¡Hola, ${user.nombres || 'Estudiante'}! 👋`;
        }

        if (cursoIdOrigen) {
            const btnVolver = document.getElementById('btnVolverLista');
            const btnCancelar = document.getElementById('btnCancelarEdicion');
            if (btnVolver) {
                btnVolver.href = `cursodetalleestudiante.html?id=${encodeURIComponent(cursoIdOrigen)}`;
                btnVolver.innerHTML = `<img src="../icons/regular/arrow-left.svg" class="icon-img" alt="volver"> Volver al Curso`;
            }
            if (btnCancelar) {
                btnCancelar.href = `cursodetalleestudiante.html?id=${encodeURIComponent(cursoIdOrigen)}`;
            }
        }

        configurarFormularioEntrega();
        configurarComprobante();
        await cargarDetalleTarea();

        if (window.location.hash === '#comprobante' && entregaActual && tareaActual) {
            abrirComprobante(entregaActual, tareaActual);
        }
    });

    async function cargarDetalleTarea() {
        const loadingEl = document.getElementById('tdLoadingState');
        const mainEl = document.getElementById('tdMainContent');

        if (!tareaIdParam) {
            loadingEl.innerHTML = `
                <img src="../icons/regular/warning.svg" class="icon-img" alt="warning" style="width:36px;height:36px;margin-bottom:10px;opacity:0.8;">
                <p style="color:var(--ed-status-late-text);font-weight:600;font-size:14px;">No se especificó ninguna asignación para mostrar.</p>
                <div style="margin-top:16px;"><a href="tareas.html" class="td-back-link">Ir a Mis Tareas</a></div>
            `;
            return;
        }

        try {
            let encontrada = null;
            let entrega = null;

            if (user?.id) {
                const resEst = await fetch(`/api/tareas/estudiante/${user.id}`, { credentials: 'same-origin' });
                if (resEst.ok) {
                    const data = await resEst.json();
                    if (data.estudiante?.id) Object.assign(user, data.estudiante);
                    const lista = Array.isArray(data.tareas) ? data.tareas : [];
                    const item = lista.find(it => Number(it?.tarea?.id ?? it?.id) === tareaIdParam);
                    if (item) {
                        encontrada = item.tarea ? { ...item.tarea, status: item.status } : item;
                        entrega = item.entrega || null;
                    }
                }
            }

            if (!encontrada) {
                const resAll = await fetch('/api/tareas', { credentials: 'same-origin' });
                if (resAll.ok) {
                    const todas = await resAll.json();
                    encontrada = (Array.isArray(todas) ? todas : []).find(t => Number(t.id) === tareaIdParam) || null;
                }
            }

            if (encontrada && !entrega && user?.id) {
                const resEnt = await fetch(`/api/entregas/usuario/${user.id}`, { credentials: 'same-origin' });
                if (resEnt.ok) {
                    const entregas = await resEnt.json();
                    entrega = (Array.isArray(entregas) ? entregas : []).find(e => Number(e?.tarea?.id) === tareaIdParam) || null;
                }
            }

            if (!encontrada) {
                throw new Error('No se encontró la tarea solicitada.');
            }

            tareaActual = encontrada;
            entregaActual = entrega;

            renderizarPaginaTarea(tareaActual, entregaActual);
            loadingEl.style.display = 'none';
            mainEl.style.display = 'block';

        } catch (err) {
            console.error('Error cargando la tarea:', err);
            loadingEl.innerHTML = `
                <img src="../icons/regular/warning.svg" class="icon-img" alt="warning" style="width:36px;height:36px;margin-bottom:10px;opacity:0.8;">
                <p style="color:var(--ed-status-late-text);font-weight:600;font-size:14px;">${escapeHtml(err.message || 'Error al cargar la tarea.')}</p>
                <div style="margin-top:16px;"><a href="tareas.html" class="td-back-link">Volver a Mis Tareas</a></div>
            `;
        }
    }

    function calcularEstadoActual(tarea, entrega) {
        if (entrega) return 'Completada';
        if (tarea?.status && ['Completada', 'Vencido', 'Pendiente'].includes(tarea.status)) {
            return tarea.status;
        }
        if (tarea?.fechaVencimiento) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const vence = new Date(tarea.fechaVencimiento + 'T00:00:00');
            if (hoy > vence) return 'Vencido';
        }
        return 'Pendiente';
    }

    function renderizarPaginaTarea(tarea, entrega) {
        const status = calcularEstadoActual(tarea, entrega);
        const cursoNombre = tarea.curso?.nombre || 'Curso General';
        const cursoId = tarea.curso?.id || cursoIdOrigen;
        const color = tarea.curso?.color || 'blue';
        const icono = tarea.curso?.icono || 'ph-clipboard-text';
        const prioridad = tarea.prioridad || 'Media';

        document.title = `Shidell — ${tarea.titulo || 'Tarea'}`;
        document.getElementById('tareaIdInput').value = tarea.id;

        // Breadcrumbs
        const bcCurso = document.getElementById('bcCursoLink');
        bcCurso.textContent = cursoNombre;
        bcCurso.href = cursoId ? `cursodetalleestudiante.html?id=${encodeURIComponent(cursoId)}` : 'miscursos.html';
        document.getElementById('bcTareaTitulo').textContent = tarea.titulo || 'Detalle de tarea';

        // Hero
        const heroIcon = document.getElementById('tdHeroIcon');
        heroIcon.innerHTML = iconImg(escapeHtml(icono), 'fill');

        document.getElementById('tdTitulo').textContent = tarea.titulo || 'Tarea';
        document.getElementById('tdCursoPill').innerHTML = `<img src="../icons/regular/book-open.svg" class="icon-img" alt=""> ${escapeHtml(cursoNombre)}`;
        document.getElementById('tdFechaPill').innerHTML = `<img src="../icons/regular/calendar-blank.svg" class="icon-img" alt=""> Vence: ${formatearFechaCorta(tarea.fechaVencimiento)}`;
        document.getElementById('tdPrioridadPill').innerHTML = `<img src="../icons/regular/flag.svg" class="icon-img" alt=""> Prioridad ${escapeHtml(prioridad)}`;

        const estadoPill = document.getElementById('tdEstadoPill');
        estadoPill.className = `td-pill status-${status.toLowerCase()}`;
        estadoPill.textContent = status === 'Completada' ? 'Entregada' : (status === 'Vencido' ? 'Vencida' : 'Pendiente de entrega');

        // Consigna y material del docente
        const descTexto = String(tarea.descripcion || '').trim();
        document.getElementById('tdDescripcion').textContent = descTexto || 'El docente no registró indicaciones adicionales para esta tarea. Adjunta tu archivo de solución en la sección inferior.';

        const materialBox = document.getElementById('tdMaterialBox');
        const materialLink = document.getElementById('tdMaterialLink');
        if (tarea.pdfUrl && String(tarea.pdfUrl).trim()) {
            materialBox.classList.remove('is-hidden');
            materialLink.href = String(tarea.pdfUrl).trim();
        } else {
            materialBox.classList.add('is-hidden');
            materialLink.removeAttribute('href');
        }

        // Panel lateral derecho (Ledger)
        document.getElementById('sideEstado').textContent = status === 'Completada' ? 'Entregada' : status;
        document.getElementById('sideEstado').style.color = status === 'Completada' ? 'var(--ed-status-done-text)' : (status === 'Vencido' ? 'var(--ed-status-late-text)' : 'var(--ed-status-pending-text)');
        document.getElementById('sideCurso').textContent = cursoNombre;
        document.getElementById('sideFechaInicio').textContent = formatearFechaCorta(tarea.fechaInicio);
        document.getElementById('sideFechaVencimiento').textContent = formatearFechaCorta(tarea.fechaVencimiento);
        document.getElementById('sidePrioridad').textContent = prioridad;

        // Estado de Entrega
        const cardRegistrada = document.getElementById('tdEntregaRegistradaCard');
        const cardFormulario = document.getElementById('tdFormularioCard');
        const retroPanel = document.getElementById('sideRetroalimentacionPanel');

        if (entrega) {
            cardRegistrada.style.display = 'block';
            cardFormulario.style.display = 'none';

            const codigo = `REC-SHD-2026-${String(entrega.id || 0).padStart(4, '0')}`;
            document.getElementById('tdCodigoRecibo').textContent = codigo;

            const nombreArchivo = window.shidellComprobante
                ? window.shidellComprobante.formatFileName(entrega.archivoUrl)
                : (entrega.archivoUrl ? entrega.archivoUrl.split('/').pop() : 'Documento enviado');
            const linkArchivo = document.getElementById('tdArchivoEnviadoLink');
            document.getElementById('tdArchivoEnviadoNombre').textContent = nombreArchivo;
            if (entrega.archivoUrl) {
                linkArchivo.href = entrega.archivoUrl;
            } else {
                linkArchivo.removeAttribute('href');
            }

            const fechaStr = entrega.fechaEntrega
                ? (window.shidellComprobante
                    ? window.shidellComprobante.formatTimestamp(entrega.fechaEntrega)
                    : new Date(entrega.fechaEntrega).toLocaleString('es-PE'))
                : 'Registrado';
            document.getElementById('tdFechaEntregaRealizada').textContent = fechaStr;
            document.getElementById('tdComentarioEstudianteTexto').textContent = entrega.comentarioEstudiante || 'Sin comentario adicional';

            const yaCalificada = entrega.estado === 'CALIFICADO' || (entrega.nota !== null && entrega.nota !== undefined);
            const btnReemplazar = document.getElementById('btnReemplazarEntrega');
            if (btnReemplazar) {
                btnReemplazar.style.display = yaCalificada ? 'none' : '';
            }

            if (entrega.nota !== null && entrega.nota !== undefined) {
                document.getElementById('tdCalificacionDocente').textContent = `${Number(entrega.nota).toFixed(1)} / 20`;
                document.getElementById('tdCalificacionDocente').style.color = 'var(--ed-status-done-text)';
                document.getElementById('sideNota').textContent = `${Number(entrega.nota).toFixed(1)} / 20`;
            } else if (entrega.estado === 'ENTREGADO_TARDE') {
                document.getElementById('tdCalificacionDocente').textContent = 'Entregado con retraso · Pendiente de calificación';
                document.getElementById('tdCalificacionDocente').style.color = '#d97706';
                document.getElementById('sideNota').textContent = 'Entregado tarde';
            } else {
                document.getElementById('tdCalificacionDocente').textContent = 'Pendiente de calificación';
                document.getElementById('tdCalificacionDocente').style.color = '';
                document.getElementById('sideNota').textContent = 'En revisión';
            }

            if (entrega.comentarioProfesor) {
                retroPanel.style.display = 'block';
                document.getElementById('sideComentarioProfesor').textContent = entrega.comentarioProfesor;
            } else {
                retroPanel.style.display = 'none';
            }
        } else {
            cardRegistrada.style.display = 'none';
            cardFormulario.style.display = 'block';
            retroPanel.style.display = 'none';
            document.getElementById('sideNota').textContent = 'Sin calificar';
        }
    }

    function configurarFormularioEntrega() {
        const archivoInput = document.getElementById('archivoTarea');
        const comentarioInput = document.getElementById('comentarioTarea');
        const fileBox = document.getElementById('entregaFileBox');
        const btnReemplazar = document.getElementById('btnReemplazarEntrega');
        const btnVerComprobante = document.getElementById('btnVerComprobantePagina');

        archivoInput.addEventListener('change', actualizarArchivoSeleccionado);
        comentarioInput.addEventListener('input', () => {
            document.getElementById('comentarioContador').textContent = `${comentarioInput.value.length}/500`;
        });

        // Soporte Drag & Drop
        ['dragenter', 'dragover'].forEach(evt => {
            fileBox.addEventListener(evt, e => {
                e.preventDefault();
                e.stopPropagation();
                fileBox.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(evt => {
            fileBox.addEventListener(evt, e => {
                e.preventDefault();
                e.stopPropagation();
                fileBox.classList.remove('dragover');
            });
        });
        fileBox.addEventListener('drop', e => {
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                archivoInput.files = files;
                actualizarArchivoSeleccionado();
            }
        });

        if (btnReemplazar) {
            btnReemplazar.addEventListener('click', () => {
                const cardFormulario = document.getElementById('tdFormularioCard');
                document.getElementById('tdFormTitle').textContent = 'Actualizar archivo de entrega';
                cardFormulario.style.display = 'block';
                cardFormulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        if (btnVerComprobante) {
            btnVerComprobante.addEventListener('click', () => {
                if (entregaActual && tareaActual) {
                    abrirComprobante(entregaActual, tareaActual);
                }
            });
        }

        document.getElementById('formEntregaPagina').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnEnviarEntrega');
            const archivo = archivoInput.files[0];

            if (!archivo) {
                mostrarFeedbackEntrega('Selecciona un archivo PDF, DOC o DOCX antes de entregar.', 'error');
                return;
            }
            if (!archivoValido(archivo)) return;

            mostrarFeedbackEntrega('', '');
            btn.disabled = true;
            btn.innerHTML = '<img src="../icons/regular/spinner.svg" class="icon-img" alt="spinner" style="animation: spin 1s linear infinite; filter: brightness(0) invert(1);"> Enviando entrega...';

            const formData = new FormData();
            formData.append('tareaId', tareaActual?.id || tareaIdParam);
            formData.append('estudianteId', user.id);
            formData.append('comentario', comentarioInput.value.trim());
            formData.append('archivo', archivo);

            try {
                const res = await fetch('/api/entregas', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });

                if (res.ok) {
                    const savedEntrega = await res.json().catch(() => null);
                    entregaActual = savedEntrega;
                    const msgExito = savedEntrega?.estado === 'ENTREGADO_TARDE'
                        ? 'Entrega registrada fuera de plazo (ENTREGADO_TARDE).'
                        : '¡Tu tarea ha sido entregada exitosamente!';
                    mostrarFeedbackEntrega(msgExito, 'success');
                    document.getElementById('formEntregaPagina').reset();
                    actualizarArchivoSeleccionado();
                    document.getElementById('comentarioContador').textContent = '0/500';

                    await cargarDetalleTarea();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    abrirComprobante(savedEntrega, tareaActual);
                } else {
                    const detalle = await leerErrorEntrega(res);
                    mostrarFeedbackEntrega(detalle || 'No se pudo registrar la entrega. Intenta nuevamente.', 'error');
                }
            } catch (err) {
                mostrarFeedbackEntrega('Error de conexión con el servidor.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Entregar tarea ahora</span><img src="../icons/regular/paper-plane-tilt.svg" class="icon-img" alt="enviar" style="filter: brightness(0) invert(1); width: 15px; height: 15px;">';
            }
        });
    }

    function actualizarArchivoSeleccionado() {
        const input = document.getElementById('archivoTarea');
        const fileBox = document.getElementById('entregaFileBox');
        const nombre = document.getElementById('archivoNombre');
        const ayuda = document.getElementById('archivoAyuda');
        const file = input.files[0];

        if (!file) {
            fileBox.classList.remove('has-file');
            nombre.textContent = 'Arrastra tu archivo aquí o haz clic para explorar';
            ayuda.textContent = 'Formatos admitidos: PDF, DOC o DOCX';
            return;
        }

        if (!archivoValido(file)) return;

        fileBox.classList.add('has-file');
        nombre.textContent = file.name;
        ayuda.textContent = `${formatearPesoArchivo(file.size)} listo para enviar`;
        mostrarFeedbackEntrega('', '');
    }

    function archivoValido(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const permitidas = ['pdf', 'doc', 'docx'];
        const maxBytes = 10 * 1024 * 1024;

        if (!permitidas.includes(extension)) {
            mostrarFeedbackEntrega('El archivo debe estar en formato PDF, DOC o DOCX.', 'error');
            document.getElementById('archivoTarea').value = '';
            return false;
        }

        if (file.size > maxBytes) {
            mostrarFeedbackEntrega('El archivo supera el límite máximo de 10 MB.', 'error');
            document.getElementById('archivoTarea').value = '';
            return false;
        }

        return true;
    }

    async function leerErrorEntrega(res) {
        if (res.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
        if (res.status === 413) return 'El archivo supera el tamaño máximo permitido (10 MB).';
        try {
            const data = await res.json();
            return data.error || data.message || '';
        } catch {
            return '';
        }
    }

    function mostrarFeedbackEntrega(mensaje, tipo) {
        const feedback = document.getElementById('entregaFeedback');
        feedback.textContent = mensaje;
        feedback.className = 'td-feedback';
        if (mensaje) feedback.classList.add('show', tipo);
    }

    function formatearPesoArchivo(bytes) {
        if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatearFechaCorta(fecha) {
        if (!fecha) return 'Sin fecha';
        const [year, month, day] = String(fecha).split('-').map(Number);
        const date = year && month && day ? new Date(year, month - 1, day) : new Date(fecha);
        return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
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

    // ─── Comprobante Oficial (delegado al componente compartido) ────────────────
    function configurarComprobante() {
        window.shidellComprobante?.mount();
    }

    function abrirComprobante(entrega, tarea) {
        window.shidellComprobante?.open({ entrega, tarea, user });
    }

    window.cerrarSesion = () => window.shidellSession?.cerrarSesion?.();
