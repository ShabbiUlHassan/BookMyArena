// Shared sidebar HTML generator and injector
function initSidebar() {
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    const sidebarContainer = document.getElementById('sidebar-container');
    
    if (!sidebarContainer) {
        console.error('Sidebar container not found');
        return;
    }
    
    // Check user role first to determine which items to show
    const userStr = sessionStorage.getItem('user');
    let isOwner = false;
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            isOwner = user.role === 'Owner';
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    
    const sidebarHTML = `
        <aside class="sidebar" id="sidebar">
            <nav class="sidebar-nav">
                <ul class="list-unstyled">
                    <li><a href="dashboard.html" class="nav-link ${currentPage === 'dashboard' ? 'active' : ''}">
                        <i class="bi bi-house-door me-2"></i> Home
                    </a></li>
                    <li id="availabilityNavItem" style="display: ${isOwner ? 'block' : 'none'};"><a href="availability.html" class="nav-link ${currentPage === 'availability' ? 'active' : ''}">
                        <i class="bi bi-calendar-event me-2"></i> Availability
                    </a></li>
                    <li id="bookingNavItem" style="display: ${isOwner ? 'none' : 'block'};"><a href="booking.html" class="nav-link ${currentPage === 'booking' ? 'active' : ''}">
                        <i class="bi bi-bookmark-check me-2"></i> Booking
                    </a></li>
                    <li id="requestsNavItem" style="display: ${isOwner ? 'block' : 'none'};"><a href="requests.html" class="nav-link ${currentPage === 'requests' ? 'active' : ''}">
                        <i class="bi bi-clipboard-check me-2"></i> Booking & Requests
                    </a></li>
                    <li><a href="payments.html" class="nav-link ${currentPage === 'payments' ? 'active' : ''}">
                        <i class="bi bi-credit-card me-2"></i> Payment
                    </a></li>
                </ul>
            </nav>
        </aside>
    `;
    
    sidebarContainer.innerHTML = sidebarHTML;
}

// Navigation highlighting based on current page (for compatibility)
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sidebar if container exists
    initSidebar();
    
    const currentPage = window.location.pathname;
    const pageName = currentPage.split('/').pop().split('.')[0];
    
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
});
