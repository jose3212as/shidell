/**
 * SHIDELL — UNIVERSAL ANDROID & PC SHELL (mobile-shell.js)
 * Proporciona navegación estilo App Android (Drawer deslizable con gestos táctiles,
 * Bottom Navigation Bar Material You, Chat adaptable tipo WhatsApp y soporte PWA)
 * manteniendo intacta la experiencia de escritorio en PC.
 */
(function () {
    if (window.__shidellMobileShellLoaded) return;
    window.__shidellMobileShellLoaded = true;

    const ICONS = {
        menu: '<img src="/plataformaestudiante/icons/svg/menu.svg" class="icon-img" alt="Menú" style="width:22px;height:22px;">',
        close: '<img src="/plataformaestudiante/icons/svg/close-muted.svg" class="icon-img" alt="Cerrar" style="width:18px;height:18px;">',
        back: '<img src="/plataformaestudiante/icons/svg/arrow-left.svg" class="icon-img" alt="Volver" style="width:20px;height:20px;">',
        home: '<img src="/plataformaestudiante/icons/regular/house.svg" class="icon-img" alt="Inicio" style="width:20px;height:20px;">',
        book: '<img src="/plataformaestudiante/icons/regular/book-open.svg" class="icon-img" alt="Cursos" style="width:20px;height:20px;">',
        tasks: '<img src="/plataformaestudiante/icons/regular/clipboard-text.svg" class="icon-img" alt="Tareas" style="width:20px;height:20px;">',
        grades: '<img src="/plataformaestudiante/icons/regular/star.svg" class="icon-img" alt="Notas" style="width:20px;height:20px;">',
        chat: '<img src="/plataformaestudiante/icons/regular/chat-circle-dots.svg" class="icon-img" alt="Mensajes" style="width:20px;height:20px;">',
        calendar: '<img src="/plataformaestudiante/icons/regular/calendar-blank.svg" class="icon-img" alt="Calendario" style="width:20px;height:20px;">',
        users: '<img src="/plataformaestudiante/icons/regular/users.svg" class="icon-img" alt="Usuarios" style="width:20px;height:20px;">',
        more: '<img src="/plataformaestudiante/icons/regular/squares-four.svg" class="icon-img" alt="Menú" style="width:20px;height:20px;">',
        logout: '<img src="/plataformaestudiante/icons/regular/sign-out.svg" class="icon-img" alt="Salir" style="width:20px;height:20px;">'
    };

    function ensureStylesheetAndPWA() {
        if (!document.querySelector('link[href*="mobile-shell.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/vendor/mobile-shell.css?v=20261019';
            document.head.appendChild(link);
        }
        if (!document.querySelector('link[rel="manifest"]')) {
            const manifest = document.createElement('link');
            manifest.rel = 'manifest';
            manifest.href = '/manifest.json';
            document.head.appendChild(manifest);
        }
        if (!document.querySelector('meta[name="theme-color"]')) {
            const theme = document.createElement('meta');
            theme.name = 'theme-color';
            theme.content = '#144272';
            document.head.appendChild(theme);
        }
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
    }

    function detectPortal() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('plataformaestudiante')) return 'ESTUDIANTE';
        if (path.includes('plataformadocente')) return 'DOCENTE';
        if (path.includes('plataformapadres')) return 'PADRE';
        if (path.includes('plataformaadmin')) return 'ADMIN';
        return 'AUTH';
    }

    function openDrawer() {
        document.body.classList.add('mobile-drawer-open');
    }

    function closeDrawer() {
        document.body.classList.remove('mobile-drawer-open');
    }

    function toggleDrawer() {
        document.body.classList.toggle('mobile-drawer-open');
    }

    function setupDrawerAndTopbar() {
        const sidebar = document.querySelector('.sidebar');
        const topbar = document.querySelector('.topbar');
        if (!sidebar || !topbar) return;

        // 1. Backdrop
        let backdrop = document.querySelector('.mobile-drawer-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'mobile-drawer-backdrop';
            backdrop.addEventListener('click', closeDrawer);
            document.body.appendChild(backdrop);
        }

        // 2. Botón cerrar dentro del sidebar
        const sidebarHeader = sidebar.querySelector('.sidebar-header, .sidebar-logo');
        if (sidebarHeader && !sidebarHeader.querySelector('.mobile-drawer-close')) {
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'mobile-drawer-close';
            closeBtn.setAttribute('aria-label', 'Cerrar menú');
            closeBtn.innerHTML = ICONS.close;
            closeBtn.addEventListener('click', closeDrawer);
            sidebarHeader.appendChild(closeBtn);
        }

        // 3. Cerrar drawer al tocar un enlace de navegación
        sidebar.querySelectorAll('.nav-item').forEach((item) => {
            if (!item.dataset.drawerBound) {
                item.dataset.drawerBound = '1';
                item.addEventListener('click', () => {
                    if (window.innerWidth <= 900) closeDrawer();
                });
            }
        });

        // 4. Asegurar opción de Cerrar Sesión en el Drawer si no existe
        if (!sidebar.querySelector('.sidebar-footer, .btn-logout, .sidebar-logout-injected')) {
            const logoutWrap = document.createElement('div');
            logoutWrap.className = 'sidebar-logout-injected';
            logoutWrap.innerHTML = `
                <button type="button" class="sidebar-logout-btn">
                    ${ICONS.logout}
                    <span>Cerrar sesión</span>
                </button>
            `;
            logoutWrap.querySelector('button').addEventListener('click', () => {
                localStorage.removeItem('shidell_user');
                localStorage.removeItem('shidell_admin');
                sessionStorage.clear();
                window.location.href = '/auth/login.html';
            });
            sidebar.appendChild(logoutWrap);
        }

        // 5. Botón Hamburguesa en Topbar
        const leftContainer = topbar.querySelector('.topbar-left, .greeting');
        if (leftContainer && !topbar.querySelector('.mobile-menu-btn')) {
            // Si es .greeting con h1 y p directos, envolver texto para alinear con el botón
            if (leftContainer.classList.contains('greeting') && !leftContainer.querySelector('.greeting-text-wrap')) {
                const wrap = document.createElement('div');
                wrap.className = 'greeting-text-wrap';
                while (leftContainer.firstChild) {
                    wrap.appendChild(leftContainer.firstChild);
                }
                leftContainer.appendChild(wrap);
            }

            const menuBtn = document.createElement('button');
            menuBtn.type = 'button';
            menuBtn.className = 'mobile-menu-btn';
            menuBtn.setAttribute('aria-label', 'Abrir menú');
            menuBtn.innerHTML = ICONS.menu;
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDrawer();
            });
            leftContainer.insertBefore(menuBtn, leftContainer.firstChild);
        }
    }

    function getBottomNavConfig(portal) {
        if (portal === 'ESTUDIANTE') {
            return [
                { label: 'Inicio', href: 'portalestudiante.html', match: 'portalestudiante', icon: ICONS.home },
                { label: 'Cursos', href: 'miscursos.html', match: 'curso', icon: ICONS.book },
                { label: 'Tareas', href: 'tareas.html', match: 'tareas', icon: ICONS.tasks },
                { label: 'Notas', href: 'calificaciones.html', match: 'calificaciones', icon: ICONS.grades },
                { label: 'Menú', action: 'drawer', icon: ICONS.more }
            ];
        }
        if (portal === 'DOCENTE') {
            return [
                { label: 'Inicio', href: '#/dashboard', match: '/dashboard', icon: ICONS.home },
                { label: 'Clases', href: '#/mis-clases', match: '/mis-clases', icon: ICONS.book },
                { label: 'Tareas', href: '#/tareas', match: '/tareas', icon: ICONS.tasks },
                { label: 'Notas', href: '#/calificaciones', match: '/calificaciones', icon: ICONS.grades },
                { label: 'Menú', action: 'drawer', icon: ICONS.more }
            ];
        }
        if (portal === 'PADRE') {
            return [
                { label: 'Inicio', href: 'portalpadres.html', match: 'portalpadres', icon: ICONS.home },
                { label: 'Notas', href: 'calificaciones.html', match: 'calificaciones', icon: ICONS.grades },
                { label: 'Asistencia', href: 'asistencia.html', match: 'asistencia', icon: ICONS.calendar },
                { label: 'Mensajes', href: 'mensajes.html', match: 'mensajes', icon: ICONS.chat },
                { label: 'Menú', action: 'drawer', icon: ICONS.more }
            ];
        }
        if (portal === 'ADMIN') {
            return [
                { label: 'Inicio', href: 'dashboard.html', match: 'dashboard', icon: ICONS.home },
                { label: 'Usuarios', href: 'usuarios.html', match: 'usuarios', icon: ICONS.users },
                { label: 'Cursos', href: 'cursos.html', match: 'cursos', icon: ICONS.book },
                { label: 'Notas', href: 'calificaciones.html', match: 'calificaciones', icon: ICONS.grades },
                { label: 'Menú', action: 'drawer', icon: ICONS.more }
            ];
        }
        return null;
    }

    function updateBottomNavActiveState() {
        const nav = document.querySelector('.android-bottom-nav');
        if (!nav) return;
        const currentUrl = (window.location.pathname + window.location.hash).toLowerCase();
        nav.querySelectorAll('.android-nav-item[data-match]').forEach((item) => {
            const match = item.getAttribute('data-match');
            const isActive = match && currentUrl.includes(match);
            item.classList.toggle('active', Boolean(isActive));
        });
    }

    function setupBottomNav() {
        const portal = detectPortal();
        const items = getBottomNavConfig(portal);
        if (!items || document.querySelector('.android-bottom-nav')) return;

        const nav = document.createElement('nav');
        nav.className = 'android-bottom-nav';
        nav.setAttribute('aria-label', 'Navegación principal móvil');

        items.forEach((item) => {
            if (item.action === 'drawer') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'android-nav-item';
                btn.innerHTML = `<div class="android-nav-pill">${item.icon}</div><span>${item.label}</span>`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleDrawer();
                });
                nav.appendChild(btn);
            } else {
                const a = document.createElement('a');
                a.href = item.href;
                a.className = 'android-nav-item';
                a.setAttribute('data-match', item.match);
                a.innerHTML = `<div class="android-nav-pill">${item.icon}</div><span>${item.label}</span>`;
                a.addEventListener('click', () => closeDrawer());
                nav.appendChild(a);
            }
        });

        document.body.appendChild(nav);
        updateBottomNavActiveState();
        window.addEventListener('hashchange', updateBottomNavActiveState);
    }

    function setupTouchDropdowns() {
        document.querySelectorAll('.user-dropdown, .top-user-info').forEach((dropdown) => {
            if (dropdown.dataset.touchDropdownBound) return;
            dropdown.dataset.touchDropdownBound = '1';
            dropdown.addEventListener('click', (e) => {
                if (e.target.closest('.dropdown-menu a, .account-dropdown a, .account-dropdown button')) {
                    return;
                }
                e.stopPropagation();
                dropdown.classList.toggle('open');
            });
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.user-dropdown.open, .top-user-info.open').forEach((el) => {
                el.classList.remove('open');
            });
        });
    }

    function setupMobileChat() {
        const layout = document.querySelector('.messaging-layout, .messages-container');
        const chatActive = document.getElementById('chat-active');
        if (!layout || !chatActive) return;

        const chatHeader = chatActive.querySelector('.chat-header') || layout.querySelector('.chat-header');
        if (chatHeader && !chatHeader.querySelector('.mobile-chat-back')) {
            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'mobile-chat-back';
            backBtn.setAttribute('aria-label', 'Volver a conversaciones');
            backBtn.innerHTML = ICONS.back;
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                layout.classList.remove('mobile-chat-open');
                chatActive.style.display = 'none';
                const noChat = document.getElementById('no-chat');
                if (noChat && window.innerWidth > 900) {
                    noChat.style.display = 'flex';
                }
                layout.querySelectorAll('.convo-item.active').forEach((c) => c.classList.remove('active'));
            });
            chatHeader.insertBefore(backBtn, chatHeader.firstChild);
        }

        const syncChatState = () => {
            const isVisible = chatActive.style.display === 'flex' || chatActive.style.display === 'block';
            layout.classList.toggle('mobile-chat-open', isVisible);
        };

        if (!chatActive.dataset.mobileChatObserved) {
            chatActive.dataset.mobileChatObserved = '1';
            const observer = new MutationObserver(syncChatState);
            observer.observe(chatActive, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        syncChatState();
    }

    function setupSwipeGestures() {
        let startX = 0;
        let startY = 0;
        let tracking = false;

        document.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            const isOpen = document.body.classList.contains('mobile-drawer-open');
            tracking = startX <= 28 || isOpen;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!tracking || !e.changedTouches || e.changedTouches.length !== 1) return;
            tracking = false;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dy > 60) return;

            const isOpen = document.body.classList.contains('mobile-drawer-open');
            if (!isOpen && startX <= 28 && dx > 65) {
                openDrawer();
            } else if (isOpen && dx < -55) {
                closeDrawer();
            }
        }, { passive: true });
    }

    function initAll() {
        ensureStylesheetAndPWA();
        setupDrawerAndTopbar();
        setupBottomNav();
        setupTouchDropdowns();
        setupMobileChat();
    }

    ensureStylesheetAndPWA();
    setupSwipeGestures();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    // Observar cambios dinámicos (ej. SPA de Docente o Admin que inyecta Topbar/Sidebar por JS)
    const domObserver = new MutationObserver(() => {
        setupDrawerAndTopbar();
        setupTouchDropdowns();
        setupMobileChat();
        updateBottomNavActiveState();
    });

    if (document.body) {
        domObserver.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            domObserver.observe(document.body, { childList: true, subtree: true });
        });
    }
})();
