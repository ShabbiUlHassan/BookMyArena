package services

import (
	"BookMyArena/backend/config"
	"BookMyArena/backend/models"
	"errors"
	"time"
)

func CreateBooking(userID int, req models.CreateBookingRequest) (*models.Booking, error) {
	
	arena, err := GetArenaByID(req.ArenaID)
	if err != nil {
		return nil, errors.New("arena not found")
	}
	_ = arena 

	available, err := CheckSlotAvailability(req.ArenaID, req.SlotStart, req.SlotEnd)
	if err != nil {
		return nil, err
	}
	if !available {
		return nil, errors.New("slot is not available")
	}

	if req.SlotEnd.Before(req.SlotStart) || req.SlotEnd.Equal(req.SlotStart) {
		return nil, errors.New("invalid slot times")
	}

	result := config.DB.QueryRow(
		"INSERT INTO Bookings (UserId, ArenaId, SlotStart, SlotEnd, Status) OUTPUT INSERTED.BookingId, INSERTED.UserId, INSERTED.ArenaId, INSERTED.SlotStart, INSERTED.SlotEnd, INSERTED.Status, INSERTED.CreatedAt VALUES (@p1, @p2, @p3, @p4, @p5)",
		userID, req.ArenaID, req.SlotStart, req.SlotEnd, "Pending",
	)

	booking := &models.Booking{}
	err = result.Scan(&booking.BookingID, &booking.UserID, &booking.ArenaID, &booking.SlotStart, &booking.SlotEnd, &booking.Status, &booking.CreatedAt)
	if err != nil {
		return nil, err
	}

	return booking, nil
}

func GetBookingsByUser(userID int) ([]models.BookingWithDetails, error) {
	query := `
		SELECT b.BookingId, b.UserId, b.ArenaId, b.SlotStart, b.SlotEnd, b.Status, b.CreatedAt,
		       a.Name AS ArenaName, s.Name AS StadiumName, s.Location, a.SportType, a.Price
		FROM Bookings b
		INNER JOIN Arenas a ON b.ArenaId = a.ArenaId
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		WHERE b.UserId = @p1
		ORDER BY b.SlotStart DESC
	`

	rows, err := config.DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bookings []models.BookingWithDetails
	for rows.Next() {
		var booking models.BookingWithDetails
		err := rows.Scan(
			&booking.BookingID, &booking.UserID, &booking.ArenaID,
			&booking.SlotStart, &booking.SlotEnd, &booking.Status, &booking.CreatedAt,
			&booking.ArenaName, &booking.StadiumName, &booking.Location,
			&booking.SportType, &booking.Price,
		)
		if err != nil {
			return nil, err
		}
		bookings = append(bookings, booking)
	}

	return bookings, nil
}

func GetBookingsByArena(arenaID int) ([]models.Booking, error) {
	rows, err := config.DB.Query(
		"SELECT BookingId, UserId, ArenaId, SlotStart, SlotEnd, Status, CreatedAt FROM Bookings WHERE ArenaId = @p1 ORDER BY SlotStart DESC",
		arenaID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bookings []models.Booking
	for rows.Next() {
		var booking models.Booking
		err := rows.Scan(&booking.BookingID, &booking.UserID, &booking.ArenaID, &booking.SlotStart, &booking.SlotEnd, &booking.Status, &booking.CreatedAt)
		if err != nil {
			return nil, err
		}
		bookings = append(bookings, booking)
	}

	return bookings, nil
}

func GetBookingByID(bookingID int) (*models.Booking, error) {
	booking := &models.Booking{}
	err := config.DB.QueryRow(
		"SELECT BookingId, UserId, ArenaId, SlotStart, SlotEnd, Status, CreatedAt FROM Bookings WHERE BookingId = @p1",
		bookingID,
	).Scan(&booking.BookingID, &booking.UserID, &booking.ArenaID, &booking.SlotStart, &booking.SlotEnd, &booking.Status, &booking.CreatedAt)

	if err != nil {
		return nil, errors.New("booking not found")
	}

	return booking, nil
}

func CancelBooking(bookingID, userID int) error {
	
	booking, err := GetBookingByID(bookingID)
	if err != nil {
		return err
	}

	if booking.UserID != userID {
		return errors.New("unauthorized: booking does not belong to user")
	}

	if booking.Status == "Cancelled" {
		return errors.New("booking is already cancelled")
	}

	if booking.SlotStart.Before(time.Now()) {
		return errors.New("cannot cancel past bookings")
	}

	_, err = config.DB.Exec(
		"UPDATE Bookings SET Status = 'Cancelled' WHERE BookingId = @p1",
		bookingID,
	)

	return err
}

func UpdateBookingStatus(bookingID int, status string, ownerID int) error {
	
	if status != "Confirmed" && status != "Cancelled" {
		return errors.New("invalid status")
	}

	booking, err := GetBookingByID(bookingID)
	if err != nil {
		return err
	}

	arena, err := GetArenaByID(booking.ArenaID)
	if err != nil {
		return err
	}

	stadium, err := GetStadiumByID(arena.StadiumID)
	if err != nil {
		return err
	}

	if stadium.OwnerID != ownerID {
		return errors.New("unauthorized: you don't own this arena")
	}

	_, err = config.DB.Exec(
		"UPDATE Bookings SET Status = @p1 WHERE BookingId = @p2",
		status, bookingID,
	)

	return err
}

func GetOwnerBookings(ownerID int) ([]models.BookingWithDetails, error) {
	query := `
		SELECT b.BookingId, b.UserId, b.ArenaId, b.SlotStart, b.SlotEnd, b.Status, b.CreatedAt,
		       a.Name AS ArenaName, s.Name AS StadiumName, s.Location, a.SportType, a.Price
		FROM Bookings b
		INNER JOIN Arenas a ON b.ArenaId = a.ArenaId
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		WHERE s.OwnerId = @p1
		ORDER BY b.SlotStart DESC
	`

	rows, err := config.DB.Query(query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bookings []models.BookingWithDetails
	for rows.Next() {
		var booking models.BookingWithDetails
		err := rows.Scan(
			&booking.BookingID, &booking.UserID, &booking.ArenaID,
			&booking.SlotStart, &booking.SlotEnd, &booking.Status, &booking.CreatedAt,
			&booking.ArenaName, &booking.StadiumName, &booking.Location,
			&booking.SportType, &booking.Price,
		)
		if err != nil {
			return nil, err
		}
		bookings = append(bookings, booking)
	}

	return bookings, nil
}

