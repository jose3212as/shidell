// Script to copy needed Phosphor SVGs to the project icons folder
const fs = require('fs');
const path = require('path');

const SOURCE_BASE = path.join(__dirname, 'node_modules', '@phosphor-icons', 'core', 'assets');
const DEST_BASE = path.join(__dirname, 'src', 'main', 'resources', 'static', 'plataformaestudiante', 'icons');

const regularIcons = [
    'alarm', 'arrow-right', 'arrow-up', 'bell', 'bell-ringing', 'bell-slash',
    'book-open', 'books', 'calendar-blank', 'calendar-check', 'calendar-dots',
    'calendar-x', 'caret-down', 'caret-left', 'caret-right', 'chalkboard-teacher',
    'chart-line-up', 'chat-centered-text', 'chat-circle', 'chat-circle-dots',
    'chat-teardrop-dots', 'chats-circle', 'check', 'check-circle', 'check-square',
    'checks', 'circle-notch', 'clipboard-text', 'clock', 'database',
    'dots-three-vertical', 'download-simple', 'exam', 'faders', 'file',
    'file-arrow-down', 'file-text', 'flag', 'folder-open', 'gear',
    'graduation-cap', 'house', 'identification-card', 'lifebuoy', 'lock-key',
    'magnifying-glass', 'medal', 'megaphone', 'monitor', 'paper-plane-tilt',
    'paperclip', 'pencil-simple', 'plus', 'printer', 'seal-question',
    'shield-check', 'sign-out', 'spinner', 'star', 'target', 'trash',
    'trend-up', 'trophy', 'upload-simple', 'user-circle', 'warning',
    'warning-circle', 'x'
];

const fillIcons = [
    'book-open', 'chart-line-up', 'clipboard-text', 'graduation-cap',
    'medal', 'paper-plane-right', 'target', 'trophy', 'user', 'user-circle'
];

// Create directories
const regularDir = path.join(DEST_BASE, 'regular');
const fillDir = path.join(DEST_BASE, 'fill');
fs.mkdirSync(regularDir, { recursive: true });
fs.mkdirSync(fillDir, { recursive: true });

let copied = 0;
let failed = 0;

// Copy regular icons
for (const name of regularIcons) {
    const src = path.join(SOURCE_BASE, 'regular', `${name}.svg`);
    const dest = path.join(regularDir, `${name}.svg`);
    try {
        let content = fs.readFileSync(src, 'utf8');
        content = content.replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="currentColor"');
        fs.writeFileSync(dest, content);
        copied++;
    } catch (e) {
        console.error(`FAILED regular/${name}: ${e.message}`);
        failed++;
    }
}

// Copy fill icons
for (const name of fillIcons) {
    const src = path.join(SOURCE_BASE, 'fill', `${name}-fill.svg`);
    const dest = path.join(fillDir, `${name}.svg`);
    try {
        let content = fs.readFileSync(src, 'utf8');
        content = content.replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="currentColor"');
        fs.writeFileSync(dest, content);
        copied++;
    } catch (e) {
        console.error(`FAILED fill/${name}: ${e.message}`);
        failed++;
    }
}

console.log(`\nDone! Copied: ${copied}, Failed: ${failed}`);
console.log(`Regular icons: ${regularIcons.length}`);
console.log(`Fill icons: ${fillIcons.length}`);
