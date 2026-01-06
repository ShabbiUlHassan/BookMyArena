package models

type UserAvailabilitySearchParams struct {
	UserID        int
	SearchText    string
	SortColumn    string
	SortDirection string
	PageNumber    int
	PageSize      int
}

type UserAvailabilityWithDetails struct {
	Id            string  `json:"id" db:"Id"`
	StadiumName   string  `json:"stadiumName" db:"StadiumName"`
	ArenaName     string  `json:"arenaName" db:"ArenaName"`
	Location      string  `json:"location" db:"Location"`
	SportType     string  `json:"sportType" db:"SportType"`
	Capacity      int     `json:"capacity" db:"Capacity"`
	Date          string  `json:"date" db:"Date"`
	StartTime     string  `json:"startTime" db:"StartTime"`
	EndTime       string  `json:"endTime" db:"EndTime"`
	TotalDuration int     `json:"totalDuration" db:"TotalDuration"`
	Price         float64 `json:"price" db:"Price"`
	ArenaId       int     `json:"arenaId" db:"ArenaId"`
	StadiumId     int     `json:"stadiumId" db:"StadiumId"`
}

type PaginatedUserAvailabilities struct {
	Availabilities []UserAvailabilityWithDetails `json:"availabilities"`
	TotalCount     int                           `json:"totalCount"`
	TotalPages     int                           `json:"totalPages"`
	PageNumber     int                           `json:"pageNumber"`
	PageSize       int                           `json:"pageSize"`
}
