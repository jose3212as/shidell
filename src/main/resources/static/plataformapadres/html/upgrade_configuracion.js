const fs = require('fs');

const file = 'c:/Users/carlo/Desktop/proyectoshidel/shidell/src/main/resources/static/plataformapadres/html/configuracion.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Upgrade CSS
const oldCssRegex = /<style>[\s\S]*?<\/style>/;
const newCss = `<style>
        .config-wrapper { display: flex; flex-direction: column; gap: 24px; }
        .config-card { background: white; border-radius: 24px; padding: 40px; border: 1px solid var(--border-color-light); box-shadow: 0 10px 40px rgba(0,0,0,0.03); }
        .config-section { margin-bottom: 40px; }
        .config-section:last-child { margin-bottom: 0; }
        .config-section h3 { font-size: 18px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; color: var(--text-primary); border-bottom: 1px solid var(--border-color-light); padding-bottom: 12px; }
        .config-section h3 i { color: var(--primary); font-size: 22px; padding: 8px; background: var(--teal-light); border-radius: 10px; }
        .config-field { margin-bottom: 20px; }
        .config-field label { display: block; font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px; }
        .config-field input { width: 100%; padding: 14px 18px; border: 1px solid var(--border-color-dark); border-radius: 14px; font-size: 15px; outline: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: var(--bg-main); color: var(--text-primary); }
        .config-field input:focus { border-color: var(--primary); background: white; box-shadow: 0 4px 20px rgba(13,148,136,0.1); transform: translateY(-1px); }
        .config-field input[readonly] { background: var(--bg-surface); color: var(--text-secondary); opacity: 0.8; cursor: not-allowed; border-color: transparent; }
        
        .btn-save { background: linear-gradient(135deg, var(--primary), #0f766e); color: white; border: none; padding: 14px 36px; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 8px 20px rgba(13,148,136,0.25); display: inline-flex; align-items: center; gap: 8px; }
        .btn-save:hover { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(13,148,136,0.35); }
        .btn-save i { font-size: 20px; }
        
        .btn-cancel { padding: 14px 32px; border: 1px solid var(--border-color-dark); border-radius: 14px; background: white; cursor: pointer; font-size: 15px; font-weight: 600; color: var(--text-secondary); transition: all 0.3s ease; }
        .btn-cancel:hover { background: var(--bg-surface); color: var(--text-primary); transform: translateY(-1px); }

        .profile-banner { position: relative; background: linear-gradient(135deg, #0d9488, #115e59); border-radius: 24px; padding: 40px; display: flex; align-items: center; gap: 32px; color: white; overflow: hidden; box-shadow: 0 15px 35px rgba(13,148,136,0.2); }
        .profile-banner::before { content: ''; position: absolute; top: -50%; left: -10%; width: 50%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); transform: rotate(30deg); }
        .profile-avatar-big { width: 100px; height: 100px; background: rgba(255,255,255,0.15); border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 700; border: 4px solid rgba(255,255,255,0.3); backdrop-filter: blur(10px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); position: relative; z-index: 1; }
        .profile-avatar-big img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .profile-banner-content { position: relative; z-index: 1; }
        
        .photo-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
        .btn-photo { border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 12px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; backdrop-filter: blur(8px); transition: all 0.3s ease; }
        .btn-photo:hover { background: rgba(255,255,255,0.25); transform: translateY(-1px); border-color: rgba(255,255,255,0.5); }
        .btn-photo.danger { border-color: rgba(254,226,226,0.3); color: #fca5a5; }
        .btn-photo.danger:hover { background: rgba(220,38,38,0.2); border-color: #ef4444; color: white; }
        
        .save-status { font-size: 14px; font-weight: 600; color: var(--text-secondary); align-self: center; opacity: 0; transition: 0.3s; }
        .save-status.show { opacity: 1; }
    </style>`;
content = content.replace(oldCssRegex, newCss);

