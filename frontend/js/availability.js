

let availabilityState = {
    pageNumber: 1,
    pageSize: 10,
    searchText: '',
    sortColumn: 'CreatedDate',
    sortDirection: 'DESC',
    reservationFilter: null 
};

let allAvailabilities = []; 

let availabilitySearchTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', executeDeleteAvailability);
    }

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

    updateFilterButtonStyles(null);

    await loadAvailabilityTable();
});

async function loadAvailabilityTable(pageNumber = availabilityState.pageNumber, pageSize = availabilityState.pageSize, searchText = availabilityState.searchText, sortColumn = availabilityState.sortColumn, sortDirection = availabilityState.sortDirection, reservationFilter = availabilityState.reservationFilter) {
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
            pageNumber: 1,
            pageSize: 1000
        });

        console.log('Loaded availabilities:', result);

        allAvailabilities = result.availabilities || [];

        let filteredAvailabilities = allAvailabilities;
        if (reservationFilter !== null) {
            filteredAvailabilities = allAvailabilities.filter(av => (av.reserved || false) === reservationFilter);
        }

        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedAvailabilities = filteredAvailabilities.slice(startIndex, endIndex);
        const totalCount = filteredAvailabilities.length;
        const totalPages = Math.ceil(totalCount / pageSize);

        const filteredResult = {
            availabilities: paginatedAvailabilities,
            totalCount: totalCount,
            totalPages: totalPages
        };

        availabilityState = {
            pageNumber,
            pageSize,
            searchText,
            sortColumn,
            sortDirection,
            reservationFilter: reservationFilter,
            totalCount: totalCount,
            totalPages: totalPages
        };

        displayAvailabilityTable(filteredResult);
    } catch (error) {
        console.error('Error loading availability:', error);
        tableContainer.innerHTML = `<p class="error-message">Error loading availability: ${error.message}</p>`;
    }
}

function formatTime(timeStr) {
    if (!timeStr || timeStr === 'N/A') return timeStr;
    
    return timeStr.replace(/\.\d+/g, '').trim();
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
                    const date = formatDate(availability.date || 'N/A');
                    const startTime = formatTime(availability.startTime || 'N/A');
                    const endTime = formatTime(availability.endTime || 'N/A');
                    const totalDuration = availability.totalDuration || 0;
                    const stadiumName = availability.stadiumName || 'N/A';
                    const arenaName = availability.arenaName || 'N/A';
                    const bookerName = availability.bookerName || 'N/A';
                    const reserved = availability.reserved ? 'Yes' : 'No';
                    const createdDate = availability.createdDate ? new Date(availability.createdDate).toLocaleString() : 'N/A';
                    const availabilityId = availability.id || '';
                    const isReserved = availability.reserved || false;

                    let canDelete = false;
                    if (isReserved && date !== 'N/A' && availability.endTime) {
                        try {
                            
                            const rawEndTime = availability.endTime.replace(/\.\d+/g, '').trim(); 
                            const dateTimeString = `${date} ${rawEndTime}`;
                            const availabilityEndDateTime = new Date(dateTimeString);
                            const currentDateTime = new Date();

                            canDelete = currentDateTime > availabilityEndDateTime;
                        } catch (e) {
                            console.error('Error parsing date/time:', e);
                            canDelete = false;
                        }
                    }
                    
                    return `
                    <tr>
                        <td>${date}</td>
                        <td>${startTime}</td>
                        <td>${endTime}</td>
                        <td>${totalDuration}</td>
                        <td>${stadiumName}</td>
                        <td>${arenaName}</td>
                        <td>${bookerName}</td>
                        <td><span class="badge ${availability.reserved ? 'status-booked' : ''}" ${!availability.reserved ? 'style="background-color: rgb(73, 136, 196); color: white;"' : ''}>${reserved}</span></td>
                        <td>${createdDate}</td>
                        <td>
                            ${!isReserved ? `
                                <button class="btn btn-sm btn-danger" onclick="deleteAvailability('${availabilityId}')" title="Delete Availability">
                                    <i class="bi bi-trash me-1"></i>Delete
                                </button>
                            ` : canDelete ? `
                                <button class="btn btn-sm btn-danger" onclick="deleteAvailability('${availabilityId}')" title="Delete Availability">
                                    <i class="bi bi-trash me-1"></i>Delete
                                </button>
                            ` : `
                                <button class="btn btn-sm btn-danger disabled" disabled title="Cannot delete reserved availability until end time has passed" style="opacity: 0.6; cursor: not-allowed;">
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
        loadAvailabilityTable(1, availabilityState.pageSize || 10, searchText, availabilityState.sortColumn || 'CreatedDate', availabilityState.sortDirection || 'DESC', availabilityState.reservationFilter);
    }
}

