package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"BookMyArena/backend/middleware"
	"BookMyArena/backend/models"
	"BookMyArena/backend/services"
	"BookMyArena/backend/utils"

	"github.com/gorilla/mux"
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

func GetUserBookingRequests(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	// Parse query parameters
	searchText := r.URL.Query().Get("searchText")
	sortColumn := r.URL.Query().Get("sortColumn")
	if sortColumn == "" {
		sortColumn = "CreatedDate"
	}
	sortDirection := r.URL.Query().Get("sortDirection")
	if sortDirection == "" {
		sortDirection = "DESC"
	}

	pageNumber := 1
	if pn := r.URL.Query().Get("pageNumber"); pn != "" {
		if pnInt, err := strconv.Atoi(pn); err == nil && pnInt > 0 {
			pageNumber = pnInt
		}
	}

	pageSize := 10
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		if psInt, err := strconv.Atoi(ps); err == nil && psInt > 0 && psInt <= 100 {
			pageSize = psInt
		}
	}

	params := models.BookingRequestSearchParams{
		UserID:        user.UserID,
		SearchText:    searchText,
		SortColumn:    sortColumn,
		SortDirection: sortDirection,
		PageNumber:    pageNumber,
		PageSize:      pageSize,
	}

	result, err := services.GetUserBookingRequestsPaginated(params)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func DeleteBookingRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	vars := mux.Vars(r)
	bookingRequestID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid booking request ID")
		return
	}

	err = services.DeleteBookingRequest(bookingRequestID, user.UserID, user.Role)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "booking request deleted successfully"})
}

func GetOwnerBookingRequests(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil || user.Role != "Owner" {
		utils.RespondWithError(w, http.StatusForbidden, "owner access required")
		return
	}

	// Parse query parameters
	searchText := r.URL.Query().Get("searchText")
	sortColumn := r.URL.Query().Get("sortColumn")
	if sortColumn == "" {
		sortColumn = "CreatedDate"
	}
	sortDirection := r.URL.Query().Get("sortDirection")
	if sortDirection == "" {
		sortDirection = "DESC"
	}

	pageNumber := 1
	if pn := r.URL.Query().Get("pageNumber"); pn != "" {
		if pnInt, err := strconv.Atoi(pn); err == nil && pnInt > 0 {
			pageNumber = pnInt
		}
	}

	pageSize := 10
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		if psInt, err := strconv.Atoi(ps); err == nil && psInt > 0 && psInt <= 100 {
			pageSize = psInt
		}
	}

	params := models.OwnerBookingRequestSearchParams{
		OwnerID:       user.UserID,
		SearchText:    searchText,
		SortColumn:    sortColumn,
		SortDirection: sortDirection,
		PageNumber:    pageNumber,
		PageSize:      pageSize,
	}

	result, err := services.GetOwnerBookingRequestsPaginated(params)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func UpdateBookingRequestStatus(w http.ResponseWriter, r *http.Request) {
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
	bookingRequestID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid booking request ID")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Status != "Booked" && req.Status != "Declined" {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid status. Must be 'Booked' or 'Declined'")
		return
	}

	err = services.UpdateBookingRequestStatus(bookingRequestID, user.UserID, req.Status)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "booking request status updated successfully"})
}
