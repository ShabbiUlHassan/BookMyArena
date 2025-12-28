// Dashboard functionality
let currentStadiumId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userStr);
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role') || user.role.toLowerCase();

    if (role === 'owner' || user.role === 'Owner') {
        document.getElementById('ownerDashboard').style.display = 'block';
        loadOwnerDashboard();
    } else {
        document.getElementById('userDashboard').style.display = 'block';
        loadAvailableArenas();
        loadUserBookings();
    }

    // Add stadium form handler
    document.getElementById('addStadiumForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('stadiumName').value;
        const location = document.getElementById('stadiumLocation').value;

        try {
            await API.createStadium({ name, location });
            closeAddStadiumModal();
            loadOwnerDashboard();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });

    // Add arena form handler
    document.getElementById('addArenaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const stadiumId = parseInt(document.getElementById('arenaStadiumId').value);
        const arenaData = {
            stadiumId: stadiumId,
            name: document.getElementById('arenaName').value,
            sportType: document.getElementById('arenaSportType').value,
            capacity: parseInt(document.getElementById('arenaCapacity').value),
            slotDuration: parseInt(document.getElementById('arenaSlotDuration').value),
            price: parseFloat(document.getElementById('arenaPrice').value),
        };

        try {
            await API.createArena(arenaData);
            closeAddArenaModal();
            loadOwnerDashboard();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
});

