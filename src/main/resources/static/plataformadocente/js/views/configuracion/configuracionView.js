import { Auth } from '../../services/auth.js';
import { API } from '../../services/api.js';

export const ConfiguracionView = {
    user: null,
    vistaActual: 'perfil',

    async render() {
        this.user = Auth.getUser();
        
        return `
            <div class="content-header" style="margin-bottom:20px;">
                <div>
                    <h2>Configuración</h2>
                    <p>Gestiona tu perfil, seguridad y cuenta.</p>
                </div>
            </div>

            <div class="settings-page">
                <nav class="settings-menu" aria-label="Menu de configuracion">
                    <button type="button" class="settings-tab ${this.vistaActual === 'perfil' ? 'active' : ''}" data-view="perfil">
                        <i class="ph-fill ph-user"></i><span>Mi perfil</span>
                    </button>
                    <button type="button" class="settings-tab ${this.vistaActual === 'seguridad' ? 'active' : ''}" data-view="seguridad">
                        <i class="ph ph-lock-key"></i><span>Seguridad</span>
                    </button>
                </nav>

                <section id="settings-view" class="settings-view">
                    ${this.renderVistaActual()}
                </section>
            </div>
        `;
    },

    renderVistaActual() {
        const defaultAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.user.nombres + ' ' + this.user.apellidos) + '&background=2563eb&color=fff';
        let photoUrl = defaultAvatar;
        if (this.user.fotoPerfil) {
            photoUrl = (this.user.fotoPerfil.startsWith('/') || this.user.fotoPerfil.startsWith('http')) 
                ? this.user.fotoPerfil 
                : '/uploads/perfiles/' + this.user.fotoPerfil;
        }
        
        const iniciales = (this.user.nombres.charAt(0) + this.user.apellidos.charAt(0)).toUpperCase();

        if (this.vistaActual === 'perfil') {
            return `
                <div class="settings-section">
                    <div class="settings-header">
                        <div>
                            <span class="settings-kicker">Tu identidad</span>
                            <h2>Mi perfil</h2>
                        </div>
                    </div>

                    <div class="profile-summary">
                        <div class="profile-initials">
                            ${this.user.fotoPerfil ? `<img src="${photoUrl}" style="width:100%;height:100%;border-radius:22px;object-fit:cover;">` : iniciales}
                        </div>
                        <div class="profile-info-basic">
                            <h3>${this.user.nombres} ${this.user.apellidos}</h3>
                            <p>${this.user.email}</p>
                            <div class="profile-badges">
                                <span class="profile-badge badge-primary"><i class="ph-fill ph-star"></i> Docente</span>
                            </div>
                        </div>
                    </div>

                    <form id="form-perfil" class="settings-form">
                        <div class="photo-uploader">
                            <div class="photo-preview" id="cfg-foto-preview">
                                ${this.user.fotoPerfil ? `<img src="${photoUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '<i class="ph-fill ph-user"></i>'}
                            </div>
                            <div class="photo-actions">
                                <strong>Foto de perfil</strong>
                                <span>Sube una imagen JPG o PNG.</span>
                                <div class="photo-buttons">
                                    <label class="btn-secondary-settings" for="cfg-foto"><i class="ph ph-upload-simple"></i> Subir foto</label>
                                </div>
                                <input id="cfg-foto" type="file" accept="image/png,image/jpeg" style="display:none;">
                            </div>
                        </div>
                        
                        <div class="form-grid">
                            <label>Nombres<input id="cfg-nombres" type="text" value="${this.user.nombres}" required></label>
                            <label>Apellidos<input id="cfg-apellidos" type="text" value="${this.user.apellidos}" required></label>
                        </div>
                        <label>Correo Electrónico (Solo Lectura)<input type="email" value="${this.user.email}" disabled></label>
                        
                        <div class="modal-actions" style="margin-top:20px; display:flex; justify-content:flex-end;">
                            <button class="btn-primary-settings" type="submit" id="btn-save-perfil">Guardar cambios</button>
                        </div>
                    </form>
                </div>
            `;
        }

        if (this.vistaActual === 'seguridad') {
            return `
                <div class="settings-section">
                    <div class="settings-header">
                        <div>
                            <span class="settings-kicker">Protección</span>
                            <h2>Seguridad</h2>
                        </div>
                    </div>

                    <div class="security-card">
                        <div class="security-card-icon"><i class="ph ph-lock-key"></i></div>
                        <div class="security-card-content">
                            <h4>Contraseña de acceso</h4>
                            <p>Actualiza tu contraseña para mantener tu cuenta segura.</p>
                        </div>
                    </div>

                    <form id="form-password" class="settings-form" style="margin-top:25px;">
                        <div class="form-grid">
                            <label>Nueva Contraseña<input id="cfg-pass1" type="password" placeholder="Mínimo 6 caracteres" minlength="6" required></label>
                            <label>Confirmar Contraseña<input id="cfg-pass2" type="password" placeholder="Repite la contraseña" minlength="6" required></label>
                        </div>
                        <div class="modal-actions" style="margin-top:20px; display:flex; justify-content:flex-end;">
                            <button class="btn-primary-settings" type="submit" id="btn-save-pass">Actualizar Contraseña</button>
                        </div>
                    </form>
                </div>
            `;
        }
    },

    afterRender() {
        this.bindEvents();
    },

    bindEvents() {
        // Pestañas
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.vistaActual = tab.dataset.view;
                
                document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                document.getElementById('settings-view').innerHTML = this.renderVistaActual();
                this.bindFormEvents();
            });
        });

        this.bindFormEvents();
    },

    bindFormEvents() {
        // Formularios y subida de fotos
        const fotoInput = document.getElementById('cfg-foto');
        if (fotoInput) {
            fotoInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const preview = document.getElementById('cfg-foto-preview');
                preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;

                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const response = await fetch(`/api/users/${this.user.id}/foto-perfil`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${Auth.getToken()}`
                        },
                        body: formData
                    });
                    if (response.ok) {
                        const updatedUser = await response.json();
                        Auth.setUser(updatedUser);
                        Swal.fire('¡Éxito!', 'Foto de perfil actualizada.', 'success').then(() => window.location.reload());
                    } else {
                        const errText = await response.text();
                        throw new Error(`Error ${response.status}: ${errText}`);
                    }
                } catch (err) {
                    Swal.fire('Error detallado', err.message, 'error');
                }
            });
        }

        const formPerfil = document.getElementById('form-perfil');
        if (formPerfil) {
            formPerfil.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btn-save-perfil');
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
                btn.disabled = true;

                try {
                    const payload = {
                        nombres: document.getElementById('cfg-nombres').value.trim(),
                        apellidos: document.getElementById('cfg-apellidos').value.trim()
                    };
                    const updatedUser = await API.fetch(`/api/users/${this.user.id}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    Auth.setUser(updatedUser);
                    Swal.fire({ title: '¡Guardado!', icon: 'success', timer: 1500, showConfirmButton: false }).then(() => window.location.reload());
                } catch (err) {
                    Swal.fire('Error', 'No se pudo actualizar tu perfil.', 'error');
                } finally {
                    btn.innerHTML = 'Guardar cambios';
                    btn.disabled = false;
                }
            });
        }

        const formPass = document.getElementById('form-password');
        if (formPass) {
            formPass.addEventListener('submit', async (e) => {
                e.preventDefault();
                const pass1 = document.getElementById('cfg-pass1').value;
                const pass2 = document.getElementById('cfg-pass2').value;

                if (pass1 !== pass2) {
                    Swal.fire('Atención', 'Las contraseñas no coinciden.', 'warning');
                    return;
                }

                const btn = document.getElementById('btn-save-pass');
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
                btn.disabled = true;

                try {
                    await API.fetch(`/api/users/${this.user.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ password: pass1 })
                    });
                    Swal.fire('¡Éxito!', 'Contraseña actualizada.', 'success');
                    formPass.reset();
                } catch (err) {
                    Swal.fire('Error', 'No se pudo actualizar la contraseña.', 'error');
                } finally {
                    btn.innerHTML = 'Actualizar Contraseña';
                    btn.disabled = false;
                }
            });
        }
    }
};
