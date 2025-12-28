package controllers

import (
	"BookMyArena/backend/middleware"
	"BookMyArena/backend/models"
	"BookMyArena/backend/services"
	"BookMyArena/backend/utils"
	"encoding/json"
	"net/http"
	"time"
)

func Signup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req models.SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate input
	if req.Email == "" || req.Password == "" || req.FullName == "" || req.Role == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "all fields are required")
		return
	}

	// Validate email format (basic check)
	if len(req.Email) < 5 || !contains(req.Email, "@") {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid email format")
		return
	}

	// Validate password strength (minimum 6 characters)
	if len(req.Password) < 6 {
		utils.RespondWithError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	user, err := services.CreateUser(req)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Don't send password hash
	user.PasswordHash = ""
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

func Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate input
	if req.Email == "" || req.Password == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	user, err := services.AuthenticateUser(req.Email, req.Password)
	if err != nil {
		utils.RespondWithError(w, http.StatusUnauthorized, err.Error())
		return
	}

	// Create session
	token, err := services.CreateSession(user.UserID)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
	})

	// Don't send password hash
	user.PasswordHash = ""
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user":  user,
		"token": token,
	})
}

func Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		utils.RespondWithError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	cookie, err := r.Cookie("session_token")
	if err == nil {
		services.DeleteSession(cookie.Value)
	}

	// Clear cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Expires:  time.Now().Add(-time.Hour),
		HttpOnly: true,
		Path:     "/",
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "logged out successfully"})
}

func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r)
	if user == nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user.PasswordHash = ""
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && contains(s[1:], substr) || s[:len(substr)] == substr)
}

