const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/carlo/Desktop/proyectoshidel/shidell/src/main/resources/static/plataformapadres/html';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

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

files.forEach(file => {
    if (file === 'portalpadres.html' || file === 'asistencia.html') return;
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/<div class="top-user-info">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, newBlock + '\n            </div>\n');
    fs.writeFileSync(fullPath, content);
});
console.log('Replaced top-user-info in remaining HTML files.');
