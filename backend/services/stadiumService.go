package services

import (
	"BookMyArena/backend/config"
	"BookMyArena/backend/models"
	"errors"
)

func CreateStadium(ownerID int, req models.CreateStadiumRequest) (*models.Stadium, error) {
	result := config.DB.QueryRow(
		"INSERT INTO Stadiums (OwnerId, Name, Location) OUTPUT INSERTED.StadiumId, INSERTED.OwnerId, INSERTED.Name, INSERTED.Location, INSERTED.CreatedAt VALUES (@p1, @p2, @p3)",
		ownerID, req.Name, req.Location,
	)

	stadium := &models.Stadium{}
	err := result.Scan(&stadium.StadiumID, &stadium.OwnerID, &stadium.Name, &stadium.Location, &stadium.CreatedAt)
	if err != nil {
		return nil, err
	}

	return stadium, nil
}

func GetStadiumsByOwner(ownerID int) ([]models.Stadium, error) {
	rows, err := config.DB.Query(
		"SELECT StadiumId, OwnerId, Name, Location, CreatedAt FROM Stadiums WHERE OwnerId = @p1 ORDER BY CreatedAt DESC",
		ownerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stadiums []models.Stadium
	for rows.Next() {
		var stadium models.Stadium
		err := rows.Scan(&stadium.StadiumID, &stadium.OwnerID, &stadium.Name, &stadium.Location, &stadium.CreatedAt)
		if err != nil {
			return nil, err
		}
		stadiums = append(stadiums, stadium)
	}

	return stadiums, nil
}

func GetStadiumByID(stadiumID int) (*models.Stadium, error) {
	stadium := &models.Stadium{}
	err := config.DB.QueryRow(
		"SELECT StadiumId, OwnerId, Name, Location, CreatedAt FROM Stadiums WHERE StadiumId = @p1",
		stadiumID,
	).Scan(&stadium.StadiumID, &stadium.OwnerID, &stadium.Name, &stadium.Location, &stadium.CreatedAt)

	if err != nil {
		return nil, errors.New("stadium not found")
	}

	return stadium, nil
}

func GetAllStadiums() ([]models.Stadium, error) {
	rows, err := config.DB.Query(
		"SELECT StadiumId, OwnerId, Name, Location, CreatedAt FROM Stadiums ORDER BY CreatedAt DESC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stadiums []models.Stadium
	for rows.Next() {
		var stadium models.Stadium
		err := rows.Scan(&stadium.StadiumID, &stadium.OwnerID, &stadium.Name, &stadium.Location, &stadium.CreatedAt)
		if err != nil {
			return nil, err
		}
		stadiums = append(stadiums, stadium)
	}

	return stadiums, nil
}

func VerifyStadiumOwner(stadiumID, ownerID int) bool {
	var count int
	err := config.DB.QueryRow(
		"SELECT COUNT(*) FROM Stadiums WHERE StadiumId = @p1 AND OwnerId = @p2",
		stadiumID, ownerID,
	).Scan(&count)
	return err == nil && count > 0
}

