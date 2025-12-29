package services

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"BookMyArena/backend/config"
	"BookMyArena/backend/models"
)

func CreateArenaAvailabilities(req models.CreateAvailabilityRequest, ownerId int) error {
	// Begin transaction
	tx, err := config.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Verify arena ownership
	var stadiumId int
	err = tx.QueryRow(`
		SELECT StadiumId 
		FROM Arenas 
		WHERE ArenaId = @p1 AND StadiumId IN (
			SELECT StadiumId FROM Stadiums WHERE OwnerId = @p2
		)
	`, req.ArenaId, ownerId).Scan(&stadiumId)
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("arena not found or you don't own this arena")
		}
		return fmt.Errorf("failed to verify arena ownership: %w", err)
	}

	// Validate maximum 10 records
	if len(req.Availabilities) > 10 {
		return errors.New("maximum 10 availability records allowed per request")
	}

	if len(req.Availabilities) == 0 {
		return errors.New("at least one availability slot is required")
	}

	// Validate and insert each availability slot
	for _, slot := range req.Availabilities {
		// Parse times
		startTime, err := time.Parse("15:04", slot.StartTime)
		if err != nil {
			return fmt.Errorf("invalid start time format: %s", slot.StartTime)
		}

		endTime, err := time.Parse("15:04", slot.EndTime)
		if err != nil {
			return fmt.Errorf("invalid end time format: %s", slot.EndTime)
		}

		// Validate start time is before end time
		if !startTime.Before(endTime) {
			return errors.New("start time must be earlier than end time")
		}

		// Parse date
		date, err := time.Parse("2006-01-02", slot.Date)
		if err != nil {
			return fmt.Errorf("invalid date format: %s", slot.Date)
		}

		// Check for overlapping time slots on the same date
		var overlapCount int
		err = tx.QueryRow(`
			SELECT COUNT(*) 
			FROM ArenaAvailability 
			WHERE ArenaId = @p1 
			AND Date = @p2 
			AND IsDeleted = 0
			AND (
				(StartTime <= @p3 AND EndTime > @p3) OR
				(StartTime < @p4 AND EndTime >= @p4) OR
				(StartTime >= @p3 AND EndTime <= @p4)
			)
		`, req.ArenaId, date.Format("2006-01-02"), slot.StartTime, slot.EndTime).Scan(&overlapCount)
		if err != nil {
			return fmt.Errorf("failed to check overlapping slots: %w", err)
		}

		if overlapCount > 0 {
			return fmt.Errorf("overlapping time slot detected for date %s", slot.Date)
		}

		// Insert availability record
		// Note: Id is auto-generated (NEWID()), so we don't include it
		_, err = tx.Exec(`
			INSERT INTO ArenaAvailability (
				Date, StartTime, EndTime, StadiumId, ArenaId, 
				BookerId, AvailabilityDone, OwnerId, CreatedDate, CreatedBy, IsDeleted
			) VALUES (
				@p1, @p2, @p3, @p4, @p5, 
				NULL, 0, @p6, GETDATE(), @p7, 0
			)
		`, date.Format("2006-01-02"), slot.StartTime, slot.EndTime, stadiumId, req.ArenaId, ownerId, ownerId)
		if err != nil {
			return fmt.Errorf("failed to insert availability: %w", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func GetArenaAvailabilities(arenaId int) ([]models.ArenaAvailability, error) {
	query := `
		SELECT 
			Id, Date, StartTime, EndTime, StadiumId, ArenaId, 
			BookerId, AvailabilityDone, OwnerId, CreatedDate, CreatedBy, IsDeleted
		FROM ArenaAvailability
		WHERE ArenaId = @p1 AND IsDeleted = 0
		ORDER BY Date, StartTime
	`

	rows, err := config.DB.Query(query, arenaId)
	if err != nil {
		return nil, fmt.Errorf("failed to query availabilities: %w", err)
	}
	defer rows.Close()

	var availabilities []models.ArenaAvailability
	for rows.Next() {
		var availability models.ArenaAvailability
		var dateStr string
		var startTimeStr, endTimeStr string
		var bookerId sql.NullInt64
		var createdDate time.Time

		err := rows.Scan(
			&availability.Id,
			&dateStr,
			&startTimeStr,
			&endTimeStr,
			&availability.StadiumId,
			&availability.ArenaId,
			&bookerId,
			&availability.AvailabilityDone,
			&availability.OwnerId,
			&createdDate,
			&availability.CreatedBy,
			&availability.IsDeleted,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan availability: %w", err)
		}

		// Parse date
		availability.Date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse date: %w", err)
		}

		availability.StartTime = startTimeStr
		availability.EndTime = endTimeStr
		availability.CreatedDate = createdDate

		if bookerId.Valid {
			bookerIdInt := int(bookerId.Int64)
			availability.BookerId = &bookerIdInt
		}

		availabilities = append(availabilities, availability)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return availabilities, nil
}

// getOrderByColumn maps frontend sort column names to actual SQL column/expression
func getOrderByColumn(sortColumn string) string {
	columnMap := map[string]string{
		"Date":        "aa.Date",
		"StartTime":   "aa.StartTime",
		"EndTime":     "aa.EndTime",
		"StadiumName": "s.Name",
		"ArenaName":   "a.Name",
		"BookerName":  "u.FullName",
		"CreatedDate": "aa.CreatedDate",
	}

	if mapped, ok := columnMap[sortColumn]; ok {
		return mapped
	}
	return "aa.CreatedDate" // default
}

func GetOwnerAvailabilitiesPaginated(params models.AvailabilitySearchParams) (*models.PaginatedAvailabilities, error) {
	// Validate and set sort column (whitelist to prevent SQL injection)
	sortColumn := params.SortColumn
	validSortColumns := map[string]bool{
		"Date": true, "StartTime": true, "EndTime": true,
		"StadiumName": true, "ArenaName": true, "BookerName": true, "CreatedDate": true,
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
			FROM ArenaAvailability aa
			INNER JOIN Stadiums s ON aa.StadiumId = s.StadiumId
			INNER JOIN Arenas a ON aa.ArenaId = a.ArenaId
			LEFT JOIN Users u ON aa.BookerId = u.UserId
			WHERE aa.OwnerId = @p1 
			AND aa.IsDeleted = 0
			AND (
				CONVERT(VARCHAR, aa.Date, 120) LIKE @p2 OR
				CAST(aa.StartTime AS VARCHAR) LIKE @p2 OR
				CAST(aa.EndTime AS VARCHAR) LIKE @p2 OR
				s.Name LIKE @p2 OR
				a.Name LIKE @p2 OR
				ISNULL(u.FullName, '') LIKE @p2 OR
				CONVERT(VARCHAR, aa.CreatedDate, 120) LIKE @p2
			)
		`
		countArgs = []interface{}{params.OwnerId, searchPattern}

		// Map sort column to actual SQL column/expression
		orderByColumn := getOrderByColumn(sortColumn)
		query = fmt.Sprintf(`
			SELECT 
				CAST(aa.Id AS VARCHAR(36)) AS Id,
				CONVERT(VARCHAR, aa.Date, 120) AS Date,
				CAST(aa.StartTime AS VARCHAR) AS StartTime,
				CAST(aa.EndTime AS VARCHAR) AS EndTime,
				DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
				s.Name AS StadiumName,
				a.Name AS ArenaName,
				u.FullName AS BookerName,
				aa.AvailabilityDone AS Reserved,
				CONVERT(VARCHAR, aa.CreatedDate, 120) AS CreatedDate,
				aa.StadiumId,
				aa.ArenaId
			FROM ArenaAvailability aa
			INNER JOIN Stadiums s ON aa.StadiumId = s.StadiumId
			INNER JOIN Arenas a ON aa.ArenaId = a.ArenaId
			LEFT JOIN Users u ON aa.BookerId = u.UserId
			WHERE aa.OwnerId = @p1 
			AND aa.IsDeleted = 0
			AND (
				CONVERT(VARCHAR, aa.Date, 120) LIKE @p2 OR
				CAST(aa.StartTime AS VARCHAR) LIKE @p2 OR
				CAST(aa.EndTime AS VARCHAR) LIKE @p2 OR
				s.Name LIKE @p2 OR
				a.Name LIKE @p2 OR
				ISNULL(u.FullName, '') LIKE @p2 OR
				CONVERT(VARCHAR, aa.CreatedDate, 120) LIKE @p2
			)
			ORDER BY %s %s 
			OFFSET @p3 ROWS FETCH NEXT @p4 ROWS ONLY
		`, orderByColumn, sortDirection)
		queryArgs = []interface{}{params.OwnerId, searchPattern, offset, params.PageSize}
	} else {
		countQuery = `
			SELECT COUNT(*) 
			FROM ArenaAvailability aa
			WHERE aa.OwnerId = @p1 AND aa.IsDeleted = 0
		`
		countArgs = []interface{}{params.OwnerId}

		// Map sort column to actual SQL column/expression
		orderByColumn := getOrderByColumn(sortColumn)
		query = fmt.Sprintf(`
			SELECT 
				CAST(aa.Id AS VARCHAR(36)) AS Id,
				CONVERT(VARCHAR, aa.Date, 120) AS Date,
				CAST(aa.StartTime AS VARCHAR) AS StartTime,
				CAST(aa.EndTime AS VARCHAR) AS EndTime,
				DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
				s.Name AS StadiumName,
				a.Name AS ArenaName,
				u.FullName AS BookerName,
				aa.AvailabilityDone AS Reserved,
				CONVERT(VARCHAR, aa.CreatedDate, 120) AS CreatedDate,
				aa.StadiumId,
				aa.ArenaId
			FROM ArenaAvailability aa
			INNER JOIN Stadiums s ON aa.StadiumId = s.StadiumId
			INNER JOIN Arenas a ON aa.ArenaId = a.ArenaId
			LEFT JOIN Users u ON aa.BookerId = u.UserId
			WHERE aa.OwnerId = @p1 AND aa.IsDeleted = 0
			ORDER BY %s %s 
			OFFSET @p2 ROWS FETCH NEXT @p3 ROWS ONLY
		`, orderByColumn, sortDirection)
		queryArgs = []interface{}{params.OwnerId, offset, params.PageSize}
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
		return nil, fmt.Errorf("failed to query availabilities: %w", err)
	}
	defer rows.Close()

	var availabilities []models.AvailabilityWithDetails
	for rows.Next() {
		var availability models.AvailabilityWithDetails
		var bookerName sql.NullString

		err := rows.Scan(
			&availability.Id,
			&availability.Date,
			&availability.StartTime,
			&availability.EndTime,
			&availability.TotalDuration,
			&availability.StadiumName,
			&availability.ArenaName,
			&bookerName,
			&availability.Reserved,
			&availability.CreatedDate,
			&availability.StadiumId,
			&availability.ArenaId,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan availability: %w", err)
		}

		if bookerName.Valid {
			availability.BookerName = &bookerName.String
		}

		availabilities = append(availabilities, availability)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return &models.PaginatedAvailabilities{
		Availabilities: availabilities,
		TotalCount:     totalCount,
		TotalPages:     totalPages,
		PageNumber:     params.PageNumber,
		PageSize:       params.PageSize,
	}, nil
}

func DeleteArenaAvailability(availabilityId string, ownerId int) error {
	// Verify ownership and check if reserved
	// Note: Id is UNIQUEIDENTIFIER in SQL Server, convert the column to VARCHAR for comparison
	var availabilityDone bool
	err := config.DB.QueryRow(`
		SELECT AvailabilityDone
		FROM ArenaAvailability 
		WHERE CAST(Id AS VARCHAR(36)) = @p1 AND OwnerId = @p2 AND IsDeleted = 0
	`, availabilityId, ownerId).Scan(&availabilityDone)
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("availability not found or you don't own it")
		}
		return fmt.Errorf("failed to verify ownership: %w", err)
	}

	// Check if reserved (AvailabilityDone = 1)
	if availabilityDone {
		return errors.New("cannot delete reserved availability")
	}

	// Soft delete - convert the UNIQUEIDENTIFIER column to VARCHAR for comparison
	_, err = config.DB.Exec(`
		UPDATE ArenaAvailability 
		SET IsDeleted = 1 
		WHERE CAST(Id AS VARCHAR(36)) = @p1
	`, availabilityId)
	if err != nil {
		return fmt.Errorf("failed to delete availability: %w", err)
	}

	return nil
}
