/* ==========================================================================
   SHIDELL AUTH MOTION ENGINE (Web Animations API + HiDPI Canvas + Spring 3D)
   Opera sobre el diseño y colores originales (#FFFFFF / #144272 / #0a2647).
   ========================================================================== */
(() => {
    'use strict';

    const reducedMotion = () =>
        document.documentElement.dataset.motion === 'reduced' ||
        Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    function resolvePortalRoute(rol) {
        const key = String(rol || 'ESTUDIANTE').toUpperCase();
        if (key === 'DOCENTE') return '../plataformadocente/index.html';
        if (key === 'ADMINISTRADOR' || key === 'ADMIN') return '../plataformaadmin/html/dashboard.html';
        if (key === 'PADRE') return '../plataformapadres/html/portalpadres.html';
        return '../plataformaestudiante/html/portalestudiante.html';
    }

    /* ----------------------------------------------------------------------
       1. INTRODUCCIÓN SVG + IRIS CLIP-PATH (Conserva paleta cobalto Shidell)
       ---------------------------------------------------------------------- */
    function initIntroSplash(onComplete) {
        const splash = document.getElementById('intro-splash');
        if (!splash) {
            onComplete();
            return;
        }

        let seen = false;
        try {
            seen = sessionStorage.getItem('shidell_splash_seen') === '1';
        } catch {
            seen = false;
        }

        if (seen || reducedMotion()) {
            splash.remove();
            onComplete();
            return;
        }

        try {
            sessionStorage.setItem('shidell_splash_seen', '1');
        } catch {
            // Ignorar si sessionStorage está restringido
        }

        const content = splash.querySelector('.intro-content');
        setTimeout(() => {
            if (typeof splash.animate !== 'function') {
                splash.remove();
                onComplete();
                return;
            }

            // Disparar la coreografía justo cuando abre el iris para transición continua
            setTimeout(onComplete, 120);

            if (content) {
                content.animate([
                    { opacity: 1, transform: 'scale(1)' },
                    { opacity: 0, transform: 'scale(1.06)' }
                ], {
                    duration: 240,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'forwards'
                });
            }

            const irisAnim = splash.animate([
                { clipPath: 'circle(150vmax at 50% 50%)', opacity: 1 },
                { clipPath: 'circle(0px at 50% 50%)', opacity: 0.7 }
            ], {
                duration: 380,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'forwards'
            });

            irisAnim.finished.catch(() => {}).finally(() => {
                splash.remove();
            });
        }, 520);
    }

    /* ----------------------------------------------------------------------
       2. CONSTELACIÓN HiDPI EN CANVAS SOBRE PANEL COBALTO (.auth-right)
       ---------------------------------------------------------------------- */
    function createRightCanvasEngine() {
        const panel = document.querySelector('.auth-right');
        const canvas = document.getElementById('auth-right-canvas');
        if (!panel || !canvas || !canvas.getContext) {
            return { burst: () => {} };
        }

        const ctx = canvas.getContext('2d');
        const pointer = { x: -9999, y: -9999, inside: false };
        let width = 0;
        let height = 0;
        let dpr = 1;
        let rafId = 0;

        const nodes = [];
        const rings = [];
        const sparks = [];

        function seedNodes() {
            nodes.length = 0;
            const count = clamp(Math.round((width * height) / 14500), 22, 46);
            for (let i = 0; i < count; i++) {
                nodes.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.42,
                    vy: (Math.random() - 0.5) * 0.42,
                    r: 1.5 + Math.random() * 2.1,
                    alpha: 0.25 + Math.random() * 0.45,
                    tint: i % 3 === 0 ? '147, 197, 253' : '255, 255, 255'
                });
            }
        }

        function resize() {
            const rect = panel.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 10) return;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = rect.width;
            height = rect.height;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seedNodes();
        }

        function addRing(x, y, maxR = 135, rgb = '255, 255, 255') {
            rings.push({ x, y, r: 8, maxR, alpha: 0.55, rgb });
        }

        function burst(clientX, clientY, rgb = '16, 185, 129') {
            if (reducedMotion()) return;
            const rect = panel.getBoundingClientRect();
            const originX = clientX ? clamp(clientX - rect.left, 40, Math.max(width - 40, 40)) : width * 0.5;
            const originY = clientY ? clamp(clientY - rect.top, 40, Math.max(height - 40, 40)) : height * 0.5;
            addRing(originX, originY, 210, rgb);

            for (let i = 0; i < 32; i++) {
                const angle = (Math.PI * 2 * i) / 32 + Math.random() * 0.2;
                const speed = 1.6 + Math.random() * 3.8;
                sparks.push({
                    x: originX,
                    y: originY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 0.5,
                    size: 1.8 + Math.random() * 2.6,
                    life: 1,
                    rgb: i % 2 === 0 ? rgb : '255, 255, 255'
                });
            }
        }

        panel.addEventListener('pointermove', (e) => {
            const rect = panel.getBoundingClientRect();
            pointer.x = e.clientX - rect.left;
            pointer.y = e.clientY - rect.top;
            pointer.inside = true;
        });

        panel.addEventListener('pointerleave', () => {
            pointer.inside = false;
        });

        panel.addEventListener('pointerdown', (e) => {
            if (reducedMotion()) return;
            const rect = panel.getBoundingClientRect();
            addRing(e.clientX - rect.left, e.clientY - rect.top, 145, '191, 219, 254');
        });

        function renderFrame() {
            if (document.hidden || width < 10) {
                rafId = requestAnimationFrame(renderFrame);
                return;
            }

            ctx.clearRect(0, 0, width, height);
            const connectDist = 128;

            for (let i = 0; i < nodes.length; i++) {
                const p = nodes[i];

                if (!reducedMotion()) {
                    if (pointer.inside) {
                        const dx = pointer.x - p.x;
                        const dy = pointer.y - p.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist > 1 && dist < 175) {
                            const force = ((175 - dist) / 175) * 0.045;
                            p.vx += (dx / dist) * force;
                            p.vy += (dy / dist) * force;
                        }
                    }

                    p.vx *= 0.992;
                    p.vy *= 0.992;
                    p.x += p.vx;
                    p.y += p.vy;

                    if (p.x < -12) p.x = width + 12;
                    if (p.x > width + 12) p.x = -12;
                    if (p.y < -12) p.y = height + 12;
                    if (p.y > height + 12) p.y = -12;
                }

                for (let j = i + 1; j < nodes.length; j++) {
                    const q = nodes[j];
                    const dx = p.x - q.x;
                    const dy = p.y - q.y;
                    const d = Math.hypot(dx, dy);
                    if (d < connectDist) {
                        const lineAlpha = (1 - d / connectDist) * 0.22;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.strokeStyle = `rgba(219, 234, 254, ${lineAlpha.toFixed(3)})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }

                if (pointer.inside) {
                    const pd = Math.hypot(pointer.x - p.x, pointer.y - p.y);
                    if (pd < 150) {
                        const pAlpha = (1 - pd / 150) * 0.36;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(pointer.x, pointer.y);
                        ctx.strokeStyle = `rgba(255, 255, 255, ${pAlpha.toFixed(3)})`;
                        ctx.lineWidth = 1.05;
                        ctx.stroke();
                    }
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.tint}, ${p.alpha})`;
                ctx.fill();
            }

            for (let i = rings.length - 1; i >= 0; i--) {
                const rg = rings[i];
                rg.r += 3.2;
                rg.alpha *= 0.945;
                if (rg.alpha < 0.02 || rg.r > rg.maxR) {
                    rings.splice(i, 1);
                    continue;
                }
                ctx.beginPath();
                ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${rg.rgb}, ${rg.alpha.toFixed(3)})`;
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }

            for (let i = sparks.length - 1; i >= 0; i--) {
                const sp = sparks[i];
                sp.x += sp.vx;
                sp.y += sp.vy;
                sp.vy += 0.04;
                sp.vx *= 0.975;
                sp.life -= 0.022;
                if (sp.life <= 0) {
                    sp.size = 0;
                    sparks.splice(i, 1);
                    continue;
                }
                ctx.beginPath();
                ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${sp.rgb}, ${clamp(sp.life, 0, 1).toFixed(3)})`;
                ctx.fill();
            }

            rafId = requestAnimationFrame(renderFrame);
        }

        resize();
        window.addEventListener('resize', resize, { passive: true });
        rafId = requestAnimationFrame(renderFrame);

        window.addEventListener('pagehide', () => {
            if (rafId) cancelAnimationFrame(rafId);
        });

        return { burst };
    }

    /* ----------------------------------------------------------------------
       3. SPRING 3D PARALLAX EN PANEL DERECHO Y SPOTLIGHT EN .auth-card
       ---------------------------------------------------------------------- */
    function initParallaxAndSpotlight() {
        if (reducedMotion()) return;

        const card = document.querySelector('.auth-card');
        if (card) {
            card.addEventListener('pointermove', (e) => {
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
                card.style.setProperty('--my', `${e.clientY - rect.top}px`);
            }, { passive: true });
        }

        const rightPanel = document.querySelector('.auth-right');
        const rightContent = document.querySelector('.auth-right-content');
        const c1 = document.querySelector('.auth-right .circle-1');
        const c2 = document.querySelector('.auth-right .circle-2');
        if (!rightPanel || !rightContent) return;

        let tx = 0, ty = 0, cx = 0, cy = 0;

        rightPanel.addEventListener('pointermove', (e) => {
            const rect = rightPanel.getBoundingClientRect();
            const nx = ((e.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
            const ny = ((e.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
            tx = clamp(nx, -1, 1);
            ty = clamp(ny, -1, 1);
        }, { passive: true });

        rightPanel.addEventListener('pointerleave', () => {
            tx = 0;
            ty = 0;
        });

        function tickParallax() {
            cx = lerp(cx, tx, 0.08);
            cy = lerp(cy, ty, 0.08);

            rightContent.style.transform =
                `rotateX(${(-cy * 4.5).toFixed(2)}deg) rotateY(${(cx * 5.5).toFixed(2)}deg) translate3d(${(cx * 6).toFixed(1)}px, ${(cy * 5).toFixed(1)}px, 0)`;

            if (c1) {
                c1.style.transform = `translate3d(${(-cx * 18).toFixed(1)}px, ${(-cy * 16).toFixed(1)}px, 0)`;
            }
            if (c2) {
                c2.style.transform = `translate3d(${(cx * 14).toFixed(1)}px, ${(cy * 12).toFixed(1)}px, 0)`;
            }

            requestAnimationFrame(tickParallax);
        }

        requestAnimationFrame(tickParallax);
    }

    /* ----------------------------------------------------------------------
       4. COREOGRAFÍA DE ENTRADA WAAPI ESCALONADA
       ---------------------------------------------------------------------- */
    function playEntranceChoreography() {
        if (reducedMotion() || typeof Element.prototype.animate !== 'function') return;

        const card = document.querySelector('.auth-card');
        if (card) {
            card.animate([
                { opacity: 0, translate: '0 14px', scale: '0.985' },
                { opacity: 1, translate: '0 0', scale: '1' }
            ], {
                duration: 320,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'backwards'
            });
        }

        const seq = [
            document.querySelector('.auth-logo'),
            document.querySelector('.auth-header h1'),
            document.querySelector('.auth-header p'),
            ...document.querySelectorAll('.auth-form .form-group'),
            document.querySelector('.form-options'),
            document.querySelector('.auth-btn'),
            document.querySelector('.auth-footer')
        ].filter(Boolean);

        seq.forEach((el, idx) => {
            el.animate([
                { opacity: 0, translate: '0 10px' },
                { opacity: 1, translate: '0 0' }
            ], {
                duration: 280,
                delay: 20 + idx * 22,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'backwards'
            });
        });

        const hero = document.querySelector('.auth-right-content');
        if (hero) {
            hero.animate([
                { opacity: 0, translate: '0 16px' },
                { opacity: 1, translate: '0 0' }
            ], {
                duration: 360,
                delay: 40,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'backwards'
            });
        }
    }

    function installIllustrationFallback() {
        const img = document.querySelector('.auth-illustration img');
        if (!img) return;
        const applyFallback = () => {
            const box = img.parentElement;
            if (!box || box.dataset.fallbackApplied) return;
            box.dataset.fallbackApplied = '1';
            box.innerHTML = `
                <svg viewBox="0 0 220 150" width="210" height="145" fill="none" aria-hidden="true" style="margin:0 auto;display:block;filter:drop-shadow(0 14px 28px rgba(10,38,71,0.35))">
                    <rect x="28" y="24" width="164" height="104" rx="16" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.32)" stroke-width="1.8"/>
                    <rect x="44" y="42" width="58" height="10" rx="5" fill="rgba(255,255,255,0.85)"/>
                    <rect x="44" y="60" width="92" height="7" rx="3.5" fill="rgba(255,255,255,0.42)"/>
                    <rect x="44" y="75" width="76" height="7" rx="3.5" fill="rgba(255,255,255,0.42)"/>
                    <rect x="44" y="94" width="54" height="16" rx="8" fill="#ffffff"/>
                    <circle cx="158" cy="76" r="24" fill="rgba(255,255,255,0.16)" stroke="#ffffff" stroke-width="2"/>
                    <path d="M148 76 L155 83 L169 68" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        };
        img.addEventListener('error', applyFallback, { once: true });
        if (img.complete && img.naturalWidth === 0) applyFallback();
    }

    /* ----------------------------------------------------------------------
       5. MICRO-INTERACCIONES DE FORMULARIO, MAGNETIC CTA Y RIPPLE
       ---------------------------------------------------------------------- */
    function initFormMicroInteractions() {
        // Mostrar/ocultar contraseña
        const toggleBtn = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('password');
        if (toggleBtn && passwordInput) {
            toggleBtn.addEventListener('click', () => {
                const isPwd = passwordInput.type === 'password';
                passwordInput.type = isPwd ? 'text' : 'password';
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.className = isPwd ? 'ph ph-eye-slash' : 'ph ph-eye';
                }
                toggleBtn.setAttribute('aria-pressed', String(isPwd));
                if (!reducedMotion() && typeof toggleBtn.animate === 'function') {
                    toggleBtn.animate([
                        { transform: 'translateY(-50%) scale(0.84)' },
                        { transform: 'translateY(-50%) scale(1.08)' },
                        { transform: 'translateY(-50%) scale(1)' }
                    ], { duration: 240, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
                }
            });
        }

        // Indicador válido en correo electrónico
        const emailInput = document.getElementById('email');
        const emailValidBadge = document.getElementById('email-valid-badge');
        if (emailInput && emailValidBadge) {
            const validateEmailUI = () => {
                const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
                emailValidBadge.classList.toggle('is-visible', ok);
            };
            emailInput.addEventListener('input', validateEmailUI);
            validateEmailUI();
        }

        // Limpiar estado de error al editar campos
        document.querySelectorAll('.input-wrapper input, .input-wrapper select').forEach((field) => {
            field.addEventListener('input', () => {
                field.closest('.input-wrapper')?.classList.remove('has-error');
            });
        });

        // Botón principal: pull magnético + onda de clic
        const btn = document.querySelector('.auth-btn');
        if (!btn) return;

        if (!reducedMotion()) {
            btn.addEventListener('pointermove', (e) => {
                const rect = btn.getBoundingClientRect();
                const nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
                const ny = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
                btn.style.setProperty('--mag-x', `${clamp(nx * 4.5, -5, 5).toFixed(1)}px`);
                btn.style.setProperty('--mag-y', `${clamp(ny * 3, -3.5, 3.5).toFixed(1)}px`);
            });
            btn.addEventListener('pointerleave', () => {
                btn.style.setProperty('--mag-x', '0px');
                btn.style.setProperty('--mag-y', '0px');
            });
        }

        btn.addEventListener('pointerdown', (e) => {
            if (reducedMotion()) return;
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 2.1;
            const ripple = document.createElement('span');
            ripple.className = 'auth-ripple';
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left}px`;
            ripple.style.top = `${e.clientY - rect.top}px`;
            btn.appendChild(ripple);

            const anim = ripple.animate([
                { transform: 'translate(-50%, -50%) scale(0)', opacity: 0.45 },
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }
            ], { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
            anim.finished.catch(() => {}).finally(() => ripple.remove());
        });
    }

    function setButtonState(btn, state, text) {
        if (!btn) return;
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
        }

        btn.classList.remove('is-loading', 'is-success');
        if (state === 'loading') {
            btn.disabled = true;
            btn.classList.add('is-loading');
            btn.innerHTML = `<span class="auth-btn-label"><span class="auth-btn-spinner" aria-hidden="true"></span><span>${text || 'Verificando...'}</span></span>`;
        } else if (state === 'success') {
            btn.disabled = true;
            btn.classList.add('is-success');
            btn.innerHTML = `
                <span class="auth-btn-label">
                    <svg class="auth-btn-check" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                    <span>${text || '¡Acceso concedido!'}</span>
                </span>
            `;
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalHtml;
        }
    }

    function shakeErrorCard() {
        const card = document.querySelector('.auth-card');
        document.querySelectorAll('.input-wrapper').forEach((w) => w.classList.add('has-error'));
        if (!card || reducedMotion() || typeof card.animate !== 'function') return;
        card.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-8px)' },
            { transform: 'translateX(7px)' },
            { transform: 'translateX(-5px)' },
            { transform: 'translateX(3px)' },
            { transform: 'translateX(0)' }
        ], { duration: 400, easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)' });
    }

    function handoffToPortal({ rol, name, originEl, canvasEngine }) {
        const targetUrl = resolvePortalRoute(rol);
        const go = () => {
            window.location.href = targetUrl;
        };

        if (canvasEngine && originEl) {
            const rect = originEl.getBoundingClientRect();
            canvasEngine.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, '16, 185, 129');
        }

        setTimeout(() => {
            if (window.ShidellMotion && typeof window.ShidellMotion.playPortalHandoff === 'function') {
                window.ShidellMotion.playPortalHandoff({ rol, name, originEl }, go);
            } else {
                go();
            }
        }, 320);
    }

    /* ----------------------------------------------------------------------
       6. ARRANQUE Y CONEXIÓN CON FORMULARIOS ORIGINALES DE LOGIN / REGISTRO
       ---------------------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', () => {
        const canvasEngine = createRightCanvasEngine();
        installIllustrationFallback();
        initParallaxAndSpotlight();
        initFormMicroInteractions();
        initIntroSplash(playEntranceChoreography);

        // Formulario de Login (respeta #email, #password, localStorage y AppAlerts)
        const loginForm = document.querySelector('form.auth-form:not(#registerForm)');
        if (loginForm) {
            const rememberCheckbox = document.getElementById('remember-me');
            const emailField = document.getElementById('email');
            if (rememberCheckbox && emailField) {
                try {
                    const savedEmail = localStorage.getItem('shidell_remember_email');
                    if (savedEmail) {
                        emailField.value = savedEmail;
                        rememberCheckbox.checked = true;
                        emailField.dispatchEvent(new Event('input'));
                    }
                } catch {
                    // Ignorar
                }
            }

            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;
                const submitBtn = loginForm.querySelector('.auth-btn');

                setButtonState(submitBtn, 'loading', 'Verificando...');

                try {
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });

                    if (response.ok) {
                        const user = await response.json();
                        localStorage.setItem('shidell_user', JSON.stringify(user));
                        if (user.rol === 'ADMINISTRADOR' || user.rol === 'ADMIN') {
                            localStorage.setItem('shidell_admin', JSON.stringify(user));
                        } else {
                            localStorage.removeItem('shidell_admin');
                        }

                        if (rememberCheckbox) {
                            try {
                                if (rememberCheckbox.checked) {
                                    localStorage.setItem('shidell_remember_email', email);
                                } else {
                                    localStorage.removeItem('shidell_remember_email');
                                }
                            } catch {
                                // Ignorar
                            }
                        }

                        const rolUpper = user.rol ? user.rol.toUpperCase() : '';
                        if (!['ESTUDIANTE', 'DOCENTE', 'ADMINISTRADOR', 'ADMIN', 'PADRE'].includes(rolUpper)) {
                            setButtonState(submitBtn, 'idle');
                            shakeErrorCard();
                            AppAlerts.mostrarError('Rol no reconocido', user.rol);
                            return;
                        }

                        setButtonState(submitBtn, 'success', '¡Acceso concedido!');
                        handoffToPortal({
                            rol: rolUpper,
                            name: user.nombres || user.nombre || '',
                            originEl: submitBtn,
                            canvasEngine
                        });
                    } else {
                        const errorMsg = await response.json().catch(() => ({}));
                        setButtonState(submitBtn, 'idle');
                        shakeErrorCard();
                        AppAlerts.mostrarError(
                            errorMsg.error || 'El correo o la contraseña no coinciden.',
                            'Revisa tus datos e intenta de nuevo.'
                        );
                    }
                } catch (error) {
                    console.error('Error en inicio de sesión:', error);
                    setButtonState(submitBtn, 'idle');
                    shakeErrorCard();
                    AppAlerts.mostrarError('No pudimos conectarnos ahora mismo.', 'Revisa tu conexión a internet e intenta otra vez.');
                }
            });
        }

        // Formulario de Registro (respeta #nombres, #apellidos, #email, #password, #rol)
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const submitBtn = registerForm.querySelector('.auth-btn');
                const payload = {
                    nombres: document.getElementById('nombres').value.trim(),
                    apellidos: document.getElementById('apellidos').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value,
                    rol: document.getElementById('rol').value
                };

                setButtonState(submitBtn, 'loading', 'Creando cuenta...');

                try {
                    const res = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'No se pudo registrar la cuenta');

                    try {
                        localStorage.setItem('shidell_user', JSON.stringify(data));
                    } catch {
                        // Ignorar
                    }

                    const rolUpper = String(data.rol || payload.rol || 'ESTUDIANTE').toUpperCase();
                    setButtonState(submitBtn, 'success', '¡Cuenta creada!');
                    handoffToPortal({
                        rol: rolUpper,
                        name: data.nombres || payload.nombres || '',
                        originEl: submitBtn,
                        canvasEngine
                    });
                } catch (error) {
                    setButtonState(submitBtn, 'idle');
                    shakeErrorCard();
                    AppAlerts.mostrarError(
                        'No pudimos crear tu cuenta en este momento.',
                        error?.message || 'Revisa tus datos e intenta nuevamente.'
                    );
                }
            });
        }
    });
})();
