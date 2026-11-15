import { API } from '../../services/api.js';
import { Auth } from '../../services/auth.js';
import { DocentePrefs } from '../../services/docentePrefs.js?v=20261114u';

const DIAS_SEMANA = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Domingo'
};

function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const COLOR_TOKENS = {
    cyan: 'var(--cyan, #06b6d4)',
    purple: 'var(--purple, #8b5cf6)',
    blue: 'var(--blue, #3b82f6)',
    green: 'var(--green, #10b981)',
    orange: 'var(--orange, #f97316)',
    yellow: 'var(--yellow, #eab308)',
    red: 'var(--red, #ef4444)',
    pink: '#ec4899'
};

function safeColor(color) {
    const raw = String(color || '').trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
    return COLOR_TOKENS[raw.toLowerCase()] || 'var(--primary)';
}

function safeImageUrl(url) {
    const raw = String(url || '').trim();
    if (!raw || /^javascript:/i.test(raw)) return '';
    return raw;
}

function getInitials(user) {
    const n = String(user?.nombres || 'D').trim();
    const a = String(user?.apellidos || '').trim();
    return `${n.charAt(0)}${a.charAt(0)}`.toUpperCase() || 'DO';
}

function formatDateTime(value) {
    if (!value) return 'Sesión actual';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sesión actual';
    return date.toLocaleString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatBirthDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function formatScope(user, courses) {
    const parts = [
        user?.nivel,
        user?.grado ? `${user.grado}°` : '',
        user?.seccion ? `Sección ${user.seccion}` : '',
        user?.turno
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
    if (Array.isArray(courses) && courses.length > 0) {
        const niveles = [...new Set(courses.map(item => item?.curso?.nivel || item?.nivel).filter(Boolean))];
        return niveles.length > 0
            ? `${niveles.join(', ')} · ${courses.length} curso${courses.length === 1 ? '' : 's'}`
            : `${courses.length} curso${courses.length === 1 ? '' : 's'} asignado${courses.length === 1 ? '' : 's'}`;
    }
    return 'Carga académica en consulta';
}

function parseMinutes(hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '').trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
}

function computeWeeklyHours(courseEntries) {
    let totalMinutes = 0;
    for (const entry of courseEntries) {
        const curso = entry?.curso || entry;
        const start = parseMinutes(curso?.horaInicio);
        const end = parseMinutes(curso?.horaFin);
        if (start !== null && end !== null && end > start) {
            totalMinutes += (end - start);
        }
    }
    if (totalMinutes <= 0) return 'Por horario';
    const hours = totalMinutes / 60;
    return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}

function normalizeCourseEntries(dashboardData, userCoursesFallback) {
    const isNotArchived = entry => {
        const c = entry?.curso || entry;
        return c && String(c.turno || '').toUpperCase() !== 'ARCHIVADO';
    };
    if (Array.isArray(dashboardData?.cursos)) {
        return dashboardData.cursos.filter(isNotArchived);
    }
    if (Array.isArray(userCoursesFallback)) {
        return userCoursesFallback
            .map(curso => ({ curso, alumnos: null, tareas: null }))
            .filter(isNotArchived);
    }
    return [];
}

function currentTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyThemeChoice(nextTheme) {
    const active = currentTheme();
    if (active === nextTheme) return;
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
        toggleBtn.click();
    } else {
        document.documentElement.dataset.theme = nextTheme;
        try {
            localStorage.setItem('shidell_docente_theme', nextTheme);
        } catch {
            // Ignorar si almacenamiento restringido
        }
        window.dispatchEvent(new CustomEvent('shidell:theme-changed', { detail: { theme: nextTheme } }));
    }
}

