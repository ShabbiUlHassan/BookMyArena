package models

import (
	"time"
)

type Session struct {
	SessionID int       `json:"sessionId" db:"SessionId"`
	UserID    int       `json:"userId" db:"UserId"`
	Token     string    `json:"token" db:"Token"`
	ExpiresAt time.Time `json:"expiresAt" db:"ExpiresAt"`
}

