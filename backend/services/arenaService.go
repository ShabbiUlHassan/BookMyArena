package services

import (
	"BookMyArena/backend/config"
	"BookMyArena/backend/models"
	"errors"
	"fmt"
	"time"
)

func CreateArena(stadiumID int, req models.CreateArenaRequest) (*models.Arena, error) {
	// Verify stadium exists
	var exists int
	err := config.DB.QueryRow("SELECT COUNT(*) FROM Stadiums WHERE StadiumId = @p1", stadiumID).Scan(&exists)
	if err != nil || exists == 0 {
		return nil, errors.New("stadium not found")
	}

	// Verify stadium ownership if needed (can be done via middleware)
	if req.StadiumID != stadiumID {
		return nil, errors.New("stadium ID mismatch")
	}

	result := config.DB.QueryRow(
		"INSERT INTO Arenas (StadiumId, Name, SportType, Capacity, SlotDuration, Price) OUTPUT INSERTED.ArenaId, INSERTED.StadiumId, INSERTED.Name, INSERTED.SportType, INSERTED.Capacity, INSERTED.SlotDuration, INSERTED.Price, INSERTED.CreatedAt VALUES (@p1, @p2, @p3, @p4, @p5, @p6)",
		req.StadiumID, req.Name, req.SportType, req.Capacity, req.SlotDuration, req.Price,
	)

	arena := &models.Arena{}
	err = result.Scan(&arena.ArenaID, &arena.StadiumID, &arena.Name, &arena.SportType, &arena.Capacity, &arena.SlotDuration, &arena.Price, &arena.CreatedAt)
	if err != nil {
		return nil, err
	}

	return arena, nil
}

func GetArenaByID(arenaID int) (*models.Arena, error) {
	arena := &models.Arena{}
	err := config.DB.QueryRow(
		"SELECT ArenaId, StadiumId, Name, SportType, Capacity, SlotDuration, Price, CreatedAt FROM Arenas WHERE ArenaId = @p1",
		arenaID,
	).Scan(&arena.ArenaID, &arena.StadiumID, &arena.Name, &arena.SportType, &arena.Capacity, &arena.SlotDuration, &arena.Price, &arena.CreatedAt)

	if err != nil {
		return nil, errors.New("arena not found")
	}

	return arena, nil
}

