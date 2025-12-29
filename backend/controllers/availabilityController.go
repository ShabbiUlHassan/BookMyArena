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
