const fs = require('fs');

const fileEst = 'c:/Users/carlo/Desktop/proyectoshidel/shidell/src/main/resources/static/plataformaestudiante/html/mensajes.html';
const filePadre = 'c:/Users/carlo/Desktop/proyectoshidel/shidell/src/main/resources/static/plataformapadres/html/mensajes.html';

const contentEst = fs.readFileSync(fileEst, 'utf8');
let contentPadre = fs.readFileSync(filePadre, 'utf8');

const styleRegex = /<style>[\s\S]*?<\/style>/;
const estStyle = contentEst.match(styleRegex)[0];
contentPadre = contentPadre.replace(styleRegex, estStyle);

const contentAreaRegex = /<div class="content-area"[^>]*>[\s\S]*?<\/main>/;
const estContentAreaMatch = contentEst.match(/<div class="content-area"[^>]*>[\s\S]*?<\/main>/);
if (estContentAreaMatch) {
    let estInner = estContentAreaMatch[0];
    
    // Inject preview IDs
    const oldPreview = `<div id="file-preview" style="display:none; padding: 12px 32px; background: #f8fafc; font-size: 13px; color: var(--primary); border-top: 1px solid var(--border-color-dark); align-items: center; gap: 8px;">
                                <i class="ph ph-file-text" style="font-size: 20px;"></i>
                                <span id="file-name-preview" style="flex: 1; font-weight: 500;"></span>
                                <i class="ph ph-x" style="cursor:pointer; font-size: 18px; color: var(--text-tertiary);" id="cancel-file"></i>
                            </div>`;
    const newPreview = `<div id="file-preview" style="display:none; padding: 12px 32px; background: #f8fafc; font-size: 13px; color: var(--primary); border-top: 1px solid var(--border-color-dark); align-items: center; gap: 8px;">
                                <img id="image-preview" src="" alt="preview" style="display:none; height:40px; border-radius:6px; object-fit:cover; margin-right:10px;">
                                <i class="ph ph-file-text" id="icon-preview" style="font-size: 20px;"></i>
                                <span id="file-name-preview" style="flex: 1; font-weight: 500;"></span>
                                <i class="ph ph-x" style="cursor:pointer; font-size: 18px; color: var(--text-tertiary);" id="cancel-file"></i>
                            </div>`;
    estInner = estInner.replace(oldPreview, newPreview);
    
    contentPadre = contentPadre.replace(contentAreaRegex, estInner);
}

const overlayRegex = /<div class="overlay" id="contacts-modal">[\s\S]*?<\/div>\s*<\/div>/;
const overlayMatch = contentEst.match(/<div class="overlay" id="contacts-modal">[\s\S]*?<\/div>\s*<\/div>/);
if (overlayMatch) {
    contentPadre = contentPadre.replace(overlayRegex, overlayMatch[0]);
}

fs.writeFileSync(filePadre, contentPadre);
console.log("Upgraded mensajes.html for Padres successfully.");
