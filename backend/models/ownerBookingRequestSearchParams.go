package models

type OwnerBookingRequestSearchParams struct {
	OwnerID       int
	SearchText    string
	SortColumn    string
	SortDirection string
	PageNumber    int
	PageSize      int
}

type OwnerBookingRequestWithDetails struct {
	BookingRequestID int     `json:"bookingRequestId" db:"BookingRequestId"`
	StadiumName      string  `json:"stadiumName" db:"StadiumName"`
	ArenaName        string  `json:"arenaName" db:"ArenaName"`
	Location         string  `json:"location" db:"Location"`
	Date             string  `json:"date" db:"Date"`
	StartTime        string  `json:"startTime" db:"StartTime"`
	EndTime          string  `json:"endTime" db:"EndTime"`
	TotalDuration    int     `json:"totalDuration" db:"TotalDuration"`
	Price            float64 `json:"price" db:"Price"`
	Status           string  `json:"status" db:"Status"`
	AvailabilityId   string  `json:"availabilityId" db:"AvailabilityId"`
}

type PaginatedOwnerBookingRequests struct {
	BookingRequests []OwnerBookingRequestWithDetails `json:"bookingRequests"`
	TotalCount      int                              `json:"totalCount"`
	TotalPages      int                              `json:"totalPages"`
	PageNumber      int                              `json:"pageNumber"`
	PageSize        int                              `json:"pageSize"`
}

