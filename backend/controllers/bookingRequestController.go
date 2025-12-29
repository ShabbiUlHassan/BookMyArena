package controllers

import (
	"encoding/json"
	"net/http"

	"BookMyArena/backend/middleware"
	"BookMyArena/backend/models"
	"BookMyArena/backend/services"
	"BookMyArena/backend/utils"
)

func GetBookingRequestDetails(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	availabilityId := r.URL.Query().Get("availabilityId")
	if availabilityId == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "availabilityId is required")
		return
	}

	details, err := services.GetBookingRequestDetails(availabilityId)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(details)
}

func CreateBookingRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req models.CreateBookingRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.AvailabilityId == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "availabilityId is required")
		return
	}

	bookingRequest, err := services.CreateBookingRequest(user.UserID, req)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(bookingRequest)
}
