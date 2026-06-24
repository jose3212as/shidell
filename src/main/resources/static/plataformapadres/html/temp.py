import os, re
dir_path = r'c:\Users\carlo\Desktop\proyectoshidel\shidell\src\main\resources\static\plataformapadres\html'

new_block = '''                <div class="top-user-info" style="cursor:pointer;">
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
                </div>'''

for filename in os.listdir(dir_path):
    if filename.endswith('.html') and filename != 'portalpadres.html' and filename != 'asistencia.html':
        filepath = os.path.join(dir_path, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the block from <div class="top-user-info"> to the closing </div> of that block
        # The block is usually followed by </div> </div> for topbar-actions and header
        # So it's safe to just replace until </div>\s*</div>
        
        content = re.sub(r'<div class="top-user-info">.*?</div>\s*</div>', new_block + '\n            </div>', content, flags=re.DOTALL)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
