import { Auth } from '../../services/auth.js';
import { API } from '../../services/api.js';

export const MensajesView = {
    async render() {
        return `
            <div class="content-header" style="margin-bottom:20px;">
                <div>
                    <h2>Mensajes</h2>
                    <p>Comunícate con tus estudiantes de forma directa.</p>
                </div>
            </div>

            <div class="messages-container">
                <!-- Panel Izquierdo -->
                <div class="contacts-sidebar">
                    <div class="contacts-header">
                        <h2>Bandeja</h2>
                        <div class="search-input-wrapper">
                            <i class="ph ph-magnifying-glass"></i>
                            <input type="text" id="chat-search" placeholder="Buscar contacto...">
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
                            <h3 id="active-name">Cargando...</h3>
                            <span id="active-role">Estudiante</span>
                        </div>
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
                    <p>Selecciona una conversación a la izquierda para empezar a chatear.</p>
                </div>
            </div>
        `;
    },

    async afterRender() {
        this.user = Auth.getUser();
        this.bandeja = [];
        this.activeContacto = null;
        this.refreshInterval = null;

        this.cacheElements();
        this.bindEvents();
        await this.cargarBandeja();
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
            avatar: document.getElementById('active-avatar'),
            name: document.getElementById('active-name'),
            role: document.getElementById('active-role')
        };
    },

    bindEvents() {
        this.el.search.addEventListener('input', () => this.renderConversaciones());
        
        this.el.btnSend.addEventListener('click', () => this.enviarMensaje());
        this.el.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.enviarMensaje();
        });

        // Limpiar polling al salir de la vista (simulado)
        const oldRender = this.render;
        this.render = async () => {
            if (this.refreshInterval) clearInterval(this.refreshInterval);
            return await oldRender.call(this);
        };
    },

    async cargarBandeja() {
        try {
            const data = await API.fetch(`/api/mensajes/docente/${this.user.id}/bandeja`);
            this.bandeja = data.conversaciones || [];
            this.renderConversaciones();
        } catch (e) {
            this.el.convoList.innerHTML = '<p style="padding:20px;color:red;text-align:center;">Error al cargar bandeja.</p>';
        }
    },

    renderConversaciones() {
        const query = this.el.search.value.toLowerCase();
        let filtradas = this.bandeja;
        
        if (query) {
            filtradas = filtradas.filter(item => {
                const nombre = item.contacto.nombres + ' ' + item.contacto.apellidos;
                return nombre.toLowerCase().includes(query);
            });
        }

        if (filtradas.length === 0) {
            this.el.convoList.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-secondary);">No hay conversaciones.</p>';
            return;
        }

        this.el.convoList.innerHTML = filtradas.map(item => {
            const c = item.contacto;
            const iniciales = (c.nombres.charAt(0) + c.apellidos.charAt(0)).toUpperCase();
            const isActive = this.activeContacto && this.activeContacto.id === c.id;
            const noLeidos = item.noLeidos > 0 ? `<span class="convo-badge">${item.noLeidos}</span>` : '';

            // Formatear hora (si es de hoy, mostrar hora. Si no, fecha)
            let timeStr = '';
            if (item.fechaUltimoMensaje) {
                const d = new Date(item.fechaUltimoMensaje);
                const hoy = new Date();
                if (d.toDateString() === hoy.toDateString()) {
                    timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                } else {
                    timeStr = d.toLocaleDateString();
                }
            }

            return `
                <div class="convo-item ${isActive ? 'active' : ''}" data-id="${c.id}">
                    <div class="convo-avatar">${iniciales}</div>
                    <div class="convo-info">
                        <div class="convo-meta">
                            <span class="convo-name">${c.nombres} ${c.apellidos}</span>
                            <span class="convo-time">${timeStr}</span>
                        </div>
                        <div class="convo-meta">
                            <span class="convo-preview">${item.preview || 'Nuevo chat'}</span>
                            ${noLeidos}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Adjuntar eventos
        this.el.convoList.querySelectorAll('.convo-item').forEach(node => {
            node.addEventListener('click', () => {
                const id = parseInt(node.getAttribute('data-id'));
                const item = this.bandeja.find(x => x.contacto.id === id);
                if (item) this.abrirConversacion(item.contacto);
            });
        });
    },

    async abrirConversacion(contacto) {
        this.activeContacto = contacto;
        
        // UI
        this.el.noChat.style.display = 'none';
        this.el.chatActive.style.display = 'flex';
        this.el.avatar.textContent = (contacto.nombres.charAt(0) + contacto.apellidos.charAt(0)).toUpperCase();
        this.el.name.textContent = `${contacto.nombres} ${contacto.apellidos}`;
        this.el.role.textContent = contacto.rol;
        
        this.renderConversaciones(); // Refresh to set 'active' class

        if (this.refreshInterval) clearInterval(this.refreshInterval);
        
        await this.cargarMensajes();
        
        // Auto refresh
        this.refreshInterval = setInterval(() => {
            if (this.activeContacto) this.cargarMensajes(false);
        }, 5000);
    },

    async cargarMensajes(scroll = true) {
        if (!this.activeContacto) return;
        
        try {
            const data = await API.fetch(`/api/mensajes/docente/${this.user.id}/conversacion/${this.activeContacto.id}`);
            const mensajes = data.mensajes || [];
            
            if (mensajes.length === 0) {
                this.el.chatMessages.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-tertiary);">No hay mensajes aún. ¡Escribe algo!</div>';
                return;
            }

            let currentDay = '';
            let html = '';

            mensajes.forEach(msg => {
                // Separador de fecha
                const fecha = new Date(msg.fechaEnvio);
                const dayStr = fecha.toLocaleDateString();
                if (dayStr !== currentDay) {
                    currentDay = dayStr;
                    html += `<div style="text-align:center; margin: 15px 0;"><span style="background:var(--border-color-light); padding:4px 12px; border-radius:12px; font-size:11px; color:var(--text-secondary);">${currentDay}</span></div>`;
                }

                const esMio = String(msg.remitente.id) === String(this.user.id);
                const cls = esMio ? 'mine' : 'theirs';
                const time = fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const init = esMio 
                    ? (this.user.nombres.charAt(0) + this.user.apellidos.charAt(0)).toUpperCase()
                    : (this.activeContacto.nombres.charAt(0) + this.activeContacto.apellidos.charAt(0)).toUpperCase();

                html += `
                    <div class="msg-row ${cls}">
                        ${!esMio ? `<div class="msg-avatar-inline">${init}</div>` : ''}
                        <div class="msg-bubble ${esMio ? 'msg-sent' : 'msg-received'}">
                            ${msg.contenido}
                            <span class="msg-time">${time}</span>
                        </div>
                    </div>
                `;
            });

            const scrollBefore = this.el.chatMessages.scrollHeight - this.el.chatMessages.scrollTop;
            this.el.chatMessages.innerHTML = html;
            
            if (scroll) {
                this.el.chatMessages.scrollTop = this.el.chatMessages.scrollHeight;
            } else {
                // Keep scroll position if not forced
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

            const res = await fetch('/api/mensajes/enviar', {
                method: 'POST',
                body: fd
            });

            if (!res.ok) throw new Error('Error al enviar');

            this.el.chatInput.value = '';
            await this.cargarMensajes(true);
            await this.cargarBandeja(); // Actualizar preview y fecha en bandeja

        } catch (e) {
            console.error("Error enviando:", e);
            alert("No se pudo enviar el mensaje.");
        } finally {
            this.el.btnSend.disabled = false;
            this.el.chatInput.disabled = false;
            this.el.chatInput.focus();
        }
    }
};
