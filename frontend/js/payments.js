// Payment functionality for User and Owner roles
let userRole = 'User'; // Will be set on initialization
let paidState = {
    pageNumber: 1,
    pageSize: 10,
    searchText: '',
    sortColumn: 'Date',
    sortDirection: 'DESC',
    startDate: null,
    endDate: null,
    totalCount: 0,
    totalPages: 0
};

let payableState = {
    pageNumber: 1,
    pageSize: 10,
    searchText: '',
    sortColumn: 'Date',
    sortDirection: 'DESC',
    startDate: null,
    endDate: null,
    totalCount: 0,
    totalPages: 0
};

let paidSearchTimeout = null;
let payableSearchTimeout = null;
let currentPaymentId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'login.html';
        return;
    }

    // Detect user role
    try {
        const user = JSON.parse(userStr);
        userRole = user.role || 'User';
        
        // Update UI labels based on role
        if (userRole === 'Owner') {
            // Update tab labels
            const paidTab = document.getElementById('paid-tab');
            const payableTab = document.getElementById('payable-tab');
            if (paidTab) paidTab.textContent = 'Received';
            if (payableTab) payableTab.textContent = 'Pending';
            
            // Update total labels - find the parent strong elements and update their first text node
            const paidPaneStrong = document.querySelector('#paid-pane .card-body strong.text-primary');
            const payablePaneStrong = document.querySelector('#payable-pane .card-body strong.text-primary');
            if (paidPaneStrong) {
                // Keep the span but update the text before it
                const span = paidPaneStrong.querySelector('span#totalPaid');
                if (span) {
                    paidPaneStrong.innerHTML = 'Total Received: $<span id="totalPaid">0.00</span>';
                }
            }
            if (payablePaneStrong) {
                const span = payablePaneStrong.querySelector('span#totalPayable');
                if (span) {
                    payablePaneStrong.innerHTML = 'Total Pending: $<span id="totalPayable">0.00</span>';
                }
            }
            
            // Update search placeholders to include booker info
            const paidSearch = document.getElementById('paidSearch');
            const payableSearch = document.getElementById('payableSearch');
            if (paidSearch) paidSearch.placeholder = 'Search by Date, Time, Stadium, Arena, Booker Name, Booker Email...';
            if (payableSearch) payableSearch.placeholder = 'Search by Date, Time, Stadium, Arena, Booker Name, Booker Email...';
        }
    } catch (error) {
        console.error('Error parsing user data:', error);
    }

    // Set default date filter to current month
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const dateFilterStart = document.getElementById('dateFilterStart');
    if (dateFilterStart) {
        dateFilterStart.value = currentMonth;
    }
    
    // Initialize placeholder visibility
    toggleMonthPlaceholder();
    
    // Set date range for current month
    paidState.startDate = currentMonth + '-01';
    payableState.startDate = currentMonth + '-01';
    const startDate = new Date(currentMonth + '-01');
    startDate.setMonth(startDate.getMonth() + 1);
    startDate.setDate(0);
    const lastDay = String(startDate.getDate()).padStart(2, '0');
    paidState.endDate = currentMonth + '-' + lastDay;
    payableState.endDate = currentMonth + '-' + lastDay;

    // Load initial data
    try {
        await loadPaidPayments();
        await loadPayablePayments();
    } catch (error) {
        console.error('Error loading payments data:', error);
        const paidTable = document.getElementById('paidTable');
        const payableTable = document.getElementById('payableTable');
        if (paidTable) {
            paidTable.innerHTML = '<p class="error-message">Unable to load paid payments. The payment API endpoint may not be implemented yet.</p>';
        }
        if (payableTable) {
            payableTable.innerHTML = '<p class="error-message">Unable to load payable payments. The payment API endpoint may not be implemented yet.</p>';
        }
    }
});

// Format time string to remove milliseconds (15:32:00.0000000 -> 15:32:00)
function formatTime(timeStr) {
    if (!timeStr || timeStr === 'N/A') return timeStr;
    return timeStr.replace(/\.\d+/g, '').trim();
}

