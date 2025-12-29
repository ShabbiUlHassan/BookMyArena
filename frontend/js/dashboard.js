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

    // Add/Edit arena form handler
    document.getElementById('addArenaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = document.getElementById('addArenaForm');
        const stadiumId = parseInt(document.getElementById('arenaStadiumId').value);
        const arenaId = form.dataset.arenaId;
        const isEdit = form.dataset.isEdit === 'true';
        
        const arenaData = {
            stadiumId: stadiumId,
            name: document.getElementById('arenaName').value,
            sportType: document.getElementById('arenaSportType').value,
            capacity: parseInt(document.getElementById('arenaCapacity').value),
            slotDuration: parseInt(document.getElementById('arenaSlotDuration').value),
            price: parseFloat(document.getElementById('arenaPrice').value),
        };

        try {
            if (isEdit && arenaId) {
                await API.updateArena(parseInt(arenaId), arenaData);
            } else {
                await API.createArena(arenaData);
            }
            closeAddArenaModal();
            // Reload arenas for the specific stadium
            const state = stadiumArenaState[stadiumId] || {};
            loadArenasForStadium(stadiumId, state.pageNumber || 1, state.pageSize || 10, state.searchText || '', state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
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
        <div class="stadium-card" id="stadium-${stadium.stadiumId}">
            <div class="stadium-header">
                <div>
                    <h4>${stadium.name}</h4>
                    <p><strong>Location:</strong> ${stadium.location}</p>
                </div>
            </div>
            <div class="arena-table-container" id="arena-container-${stadium.stadiumId}">
                <div class="arena-table-header">
                    <div class="arena-search">
                        <input type="text" id="arena-search-${stadium.stadiumId}" placeholder="Search arenas..." 
                               onkeyup="handleArenaSearch(${stadium.stadiumId}, event)">
                    </div>
                    <button class="btn btn-primary" onclick="showAddArenaModal(${stadium.stadiumId})">Add Arena</button>
                </div>
                <div id="arena-table-${stadium.stadiumId}" class="table-container"></div>
                <div id="arena-pagination-${stadium.stadiumId}" class="arena-table-footer"></div>
            </div>
        </div>
    `).join('');

    // Load arenas for each stadium
    stadiums.forEach(stadium => {
        loadArenasForStadium(stadium.stadiumId);
    });
}

// Stadium arena state for pagination, search, and sorting
const stadiumArenaState = {};

async function loadArenasForStadium(stadiumId, pageNumber = 1, pageSize = 10, searchText = '', sortColumn = 'CreatedAt', sortDirection = 'DESC') {
    const tableContainer = document.getElementById(`arena-table-${stadiumId}`);
    if (!tableContainer) {
        console.error(`Table container not found for stadium ${stadiumId}`);
        return;
    }

    tableContainer.innerHTML = '<p>Loading arenas...</p>';

    try {
        const result = await API.getArenasByStadium(stadiumId, {
            searchText,
            sortColumn,
            sortDirection,
            pageNumber,
            pageSize
        });

        console.log(`Arenas loaded for stadium ${stadiumId}:`, result);

        // Store state
        if (!stadiumArenaState[stadiumId]) {
            stadiumArenaState[stadiumId] = {};
        }
        stadiumArenaState[stadiumId] = {
            pageNumber,
            pageSize,
            searchText,
            sortColumn,
            sortDirection,
            totalCount: result.totalCount || 0,
            totalPages: result.totalPages || 0
        };

        displayArenasTable(stadiumId, result);
    } catch (error) {
        console.error('Error loading arenas:', error);
        tableContainer.innerHTML = `<p class="error-message">Error loading arenas: ${error.message}</p>`;
    }
}

function displayArenasTable(stadiumId, result) {
    const tableContainer = document.getElementById(`arena-table-${stadiumId}`);
    const paginationContainer = document.getElementById(`arena-pagination-${stadiumId}`);
    
    if (!tableContainer) {
        console.error(`Table container not found for stadium ${stadiumId}`);
        return;
    }

    console.log(`Displaying arenas table for stadium ${stadiumId}:`, result);

    // If no arenas, don't render the table
    if (!result || !result.arenas || result.arenas.length === 0) {
        tableContainer.innerHTML = '';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const state = stadiumArenaState[stadiumId];
    const sortColumn = state ? state.sortColumn : 'CreatedAt';
    const sortDirection = state ? state.sortDirection : 'DESC';

    // Generate sort icon
    const getSortIcon = (col) => {
        if (col !== sortColumn) return '<span class="sort-icon">↕</span>';
        return sortDirection === 'ASC' ? '<span class="sort-icon">↑</span>' : '<span class="sort-icon">↓</span>';
    };

    // Generate sort handler
    const getSortHandler = (col) => {
        const newDirection = (sortColumn === col && sortDirection === 'ASC') ? 'DESC' : 'ASC';
        return `handleArenaSort(${stadiumId}, '${col}', '${newDirection}')`;
    };

    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th class="sortable-header" onclick="${getSortHandler('Name')}">Arena Name ${getSortIcon('Name')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('SportType')}">Sport Type ${getSortIcon('SportType')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('Capacity')}">Capacity ${getSortIcon('Capacity')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('SlotDuration')}">Slot Duration ${getSortIcon('SlotDuration')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('Price')}">Price per Slot ${getSortIcon('Price')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('CreatedAt')}">Created At ${getSortIcon('CreatedAt')}</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${result.arenas.map(arena => {
                    const arenaName = arena.name || 'Unnamed Arena';
                    const sportType = arena.sportType || 'N/A';
                    const capacity = arena.capacity || 0;
                    const slotDuration = arena.slotDuration || 0;
                    const price = arena.price ? arena.price.toFixed(2) : '0.00';
                    const createdAt = arena.createdAt ? new Date(arena.createdAt).toLocaleDateString() : 'N/A';
                    
                    return `
                    <tr>
                        <td>${arenaName}</td>
                        <td>${sportType}</td>
                        <td>${capacity} players</td>
                        <td>${slotDuration} minutes</td>
                        <td>$${price}</td>
                        <td>${createdAt}</td>
                        <td>
                            <button class="btn-icon btn-edit" onclick="editArena(${arena.arenaId}, ${arena.stadiumId})" title="Edit Arena">
                                ✏️
                            </button>
                            <button class="btn-icon btn-delete" onclick="deleteArena(${arena.arenaId}, ${stadiumId})" title="Delete Arena">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
    tableContainer.innerHTML = table;

    // Display pagination
    if (paginationContainer && result.totalPages > 0) {
        const state = stadiumArenaState[stadiumId];
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                Showing ${((state.pageNumber - 1) * state.pageSize) + 1} to ${Math.min(state.pageNumber * state.pageSize, state.totalCount)} of ${state.totalCount} arenas
                <select class="page-size-select" onchange="handlePageSizeChange(${stadiumId}, this.value)">
                    <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10 per page</option>
                    <option value="25" ${state.pageSize === 25 ? 'selected' : ''}>25 per page</option>
                    <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50 per page</option>
                    <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100 per page</option>
                </select>
            </div>
            <div class="pagination-controls">
                <button onclick="handlePageChange(${stadiumId}, 1)" ${state.pageNumber === 1 ? 'disabled' : ''}>First</button>
                <button onclick="handlePageChange(${stadiumId}, ${state.pageNumber - 1})" ${state.pageNumber === 1 ? 'disabled' : ''}>Previous</button>
                <span>Page ${state.pageNumber} of ${state.totalPages}</span>
                <button onclick="handlePageChange(${stadiumId}, ${state.pageNumber + 1})" ${state.pageNumber >= state.totalPages ? 'disabled' : ''}>Next</button>
                <button onclick="handlePageChange(${stadiumId}, ${state.totalPages})" ${state.pageNumber >= state.totalPages ? 'disabled' : ''}>Last</button>
            </div>
        `;
    } else if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }
}

function handleArenaSearch(stadiumId, event) {
    if (event.key === 'Enter') {
        const searchInput = document.getElementById(`arena-search-${stadiumId}`);
        const searchText = searchInput ? searchInput.value : '';
        const state = stadiumArenaState[stadiumId] || {};
        loadArenasForStadium(stadiumId, 1, state.pageSize || 10, searchText, state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
    }
}

// Debounced search for input events
let searchTimeout = {};
function handleArenaSearchInput(stadiumId, event) {
    clearTimeout(searchTimeout[stadiumId]);
    searchTimeout[stadiumId] = setTimeout(() => {
        const searchInput = document.getElementById(`arena-search-${stadiumId}`);
        const searchText = searchInput ? searchInput.value : '';
        const state = stadiumArenaState[stadiumId] || {};
        loadArenasForStadium(stadiumId, 1, state.pageSize || 10, searchText, state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
    }, 500); // 500ms delay
}

function handleArenaSort(stadiumId, sortColumn, sortDirection) {
    const state = stadiumArenaState[stadiumId] || {};
    loadArenasForStadium(stadiumId, 1, state.pageSize || 10, state.searchText || '', sortColumn, sortDirection);
}

function handlePageChange(stadiumId, pageNumber) {
    const state = stadiumArenaState[stadiumId] || {};
    loadArenasForStadium(stadiumId, pageNumber, state.pageSize || 10, state.searchText || '', state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
}

function handlePageSizeChange(stadiumId, pageSize) {
    const state = stadiumArenaState[stadiumId] || {};
    loadArenasForStadium(stadiumId, 1, parseInt(pageSize), state.searchText || '', state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
}

// Make functions globally accessible
window.handleArenaSearch = handleArenaSearch;
window.handleArenaSearchInput = handleArenaSearchInput;
window.handleArenaSort = handleArenaSort;
window.handlePageChange = handlePageChange;
window.handlePageSizeChange = handlePageSizeChange;

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
    const form = document.getElementById('addArenaForm');
    form.reset();
    delete form.dataset.arenaId;
    delete form.dataset.isEdit;
    
    // Reset modal title and button text
    const modalTitle = document.querySelector('#addArenaModal h3');
    const submitButton = document.querySelector('#addArenaForm button[type="submit"]');
    if (modalTitle) modalTitle.textContent = 'Add Arena';
    if (submitButton) submitButton.textContent = 'Add Arena';
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

async function editArena(arenaId, stadiumId) {
    try {
        const arena = await API.getArena(arenaId);
        
        // Populate the form with arena data
        document.getElementById('arenaStadiumId').value = stadiumId;
        document.getElementById('arenaName').value = arena.name || '';
        document.getElementById('arenaSportType').value = arena.sportType || '';
        document.getElementById('arenaCapacity').value = arena.capacity || '';
        document.getElementById('arenaSlotDuration').value = arena.slotDuration || '';
        document.getElementById('arenaPrice').value = arena.price || '';
        
        // Store the arena ID for update
        document.getElementById('addArenaForm').dataset.arenaId = arenaId;
        document.getElementById('addArenaForm').dataset.isEdit = 'true';
        
        // Change modal title and button text
        const modalTitle = document.querySelector('#addArenaModal h3');
        const submitButton = document.querySelector('#addArenaForm button[type="submit"]');
        if (modalTitle) modalTitle.textContent = 'Edit Arena';
        if (submitButton) submitButton.textContent = 'Update Arena';
        
        // Show the modal
        document.getElementById('addArenaModal').style.display = 'block';
    } catch (error) {
        alert('Error loading arena: ' + error.message);
    }
}

async function deleteArena(arenaId, stadiumId) {
    if (!confirm('Are you sure you want to delete this arena? This action cannot be undone.')) {
        return;
    }
    
    try {
        await API.deleteArena(arenaId);
        // Reload arenas for the stadium
        const state = stadiumArenaState[stadiumId] || {};
        loadArenasForStadium(stadiumId, state.pageNumber || 1, state.pageSize || 10, state.searchText || '', state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
    } catch (error) {
        alert('Error deleting arena: ' + error.message);
    }
}

// Make modal functions globally accessible
window.showAddStadiumModal = showAddStadiumModal;
window.closeAddStadiumModal = closeAddStadiumModal;
window.showAddArenaModal = showAddArenaModal;
window.closeAddArenaModal = closeAddArenaModal;
window.editArena = editArena;
window.deleteArena = deleteArena;

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

