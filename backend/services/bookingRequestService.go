package services

import (
	"BookMyArena/backend/config"
	"BookMyArena/backend/models"
	"database/sql"
	"errors"
	"fmt"
)

func CreateBookingRequest(userID int, req models.CreateBookingRequestRequest) (*models.BookingRequest, error) {
	// Begin transaction
	tx, err := config.DB.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Validate and retrieve availability information
	var availabilityDone bool
	var isDeleted bool
	var arenaID int
	var ownerID int
	var price float64

	err = tx.QueryRow(`
		SELECT 
			aa.AvailabilityDone,
			aa.IsDeleted,
			aa.ArenaId,
			s.OwnerId,
			a.Price
		FROM ArenaAvailability aa
		INNER JOIN Arenas a ON aa.ArenaId = a.ArenaId
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		WHERE CAST(aa.Id AS VARCHAR(36)) = @p1
		AND aa.IsDeleted = 0
		AND aa.AvailabilityDone = 0
	`, req.AvailabilityId).Scan(&availabilityDone, &isDeleted, &arenaID, &ownerID, &price)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("availability not found")
		}
		return nil, fmt.Errorf("failed to verify availability: %w", err)
	}

	// Validate availability is still open
	if availabilityDone {
		return nil, errors.New("availability slot is already booked")
	}

	if isDeleted {
		return nil, errors.New("availability slot has been deleted")
	}

	// Check for duplicate booking request for the same availability by the same user
	var existingCount int
	err = tx.QueryRow(`
		SELECT COUNT(*) 
		FROM BookingRequest 
		WHERE BookieID = @p1 
		AND CAST(AvailabilityId AS VARCHAR(36)) = @p2 
		AND IsDeleted = 0
	`, userID, req.AvailabilityId).Scan(&existingCount)
	if err != nil {
		return nil, fmt.Errorf("failed to check for duplicate booking: %w", err)
	}

	if existingCount > 0 {
		return nil, errors.New("you have already requested this availability slot")
	}

	// Insert booking request
	result := tx.QueryRow(`
		INSERT INTO BookingRequest (
			BookieID, OwnersId, ArenaID, Price, RStatus, 
			CreatedBy, CreatedDate, IsDeleted, AvailabilityId
		) 
		OUTPUT INSERTED.BookingRequestId, INSERTED.BookieID, INSERTED.OwnersId, 
		       INSERTED.ArenaID, INSERTED.Price, INSERTED.RStatus, 
		       INSERTED.CreatedBy, INSERTED.CreatedDate, INSERTED.IsDeleted, 
		       CAST(INSERTED.AvailabilityId AS VARCHAR(36)) AS AvailabilityId
		VALUES (@p1, @p2, @p3, @p4, @p5, @p6, GETDATE(), 0, CAST(@p7 AS UNIQUEIDENTIFIER))
	`, userID, ownerID, arenaID, price, "Pending", userID, req.AvailabilityId)

	bookingRequest := &models.BookingRequest{}
	var availabilityIdStr string
	err = result.Scan(
		&bookingRequest.BookingRequestID,
		&bookingRequest.BookieID,
		&bookingRequest.OwnersId,
		&bookingRequest.ArenaID,
		&bookingRequest.Price,
		&bookingRequest.RStatus,
		&bookingRequest.CreatedBy,
		&bookingRequest.CreatedDate,
		&bookingRequest.IsDeleted,
		&availabilityIdStr,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create booking request: %w", err)
	}

	bookingRequest.AvailabilityId = availabilityIdStr

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return bookingRequest, nil
}