// Format date string to day/Mon/YYYY format (e.g., 12/Jan/2026)
function formatDate(dateStr) {
    if (!dateStr || dateStr === 'N/A') return dateStr;
    
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr; // Invalid date
        
        const day = date.getDate();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day}-${month}-${year}`;
    } catch (error) {
        return dateStr; // Return original if parsing fails
    }
}

// Date filter handlers
function handleDateFilterChange() {
    const startMonth = document.getElementById('dateFilterStart').value;
    const endMonth = document.getElementById('dateFilterEnd').value;
    
    if (startMonth) {
        paidState.startDate = startMonth + '-01';
        payableState.startDate = startMonth + '-01';
        
        if (endMonth) {
            const endDate = new Date(endMonth + '-01');
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
            const lastDay = String(endDate.getDate()).padStart(2, '0');
            paidState.endDate = endMonth + '-' + lastDay;
            payableState.endDate = endMonth + '-' + lastDay;
        } else {
            const startDate = new Date(startMonth + '-01');
            startDate.setMonth(startDate.getMonth() + 1);
            startDate.setDate(0);
            const lastDay = String(startDate.getDate()).padStart(2, '0');
            paidState.endDate = startMonth + '-' + lastDay;
            payableState.endDate = startMonth + '-' + lastDay;
        }
        
        loadPaidPayments(1);
        loadPayablePayments(1);
    }
}

function resetDateFilter() {
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('dateFilterStart').value = currentMonth;
    document.getElementById('dateFilterEnd').value = '';
    toggleMonthPlaceholder();
    
    paidState.startDate = currentMonth + '-01';
    payableState.startDate = currentMonth + '-01';
    const startDate = new Date(currentMonth + '-01');
    startDate.setMonth(startDate.getMonth() + 1);
    startDate.setDate(0);
    const lastDay = String(startDate.getDate()).padStart(2, '0');
    paidState.endDate = currentMonth + '-' + lastDay;
    payableState.endDate = currentMonth + '-' + lastDay;
    
    loadPaidPayments(1);
    loadPayablePayments(1);
}

function toggleMonthPlaceholder() {
    const input = document.getElementById('dateFilterEnd');
    const placeholder = document.getElementById('monthPlaceholder');
    if (input && placeholder) {
        placeholder.style.display = input.value ? 'none' : 'block';
    }
}

// Tab switching
function switchToPaidTab() {}
function switchToPayableTab() {}

// Paid Payments Functions
async function loadPaidPayments(pageNumber = paidState.pageNumber, pageSize = paidState.pageSize, searchText = paidState.searchText, sortColumn = paidState.sortColumn, sortDirection = paidState.sortDirection) {
    const tableContainer = document.getElementById('paidTable');
    const paginationContainer = document.getElementById('paidPagination');
    
    if (!tableContainer) return;

    tableContainer.innerHTML = '<p>Loading payments...</p>';

    try {
        const result = userRole === 'Owner' 
            ? await API.getOwnerPayments({
                isPaid: true,
                startDate: paidState.startDate,
                endDate: paidState.endDate,
                searchText: searchText,
                sortColumn: sortColumn,
                sortDirection: sortDirection,
                pageNumber: pageNumber,
                pageSize: pageSize
            })
            : await API.getUserPayments({
                isPaid: true,
                startDate: paidState.startDate,
                endDate: paidState.endDate,
                searchText: searchText,
                sortColumn: sortColumn,
                sortDirection: sortDirection,
                pageNumber: pageNumber,
                pageSize: pageSize
            });

        paidState.pageNumber = pageNumber;
        paidState.pageSize = pageSize;
        paidState.searchText = searchText;
        paidState.sortColumn = sortColumn;
        paidState.sortDirection = sortDirection;
        paidState.totalCount = result.totalCount || 0;
        paidState.totalPages = result.totalPages || 0;

        displayPaidPayments(result);
        updatePaidTotal(result);
    } catch (error) {
        console.error('Error loading paid payments:', error);
        tableContainer.innerHTML = `<p class="error-message">Error loading paid payments: ${error.message}</p>`;
    }
}

function displayPaidPayments(result) {
    const tableContainer = document.getElementById('paidTable');
    const paginationContainer = document.getElementById('paidPagination');
    
    if (!tableContainer) return;

    if (!result || !result.payments || result.payments.length === 0) {
        tableContainer.innerHTML = '<p>No paid payments found.</p>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const { sortColumn, sortDirection } = paidState;

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
        return `handlePaidSort('${col}', '${newDirection}')`;
    };

    // Build table headers based on role
    let tableHeaders = `
        <th class="sortable-header" onclick="${getSortHandler('StadiumName')}">Stadium ${getSortIcon('StadiumName')}</th>
        <th class="sortable-header" onclick="${getSortHandler('ArenaName')}">Arena ${getSortIcon('ArenaName')}</th>
        <th class="sortable-header" onclick="${getSortHandler('Date')}">Date ${getSortIcon('Date')}</th>
        <th class="sortable-header" onclick="${getSortHandler('StartTime')}">Start Time ${getSortIcon('StartTime')}</th>
        <th class="sortable-header" onclick="${getSortHandler('EndTime')}">End Time ${getSortIcon('EndTime')}</th>
        <th>Total Duration (Minutes)</th>
        <th>IsPaid</th>
        <th class="sortable-header" onclick="${getSortHandler('Price')}">Price ${getSortIcon('Price')}</th>
    `;
    
    if (userRole === 'Owner') {
        tableHeaders += `
        <th class="sortable-header" onclick="${getSortHandler('BookerName')}">Booker Name ${getSortIcon('BookerName')}</th>
        <th class="sortable-header" onclick="${getSortHandler('BookerEmail')}">Booker Email ${getSortIcon('BookerEmail')}</th>
        `;
    }

    const table = `
        <table class="table data-table">
            <thead>
                <tr>
                    ${tableHeaders}
                </tr>
            </thead>
            <tbody>
                ${result.payments.map(payment => {
                    const stadiumName = payment.stadiumName || 'N/A';
                    const arenaName = payment.arenaName || 'N/A';
                    const date = formatDate(payment.date || 'N/A');
                    const startTime = formatTime(payment.startTime || 'N/A');
                    const endTime = formatTime(payment.endTime || 'N/A');
                    const totalDuration = payment.totalDuration || 0;
                    const price = payment.price ? payment.price.toFixed(2) : '0.00';
                    
                    let rowCells = `
                        <td>${stadiumName}</td>
                        <td>${arenaName}</td>
                        <td>${date}</td>
                        <td>${startTime}</td>
                        <td>${endTime}</td>
                        <td>${totalDuration}</td>
                        <td><span class="badge status-booked">Yes</span></td>
                        <td>$${price}</td>
                    `;
                    
                    if (userRole === 'Owner') {
                        const bookerName = payment.bookerName || 'N/A';
                        const bookerEmail = payment.bookerEmail || 'N/A';
                        rowCells += `
                        <td>${bookerName}</td>
                        <td>${bookerEmail}</td>
                        `;
                    }
                    
                    return `<tr>${rowCells}</tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
    tableContainer.innerHTML = table;

    // Display pagination
    if (paginationContainer && result.totalPages > 0) {
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                Showing ${((paidState.pageNumber - 1) * paidState.pageSize) + 1} to ${Math.min(paidState.pageNumber * paidState.pageSize, paidState.totalCount)} of ${paidState.totalCount} records
                <select class="page-size-select" onchange="handlePaidPageSizeChange(this.value)">
                    <option value="10" ${paidState.pageSize === 10 ? 'selected' : ''}>10 per page</option>
                    <option value="25" ${paidState.pageSize === 25 ? 'selected' : ''}>25 per page</option>
                    <option value="50" ${paidState.pageSize === 50 ? 'selected' : ''}>50 per page</option>
                    <option value="100" ${paidState.pageSize === 100 ? 'selected' : ''}>100 per page</option>
                </select>
            </div>
            <div class="pagination-controls">
                <button onclick="handlePaidPageChange(1)" ${paidState.pageNumber === 1 ? 'disabled' : ''}>First</button>
                <button onclick="handlePaidPageChange(${paidState.pageNumber - 1})" ${paidState.pageNumber === 1 ? 'disabled' : ''}>Previous</button>
                <span class="pagination-page-info">Page ${paidState.pageNumber} of ${paidState.totalPages}</span>
                <button onclick="handlePaidPageChange(${paidState.pageNumber + 1})" ${paidState.pageNumber >= paidState.totalPages ? 'disabled' : ''}>Next</button>
                <button onclick="handlePaidPageChange(${paidState.totalPages})" ${paidState.pageNumber >= paidState.totalPages ? 'disabled' : ''}>Last</button>
            </div>
        `;
    } else if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }
}