function handleAvailabilitySearchInput(event) {
    clearTimeout(availabilitySearchTimeout);
    availabilitySearchTimeout = setTimeout(() => {
        const searchInput = document.getElementById('availabilitySearch');
        const searchText = searchInput ? searchInput.value : '';
        loadAvailabilityTable(1, availabilityState.pageSize || 10, searchText, availabilityState.sortColumn || 'CreatedDate', availabilityState.sortDirection || 'DESC', availabilityState.reservationFilter);
    }, 500); 
}

function handleAvailabilitySort(sortColumn, sortDirection) {
    loadAvailabilityTable(1, availabilityState.pageSize || 10, availabilityState.searchText || '', sortColumn, sortDirection, availabilityState.reservationFilter);
}

function handleAvailabilityPageChange(pageNumber) {
    loadAvailabilityTable(pageNumber, availabilityState.pageSize || 10, availabilityState.searchText || '', availabilityState.sortColumn || 'CreatedDate', availabilityState.sortDirection || 'DESC', availabilityState.reservationFilter);
}

function handleAvailabilityPageSizeChange(pageSize) {
    loadAvailabilityTable(1, parseInt(pageSize), availabilityState.searchText || '', availabilityState.sortColumn || 'CreatedDate', availabilityState.sortDirection || 'DESC', availabilityState.reservationFilter);
}

function handleReservationFilter(isReserved) {
    
    const newFilter = isReserved;

    updateFilterButtonStyles(newFilter);

    loadAvailabilityTable(1, availabilityState.pageSize, availabilityState.searchText, availabilityState.sortColumn, availabilityState.sortDirection, newFilter);
}

function clearReservationFilter() {
    
    const newFilter = null;

    updateFilterButtonStyles(newFilter);

    loadAvailabilityTable(1, availabilityState.pageSize, availabilityState.searchText, availabilityState.sortColumn, availabilityState.sortDirection, newFilter);
}

function updateFilterButtonStyles(reservationFilter) {
    const reservedBtn = document.getElementById('filterReservedBtn');
    const freeBtn = document.getElementById('filterFreeBtn');
    const clearBtn = document.getElementById('clearFilterBtn');
    
    if (reservedBtn && freeBtn && clearBtn) {
        
        reservedBtn.style.opacity = '1';
        freeBtn.style.opacity = '1';
        
        if (reservationFilter === true) {
            reservedBtn.style.fontWeight = 'bold';
            freeBtn.style.fontWeight = 'normal';
            clearBtn.style.display = 'inline-block';
        } else if (reservationFilter === false) {
            freeBtn.style.fontWeight = 'bold';
            reservedBtn.style.fontWeight = 'normal';
            clearBtn.style.display = 'inline-block';
        } else {
            reservedBtn.style.fontWeight = 'normal';
            freeBtn.style.fontWeight = 'normal';
            clearBtn.style.display = 'none';
        }
    }
}

let pendingDeleteAvailabilityId = null; 

function showDeleteConfirmationModal(availabilityId) {
    pendingDeleteAvailabilityId = availabilityId;

    const modalElement = document.getElementById('confirmationModal');
    const modal = new bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: true,
        focus: true
    });
    modal.show();
}

async function executeDeleteAvailability() {
    if (!pendingDeleteAvailabilityId) {
        return;
    }

    const availabilityId = pendingDeleteAvailabilityId;

    const modalElement = document.getElementById('confirmationModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
        modal.hide();
    }

    try {
        await API.deleteArenaAvailability(availabilityId);
        showAlertModal('Availability deleted successfully!', 'success');
        await loadAvailabilityTable();
    } catch (error) {
        showAlertModal('Error deleting availability: ' + error.message, 'error');
    } finally {
        pendingDeleteAvailabilityId = null;
    }
}

async function deleteAvailability(availabilityId) {
    showDeleteConfirmationModal(availabilityId);
}

window.handleAvailabilitySearch = handleAvailabilitySearch;
window.handleAvailabilitySearchInput = handleAvailabilitySearchInput;
window.handleAvailabilitySort = handleAvailabilitySort;
window.handleAvailabilityPageChange = handleAvailabilityPageChange;
window.handleAvailabilityPageSizeChange = handleAvailabilityPageSizeChange;
window.handleReservationFilter = handleReservationFilter;
window.clearReservationFilter = clearReservationFilter;
window.deleteAvailability = deleteAvailability;
window.executeDeleteAvailability = executeDeleteAvailability;

