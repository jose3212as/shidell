    // ─── Session ───────────────────────────────────────────────────────────────
    let user = {};

    // ─── Variables globales ──────────────────────────────────────────────────
    let allTareas = [];
    let allEntregas = [];
    let filtroActivo = 'Todas';

    // ─── Inicialización ───────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        user = await window.shidellSession?.obtenerUsuario() || {};
        document.querySelectorAll('.user-name').forEach(el => el.textContent = [user.nombres, user.apellidos].filter(Boolean).join(' ') || 'Estudiante');
        document.querySelector('.greeting h1').textContent = `¡Hola, ${user.nombres || 'Estudiante'}!`;
        await cargarDatos();
        configurarTabs();
        configurarBusqueda();
        configurarFiltros();
        configurarAccionesTareas();
        configurarComprobante();
    });

    // ─── Cargar datos de la API ───────────────────────────────────────────────
    async function cargarDatos() {
        const container = document.getElementById('tareasContainer');

        if (!user.id) {
            container.innerHTML = estadoVacio('ph-user-circle', 'Inicia sesión para ver tus tareas.');
            return;
        }

        try {
            const tareasRes = await fetch(`/api/tareas/estudiante/${user.id}`, { credentials: 'same-origin' });
            if (!tareasRes.ok) throw new Error('No se pudieron cargar las tareas del estudiante.');

            const data = await tareasRes.json();
            if (data.estudiante?.id) Object.assign(user, data.estudiante);

            allTareas = normalizarTareas(Array.isArray(data.tareas) ? data.tareas : []);
            allEntregas = allTareas.map(t => t.entrega).filter(Boolean);

            renderizarTareas('Todas');
            actualizarResumen();

        } catch (err) {
            console.warn('No pudimos cargar las tareas:', err);
            if (window.ShidellErrors?.renderCard) {
                window.ShidellErrors.renderCard(container, {
                    portal: 'ESTUDIANTE',
                    title: 'No pudimos abrir tus tareas ahora',
                    message: err?.message,
                    onRetry: () => cargarDatos()
                });
            } else {
                container.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: var(--red);">
                        <p>No pudimos cargar tus tareas en este momento. Intenta recargar la página.</p>
                    </div>`;
            }
        }
    }

    // ─── Calcular estado de una tarea ─────────────────────────────────────────
    function calcularEstado(tarea) {
        const entrega = tarea.entrega || allEntregas.find(e => e.tarea && e.tarea.id === tarea.id);
        if (tarea.status) return { status: tarea.status, entrega };
        if (entrega) return { status: 'Completada', entrega };
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const vence = new Date(tarea.fechaVencimiento); vence.setHours(0,0,0,0);
        if (hoy > vence) return { status: 'Vencido', entrega: null };
        return { status: 'Pendiente', entrega: null };
    }

    function normalizarTareas(items) {
        return items.map(item => {
            if (item?.tarea) {
                return {
                    ...item.tarea,
                    entrega: item.entrega || null,
                    status: item.status || item.tarea.estado
                };
            }
            return item;
        });
    }

    // ─── Renderizar lista de tareas ───────────────────────────────────────────
    function renderizarTareas(filtro) {
        filtroActivo = filtro;
        const container = document.getElementById('tareasContainer');
        const searchInput = document.getElementById('searchInput');
        const busqueda  = searchInput ? searchInput.value.toLowerCase() : '';

        const tareasConEstado = allTareas.map(t => ({ ...t, ...calcularEstado(t) }));

        const tareasFiltradas = tareasConEstado.filter(t => {
            const coincideFiltro   = filtro === 'Todas' || t.status === filtro;
            const coincidePriority = !filtroPrioridad || t.prioridad === filtroPrioridad;
            const coincideBusqueda = !busqueda || t.titulo.toLowerCase().includes(busqueda) ||
                                     (t.curso && t.curso.nombre.toLowerCase().includes(busqueda));
            return coincideFiltro && coincidePriority && coincideBusqueda;
        });

        if (tareasFiltradas.length === 0) {
            const msg = filtro === 'Todas' ? '¡No hay tareas disponibles!' :
                        filtro === 'Pendiente' ? '¡No tienes tareas pendientes! 🎉' :
                        filtro === 'Vencido'   ? '¡No tienes tareas vencidas! 🙌' :
                                                 '¡Aún no has completado ninguna tarea.';
            container.innerHTML = `<div style="padding:50px;text-align:center;color:var(--text-muted);">
                <img src="../icons/regular/clipboard-text.svg" class="icon-img" alt="clipboard-text" style="width:48px;height:48px;display:block;margin-bottom:12px;opacity:.4;">
                <p>${msg}</p></div>`;
            return;
        }

        container.innerHTML = tareasFiltradas.map(tarea => buildTareaCard(tarea)).join('');
    }

    // ─── Construir HTML de una tarjeta de tarea ───────────────────────────────
    function buildTareaCard(tarea) {
        const icon  = escapeHtml(tarea.curso?.icono  || 'ph-clipboard-text');
        const color = escapeHtml(tarea.curso?.color  || 'blue');
        const curso = escapeHtml(tarea.curso?.nombre || 'Sin curso');
        const titulo = escapeHtml(tarea.titulo || 'Tarea');
        const fecha = escapeHtml(tarea.fechaVencimiento || 'Sin fecha');
        const prio  = escapeHtml(tarea.prioridad || 'Media');
        const prioIcon = prio === 'Alta' ? '↑' : prio === 'Media' ? '—' : '↓';
        const descripcion = escapeHtml(resumenDescripcion(tarea.descripcion));
        const urlDetalle = `tareadetalle.html?id=${encodeURIComponent(tarea.id)}`;

        let actionHtml, badgeHtml;
        if (tarea.status === 'Completada') {
            actionHtml = `
                <div style="display:flex;align-items:center;gap:8px;">
                    <a href="${urlDetalle}" class="btn-entregar" style="text-decoration:none;">
                        <img src="../icons/regular/arrow-right.svg" class="icon-img" alt="ver"> Ver entrega
                    </a>
                    <button class="btn-comprobante" type="button" data-tarea-id="${tarea.id}">
                        <img src="../icons/regular/file-text.svg" class="icon-img" alt="file-text"> Comprobante
                    </button>
                </div>`;
            if (tarea.entrega?.nota !== null && tarea.entrega?.nota !== undefined) {
                badgeHtml = `<span style="color:var(--green);font-size:12px;font-weight:600;">✔ Calificado (${Number(tarea.entrega.nota).toFixed(1)}/20)</span>`;
            } else if (tarea.entrega?.estado === 'ENTREGADO_TARDE') {
                badgeHtml = `<span style="color:#d97706;font-size:12px;font-weight:600;">⏰ Entregado con retraso</span>`;
            } else {
                badgeHtml = `<span style="color:var(--green);font-size:12px;font-weight:600;">✔ Entregado</span>`;
            }
        } else if (tarea.status === 'Vencido') {
            actionHtml = `<a href="${urlDetalle}" style="text-decoration:none;background:var(--red-light,#fff1f0);color:var(--red,#e03);padding:8px 14px;border-radius:10px;font-size:13px;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;">
                <img src="../icons/regular/warning.svg" class="icon-img" alt="warning"> Ver tarea</a>`;
            badgeHtml = `<span style="color:var(--red,#e03);font-size:12px;font-weight:600;">⚠ Vencido</span>`;
        } else {
            actionHtml = `<a href="${urlDetalle}" class="btn-entregar" data-tarea-id="${tarea.id}" style="text-decoration:none;"><img src="../icons/regular/upload-simple.svg" class="icon-img" alt="upload-simple"> Entregar</a>`;
            badgeHtml  = `<span style="color:var(--text-muted);font-size:12px;">Pendiente</span>`;
        }

        return `
        <div class="tarea-item-row" data-tarea-id="${tarea.id}" style="cursor:pointer;">
            <div class="t-icon bg-${color}-light">${iconImg(icon, 'fill')}</div>
            <div class="t-info">
                <h4><a href="${urlDetalle}" style="color:inherit;text-decoration:none;">${titulo}</a></h4>
                <p>${curso}</p>
                <small>${descripcion}</small>
            </div>
            <div class="t-priority ${prio.toLowerCase()}">${prioIcon} ${prio}</div>
            <div class="t-date">
                <span class="date"><img src="../icons/regular/calendar-blank.svg" class="icon-img" alt="calendar-blank"> ${fecha}</span>
                ${badgeHtml}
            </div>
            ${actionHtml}
            <a href="${urlDetalle}" class="t-action" title="Abrir página de la tarea"><img src="../icons/regular/arrow-right.svg" class="icon-img" alt="ir"></a>
        </div>`;
    }

    function resumenDescripcion(descripcion) {
        const texto = String(descripcion || '').trim().replace(/\s+/g, ' ');
        if (!texto) return 'Sin descripción registrada';
        return texto.length > 92 ? `${texto.slice(0, 92)}...` : texto;
    }

    // ─── Actualizar contadores de pestañas ────────────────────────────────────
    function actualizarResumen() {
        const total       = allTareas.length;
        const pendientes  = allTareas.filter(t => calcularEstado(t).status === 'Pendiente').length;
        const vencidas    = allTareas.filter(t => calcularEstado(t).status === 'Vencido').length;
        const completadas = allTareas.filter(t => calcularEstado(t).status === 'Completada').length;

        const contadores = {
            'count-todas': total,
            'count-pendiente': pendientes,
            'count-vencido': vencidas,
            'count-completada': completadas
        };

        Object.entries(contadores).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }

    // ─── Tabs de filtrado ─────────────────────────────────────────────────────
    function configurarTabs() {
        document.querySelectorAll('.tarea-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tarea-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderizarTareas(btn.dataset.status);
            });
        });
    }

    // ─── Búsqueda ─────────────────────────────────────────────────────────────
    function configurarBusqueda() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        searchInput.addEventListener('input', () => {
            renderizarTareas(filtroActivo);
        });
    }

    // ─── Filtros de prioridad ────────────────────────────────────────────────
    let filtroPrioridad = '';

    function configurarFiltros() {
        const btn  = document.getElementById('btnFiltroTareas');
        const menu = document.getElementById('filtroTareasMenu');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = menu.style.display === 'block';
            menu.style.display = isVisible ? 'none' : 'block';
        });
        document.addEventListener('click', () => { menu.style.display = 'none'; });
        menu.addEventListener('click', e => e.stopPropagation());

        menu.querySelectorAll('input[name=prio]').forEach(radio => {
            radio.addEventListener('change', () => {
                filtroPrioridad = radio.value;
                renderizarTareas(filtroActivo);
            });
        });
    }

    function configurarAccionesTareas() {
        document.getElementById('tareasContainer').addEventListener('click', (event) => {
            const btnComprobante = event.target.closest('.btn-comprobante');
            if (btnComprobante) {
                event.preventDefault();
                event.stopPropagation();
                abrirComprobantePorTareaId(Number(btnComprobante.dataset.tareaId));
                return;
            }
            if (event.target.closest('a')) {
                return;
            }
            const row = event.target.closest('.tarea-item-row');
            if (row && row.dataset.tareaId) {
                abrirEntrega(Number(row.dataset.tareaId));
            }
        });
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

    function estadoVacio(icono, texto) {
        return `<div style="padding:50px;text-align:center;color:var(--text-muted);">
            ${iconImg(escapeHtml(icono), '', 'width:48px;height:48px;display:block;margin-bottom:12px;opacity:.45;')}
            <p>${escapeHtml(texto)}</p>
        </div>`;
    }

    // ─── Ir a la página de la tarea creada ───────────────────────────────────
    function abrirEntrega(id) {
        if (!id) return;
        window.location.href = `tareadetalle.html?id=${encodeURIComponent(id)}`;
    }

    // ─── Comprobante Oficial (delegado al componente compartido) ────────────────
    function configurarComprobante() {
        window.shidellComprobante?.mount();
    }

    function abrirComprobantePorTareaId(tareaId) {
        const tarea = allTareas.find(t => t.id === tareaId);
        if (!tarea) return;
        const entrega = tarea.entrega || allEntregas.find(e => e.tarea && e.tarea.id === tareaId);
        window.shidellComprobante?.open({ entrega, tarea, user });
    }

    window.cerrarSesion = () => window.shidellSession?.cerrarSesion?.();
