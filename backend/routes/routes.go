package routes

import (
	"BookMyArena/backend/controllers"
	"BookMyArena/backend/middleware"
	"net/http"

	"github.com/gorilla/mux"
)

func SetupRoutes() *mux.Router {
	r := mux.NewRouter()

	// CORS middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if req.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	// Public routes
	r.HandleFunc("/api/signup", controllers.Signup).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/login", controllers.Login).Methods("POST", "OPTIONS")

	// Protected routes - require authentication
	api := r.PathPrefix("/api").Subrouter()
	api.Use(middleware.AuthMiddleware)

	// User routes
	api.HandleFunc("/logout", controllers.Logout).Methods("GET", "OPTIONS")
	api.HandleFunc("/user", controllers.GetCurrentUser).Methods("GET", "OPTIONS")

	// Stadium routes
	api.HandleFunc("/stadiums", controllers.CreateStadium).Methods("POST", "OPTIONS")
	api.HandleFunc("/stadiums", controllers.GetStadiums).Methods("GET", "OPTIONS")
	api.HandleFunc("/stadiums/{id}", controllers.GetStadium).Methods("GET", "OPTIONS")

	// Arena routes
	api.HandleFunc("/arenas", controllers.CreateArena).Methods("POST", "OPTIONS")
	api.HandleFunc("/arenas", controllers.GetAllArenas).Methods("GET", "OPTIONS")
	api.HandleFunc("/arenas/search", controllers.SearchArenas).Methods("GET", "OPTIONS")
	api.HandleFunc("/arenas/{id}", controllers.GetArena).Methods("GET", "OPTIONS")
	api.HandleFunc("/arenas/{id}", controllers.UpdateArena).Methods("PUT", "OPTIONS")
	api.HandleFunc("/arenas/{id}", controllers.DeleteArena).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/stadiums/{stadiumId}/arenas", controllers.GetArenasByStadium).Methods("GET", "OPTIONS")

	// Availability routes
	api.HandleFunc("/arenas/{id}/availability", controllers.CreateArenaAvailability).Methods("POST", "OPTIONS")
	api.HandleFunc("/arenas/{id}/availability", controllers.GetArenaAvailabilities).Methods("GET", "OPTIONS")
	api.HandleFunc("/availability", controllers.GetOwnerAvailabilities).Methods("GET", "OPTIONS")
	api.HandleFunc("/availability/{id}", controllers.DeleteArenaAvailability).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/availability/user", controllers.GetUserAvailabilities).Methods("GET", "OPTIONS")

	// Booking routes
	api.HandleFunc("/bookings", controllers.CreateBooking).Methods("POST", "OPTIONS")
	api.HandleFunc("/bookings", controllers.GetBookings).Methods("GET", "OPTIONS")
	api.HandleFunc("/bookings/{id}/cancel", controllers.CancelBooking).Methods("PUT", "DELETE", "OPTIONS")
	api.HandleFunc("/bookings/{id}/status", controllers.UpdateBookingStatus).Methods("PUT", "OPTIONS")

	// Booking Request routes
	api.HandleFunc("/booking-requests/details", controllers.GetBookingRequestDetails).Methods("GET", "OPTIONS")
	api.HandleFunc("/booking-requests", controllers.CreateBookingRequest).Methods("POST", "OPTIONS")
	api.HandleFunc("/booking-requests/user", controllers.GetUserBookingRequests).Methods("GET", "OPTIONS")
	api.HandleFunc("/booking-requests/owner", controllers.GetOwnerBookingRequests).Methods("GET", "OPTIONS")
	api.HandleFunc("/booking-requests/{id}", controllers.DeleteBookingRequest).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/booking-requests/{id}/status", controllers.UpdateBookingRequestStatus).Methods("PUT", "OPTIONS")

	// Payment routes
	api.HandleFunc("/payments/user", controllers.GetUserPayments).Methods("GET", "OPTIONS")
	api.HandleFunc("/payments/owner", controllers.GetOwnerPayments).Methods("GET", "OPTIONS")
	api.HandleFunc("/payments/{id}/process", controllers.ProcessPayment).Methods("PUT", "OPTIONS")

	// Serve static files (frontend)
	fileServer := http.FileServer(http.Dir("./frontend/"))
	r.PathPrefix("/frontend/").Handler(http.StripPrefix("/frontend/", fileServer))

	// Redirect root to login page
	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/frontend/pages/login.html", http.StatusSeeOther)
	})

	return r
}