function syncTopbar(user) {
    if (!user) return;
    const nameEl = document.getElementById('topbar-name');
    if (nameEl) {
        const fullName = `${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'Docente';
        nameEl.textContent = fullName;
    }

    const avatarEl = document.getElementById('topbar-avatar');
    if (avatarEl) {
        const photoUrl = safeImageUrl(user.fotoPerfil);
        if (photoUrl) {
            const img = document.createElement('img');
            img.src = photoUrl;
            img.alt = 'Avatar';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = 'inherit';
            img.onerror = () => {
                avatarEl.textContent = getInitials(user);
            };
            avatarEl.replaceChildren(img);
        } else {
            avatarEl.textContent = getInitials(user);
        }
    }
}

function passwordStrength(pass) {
    if (!pass) return { pct: 0, color: 'transparent', label: 'Sin definir' };
    if (pass.length < 6) return { pct: 28, color: 'var(--red, #ef4444)', label: 'Muy corta (min. 6)' };
    let score = 1;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;
    if (score >= 3) return { pct: 100, color: 'var(--green, #10b981)', label: 'Segura' };
    return { pct: 62, color: 'var(--primary)', label: 'Aceptable' };
}

export const ConfiguracionView = {
    user: null,
    dashboard: null,
    courses: [],
    activeTab: 'perfil',
    isLoadingAcademic: false,
    feedback: null, // { tab, type: 'success'|'error'|'info', text }
    _boundThemeSync: false,

    async render() {
        this.user = Auth.getUser();
        this.feedback = null;

        if (!this.user) {
            return `<div class="cfg-empty">Debes iniciar sesión para acceder a tu configuración.</div>`;
        }

        if (!this._boundThemeSync) {
            this._boundThemeSync = true;
            window.addEventListener('shidell:theme-changed', () => {
                if (this.activeTab === 'portal' && document.getElementById('cfg-stage')) {
                    this.syncThemeButtons();
                }
            });
        }

        this.isLoadingAcademic = true;
        return `<div id="cfg-root" class="cfg-shell">${this.buildShellInnerHtml()}</div>`;
    },

    async afterRender(queryString) {
        const root = document.getElementById('cfg-root');
        if (!root || !this.user) return;

        if (queryString) {
            const params = new URLSearchParams(queryString);
            const tabParam = params.get('tab');
            if (['perfil', 'ficha', 'portal', 'seguridad'].includes(tabParam)) {
                this.activeTab = tabParam;
            }
        }

        this.renderShell(root);

        // Cargar perfil fresco y carga académica real en paralelo sin bloquear el primer pintado
        const [userRes, dashRes] = await Promise.allSettled([
            API.fetch(`/api/users/${this.user.id}`),
            API.fetch(`/api/docente/${this.user.id}/dashboard`)
        ]);

        // Verificar que seguimos en la vista de configuración antes de tocar DOM
        const currentRoot = document.getElementById('cfg-root');
        if (!currentRoot) return;

        if (userRes.status === 'fulfilled' && userRes.value) {
            this.user = {
                ...this.user,
                ...userRes.value,
                sessionToken: this.user.sessionToken
            };
            Auth.setUser(this.user);
            syncTopbar(this.user);
        }

        if (dashRes.status === 'fulfilled' && dashRes.value) {
            this.dashboard = dashRes.value;
            this.courses = normalizeCourseEntries(dashRes.value, []);
        } else {
            try {
                const fallbackCourses = await API.fetch(`/api/docente/${this.user.id}/cursos`);
                this.courses = normalizeCourseEntries(null, fallbackCourses);
            } catch {
                this.courses = [];
            }
        }

        this.isLoadingAcademic = false;

        // Si el docente ya empezó a escribir en Perfil, no pisar sus inputs; solo actualizar resumen / carga si corresponde
        const editingPerfil = this.activeTab === 'perfil'
            && document.activeElement
            && document.activeElement.closest('#cfg-perfil-form');
        if (!editingPerfil) {
            this.renderShell(currentRoot);
        }
    },

    buildShellInnerHtml() {
        const u = this.user || {};
        const fullName = `${u.nombres || ''} ${u.apellidos || ''}`.trim() || 'Docente';
        const initials = getInitials(u);
        const photoUrl = safeImageUrl(u.fotoPerfil);
        const scopeText = formatScope(u, this.courses);
        const courseCount = this.courses.length;

        const tabs = [
            {
                id: 'perfil',
                icon: 'ph-user-circle',
                title: 'Perfil y contacto',
                sub: 'Foto, nombre y teléfono'
            },
            {
                id: 'ficha',
                icon: 'ph-identification-badge',
                title: 'Ficha y carga académica',
                sub: 'Plaza, DNI y tus aulas'
            },
            {
                id: 'portal',
                icon: 'ph-sliders-horizontal',
                title: 'Portal y enseñanza',
                sub: 'Tema, inicio y avisos'
            },
            {
                id: 'seguridad',
                icon: 'ph-shield-check',
                title: 'Seguridad y sesión',
                sub: 'Contraseña y acceso'
            }
        ];

        return `
            <header class="cfg-identity">
                <div class="cfg-identity-main">
                    <div class="cfg-avatar-wrap">
                        ${photoUrl
                            ? `<img id="cfg-hero-avatar" class="cfg-avatar-img" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(fullName)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                               <div class="cfg-avatar-initials" style="display:none;">${escapeHtml(initials)}</div>`
                            : `<div id="cfg-hero-avatar" class="cfg-avatar-initials">${escapeHtml(initials)}</div>`}
                        <button type="button" class="cfg-avatar-trigger" id="btn-hero-photo" title="Actualizar foto de perfil" aria-label="Actualizar foto de perfil">
                            <i class="ph ph-camera"></i>
                        </button>
                        <input id="cfg-foto-input" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                    </div>

                    <div class="cfg-identity-copy">
                        <div class="cfg-kicker-row">
                            <span class="cfg-kicker">DOCENTE TITULAR</span>
                            ${u.codigoPlaza ? `<span class="cfg-code-chip">${escapeHtml(u.codigoPlaza)}</span>` : ''}
                        </div>
                        <h1 class="cfg-identity-title" id="cfg-hero-name">${escapeHtml(fullName)}</h1>
                        <p class="cfg-identity-sub">
                            <span>${escapeHtml(u.email || 'Sin correo institucional')}</span>
                            <span class="cfg-dot" aria-hidden="true"></span>
                            <span>${escapeHtml(scopeText)}</span>
                            ${!this.isLoadingAcademic ? `<span class="cfg-dot" aria-hidden="true"></span><span>${courseCount} curso${courseCount === 1 ? '' : 's'} activo${courseCount === 1 ? '' : 's'}</span>` : ''}
                        </p>
                    </div>
                </div>

                <div class="cfg-authority-legend" aria-label="Criterio de edición">
                    <span class="cfg-pill-editable"><i class="ph ph-pencil-simple"></i> Editable por ti</span>
                    <span class="cfg-pill-locked"><i class="ph ph-lock-simple"></i> Solo lectura institucional</span>
                </div>
            </header>

            <div class="cfg-layout">
                <aside class="cfg-rail" aria-label="Secciones de configuración">
                    <nav class="cfg-nav" role="tablist">
                        ${tabs.map(t => `
                            <button type="button"
                                role="tab"
                                class="cfg-nav-btn ${this.activeTab === t.id ? 'active' : ''}"
                                data-cfg-tab="${t.id}"
                                aria-selected="${this.activeTab === t.id}">
                                <i class="ph ${t.icon}"></i>
                                <span class="cfg-nav-copy">
                                    <span class="cfg-nav-title">${t.title}</span>
                                    <span class="cfg-nav-sub">${t.sub}</span>
                                </span>
                            </button>
                        `).join('')}
                    </nav>

                    <div class="cfg-rail-note">
                        <p>Tu correo institucional, DNI, plaza y asignación de aulas son administrados por Dirección Académica.</p>
                        <a href="#/mensajes" class="cfg-text-link">
                            <i class="ph ph-paper-plane-tilt"></i>
                            <span>Solicitar actualización</span>
                        </a>
                    </div>
                </aside>

                <main class="cfg-stage" id="cfg-stage"></main>
            </div>
        `;
    },

    renderShell(container) {
        const target = container || document.getElementById('cfg-root');
        if (!target) return;
        target.innerHTML = this.buildShellInnerHtml();

        target.querySelectorAll('[data-cfg-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const next = btn.getAttribute('data-cfg-tab');
                if (next && next !== this.activeTab) {
                    this.activeTab = next;
                    this.feedback = null;
                    target.querySelectorAll('[data-cfg-tab]').forEach(other => {
                        const isActive = other.getAttribute('data-cfg-tab') === next;
                        other.classList.toggle('active', isActive);
                        other.setAttribute('aria-selected', String(isActive));
                    });
                    this.renderStage(target);
                }
            });
        });

        const fileInput = document.getElementById('cfg-foto-input');
        document.getElementById('btn-hero-photo')?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', e => this.handlePhotoUpload(e, target));

        this.renderStage(target);
    },

    renderStage(container) {
        const stage = document.getElementById('cfg-stage');
        if (!stage) return;

        // Re-activar transición limpia al cambiar de sección
        stage.style.animation = 'none';
        void stage.offsetWidth;
        stage.style.animation = '';

        if (this.activeTab === 'perfil') {
            stage.innerHTML = this.renderPerfilHtml();
            this.bindPerfilEvents(container);
        } else if (this.activeTab === 'ficha') {
            stage.innerHTML = this.renderFichaHtml();
        } else if (this.activeTab === 'portal') {
            stage.innerHTML = this.renderPortalHtml();
            this.bindPortalEvents();
        } else if (this.activeTab === 'seguridad') {
            stage.innerHTML = this.renderSeguridadHtml();
            this.bindSeguridadEvents();
        }
    },

    renderFeedbackBanner(tabId) {
        if (!this.feedback || this.feedback.tab !== tabId) return '';
        const icon = this.feedback.type === 'success'
            ? 'ph-check-circle'
            : this.feedback.type === 'error'
                ? 'ph-warning-circle'
                : 'ph-info';
        return `
            <div class="cfg-feedback is-${escapeHtml(this.feedback.type)}" role="status" aria-live="polite">
                <i class="ph-fill ${icon}"></i>
                <span>${escapeHtml(this.feedback.text)}</span>
            </div>
        `;
    },

    /* ── TAB 1: Perfil y contacto ────────────────────────────────────────── */
    renderPerfilHtml() {
        const u = this.user || {};
        const initials = getInitials(u);
        const photoUrl = safeImageUrl(u.fotoPerfil);

        return `
            <section>
                <div class="cfg-section-head">
                    <div>
                        <h2>Perfil y datos de contacto</h2>
                        <p>Actualiza cómo te ven tus estudiantes, padres de familia y colegas en mensajería y foros.</p>
                    </div>
                    <span class="cfg-pill-editable"><i class="ph ph-pencil-simple"></i> Editable</span>
                </div>

                ${this.renderFeedbackBanner('perfil')}

                <div class="cfg-photo-row">
                    <div class="cfg-photo-info">
                        ${photoUrl
                            ? `<img class="cfg-photo-preview" src="${escapeHtml(photoUrl)}" alt="Foto actual" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                               <div class="cfg-photo-preview" style="display:none;">${escapeHtml(initials)}</div>`
                            : `<div class="cfg-photo-preview">${escapeHtml(initials)}</div>`}
                        <div class="cfg-photo-text">
                            <strong>Fotografía de perfil</strong>
                            <span>JPG, PNG o WebP hasta 5 MB. Se muestra en el menú, mensajería y foros de tus cursos.</span>
                        </div>
                    </div>
                    <div class="cfg-photo-actions">
                        ${photoUrl ? `<button type="button" id="btn-remove-photo" class="cfg-btn-secondary">Quitar foto</button>` : ''}
                        <button type="button" id="btn-change-photo" class="cfg-btn-secondary">
                            <i class="ph ph-upload-simple"></i> ${photoUrl ? 'Cambiar foto' : 'Subir foto'}
                        </button>
                    </div>
                </div>

                <form id="cfg-perfil-form" class="cfg-form" novalidate>
                    <div class="cfg-form-grid">
                        <div class="cfg-field">
                            <label for="cfg-nombres">Nombres <small>Obligatorio</small></label>
                            <input id="cfg-nombres" class="cfg-input" type="text" maxlength="80" value="${escapeHtml(u.nombres || '')}" required>
                        </div>
                        <div class="cfg-field">
                            <label for="cfg-apellidos">Apellidos <small>Obligatorio</small></label>
                            <input id="cfg-apellidos" class="cfg-input" type="text" maxlength="80" value="${escapeHtml(u.apellidos || '')}" required>
                        </div>
                        <div class="cfg-field">
                            <label for="cfg-telefono">Teléfono de contacto <small>Opcional</small></label>
                            <input id="cfg-telefono" class="cfg-input" type="tel" maxlength="30" placeholder="Ej. 987 654 321" value="${escapeHtml(u.telefono || '')}">
                        </div>
                        <div class="cfg-field">
                            <label for="cfg-direccion">Dirección <small>Opcional</small></label>
                            <input id="cfg-direccion" class="cfg-input" type="text" maxlength="160" placeholder="Av. / Jr. y distrito de referencia" value="${escapeHtml(u.direccion || '')}">
                        </div>
                    </div>

                    <div class="cfg-locked-strip" aria-label="Campos institucionales protegidos">
                        <div class="cfg-locked-item">
                            <span class="cfg-locked-label"><i class="ph ph-lock-simple"></i> Correo institucional (Solo lectura)</span>
                            <span class="cfg-locked-val">${escapeHtml(u.email || 'No asignado')}</span>
                        </div>
                        <div class="cfg-locked-item">
                            <span class="cfg-locked-label"><i class="ph ph-lock-simple"></i> Rol y plaza (Solo lectura)</span>
                            <span class="cfg-locked-val">${escapeHtml(u.rol || 'DOCENTE')}${u.codigoPlaza ? ` · ${escapeHtml(u.codigoPlaza)}` : ''}</span>
                        </div>
                    </div>

                    <div class="cfg-form-footer">
                        <div id="cfg-dirty-status" class="cfg-dirty-status">
                            <span class="cfg-dirty-dot"></span>
                            <span>Sin cambios pendientes</span>
                        </div>
                        <div class="cfg-actions">
                            <button type="button" id="btn-reset-perfil" class="cfg-btn-secondary" disabled>Descartar</button>
                            <button type="submit" id="btn-save-perfil" class="cfg-btn-primary" disabled>
                                <i class="ph ph-floppy-disk"></i> Guardar perfil
                            </button>
                        </div>
                    </div>
                </form>
            </section>
        `;
    },

    bindPerfilEvents(container) {
        const form = document.getElementById('cfg-perfil-form');
        const nombresInput = document.getElementById('cfg-nombres');
        const apellidosInput = document.getElementById('cfg-apellidos');
        const telInput = document.getElementById('cfg-telefono');
        const dirInput = document.getElementById('cfg-direccion');
        const saveBtn = document.getElementById('btn-save-perfil');
        const resetBtn = document.getElementById('btn-reset-perfil');
        const dirtyEl = document.getElementById('cfg-dirty-status');

        const initial = {
            nombres: this.user?.nombres || '',
            apellidos: this.user?.apellidos || '',
            telefono: this.user?.telefono || '',
            direccion: this.user?.direccion || ''
        };

        const checkDirty = () => {
            const dirty =
                (nombresInput?.value || '') !== initial.nombres ||
                (apellidosInput?.value || '') !== initial.apellidos ||
                (telInput?.value || '') !== initial.telefono ||
                (dirInput?.value || '') !== initial.direccion;
            if (saveBtn) saveBtn.disabled = !dirty;
            if (resetBtn) resetBtn.disabled = !dirty;
            if (dirtyEl) {
                dirtyEl.classList.toggle('is-dirty', dirty);
                dirtyEl.querySelector('span:last-child').textContent = dirty
                    ? 'Cambios sin guardar'
                    : 'Sin cambios pendientes';
            }
        };

        [nombresInput, apellidosInput, telInput, dirInput].forEach(el => {
            el?.addEventListener('input', checkDirty);
        });

        resetBtn?.addEventListener('click', () => {
            if (nombresInput) nombresInput.value = initial.nombres;
            if (apellidosInput) apellidosInput.value = initial.apellidos;
            if (telInput) telInput.value = initial.telefono;
            if (dirInput) dirInput.value = initial.direccion;
            this.feedback = null;
            checkDirty();
        });

        document.getElementById('btn-change-photo')?.addEventListener('click', () => {
            document.getElementById('cfg-foto-input')?.click();
        });

        document.getElementById('btn-remove-photo')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-remove-photo');
            if (btn) btn.disabled = true;
            try {
                const updated = await API.fetch(`/api/users/${this.user.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ fotoPerfil: '' })
                });
                this.user = { ...this.user, ...updated, fotoPerfil: null, sessionToken: this.user.sessionToken };
                Auth.setUser(this.user);
                syncTopbar(this.user);
                this.feedback = { tab: 'perfil', type: 'success', text: 'Foto de perfil retirada correctamente.' };
                this.renderShell(container);
            } catch (err) {
                this.feedback = { tab: 'perfil', type: 'error', text: err.message || 'No se pudo quitar la foto.' };
                this.renderStage(container);
            }
        });

        form?.addEventListener('submit', async e => {
            e.preventDefault();
            const nombres = String(nombresInput?.value || '').trim();
            const apellidos = String(apellidosInput?.value || '').trim();
            const telefono = String(telInput?.value || '').trim();
            const direccion = String(dirInput?.value || '').trim();

            if (!nombres || !apellidos) {
                this.feedback = { tab: 'perfil', type: 'error', text: 'Nombres y apellidos son obligatorios.' };
                this.renderStage(container);
                return;
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
            }

            try {
                const updated = await API.fetch(`/api/users/${this.user.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ nombres, apellidos, telefono, direccion })
                });
                this.user = { ...this.user, ...updated, sessionToken: this.user.sessionToken };
                Auth.setUser(this.user);
                syncTopbar(this.user);
                this.feedback = { tab: 'perfil', type: 'success', text: 'Datos personales y de contacto guardados.' };
                this.renderShell(container);
            } catch (err) {
                this.feedback = { tab: 'perfil', type: 'error', text: err.message || 'Error al guardar tu perfil.' };
                this.renderStage(container);
            }
        });
    },

    async handlePhotoUpload(event, container) {
        const input = event.target;
        const file = input?.files?.[0];
        if (!file || !this.user) return;

        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
        if (!allowedTypes.has(file.type)) {
            this.feedback = { tab: 'perfil', type: 'error', text: 'Formato no compatible. Usa JPG, PNG o WebP.' };
            this.activeTab = 'perfil';
            this.renderShell(container);
            input.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.feedback = { tab: 'perfil', type: 'error', text: 'La imagen supera los 5 MB permitidos.' };
            this.activeTab = 'perfil';
            this.renderShell(container);
            input.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const updated = await API.fetch(`/api/users/${this.user.id}/foto-perfil`, {
                method: 'PUT',
                body: formData
            });
            this.user = { ...this.user, ...updated, sessionToken: this.user.sessionToken };
            Auth.setUser(this.user);
            syncTopbar(this.user);
            this.feedback = { tab: 'perfil', type: 'success', text: 'Fotografía actualizada correctamente.' };
            this.activeTab = 'perfil';
            this.renderShell(container);
        } catch (err) {
            this.feedback = { tab: 'perfil', type: 'error', text: err.message || 'No se pudo subir la fotografía.' };
            this.activeTab = 'perfil';
            this.renderShell(container);
        } finally {
            input.value = '';
        }
    },

    /* ── TAB 2: Ficha y carga académica (Solo lectura) ───────────────────── */
    renderFichaHtml() {
        const u = this.user || {};
        const m = this.dashboard?.metricas || {};
        const totalCursos = m.cursos ?? this.courses.length;
        const totalEstudiantes = m.estudiantes ?? '—';
        const totalTareas = m.tareas ?? '—';
        const weeklyHours = computeWeeklyHours(this.courses);

        const kvItems = [
            { label: 'Correo institucional', value: u.email, mono: false },
            { label: 'Código de plaza', value: u.codigoPlaza, mono: true },
            { label: 'Documento de identidad (DNI)', value: u.dni, mono: true },
            { label: 'Rol asignado', value: u.rol || 'DOCENTE', mono: false },
            { label: 'Nivel / Tutoría base', value: formatScope(u, this.courses), mono: false },
            { label: 'Última conexión', value: formatDateTime(u.ultimaConexion), mono: false },
            { label: 'Fecha de nacimiento', value: formatBirthDate(u.fechaNacimiento), mono: false },
            { label: 'Sexo / Estado civil / G. sanguíneo', value: [u.sexo, u.estadoCivil, u.tipoSangre].filter(Boolean).join(' · '), mono: false }
        ];

        const coursesHtml = this.isLoadingAcademic
            ? `<div class="cfg-loading"><i class="ph ph-spinner ph-spin"></i> Consultando carga académica asignada...</div>`
            : this.courses.length === 0
                ? `<div class="cfg-empty">Aún no tienes cursos asignados en el ciclo vigente.</div>`
                : `
                    <div class="cfg-course-list">
                        ${this.courses.map(entry => {
                            const c = entry?.curso || entry;
                            const aula = [c.nivel, c.grado ? `${c.grado}°` : '', c.seccion ? `Sec. ${c.seccion}` : '', c.turno]
                                .filter(Boolean).join(' · ') || 'Aula general';
                            const dia = DIAS_SEMANA[c.diaSemana] || '';
                            const horario = c.horaInicio && c.horaFin ? `${c.horaInicio} – ${c.horaFin}` : '';
                            const schedule = [dia, horario].filter(Boolean).join(' · ') || 'Horario por definir';
                            const color = safeColor(c.color);

                            return `
                                <div class="cfg-course-row">
                                    <div class="cfg-course-main">
                                        <span class="cfg-course-bar" style="--course-accent:${color};"></span>
                                        <div>
                                            <div class="cfg-course-title">${escapeHtml(c.nombre || 'Curso')}</div>
                                            <div class="cfg-course-meta">
                                                <span class="cfg-course-tag"><i class="ph ph-chalkboard"></i> ${escapeHtml(aula)}</span>
                                                <span class="cfg-course-tag"><i class="ph ph-clock"></i> ${escapeHtml(schedule)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="cfg-course-right">
                                        ${entry?.alumnos !== null && entry?.alumnos !== undefined ? `
                                            <div class="cfg-course-counts">
                                                <div><strong>${escapeHtml(entry.alumnos)}</strong> alumnos</div>
                                                <div><strong>${escapeHtml(entry.tareas ?? 0)}</strong> actividades</div>
                                            </div>
                                        ` : ''}
                                        <a href="#/mis-clases" class="cfg-btn-secondary" style="text-decoration:none;">Ver clase</a>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;

        return `
            <section>
                <div class="cfg-section-head">
                    <div>
                        <h2>Ficha institucional y carga académica</h2>
                        <p>Información oficial registrada en Secretaría Académica. Solo lectura para garantizar la integridad del padrón docente.</p>
                    </div>
                    <span class="cfg-pill-locked"><i class="ph ph-lock-simple"></i> Solo lectura</span>
                </div>

                <div class="cfg-block" style="margin-top:18px;">
                    <div class="cfg-block-label">
                        <h3>Identidad y legajo institucional</h3>
                    </div>
                    <div class="cfg-kv-grid">
                        ${kvItems.map(item => `
                            <div class="cfg-kv-row">
                                <span class="cfg-kv-label">${escapeHtml(item.label)}</span>
                                <span class="cfg-kv-value ${item.mono ? 'is-mono' : ''} ${!item.value ? 'is-muted' : ''}">
                                    ${escapeHtml(item.value || 'No registrado')}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="cfg-block">
                    <div class="cfg-block-label">
                        <h3>Carga académica asignada</h3>
                    </div>
                    <div class="cfg-metrics-strip">
                        <div class="cfg-metric-cell">
                            <span class="cfg-metric-val">${escapeHtml(totalCursos)}</span>
                            <span class="cfg-metric-lbl">Cursos asignados</span>
                        </div>
                        <div class="cfg-metric-cell">
                            <span class="cfg-metric-val">${escapeHtml(totalEstudiantes)}</span>
                            <span class="cfg-metric-lbl">Estudiantes únicos</span>
                        </div>
                        <div class="cfg-metric-cell">
                            <span class="cfg-metric-val">${escapeHtml(totalTareas)}</span>
                            <span class="cfg-metric-lbl">Actividades creadas</span>
                        </div>
                        <div class="cfg-metric-cell">
                            <span class="cfg-metric-val">${escapeHtml(weeklyHours)}</span>
                            <span class="cfg-metric-lbl">Horas lectivas / sem.</span>
                        </div>
                    </div>
                    ${coursesHtml}
                </div>

                <div class="cfg-callout">
                    <div class="cfg-callout-copy">
                        <i class="ph ph-info"></i>
                        <span>¿Detectaste un dato desactualizado en tu código de plaza, DNI o en las secciones asignadas a tu horario? Comunícalo directamente a Administración.</span>
                    </div>
                    <a href="#/mensajes" class="cfg-btn-secondary" style="text-decoration:none;">
                        <i class="ph ph-chat-circle-text"></i> Reportar inconsistencia
                    </a>
                </div>
            </section>
        `;
    },

    /* ── TAB 3: Preferencias del portal ──────────────────────────────────── */
    renderPortalHtml() {
        const prefs = DocentePrefs.get();
        const theme = currentTheme();

        return `
            <section>
                <div class="cfg-section-head">
                    <div>
                        <h2>Portal y preferencias de enseñanza</h2>
                        <p>Personaliza tu espacio de trabajo en este navegador. Los cambios surten efecto de inmediato.</p>
                    </div>
                    <span class="cfg-pill-editable"><i class="ph ph-sliders-horizontal"></i> Sincronizado al instante</span>
                </div>

                <div id="cfg-portal-feedback">
                    ${this.renderFeedbackBanner('portal')}
                </div>

                <div class="cfg-block" style="margin-top:16px;">
                    <div class="cfg-block-label">
                        <h3>Apariencia y comodidad de lectura</h3>
                    </div>
                    <div class="cfg-pref-list">
                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Tema visual del portal</strong>
                                <span>Alterna entre modo noche (Obsidian &amp; Oro) y modo día editorial de alto contraste.</span>
                            </div>
                            <div class="cfg-segmented" role="group" aria-label="Tema visual">
                                <button type="button" class="cfg-seg-btn ${theme === 'dark' ? 'active' : ''}" data-theme-choice="dark">
                                    <i class="ph ph-moon-stars"></i> Modo Noche
                                </button>
                                <button type="button" class="cfg-seg-btn ${theme === 'light' ? 'active' : ''}" data-theme-choice="light">
                                    <i class="ph ph-sun"></i> Modo Día
                                </button>
                            </div>
                        </div>

                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Densidad de tablas y libreta</strong>
                                <span>Usa vista compacta para visualizar más alumnos en calificaciones y asistencia sin tanto desplazamiento.</span>
                            </div>
                            <div class="cfg-segmented" role="group" aria-label="Densidad visual">
                                <button type="button" class="cfg-seg-btn ${prefs.density === 'comfortable' ? 'active' : ''}" data-density-choice="comfortable">Cómoda</button>
                                <button type="button" class="cfg-seg-btn ${prefs.density === 'compact' ? 'active' : ''}" data-density-choice="compact">Compacta</button>
                            </div>
                        </div>

                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Reducir transiciones y movimiento</strong>
                                <span>Desactiva desplazamientos suaves al cambiar de sección si prefieres respuesta visual inmediata.</span>
                            </div>
                            <button type="button"
                                id="pref-reduce-motion"
                                class="cfg-switch"
                                role="switch"
                                aria-checked="${prefs.reduceMotion}"
                                aria-label="Reducir transiciones y movimiento"></button>
                        </div>
                    </div>
                </div>

                <div class="cfg-block">
                    <div class="cfg-block-label">
                        <h3>Flujo de trabajo inicial</h3>
                    </div>
                    <div class="cfg-pref-list">
                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Vista al abrir el portal</strong>
                                <span>Elige a qué módulo ir directamente cuando inicias sesión o ingresas a la raíz del portal docente.</span>
                            </div>
                            <select id="pref-start-route" class="cfg-select cfg-pref-select" aria-label="Vista inicial al abrir el portal">
                                <option value="/dashboard" ${prefs.startRoute === '/dashboard' ? 'selected' : ''}>Panel Principal (Resumen)</option>
                                <option value="/mis-clases" ${prefs.startRoute === '/mis-clases' ? 'selected' : ''}>Mis Clases y Aulas</option>
                                <option value="/calificaciones" ${prefs.startRoute === '/calificaciones' ? 'selected' : ''}>Libreta de Calificaciones</option>
                                <option value="/tareas" ${prefs.startRoute === '/tareas' ? 'selected' : ''}>Tareas y Actividades</option>
                                <option value="/asistencia" ${prefs.startRoute === '/asistencia' ? 'selected' : ''}>Registro de Asistencia</option>
                                <option value="/calendario" ${prefs.startRoute === '/calendario' ? 'selected' : ''}>Calendario Académico</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="cfg-block">
                    <div class="cfg-block-label">
                        <h3>Centro de notificaciones</h3>
                    </div>
                    <div class="cfg-pref-list">
                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Pestaña predeterminada al abrir avisos</strong>
                                <span>Prioriza ver solo notificaciones sin leer o el historial completo de tus cursos.</span>
                            </div>
                            <div class="cfg-segmented" role="group" aria-label="Pestaña inicial de notificaciones">
                                <button type="button" class="cfg-seg-btn ${prefs.notifDefaultTab === 'all' ? 'active' : ''}" data-notif-tab="all">Todas</button>
                                <button type="button" class="cfg-seg-btn ${prefs.notifDefaultTab === 'unread' ? 'active' : ''}" data-notif-tab="unread">Sin leer</button>
                            </div>
                        </div>

                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Frecuencia de actualización automática</strong>
                                <span>Intervalo con el que el portal consulta nuevas entregas o mensajes escolares en segundo plano.</span>
                            </div>
                            <select id="pref-notif-poll" class="cfg-select cfg-pref-select" aria-label="Frecuencia de actualización de notificaciones">
                                <option value="15000" ${prefs.notifPollMs === 15000 ? 'selected' : ''}>Cada 15 segundos</option>
                                <option value="30000" ${prefs.notifPollMs === 30000 ? 'selected' : ''}>Cada 30 segundos (estándar)</option>
                                <option value="60000" ${prefs.notifPollMs === 60000 ? 'selected' : ''}>Cada 60 segundos</option>
                                <option value="0" ${prefs.notifPollMs === 0 ? 'selected' : ''}>Solo manual al abrir</option>
                            </select>
                        </div>

                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Mostrar contador numérico en la campana</strong>
                                <span>Muestra la insignia con el número de avisos pendientes junto al botón de notificaciones.</span>
                            </div>
                            <button type="button"
                                id="pref-show-badge"
                                class="cfg-switch"
                                role="switch"
                                aria-checked="${prefs.showNotifBadge}"
                                aria-label="Mostrar contador numérico en la campana"></button>
                        </div>
                    </div>
                </div>

                <div class="cfg-form-footer" style="margin-top:20px;">
                    <span class="cfg-dirty-status"><i class="ph ph-check-circle"></i> Guardado automáticamente en este equipo</span>
                    <button type="button" id="btn-reset-prefs" class="cfg-btn-secondary">
                        <i class="ph ph-arrow-counter-clockwise"></i> Restaurar recomendadas
                    </button>
                </div>
            </section>
        `;
    },

    syncThemeButtons() {
        const theme = currentTheme();
        document.querySelectorAll('[data-theme-choice]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme-choice') === theme);
        });
    },

    showPortalStatus(text) {
        const host = document.getElementById('cfg-portal-feedback');
        if (!host) return;
        host.innerHTML = `
            <div class="cfg-feedback is-info" role="status" aria-live="polite" style="margin-top:8px;">
                <i class="ph-fill ph-check-circle"></i>
                <span>${escapeHtml(text)}</span>
            </div>
        `;
    },

    bindPortalEvents() {
        document.querySelectorAll('[data-theme-choice]').forEach(btn => {
            btn.addEventListener('click', () => {
                const choice = btn.getAttribute('data-theme-choice');
                applyThemeChoice(choice);
                this.syncThemeButtons();
                this.showPortalStatus(choice === 'dark' ? 'Tema cambiado a Modo Noche.' : 'Tema cambiado a Modo Día.');
            });
        });

        document.querySelectorAll('[data-density-choice]').forEach(btn => {
            btn.addEventListener('click', () => {
                const density = btn.getAttribute('data-density-choice');
                DocentePrefs.update({ density });
                document.querySelectorAll('[data-density-choice]').forEach(other => {
                    other.classList.toggle('active', other.getAttribute('data-density-choice') === density);
                });
                this.showPortalStatus(density === 'compact' ? 'Densidad compacta activada.' : 'Densidad cómoda restaurada.');
            });
        });

        const motionSwitch = document.getElementById('pref-reduce-motion');
        motionSwitch?.addEventListener('click', () => {
            const nextVal = motionSwitch.getAttribute('aria-checked') !== 'true';
            motionSwitch.setAttribute('aria-checked', String(nextVal));
            DocentePrefs.update({ reduceMotion: nextVal });
            this.showPortalStatus(nextVal ? 'Movimiento reducido activado.' : 'Transiciones modernas activadas.');
        });

        document.getElementById('pref-start-route')?.addEventListener('change', e => {
            DocentePrefs.update({ startRoute: e.target.value });
            this.showPortalStatus('Vista de inicio actualizada para tu próximo ingreso.');
        });

        document.querySelectorAll('[data-notif-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-notif-tab');
                DocentePrefs.update({ notifDefaultTab: tab });
                document.querySelectorAll('[data-notif-tab]').forEach(other => {
                    other.classList.toggle('active', other.getAttribute('data-notif-tab') === tab);
                });
                this.showPortalStatus(tab === 'unread' ? 'La campana priorizará avisos sin leer.' : 'La campana mostrará todas las notificaciones.');
            });
        });

        document.getElementById('pref-notif-poll')?.addEventListener('change', e => {
            DocentePrefs.update({ notifPollMs: Number(e.target.value) });
            this.showPortalStatus('Frecuencia de consulta de notificaciones actualizada.');
        });

        const badgeSwitch = document.getElementById('pref-show-badge');
        badgeSwitch?.addEventListener('click', () => {
            const nextVal = badgeSwitch.getAttribute('aria-checked') !== 'true';
            badgeSwitch.setAttribute('aria-checked', String(nextVal));
            DocentePrefs.update({ showNotifBadge: nextVal });
            this.showPortalStatus(nextVal ? 'Contador visible en la campana.' : 'Contador oculto para una barra superior más limpia.');
        });

        document.getElementById('btn-reset-prefs')?.addEventListener('click', () => {
            DocentePrefs.reset();
            this.feedback = { tab: 'portal', type: 'success', text: 'Preferencias restauradas a los valores recomendados.' };
            const stage = document.getElementById('cfg-stage');
            if (stage) {
                stage.innerHTML = this.renderPortalHtml();
                this.bindPortalEvents();
            }
        });
    },

    /* ── TAB 4: Seguridad y sesión ───────────────────────────────────────── */
    renderSeguridadHtml() {
        const u = this.user || {};
        return `
            <section>
                <div class="cfg-section-head">
                    <div>
                        <h2>Seguridad y sesión activa</h2>
                        <p>Mantén protegida tu cuenta docente y revisa el estado de tu acceso actual.</p>
                    </div>
                    <span class="cfg-pill-editable"><i class="ph ph-shield-check"></i> Control de acceso</span>
                </div>

                ${this.renderFeedbackBanner('seguridad')}

                <div class="cfg-block" style="margin-top:18px;">
                    <div class="cfg-block-label">
                        <h3>Cambiar contraseña</h3>
                    </div>

                    <form id="cfg-password-form" class="cfg-form cfg-password-form" novalidate>
                        <div class="cfg-field">
                            <label for="cfg-pass1">Nueva contraseña <small>Mínimo 6 caracteres</small></label>
                            <div class="cfg-input-wrap">
                                <input id="cfg-pass1" class="cfg-input cfg-input-with-btn" type="password" minlength="6" autocomplete="new-password" placeholder="Ingresa una clave segura" required>
                                <button type="button" class="cfg-eye-btn" data-toggle-pass="cfg-pass1" aria-label="Mostrar u ocultar contraseña">
                                    <i class="ph ph-eye"></i>
                                </button>
                            </div>
                            <div class="cfg-strength" aria-live="polite">
                                <div class="cfg-strength-track">
                                    <div id="cfg-strength-fill" class="cfg-strength-fill"></div>
                                </div>
                                <span id="cfg-strength-label" class="cfg-strength-label">Sin definir</span>
                            </div>
                        </div>

                        <div class="cfg-field">
                            <label for="cfg-pass2">Confirmar nueva contraseña</label>
                            <div class="cfg-input-wrap">
                                <input id="cfg-pass2" class="cfg-input cfg-input-with-btn" type="password" minlength="6" autocomplete="new-password" placeholder="Repite la contraseña" required>
                                <button type="button" class="cfg-eye-btn" data-toggle-pass="cfg-pass2" aria-label="Mostrar u ocultar confirmación">
                                    <i class="ph ph-eye"></i>
                                </button>
                            </div>
                        </div>

                        <div class="cfg-actions">
                            <button type="submit" id="btn-save-password" class="cfg-btn-primary">
                                <i class="ph ph-key"></i> Actualizar contraseña
                            </button>
                        </div>
                    </form>
                </div>

                <div class="cfg-block">
                    <div class="cfg-block-label">
                        <h3>Estado de la sesión actual</h3>
                    </div>
                    <div class="cfg-pref-list">
                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Autenticación de cuenta</strong>
                                <span>Titular: ${escapeHtml(u.email || '—')} · Rol ${escapeHtml(u.rol || 'DOCENTE')}</span>
                            </div>
                            <span class="cfg-row-status"><span class="cfg-row-status-dot"></span> Sesión activa verificada</span>
                        </div>

                        <div class="cfg-pref-row">
                            <div class="cfg-pref-copy">
                                <strong>Última conexión registrada</strong>
                                <span>${escapeHtml(formatDateTime(u.ultimaConexion))}</span>
                            </div>
                            <button type="button" id="btn-cfg-logout" class="cfg-btn-danger-outline">
                                <i class="ph ph-sign-out"></i> Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        `;
    },

    bindSeguridadEvents() {
        document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.getAttribute('data-toggle-pass'));
                if (!input) return;
                const isPass = input.type === 'password';
                input.type = isPass ? 'text' : 'password';
                btn.innerHTML = `<i class="ph ${isPass ? 'ph-eye-slash' : 'ph-eye'}"></i>`;
            });
        });

        const pass1El = document.getElementById('cfg-pass1');
        const pass2El = document.getElementById('cfg-pass2');
        const fillEl = document.getElementById('cfg-strength-fill');
        const labelEl = document.getElementById('cfg-strength-label');

        pass1El?.addEventListener('input', () => {
            const st = passwordStrength(pass1El.value);
            if (fillEl) {
                fillEl.style.width = `${st.pct}%`;
                fillEl.style.backgroundColor = st.color;
            }
            if (labelEl) labelEl.textContent = st.label;
        });

        const form = document.getElementById('cfg-password-form');
        const submitBtn = document.getElementById('btn-save-password');
        form?.addEventListener('submit', async e => {
            e.preventDefault();
            const p1 = pass1El?.value || '';
            const p2 = pass2El?.value || '';
            const stage = document.getElementById('cfg-stage');

            if (p1.trim().length < 6) {
                this.feedback = { tab: 'seguridad', type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' };
                if (stage) {
                    stage.innerHTML = this.renderSeguridadHtml();
                    this.bindSeguridadEvents();
                }
                return;
            }
            if (p1 !== p2) {
                this.feedback = { tab: 'seguridad', type: 'error', text: 'Las contraseñas ingresadas no coinciden.' };
                if (stage) {
                    stage.innerHTML = this.renderSeguridadHtml();
                    this.bindSeguridadEvents();
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Actualizando...';
            }

            try {
                await API.fetch(`/api/users/${this.user.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ password: p1 })
                });
                this.feedback = { tab: 'seguridad', type: 'success', text: 'Contraseña actualizada correctamente. Tu sesión sigue activa.' };
            } catch (err) {
                this.feedback = { tab: 'seguridad', type: 'error', text: err.message || 'No se pudo actualizar la contraseña.' };
            }

            if (stage) {
                stage.innerHTML = this.renderSeguridadHtml();
                this.bindSeguridadEvents();
            }
        });

        document.getElementById('btn-cfg-logout')?.addEventListener('click', async () => {
            if (window.Swal) {
                const res = await window.Swal.fire({
                    icon: 'question',
                    title: '¿Cerrar sesión docente?',
                    text: 'Tendrás que volver a ingresar con tu correo institucional.',
                    showCancelButton: true,
                    confirmButtonText: 'Cerrar sesión',
                    cancelButtonText: 'Continuar trabajando'
                });
                if (res.isConfirmed) Auth.logout();
            } else if (window.confirm('¿Deseas cerrar tu sesión en este dispositivo?')) {
                Auth.logout();
            }
        });
    }
};