func GetArenasByStadium(stadiumID int) ([]models.Arena, error) {
	rows, err := config.DB.Query(
		"SELECT ArenaId, StadiumId, Name, SportType, Capacity, SlotDuration, Price, CreatedAt FROM Arenas WHERE StadiumId = @p1 ORDER BY CreatedAt DESC",
		stadiumID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var arenas []models.Arena
	for rows.Next() {
		var arena models.Arena
		err := rows.Scan(&arena.ArenaID, &arena.StadiumID, &arena.Name, &arena.SportType, &arena.Capacity, &arena.SlotDuration, &arena.Price, &arena.CreatedAt)
		if err != nil {
			return nil, err
		}
		arenas = append(arenas, arena)
	}

	return arenas, nil
}

func GetArenasByStadiumPaginated(params models.ArenaSearchParams) (*models.PaginatedArenas, error) {
	// Validate and set sort column (whitelist to prevent SQL injection)
	sortColumn := params.SortColumn
	validSortColumns := map[string]bool{
		"Name": true, "SportType": true, "Capacity": true,
		"SlotDuration": true, "Price": true, "CreatedAt": true,
	}
	if !validSortColumns[sortColumn] {
		sortColumn = "CreatedAt"
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

	// Calculate pagination first
	offset := (params.PageNumber - 1) * params.PageSize

	// Build WHERE clause for count and main query
	var countQuery string
	var query string
	var countArgs []interface{}
	var queryArgs []interface{}

	if params.SearchText != "" {
		searchPattern := "%" + params.SearchText + "%"
		countQuery = "SELECT COUNT(*) FROM Arenas WHERE StadiumId = @p1 AND (Name LIKE @p2 OR SportType LIKE @p2)"
		countArgs = []interface{}{params.StadiumID, searchPattern}

		query = fmt.Sprintf("SELECT ArenaId, StadiumId, Name, SportType, Capacity, SlotDuration, Price, CreatedAt FROM Arenas WHERE StadiumId = @p1 AND (Name LIKE @p2 OR SportType LIKE @p2) ORDER BY %s %s OFFSET @p3 ROWS FETCH NEXT @p4 ROWS ONLY", sortColumn, sortDirection)
		queryArgs = []interface{}{params.StadiumID, searchPattern, offset, params.PageSize}
	} else {
		countQuery = "SELECT COUNT(*) FROM Arenas WHERE StadiumId = @p1"
		countArgs = []interface{}{params.StadiumID}

		query = fmt.Sprintf("SELECT ArenaId, StadiumId, Name, SportType, Capacity, SlotDuration, Price, CreatedAt FROM Arenas WHERE StadiumId = @p1 ORDER BY %s %s OFFSET @p2 ROWS FETCH NEXT @p3 ROWS ONLY", sortColumn, sortDirection)
		queryArgs = []interface{}{params.StadiumID, offset, params.PageSize}
	}

	// Get total count
	var totalCount int
	err := config.DB.QueryRow(countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		return nil, err
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
		return nil, err
	}
	defer rows.Close()

	var arenas []models.Arena
	for rows.Next() {
		var arena models.Arena
		err := rows.Scan(&arena.ArenaID, &arena.StadiumID, &arena.Name, &arena.SportType, &arena.Capacity, &arena.SlotDuration, &arena.Price, &arena.CreatedAt)
		if err != nil {
			return nil, err
		}
		arenas = append(arenas, arena)
	}

	result := &models.PaginatedArenas{
		Arenas:     arenas,
		TotalCount: totalCount,
		PageNumber: params.PageNumber,
		PageSize:   params.PageSize,
		TotalPages: totalPages,
	}

	return result, nil
}

func GetAllArenas() ([]models.Arena, error) {
	rows, err := config.DB.Query(
		"SELECT ArenaId, StadiumId, Name, SportType, Capacity, SlotDuration, Price, CreatedAt FROM Arenas ORDER BY CreatedAt DESC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var arenas []models.Arena
	for rows.Next() {
		var arena models.Arena
		err := rows.Scan(&arena.ArenaID, &arena.StadiumID, &arena.Name, &arena.SportType, &arena.Capacity, &arena.SlotDuration, &arena.Price, &arena.CreatedAt)
		if err != nil {
			return nil, err
		}
		arenas = append(arenas, arena)
	}

	return arenas, nil
}

func GetAllArenasWithLocation() ([]models.ArenaWithLocation, error) {
	query := `
		SELECT a.ArenaId, a.StadiumId, a.Name, a.SportType, a.Capacity, a.SlotDuration, a.Price, a.CreatedAt,
		       s.Name AS StadiumName, s.Location
		FROM Arenas a
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		ORDER BY a.CreatedAt DESC
	`

	rows, err := config.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var arenas []models.ArenaWithLocation
	for rows.Next() {
		var arena models.ArenaWithLocation
		err := rows.Scan(
			&arena.ArenaID, &arena.StadiumID, &arena.Name, &arena.SportType,
			&arena.Capacity, &arena.SlotDuration, &arena.Price, &arena.CreatedAt,
			&arena.StadiumName, &arena.Location,
		)
		if err != nil {
			return nil, err
		}
		arenas = append(arenas, arena)
	}

	return arenas, nil
}

func GetArenasByFilters(location, sportType string, date *time.Time) ([]models.Arena, error) {
	query := `
		SELECT a.ArenaId, a.StadiumId, a.Name, a.SportType, a.Capacity, a.SlotDuration, a.Price, a.CreatedAt
		FROM Arenas a
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		WHERE (@p1 = '' OR s.Location LIKE '%' + @p1 + '%')
		  AND (@p2 = '' OR a.SportType = @p2)
		ORDER BY a.CreatedAt DESC
	`

	rows, err := config.DB.Query(query, location, sportType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var arenas []models.Arena
	for rows.Next() {
		var arena models.Arena
		err := rows.Scan(&arena.ArenaID, &arena.StadiumID, &arena.Name, &arena.SportType, &arena.Capacity, &arena.SlotDuration, &arena.Price, &arena.CreatedAt)
		if err != nil {
			return nil, err
		}
		arenas = append(arenas, arena)
	}

	return arenas, nil
}

func GetArenasByFiltersWithLocation(location, sportType string, date *time.Time) ([]models.ArenaWithLocation, error) {
	query := `
		SELECT a.ArenaId, a.StadiumId, a.Name, a.SportType, a.Capacity, a.SlotDuration, a.Price, a.CreatedAt,
		       s.Name AS StadiumName, s.Location
		FROM Arenas a
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		WHERE (@p1 = '' OR s.Location LIKE '%' + @p1 + '%')
		  AND (@p2 = '' OR a.SportType = @p2)
		ORDER BY a.CreatedAt DESC
	`

	rows, err := config.DB.Query(query, location, sportType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var arenas []models.ArenaWithLocation
	for rows.Next() {
		var arena models.ArenaWithLocation
		err := rows.Scan(
			&arena.ArenaID, &arena.StadiumID, &arena.Name, &arena.SportType,
			&arena.Capacity, &arena.SlotDuration, &arena.Price, &arena.CreatedAt,
			&arena.StadiumName, &arena.Location,
		)
		if err != nil {
			return nil, err
		}
		arenas = append(arenas, arena)
	}

	return arenas, nil
}

func CheckSlotAvailability(arenaID int, slotStart, slotEnd time.Time) (bool, error) {
	var count int
	err := config.DB.QueryRow(
		`SELECT COUNT(*) FROM Bookings 
		 WHERE ArenaId = @p1 
		 AND Status IN ('Pending', 'Confirmed')
		 AND ((SlotStart < @p3 AND SlotEnd > @p2))`,
		arenaID, slotStart, slotEnd,
	).Scan(&count)

	if err != nil {
		return false, err
	}

	return count == 0, nil
}
