
document.addEventListener('DOMContentLoaded', async () => {
    
    const token = sessionStorage.getItem('token');
    const user = sessionStorage.getItem('user');

    const currentPage = window.location.pathname;

    const publicPages = ['/signup.html', '/login.html', '/'];

    const isPublicPage = publicPages.some(page => currentPage.endsWith(page));

    if (!token && !isPublicPage) {
        
        window.location.href = 'login.html';
        return;
    }

    if (token && (currentPage.endsWith('/login.html') || currentPage.endsWith('/signup.html'))) {
        
        if (user) {
            const userObj = JSON.parse(user);
            window.location.href = 'dashboard.html';
        }
    }

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await API.logout();
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
                
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        });
    }

    if (user) {
        const userObj = JSON.parse(user);
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            const userName = userObj.fullName || userObj.email;
            const role = userObj.role || 'User';
            userNameEl.innerHTML = `Welcome, <strong>${userName}</strong>. You are our Pride <strong>${role}</strong>.`;
        }
    }
});

