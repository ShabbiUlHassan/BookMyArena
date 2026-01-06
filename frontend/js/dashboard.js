
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
        document.getElementById('availabilityNavItem').style.display = 'block';
        document.getElementById('requestsNavItem').style.display = 'block';
        loadOwnerDashboard();
    } else {
        document.getElementById('userDashboard').style.display = 'block';
        loadUserDashboard();
    }

    document.getElementById('addStadiumForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('stadiumName').value;
        const location = document.getElementById('stadiumLocation').value;

        try {
            await API.createStadium({ name, location });
            closeAddStadiumModal();
            loadOwnerDashboard();
        } catch (error) {
            showAlertModal('Error: ' + error.message, 'error');
        }
    });

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
            
            const state = stadiumArenaState[stadiumId] || {};
            loadArenasForStadium(stadiumId, state.pageNumber || 1, state.pageSize || 10, state.searchText || '', state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
        } catch (error) {
            showAlertModal('Error: ' + error.message, 'error');
        }
    });

    const availabilityForm = document.getElementById('availabilityForm');
    if (availabilityForm) {
        availabilityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const arenaId = parseInt(document.getElementById('availabilityArenaId').value);
            const slots = document.querySelectorAll('.availability-slot');
            
            if (slots.length === 0) {
                showAlertModal('Please add at least one availability slot', 'warning');
                return;
            }
            
            const availabilities = [];
            let hasError = false;
            
            slots.forEach((slot, index) => {
                const date = slot.querySelector('.availability-date').value;
                const startTime = slot.querySelector('.availability-start-time').value;
                const endTime = slot.querySelector('.availability-end-time').value;
                
                if (!date || !startTime || !endTime) {
                    showAlertModal(`Date Entry ${index + 1} is incomplete`, 'warning');
                    hasError = true;
                    return;
                }

                const [startHours, startMinutes] = startTime.split(':').map(Number);
                const [endHours, endMinutes] = endTime.split(':').map(Number);
                
                const startTotalMinutes = startHours * 60 + startMinutes;
                const endTotalMinutes = endHours * 60 + endMinutes;
                const diffMinutes = endTotalMinutes - startTotalMinutes;
                
                if (diffMinutes < 60) {
                    showAlertModal(`Date Entry ${index + 1}: End time must be at least 60 minutes after start time`, 'warning');
                    hasError = true;
                    return;
                }
                
                availabilities.push({
                    date: date,
                    startTime: startTime,
                    endTime: endTime
                });
            });
            
            if (hasError) {
                return;
            }
            
            try {
                await API.createArenaAvailability(arenaId, {
                    arenaId: arenaId,
                    availabilities: availabilities
                });
                
                showAlertModal('Availability created successfully!', 'success');

                const modalElement = document.getElementById('availabilityModal');
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                }

                setTimeout(() => {
                    availabilityForm.reset();
                    document.getElementById('availabilitySlots').innerHTML = '';
                    availabilitySlotCount = 0;
                }, 300);
            } catch (error) {
                showAlertModal('Error creating availability: ' + error.message, 'error');
            }
        });
    }

    const availabilityModalElement = document.getElementById('availabilityModal');
    if (availabilityModalElement) {
        availabilityModalElement.addEventListener('hidden.bs.modal', function () {
            const form = document.getElementById('availabilityForm');
            if (form) {
                form.reset();
                document.getElementById('availabilitySlots').innerHTML = '';
                availabilitySlotCount = 0;
            }
        });
    }

    const bookingConfirmationForm = document.getElementById('bookingConfirmationForm');
    if (bookingConfirmationForm) {
        bookingConfirmationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const availabilityId = document.getElementById('bookingAvailabilityId').value;
            
            if (!availabilityId) {
                showAlertModal('Availability ID is missing', 'warning');
                return;
            }
            
            try {
                await API.createBookingRequest(availabilityId);
                
                showAlertModal('Booking request created successfully!', 'success');

                const modalElement = document.getElementById('bookingConfirmationModal');
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                }

                await loadUserAvailabilityTable();
            } catch (error) {
                showAlertModal('Error creating booking request: ' + error.message, 'error');
            }
        });
    }
});

