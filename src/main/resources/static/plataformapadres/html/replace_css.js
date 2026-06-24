const fs = require('fs');

const file = 'c:/Users/carlo/Desktop/proyectoshidel/shidell/src/main/resources/static/plataformapadres/html/configuracion.html';
let content = fs.readFileSync(file, 'utf8');

const oldCss = `<style>
        .config-card { background: white; border-radius: 20px; padding: 32px; border: 1px solid var(--border-color-dark); }
        .config-section { margin-bottom: 32px; }
        .config-section h3 { font-size: 16px; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .config-field { margin-bottom: 18px; }
        .config-field label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
        .config-field input { width: 100%; padding: 12px 16px; border: 1px solid var(--border-color-dark); border-radius: 12px; font-size: 14px; outline: none; transition: 0.2s; }
        .config-field input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
        .config-field input[readonly] { background: var(--bg-main); color: var(--text-secondary); }
        .btn-save { background: var(--primary); color: white; border: none; padding: 12px 32px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-save:hover { background: var(--primary-hover); transform: translateY(-1px); }
        .profile-banner { background: linear-gradient(135deg, var(--primary), #0f766e); border-radius: 20px; padding: 32px; display: flex; align-items: center; gap: 24px; color: white; margin-bottom: 24px; }
        .profile-avatar-big { width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 700; border: 3px solid rgba(255,255,255,0.4); }
        .profile-avatar-big img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .photo-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
        .btn-photo { border: 1px solid rgba(255,255,255,0.45); background: rgba(255,255,255,0.12); color: white; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .btn-photo:hover { background: rgba(255,255,255,0.2); }
        .btn-photo.danger { border-color: rgba(254,226,226,0.65); color: #fee2e2; }
        .save-status { font-size: 13px; font-weight: 600; color: var(--text-secondary); align-self: center; }
    </style>`;

const newCss = `<style>
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

content = content.replace(oldCss, newCss);
fs.writeFileSync(file, content);
console.log('CSS replaced successfully');
