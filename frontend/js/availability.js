// Availability table functionality

// State for pagination, search, and sorting
let availabilityState = {
    pageNumber: 1,
    pageSize: 10,
    searchText: '',
    sortColumn: 'CreatedDate',
    sortDirection: 'DESC'
};

// Debounced search timeout
let availabilitySearchTimeout = null;

// Load availability table on page load
document.addEventListener('DOMContentLoaded', async () => {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== 'Owner') {
        window.location.href = 'dashboard.html';
        return;
    }

    // Load initial data
    await loadAvailabilityTable();
});

async function loadAvailabilityTable(pageNumber = availabilityState.pageNumber, pageSize = availabilityState.pageSize, searchText = availabilityState.searchText, sortColumn = availabilityState.sortColumn, sortDirection = availabilityState.sortDirection) {
    const tableContainer = document.getElementById('availabilityTable');
    const paginationContainer = document.getElementById('availabilityPagination');
    
    if (!tableContainer) {
        console.error('Availability table container not found');
        return;
    }

    tableContainer.innerHTML = '<p>Loading availability...</p>';

    try {
        const result = await API.getOwnerAvailabilities({
            searchText,
            sortColumn,
            sortDirection,
            pageNumber,
            pageSize
        });

        // Update state
        availabilityState = {
            pageNumber,
            pageSize,
            searchText,
            sortColumn,
            sortDirection,
            totalCount: result.totalCount || 0,
            totalPages: result.totalPages || 0
        };

        displayAvailabilityTable(result);
    } catch (error) {
        console.error('Error loading availability:', error);
        tableContainer.innerHTML = `<p class="error-message">Error loading availability: ${error.message}</p>`;
    }
}

