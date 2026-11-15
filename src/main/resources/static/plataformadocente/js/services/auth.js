export const Auth = {
    getUser() {
        try {
            return JSON.parse(localStorage.getItem('shidell_user') || 'null');
        } catch {
            return null;
        }
    },
    
    getToken() {
        const user = this.getUser();
        return user ? user.sessionToken : null;
    },
    
    setUser(user) {
        if (!user) return;
        const current = this.getUser();
        const merged = {
            ...(current || {}),
            ...user,
            sessionToken: user.sessionToken || (current ? current.sessionToken : null) || null
        };
        localStorage.setItem('shidell_user', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('shidell:user-updated', { detail: merged }));
    },
    
    logout() {
        const currentUser = this.getUser();
        window.ShidellPresence?.stopHeartbeat?.();
        if (window.ShidellPresence?.notifyLogout) {
            window.ShidellPresence.notifyLogout(currentUser);
        } else {
            const headers = currentUser?.sessionToken
                ? { Authorization: `Bearer ${currentUser.sessionToken}` }
                : {};
            fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers
            }).catch(() => {});
        }
        localStorage.removeItem('shidell_user');
        if (window.ShidellMotion?.playPortalHandoff) {
            window.ShidellMotion.playPortalHandoff({
                rol: 'AUTH',
                name: ''
            }, () => {
                window.location.href = '../login.html';
            });
            return;
        }
        window.location.href = '../login.html';
    }
};
