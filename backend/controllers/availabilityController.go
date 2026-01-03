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

func CreateArenaAvailability(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil || user.Role != "Owner" {
		utils.RespondWithError(w, http.StatusForbidden, "only owners can create availability")
		return
	}

	var req models.CreateAvailabilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := services.CreateArenaAvailabilities(req, user.UserID); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "availability created successfully"})
}

func GetArenaAvailabilities(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	arenaIdStr := vars["id"]
	arenaId, err := strconv.Atoi(arenaIdStr)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid arena id")
		return
	}

	availabilities, err := services.GetArenaAvailabilities(arenaId)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(availabilities)
}

func GetOwnerAvailabilities(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil || user.Role != "Owner" {
		utils.RespondWithError(w, http.StatusForbidden, "only owners can view availabilities")
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

	params := models.AvailabilitySearchParams{
		OwnerId:       user.UserID,
		SearchText:    searchText,
		SortColumn:    sortColumn,
		SortDirection: sortDirection,
		PageNumber:    pageNumber,
		PageSize:      pageSize,
	}

	result, err := services.GetOwnerAvailabilitiesPaginated(params)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func DeleteArenaAvailability(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil || user.Role != "Owner" {
		utils.RespondWithError(w, http.StatusForbidden, "only owners can delete availability")
		return
	}

	vars := mux.Vars(r)
	availabilityId := vars["id"]

	if err := services.DeleteArenaAvailability(availabilityId, user.UserID); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "availability deleted successfully"})
}

func GetUserAvailabilities(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
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

	params := models.UserAvailabilitySearchParams{
		SearchText:    searchText,
		SortColumn:    sortColumn,
		SortDirection: sortDirection,
		PageNumber:    pageNumber,
		PageSize:      pageSize,
	}

	result, err := services.GetUserAvailabilitiesPaginated(params)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