function updatePaidTotal(result) {
    const totalPaidEl = document.getElementById('totalPaid');
    if (totalPaidEl) {
        if (userRole === 'Owner') {
            if (result.totalReceived !== undefined) {
                totalPaidEl.textContent = result.totalReceived.toFixed(2);
            } else if (result.payments) {
                const total = result.payments.reduce((sum, payment) => sum + (payment.price || 0), 0);
                totalPaidEl.textContent = total.toFixed(2);
            }
        } else {
            if (result.totalPaid !== undefined) {
                totalPaidEl.textContent = result.totalPaid.toFixed(2);
            } else if (result.payments) {
                const total = result.payments.reduce((sum, payment) => sum + (payment.price || 0), 0);
                totalPaidEl.textContent = total.toFixed(2);
            }
        }
    }
}

function handlePaidSort(column, direction) {
    loadPaidPayments(1, paidState.pageSize, paidState.searchText, column, direction);
}

function handlePaidPageChange(pageNumber) {
    if (pageNumber < 1 || pageNumber > paidState.totalPages) return;
    loadPaidPayments(pageNumber);
}

function handlePaidPageSizeChange(pageSize) {
    loadPaidPayments(1, parseInt(pageSize));
}

function handlePaidSearch(event) {
    if (event.key === 'Enter') {
        const searchText = event.target.value;
        paidState.searchText = searchText;
        loadPaidPayments(1);
    }
}

