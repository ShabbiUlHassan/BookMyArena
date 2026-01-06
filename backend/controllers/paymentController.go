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

func GetUserPayments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	isPaidStr := r.URL.Query().Get("isPaid")
	var isPaid *bool
	if isPaidStr != "" {
		if isPaidStr == "true" || isPaidStr == "1" {
			val := true
			isPaid = &val
		} else if isPaidStr == "false" || isPaidStr == "0" {
			val := false
			isPaid = &val
		}
	}

	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	searchText := r.URL.Query().Get("searchText")

	sortColumn := r.URL.Query().Get("sortColumn")
	if sortColumn == "" {
		sortColumn = "Date"
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

	params := models.PaymentSearchParams{
		UserID:        user.UserID,
		IsPaid:        isPaid,
		StartDate:     startDate,
		EndDate:       endDate,
		SearchText:    searchText,
		SortColumn:    sortColumn,
		SortDirection: sortDirection,
		PageNumber:    pageNumber,
		PageSize:      pageSize,
	}

	result, err := services.GetUserPaymentsPaginated(params)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func ProcessPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	vars := mux.Vars(r)
	paymentID, err := strconv.Atoi(vars["id"])
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid payment ID")
		return
	}

	err = services.ProcessPayment(paymentID, user.UserID)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "payment processed successfully"})
}

func GetOwnerPayments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	if user.Role != "Owner" {
		utils.RespondWithError(w, http.StatusForbidden, "only owners can access this endpoint")
		return
	}

	isPaidStr := r.URL.Query().Get("isPaid")
	var isPaid *bool
	if isPaidStr != "" {
		if isPaidStr == "true" || isPaidStr == "1" {
			val := true
			isPaid = &val
		} else if isPaidStr == "false" || isPaidStr == "0" {
			val := false
			isPaid = &val
		}
	}

	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	searchText := r.URL.Query().Get("searchText")

	sortColumn := r.URL.Query().Get("sortColumn")
	if sortColumn == "" {
		sortColumn = "Date"
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

	params := models.OwnerPaymentSearchParams{
		OwnerID:       user.UserID,
		IsPaid:        isPaid,
		StartDate:     startDate,
		EndDate:       endDate,
		SearchText:    searchText,
		SortColumn:    sortColumn,
		SortDirection: sortDirection,
		PageNumber:    pageNumber,
		PageSize:      pageSize,
	}

	result, err := services.GetOwnerPaymentsPaginated(params)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
