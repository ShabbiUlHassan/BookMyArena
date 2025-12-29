package controllers

import (
	"BookMyArena/backend/middleware"
	"BookMyArena/backend/models"
	"BookMyArena/backend/services"
	"BookMyArena/backend/utils"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

func CreateArena(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil || user.Role != "Owner" {
		utils.RespondWithError(w, http.StatusForbidden, "owner access required")
		return
	}

	var req models.CreateArenaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.SportType == "" || req.Capacity <= 0 || req.SlotDuration <= 0 || req.Price < 0 {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid arena data")
		return
	}

	// Verify stadium ownership
	if !services.VerifyStadiumOwner(req.StadiumID, user.UserID) {
		utils.RespondWithError(w, http.StatusForbidden, "you don't own this stadium")
		return
	}

	arena, err := services.CreateArena(req.StadiumID, req)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(arena)
}

func GetArena(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	vars := mux.Vars(r)
	arenaID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid arena ID")
		return
	}

	arena, err := services.GetArenaByID(arenaID)
	if err != nil {
		utils.RespondWithError(w, http.StatusNotFound, err.Error())
		return
	}

	// Get slot availability if date is provided
	dateStr := r.URL.Query().Get("date")
	if dateStr != "" {
		date, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			// Get bookings for this date
			bookings, _ := services.GetBookingsByArena(arenaID)
			slotAvailability := generateSlotAvailability(arena, date, bookings)
			response := map[string]interface{}{
				"arena":            arena,
				"slotAvailability": slotAvailability,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(arena)
}

func GetArenasByStadium(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	vars := mux.Vars(r)
	stadiumID, err := strconv.Atoi(vars["stadiumId"])
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid stadium ID")
		return
	}

	// Get query parameters for pagination, search, and sorting
	searchText := r.URL.Query().Get("searchText")
	sortColumn := r.URL.Query().Get("sortColumn")
	sortDirection := r.URL.Query().Get("sortDirection")

	pageNumber := 1
	if pn := r.URL.Query().Get("pageNumber"); pn != "" {
		if pnInt, err := strconv.Atoi(pn); err == nil && pnInt > 0 {
			pageNumber = pnInt
		}
	}

	pageSize := 10
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		if psInt, err := strconv.Atoi(ps); err == nil && psInt > 0 {
			pageSize = psInt
		}
	}

	params := models.ArenaSearchParams{
		StadiumID:     stadiumID,
		SearchText:    searchText,
		SortColumn:    sortColumn,
		SortDirection: sortDirection,
		PageNumber:    pageNumber,
		PageSize:      pageSize,
	}

	result, err := services.GetArenasByStadiumPaginated(params)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func SearchArenas(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	location := r.URL.Query().Get("location")
	sportType := r.URL.Query().Get("sportType")
	dateStr := r.URL.Query().Get("date")

	var date *time.Time
	if dateStr != "" {
		parsedDate, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			date = &parsedDate
		}
	}

	// Use the version that includes location information
	arenas, err := services.GetArenasByFiltersWithLocation(location, sportType, date)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(arenas)
}

func GetAllArenas(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	arenas, err := services.GetAllArenasWithLocation()
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Return empty array if no arenas found, not error
	w.Header().Set("Content-Type", "application/json")
	if arenas == nil {
		arenas = []models.ArenaWithLocation{}
	}
	json.NewEncoder(w).Encode(arenas)
}

func generateSlotAvailability(arena *models.Arena, date time.Time, bookings []models.Booking) []models.SlotAvailability {
	// Generate slots for the day (e.g., 8 AM to 10 PM, based on slot duration)
	startHour := 8
	endHour := 22
	slotDuration := time.Duration(arena.SlotDuration) * time.Minute

	var slots []models.SlotAvailability

	dayStart := time.Date(date.Year(), date.Month(), date.Day(), startHour, 0, 0, 0, time.UTC)
	dayEnd := time.Date(date.Year(), date.Month(), date.Day(), endHour, 0, 0, 0, time.UTC)

	currentSlot := dayStart
	for currentSlot.Add(slotDuration).Before(dayEnd) || currentSlot.Add(slotDuration).Equal(dayEnd) {
		slotEnd := currentSlot.Add(slotDuration)

		// Check if this slot conflicts with any booking
		available := true
		for _, booking := range bookings {
			if booking.Status == "Cancelled" {
				continue
			}
			// Check if slots overlap
			if !(slotEnd.Before(booking.SlotStart) || currentSlot.After(booking.SlotEnd)) {
				available = false
				break
			}
		}

		slots = append(slots, models.SlotAvailability{
			SlotStart: currentSlot,
			SlotEnd:   slotEnd,
			Available: available,
		})

		currentSlot = slotEnd
	}

	return slots
}
