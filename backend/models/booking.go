package models

import (
	"time"
)

type Booking struct {
	BookingID int       `json:"bookingId" db:"BookingId"`
	UserID    int       `json:"userId" db:"UserId"`
	ArenaID   int       `json:"arenaId" db:"ArenaId"`
	SlotStart time.Time `json:"slotStart" db:"SlotStart"`
	SlotEnd   time.Time `json:"slotEnd" db:"SlotEnd"`
	Status    string    `json:"status" db:"Status"`
	CreatedAt time.Time `json:"createdAt" db:"CreatedAt"`
}

type CreateBookingRequest struct {
	ArenaID   int       `json:"arenaId"`
	SlotStart time.Time `json:"slotStart"`
	SlotEnd   time.Time `json:"slotEnd"`
}

type BookingWithDetails struct {
	Booking
	ArenaName   string  `json:"arenaName"`
	StadiumName string  `json:"stadiumName"`
	Location    string  `json:"location"`
	SportType   string  `json:"sportType"`
	Price       float64 `json:"price"`
}