func GetBookingRequestDetails(availabilityId string) (*models.UserAvailabilityWithDetails, error) {
	var details models.UserAvailabilityWithDetails

	err := config.DB.QueryRow(`
		SELECT 
			CAST(aa.Id AS VARCHAR(36)) AS Id,
			s.Name AS StadiumName,
			a.Name AS ArenaName,
			s.Location AS Location,
			a.SportType AS SportType,
			a.Capacity AS Capacity,
			CONVERT(VARCHAR, aa.Date, 120) AS Date,
			CAST(aa.StartTime AS VARCHAR) AS StartTime,
			CAST(aa.EndTime AS VARCHAR) AS EndTime,
			DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
			a.Price AS Price,
			aa.ArenaId,
			aa.StadiumId
		FROM ArenaAvailability aa
		INNER JOIN Stadiums s ON aa.StadiumId = s.StadiumId
		INNER JOIN Arenas a ON aa.ArenaId = a.ArenaId
		WHERE CAST(aa.Id AS VARCHAR(36)) = @p1
		AND aa.IsDeleted = 0
		AND aa.AvailabilityDone = 0
	`, availabilityId).Scan(
		&details.Id,
		&details.StadiumName,
		&details.ArenaName,
		&details.Location,
		&details.SportType,
		&details.Capacity,
		&details.Date,
		&details.StartTime,
		&details.EndTime,
		&details.TotalDuration,
		&details.Price,
		&details.ArenaId,
		&details.StadiumId,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("availability not found")
		}
		return nil, fmt.Errorf("failed to get booking request details: %w", err)
	}

	return &details, nil
}

// getOrderByColumnForBookingRequest maps frontend sort column names to actual SQL column/expression
func getOrderByColumnForBookingRequest(sortColumn string) string {
	columnMap := map[string]string{
		"StadiumName": "s.Name",
		"ArenaName":   "a.Name",
		"Date":        "aa.Date",
		"StartTime":   "aa.StartTime",
		"EndTime":     "aa.EndTime",
		"Price":       "br.Price",
		"Status":      "br.RStatus",
		"CreatedDate": "br.CreatedDate",
	}

	if mapped, ok := columnMap[sortColumn]; ok {
		return mapped
	}
	return "br.CreatedDate" // default
}