// 2. Upgrade top-user-info
const newBlock = `                <div class="top-user-info" style="cursor:pointer;">
                    <div class="user-dropdown">
                        <div class="avatar" id="topbar-avatar"><i class="ph-fill ph-user-circle" style="font-size:32px;"></i></div>
                        <div class="user-info-text" style="display:flex; flex-direction:column; align-items:flex-start; margin-right:5px; text-align:left;">
                            <span class="user-name padre-nombre" id="topbar-name" style="font-size:14px; font-weight:700; color:var(--text-primary); line-height:1.2;">Padre</span>
                            <span id="topbar-role" style="font-size:12px; font-weight:500; color:var(--text-secondary); line-height:1.2;">Padre de Familia</span>
                        </div>
                        <i class="ph ph-caret-down dropdown-icon"></i>
                        <div class="dropdown-menu">
                            <a href="configuracion.html" class="dropdown-item">
                                <i class="ph ph-gear"></i><span>Configuración</span>
                            </a>
                            <a href="#" class="dropdown-item btn-logout">
                                <i class="ph ph-sign-out"></i><span>Cerrar sesión</span>
                            </a>
                        </div>
                    </div>
                </div>`;
content = content.replace(/<div class="top-user-info">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, newBlock + '\n            </div>\n');

// 3. Upgrade content-area
const oldContentAreaRegex = /<div class="content-area">[\s\S]*?<\/main>/;
const newContentArea = `<div class="content-area">
            <div class="config-wrapper">
                <!-- Banner del perfil -->
                <div class="profile-banner">
                    <div class="profile-avatar-big" id="perfil-avatar">??</div>
                    <div class="profile-banner-content">
                        <h2 class="padre-nombre" style="font-size:28px; font-weight:800; margin-bottom:6px;">Padre</h2>
                        <p style="opacity:0.9; font-size:15px;" id="perfil-email">—</p>
                        <p style="opacity:0.75; font-size:14px; margin-top:6px; font-weight:500;">Padre de Familia</p>
                        <div class="photo-actions">
                            <label class="btn-photo" for="cfg-foto">
                                <i class="ph ph-camera"></i> Cambiar foto
                            </label>
                            <button type="button" class="btn-photo danger" id="btn-quitar-foto">
                                <i class="ph ph-trash"></i> Quitar
                            </button>
                            <input type="file" id="cfg-foto" accept="image/png,image/jpeg,image/webp" hidden>
                        </div>
                    </div>
                </div>

                <div class="config-card">
                    <div class="config-section">
                        <h3><i class="ph-fill ph-user-circle"></i> Información personal</h3>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                            <div class="config-field">
                                <label>Nombres</label>
                                <input type="text" id="cfg-nombres" placeholder="Nombres">
                            </div>
                            <div class="config-field">
                                <label>Apellidos</label>
                                <input type="text" id="cfg-apellidos" placeholder="Apellidos">
                            </div>
                        </div>
                        <div class="config-field">
                            <label>Correo electrónico</label>
                            <input type="email" id="cfg-email" readonly>
                        </div>
                        <div class="config-field">
                            <label>Teléfono</label>
                            <input type="tel" id="cfg-telefono" placeholder="Ej: 987 654 321">
                        </div>
                    </div>

                    <div class="config-section">
                        <h3><i class="ph-fill ph-lock-key"></i> Seguridad</h3>
                        <div class="config-field">
                            <label>Contraseña actual</label>
                            <input type="password" id="cfg-pass-actual" placeholder="••••••••">
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                            <div class="config-field">
                                <label>Nueva contraseña</label>
                                <input type="password" id="cfg-pass-nueva" placeholder="••••••••">
                            </div>
                            <div class="config-field">
                                <label>Confirmar contraseña</label>
                                <input type="password" id="cfg-pass-confirm" placeholder="••••••••">
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; gap:16px; align-items:center; margin-top:24px;">
                        <button class="btn-save" onclick="guardarCambios()">
                            <i class="ph ph-floppy-disk"></i> Guardar cambios
                        </button>
                        <button class="btn-cancel" onclick="window.location.href='portalpadres.html'">
                            Cancelar
                        </button>
                        <span class="save-status" id="save-status"></span>
                    </div>
                </div>
            </div>
        </div>
    </main>`;
content = content.replace(oldContentAreaRegex, newContentArea);

fs.writeFileSync(file, content);
console.log("configuracion.html successfully upgraded.");