async function loadOwnerDashboard() {
    try {
        const stadiums = await API.getStadiums();
        displayStadiums(stadiums);
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
            <div class="stadium-header" onclick="toggleStadiumCard(${stadium.stadiumId})" style="cursor: pointer;">
                <div>
                    <h4>${stadium.name} <span class="collapse-icon" id="collapse-icon-${stadium.stadiumId}">▼</span></h4>
                    <p><strong>Location:</strong> ${stadium.location}</p>
                </div>
            </div>
            <div class="arena-table-container" id="arena-container-${stadium.stadiumId}">
                <div class="arena-table-header">
                    <div class="arena-search" id="arena-search-container-${stadium.stadiumId}" style="display: none;">
                        <input type="text" id="arena-search-${stadium.stadiumId}" placeholder="Search By Any Column..." 
                               onkeyup="handleArenaSearch(${stadium.stadiumId}, event)"
                               oninput="handleArenaSearchInput(${stadium.stadiumId}, event)">
                    </div>
                    <button class="btn btn-primary" onclick="event.stopPropagation(); showAddArenaModal(${stadium.stadiumId})">Add Arena</button>
                </div>
                <div id="arena-table-${stadium.stadiumId}" class="table-container"></div>
                <div id="arena-pagination-${stadium.stadiumId}" class="arena-table-footer"></div>
            </div>
        </div>
    `).join('');

    stadiums.forEach(stadium => {
        loadArenasForStadium(stadium.stadiumId);
    });
}

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

    const userStr = sessionStorage.getItem('user');
    const ownerRole = userStr ? JSON.parse(userStr).role : '';

    const arenaSearchContainer = document.getElementById(`arena-search-container-${stadiumId}`);

    if (!result || !result.arenas || result.arenas.length === 0) {
        tableContainer.innerHTML = '';
        if (paginationContainer) paginationContainer.innerHTML = '';
        if (arenaSearchContainer) arenaSearchContainer.style.display = 'none';
        return;
    }

    if (arenaSearchContainer) arenaSearchContainer.style.display = 'block';

    const state = stadiumArenaState[stadiumId];
    const sortColumn = state ? state.sortColumn : 'CreatedAt';
    const sortDirection = state ? state.sortDirection : 'DESC';

        const getSortIcon = (col) => {
            if (col !== sortColumn) {
                return '<i class="bi bi-arrow-up sort-icon" style="opacity: 0.5;"></i><i class="bi bi-arrow-down sort-icon" style="opacity: 0.5;"></i>';
            }
            return sortDirection === 'ASC' 
                ? '<i class="bi bi-arrow-up sort-icon" style="opacity: 1;"></i>' 
                : '<i class="bi bi-arrow-down sort-icon" style="opacity: 1;"></i>';
        };

    const getSortHandler = (col) => {
        const newDirection = (sortColumn === col && sortDirection === 'ASC') ? 'DESC' : 'ASC';
        return `handleArenaSort(${stadiumId}, '${col}', '${newDirection}')`;
    };

    const table = `
        <table class="table data-table">
            <thead>
                <tr>
                    <th class="sortable-header" onclick="${getSortHandler('Name')}">Arena Name ${getSortIcon('Name')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('SportType')}">Sport Type ${getSortIcon('SportType')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('Capacity')}">Capacity ${getSortIcon('Capacity')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('SlotDuration')}">Min. Slot Duration ${getSortIcon('SlotDuration')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('Price')}">Price per Slot ${getSortIcon('Price')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('CreatedAt')}">Created At ${getSortIcon('CreatedAt')}</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${result.arenas.map(arena => {
                    const arenaName = arena.name || 'Unnamed Arena';
                    const sportTypeRaw = arena.sportType || 'N/A';
                    const sportType = sportTypeRaw !== 'N/A' ? sportTypeRaw.charAt(0).toUpperCase() + sportTypeRaw.slice(1).toLowerCase() : 'N/A';
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
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="editArena(${arena.arenaId}, ${arena.stadiumId})" title="Edit Arena">
                                <i class="bi bi-pencil me-1"></i>Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger me-2" onclick="deleteArena(${arena.arenaId}, ${arena.stadiumId})" title="Delete Arena">
                                <i class="bi bi-trash me-1"></i>Delete
                            </button>
                            ${ownerRole === 'Owner' ? `<button class="btn btn-sm btn-outline-info" onclick="showAvailabilityModal(${arena.arenaId}, ${arena.stadiumId})" title="Set Availability"><i class="bi bi-clock me-1"></i>Availability</button>` : ''}
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
    tableContainer.innerHTML = table;

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

let searchTimeout = {};
function handleArenaSearchInput(stadiumId, event) {
    clearTimeout(searchTimeout[stadiumId]);
    searchTimeout[stadiumId] = setTimeout(() => {
        const searchInput = document.getElementById(`arena-search-${stadiumId}`);
        const searchText = searchInput ? searchInput.value : '';
        const state = stadiumArenaState[stadiumId] || {};
        loadArenasForStadium(stadiumId, 1, state.pageSize || 10, searchText, state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
    }, 500); 
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

function toggleStadiumCard(stadiumId) {
    const arenaContainer = document.getElementById(`arena-container-${stadiumId}`);
    const collapseIcon = document.getElementById(`collapse-icon-${stadiumId}`);
    
    if (!arenaContainer) return;
    
    if (arenaContainer.style.display === 'none') {
        arenaContainer.style.display = 'block';
        if (collapseIcon) collapseIcon.textContent = '▼';
    } else {
        arenaContainer.style.display = 'none';
        if (collapseIcon) collapseIcon.textContent = '▶';
    }
}

window.handleArenaSearch = handleArenaSearch;
window.handleArenaSearchInput = handleArenaSearchInput;
window.handleArenaSort = handleArenaSort;
window.handlePageChange = handlePageChange;
window.handlePageSizeChange = handlePageSizeChange;
window.toggleStadiumCard = toggleStadiumCard;

function showAddStadiumModal() {
    document.getElementById('addStadiumModal').style.display = 'block';
}

function closeAddStadiumModal() {
    document.getElementById('addStadiumModal').style.display = 'none';
    document.getElementById('addStadiumForm').reset();
}

function showAddArenaModal(stadiumId) {
    document.getElementById('arenaStadiumId').value = stadiumId;
    
    const modalElement = document.getElementById('addArenaModal');
    const modal = new bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: true,
        focus: true
    });
    modal.show();
}

function closeAddArenaModal() {
    const modalElement = document.getElementById('addArenaModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
        modal.hide();
    }
    
    const form = document.getElementById('addArenaForm');
    form.reset();
    delete form.dataset.arenaId;
    delete form.dataset.isEdit;

    const modalTitle = document.querySelector('#addArenaModal .modal-title');
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
        
        const currentPage = window.location.pathname;
        if (currentPage.includes('booking.html') || currentPage.includes('requests.html')) {
            window.location.reload();
        } else {
            
            const bookingSection = document.getElementById('bookingSection');
            if (bookingSection && bookingSection.style.display !== 'none') {
                loadOwnerBookings();
            }
        }
    } catch (error) {
        showAlertModal('Error: ' + error.message, 'error');
    }
}

async function loadOwnerBookings() {
    try {
        const bookings = await API.getBookings();
        displayOwnerBookings(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
        const container = document.getElementById('ownerBookings');
        if (container) {
            container.innerHTML = '<p class="error-message">Error loading bookings: ' + error.message + '</p>';
        }
    }
}

async function loadOwnerRequests() {
    const container = document.getElementById('ownerRequests');
    if (!container) {
        console.error('ownerRequests container not found!');
        return;
    }
    
    container.innerHTML = '<p>Loading requests...</p>';
    
    try {
        
        const bookings = await API.getBookings();
        
        const pendingBookings = bookings.filter(booking => booking.status === 'Pending');
        displayOwnerRequests(pendingBookings);
    } catch (error) {
        console.error('Error loading requests:', error);
        container.innerHTML = '<p class="error-message">Error loading requests: ' + error.message + '</p>';
    }
}

function displayOwnerRequests(requests) {
    const container = document.getElementById('ownerRequests');
    if (!container) {
        console.error('ownerRequests container not found!');
        return;
    }
    
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
        container.innerHTML = '<p>No pending requests at the moment.</p>';
        return;
    }

    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Request ID</th>
                    <th>Arena</th>
                    <th>Stadium</th>
                    <th>Customer</th>
                    <th>Date & Time</th>
                    <th>Price</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${requests.map(request => `
                    <tr>
                        <td>${request.bookingId}</td>
                        <td>${request.arenaName || 'N/A'}</td>
                        <td>${request.stadiumName || 'N/A'}</td>
                        <td>User #${request.userId}</td>
                        <td>${new Date(request.slotStart).toLocaleString()} - ${new Date(request.slotEnd).toLocaleString()}</td>
                        <td>$${request.price ? request.price.toFixed(2) : '0.00'}</td>
                        <td>
                            <button class="btn btn-sm btn-success" onclick="updateBookingStatus(${request.bookingId}, 'Confirmed')">Approve</button>
                            <button class="btn btn-sm btn-danger" onclick="updateBookingStatus(${request.bookingId}, 'Cancelled')">Reject</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = table;
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

    if (!bookings) {
        container.innerHTML = '<p class="error-message">Error: No data received from server.</p>';
        return;
    }

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
        showAlertModal('Error: ' + error.message, 'error');
    }
}

window.cancelUserBooking = cancelUserBooking;

let userAvailabilityState = {
    pageNumber: 1,
    pageSize: 10,
    searchText: '',
    sortColumn: 'CreatedDate',
    sortDirection: 'DESC'
};

let userAvailabilitySearchTimeout = null;

async function loadUserDashboard() {
    try {
        await loadUserAvailabilityTable();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadUserAvailabilityTable(pageNumber = userAvailabilityState.pageNumber, pageSize = userAvailabilityState.pageSize, searchText = userAvailabilityState.searchText, sortColumn = userAvailabilityState.sortColumn, sortDirection = userAvailabilityState.sortDirection) {
    const tableContainer = document.getElementById('userAvailabilityTable');
    const paginationContainer = document.getElementById('userAvailabilityPagination');
    
    if (!tableContainer) {
        console.error('User availability table container not found');
        return;
    }

    tableContainer.innerHTML = '<p>Loading availability...</p>';

    try {
        const result = await API.getUserAvailabilities({
            searchText,
            sortColumn,
            sortDirection,
            pageNumber: 1,
            pageSize: 1000 
        });

        const currentDateTime = new Date();
        const allAvailabilities = result.availabilities || [];
        console.log('Total availabilities from API:', allAvailabilities.length);
        
        const futureAvailabilities = allAvailabilities.filter(av => {
            
            const availabilityEndDateTime = parseAvailabilityDateTime(av.date, av.endTime);
            
            if (!availabilityEndDateTime) {
                
                console.log('Excluding record with invalid date/time:', av);
                return false;
            }

            const isFuture = availabilityEndDateTime > currentDateTime;
            if (!isFuture) {
                console.log('Excluding past record:', av.date, av.endTime);
            }
            return isFuture;
        });
        
        console.log('Future availabilities after filtering:', futureAvailabilities.length);

        const validPageSize = parseInt(pageSize, 10) || 10;
        const validPageNumber = parseInt(pageNumber, 10) || 1;
        
        const startIndex = (validPageNumber - 1) * validPageSize;
        const endIndex = startIndex + validPageSize;
        const paginatedAvailabilities = futureAvailabilities.slice(startIndex, endIndex);
        const totalCount = futureAvailabilities.length;
        const totalPages = Math.ceil(totalCount / validPageSize) || 1;
        
        console.log('Pagination:', {
            validPageSize,
            validPageNumber,
            startIndex,
            endIndex,
            totalCount,
            totalPages,
            paginatedCount: paginatedAvailabilities.length
        });

        const filteredResult = {
            availabilities: paginatedAvailabilities,
            totalCount: totalCount,
            totalPages: totalPages,
            pageNumber: validPageNumber,
            pageSize: validPageSize
        };

        userAvailabilityState = {
            pageNumber: validPageNumber,
            pageSize: validPageSize,
            searchText,
            sortColumn,
            sortDirection,
            totalCount: totalCount,
            totalPages: totalPages
        };

        displayUserAvailabilityTable(filteredResult);
    } catch (error) {
        console.error('Error loading availability:', error);
        tableContainer.innerHTML = `<p class="error-message">Error loading availability: ${error.message}</p>`;
    }
}

function formatTime(timeStr) {
    if (!timeStr || timeStr === 'N/A') return timeStr;
    
    return timeStr.replace(/\.\d+/g, '').trim();
}

function parseAvailabilityDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr || dateStr === 'N/A' || timeStr === 'N/A') {
        return null;
    }
    
    try {
        
        const cleanTime = timeStr.replace(/\.\d+/g, '').trim();

        const cleanDate = dateStr.trim();

        const dateParts = cleanDate.split('-');
        if (dateParts.length !== 3) {
            console.warn('Invalid date format:', cleanDate);
            return null;
        }
        
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; 
        const day = parseInt(dateParts[2], 10);

        const timeParts = cleanTime.split(':');
        if (timeParts.length < 2) {
            console.warn('Invalid time format:', cleanTime);
            return null;
        }
        
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;

        const dateTime = new Date(year, month, day, hours, minutes, seconds);
        
        if (isNaN(dateTime.getTime())) {
            console.warn('Failed to create date from components:', { year, month, day, hours, minutes, seconds });
            return null;
        }
        
        return dateTime;
    } catch (e) {
        console.error('Error parsing date/time:', e, 'date:', dateStr, 'time:', timeStr);
        return null;
    }
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === 'N/A') return dateStr;
    
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr; 
        
        const day = date.getDate();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day}-${month}-${year}`;
    } catch (error) {
        return dateStr; 
    }
}

function displayUserAvailabilityTable(result) {
    const tableContainer = document.getElementById('userAvailabilityTable');
    const paginationContainer = document.getElementById('userAvailabilityPagination');
    
    if (!tableContainer) return;

    console.log('Displaying user availability table:', {
        resultCount: result?.availabilities?.length || 0,
        totalCount: result?.totalCount || 0,
        pageNumber: result?.pageNumber || 0,
        pageSize: result?.pageSize || 0
    });

    if (!result || !result.availabilities || result.availabilities.length === 0) {
        tableContainer.innerHTML = '<p>No available slots found at the moment. Please check back later.</p>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const sortColumn = userAvailabilityState.sortColumn || 'CreatedDate';
    const sortDirection = userAvailabilityState.sortDirection || 'DESC';

        const getSortIcon = (col) => {
            if (col !== sortColumn) {
                return '<i class="bi bi-arrow-up sort-icon" style="opacity: 0.5;"></i><i class="bi bi-arrow-down sort-icon" style="opacity: 0.5;"></i>';
            }
            return sortDirection === 'ASC' 
                ? '<i class="bi bi-arrow-up sort-icon" style="opacity: 1;"></i>' 
                : '<i class="bi bi-arrow-down sort-icon" style="opacity: 1;"></i>';
        };

    const getSortHandler = (col) => {
        const newDirection = (sortColumn === col && sortDirection === 'ASC') ? 'DESC' : 'ASC';
        return `handleUserAvailabilitySort('${col}', '${newDirection}')`;
    };

    const table = `
        <table class="table data-table">
            <thead>
                <tr>
                    <th class="sortable-header" onclick="${getSortHandler('StadiumName')}">Stadium Name ${getSortIcon('StadiumName')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('ArenaName')}">Arena Name ${getSortIcon('ArenaName')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('Location')}">Location ${getSortIcon('Location')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('SportType')}">Sport Type ${getSortIcon('SportType')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('Capacity')}">Capacity ${getSortIcon('Capacity')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('Date')}">Date ${getSortIcon('Date')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('StartTime')}">Start Time ${getSortIcon('StartTime')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('EndTime')}">End Time ${getSortIcon('EndTime')}</th>
                    <th>Total Duration (Minutes)</th>
                    <th class="sortable-header" onclick="${getSortHandler('Price')}">Price ${getSortIcon('Price')}</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${result.availabilities.map(availability => {
                    const stadiumName = availability.stadiumName || 'N/A';
                    const arenaName = availability.arenaName || 'N/A';
                    const location = availability.location || 'N/A';
                    const sportTypeRaw = availability.sportType || 'N/A';
                    const sportType = sportTypeRaw !== 'N/A' ? sportTypeRaw.charAt(0).toUpperCase() + sportTypeRaw.slice(1).toLowerCase() : 'N/A';
                    const capacity = availability.capacity || 0;
                    const date = formatDate(availability.date || 'N/A');
                    const startTime = formatTime(availability.startTime || 'N/A');
                    const endTime = formatTime(availability.endTime || 'N/A');
                    const totalDuration = availability.totalDuration || 0;
                    const price = availability.price ? availability.price.toFixed(2) : '0.00';
                    const availabilityId = availability.id || '';
                    const arenaId = availability.arenaId || 0;
                    
                    return `
                    <tr>
                        <td>${stadiumName}</td>
                        <td>${arenaName}</td>
                        <td>${location}</td>
                        <td>${sportType}</td>
                        <td>${capacity} players</td>
                        <td>${date}</td>
                        <td>${startTime}</td>
                        <td>${endTime}</td>
                        <td>${totalDuration}</td>
                        <td>$${price}</td>
                        <td>
                            <button class="btn btn-primary btn-sm" onclick="bookAvailabilitySlot('${availabilityId}', ${arenaId}, '${date}', '${startTime}', '${endTime}')">
                                <i class="bi bi-calendar-check me-1"></i>Book Now
                            </button>
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
    tableContainer.innerHTML = table;

    if (paginationContainer && result.totalPages > 0) {
        const startRecord = result.totalCount > 0 ? ((result.pageNumber - 1) * result.pageSize) + 1 : 0;
        const endRecord = Math.min(result.pageNumber * result.pageSize, result.totalCount);
        
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                Showing ${startRecord} to ${endRecord} of ${result.totalCount} records
                <select class="page-size-select" onchange="handleUserAvailabilityPageSizeChange(this.value)">
                    <option value="10" ${result.pageSize === 10 ? 'selected' : ''}>10 per page</option>
                    <option value="25" ${result.pageSize === 25 ? 'selected' : ''}>25 per page</option>
                    <option value="50" ${result.pageSize === 50 ? 'selected' : ''}>50 per page</option>
                    <option value="100" ${result.pageSize === 100 ? 'selected' : ''}>100 per page</option>
                </select>
            </div>
            <nav>
                <ul class="pagination">
                    <li class="page-item ${result.pageNumber === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="handleUserAvailabilityPageChange(${result.pageNumber - 1}); return false;">Previous</a>
                    </li>
                    ${Array.from({ length: result.totalPages }, (_, i) => i + 1).map(page => `
                        <li class="page-item ${page === result.pageNumber ? 'active' : ''}">
                            <a class="page-link" href="#" onclick="handleUserAvailabilityPageChange(${page}); return false;">${page}</a>
                        </li>
                    `).join('')}
                    <li class="page-item ${result.pageNumber >= result.totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="handleUserAvailabilityPageChange(${result.pageNumber + 1}); return false;">Next</a>
                    </li>
                </ul>
            </nav>
        `;
    } else if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }
}

function handleUserAvailabilitySearch(event) {
    if (event.key === 'Enter') {
        const searchInput = document.getElementById('userAvailabilitySearch');
        const searchText = searchInput ? searchInput.value : '';
        loadUserAvailabilityTable(1, userAvailabilityState.pageSize || 10, searchText, userAvailabilityState.sortColumn || 'CreatedDate', userAvailabilityState.sortDirection || 'DESC');
    }
}

function handleUserAvailabilitySearchInput(event) {
    clearTimeout(userAvailabilitySearchTimeout);
    userAvailabilitySearchTimeout = setTimeout(() => {
        const searchInput = document.getElementById('userAvailabilitySearch');
        const searchText = searchInput ? searchInput.value : '';
        loadUserAvailabilityTable(1, userAvailabilityState.pageSize || 10, searchText, userAvailabilityState.sortColumn || 'CreatedDate', userAvailabilityState.sortDirection || 'DESC');
    }, 500); 
}

function handleUserAvailabilitySort(sortColumn, sortDirection) {
    loadUserAvailabilityTable(1, userAvailabilityState.pageSize || 10, userAvailabilityState.searchText || '', sortColumn, sortDirection);
}

function handleUserAvailabilityPageChange(pageNumber) {
    loadUserAvailabilityTable(pageNumber, userAvailabilityState.pageSize || 10, userAvailabilityState.searchText || '', userAvailabilityState.sortColumn || 'CreatedDate', userAvailabilityState.sortDirection || 'DESC');
}

function handleUserAvailabilityPageSizeChange(pageSize) {
    const newPageSize = parseInt(pageSize, 10);
    if (isNaN(newPageSize) || newPageSize < 1) {
        console.error('Invalid page size:', pageSize);
        return;
    }
    
    loadUserAvailabilityTable(1, newPageSize, userAvailabilityState.searchText || '', userAvailabilityState.sortColumn || 'CreatedDate', userAvailabilityState.sortDirection || 'DESC');
}

function formatTimeForBooking(timeStr) {
    if (!timeStr || timeStr === 'N/A') return timeStr;
    
    return timeStr.replace(/\.\d+/g, '').trim();
}

function formatDateForBooking(dateStr) {
    if (!dateStr || dateStr === 'N/A') return dateStr;
    
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr; 
        
        const day = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day}-${month}-${year}`;
    } catch (error) {
        return dateStr; 
    }
}

async function bookAvailabilitySlot(availabilityId, arenaId, date, startTime, endTime) {
    
    document.getElementById('bookingAvailabilityId').value = availabilityId;
    
    try {
        
        const details = await API.getBookingRequestDetails(availabilityId);

        document.getElementById('bookingStadiumName').textContent = details.stadiumName || 'N/A';
        document.getElementById('bookingArenaName').textContent = details.arenaName || 'N/A';
        document.getElementById('bookingDate').textContent = formatDateForBooking(details.date || 'N/A');
        document.getElementById('bookingStartTime').textContent = formatTimeForBooking(details.startTime || 'N/A');
        document.getElementById('bookingEndTime').textContent = formatTimeForBooking(details.endTime || 'N/A');
        document.getElementById('bookingTotalDuration').textContent = (details.totalDuration || 0) + ' minutes';
        document.getElementById('bookingPrice').textContent = '$' + (details.price ? details.price.toFixed(2) : '0.00');

        const modalElement = document.getElementById('bookingConfirmationModal');
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        modal.show();
    } catch (error) {
        showAlertModal('Error loading booking details: ' + error.message, 'error');
    }
}

window.handleUserAvailabilitySearch = handleUserAvailabilitySearch;
window.handleUserAvailabilitySearchInput = handleUserAvailabilitySearchInput;
window.handleUserAvailabilitySort = handleUserAvailabilitySort;
window.handleUserAvailabilityPageChange = handleUserAvailabilityPageChange;
window.handleUserAvailabilityPageSizeChange = handleUserAvailabilityPageSizeChange;
window.bookAvailabilitySlot = bookAvailabilitySlot;

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

    if (!arenas) {
        container.innerHTML = '<p class="error-message">Error: No data received from server.</p>';
        return;
    }

    if (!Array.isArray(arenas)) {
        console.error('Arenas is not an array:', arenas);
        container.innerHTML = '<p class="error-message">Error: Invalid data received from server.</p>';
        return;
    }
    
    if (arenas.length === 0) {
        container.innerHTML = '<p>No arenas available yet. Please check back later.</p>';
        return;
    }

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
                    <th>Actions</th>
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

        document.getElementById('arenaStadiumId').value = stadiumId;
        document.getElementById('arenaName').value = arena.name || '';
        document.getElementById('arenaSportType').value = arena.sportType || '';
        document.getElementById('arenaCapacity').value = arena.capacity || '';
        document.getElementById('arenaSlotDuration').value = arena.slotDuration || '';
        document.getElementById('arenaPrice').value = arena.price || '';

        document.getElementById('addArenaForm').dataset.arenaId = arenaId;
        document.getElementById('addArenaForm').dataset.isEdit = 'true';

        const modalTitle = document.querySelector('#addArenaModal .modal-title');
        const submitButton = document.querySelector('#addArenaForm button[type="submit"]');
        if (modalTitle) modalTitle.textContent = 'Edit Arena';
        if (submitButton) submitButton.textContent = 'Update Arena';

        const modalElement = document.getElementById('addArenaModal');
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        modal.show();
    } catch (error) {
        showAlertModal('Error loading arena: ' + error.message, 'error');
    }
}

async function deleteArena(arenaId, stadiumId) {
    if (!confirm('Are you sure you want to delete this arena? This action cannot be undone.')) {
        return;
    }
    
    try {
        await API.deleteArena(arenaId);
        
        const state = stadiumArenaState[stadiumId] || {};
        loadArenasForStadium(stadiumId, state.pageNumber || 1, state.pageSize || 10, state.searchText || '', state.sortColumn || 'CreatedAt', state.sortDirection || 'DESC');
    } catch (error) {
        showAlertModal('Error deleting arena: ' + error.message, 'error');
    }
}

let availabilitySlotCount = 0;

function showAvailabilityModal(arenaId, stadiumId) {
    availabilitySlotCount = 0;
    document.getElementById('availabilityArenaId').value = arenaId;
    document.getElementById('availabilitySlots').innerHTML = '';

    addAvailabilitySlot();
    
    const modalElement = document.getElementById('availabilityModal');

    const existingModal = bootstrap.Modal.getInstance(modalElement);
    if (existingModal) {
        existingModal.dispose();
    }

    const modal = new bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: true,
        focus: true
    });
    
    modal.show();
}

