package models

import (
	"time"
)

type Stadium struct {
	StadiumID int       `json:"stadiumId" db:"StadiumId"`
	OwnerID   int       `json:"ownerId" db:"OwnerId"`
	Name      string    `json:"name" db:"Name"`
	Location  string    `json:"location" db:"Location"`
	CreatedAt time.Time `json:"createdAt" db:"CreatedAt"`
}

type CreateStadiumRequest struct {
	Name     string `json:"name"`
	Location string `json:"location"`
}

