package models

type AvailabilitySearchParams struct {
	OwnerId      int
	SearchText   string
	SortColumn   string
	SortDirection string
	PageNumber   int
	PageSize     int
}

type AvailabilityWithDetails struct {
	Id               string    `json:"id" db:"Id"`
	Date             string    `json:"date" db:"Date"`
	StartTime        string    `json:"startTime" db:"StartTime"`
	EndTime          string    `json:"endTime" db:"EndTime"`
	TotalDuration    int       `json:"totalDuration" db:"TotalDuration"`
	StadiumName      string    `json:"stadiumName" db:"StadiumName"`
	ArenaName        string    `json:"arenaName" db:"ArenaName"`
	BookerName       *string   `json:"bookerName,omitempty" db:"BookerName"`
	Reserved         bool      `json:"reserved" db:"Reserved"`
	CreatedDate      string    `json:"createdDate" db:"CreatedDate"`
	StadiumId        int       `json:"stadiumId" db:"StadiumId"`
	ArenaId          int       `json:"arenaId" db:"ArenaId"`
}

type PaginatedAvailabilities struct {
	Availabilities []AvailabilityWithDetails `json:"availabilities"`
	TotalCount     int                       `json:"totalCount"`
	TotalPages     int                       `json:"totalPages"`
	PageNumber     int                       `json:"pageNumber"`
	PageSize       int                       `json:"pageSize"`
}

