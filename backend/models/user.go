package models

import (
	"time"
)

type User struct {
	UserID       int       `json:"userId" db:"UserId"`
	FullName     string    `json:"fullName" db:"FullName"`
	Email        string    `json:"email" db:"Email"`
	PasswordHash string    `json:"-" db:"PasswordHash"`
	Role         string    `json:"role" db:"Role"`
	CreatedAt    time.Time `json:"createdAt" db:"CreatedAt"`
}

type SignupRequest struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