function addAvailabilitySlot() {
    if (availabilitySlotCount >= 10) {
        showAlertModal('Maximum 10 availability slots allowed', 'warning');
        return;
    }
    
    availabilitySlotCount++;
    const slotId = `slot-${availabilitySlotCount}`;
    const slotsContainer = document.getElementById('availabilitySlots');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const minDate = todayStr;
    
    const slotHtml = `
        <div class="availability-slot mb-3 p-3 border rounded" id="${slotId}">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0">Date Entry ${availabilitySlotCount}</h6>
                ${availabilitySlotCount > 1 ? `<button type="button" class="btn btn-sm btn-danger" onclick="removeAvailabilitySlot('${slotId}')">
                    <i class="bi bi-trash"></i> Remove
                </button>` : ''}
            </div>
            <div class="row g-3">
                <div class="col-md-4">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-control availability-date" required min="${minDate}" value="${todayStr}" placeholder="Select Date">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Start Time</label>
                    <select class="form-select availability-start-time" required>
                        <option value="">Select Start Time</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label">End Time</label>
                    <select class="form-select availability-end-time" required>
                        <option value="">Select End Time</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    slotsContainer.insertAdjacentHTML('beforeend', slotHtml);

    const slotElement = document.getElementById(slotId);
    const startTimeSelect = slotElement.querySelector('.availability-start-time');
    const endTimeSelect = slotElement.querySelector('.availability-end-time');

    const timeOptions = generateTimeOptions();
    timeOptions.forEach(time => {
        
        const startOption = document.createElement('option');
        startOption.value = time;
        startOption.textContent = time;
        startTimeSelect.appendChild(startOption);

        const endOption = document.createElement('option');
        endOption.value = time;
        endOption.textContent = time;
        endTimeSelect.appendChild(endOption);
    });

    startTimeSelect.addEventListener('change', function() {
        updateEndTimeOptions(slotElement);
    });

    const addBtn = document.getElementById('addDateBtn');
    if (availabilitySlotCount >= 10) {
        addBtn.style.display = 'none';
    } else {
        addBtn.style.display = 'block';
    }
}

function generateTimeOptions() {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            options.push(timeStr);
        }
    }
    return options;
}

function updateEndTimeOptions(slotElement) {
    const startTimeSelect = slotElement.querySelector('.availability-start-time');
    const endTimeSelect = slotElement.querySelector('.availability-end-time');
    const validationMsg = slotElement.querySelector('.end-time-validation');

    if (validationMsg) {
        validationMsg.remove();
    }
    
    if (!startTimeSelect.value) {
        
        Array.from(endTimeSelect.options).forEach(option => {
            if (option.value !== '') {
                option.disabled = false;
                option.style.color = '';
                option.style.opacity = '1';
            }
        });
        
        endTimeSelect.value = '';
        return;
    }

    const [startHours, startMinutes] = startTimeSelect.value.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;

    const minEndTotalMinutes = startTotalMinutes + 60;

    const currentEndTime = endTimeSelect.value;

    let hasEnabledOptions = false;
    Array.from(endTimeSelect.options).forEach(option => {
        if (option.value === '') {
            
            return;
        }
        
        const [endHours, endMinutes] = option.value.split(':').map(Number);
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        if (endTotalMinutes >= minEndTotalMinutes) {
            option.disabled = false;
            option.style.color = '';
            option.style.opacity = '1';
            hasEnabledOptions = true;
        } else {
            option.disabled = true;
            option.style.color = '#999';
            option.style.opacity = '0.5';
        }
    });

    if (currentEndTime) {
        const selectedOption = endTimeSelect.querySelector(`option[value="${currentEndTime}"]`);
        if (selectedOption && selectedOption.disabled) {
            endTimeSelect.value = '';
        }
    }

    if (!hasEnabledOptions) {
        const validationDiv = document.createElement('div');
        validationDiv.className = 'end-time-validation text-danger small mt-1';
        validationDiv.textContent = 'No valid end time options available. Please select a different start time.';
        endTimeSelect.parentElement.appendChild(validationDiv);
    }
}

function removeAvailabilitySlot(slotId) {
    const slot = document.getElementById(slotId);
    if (slot) {
        slot.remove();
        availabilitySlotCount--;

        const addBtn = document.getElementById('addDateBtn');
        if (availabilitySlotCount < 10) {
            addBtn.style.display = 'block';
        }

        renumberAvailabilitySlots();
    }
}

function renumberAvailabilitySlots() {
    const slots = document.querySelectorAll('.availability-slot');
    slots.forEach((slot, index) => {
        const header = slot.querySelector('h6');
        if (header) {
            header.textContent = `Date Entry ${index + 1}`;
        }
    });
}

function showSection(section) {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
    const role = user.role === 'Owner' ? 'owner' : 'user';

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const activeLink = document.querySelector(`.nav-link[data-section="${section}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    if (role === 'owner') {
        
        document.getElementById('homeSection').style.display = 'none';
        document.getElementById('bookingSection').style.display = 'none';
        document.getElementById('requestsSection').style.display = 'none';
        document.getElementById('paymentsSection').style.display = 'none';

        if (section === 'home') {
            document.getElementById('homeSection').style.display = 'block';
        } else if (section === 'booking') {
            document.getElementById('bookingSection').style.display = 'block';
            loadOwnerBookings();
        } else if (section === 'requests') {
            document.getElementById('requestsSection').style.display = 'block';
            loadOwnerRequests();
        } else if (section === 'payments') {
            document.getElementById('paymentsSection').style.display = 'block';
        }
    } else {
        
        document.getElementById('userHomeSection').style.display = 'none';
        document.getElementById('userBookingSection').style.display = 'none';

        if (section === 'home') {
            document.getElementById('userHomeSection').style.display = 'block';
            loadAvailableArenas();
        } else if (section === 'booking') {
            document.getElementById('userBookingSection').style.display = 'block';
            loadUserBookings();
        }
    }
}

window.showAddStadiumModal = showAddStadiumModal;
window.closeAddStadiumModal = closeAddStadiumModal;
window.showAddArenaModal = showAddArenaModal;
window.closeAddArenaModal = closeAddArenaModal;
window.editArena = editArena;
window.deleteArena = deleteArena;
window.showAvailabilityModal = showAvailabilityModal;
window.addAvailabilitySlot = addAvailabilitySlot;
window.removeAvailabilitySlot = removeAvailabilitySlot;

window.onclick = function(event) {
    const stadiumModal = document.getElementById('addStadiumModal');
    
    if (event.target == stadiumModal) {
        closeAddStadiumModal();
    }
}