function handlePaidSearchInput(event) {
    clearTimeout(paidSearchTimeout);
    paidSearchTimeout = setTimeout(() => {
        const searchText = event.target.value;
        paidState.searchText = searchText;
        loadPaidPayments(1);
    }, 500);
}

// Payable Payments Functions
async function loadPayablePayments(pageNumber = payableState.pageNumber, pageSize = payableState.pageSize, searchText = payableState.searchText, sortColumn = payableState.sortColumn, sortDirection = payableState.sortDirection) {
    const tableContainer = document.getElementById('payableTable');
    const paginationContainer = document.getElementById('payablePagination');
    
    if (!tableContainer) return;

    tableContainer.innerHTML = '<p>Loading payments...</p>';

    try {
        const result = userRole === 'Owner'
            ? await API.getOwnerPayments({
                isPaid: false,
                startDate: payableState.startDate,
                endDate: payableState.endDate,
                searchText: searchText,
                sortColumn: sortColumn,
                sortDirection: sortDirection,
                pageNumber: pageNumber,
                pageSize: pageSize
            })
            : await API.getUserPayments({
                isPaid: false,
                startDate: payableState.startDate,
                endDate: payableState.endDate,
                searchText: searchText,
                sortColumn: sortColumn,
                sortDirection: sortDirection,
                pageNumber: pageNumber,
                pageSize: pageSize
            });

        payableState.pageNumber = pageNumber;
        payableState.pageSize = pageSize;
        payableState.searchText = searchText;
        payableState.sortColumn = sortColumn;
        payableState.sortDirection = sortDirection;
        payableState.totalCount = result.totalCount || 0;
        payableState.totalPages = result.totalPages || 0;

        displayPayablePayments(result);
        updatePayableTotal(result);
    } catch (error) {
        console.error('Error loading payable payments:', error);
        tableContainer.innerHTML = `<p class="error-message">Error loading payable payments: ${error.message}</p>`;
    }
}

