package models

import "time"

type Payment struct {
	PaymentID        int       `json:"paymentId" db:"PaymentID"`
	BookingRequestID int       `json:"bookingRequestId" db:"BookingRequestID"`
	IsPaid           bool      `json:"isPaid" db:"IsPaid"`
	PaidDate         *time.Time `json:"paidDate,omitempty" db:"PaidDate"`
	CreatedBy        int       `json:"createdBy" db:"CreatedBy"`
	IsDeleted        bool      `json:"isDeleted" db:"IsDeleted"`
}

type PaymentWithDetails struct {
	PaymentID     int     `json:"paymentId" db:"PaymentID"`
	StadiumName   string  `json:"stadiumName" db:"StadiumName"`
	ArenaName     string  `json:"arenaName" db:"ArenaName"`
	Date          string  `json:"date" db:"Date"`
	StartTime     string  `json:"startTime" db:"StartTime"`
	EndTime       string  `json:"endTime" db:"EndTime"`
	TotalDuration int     `json:"totalDuration" db:"TotalDuration"`
	Price         float64 `json:"price" db:"Price"`
	IsPaid        bool    `json:"isPaid" db:"IsPaid"`
}

type PaymentWithOwnerDetails struct {
	PaymentID     int     `json:"paymentId" db:"PaymentID"`
	StadiumName   string  `json:"stadiumName" db:"StadiumName"`
	ArenaName     string  `json:"arenaName" db:"ArenaName"`
	Date          string  `json:"date" db:"Date"`
	StartTime     string  `json:"startTime" db:"StartTime"`
	EndTime       string  `json:"endTime" db:"EndTime"`
	TotalDuration int     `json:"totalDuration" db:"TotalDuration"`
	Price         float64 `json:"price" db:"Price"`
	IsPaid        bool    `json:"isPaid" db:"IsPaid"`
	BookerName    string  `json:"bookerName" db:"BookerName"`
	BookerEmail   string  `json:"bookerEmail" db:"BookerEmail"`
}

type PaymentSearchParams struct {
	UserID        int
	IsPaid        *bool
	StartDate     string
	EndDate       string
	SearchText    string
	SortColumn    string
	SortDirection string
	PageNumber    int
	PageSize      int
}

type OwnerPaymentSearchParams struct {
	OwnerID       int
	IsPaid        *bool
	StartDate     string
	EndDate       string
	SearchText    string
	SortColumn    string
	SortDirection string
	PageNumber    int
	PageSize      int
}

type PaginatedPayments struct {
	Payments   []PaymentWithDetails `json:"payments"`
	TotalCount int                   `json:"totalCount"`
	TotalPages int                   `json:"totalPages"`
	PageNumber int                   `json:"pageNumber"`
	PageSize   int                   `json:"pageSize"`
	TotalPaid  float64               `json:"totalPaid,omitempty"`
	TotalPayable float64             `json:"totalPayable,omitempty"`
}

type PaginatedOwnerPayments struct {
	Payments      []PaymentWithOwnerDetails `json:"payments"`
	TotalCount    int                       `json:"totalCount"`
	TotalPages    int                       `json:"totalPages"`
	PageNumber    int                       `json:"pageNumber"`
	PageSize      int                       `json:"pageSize"`
	TotalReceived float64                   `json:"totalReceived,omitempty"`
	TotalPending  float64                   `json:"totalPending,omitempty"`
}
