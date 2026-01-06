package middleware

import (
	"BookMyArena/backend/models"
	"BookMyArena/backend/services"
	"context"
	"encoding/json"
	"net/http"
)

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		
		var token string

		cookie, err := r.Cookie("session_token")
		if err == nil {
			token = cookie.Value
		} else {
			
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
				token = authHeader[7:]
			}
		}

		if token == "" {
			respondWithError(w, http.StatusUnauthorized, "unauthorized: no session token")
			return
		}

		user, err := services.ValidateSession(token)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "unauthorized: invalid or expired session")
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func OwnerOnlyMiddleware(next http.Handler) http.Handler {
	return AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := r.Context().Value(UserContextKey).(*models.User)
		if user.Role != "Owner" {
			respondWithError(w, http.StatusForbidden, "forbidden: owner access required")
			return
		}
		next.ServeHTTP(w, r)
	}))
}

func GetUserFromContext(r *http.Request) *models.User {
	user, ok := r.Context().Value(UserContextKey).(*models.User)
	if !ok {
		return nil
	}
	return user
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