function displayPayablePayments(result) {
    const tableContainer = document.getElementById('payableTable');
    const paginationContainer = document.getElementById('payablePagination');
    
    if (!tableContainer) return;

    if (!result || !result.payments || result.payments.length === 0) {
        tableContainer.innerHTML = '<p>No payable payments found.</p>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const { sortColumn, sortDirection } = payableState;

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
        return `handlePayableSort('${col}', '${newDirection}')`;
    };

    // Build table headers based on role
    let tableHeaders = `
        <th class="sortable-header" onclick="${getSortHandler('StadiumName')}">Stadium ${getSortIcon('StadiumName')}</th>
        <th class="sortable-header" onclick="${getSortHandler('ArenaName')}">Arena ${getSortIcon('ArenaName')}</th>
        <th class="sortable-header" onclick="${getSortHandler('Date')}">Date ${getSortIcon('Date')}</th>
        <th class="sortable-header" onclick="${getSortHandler('StartTime')}">Start Time ${getSortIcon('StartTime')}</th>
        <th class="sortable-header" onclick="${getSortHandler('EndTime')}">End Time ${getSortIcon('EndTime')}</th>
        <th>Total Duration (Minutes)</th>
        <th>IsPaid</th>
        <th class="sortable-header" onclick="${getSortHandler('Price')}">Price ${getSortIcon('Price')}</th>
    `;
    
    if (userRole === 'Owner') {
        tableHeaders += `
        <th class="sortable-header" onclick="${getSortHandler('BookerName')}">Booker Name ${getSortIcon('BookerName')}</th>
        <th class="sortable-header" onclick="${getSortHandler('BookerEmail')}">Booker Email ${getSortIcon('BookerEmail')}</th>
        `;
    } else {
        tableHeaders += `<th>Actions</th>`;
    }

    const table = `
        <table class="table data-table">
            <thead>
                <tr>
                    ${tableHeaders}
                </tr>
            </thead>
            <tbody>
                ${result.payments.map(payment => {
                    const stadiumName = payment.stadiumName || 'N/A';
                    const arenaName = payment.arenaName || 'N/A';
                    const date = formatDate(payment.date || 'N/A');
                    const startTime = formatTime(payment.startTime || 'N/A');
                    const endTime = formatTime(payment.endTime || 'N/A');
                    const totalDuration = payment.totalDuration || 0;
                    const price = payment.price ? payment.price.toFixed(2) : '0.00';
                    const paymentId = payment.paymentId || 0;
                    
                    let rowCells = `
                        <td>${stadiumName}</td>
                        <td>${arenaName}</td>
                        <td>${date}</td>
                        <td>${startTime}</td>
                        <td>${endTime}</td>
                        <td>${totalDuration}</td>
                        <td><span class="badge status-pending">No</span></td>
                        <td>$${price}</td>
                    `;
                    
                    if (userRole === 'Owner') {
                        const bookerName = payment.bookerName || 'N/A';
                        const bookerEmail = payment.bookerEmail || 'N/A';
                        rowCells += `
                        <td>${bookerName}</td>
                        <td>${bookerEmail}</td>
                        `;
                    } else {
                        rowCells += `
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="showPaymentConfirmation(${paymentId}, '${stadiumName.replace(/'/g, "\\'")}', '${arenaName.replace(/'/g, "\\'")}', '${date}', '${startTime.replace(/'/g, "\\'")}', '${endTime.replace(/'/g, "\\'")}', ${totalDuration}, ${price})">
                                Pay Now
                            </button>
                        </td>
                        `;
                    }
                    
                    return `<tr>${rowCells}</tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
    tableContainer.innerHTML = table;

    // Display pagination
    if (paginationContainer && result.totalPages > 0) {
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                Showing ${((payableState.pageNumber - 1) * payableState.pageSize) + 1} to ${Math.min(payableState.pageNumber * payableState.pageSize, payableState.totalCount)} of ${payableState.totalCount} records
                <select class="page-size-select" onchange="handlePayablePageSizeChange(this.value)">
                    <option value="10" ${payableState.pageSize === 10 ? 'selected' : ''}>10 per page</option>
                    <option value="25" ${payableState.pageSize === 25 ? 'selected' : ''}>25 per page</option>
                    <option value="50" ${payableState.pageSize === 50 ? 'selected' : ''}>50 per page</option>
                    <option value="100" ${payableState.pageSize === 100 ? 'selected' : ''}>100 per page</option>
                </select>
            </div>
            <div class="pagination-controls">
                <button onclick="handlePayablePageChange(1)" ${payableState.pageNumber === 1 ? 'disabled' : ''}>First</button>
                <button onclick="handlePayablePageChange(${payableState.pageNumber - 1})" ${payableState.pageNumber === 1 ? 'disabled' : ''}>Previous</button>
                <span class="pagination-page-info">Page ${payableState.pageNumber} of ${payableState.totalPages}</span>
                <button onclick="handlePayablePageChange(${payableState.pageNumber + 1})" ${payableState.pageNumber >= payableState.totalPages ? 'disabled' : ''}>Next</button>
                <button onclick="handlePayablePageChange(${payableState.totalPages})" ${payableState.pageNumber >= payableState.totalPages ? 'disabled' : ''}>Last</button>
            </div>
        `;
    } else if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }
}

function updatePayableTotal(result) {
    const totalPayableEl = document.getElementById('totalPayable');
    if (totalPayableEl) {
        if (userRole === 'Owner') {
            if (result.totalPending !== undefined) {
                totalPayableEl.textContent = result.totalPending.toFixed(2);
            } else if (result.payments) {
                const total = result.payments.reduce((sum, payment) => sum + (payment.price || 0), 0);
                totalPayableEl.textContent = total.toFixed(2);
            }
        } else {
            if (result.totalPayable !== undefined) {
                totalPayableEl.textContent = result.totalPayable.toFixed(2);
            } else if (result.payments) {
                const total = result.payments.reduce((sum, payment) => sum + (payment.price || 0), 0);
                totalPayableEl.textContent = total.toFixed(2);
            }
        }
    }
}

function handlePayableSort(column, direction) {
    loadPayablePayments(1, payableState.pageSize, payableState.searchText, column, direction);
}

function handlePayablePageChange(pageNumber) {
    if (pageNumber < 1 || pageNumber > payableState.totalPages) return;
    loadPayablePayments(pageNumber);
}

function handlePayablePageSizeChange(pageSize) {
    loadPayablePayments(1, parseInt(pageSize));
}

function handlePayableSearch(event) {
    if (event.key === 'Enter') {
        const searchText = event.target.value;
        payableState.searchText = searchText;
        loadPayablePayments(1);
    }
}

function handlePayableSearchInput(event) {
    clearTimeout(payableSearchTimeout);
    payableSearchTimeout = setTimeout(() => {
        const searchText = event.target.value;
        payableState.searchText = searchText;
        loadPayablePayments(1);
    }, 500);
}

// Payment Confirmation Modal
function showPaymentConfirmation(paymentId, stadiumName, arenaName, date, startTime, endTime, totalDuration, price) {
    currentPaymentId = paymentId;
    const modalBody = document.getElementById('paymentConfirmationBody');
    
    modalBody.innerHTML = `
        <div class="payment-summary">
            <h6>Payment Summary</h6>
            <table class="table table-bordered">
                <tr>
                    <td><strong>Stadium:</strong></td>
                    <td>${stadiumName}</td>
                </tr>
                <tr>
                    <td><strong>Arena:</strong></td>
                    <td>${arenaName}</td>
                </tr>
                <tr>
                    <td><strong>Date:</strong></td>
                    <td>${date}</td>
                </tr>
                <tr>
                    <td><strong>Start Time:</strong></td>
                    <td>${formatTime(startTime)}</td>
                </tr>
                <tr>
                    <td><strong>End Time:</strong></td>
                    <td>${formatTime(endTime)}</td>
                </tr>
                <tr>
                    <td><strong>Total Duration:</strong></td>
                    <td>${totalDuration} minutes</td>
                </tr>
                <tr>
                    <td><strong>Amount to Pay:</strong></td>
                    <td><strong class="text-primary">$${parseFloat(price).toFixed(2)}</strong></td>
                </tr>
            </table>
        </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('paymentConfirmationModal'));
    modal.show();
}

