/**
 * icon-helper.js — Utilidad para reemplazar Phosphor Icons CSS por imágenes SVG.
 *
 * Soporta nombres de íconos directos ('calculator'), prefijados ('ph-calculator'),
 * cadenas con múltiples clases ('ph ph-calculator') e imágenes devueltas por la API Backend.
 */

(function (window) {
    'use strict';

    const ICON_BASE = '../icons';
    const FALLBACK_ICON = `${ICON_BASE}/regular/book-open.svg`;

    /**
     * Extrae el nombre limpio del ícono a partir de cualquier formato.
     */
    function extractIconName(phClass) {
        if (!phClass) return 'book-open';
        let str = String(phClass).trim();

        // Si contiene varias clases separadas por espacio (ej: "ph ph-calculator" o "ph-fill ph-book-open")
        if (str.includes(' ')) {
            const parts = str.split(/\s+/);
            for (const p of parts) {
                if (p !== 'ph' && p !== 'ph-fill') {
                    const clean = p.replace(/^ph-/, '');
                    if (clean) return clean;
                }
            }
        }

        let name = str.replace(/^ph-/, '');
        return name || 'book-open';
    }

    /**
     * Construye la ruta al archivo SVG local.
     */
    function getIconPath(iconName, weight) {
        if (!iconName) return FALLBACK_ICON;
        // Si ya es una URL/ruta completa (ej: http://... o /uploads/...)
        if (iconName.includes('/') || iconName.startsWith('data:')) {
            return iconName;
        }
        weight = weight || 'regular';
        return `${ICON_BASE}/${weight}/${iconName}.svg`;
    }

    /**
     * Genera la etiqueta HTML <img> para un ícono con manejo de fallback onerror.
     */
    function iconImg(phClass, weight, extraStyle, extraClass) {
        if (phClass && (phClass.includes('/') || phClass.startsWith('data:'))) {
            const cls = 'icon-img' + (extraClass ? ' ' + extraClass : '');
            const style = extraStyle ? ` style="${extraStyle}"` : '';
            return `<img src="${phClass}" class="${cls}" alt="icon"${style} onerror="this.onerror=null;this.src='${FALLBACK_ICON}';">`;
        }

        const name = extractIconName(phClass);
        const w = weight || 'regular';
        const path = getIconPath(name, w);
        const cls = 'icon-img' + (extraClass ? ' ' + extraClass : '');
        const style = extraStyle ? ` style="${extraStyle}"` : '';
        return `<img src="${path}" class="${cls}" alt="${name}"${style} onerror="this.onerror=null;this.src='${FALLBACK_ICON}';">`;
    }

    /**
     * Parsea una cadena de clases Phosphor completa y genera el <img> correspondiente.
     */
    function iconFromClass(classString, extraStyle) {
        if (!classString) return iconImg('book-open');

        const classes = String(classString).trim().split(/\s+/);
        let weight = 'regular';
        let iconName = '';
        const extraClasses = [];

        for (const cls of classes) {
            if (cls === 'ph-fill') {
                weight = 'fill';
            } else if (cls === 'ph') {
                // prefijo general
            } else if (cls.startsWith('ph-')) {
                iconName = cls.replace(/^ph-/, '');
            } else {
                extraClasses.push(cls);
            }
        }

        if (!iconName) iconName = extractIconName(classString);

        const path = getIconPath(iconName, weight);
        const cls = 'icon-img' + (extraClasses.length ? ' ' + extraClasses.join(' ') : '');
        const style = extraStyle ? ` style="${extraStyle}"` : '';
        return `<img src="${path}" class="${cls}" alt="${iconName}"${style} onerror="this.onerror=null;this.src='${FALLBACK_ICON}';">`;
    }

    window.iconImg = iconImg;
    window.iconFromClass = iconFromClass;
    window.getIconPath = getIconPath;
    window.extractIconName = extractIconName;

})(window);