function displayAvailabilityTable(result) {
    const tableContainer = document.getElementById('availabilityTable');
    const paginationContainer = document.getElementById('availabilityPagination');
    
    if (!tableContainer) return;

    if (!result || !result.availabilities || result.availabilities.length === 0) {
        tableContainer.innerHTML = '<p>No availability records found.</p>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const sortColumn = availabilityState.sortColumn || 'CreatedDate';
    const sortDirection = availabilityState.sortDirection || 'DESC';

    // Generate sort icon
    const getSortIcon = (col) => {
        if (col !== sortColumn) {
            return '<i class="bi bi-arrow-up sort-icon" style="opacity: 0.5;"></i><i class="bi bi-arrow-down sort-icon" style="opacity: 0.5;"></i>';
        }
        return sortDirection === 'ASC' 
            ? '<i class="bi bi-arrow-up sort-icon" style="opacity: 1;"></i>' 
            : '<i class="bi bi-arrow-down sort-icon" style="opacity: 1;"></i>';
    };

    // Generate sort handler
    const getSortHandler = (col) => {
        const newDirection = (sortColumn === col && sortDirection === 'ASC') ? 'DESC' : 'ASC';
        return `handleAvailabilitySort('${col}', '${newDirection}')`;
    };

    const table = `
        <table class="table data-table">
            <thead>
                <tr>
                    <th class="sortable-header" onclick="${getSortHandler('Date')}">Date ${getSortIcon('Date')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('StartTime')}">Start Time ${getSortIcon('StartTime')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('EndTime')}">End Time ${getSortIcon('EndTime')}</th>
                    <th>Total Duration (Minutes)</th>
                    <th class="sortable-header" onclick="${getSortHandler('StadiumName')}">Stadium Name ${getSortIcon('StadiumName')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('ArenaName')}">Arena Name ${getSortIcon('ArenaName')}</th>
                    <th class="sortable-header" onclick="${getSortHandler('BookerName')}">Booker Name ${getSortIcon('BookerName')}</th>
                    <th>Reserved</th>
                    <th class="sortable-header" onclick="${getSortHandler('CreatedDate')}">Created Date ${getSortIcon('CreatedDate')}</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${result.availabilities.map(availability => {
                    const date = availability.date || 'N/A';
                    const startTime = availability.startTime || 'N/A';
                    const endTime = availability.endTime || 'N/A';
                    const totalDuration = availability.totalDuration || 0;
                    const stadiumName = availability.stadiumName || 'N/A';
                    const arenaName = availability.arenaName || 'N/A';
                    const bookerName = availability.bookerName || 'N/A';
                    const reserved = availability.reserved ? 'Yes' : 'No';
                    const createdDate = availability.createdDate ? new Date(availability.createdDate).toLocaleString() : 'N/A';
                    const availabilityId = availability.id || '';
                    const isReserved = availability.reserved || false;
                    
                    return `
                    <tr>
                        <td>${date}</td>
                        <td>${startTime}</td>
                        <td>${endTime}</td>
                        <td>${totalDuration}</td>
                        <td>${stadiumName}</td>
                        <td>${arenaName}</td>
                        <td>${bookerName}</td>
                        <td><span class="badge ${availability.reserved ? 'status-booked' : 'bg-secondary text-white'}">${reserved}</span></td>
                        <td>${createdDate}</td>
                        <td>
                            ${!isReserved ? `
                                <button class="btn btn-sm btn-danger" onclick="deleteAvailability('${availabilityId}')" title="Delete Availability">
                                    <i class="bi bi-trash me-1"></i>Delete
                                </button>
                            ` : `
                                <button class="btn btn-sm btn-danger disabled" disabled title="Cannot delete reserved availability">
                                    <i class="bi bi-trash me-1"></i>Delete
                                </button>
                            `}
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
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                Showing ${((availabilityState.pageNumber - 1) * availabilityState.pageSize) + 1} to ${Math.min(availabilityState.pageNumber * availabilityState.pageSize, availabilityState.totalCount)} of ${availabilityState.totalCount} records
                <select class="page-size-select" onchange="handleAvailabilityPageSizeChange(this.value)">
                    <option value="10" ${availabilityState.pageSize === 10 ? 'selected' : ''}>10 per page</option>
                    <option value="25" ${availabilityState.pageSize === 25 ? 'selected' : ''}>25 per page</option>
                    <option value="50" ${availabilityState.pageSize === 50 ? 'selected' : ''}>50 per page</option>
                    <option value="100" ${availabilityState.pageSize === 100 ? 'selected' : ''}>100 per page</option>
                </select>
            </div>
            <div class="pagination-controls">
                <button onclick="handleAvailabilityPageChange(1)" ${availabilityState.pageNumber === 1 ? 'disabled' : ''}>First</button>
                <button onclick="handleAvailabilityPageChange(${availabilityState.pageNumber - 1})" ${availabilityState.pageNumber === 1 ? 'disabled' : ''}>Previous</button>
                <span>Page ${availabilityState.pageNumber} of ${availabilityState.totalPages}</span>
                <button onclick="handleAvailabilityPageChange(${availabilityState.pageNumber + 1})" ${availabilityState.pageNumber >= availabilityState.totalPages ? 'disabled' : ''}>Next</button>
                <button onclick="handleAvailabilityPageChange(${availabilityState.totalPages})" ${availabilityState.pageNumber >= availabilityState.totalPages ? 'disabled' : ''}>Last</button>
            </div>
        `;
    }
}

function handleAvailabilitySearch(event) {
    if (event.key === 'Enter') {
        const searchInput = document.getElementById('availabilitySearch');
        const searchText = searchInput ? searchInput.value : '';
        loadAvailabilityTable(1, availabilityState.pageSize || 10, searchText, availabilityState.sortColumn || 'CreatedDate', availabilityState.sortDirection || 'DESC');
    }
}

function handleAvailabilitySearchInput(event) {
    clearTimeout(availabilitySearchTimeout);
    availabilitySearchTimeout = setTimeout(() => {
        const searchInput = document.getElementById('availabilitySearch');
        const searchText = searchInput ? searchInput.value : '';
        loadAvailabilityTable(1, availabilityState.pageSize || 10, searchText, availabilityState.sortColumn || 'CreatedDate', availabilityState.sortDirection || 'DESC');
    }, 500); // 500ms delay
}

function handleAvailabilitySort(sortColumn, sortDirection) {
    loadAvailabilityTable(1, availabilityState.pageSize || 10, availabilityState.searchText || '', sortColumn, sortDirection);
}

function handleAvailabilityPageChange(pageNumber) {
    loadAvailabilityTable(pageNumber, availabilityState.pageSize || 10, availabilityState.searchText || '', availabilityState.sortColumn || 'CreatedDate', availabilityState.sortDirection || 'DESC');
}

function handleAvailabilityPageSizeChange(pageSize) {
    loadAvailabilityTable(1, parseInt(pageSize), availabilityState.searchText || '', availabilityState.sortColumn || 'CreatedDate', availabilityState.sortDirection || 'DESC');
}

async function deleteAvailability(availabilityId) {
    if (!confirm('Are you sure you want to delete this availability? This action cannot be undone.')) {
        return;
    }
    
    try {
        await API.deleteArenaAvailability(availabilityId);
        await loadAvailabilityTable();
    } catch (error) {
        alert('Error deleting availability: ' + error.message);
    }
}

// Make functions globally accessible
window.handleAvailabilitySearch = handleAvailabilitySearch;
window.handleAvailabilitySearchInput = handleAvailabilitySearchInput;
window.handleAvailabilitySort = handleAvailabilitySort;
window.handleAvailabilityPageChange = handleAvailabilityPageChange;
window.handleAvailabilityPageSizeChange = handleAvailabilityPageSizeChange;
window.deleteAvailability = deleteAvailability;

