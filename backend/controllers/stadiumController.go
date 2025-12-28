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

func CreateStadium(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req models.CreateStadiumRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.Location == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "name and location are required")
		return
	}

	stadium, err := services.CreateStadium(user.UserID, req)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(stadium)
}

func GetStadiums(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var stadiums []models.Stadium
	var err error

	// If user is owner, return only their stadiums; otherwise return all
	if user.Role == "Owner" {
		stadiums, err = services.GetStadiumsByOwner(user.UserID)
	} else {
		stadiums, err = services.GetAllStadiums()
	}

	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stadiums)
}

func GetStadium(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	vars := mux.Vars(r)
	stadiumID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid stadium ID")
		return
	}

	stadium, err := services.GetStadiumByID(stadiumID)
	if err != nil {
		utils.RespondWithError(w, http.StatusNotFound, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stadium)
}