func GetUserBookingRequestsPaginated(params models.BookingRequestSearchParams) (*models.PaginatedBookingRequests, error) {
	// Validate and set sort column (whitelist to prevent SQL injection)
	sortColumn := params.SortColumn
	validSortColumns := map[string]bool{
		"StadiumName": true, "ArenaName": true, "Date": true, "StartTime": true,
		"EndTime": true, "Price": true, "Status": true, "CreatedDate": true,
	}
	if !validSortColumns[sortColumn] {
		sortColumn = "CreatedDate"
	}

	// Validate sort direction
	sortDirection := params.SortDirection
	if sortDirection != "ASC" && sortDirection != "DESC" {
		sortDirection = "DESC"
	}

	// Validate pagination parameters
	if params.PageNumber < 1 {
		params.PageNumber = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 10
	}
	if params.PageSize > 100 {
		params.PageSize = 100
	}

	// Calculate pagination
	offset := (params.PageNumber - 1) * params.PageSize

	// Build WHERE clause for count and main query
	var countQuery string
	var query string
	var countArgs []interface{}
	var queryArgs []interface{}

	if params.SearchText != "" {
		searchPattern := "%" + params.SearchText + "%"
		countQuery = `
			SELECT COUNT(*) 
			FROM BookingRequest br
			INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
			INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
			INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
			WHERE br.IsDeleted = 0 
			AND br.IsDeletedUser = 0
			AND br.BookieID = @p1
			AND (
				s.Name LIKE @p2 OR
				a.Name LIKE @p2 OR
				CONVERT(VARCHAR, aa.Date, 120) LIKE @p2 OR
				CAST(aa.StartTime AS VARCHAR) LIKE @p2 OR
				CAST(aa.EndTime AS VARCHAR) LIKE @p2 OR
				CAST(br.Price AS VARCHAR) LIKE @p2 OR
				br.RStatus LIKE @p2 OR
				CONVERT(VARCHAR, br.CreatedDate, 120) LIKE @p2
			)
		`
		countArgs = []interface{}{params.UserID, searchPattern}

		// Map sort column to actual SQL column/expression
		orderByColumn := getOrderByColumnForBookingRequest(sortColumn)
		query = fmt.Sprintf(`
			SELECT 
				br.BookingRequestId,
				s.Name AS StadiumName,
				a.Name AS ArenaName,
				CONVERT(VARCHAR, aa.Date, 120) AS Date,
				CAST(aa.StartTime AS VARCHAR) AS StartTime,
				CAST(aa.EndTime AS VARCHAR) AS EndTime,
				DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
				br.Price AS Price,
				br.RStatus AS Status,
				CAST(aa.Id AS VARCHAR(36)) AS AvailabilityId
			FROM BookingRequest br
			INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
			INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
			INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
			WHERE br.IsDeleted = 0 
			AND br.IsDeletedUser = 0
			AND br.BookieID = @p1
			AND (
				s.Name LIKE @p2 OR
				a.Name LIKE @p2 OR
				CONVERT(VARCHAR, aa.Date, 120) LIKE @p2 OR
				CAST(aa.StartTime AS VARCHAR) LIKE @p2 OR
				CAST(aa.EndTime AS VARCHAR) LIKE @p2 OR
				CAST(br.Price AS VARCHAR) LIKE @p2 OR
				br.RStatus LIKE @p2 OR
				CONVERT(VARCHAR, br.CreatedDate, 120) LIKE @p2
			)
			ORDER BY %s %s 
			OFFSET @p3 ROWS FETCH NEXT @p4 ROWS ONLY
		`, orderByColumn, sortDirection)
		queryArgs = []interface{}{params.UserID, searchPattern, offset, params.PageSize}
	} else {
		countQuery = `
			SELECT COUNT(*) 
			FROM BookingRequest br
			WHERE br.IsDeleted = 0 
			AND br.IsDeletedUser = 0
			AND br.BookieID = @p1
		`
		countArgs = []interface{}{params.UserID}

		// Map sort column to actual SQL column/expression
		orderByColumn := getOrderByColumnForBookingRequest(sortColumn)
		query = fmt.Sprintf(`
			SELECT 
				br.BookingRequestId,
				s.Name AS StadiumName,
				a.Name AS ArenaName,
				CONVERT(VARCHAR, aa.Date, 120) AS Date,
				CAST(aa.StartTime AS VARCHAR) AS StartTime,
				CAST(aa.EndTime AS VARCHAR) AS EndTime,
				DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
				br.Price AS Price,
				br.RStatus AS Status,
				CAST(aa.Id AS VARCHAR(36)) AS AvailabilityId
			FROM BookingRequest br
			INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
			INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
			INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
			WHERE br.IsDeleted = 0 
			AND br.IsDeletedUser = 0
			AND br.BookieID = @p1
			ORDER BY %s %s 
			OFFSET @p2 ROWS FETCH NEXT @p3 ROWS ONLY
		`, orderByColumn, sortDirection)
		queryArgs = []interface{}{params.UserID, offset, params.PageSize}
	}

	// Get total count
	var totalCount int
	err := config.DB.QueryRow(countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	// Calculate total pages
	totalPages := (totalCount + params.PageSize - 1) / params.PageSize
	if params.PageNumber > totalPages && totalPages > 0 {
		params.PageNumber = totalPages
		// Recalculate offset and query args if page number was adjusted
		offset = (params.PageNumber - 1) * params.PageSize
		if params.SearchText != "" {
			queryArgs[2] = offset
		} else {
			queryArgs[1] = offset
		}
	}

	// Execute main query
	rows, err := config.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to query booking requests: %w", err)
	}
	defer rows.Close()

	var bookingRequests []models.BookingRequestWithDetails
	for rows.Next() {
		var br models.BookingRequestWithDetails

		err := rows.Scan(
			&br.BookingRequestID,
			&br.StadiumName,
			&br.ArenaName,
			&br.Date,
			&br.StartTime,
			&br.EndTime,
			&br.TotalDuration,
			&br.Price,
			&br.Status,
			&br.AvailabilityId,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan booking request: %w", err)
		}

		bookingRequests = append(bookingRequests, br)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return &models.PaginatedBookingRequests{
		BookingRequests: bookingRequests,
		TotalCount:      totalCount,
		TotalPages:      totalPages,
		PageNumber:      params.PageNumber,
		PageSize:        params.PageSize,
	}, nil
}

func DeleteBookingRequest(bookingRequestID int, userID int, userRole string) error {
	// Get booking request details
	var bookieID int
	var ownersID int
	var status string
	err := config.DB.QueryRow(`
		SELECT BookieID, OwnersId, RStatus 
		FROM BookingRequest 
		WHERE BookingRequestId = @p1 
		AND (IsDeletedUser = 0 OR IsDeletedOwner = 0)
	`, bookingRequestID).Scan(&bookieID, &ownersID, &status)

	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("booking request not found")
		}
		return fmt.Errorf("failed to verify booking request: %w", err)
	}

	// Determine which soft delete flag to set based on user role
	var updateQuery string
	if userRole == "Owner" {
		// Owner is deleting - verify ownership
		if ownersID != userID {
			return errors.New("you don't have permission to delete this booking request")
		}
		// Set IsDeletedOwner flag
		updateQuery = `
			UPDATE BookingRequest 
			SET IsDeletedOwner = 1 
			WHERE BookingRequestId = @p1
		`
	} else {
		// User is deleting - verify they are the bookie
		if bookieID != userID {
			return errors.New("you don't have permission to delete this booking request")
		}
		// Set IsDeletedUser flag
		updateQuery = `
			UPDATE BookingRequest 
			SET IsDeletedUser = 1 
			WHERE BookingRequestId = @p1
		`
	}

	// Soft delete based on role
	_, err = config.DB.Exec(updateQuery, bookingRequestID)

	if err != nil {
		return fmt.Errorf("failed to delete booking request: %w", err)
	}

	return nil
}

