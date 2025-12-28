// Booking functionality for search page
let selectedArena = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Search on page load
    searchArenas();

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
            searchArenas();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
});

async function searchArenas() {
    const location = document.getElementById('locationFilter').value;
    const sportType = document.getElementById('sportFilter').value;
    const date = document.getElementById('dateFilter').value;

    try {
        const arenas = await API.searchArenas({ location, sportType, date });
        displaySearchResults(arenas);
    } catch (error) {
        console.error('Error searching arenas:', error);
        document.getElementById('searchResults').innerHTML = '<p>Error searching arenas. Please try again.</p>';
    }
}

function displaySearchResults(arenas) {
    const container = document.getElementById('searchResults');
    if (arenas.length === 0) {
        container.innerHTML = '<p>No arenas found. Try different search criteria.</p>';
        return;
    }

    container.innerHTML = arenas.map(arena => `
        <div class="card">
            <h4>${arena.name}</h4>
            <p><strong>Sport:</strong> ${arena.sportType}</p>
            <p><strong>Capacity:</strong> ${arena.capacity}</p>
            <p><strong>Slot Duration:</strong> ${arena.slotDuration} minutes</p>
            <p><strong>Price:</strong> $${arena.price}</p>
            <button class="btn btn-primary" onclick="showBookingModal(${arena.arenaId})">Book Now</button>
        </div>
    `).join('');
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

        document.getElementById('bookingModal').style.display = 'block';
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

