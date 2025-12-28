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
    try {
        const bookings = await API.getBookings();
        displayUserBookings(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

function displayUserBookings(bookings) {
    const container = document.getElementById('userBookings');
    if (bookings.length === 0) {
        container.innerHTML = '<p>No bookings yet. <a href="search.html">Search arenas</a> to book one!</p>';
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
                ${bookings.map(booking => `
                    <tr>
                        <td>${booking.arenaName}</td>
                        <td>${booking.stadiumName}</td>
                        <td>${booking.location}</td>
                        <td>${new Date(booking.slotStart).toLocaleString()} - ${new Date(booking.slotEnd).toLocaleString()}</td>
                        <td>$${booking.price}</td>
                        <td>${booking.status}</td>
                        <td>
                            ${booking.status !== 'Cancelled' ? `
                                <button class="btn btn-sm btn-danger" onclick="cancelUserBooking(${booking.bookingId})">Cancel</button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
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

