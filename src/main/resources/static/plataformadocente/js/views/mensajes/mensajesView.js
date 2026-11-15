import { Auth } from '../../services/auth.js';
import { API } from '../../services/api.js';

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRoleMeta(contacto, ctx) {
    const rol = String(ctx?.rol || contacto?.rol || '').toUpperCase();
    switch (rol) {
        case 'ESTUDIANTE':
            return { text: ctx?.rolLabel || 'Estudiante', cls: 'is-student', filterKey: 'ESTUDIANTE' };
        case 'PADRE':
            return { text: ctx?.rolLabel || 'Apoderado', cls: 'is-parent', filterKey: 'PADRE' };
        case 'DOCENTE':
            return { text: ctx?.rolLabel || 'Docente', cls: 'is-docente', filterKey: 'OTRO' };
        case 'ADMINISTRADOR':
            return { text: ctx?.rolLabel || 'Dirección', cls: 'is-docente', filterKey: 'OTRO' };
        default:
            return { text: ctx?.rolLabel || 'Contacto', cls: 'is-docente', filterKey: 'OTRO' };
    }
}

function buildFallbackSalonShort(contacto) {
    if (!contacto?.grado || !contacto?.seccion) return '';
    const g = String(contacto.grado).trim();
    const gFmt = /[°º]$/.test(g) ? g : `${g}°`;
    const niv = String(contacto.nivel || '').trim().toLowerCase();
    const nivShort = niv === 'primaria' ? 'Prim.' : (niv === 'secundaria' ? 'Sec.' : (niv === 'inicial' ? 'Inic.' : ''));
    return nivShort ? `${gFmt} ${contacto.seccion} · ${nivShort}` : `${gFmt} ${contacto.seccion}`;
}

function buildFallbackSalonLabel(contacto) {
    if (!contacto?.grado || !contacto?.seccion) return '';
    const g = String(contacto.grado).trim();
    const gFmt = /[°º]$/.test(g) ? g : `${g}°`;
    const niv = String(contacto.nivel || '').trim();
    const nivFmt = niv ? niv.charAt(0).toUpperCase() + niv.slice(1).toLowerCase() : '';
    return nivFmt ? `${gFmt} ${contacto.seccion} · ${nivFmt}` : `${gFmt} ${contacto.seccion}`;
}

function summarizeHijosText(hijos) {
    if (!Array.isArray(hijos) || hijos.length === 0) return '';
    if (hijos.length === 1) {
        return `Alumno: ${hijos[0].nombreCompleto}`;
    }
    if (hijos.length === 2) {
        return `Alumnos: ${hijos[0].nombreCompleto} y ${hijos[1].nombreCompleto}`;
    }
    return `Alumnos: ${hijos[0].nombreCompleto}, ${hijos[1].nombreCompleto} y ${hijos.length - 2} más`;
}

function buildSubcontextText(item) {
    const c = item.contacto || {};
    const ctx = item.contexto || {};
    const rol = String(ctx.rol || c.rol || '').toUpperCase();

    if (rol === 'PADRE') {
        const hijos = Array.isArray(ctx.hijos) ? ctx.hijos : [];
        const hijosTxt = summarizeHijosText(hijos);
        if (hijosTxt) return hijosTxt;
    }

    const cursos = Array.isArray(ctx.cursos) ? ctx.cursos : [];
    if (cursos.length > 0) {
        if (cursos.length <= 2) return cursos.join(' · ');
        return `${cursos.slice(0, 2).join(' · ')} +${cursos.length - 2} más`;
    }

    const turno = ctx.turnoLabel || '';
    if (turno) return `Turno ${turno}`;
    return '';
}

function formatMessageText(text) {
    return escapeHtml(text || '').replace(/\r?\n/g, '<br>');
}

function getPresenceInfo(contacto) {
    if (window.ShidellPresence) {
        return window.ShidellPresence.getStatus(contacto);
    }
    return { state: 'offline', label: 'Desconectado', shortLabel: 'Desconectado', title: 'Sin conexión reciente' };
}

