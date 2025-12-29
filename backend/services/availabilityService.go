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
		var createdDateStr string

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
			&createdDateStr,
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

		if bookerId.Valid {
			bookerIdInt := int(bookerId.Int64)
			availability.BookerId = &bookerIdInt
		}

		// Parse created date - SQL Server returns datetime as string
		availability.CreatedDate, err = time.Parse("2006-01-02 15:04:05.0000000", createdDateStr)
		if err != nil {
			// Try alternative formats
			availability.CreatedDate, err = time.Parse("2006-01-02T15:04:05Z", createdDateStr)
			if err != nil {
				availability.CreatedDate, err = time.Parse("2006-01-02 15:04:05", createdDateStr)
				if err != nil {
					return nil, fmt.Errorf("failed to parse created date: %w", err)
				}
			}
		}

		availabilities = append(availabilities, availability)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return availabilities, nil
}

func DeleteArenaAvailability(availabilityId string, ownerId int) error {
	// Verify ownership
	var count int
	err := config.DB.QueryRow(`
		SELECT COUNT(*) 
		FROM ArenaAvailability 
		WHERE Id = @p1 AND OwnerId = @p2 AND IsDeleted = 0
	`, availabilityId, ownerId).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to verify ownership: %w", err)
	}

	if count == 0 {
		return errors.New("availability not found or you don't own it")
	}

	// Soft delete
	_, err = config.DB.Exec(`
		UPDATE ArenaAvailability 
		SET IsDeleted = 1 
		WHERE Id = @p1
	`, availabilityId)
	if err != nil {
		return fmt.Errorf("failed to delete availability: %w", err)
	}

	return nil
}
