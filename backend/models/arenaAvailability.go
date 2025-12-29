package models

import (
	"time"
)

type ArenaAvailability struct {
	Id               string    `json:"id" db:"Id"`
	Date             time.Time `json:"date" db:"Date"`
	StartTime        string    `json:"startTime" db:"StartTime"`
	EndTime          string    `json:"endTime" db:"EndTime"`
	StadiumId        int       `json:"stadiumId" db:"StadiumId"`
	ArenaId          int       `json:"arenaId" db:"ArenaId"`
	BookerId         *int      `json:"bookerId,omitempty" db:"BookerId"`
	AvailabilityDone bool      `json:"availabilityDone" db:"AvailabilityDone"`
	OwnerId          int       `json:"ownerId" db:"OwnerId"`
	CreatedDate      time.Time `json:"createdDate" db:"CreatedDate"`
	CreatedBy        int       `json:"createdBy" db:"CreatedBy"`
	IsDeleted        bool      `json:"isDeleted" db:"IsDeleted"`
}

type CreateAvailabilityRequest struct {
	ArenaId        int                `json:"arenaId"`
	Availabilities []AvailabilitySlot `json:"availabilities"`
}

type AvailabilitySlot struct {
	Date      string `json:"date"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}