export const MensajesView = {
    async render() {
        return `
            <div class="content-header" style="margin-bottom:20px;">
                <div>
                    <h2>Mensajes</h2>
                    <p>Comunícate con tus estudiantes y apoderados identificados por salón, alumno y curso.</p>
                </div>
            </div>

            <div class="messages-container">
                <!-- Panel Izquierdo -->
                <div class="contacts-sidebar">
                    <div class="contacts-header">
                        <div class="contacts-title-row">
                            <h2>Bandeja</h2>
                            <span class="msg-count-pill" id="msg-count-pill">0</span>
                        </div>
                        <div class="search-input-wrapper">
                            <i class="ph ph-magnifying-glass"></i>
                            <input type="text" id="chat-search" placeholder="Buscar alumno, salón, curso o apoderado...">
                        </div>
                        <div class="msg-filters-stack">
                            <select id="chat-salon-filter" class="msg-filter-select" aria-label="Filtrar por salón">
                                <option value="ALL">Todos los salones</option>
                            </select>
                            <div class="msg-role-tabs" id="msg-role-tabs" role="tablist" aria-label="Filtrar por tipo de contacto">
                                <button type="button" class="msg-role-tab active" data-role="ALL">Todos</button>
                                <button type="button" class="msg-role-tab" data-role="ESTUDIANTE">Alumnos</button>
                                <button type="button" class="msg-role-tab" data-role="PADRE">Apoderados</button>
                            </div>
                        </div>
                    </div>
                    <div class="conversations-list" id="convo-list">
                        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">Cargando bandeja...</div>
                    </div>
                </div>

                <!-- Panel Derecho -->
                <div class="chat-area" id="chat-active" style="display: none;">
                    <div class="chat-header">
                        <div class="convo-avatar" id="active-avatar">?</div>
                        <div class="chat-header-info">
                            <div class="chat-header-top">
                                <h3 id="active-name">Cargando...</h3>
                                <div class="chat-header-pills" id="active-pills"></div>
                            </div>
                            <div class="chat-header-context" id="active-context"></div>
                        </div>
                        <div class="chat-header-actions" id="active-actions"></div>
                    </div>

                    <div class="chat-messages" id="chat-messages">
                        <!-- Mensajes inyectados aquí -->
                    </div>

                    <div class="chat-input-area">
                        <input type="text" id="chat-input" class="chat-input" placeholder="Escribe un mensaje aquí...">
                        <button id="btn-send-msg" class="btn-send"><i class="ph ph-paper-plane-right"></i></button>
                    </div>
                </div>

                <!-- Estado Inicial / Vacío -->
                <div class="no-chat-selected" id="no-chat">
                    <i class="ph ph-chat-circle-dots"></i>
                    <h3>Tus Mensajes</h3>
                    <p>Selecciona un estudiante o apoderado a la izquierda para empezar a chatear.</p>
                </div>
            </div>
        `;
    },

    async afterRender(queryString) {
        this.user = Auth.getUser();
        this.bandeja = [];
        this.salones = [];
        this.activeContacto = null;
        this.activeContexto = null;
        this.selectedSalon = 'ALL';
        this.selectedRole = 'ALL';
        this.refreshInterval = null;
        this.presenceInterval = null;
        const params = new URLSearchParams(queryString || '');
        const contactoParam = params.get('contacto');
        const salonParam = params.get('salon');
        if (salonParam) this.selectedSalon = salonParam;

        this.cacheElements();
        this.bindEvents();
        await this.cargarBandeja();

        this.presenceInterval = setInterval(() => {
            if (!document.getElementById('convo-list')) {
                clearInterval(this.presenceInterval);
                this.presenceInterval = null;
                return;
            }
            if (document.visibilityState !== 'hidden') {
                this.cargarBandeja();
            }
        }, 15000);

        if (contactoParam) {
            await this.abrirContactoPorId(contactoParam);
        }
    },

    async abrirContactoPorId(contactoId) {
        const item = this.bandeja.find(x => String(x.contacto?.id) === String(contactoId));
        if (item?.contacto) {
            await this.abrirConversacion(item.contacto, item.contexto || null);
            return;
        }
        try {
            const contacto = await API.fetch(`/api/users/${encodeURIComponent(contactoId)}`);
            if (contacto && contacto.id) {
                const placeholder = {
                    contacto,
                    contexto: null,
                    preview: 'Sin mensajes aún',
                    tieneMensajes: false,
                    noLeidos: 0,
                    fechaUltimoMensaje: ''
                };
                this.bandeja.unshift(placeholder);
                this.renderSalonesSelect();
                this.renderConversaciones();
                await this.abrirConversacion(contacto, null);
            }
        } catch (e) {
            console.error('No se pudo preseleccionar contacto:', e);
        }
    },

    cacheElements() {
        this.el = {
            convoList: document.getElementById('convo-list'),
            chatActive: document.getElementById('chat-active'),
            noChat: document.getElementById('no-chat'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            btnSend: document.getElementById('btn-send-msg'),
            search: document.getElementById('chat-search'),
            salonFilter: document.getElementById('chat-salon-filter'),
            roleTabs: document.getElementById('msg-role-tabs'),
            countPill: document.getElementById('msg-count-pill'),
            avatar: document.getElementById('active-avatar'),
            name: document.getElementById('active-name'),
            pills: document.getElementById('active-pills'),
            context: document.getElementById('active-context'),
            actions: document.getElementById('active-actions')
        };
    },

    bindEvents() {
        this.el.search.addEventListener('input', () => this.renderConversaciones());

        this.el.salonFilter.addEventListener('change', (e) => {
            this.selectedSalon = e.target.value || 'ALL';
            this.renderConversaciones();
        });

        this.el.roleTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.msg-role-tab');
            if (!btn) return;
            this.selectedRole = btn.dataset.role || 'ALL';
            this.el.roleTabs.querySelectorAll('.msg-role-tab').forEach(tab => {
                tab.classList.toggle('active', tab === btn);
            });
            this.renderConversaciones();
        });

        this.el.actions.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-open-contacto]');
            if (!btn) return;
            const id = btn.getAttribute('data-open-contacto');
            if (id) await this.abrirContactoPorId(id);
        });

        this.el.btnSend.addEventListener('click', () => this.enviarMensaje());
        this.el.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.enviarMensaje();
        });

        const oldRender = this.render;
        this.render = async () => {
            if (this.refreshInterval) clearInterval(this.refreshInterval);
            if (this.presenceInterval) clearInterval(this.presenceInterval);
            return await oldRender.call(this);
        };
    },

    async cargarBandeja() {
        try {
            const data = await API.fetch(`/api/mensajes/docente/${this.user.id}/bandeja`);
            this.bandeja = data.conversaciones || [];
            this.salones = data.salones || [];
            this.renderSalonesSelect();
            this.renderConversaciones();
        } catch (e) {
            console.error(e);
            this.el.convoList.innerHTML = '<p style="padding:20px;color:var(--red);text-align:center;">Error al cargar bandeja.</p>';
        }
    },

    getSalonKey(item) {
        if (item.contexto?.salonKey) return item.contexto.salonKey;
        const c = item.contacto;
        if (!c?.nivel || !c?.grado || !c?.seccion) return '';
        return `${c.nivel}|${c.grado}|${c.seccion}|${c.turno || ''}`.toLowerCase();
    },

    matchesSalon(item, salonKey) {
        if (salonKey === 'ALL') return true;
        if (this.getSalonKey(item) === salonKey) return true;
        const hijos = item.contexto?.hijos;
        return Array.isArray(hijos) && hijos.some(h => h.salonKey === salonKey);
    },

    renderSalonesSelect() {
        const sel = this.el.salonFilter;
        if (!sel) return;

        const counts = new Map();
        this.salones.forEach(s => {
            const count = this.bandeja.filter(item => this.matchesSalon(item, s.key)).length;
            counts.set(s.key, count);
        });

        const optionsHtml = [
            `<option value="ALL">Todos los salones (${this.bandeja.length})</option>`,
            ...this.salones.map(s => {
                const turno = s.turnoLabel ? ` · ${s.turnoLabel}` : '';
                const count = counts.get(s.key) || 0;
                return `<option value="${escapeHtml(s.key)}">${escapeHtml(s.label + turno)} (${count})</option>`;
            })
        ].join('');

        sel.innerHTML = optionsHtml;
        if (this.selectedSalon !== 'ALL' && !this.salones.some(s => s.key === this.selectedSalon)) {
            this.selectedSalon = 'ALL';
        }
        sel.value = this.selectedSalon;
    },

    updateRoleTabCounts(salonFiltered) {
        const counts = { ALL: salonFiltered.length, ESTUDIANTE: 0, PADRE: 0 };
        salonFiltered.forEach(item => {
            const meta = getRoleMeta(item.contacto, item.contexto);
            if (meta.filterKey === 'ESTUDIANTE') counts.ESTUDIANTE += 1;
            else if (meta.filterKey === 'PADRE') counts.PADRE += 1;
        });

        const labels = {
            ALL: `Todos (${counts.ALL})`,
            ESTUDIANTE: `Alumnos (${counts.ESTUDIANTE})`,
            PADRE: `Apoderados (${counts.PADRE})`
        };

        this.el.roleTabs?.querySelectorAll('.msg-role-tab').forEach(tab => {
            const key = tab.dataset.role;
            if (labels[key]) tab.textContent = labels[key];
        });
    },

    renderConversaciones() {
        const query = (this.el.search.value || '').trim().toLowerCase();

        const salonFiltered = this.bandeja.filter(item => this.matchesSalon(item, this.selectedSalon));
        this.updateRoleTabCounts(salonFiltered);

        let filtradas = salonFiltered;
        if (this.selectedRole !== 'ALL') {
            filtradas = filtradas.filter(item => getRoleMeta(item.contacto, item.contexto).filterKey === this.selectedRole);
        }

        if (query) {
            filtradas = filtradas.filter(item => {
                const c = item.contacto || {};
                const ctx = item.contexto || {};
                const hijosTxt = Array.isArray(ctx.hijos) ? ctx.hijos.map(h => `${h.nombreCompleto} ${h.salonLabel}`).join(' ') : '';
                const cursosTxt = Array.isArray(ctx.cursos) ? ctx.cursos.join(' ') : '';
                const haystack = `${c.nombres || ''} ${c.apellidos || ''} ${ctx.rolLabel || ''} ${ctx.salonLabel || ''} ${ctx.turnoLabel || ''} ${cursosTxt} ${hijosTxt}`.toLowerCase();
                return haystack.includes(query);
            });
        }

        if (this.el.countPill) {
            this.el.countPill.textContent = String(filtradas.length);
        }

        if (filtradas.length === 0) {
            this.el.convoList.innerHTML = '<div class="convo-empty">No se encontraron contactos con este filtro.</div>';
            return;
        }

        this.el.convoList.innerHTML = filtradas.map(item => {
            const c = item.contacto || {};
            const ctx = item.contexto || {};
            const fullName = `${c.nombres || ''} ${c.apellidos || ''}`.trim() || 'Usuario';
            const iniciales = (((c.nombres || '').charAt(0)) + ((c.apellidos || '').charAt(0))).toUpperCase() || '?';
            const isActive = this.activeContacto && String(this.activeContacto.id) === String(c.id);
            const noLeidos = item.noLeidos > 0 ? `<span class="convo-badge">${item.noLeidos}</span>` : '';

            const roleMeta = getRoleMeta(c, ctx);
            const salonShort = ctx.salonShort || buildFallbackSalonShort(c);
            const subcontext = buildSubcontextText(item);
            const previewText = item.tieneMensajes ? (item.preview || 'Mensaje') : 'Sin mensajes · Toca para escribir';

            let timeStr = '';
            if (item.fechaUltimoMensaje) {
                const d = new Date(item.fechaUltimoMensaje);
                const hoy = new Date();
                timeStr = d.toDateString() === hoy.toDateString()
                    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : d.toLocaleDateString();
            }

            return `
                <div class="convo-item ${isActive ? 'active' : ''}" data-id="${c.id}">
                    <div class="convo-avatar">${escapeHtml(iniciales)}</div>
                    <div class="convo-info">
                        <div class="convo-top">
                            <span class="convo-name">${escapeHtml(fullName)}</span>
                            ${timeStr ? `<span class="convo-time">${escapeHtml(timeStr)}</span>` : ''}
                        </div>
                        <div class="convo-context-row">
                            <span class="convo-role-pill ${roleMeta.cls}">${escapeHtml(roleMeta.text)}</span>
                            ${salonShort ? `<span class="convo-salon-pill"><i class="ph ph-chalkboard-teacher"></i> ${escapeHtml(salonShort)}</span>` : ''}
                            ${(() => {
                                const st = getPresenceInfo(c);
                                return `<span class="docente-presence is-${st.state}" title="${escapeHtml(st.title || st.label)}"><span class="presence-dot"></span><span>${escapeHtml(st.shortLabel)}</span></span>`;
                            })()}
                        </div>
                        ${subcontext ? `<div class="convo-subcontext">${escapeHtml(subcontext)}</div>` : ''}
                        <div class="convo-bottom">
                            <span class="convo-preview ${item.tieneMensajes ? '' : 'is-empty'}">${escapeHtml(previewText)}</span>
                            ${noLeidos}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.el.convoList.querySelectorAll('.convo-item').forEach(node => {
            node.addEventListener('click', () => {
                const id = node.getAttribute('data-id');
                const item = this.bandeja.find(x => String(x.contacto?.id) === String(id));
                if (item) this.abrirConversacion(item.contacto, item.contexto || null);
            });
        });
    },

    renderActiveHeaderContext(contacto, ctx) {
        const roleMeta = getRoleMeta(contacto, ctx);
        const salonLabel = ctx?.salonLabel || buildFallbackSalonLabel(contacto);
        const turnoLabel = ctx?.turnoLabel || '';
        const salonDisplay = salonLabel ? (turnoLabel ? `${salonLabel} · ${turnoLabel}` : salonLabel) : '';
        const st = getPresenceInfo(contacto);

        this.el.pills.innerHTML = `
            <span class="convo-role-pill ${roleMeta.cls}">${escapeHtml(roleMeta.text)}</span>
            ${salonDisplay ? `<span class="convo-salon-pill"><i class="ph ph-chalkboard-teacher"></i> ${escapeHtml(salonDisplay)}</span>` : ''}
            <span class="docente-presence is-${st.state}" id="active-status" title="${escapeHtml(st.title || st.label)}"><span class="presence-dot"></span><span>${escapeHtml(st.label)}</span></span>
        `;

        const lines = [];
        const rol = String(ctx?.rol || contacto?.rol || '').toUpperCase();
        const cursos = Array.isArray(ctx?.cursos) ? ctx.cursos : [];

        if (rol === 'PADRE') {
            const hijos = Array.isArray(ctx?.hijos) ? ctx.hijos : [];
            if (hijos.length > 0) {
                const visibles = hijos.slice(0, 3).map(h => {
                    const sal = h.salonShort ? ` (${escapeHtml(h.salonShort)})` : '';
                    return `<a href="#/estudiante-perfil?id=${encodeURIComponent(h.id)}&from=mensajes" class="chat-header-inline-link">${escapeHtml(h.nombreCompleto)}${sal}</a>`;
                }).join(', ');
                const extra = hijos.length > 3 ? ` y <strong>${hijos.length - 3} alumnos más</strong> del salón` : '';
                lines.push(`<span>Apoderado de: ${visibles}${extra}</span>`);
            }
            if (cursos.length > 0) {
                lines.push(`<span>Cursos contigo: <strong>${escapeHtml(cursos.join(', '))}</strong></span>`);
            }
        } else if (rol === 'ESTUDIANTE') {
            if (cursos.length > 0) {
                lines.push(`<span>Cursos contigo: <strong>${escapeHtml(cursos.join(', '))}</strong></span>`);
            }
            if (ctx?.apoderado?.nombre) {
                lines.push(`<span>Apoderado: <strong>${escapeHtml(ctx.apoderado.nombre)}</strong></span>`);
            }
        }

        this.el.context.innerHTML = lines.join('');

        const actionBtns = [];
        if (rol === 'ESTUDIANTE' && contacto?.id) {
            actionBtns.push(`<a href="#/estudiante-perfil?id=${encodeURIComponent(contacto.id)}&from=mensajes" class="chat-header-btn"><i class="ph ph-identification-card"></i><span>Ver ficha</span></a>`);
            if (ctx?.apoderado?.id) {
                actionBtns.push(`<button type="button" class="chat-header-btn is-subtle" data-open-contacto="${escapeHtml(ctx.apoderado.id)}"><i class="ph ph-users"></i><span>Escribir a apoderado</span></button>`);
            }
        }
        this.el.actions.innerHTML = actionBtns.join('');
    },

    async abrirConversacion(contacto, contexto = null) {
        this.activeContacto = contacto;
        this.activeContexto = contexto;

        this.el.noChat.style.display = 'none';
        this.el.chatActive.style.display = 'flex';
        this.el.avatar.textContent = (((contacto.nombres || '').charAt(0)) + ((contacto.apellidos || '').charAt(0))).toUpperCase() || '?';
        this.el.name.textContent = `${contacto.nombres || ''} ${contacto.apellidos || ''}`.trim();
        this.renderActiveHeaderContext(contacto, contexto);

        this.renderConversaciones();

        if (this.refreshInterval) clearInterval(this.refreshInterval);
        await this.cargarMensajes(true);

        this.refreshInterval = setInterval(() => {
            if (this.activeContacto && document.getElementById('chat-messages')) {
                this.cargarMensajes(false);
            } else if (!document.getElementById('chat-messages')) {
                clearInterval(this.refreshInterval);
            }
        }, 5000);
    },

    async cargarMensajes(scroll = true) {
        if (!this.activeContacto) return;

        try {
            const data = await API.fetch(`/api/mensajes/docente/${this.user.id}/conversacion/${this.activeContacto.id}`);
            if (data.contacto) {
                this.activeContacto = { ...this.activeContacto, ...data.contacto };
            }
            if (data.contexto || data.contacto) {
                this.activeContexto = data.contexto || this.activeContexto;
                this.renderActiveHeaderContext(this.activeContacto, this.activeContexto);
                const item = this.bandeja.find(x => String(x.contacto?.id) === String(this.activeContacto.id));
                if (item) {
                    const prevUltima = item.contacto?.ultimaConexion || '';
                    const nextUltima = data.contacto?.ultimaConexion || '';
                    if (data.contacto) item.contacto = { ...item.contacto, ...data.contacto };
                    const needSidebarRefresh = Boolean(data.contexto && !item.contexto) || prevUltima !== nextUltima;
                    if (data.contexto && !item.contexto) item.contexto = data.contexto;
                    if (needSidebarRefresh) this.renderConversaciones();
                }
            }

            const mensajes = data.mensajes || [];
            if (mensajes.length === 0) {
                this.el.chatMessages.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-tertiary);">No hay mensajes aún. ¡Escribe algo!</div>';
                return;
            }

            let currentDay = '';
            let html = '';

            mensajes.forEach(msg => {
                const fecha = new Date(msg.fechaEnvio);
                const dayStr = fecha.toLocaleDateString();
                if (dayStr !== currentDay) {
                    currentDay = dayStr;
                    html += `<div style="text-align:center; margin: 15px 0;"><span style="background:var(--border-color-light); padding:4px 12px; border-radius:12px; font-size:11px; color:var(--text-secondary);">${escapeHtml(currentDay)}</span></div>`;
                }

                const esMio = String(msg.remitente?.id) === String(this.user.id);
                const cls = esMio ? 'mine' : 'theirs';
                const time = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const init = esMio
                    ? (((this.user.nombres || '').charAt(0)) + ((this.user.apellidos || '').charAt(0))).toUpperCase()
                    : (((this.activeContacto.nombres || '').charAt(0)) + ((this.activeContacto.apellidos || '').charAt(0))).toUpperCase();

                const adjuntoHtml = msg.archivoUrl
                    ? `<a href="${escapeHtml(msg.archivoUrl)}" target="_blank" class="msg-attachment-link"><i class="ph ph-paperclip"></i> Ver archivo adjunto</a>`
                    : '';

                html += `
                    <div class="msg-row ${cls}">
                        ${!esMio ? `<div class="msg-avatar-inline">${escapeHtml(init)}</div>` : ''}
                        <div class="msg-bubble ${esMio ? 'msg-sent' : 'msg-received'}">
                            ${msg.contenido ? `<div>${formatMessageText(msg.contenido)}</div>` : ''}
                            ${adjuntoHtml}
                            <span class="msg-time">${escapeHtml(time)}</span>
                        </div>
                    </div>
                `;
            });

            const scrollBefore = this.el.chatMessages.scrollHeight - this.el.chatMessages.scrollTop;
            this.el.chatMessages.innerHTML = html;

            if (scroll) {
                this.el.chatMessages.scrollTop = this.el.chatMessages.scrollHeight;
            } else {
                this.el.chatMessages.scrollTop = this.el.chatMessages.scrollHeight - scrollBefore;
            }
        } catch (e) {
            console.error(e);
        }
    },

    async enviarMensaje() {
        const text = this.el.chatInput.value.trim();
        if (!text || !this.activeContacto) return;

        this.el.btnSend.disabled = true;
        this.el.chatInput.disabled = true;

        try {
            const fd = new FormData();
            fd.append('remitenteId', this.user.id);
            fd.append('destinatarioId', this.activeContacto.id);
            fd.append('contenido', text);

            await API.fetch('/api/mensajes/enviar', {
                method: 'POST',
                body: fd
            });

            this.el.chatInput.value = '';
            await this.cargarMensajes(true);
            await this.cargarBandeja();
        } catch (e) {
            console.error('Error enviando:', e);
            alert('No se pudo enviar el mensaje.');
        } finally {
            this.el.btnSend.disabled = false;
            this.el.chatInput.disabled = false;
            this.el.chatInput.focus();
        }
    }
};
