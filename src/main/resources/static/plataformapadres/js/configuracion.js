/* ==========================================================================
   SHIDELL - CONFIGURACIÓN DEL PADRE DE FAMILIA / APODERADO
   Lógica real centrada en el apoderado:
   - Editable en BD: foto, nombres, apellidos, teléfono de contacto, dirección y contraseña (validando clave actual)
   - Solo lectura institucional: correo de acceso, DNI, rol PADRE e hijos vinculados
   - Preferencias de seguimiento en navegador: hijo predeterminado, alertas y comodidad visual
   ========================================================================== */
(() => {
    'use strict';

    const PAGE_SIZE_HIJOS = 6;

    const state = {
        padre: null,
        hijos: [],
        loadingHijos: true,
        hijosQuery: '',
        hijosVisibleCount: PAGE_SIZE_HIJOS,
        activeTab: 'perfil',
        feedback: null, // { tab, type: 'success' | 'error' | 'info', text }
        editingPerfil: false,
        isDirtyPerfil: false
    };

    function escapeHtml(val) {
        return String(val ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function safeImageUrl(url) {
        const raw = String(url || '').trim();
        if (!raw || /^javascript:/i.test(raw)) return '';
        if (/^(data:image\/|\/uploads\/|https?:\/\/)/i.test(raw)) return raw;
        return '';
    }

    function getInitials(user) {
        const n = String(user?.nombres || 'P').trim();
        const a = String(user?.apellidos || '').trim();
        return `${n.charAt(0)}${a.charAt(0)}`.toUpperCase() || 'PF';
    }

    function formatDateTime(value) {
        if (!value) return 'Sesión activa actual';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return 'Sesión activa actual';
        return d.toLocaleString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatBirthDate(value) {
        if (!value) return 'No registrada';
        const d = new Date(`${value}T00:00:00`);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    function formatGrupoHijo(h) {
        const parts = [
            h?.nivel,
            h?.grado ? `${h.grado}°` : '',
            h?.seccion ? `Sec. ${h.seccion}` : '',
            h?.turno
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(' · ') : 'Matrícula pendiente';
    }

    function passwordStrength(pass) {
        if (!pass) return { pct: 0, color: 'transparent', label: 'Sin definir' };
        if (pass.length < 6) return { pct: 25, color: '#ef4444', label: 'Muy corta (mín. 6 caracteres)' };
        let score = 1;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
        if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;
        if (score >= 3) return { pct: 100, color: '#10b981', label: 'Contraseña segura' };
        return { pct: 64, color: '#0d9488', label: 'Aceptable' };
    }

    async function apiJson(url, options = {}) {
        const headers = new Headers(options.headers || {});
        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        if (state.padre?.sessionToken && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${state.padre.sessionToken}`);
        }
        const res = await fetch(url, { ...options, headers });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) {
            const msg = data?.error || data?.message || `Error HTTP ${res.status}`;
            throw new Error(msg);
        }
        return data;
    }

    function syncPadreUI(padre) {
        if (!padre) return;
        const fullName = `${padre.nombres || ''} ${padre.apellidos || ''}`.trim() || 'Padre de Familia';
        document.querySelectorAll('.padre-nombre').forEach((el) => {
            el.textContent = fullName;
        });

        const bannerEmail = document.getElementById('perfil-email');
        if (bannerEmail) bannerEmail.textContent = padre.email || '—';

        const bannerAvatar = document.getElementById('perfil-avatar');
        const photoUrl = safeImageUrl(padre.fotoPerfil || padre.foto_perfil);
        const initials = getInitials(padre);
        if (bannerAvatar) {
            if (photoUrl) {
                bannerAvatar.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(fullName)}" onerror="this.remove()">`;
                const img = bannerAvatar.querySelector('img');
                if (img) {
                    img.addEventListener('error', () => {
                        bannerAvatar.textContent = initials;
                    }, { once: true });
                }
            } else {
                bannerAvatar.textContent = initials;
            }
        }

        const btnRemove = document.getElementById('btn-quitar-foto');
        if (btnRemove) {
            btnRemove.style.display = photoUrl ? 'inline-flex' : 'none';
        }

        const badgeHijos = document.getElementById('banner-hijos-chip');
        if (badgeHijos) {
            if (state.loadingHijos) {
                badgeHijos.innerHTML = '<i class="ph ph-users-three"></i><span>Cargando hijos...</span>';
            } else {
                const n = state.hijos.length;
                badgeHijos.innerHTML = `<i class="ph ph-users-three"></i><span>${n} ${n === 1 ? 'hijo vinculado' : 'hijos vinculados'}</span>`;
            }
        }

        if (typeof window.renderAvatarPadre === 'function') {
            window.renderAvatarPadre(padre);
        }
    }

    function persistLocalPadre(fresh) {
        state.padre = {
            ...state.padre,
            ...fresh,
            sessionToken: state.padre?.sessionToken
        };
        try {
            localStorage.setItem('shidell_user', JSON.stringify(state.padre));
        } catch {}
        window._padreActual = state.padre;
        syncPadreUI(state.padre);
    }

    function processPhotoFile(file) {
        if (!file.type.startsWith('image/')) {
            throw new Error('Selecciona una imagen válida (PNG, JPG o WEBP).');
        }
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('La imagen debe pesar menos de 5 MB.');
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
                img.onload = () => {
                    const size = 384;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    const side = Math.min(img.width, img.height);
                    const sx = (img.width - side) / 2;
                    const sy = (img.height - side) / 2;
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
                    resolve(canvas.toDataURL('image/jpeg', 0.84));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function handlePhotoUpload(e) {
        const file = e.target?.files?.[0];
        if (!file || !state.padre?.id) return;
        try {
            const dataUrl = await processPhotoFile(file);
            const updated = await apiJson(`/api/users/${state.padre.id}`, {
                method: 'PUT',
                body: JSON.stringify({ fotoPerfil: dataUrl })
            });
            persistLocalPadre(updated);
            state.feedback = { tab: state.activeTab, type: 'success', text: 'Foto de perfil actualizada.' };
            renderStage();
        } catch (err) {
            state.feedback = { tab: state.activeTab, type: 'error', text: err.message || 'No se pudo subir la foto.' };
            renderStage();
        } finally {
            if (e.target) e.target.value = '';
        }
    }

    async function handlePhotoRemove() {
        if (!state.padre?.id) return;
        try {
            const updated = await apiJson(`/api/users/${state.padre.id}`, {
                method: 'PUT',
                body: JSON.stringify({ fotoPerfil: '' })
            });
            persistLocalPadre(updated);
            state.feedback = { tab: state.activeTab, type: 'info', text: 'Se quitó tu foto de perfil.' };
            renderStage();
        } catch (err) {
            state.feedback = { tab: state.activeTab, type: 'error', text: err.message || 'No se pudo quitar la foto.' };
            renderStage();
        }
    }

    function renderFeedback(tabId) {
        if (!state.feedback || state.feedback.tab !== tabId) return '';
        const icon = state.feedback.type === 'success'
            ? 'ph-check-circle'
            : state.feedback.type === 'error'
                ? 'ph-warning-circle'
                : 'ph-info';
        return `
            <div class="pf-feedback is-${escapeHtml(state.feedback.type)}" role="status" aria-live="polite">
                <i class="ph-fill ${icon}"></i>
                <span>${escapeHtml(state.feedback.text)}</span>
            </div>
        `;
    }

    /* ----------------------------------------------------------------------
       TAB 1: PERFIL Y CONTACTO DEL APODERADO (VISTA INFO + BOTÓN EDITAR)
       ---------------------------------------------------------------------- */
    function renderInfoRow(label, value, fallbackText) {
        const raw = value == null ? '' : String(value).trim();
        const isMuted = !raw;
        return `
            <div class="pf-dl-row">
                <span class="pf-dl-label">${escapeHtml(label)}</span>
                <strong class="pf-dl-val ${isMuted ? 'is-muted' : ''}">${escapeHtml(raw || fallbackText)}</strong>
            </div>
        `;
    }

    function renderPerfilTab() {
        const u = state.padre || {};
        if (!state.editingPerfil) {
            return `
                <section class="pf-panel">
                    <div class="pf-section-head">
                        <div>
                            <h2>Información personal y de contacto</h2>
                            <p>Consulta tus datos registrados como apoderado y actualiza tu nombre o medios de contacto cuando lo necesites.</p>
                        </div>
                        <button type="button" id="btn-editar-perfil" class="pf-btn-primary pf-btn-compact">
                            <i class="ph ph-pencil-simple"></i> Editar
                        </button>
                    </div>

                    <div id="pf-perfil-feedback">${renderFeedback('perfil')}</div>

                    <div class="pf-info-blocks">
                        <div>
                            <div class="pf-info-group-title">Datos de identidad y contacto</div>
                            <div class="pf-dl-grid">
                                ${renderInfoRow('Nombres', u.nombres, 'No registrado')}
                                ${renderInfoRow('Apellidos', u.apellidos, 'No registrado')}
                                ${renderInfoRow('Teléfono / Celular', u.telefono, 'Sin teléfono registrado')}
                                ${renderInfoRow('Dirección domiciliaria', u.direccion, 'Sin dirección registrada')}
                            </div>
                        </div>

                        <div>
                            <div class="pf-info-group-title">Información de cuenta escolar</div>
                            <div class="pf-dl-grid">
                                ${renderInfoRow('Correo de acceso', u.email, '—')}
                                ${renderInfoRow('DNI / Documento', u.dni, 'Pendiente en Secretaría')}
                                ${renderInfoRow('Rol en plataforma', 'Apoderado / Padre de Familia', 'Padre de Familia')}
                                ${renderInfoRow('Fecha de nacimiento', u.fechaNacimiento ? formatBirthDate(u.fechaNacimiento) : '', 'No registrada')}
                                ${renderInfoRow('Hijos vinculados', state.loadingHijos ? 'Consultando...' : `${state.hijos.length} estudiante(s)`, '0 estudiantes')}
                                ${renderInfoRow('Último acceso', formatDateTime(u.ultimaConexion), 'Sesión actual')}
                            </div>
                        </div>
                    </div>
                </section>
            `;
        }

        return `
            <section class="pf-panel">
                <div class="pf-section-head">
                    <div>
                        <h2>Editar información personal</h2>
                        <p>Mantén actualizados tu nombre, teléfono para avisos o emergencias y tu domicilio.</p>
                    </div>
                    <button type="button" id="btn-cancelar-edicion-top" class="pf-btn-secondary">
                        <i class="ph ph-x"></i> Cancelar
                    </button>
                </div>

                <div id="pf-perfil-feedback">${renderFeedback('perfil')}</div>

                <form id="pf-perfil-form" class="pf-form" novalidate>
                    <div class="pf-grid-2">
                        <div class="pf-field">
                            <label for="cfg-nombres">Nombres <span class="pf-req">*</span></label>
                            <input type="text" id="cfg-nombres" maxlength="80" value="${escapeHtml(u.nombres || '')}" placeholder="Tus nombres" required>
                        </div>
                        <div class="pf-field">
                            <label for="cfg-apellidos">Apellidos <span class="pf-req">*</span></label>
                            <input type="text" id="cfg-apellidos" maxlength="80" value="${escapeHtml(u.apellidos || '')}" placeholder="Tus apellidos" required>
                        </div>
                    </div>

                    <div class="pf-grid-2">
                        <div class="pf-field">
                            <label for="cfg-telefono">Teléfono / Celular de emergencias <small>Máx. 30 caracteres</small></label>
                            <input type="tel" id="cfg-telefono" maxlength="30" value="${escapeHtml(u.telefono || '')}" placeholder="Ej. 987 654 321">
                        </div>
                        <div class="pf-field">
                            <label for="cfg-direccion">Dirección domiciliaria <small>Máx. 160 caracteres</small></label>
                            <input type="text" id="cfg-direccion" maxlength="160" value="${escapeHtml(u.direccion || '')}" placeholder="Ej. Av. Principal 240, Lima">
                        </div>
                    </div>

                    <div class="pf-readonly-box">
                        <div class="pf-readonly-head">
                            <span><i class="ph ph-lock-simple"></i> Datos institucionales no editables</span>
                            <a href="mensajes.html" class="pf-link-inline">Solicitar rectificación</a>
                        </div>
                        <div class="pf-grid-2">
                            <div class="pf-field">
                                <label for="cfg-email">Correo de acceso</label>
                                <input type="email" id="cfg-email" value="${escapeHtml(u.email || '')}" readonly>
                            </div>
                            <div class="pf-field">
                                <label for="cfg-dni">DNI / Documento</label>
                                <input type="text" id="cfg-dni" value="${escapeHtml(u.dni || 'Pendiente en Secretaría')}" readonly>
                            </div>
                        </div>
                    </div>

                    <div class="pf-form-footer">
                        <span id="pf-dirty-indicator" class="pf-dirty-text">
                            ${state.isDirtyPerfil ? 'Tienes cambios sin guardar' : 'Edita los campos que desees actualizar'}
                        </span>
                        <div class="pf-btn-row">
                            <button type="button" id="btn-reset-perfil" class="pf-btn-secondary">
                                Cancelar
                            </button>
                            <button type="submit" id="btn-save-perfil" class="pf-btn-primary">
                                <i class="ph ph-floppy-disk"></i> Guardar cambios
                            </button>
                        </div>
                    </div>
                </form>
            </section>
        `;
    }

    function bindPerfilEvents() {
        const editBtn = document.getElementById('btn-editar-perfil');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                state.editingPerfil = true;
                state.isDirtyPerfil = false;
                state.feedback = null;
                renderStage();
                document.getElementById('cfg-nombres')?.focus();
            });
            return;
        }

        const form = document.getElementById('pf-perfil-form');
        const nombresEl = document.getElementById('cfg-nombres');
        const apellidosEl = document.getElementById('cfg-apellidos');
        const telEl = document.getElementById('cfg-telefono');
        const dirEl = document.getElementById('cfg-direccion');
        const dirtyEl = document.getElementById('pf-dirty-indicator');
        const resetBtn = document.getElementById('btn-reset-perfil');
        const cancelTopBtn = document.getElementById('btn-cancelar-edicion-top');
        const saveBtn = document.getElementById('btn-save-perfil');

        const cancelarEdicion = () => {
            state.editingPerfil = false;
            state.isDirtyPerfil = false;
            state.feedback = null;
            renderStage();
        };

        const markDirty = () => {
            const u = state.padre || {};
            const changed =
                (nombresEl?.value.trim() || '') !== (u.nombres || '') ||
                (apellidosEl?.value.trim() || '') !== (u.apellidos || '') ||
                (telEl?.value.trim() || '') !== (u.telefono || '') ||
                (dirEl?.value.trim() || '') !== (u.direccion || '');
            state.isDirtyPerfil = changed;
            if (dirtyEl) {
                dirtyEl.textContent = changed ? 'Tienes cambios sin guardar' : 'Edita los campos que desees actualizar';
                dirtyEl.classList.toggle('is-dirty', changed);
            }
        };

        [nombresEl, apellidosEl, telEl, dirEl].forEach((input) => {
            input?.addEventListener('input', markDirty);
        });

        resetBtn?.addEventListener('click', cancelarEdicion);
        cancelTopBtn?.addEventListener('click', cancelarEdicion);

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.padre?.id) return;

            const nombres = nombresEl?.value.trim() || '';
            const apellidos = apellidosEl?.value.trim() || '';
            const telefono = telEl?.value.trim() || '';
            const direccion = dirEl?.value.trim() || '';

            if (!nombres || !apellidos) {
                state.feedback = { tab: 'perfil', type: 'error', text: 'Nombres y apellidos son obligatorios.' };
                renderStage();
                return;
            }
            if (telefono.length > 30) {
                state.feedback = { tab: 'perfil', type: 'error', text: 'El teléfono no puede superar 30 caracteres.' };
                renderStage();
                return;
            }
            if (direccion.length > 160) {
                state.feedback = { tab: 'perfil', type: 'error', text: 'La dirección no puede superar 160 caracteres.' };
                renderStage();
                return;
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
            }

            try {
                const updated = await apiJson(`/api/users/${state.padre.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ nombres, apellidos, telefono, direccion })
                });
                state.editingPerfil = false;
                state.isDirtyPerfil = false;
                persistLocalPadre(updated);
                state.feedback = { tab: 'perfil', type: 'success', text: 'Datos personales y de contacto guardados correctamente.' };
            } catch (err) {
                state.feedback = { tab: 'perfil', type: 'error', text: err.message || 'No se pudieron guardar los cambios.' };
            }

            renderStage();
        });
    }

    /* ----------------------------------------------------------------------
       TAB 2: HIJOS Y FICHA FAMILIAR (SOLO LECTURA INSTITUCIONAL)
       ---------------------------------------------------------------------- */
    function renderFamiliaTab() {
        const u = state.padre || {};
        const prefs = window.PadresPrefs ? window.PadresPrefs.get(u.id) : {};
        const query = state.hijosQuery.trim().toLowerCase();
        const filtrados = state.hijos.filter((h) => {
            if (!query) return true;
            const hay = `${h.nombres || ''} ${h.apellidos || ''} ${h.email || ''} ${h.nivel || ''} ${h.grado || ''} ${h.seccion || ''}`.toLowerCase();
            return hay.includes(query);
        });
        const visibles = filtrados.slice(0, state.hijosVisibleCount);
        const hayMas = filtrados.length > visibles.length;
        const canChooseDefault = state.hijos.length > 1;

        return `
            <section class="pf-panel">
                <div class="pf-section-head">
                    <div>
                        <h2>Hijos vinculados y ficha institucional</h2>
                        <p>Información oficial registrada por el colegio. Para vincular estudiantes o corregir DNI/correo contacta a Secretaría.</p>
                    </div>
                    <span class="pf-pill-locked"><i class="ph ph-lock-simple"></i> Solo lectura</span>
                </div>

                ${renderFeedback('familia')}

                <div class="pf-info-grid">
                    <div class="pf-info-tile">
                        <span class="pf-info-label">Rol institucional</span>
                        <strong class="pf-info-val">Apoderado / Padre de Familia</strong>
                    </div>
                    <div class="pf-info-tile">
                        <span class="pf-info-label">Correo de cuenta</span>
                        <strong class="pf-info-val">${escapeHtml(u.email || '—')}</strong>
                    </div>
                    <div class="pf-info-tile">
                        <span class="pf-info-label">DNI registrado</span>
                        <strong class="pf-info-val">${escapeHtml(u.dni || 'Pendiente en Secretaría')}</strong>
                    </div>
                    <div class="pf-info-tile">
                        <span class="pf-info-label">Fecha de nacimiento</span>
                        <strong class="pf-info-val">${escapeHtml(formatBirthDate(u.fechaNacimiento))}</strong>
                    </div>
                    <div class="pf-info-tile">
                        <span class="pf-info-label">Estudiantes vinculados</span>
                        <strong class="pf-info-val">${state.loadingHijos ? 'Consultando...' : `${state.hijos.length} estudiante(s)`}</strong>
                    </div>
                    <div class="pf-info-tile">
                        <span class="pf-info-label">Último acceso</span>
                        <strong class="pf-info-val">${escapeHtml(formatDateTime(u.ultimaConexion))}</strong>
                    </div>
                </div>

                <div class="pf-children-head">
                    <div>
                        <h3>Estudiantes a tu cargo</h3>
                        <p>Accede directo a calificaciones, asistencia o tareas de cada hijo.</p>
                    </div>
                    ${state.hijos.length > 4 ? `
                        <div class="pf-search-mini">
                            <i class="ph ph-magnifying-glass"></i>
                            <input type="search" id="pf-hijos-search" value="${escapeHtml(state.hijosQuery)}" placeholder="Buscar por nombre, grado o sección...">
                        </div>
                    ` : ''}
                </div>

                ${state.loadingHijos ? `
                    <div class="pf-empty-box">Cargando estudiantes vinculados...</div>
                ` : state.hijos.length === 0 ? `
                    <div class="pf-empty-box">
                        <i class="ph ph-users-three"></i>
                        <strong>No tienes estudiantes vinculados todavía</strong>
                        <p>Por seguridad escolar, solo Administración o Secretaría pueden asociar hijos a tu cuenta de apoderado.</p>
                        <a href="mensajes.html" class="pf-btn-secondary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;margin-top:8px;">
                            <i class="ph ph-chat-circle-dots"></i> Ir a Mensajes
                        </a>
                    </div>
                ` : visibles.length === 0 ? `
                    <div class="pf-empty-box">No hay estudiantes que coincidan con "${escapeHtml(state.hijosQuery)}".</div>
                ` : `
                    <div class="pf-children-list">
                        ${visibles.map((h) => {
                            const fullName = `${h.nombres || ''} ${h.apellidos || ''}`.trim() || 'Estudiante';
                            const isDefault = Number(prefs.defaultChildId) === h.id;
                            const foto = safeImageUrl(h.fotoPerfil);
                            const ini = getInitials(h);
                            return `
                                <article class="pf-child-card">
                                    <div class="pf-child-main">
                                        <div class="pf-child-avatar">
                                            ${foto ? `<img src="${escapeHtml(foto)}" alt="${escapeHtml(fullName)}">` : escapeHtml(ini)}
                                        </div>
                                        <div class="pf-child-meta">
                                            <div class="pf-child-name-row">
                                                <h4>${escapeHtml(fullName)}</h4>
                                                ${isDefault ? '<span class="pf-badge-default">Principal al abrir</span>' : ''}
                                            </div>
                                            <p class="pf-child-scope">${escapeHtml(formatGrupoHijo(h))}</p>
                                            <p class="pf-child-email">${escapeHtml(h.email || 'Sin correo institucional')}</p>
                                        </div>
                                    </div>
                                    <div class="pf-child-actions">
                                        ${canChooseDefault && !isDefault ? `
                                            <button type="button" class="pf-mini-btn is-outline" data-set-default-child="${h.id}">
                                                <i class="ph ph-star"></i> Fijar principal
                                            </button>
                                        ` : ''}
                                        <a href="calificaciones.html?hijoId=${h.id}" class="pf-mini-btn">Notas</a>
                                        <a href="asistencia.html?hijoId=${h.id}" class="pf-mini-btn">Asistencia</a>
                                        <a href="tareas.html?hijoId=${h.id}" class="pf-mini-btn">Tareas</a>
                                    </div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                    ${hayMas ? `
                        <div class="pf-more-wrap">
                            <button type="button" id="btn-more-hijos" class="pf-btn-secondary">
                                Ver más estudiantes (${filtrados.length - visibles.length} restantes)
                            </button>
                        </div>
                    ` : ''}
                `}
            </section>
        `;
    }

    function bindFamiliaEvents() {
        const searchEl = document.getElementById('pf-hijos-search');
        searchEl?.addEventListener('input', (e) => {
            state.hijosQuery = e.target.value;
            state.hijosVisibleCount = PAGE_SIZE_HIJOS;
            renderStage();
            const again = document.getElementById('pf-hijos-search');
            if (again) {
                again.focus();
                const len = again.value.length;
                again.setSelectionRange(len, len);
            }
        });

        document.getElementById('btn-more-hijos')?.addEventListener('click', () => {
            state.hijosVisibleCount += 12;
            renderStage();
        });

        document.querySelectorAll('[data-set-default-child]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const childId = Number(btn.getAttribute('data-set-default-child'));
                if (!childId || !window.PadresPrefs || !state.padre?.id) return;
                window.PadresPrefs.update(state.padre.id, { defaultChildId: childId });
                try {
                    sessionStorage.setItem(`shidell_padre_active_child_${state.padre.id}`, String(childId));
                } catch {}
                const chosen = state.hijos.find(h => h.id === childId);
                state.feedback = {
                    tab: 'familia',
                    type: 'success',
                    text: `${chosen ? `${chosen.nombres} ${chosen.apellidos}` : 'Estudiante'} quedó como hijo principal al abrir el portal.`
                };
                renderStage();
            });
        });
    }

    /* ----------------------------------------------------------------------
       TAB 3: PREFERENCIAS DE SEGUIMIENTO Y ALERTAS (LOCAL)
       ---------------------------------------------------------------------- */
    function renderPreferenciasTab() {
        const u = state.padre || {};
        const prefs = window.PadresPrefs ? window.PadresPrefs.get(u.id) : {
            defaultChildId: null,
            notifDefaultTab: 'all',
            notifPollMs: 30000,
            showNotifBadge: true,
            reduceMotion: false,
            contactSchedule: 'CUALQUIERA'
        };
        const hijosParaSelect = state.hijos.slice(0, 60);
        const elegido = state.hijos.find(h => h.id === Number(prefs.defaultChildId));
        if (elegido && !hijosParaSelect.some(h => h.id === elegido.id)) {
            hijosParaSelect.unshift(elegido);
        }

        return `
            <section class="pf-panel">
                <div class="pf-section-head">
                    <div>
                        <h2>Seguimiento familiar y notificaciones</h2>
                        <p>Personaliza cómo se comporta tu Portal Padres en este dispositivo. Los cambios se aplican al instante.</p>
                    </div>
                    <span class="pf-pill-editable"><i class="ph ph-sliders-horizontal"></i> Guardado automático</span>
                </div>

                <div id="pf-prefs-feedback">${renderFeedback('preferencias')}</div>

                ${state.hijos.length > 1 ? `
                    <div class="pf-pref-block">
                        <h3>Estudiante principal al ingresar</h3>
                        <div class="pf-pref-row">
                            <div class="pf-pref-copy">
                                <strong>Hijo mostrado por defecto</strong>
                                <span>Elige qué estudiante aparece primero cuando entras a Inicio, Notas, Asistencia o Tareas.</span>
                            </div>
                            <select id="pref-default-child" class="pf-select" aria-label="Hijo predeterminado al iniciar">
                                <option value="">Primero disponible (${escapeHtml(state.hijos[0]?.nombres || '')})</option>
                                ${hijosParaSelect.map(h => `
                                    <option value="${h.id}" ${Number(prefs.defaultChildId) === h.id ? 'selected' : ''}>
                                        ${escapeHtml(`${h.nombres || ''} ${h.apellidos || ''}`.trim())} (${escapeHtml(h.grado ? `${h.grado}° ${h.seccion || ''}` : h.nivel || 'Alumno')})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                ` : ''}

                <div class="pf-pref-block">
                    <h3>Alertas y centro de notificaciones</h3>
                    <div class="pf-pref-row">
                        <div class="pf-pref-copy">
                            <strong>Pestaña predeterminada al abrir la campana</strong>
                            <span>Prioriza avisos pendientes por leer (faltas o tareas) o el historial completo.</span>
                        </div>
                        <div class="pf-segmented" role="group" aria-label="Pestaña inicial de notificaciones">
                            <button type="button" class="pf-seg-btn ${prefs.notifDefaultTab === 'all' ? 'active' : ''}" data-pref-notif-tab="all">Todas</button>
                            <button type="button" class="pf-seg-btn ${prefs.notifDefaultTab === 'unread' ? 'active' : ''}" data-pref-notif-tab="unread">Sin leer</button>
                        </div>
                    </div>

                    <div class="pf-pref-row">
                        <div class="pf-pref-copy">
                            <strong>Frecuencia de actualización de alertas</strong>
                            <span>Cada cuánto el portal consulta nuevas inasistencias, notas o avisos docentes.</span>
                        </div>
                        <select id="pref-notif-poll" class="pf-select" aria-label="Frecuencia de notificaciones">
                            <option value="15000" ${prefs.notifPollMs === 15000 ? 'selected' : ''}>Cada 15 segundos</option>
                            <option value="30000" ${prefs.notifPollMs === 30000 ? 'selected' : ''}>Cada 30 segundos (estándar)</option>
                            <option value="60000" ${prefs.notifPollMs === 60000 ? 'selected' : ''}>Cada 60 segundos</option>
                            <option value="0" ${prefs.notifPollMs === 0 ? 'selected' : ''}>Solo manual al abrir la campana</option>
                        </select>
                    </div>

                    <div class="pf-pref-row">
                        <div class="pf-pref-copy">
                            <strong>Mostrar contador rojo en la campana</strong>
                            <span>Muestra la cantidad exacta de notificaciones sin leer en la barra superior.</span>
                        </div>
                        <button type="button" id="pref-show-badge" class="pf-switch" role="switch" aria-checked="${prefs.showNotifBadge}" aria-label="Mostrar contador en campana"></button>
                    </div>
                </div>

                <div class="pf-pref-block">
                    <h3>Apariencia visual</h3>
                    <div class="pf-pref-row">
                        <div class="pf-pref-copy">
                            <strong>Tema del Portal Padres</strong>
                            <span>Alterna entre modo claro diurno y modo oscuro nocturno para cuidar tu vista.</span>
                        </div>
                        <div class="pf-segmented" role="group" aria-label="Tema del portal">
                            <button type="button" class="pf-seg-btn" data-theme-choice="light">Claro</button>
                            <button type="button" class="pf-seg-btn" data-theme-choice="dark">Oscuro</button>
                        </div>
                    </div>
                </div>

                <div class="pf-pref-block">
                    <h3>Comunicación y comodidad</h3>
                    <div class="pf-pref-row">
                        <div class="pf-pref-copy">
                            <strong>Horario preferido para llamadas o reuniones</strong>
                            <span>Referencia guardada en este dispositivo para tus coordinaciones escolares.</span>
                        </div>
                        <select id="pref-contact-schedule" class="pf-select" aria-label="Horario preferido de contacto">
                            <option value="CUALQUIERA" ${prefs.contactSchedule === 'CUALQUIERA' ? 'selected' : ''}>Cualquier horario / Urgencias</option>
                            <option value="MANANA" ${prefs.contactSchedule === 'MANANA' ? 'selected' : ''}>Turno Mañana (08:00 - 12:00)</option>
                            <option value="TARDE" ${prefs.contactSchedule === 'TARDE' ? 'selected' : ''}>Turno Tarde (14:00 - 18:00)</option>
                        </select>
                    </div>

                    <div class="pf-pref-row">
                        <div class="pf-pref-copy">
                            <strong>Reducir animaciones y movimiento</strong>
                            <span>Desactiva transiciones suaves entre pantallas si prefieres respuesta directa.</span>
                        </div>
                        <button type="button" id="pref-reduce-motion" class="pf-switch" role="switch" aria-checked="${prefs.reduceMotion}" aria-label="Reducir animaciones"></button>
                    </div>
                </div>

                <div class="pf-form-footer">
                    <span class="pf-dirty-text"><i class="ph ph-check-circle"></i> Preferencias aplicadas localmente</span>
                    <button type="button" id="btn-reset-prefs" class="pf-btn-secondary">
                        <i class="ph ph-arrow-counter-clockwise"></i> Restaurar recomendadas
                    </button>
                </div>
            </section>
        `;
    }

    function showPrefFeedback(text) {
        const host = document.getElementById('pf-prefs-feedback');
        if (!host) return;
        host.innerHTML = `
            <div class="pf-feedback is-info" role="status" aria-live="polite">
                <i class="ph-fill ph-check-circle"></i>
                <span>${escapeHtml(text)}</span>
            </div>
        `;
    }

    function bindPreferenciasEvents() {
        const pid = state.padre?.id;
        if (!pid || !window.PadresPrefs) return;

        document.getElementById('pref-default-child')?.addEventListener('change', (e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            window.PadresPrefs.update(pid, { defaultChildId: val });
            try {
                if (val) sessionStorage.setItem(`shidell_padre_active_child_${pid}`, String(val));
                else sessionStorage.removeItem(`shidell_padre_active_child_${pid}`);
            } catch {}
            showPrefFeedback('Hijo predeterminado actualizado para tus próximas consultas.');
        });

        document.querySelectorAll('[data-pref-notif-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-pref-notif-tab');
                window.PadresPrefs.update(pid, { notifDefaultTab: tab });
                document.querySelectorAll('[data-pref-notif-tab]').forEach((other) => {
                    other.classList.toggle('active', other.getAttribute('data-pref-notif-tab') === tab);
                });
                showPrefFeedback(tab === 'unread' ? 'La campana priorizará avisos sin leer.' : 'La campana mostrará todas las notificaciones.');
            });
        });

        document.getElementById('pref-notif-poll')?.addEventListener('change', (e) => {
            window.PadresPrefs.update(pid, { notifPollMs: Number(e.target.value) });
            showPrefFeedback('Frecuencia de consulta de notificaciones actualizada.');
        });

        const badgeSwitch = document.getElementById('pref-show-badge');
        badgeSwitch?.addEventListener('click', () => {
            const next = badgeSwitch.getAttribute('aria-checked') !== 'true';
            badgeSwitch.setAttribute('aria-checked', String(next));
            window.PadresPrefs.update(pid, { showNotifBadge: next });
            showPrefFeedback(next ? 'Contador visible en la campana.' : 'Contador oculto en la barra superior.');
        });

        document.getElementById('pref-contact-schedule')?.addEventListener('change', (e) => {
            window.PadresPrefs.update(pid, { contactSchedule: e.target.value });
            showPrefFeedback('Horario preferido de contacto guardado en este equipo.');
        });

        const motionSwitch = document.getElementById('pref-reduce-motion');
        motionSwitch?.addEventListener('click', () => {
            const next = motionSwitch.getAttribute('aria-checked') !== 'true';
            motionSwitch.setAttribute('aria-checked', String(next));
            window.PadresPrefs.update(pid, { reduceMotion: next });
            showPrefFeedback(next ? 'Movimiento reducido activado.' : 'Transiciones modernas activadas.');
        });

        document.getElementById('btn-reset-prefs')?.addEventListener('click', () => {
            window.PadresPrefs.reset(pid);
            state.feedback = { tab: 'preferencias', type: 'success', text: 'Preferencias restauradas a los valores recomendados.' };
            renderStage();
        });
    }

    /* ----------------------------------------------------------------------
       TAB 4: SEGURIDAD Y CONTRASEÑA REAL (VERIFICA CONTRASEÑA ACTUAL)
       ---------------------------------------------------------------------- */
    function renderSeguridadTab() {
        const u = state.padre || {};
        return `
            <section class="pf-panel">
                <div class="pf-section-head">
                    <div>
                        <h2>Seguridad y control de acceso</h2>
                        <p>Cambia tu contraseña verificando primero tu clave actual para proteger el acceso familiar.</p>
                    </div>
                    <span class="pf-pill-editable"><i class="ph ph-shield-check"></i> Verificado en servidor</span>
                </div>

                ${renderFeedback('seguridad')}

                <form id="pf-password-form" class="pf-form pf-password-form" novalidate>
                    <div class="pf-field">
                        <label for="cfg-pass-actual">Contraseña actual <span class="pf-req">*</span></label>
                        <div class="pf-input-wrap">
                            <input type="password" id="cfg-pass-actual" autocomplete="current-password" placeholder="Ingresa tu contraseña actual" required>
                            <button type="button" class="pf-eye-btn" data-toggle-pass="cfg-pass-actual" aria-label="Mostrar u ocultar contraseña actual">
                                <i class="ph ph-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div class="pf-grid-2">
                        <div class="pf-field">
                            <label for="cfg-pass-nueva">Nueva contraseña <small>Mínimo 6 caracteres</small></label>
                            <div class="pf-input-wrap">
                                <input type="password" id="cfg-pass-nueva" minlength="6" autocomplete="new-password" placeholder="Nueva contraseña" required>
                                <button type="button" class="pf-eye-btn" data-toggle-pass="cfg-pass-nueva" aria-label="Mostrar u ocultar nueva contraseña">
                                    <i class="ph ph-eye"></i>
                                </button>
                            </div>
                            <div class="pf-strength">
                                <div class="pf-strength-track"><div id="pf-strength-fill" class="pf-strength-fill"></div></div>
                                <span id="pf-strength-label" class="pf-strength-label">Sin definir</span>
                            </div>
                        </div>

                        <div class="pf-field">
                            <label for="cfg-pass-confirm">Confirmar nueva contraseña</label>
                            <div class="pf-input-wrap">
                                <input type="password" id="cfg-pass-confirm" minlength="6" autocomplete="new-password" placeholder="Repite la nueva contraseña" required>
                                <button type="button" class="pf-eye-btn" data-toggle-pass="cfg-pass-confirm" aria-label="Mostrar u ocultar confirmación">
                                    <i class="ph ph-eye"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="pf-actions-left">
                        <button type="submit" id="btn-save-password" class="pf-btn-primary">
                            <i class="ph ph-key"></i> Actualizar contraseña
                        </button>
                    </div>
                </form>

                <div class="pf-pref-block" style="margin-top:26px;">
                    <h3>Estado de tu sesión</h3>
                    <div class="pf-pref-row">
                        <div class="pf-pref-copy">
                            <strong>Cuenta activa</strong>
                            <span>${escapeHtml(u.email || '—')} · Rol PADRE</span>
                        </div>
                        <span class="pf-status-badge"><span class="pf-status-dot"></span> Sesión verificada</span>
                    </div>
                    <div class="pf-pref-row">
                        <div class="pf-pref-copy">
                            <strong>Última conexión registrada</strong>
                            <span>${escapeHtml(formatDateTime(u.ultimaConexion))}</span>
                        </div>
                        <button type="button" id="btn-cfg-logout" class="pf-btn-danger-outline">
                            <i class="ph ph-sign-out"></i> Cerrar sesión
                        </button>
                    </div>
                </div>
            </section>
        `;
    }

    function bindSeguridadEvents() {
        document.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.getAttribute('data-toggle-pass'));
                if (!target) return;
                const isPwd = target.type === 'password';
                target.type = isPwd ? 'text' : 'password';
                btn.innerHTML = `<i class="ph ${isPwd ? 'ph-eye-slash' : 'ph-eye'}"></i>`;
            });
        });

        const passActualEl = document.getElementById('cfg-pass-actual');
        const passNuevaEl = document.getElementById('cfg-pass-nueva');
        const passConfirmEl = document.getElementById('cfg-pass-confirm');
        const fillEl = document.getElementById('pf-strength-fill');
        const labelEl = document.getElementById('pf-strength-label');

        passNuevaEl?.addEventListener('input', () => {
            const st = passwordStrength(passNuevaEl.value);
            if (fillEl) {
                fillEl.style.width = `${st.pct}%`;
                fillEl.style.backgroundColor = st.color;
            }
            if (labelEl) labelEl.textContent = st.label;
        });

        const form = document.getElementById('pf-password-form');
        const btnSave = document.getElementById('btn-save-password');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.padre?.id) return;

            const currentPassword = passActualEl?.value || '';
            const newPassword = passNuevaEl?.value || '';
            const confirmPassword = passConfirmEl?.value || '';

            if (!currentPassword.trim()) {
                state.feedback = { tab: 'seguridad', type: 'error', text: 'Debes ingresar tu contraseña actual para confirmar tu identidad.' };
                renderStage();
                return;
            }
            if (newPassword.trim().length < 6) {
                state.feedback = { tab: 'seguridad', type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres.' };
                renderStage();
                return;
            }
            if (newPassword !== confirmPassword) {
                state.feedback = { tab: 'seguridad', type: 'error', text: 'La confirmación no coincide con la nueva contraseña.' };
                renderStage();
                return;
            }

            if (btnSave) {
                btnSave.disabled = true;
                btnSave.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Verificando...';
            }

            try {
                const res = await apiJson(`/api/users/${state.padre.id}/password`, {
                    method: 'PUT',
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                state.feedback = {
                    tab: 'seguridad',
                    type: 'success',
                    text: res?.message || 'Contraseña actualizada correctamente. Tu sesión sigue activa.'
                };
            } catch (err) {
                state.feedback = {
                    tab: 'seguridad',
                    type: 'error',
                    text: err.message || 'No se pudo actualizar la contraseña.'
                };
            }

            renderStage();
        });

        document.getElementById('btn-cfg-logout')?.addEventListener('click', async () => {
            const proceed = async () => {
                let currentUser = null;
                try { currentUser = JSON.parse(localStorage.getItem('shidell_user') || 'null'); } catch {}
                if (window.ShidellPresence?.notifyLogout) {
                    await window.ShidellPresence.notifyLogout(currentUser);
                } else {
                    const headers = currentUser?.sessionToken ? { Authorization: `Bearer ${currentUser.sessionToken}` } : {};
                    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', keepalive: true, headers }).catch(() => {});
                }
                localStorage.removeItem('shidell_user');
                localStorage.removeItem('shidell_admin');
                try {
                    sessionStorage.removeItem(`shidell_padre_active_child_${state.padre?.id}`);
                } catch {}
                const go = () => { window.location.href = '/login.html'; };
                if (window.ShidellMotion && typeof window.ShidellMotion.playPortalHandoff === 'function') {
                    window.ShidellMotion.playPortalHandoff({ rol: 'AUTH' }, go);
                } else {
                    go();
                }
            };

            if (window.Swal) {
                const ans = await window.Swal.fire({
                    icon: 'question',
                    title: '¿Cerrar sesión familiar?',
                    text: 'Deberás volver a ingresar con tu correo y contraseña.',
                    showCancelButton: true,
                    confirmButtonText: 'Cerrar sesión',
                    cancelButtonText: 'Cancelar'
                });
                if (ans.isConfirmed) proceed();
            } else if (window.confirm('¿Deseas cerrar tu sesión en este dispositivo?')) {
                proceed();
            }
        });
    }

    function renderStage() {
        const stage = document.getElementById('pf-cfg-stage');
        if (!stage) return;

        if (state.activeTab === 'perfil') {
            stage.innerHTML = renderPerfilTab();
            bindPerfilEvents();
        } else if (state.activeTab === 'familia') {
            stage.innerHTML = renderFamiliaTab();
            bindFamiliaEvents();
        } else if (state.activeTab === 'preferencias') {
            stage.innerHTML = renderPreferenciasTab();
            bindPreferenciasEvents();
            window.ShidellTheme?.syncUI();
        } else if (state.activeTab === 'seguridad') {
            stage.innerHTML = renderSeguridadTab();
            bindSeguridadEvents();
        }
    }

    function bindShellEvents() {
        document.querySelectorAll('[data-pf-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const next = btn.getAttribute('data-pf-tab');
                if (!next || next === state.activeTab) return;
                state.activeTab = next;
                state.feedback = null;
                document.querySelectorAll('[data-pf-tab]').forEach((other) => {
                    const active = other.getAttribute('data-pf-tab') === next;
                    other.classList.toggle('active', active);
                    other.setAttribute('aria-selected', String(active));
                });
                renderStage();
            });
        });

        const fileInput = document.getElementById('cfg-foto');
        fileInput?.addEventListener('change', handlePhotoUpload);
        document.getElementById('btn-quitar-foto')?.addEventListener('click', handlePhotoRemove);
    }

    async function cargarDatosIniciales() {
        if (!state.padre?.id) return;
        const [userRes, hijosRes] = await Promise.allSettled([
            apiJson(`/api/users/${state.padre.id}`),
            apiJson(`/api/admin/padres/${state.padre.id}/hijos`)
        ]);

        if (userRes.status === 'fulfilled' && userRes.value) {
            persistLocalPadre(userRes.value);
        }

        state.loadingHijos = false;
        if (hijosRes.status === 'fulfilled' && Array.isArray(hijosRes.value)) {
            state.hijos = hijosRes.value;
        } else {
            state.hijos = [];
        }

        syncPadreUI(state.padre);
        if (!state.editingPerfil && !state.isDirtyPerfil) {
            renderStage();
        } else if (state.activeTab === 'familia' || state.activeTab === 'preferencias') {
            renderStage();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        try {
            state.padre = JSON.parse(localStorage.getItem('shidell_user') || 'null');
        } catch {
            state.padre = null;
        }
        if (!state.padre?.id || !state.padre?.sessionToken || state.padre.rol !== 'PADRE') {
            return; // app.js redirige a login
        }

        const tabParam = new URLSearchParams(window.location.search).get('tab');
        if (['perfil', 'familia', 'preferencias', 'seguridad'].includes(tabParam)) {
            state.activeTab = tabParam;
            document.querySelectorAll('[data-pf-tab]').forEach((btn) => {
                const active = btn.getAttribute('data-pf-tab') === tabParam;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-selected', String(active));
            });
        }

        syncPadreUI(state.padre);
        bindShellEvents();
        renderStage();
        cargarDatosIniciales();
    });
})();