async function confirmPayment() {
    if (!currentPaymentId) {
        showAlertModal('Payment ID is missing', 'warning');
        return;
    }

    const confirmBtn = document.getElementById('confirmPaymentBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    try {
        await API.processPayment(currentPaymentId);
        
        // Close modal
        const modalElement = document.getElementById('paymentConfirmationModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
        
        // Reload both tabs to reflect the payment
        await loadPayablePayments();
        await loadPaidPayments();
        
        showAlertModal('Payment processed successfully!', 'success');
    } catch (error) {
        console.error('Error processing payment:', error);
        showAlertModal('Error processing payment: ' + error.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Payment';
    } finally {
        currentPaymentId = null;
    }
}

// Make functions globally accessible
window.handleDateFilterChange = handleDateFilterChange;
window.resetDateFilter = resetDateFilter;
window.switchToPaidTab = switchToPaidTab;
window.switchToPayableTab = switchToPayableTab;
window.handlePaidSort = handlePaidSort;
window.handlePaidPageChange = handlePaidPageChange;
window.handlePaidPageSizeChange = handlePaidPageSizeChange;
window.handlePaidSearch = handlePaidSearch;
window.handlePaidSearchInput = handlePaidSearchInput;
window.handlePayableSort = handlePayableSort;
window.handlePayablePageChange = handlePayablePageChange;
window.handlePayablePageSizeChange = handlePayablePageSizeChange;
window.handlePayableSearch = handlePayableSearch;
window.handlePayableSearchInput = handlePayableSearchInput;
window.showPaymentConfirmation = showPaymentConfirmation;
window.confirmPayment = confirmPayment;
window.toggleMonthPlaceholder = toggleMonthPlaceholder;