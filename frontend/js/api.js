// API utility functions
const API = {
    baseURL: '', // Relative URL since frontend and backend are on same server

    async request(endpoint, options = {}) {
        const url = this.baseURL + endpoint;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies
        };

        // Add token from sessionStorage if available
        const token = sessionStorage.getItem('token');
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {}),
            },
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            if (error.message === 'Request failed') {
                throw error;
            }
            throw new Error('Network error: ' + error.message);
        }
    },

    // Auth endpoints
    async signup(userData) {
        return this.request('/api/signup', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    },

    async login(credentials) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    },

    async logout() {
        return this.request('/api/logout', {
            method: 'GET',
        });
    },

    async getCurrentUser() {
        return this.request('/api/user', {
            method: 'GET',
        });
    },

    // Stadium endpoints
    async createStadium(stadiumData) {
        return this.request('/api/stadiums', {
            method: 'POST',
            body: JSON.stringify(stadiumData),
        });
    },

    async getStadiums() {
        return this.request('/api/stadiums', {
            method: 'GET',
        });
    },

    async getStadium(id) {
        return this.request(`/api/stadiums/${id}`, {
            method: 'GET',
        });
    },

    // Arena endpoints
    async createArena(arenaData) {
        return this.request('/api/arenas', {
            method: 'POST',
            body: JSON.stringify(arenaData),
        });
    },

    async getAllArenas() {
        return this.request('/api/arenas', {
            method: 'GET',
        });
    },

    async getArena(id, date) {
        const params = date ? `?date=${date}` : '';
        return this.request(`/api/arenas/${id}${params}`, {
            method: 'GET',
        });
    },

    async getArenasByStadium(stadiumId, params = {}) {
        const queryParams = new URLSearchParams();
        if (params.searchText) queryParams.append('searchText', params.searchText);
        if (params.sortColumn) queryParams.append('sortColumn', params.sortColumn);
        if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
        if (params.pageNumber) queryParams.append('pageNumber', params.pageNumber);
        if (params.pageSize) queryParams.append('pageSize', params.pageSize);
        
        const queryString = queryParams.toString();
        const url = `/api/stadiums/${stadiumId}/arenas${queryString ? '?' + queryString : ''}`;
        return this.request(url, {
            method: 'GET',
        });
    },

    async getArena(arenaId) {
        return this.request(`/api/arenas/${arenaId}`, {
            method: 'GET',
        });
    },

    async updateArena(arenaId, arenaData) {
        return this.request(`/api/arenas/${arenaId}`, {
            method: 'PUT',
            body: JSON.stringify(arenaData),
        });
    },

    async deleteArena(arenaId) {
        return this.request(`/api/arenas/${arenaId}`, {
            method: 'DELETE',
        });
    },

    async searchArenas(filters) {
        const params = new URLSearchParams();
        if (filters.location) params.append('location', filters.location);
        if (filters.sportType) params.append('sportType', filters.sportType);
        if (filters.date) params.append('date', filters.date);

        return this.request(`/api/arenas/search?${params.toString()}`, {
            method: 'GET',
        });
    },

    // Booking endpoints
    async createBooking(bookingData) {
        return this.request('/api/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData),
        });
    },

    async getBookings() {
        return this.request('/api/bookings', {
            method: 'GET',
        });
    },

    async cancelBooking(id) {
        return this.request(`/api/bookings/${id}/cancel`, {
            method: 'PUT',
        });
    },

    async updateBookingStatus(bookingId, status) {
        return this.request(`/api/bookings/${bookingId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
    },

    async updateBookingStatus(id, status) {
        return this.request(`/api/bookings/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
    },

    // Availability endpoints
    async createArenaAvailability(arenaId, availabilityData) {
        return this.request(`/api/arenas/${arenaId}/availability`, {
            method: 'POST',
            body: JSON.stringify(availabilityData),
        });
    },

    async getArenaAvailabilities(arenaId) {
        return this.request(`/api/arenas/${arenaId}/availability`, {
            method: 'GET',
        });
    },

    async deleteArenaAvailability(availabilityId) {
        return this.request(`/api/availability/${availabilityId}`, {
            method: 'DELETE',
        });
    },

    async getOwnerAvailabilities(params) {
        const queryParams = new URLSearchParams();
        if (params.searchText) queryParams.append('searchText', params.searchText);
        if (params.sortColumn) queryParams.append('sortColumn', params.sortColumn);
        if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
        if (params.pageNumber) queryParams.append('pageNumber', params.pageNumber);
        if (params.pageSize) queryParams.append('pageSize', params.pageSize);

        return this.request(`/api/availability?${queryParams.toString()}`, {
            method: 'GET',
        });
    },

    async getUserAvailabilities(params) {
        const queryParams = new URLSearchParams();
        if (params.searchText) queryParams.append('searchText', params.searchText);
        if (params.sortColumn) queryParams.append('sortColumn', params.sortColumn);
        if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
        if (params.pageNumber) queryParams.append('pageNumber', params.pageNumber);
        if (params.pageSize) queryParams.append('pageSize', params.pageSize);

        return this.request(`/api/availability/user?${queryParams.toString()}`, {
            method: 'GET',
        });
    },

    async getBookingRequestDetails(availabilityId) {
        return this.request(`/api/booking-requests/details?availabilityId=${availabilityId}`, {
            method: 'GET',
        });
    },

    async createBookingRequest(availabilityId) {
        return this.request('/api/booking-requests', {
            method: 'POST',
            body: JSON.stringify({ availabilityId: availabilityId }),
        });
    },

    async getUserBookingRequests(params) {
        const queryParams = new URLSearchParams();
        if (params.searchText) queryParams.append('searchText', params.searchText);
        if (params.sortColumn) queryParams.append('sortColumn', params.sortColumn);
        if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
        if (params.pageNumber) queryParams.append('pageNumber', params.pageNumber);
        if (params.pageSize) queryParams.append('pageSize', params.pageSize);

        return this.request(`/api/booking-requests/user?${queryParams.toString()}`, {
            method: 'GET',
        });
    },

    async getOwnerBookingRequests(params) {
        const queryParams = new URLSearchParams();
        if (params.searchText) queryParams.append('searchText', params.searchText);
        if (params.sortColumn) queryParams.append('sortColumn', params.sortColumn);
        if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
        if (params.pageNumber) queryParams.append('pageNumber', params.pageNumber);
        if (params.pageSize) queryParams.append('pageSize', params.pageSize);

        return this.request(`/api/booking-requests/owner?${queryParams.toString()}`, {
            method: 'GET',
        });
    },

    async deleteBookingRequest(bookingRequestId) {
        return this.request(`/api/booking-requests/${bookingRequestId}`, {
            method: 'DELETE',
        });
    },

    async updateBookingRequestStatus(bookingRequestId, status) {
        return this.request(`/api/booking-requests/${bookingRequestId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: status }),
        });
    },
};

