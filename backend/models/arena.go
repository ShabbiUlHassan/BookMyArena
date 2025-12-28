package models

import (
	"time"
)

type Arena struct {
	ArenaID      int       `json:"arenaId" db:"ArenaId"`
	StadiumID    int       `json:"stadiumId" db:"StadiumId"`
	Name         string    `json:"name" db:"Name"`
	SportType    string    `json:"sportType" db:"SportType"`
	Capacity     int       `json:"capacity" db:"Capacity"`
	SlotDuration int       `json:"slotDuration" db:"SlotDuration"`
	Price        float64   `json:"price" db:"Price"`
	CreatedAt    time.Time `json:"createdAt" db:"CreatedAt"`
}

type CreateArenaRequest struct {
	StadiumID    int     `json:"stadiumId"`
	Name         string  `json:"name"`
	SportType    string  `json:"sportType"`
	Capacity     int     `json:"capacity"`
	SlotDuration int     `json:"slotDuration"`
	Price        float64 `json:"price"`
}

type SlotAvailability struct {
	SlotStart time.Time `json:"slotStart"`
	SlotEnd   time.Time `json:"slotEnd"`
	Available bool      `json:"available"`
}