// getOrderByColumnForOwnerBookingRequest maps frontend sort column names to actual SQL column/expression
func getOrderByColumnForOwnerBookingRequest(sortColumn string) string {
	columnMap := map[string]string{
		"StadiumName": "s.Name",
		"ArenaName":   "a.Name",
		"Location":    "s.Location",
		"Date":        "aa.Date",
		"StartTime":   "aa.StartTime",
		"EndTime":     "aa.EndTime",
		"Price":       "br.Price",
		"Status":      "br.RStatus",
		"CreatedDate": "br.CreatedDate",
	}

	if mapped, ok := columnMap[sortColumn]; ok {
		return mapped
	}
	return "br.CreatedDate" // default
}

func GetOwnerBookingRequestsPaginated(params models.OwnerBookingRequestSearchParams) (*models.PaginatedOwnerBookingRequests, error) {
	// Validate and set sort column (whitelist to prevent SQL injection)
	sortColumn := params.SortColumn
	validSortColumns := map[string]bool{
		"StadiumName": true, "ArenaName": true, "Location": true, "Date": true, "StartTime": true,
		"EndTime": true, "Price": true, "Status": true, "CreatedDate": true,
	}
	if !validSortColumns[sortColumn] {
		sortColumn = "CreatedDate"
	}

	// Validate sort direction
	sortDirection := params.SortDirection
	if sortDirection != "ASC" && sortDirection != "DESC" {
		sortDirection = "DESC"
	}

	// Validate pagination parameters
	if params.PageNumber < 1 {
		params.PageNumber = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 10
	}
	if params.PageSize > 100 {
		params.PageSize = 100
	}

	// Calculate pagination
	offset := (params.PageNumber - 1) * params.PageSize

	// Build WHERE clause for count and main query
	var countQuery string
	var query string
	var countArgs []interface{}
	var queryArgs []interface{}

	if params.SearchText != "" {
		searchPattern := "%" + params.SearchText + "%"
		countQuery = `
			SELECT COUNT(*) 
			FROM BookingRequest br
			INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
			INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
			INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
			INNER JOIN Users u ON br.BookieID = u.UserId
			WHERE br.IsDeleted = 0 
			AND br.IsDeletedOwner = 0
			AND br.OwnersId = @p1
			AND (
				s.Name LIKE @p2 OR
				a.Name LIKE @p2 OR
				s.Location LIKE @p2 OR
				CONVERT(VARCHAR, aa.Date, 120) LIKE @p2 OR
				CAST(aa.StartTime AS VARCHAR) LIKE @p2 OR
				CAST(aa.EndTime AS VARCHAR) LIKE @p2 OR
				CAST(br.Price AS VARCHAR) LIKE @p2 OR
				br.RStatus LIKE @p2 OR
				CONVERT(VARCHAR, br.CreatedDate, 120) LIKE @p2 OR
				u.FullName LIKE @p2
			)
		`
		countArgs = []interface{}{params.OwnerID, searchPattern}

		// Map sort column to actual SQL column/expression
		orderByColumn := getOrderByColumnForOwnerBookingRequest(sortColumn)
		query = fmt.Sprintf(`
			SELECT 
				br.BookingRequestId,
				s.Name AS StadiumName,
				a.Name AS ArenaName,
				s.Location AS Location,
				CONVERT(VARCHAR, aa.Date, 120) AS Date,
				CAST(aa.StartTime AS VARCHAR) AS StartTime,
				CAST(aa.EndTime AS VARCHAR) AS EndTime,
				DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
				br.Price AS Price,
				u.FullName AS RequesterName,
				br.RStatus AS Status,
				CAST(aa.Id AS VARCHAR(36)) AS AvailabilityId
			FROM BookingRequest br
			INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
			INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
			INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
			INNER JOIN Users u ON br.BookieID = u.UserId
			WHERE br.IsDeleted = 0 
			AND br.IsDeletedOwner = 0
			AND br.OwnersId = @p1
			AND (
				s.Name LIKE @p2 OR
				a.Name LIKE @p2 OR
				s.Location LIKE @p2 OR
				CONVERT(VARCHAR, aa.Date, 120) LIKE @p2 OR
				CAST(aa.StartTime AS VARCHAR) LIKE @p2 OR
				CAST(aa.EndTime AS VARCHAR) LIKE @p2 OR
				CAST(br.Price AS VARCHAR) LIKE @p2 OR
				br.RStatus LIKE @p2 OR
				CONVERT(VARCHAR, br.CreatedDate, 120) LIKE @p2 OR
				u.FullName LIKE @p2
			)
			ORDER BY %s %s 
			OFFSET @p3 ROWS FETCH NEXT @p4 ROWS ONLY
		`, orderByColumn, sortDirection)
		queryArgs = []interface{}{params.OwnerID, searchPattern, offset, params.PageSize}
	} else {
		countQuery = `
			SELECT COUNT(*) 
			FROM BookingRequest br
			INNER JOIN Users u ON br.BookieID = u.UserId
			WHERE br.IsDeleted = 0 
			AND br.IsDeletedOwner = 0
			AND br.OwnersId = @p1
		`
		countArgs = []interface{}{params.OwnerID}

		// Map sort column to actual SQL column/expression
		orderByColumn := getOrderByColumnForOwnerBookingRequest(sortColumn)
		query = fmt.Sprintf(`
			SELECT 
				br.BookingRequestId,
				s.Name AS StadiumName,
				a.Name AS ArenaName,
				s.Location AS Location,
				CONVERT(VARCHAR, aa.Date, 120) AS Date,
				CAST(aa.StartTime AS VARCHAR) AS StartTime,
				CAST(aa.EndTime AS VARCHAR) AS EndTime,
				DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
				br.Price AS Price,
				u.FullName AS RequesterName,
				br.RStatus AS Status,
				CAST(aa.Id AS VARCHAR(36)) AS AvailabilityId
			FROM BookingRequest br
			INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
			INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
			INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
			INNER JOIN Users u ON br.BookieID = u.UserId
			WHERE br.IsDeleted = 0 
			AND br.IsDeletedOwner = 0
			AND br.OwnersId = @p1
			ORDER BY %s %s 
			OFFSET @p2 ROWS FETCH NEXT @p3 ROWS ONLY
		`, orderByColumn, sortDirection)
		queryArgs = []interface{}{params.OwnerID, offset, params.PageSize}
	}

	// Get total count
	var totalCount int
	err := config.DB.QueryRow(countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	// Calculate total pages
	totalPages := (totalCount + params.PageSize - 1) / params.PageSize
	if params.PageNumber > totalPages && totalPages > 0 {
		params.PageNumber = totalPages
		// Recalculate offset and query args if page number was adjusted
		offset = (params.PageNumber - 1) * params.PageSize
		if params.SearchText != "" {
			queryArgs[2] = offset
		} else {
			queryArgs[1] = offset
		}
	}

	// Execute main query
	rows, err := config.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to query booking requests: %w", err)
	}
	defer rows.Close()

	var bookingRequests []models.OwnerBookingRequestWithDetails
	for rows.Next() {
		var br models.OwnerBookingRequestWithDetails

		err := rows.Scan(
			&br.BookingRequestID,
			&br.StadiumName,
			&br.ArenaName,
			&br.Location,
			&br.Date,
			&br.StartTime,
			&br.EndTime,
			&br.TotalDuration,
			&br.Price,
			&br.RequesterName,
			&br.Status,
			&br.AvailabilityId,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan booking request: %w", err)
		}

		bookingRequests = append(bookingRequests, br)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return &models.PaginatedOwnerBookingRequests{
		BookingRequests: bookingRequests,
		TotalCount:      totalCount,
		TotalPages:      totalPages,
		PageNumber:      params.PageNumber,
		PageSize:        params.PageSize,
	}, nil
}

func UpdateBookingRequestStatus(bookingRequestID int, ownerID int, newStatus string) error {
	// Validate status
	if newStatus != "Booked" && newStatus != "Declined" {
		return errors.New("invalid status. Must be 'Booked' or 'Declined'")
	}

	// Begin transaction
	tx, err := config.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Verify ownership and current status
	var currentOwnerID int
	var currentStatus string
	var availabilityId string
	var bookieID int
	err = tx.QueryRow(`
		SELECT OwnersId, RStatus, CAST(AvailabilityId AS VARCHAR(36)), BookieID
		FROM BookingRequest 
		WHERE BookingRequestId = @p1 AND IsDeleted = 0
	`, bookingRequestID).Scan(&currentOwnerID, &currentStatus, &availabilityId, &bookieID)

	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("booking request not found")
		}
		return fmt.Errorf("failed to verify booking request: %w", err)
	}

	// Verify ownership
	if currentOwnerID != ownerID {
		return errors.New("you don't have permission to update this booking request")
	}

	// Prevent status updates on non-pending requests
	if currentStatus != "Pending" {
		return errors.New("can only update booking requests with Pending status")
	}

	// Update booking request status
	_, err = tx.Exec(`
		UPDATE BookingRequest 
		SET RStatus = @p1 
		WHERE BookingRequestId = @p2
	`, newStatus, bookingRequestID)

	if err != nil {
		return fmt.Errorf("failed to update booking request status: %w", err)
	}

	// If status is "Booked", mark related availability as unavailable and create payment record
	if newStatus == "Booked" {
		_, err = tx.Exec(`
			UPDATE ArenaAvailability 
			SET AvailabilityDone = 1, BookerId = @p1
			WHERE CAST(Id AS VARCHAR(36)) = @p2
		`, bookieID, availabilityId)

		if err != nil {
			return fmt.Errorf("failed to update availability: %w", err)
		}

		// Create payment record
		_, err = tx.Exec(`
			INSERT INTO Payments (BookingRequestID, IsPaid, PaidDate, CreatedBy, IsDeleted)
			VALUES (@p1, 0, NULL, @p2, 0)
		`, bookingRequestID, bookieID)

		if err != nil {
			return fmt.Errorf("failed to create payment: %w", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