async function loadOwnerDashboard() {
    try {
        const stadiums = await API.getStadiums();
        displayStadiums(stadiums);

        const bookings = await API.getBookings();
        displayOwnerBookings(bookings);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function displayStadiums(stadiums) {
    const container = document.getElementById('stadiumsList');
    if (stadiums.length === 0) {
        container.innerHTML = '<p>No stadiums yet. Add your first stadium!</p>';
        return;
    }

    container.innerHTML = stadiums.map(stadium => `
        <div class="card">
            <h4>${stadium.name}</h4>
            <p><strong>Location:</strong> ${stadium.location}</p>
            <button class="btn btn-secondary" onclick="loadArenas(${stadium.stadiumId})">View Arenas</button>
            <button class="btn btn-primary" onclick="showAddArenaModal(${stadium.stadiumId})">Add Arena</button>
        </div>
    `).join('');
}

async function loadArenas(stadiumId) {
    try {
        const arenas = await API.getArenasByStadium(stadiumId);
        alert(`Arenas in this stadium: ${arenas.length}\n\n${arenas.map(a => `- ${a.name} (${a.sportType}) - $${a.price}`).join('\n')}`);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function showAddStadiumModal() {
    document.getElementById('addStadiumModal').style.display = 'block';
}

function closeAddStadiumModal() {
    document.getElementById('addStadiumModal').style.display = 'none';
    document.getElementById('addStadiumForm').reset();
}

function showAddArenaModal(stadiumId) {
    document.getElementById('arenaStadiumId').value = stadiumId;
    document.getElementById('addArenaModal').style.display = 'block';
}

function closeAddArenaModal() {
    document.getElementById('addArenaModal').style.display = 'none';
    document.getElementById('addArenaForm').reset();
}

function displayOwnerBookings(bookings) {
    const container = document.getElementById('ownerBookings');
    if (bookings.length === 0) {
        container.innerHTML = '<p>No bookings yet.</p>';
        return;
    }

    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Booking ID</th>
                    <th>Arena</th>
                    <th>Stadium</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${bookings.map(booking => `
                    <tr>
                        <td>${booking.bookingId}</td>
                        <td>${booking.arenaName}</td>
                        <td>${booking.stadiumName}</td>
                        <td>${new Date(booking.slotStart).toLocaleString()} - ${new Date(booking.slotEnd).toLocaleString()}</td>
                        <td>${booking.status}</td>
                        <td>
                            ${booking.status === 'Pending' ? `
                                <button class="btn btn-sm btn-success" onclick="updateBookingStatus(${booking.bookingId}, 'Confirmed')">Confirm</button>
                                <button class="btn btn-sm btn-danger" onclick="updateBookingStatus(${booking.bookingId}, 'Cancelled')">Reject</button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = table;
}

async function updateBookingStatus(bookingId, status) {
    try {
        await API.updateBookingStatus(bookingId, status);
        loadOwnerDashboard();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadUserBookings() {
    const container = document.getElementById('userBookings');
    if (!container) {
        console.error('userBookings container not found!');
        return;
    }
    
    container.innerHTML = '<p>Loading bookings...</p>';
    
    try {
        const bookings = await API.getBookings();
        console.log('Bookings received:', bookings);
        displayUserBookings(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
        container.innerHTML = `<p class="error-message">Error loading bookings: ${error.message || 'Please try again.'}</p>`;
    }
}

function displayUserBookings(bookings) {
    const container = document.getElementById('userBookings');
    if (!container) {
        console.error('userBookings container not found!');
        return;
    }
    
    // Check if bookings is null or undefined
    if (!bookings) {
        container.innerHTML = '<p class="error-message">Error: No data received from server.</p>';
        return;
    }
    
    // Check if bookings is an array
    if (!Array.isArray(bookings)) {
        console.error('Bookings is not an array:', bookings);
        container.innerHTML = '<p class="error-message">Error: Invalid data received from server.</p>';
        return;
    }
    
    if (bookings.length === 0) {
        container.innerHTML = '<p>No bookings yet. <a href="search.html" class="btn btn-primary">Search & Book Arenas</a></p>';
        return;
    }

    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Arena</th>
                    <th>Stadium</th>
                    <th>Location</th>
                    <th>Date & Time</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${bookings.map(booking => {
                    // Add null checks for safety
                    const arenaName = booking.arenaName || 'N/A';
                    const stadiumName = booking.stadiumName || 'N/A';
                    const location = booking.location || 'N/A';
                    const slotStart = booking.slotStart ? new Date(booking.slotStart).toLocaleString() : 'N/A';
                    const slotEnd = booking.slotEnd ? new Date(booking.slotEnd).toLocaleString() : 'N/A';
                    const price = booking.price ? `$${booking.price}` : '$0';
                    const status = booking.status || 'Unknown';
                    const bookingId = booking.bookingId || 0;
                    
                    return `
                    <tr>
                        <td>${arenaName}</td>
                        <td>${stadiumName}</td>
                        <td>${location}</td>
                        <td>${slotStart} - ${slotEnd}</td>
                        <td>${price}</td>
                        <td>${status}</td>
                        <td>
                            ${booking.status !== 'Cancelled' ? `
                                <button class="btn btn-sm btn-danger" onclick="cancelUserBooking(${bookingId})">Cancel</button>
                            ` : ''}
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = table;
}

async function cancelUserBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }
    try {
        await API.cancelBooking(bookingId);
        loadUserBookings();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Make cancelUserBooking globally accessible
window.cancelUserBooking = cancelUserBooking;

async function loadAvailableArenas() {
    const container = document.getElementById('availableArenas');
    if (!container) {
        console.error('availableArenas container not found!');
        return;
    }
    
    container.innerHTML = '<p>Loading arenas...</p>';
    
    try {
        const arenas = await API.getAllArenas();
        console.log('Arenas loaded:', arenas);
        displayAvailableArenas(arenas);
    } catch (error) {
        console.error('Error loading arenas:', error);
        container.innerHTML = `<p class="error-message">Error loading arenas: ${error.message || 'Please try again.'}</p>`;
    }
}

function displayAvailableArenas(arenas) {
    const container = document.getElementById('availableArenas');
    if (!container) {
        console.error('availableArenas container not found!');
        return;
    }
    
    // Check if arenas is null or undefined
    if (!arenas) {
        container.innerHTML = '<p class="error-message">Error: No data received from server.</p>';
        return;
    }
    
    // Check if arenas is an array
    if (!Array.isArray(arenas)) {
        console.error('Arenas is not an array:', arenas);
        container.innerHTML = '<p class="error-message">Error: Invalid data received from server.</p>';
        return;
    }
    
    if (arenas.length === 0) {
        container.innerHTML = '<p>No arenas available yet. Please check back later.</p>';
        return;
    }

    // Format available hours (typically 8 AM to 10 PM)
    const availableHours = `8:00 AM - 10:00 PM`;

    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Arena Name</th>
                    <th>Stadium</th>
                    <th>Location</th>
                    <th>Sport Type</th>
                    <th>Capacity</th>
                    <th>Slot Duration</th>
                    <th>Available Hours</th>
                    <th>Price per Slot</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${arenas.map(arena => {
                    const arenaName = arena.name || 'Unnamed Arena';
                    const stadiumName = arena.stadiumName || 'N/A';
                    const location = arena.location || 'N/A';
                    const sportType = arena.sportType || 'N/A';
                    const capacity = arena.capacity || 0;
                    const slotDuration = arena.slotDuration || 0;
                    const price = arena.price ? arena.price.toFixed(2) : '0.00';
                    const arenaId = arena.arenaId || 0;
                    
                    return `
                    <tr>
                        <td>${arenaName}</td>
                        <td>${stadiumName}</td>
                        <td>${location}</td>
                        <td>${sportType}</td>
                        <td>${capacity} players</td>
                        <td>${slotDuration} minutes</td>
                        <td>${availableHours}</td>
                        <td>$${price}</td>
                        <td>
                            <a href="search.html" class="btn btn-sm btn-primary">Book Now</a>
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = table;
}

// Close modals when clicking outside
window.onclick = function(event) {
    const stadiumModal = document.getElementById('addStadiumModal');
    const arenaModal = document.getElementById('addArenaModal');
    if (event.target == stadiumModal) {
        closeAddStadiumModal();
    }
    if (event.target == arenaModal) {
        closeAddArenaModal();
    }
}

