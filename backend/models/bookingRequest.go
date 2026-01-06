package models

import "time"

type BookingRequest struct {
	BookingRequestID int       `json:"bookingRequestId" db:"BookingRequestId"`
	BookieID         int       `json:"bookieId" db:"BookieID"`
	OwnersId         int       `json:"ownersId" db:"OwnersId"`
	ArenaID          int       `json:"arenaId" db:"ArenaID"`
	Price            float64   `json:"price" db:"Price"`
	RStatus          string    `json:"rStatus" db:"RStatus"`
	CreatedBy        int       `json:"createdBy" db:"CreatedBy"`
	CreatedDate      time.Time `json:"createdDate" db:"CreatedDate"`
	IsDeleted        bool      `json:"isDeleted" db:"IsDeleted"`
	AvailabilityId   string    `json:"availabilityId" db:"AvailabilityId"` 
}

type CreateBookingRequestRequest struct {
	AvailabilityId string `json:"availabilityId"`
}
