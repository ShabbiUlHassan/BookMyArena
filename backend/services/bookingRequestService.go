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
		       CAST(INSERTED.AvailabilityId AS VARCHAR(36))
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
