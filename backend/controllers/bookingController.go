package controllers

import (
	"BookMyArena/backend/middleware"
	"BookMyArena/backend/models"
	"BookMyArena/backend/services"
	"BookMyArena/backend/utils"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

func CreateBooking(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req models.CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	booking, err := services.CreateBooking(user.UserID, req)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(booking)
}

func GetBookings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var bookings interface{}

	if user.Role == "Owner" {
		ownerBookings, err := services.GetOwnerBookings(user.UserID)
		if err != nil {
			utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if ownerBookings == nil {
			ownerBookings = []models.BookingWithDetails{}
		}
		bookings = ownerBookings
	} else {
		userBookings, err := services.GetBookingsByUser(user.UserID)
		if err != nil {
			utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if userBookings == nil {
			userBookings = []models.BookingWithDetails{}
		}
		bookings = userBookings
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bookings)
}

func CancelBooking(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodDelete {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	vars := mux.Vars(r)
	bookingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid booking ID")
		return
	}

	err = services.CancelBooking(bookingID, user.UserID)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "booking cancelled successfully"})
}

func UpdateBookingStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil || user.Role != "Owner" {
		utils.RespondWithError(w, http.StatusForbidden, "owner access required")
		return
	}

	vars := mux.Vars(r)
	bookingID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid booking ID")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err = services.UpdateBookingStatus(bookingID, req.Status, user.UserID)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "booking status updated successfully"})
}
