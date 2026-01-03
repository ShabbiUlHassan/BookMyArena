// Authentication utilities
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const token = sessionStorage.getItem('token');
    const user = sessionStorage.getItem('user');

    // Get current page
    const currentPage = window.location.pathname;

    // Pages that don't require authentication
    const publicPages = ['/signup.html', '/login.html', '/'];

    const isPublicPage = publicPages.some(page => currentPage.endsWith(page));

    if (!token && !isPublicPage) {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
        return;
    }

    if (token && (currentPage.endsWith('/login.html') || currentPage.endsWith('/signup.html'))) {
        // Redirect to dashboard if already logged in
        if (user) {
            const userObj = JSON.parse(user);
            window.location.href = 'dashboard.html';
        }
    }

    // Setup logout link
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
                // Clear local storage anyway
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        });
    }

    // Display user name if available
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

