// Navigation highlighting based on current page
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname;
    const pageName = currentPage.split('/').pop().split('.')[0]; // Get filename without extension
    
    // Map page names to navigation links
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href) {
            const linkPage = href.split('/').pop().split('.')[0];
            // Match the current page with the link
            if (linkPage === pageName) {
                link.classList.add('active');
            }
        }
    });
    
    // Show/hide owner-only navigation items
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role === 'Owner') {
            const requestsNav = document.getElementById('requestsNavItem');
            const paymentsNav = document.getElementById('paymentsNavItem');
            if (requestsNav) requestsNav.style.display = 'block';
            if (paymentsNav) paymentsNav.style.display = 'block';
        }
    }
});

