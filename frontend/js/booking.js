// Booking functionality for search page
let selectedArena = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Load all arenas on page load
    loadAllArenas();

    // Booking form handler
    document.getElementById('bookingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const arenaId = parseInt(document.getElementById('bookingArenaId').value);
        const startStr = document.getElementById('bookingStart').value;
        const endStr = document.getElementById('bookingEnd').value;

        const bookingData = {
            arenaId: arenaId,
            slotStart: new Date(startStr).toISOString(),
            slotEnd: new Date(endStr).toISOString(),
        };

        try {
            await API.createBooking(bookingData);
            alert('Booking created successfully!');
            closeBookingModal();
            loadAllArenas();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
});

async function loadAllArenas() {
    const container = document.getElementById('searchResults');
    container.innerHTML = '<p>Loading arenas...</p>';
    
    try {
        const arenas = await API.getAllArenas();
        console.log('Loaded arenas:', arenas);
        displaySearchResults(arenas);
    } catch (error) {
        console.error('Error loading arenas:', error);
        container.innerHTML = `<p class="error-message">Error loading arenas: ${error.message || 'Please try again.'}</p>`;
    }
}

// Make loadAllArenas globally accessible
window.loadAllArenas = loadAllArenas;
window.searchArenas = searchArenas;

async function searchArenas() {
    const location = document.getElementById('locationFilter').value;
    const sportType = document.getElementById('sportFilter').value;
    const date = document.getElementById('dateFilter').value;
    const container = document.getElementById('searchResults');
    
    try {
        // If no filters, load all arenas
        if (!location && !sportType && !date) {
            loadAllArenas();
            return;
        }

        container.innerHTML = '<p>Searching...</p>';
        const arenas = await API.searchArenas({ location, sportType, date });
        console.log('Search results:', arenas);
        displaySearchResults(arenas);
    } catch (error) {
        console.error('Error searching arenas:', error);
        container.innerHTML = `<p class="error-message">Error searching arenas: ${error.message || 'Please try again.'}</p>`;
    }
}

function displaySearchResults(arenas) {
    const container = document.getElementById('searchResults');
    
    // Check if arenas is an array
    if (!Array.isArray(arenas)) {
        console.error('Arenas is not an array:', arenas);
        container.innerHTML = '<p class="error-message">Error: Invalid data received from server.</p>';
        return;
    }
    
    if (arenas.length === 0) {
        container.innerHTML = '<p>No arenas found. Please check back later or contact an owner to add arenas.</p>';
        return;
    }

    container.innerHTML = arenas.map(arena => {
        // Format available hours (typically 8 AM to 10 PM)
        const availableHours = `8:00 AM - 10:00 PM`;
        const price = arena.price ? arena.price.toFixed(2) : '0.00';
        
        return `
        <div class="card">
            <h4>${arena.name || 'Unnamed Arena'}</h4>
            <p><strong>Stadium:</strong> ${arena.stadiumName || 'N/A'}</p>
            <p><strong>Location:</strong> ${arena.location || 'N/A'}</p>
            <p><strong>Sport:</strong> ${arena.sportType || 'N/A'}</p>
            <p><strong>Capacity:</strong> ${arena.capacity || 0} players</p>
            <p><strong>Slot Duration:</strong> ${arena.slotDuration || 0} minutes</p>
            <p><strong>Available Hours:</strong> ${availableHours}</p>
            <p><strong>Price:</strong> $${price} per slot</p>
            <button class="btn btn-primary" onclick="showBookingModal(${arena.arenaId})">Book Now</button>
        </div>
    `;
    }).join('');
}

async function showBookingModal(arenaId) {
    try {
        const arena = await API.getArena(arenaId);
        selectedArena = arena;

        document.getElementById('bookingArenaId').value = arenaId;
        document.getElementById('arenaDetails').innerHTML = `
            <h4>${arena.name}</h4>
            <p><strong>Sport:</strong> ${arena.sportType}</p>
            <p><strong>Price:</strong> $${arena.price} per slot</p>
        `;

        // Set default date to tomorrow if date filter is set
        const dateFilter = document.getElementById('dateFilter').value;
        const bookingDate = document.getElementById('bookingDate');
        if (dateFilter) {
            bookingDate.value = dateFilter;
        } else {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            bookingDate.value = tomorrow.toISOString().split('T')[0];
        }

        const modal = new bootstrap.Modal(document.getElementById('bookingModal'));
        modal.show();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function closeBookingModal() {
    document.getElementById('bookingModal').style.display = 'none';
    document.getElementById('bookingForm').reset();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('bookingModal');
    if (event.target == modal) {
        closeBookingModal();
    }
}

