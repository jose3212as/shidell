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
        localStorage.setItem('shidell_user', JSON.stringify(user));
    },
    
    logout() {
        localStorage.removeItem('shidell_user');
        window.location.href = '../login.html';
    }
};
