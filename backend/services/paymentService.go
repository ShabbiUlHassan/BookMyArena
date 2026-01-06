package services

import (
	"BookMyArena/backend/config"
	"BookMyArena/backend/models"
	"database/sql"
	"errors"
	"fmt"
)

func CreatePayment(bookingRequestID int, userID int) error {
	_, err := config.DB.Exec(`
		INSERT INTO Payments (BookingRequestID, IsPaid, PaidDate, CreatedBy, IsDeleted)
		VALUES (@p1, 0, NULL, @p2, 0)
	`, bookingRequestID, userID)
	
	if err != nil {
		return fmt.Errorf("failed to create payment: %w", err)
	}
	
	return nil
}

func getOrderByColumnForPayment(sortColumn string) string {
	columnMap := map[string]string{
		"StadiumName": "s.Name",
		"ArenaName":   "a.Name",
		"Date":        "aa.Date",
		"StartTime":   "aa.StartTime",
		"EndTime":     "aa.EndTime",
		"Price":       "br.Price",
	}

	if mapped, ok := columnMap[sortColumn]; ok {
		return mapped
	}
	return "aa.Date" 
}

func GetUserPaymentsPaginated(params models.PaymentSearchParams) (*models.PaginatedPayments, error) {
	
	sortColumn := params.SortColumn
	if sortColumn == "" {
		sortColumn = "Date"
	}
	validSortColumns := map[string]bool{
		"StadiumName": true, "ArenaName": true, "Date": true,
		"StartTime": true, "EndTime": true, "Price": true,
	}
	if !validSortColumns[sortColumn] {
		sortColumn = "Date"
	}

	sortDirection := params.SortDirection
	if sortDirection != "ASC" && sortDirection != "DESC" {
		sortDirection = "DESC"
	}

	if params.PageNumber < 1 {
		params.PageNumber = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 10
	}
	if params.PageSize > 100 {
		params.PageSize = 100
	}

	offset := (params.PageNumber - 1) * params.PageSize

	var whereConditions []string
	var countArgs []interface{}
	var queryArgs []interface{}
	paramIndex := 1

	whereConditions = append(whereConditions, "p.IsDeleted = 0")
	whereConditions = append(whereConditions, fmt.Sprintf("p.CreatedBy = @p%d", paramIndex))
	countArgs = append(countArgs, params.UserID)
	queryArgs = append(queryArgs, params.UserID)
	paramIndex++

	if params.IsPaid != nil {
		isPaidValue := 0
		if *params.IsPaid {
			isPaidValue = 1
		}
		whereConditions = append(whereConditions, fmt.Sprintf("p.IsPaid = @p%d", paramIndex))
		countArgs = append(countArgs, isPaidValue)
		queryArgs = append(queryArgs, isPaidValue)
		paramIndex++
	}

	if params.StartDate != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("aa.Date >= @p%d", paramIndex))
		countArgs = append(countArgs, params.StartDate)
		queryArgs = append(queryArgs, params.StartDate)
		paramIndex++
	}
	if params.EndDate != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("aa.Date <= @p%d", paramIndex))
		countArgs = append(countArgs, params.EndDate)
		queryArgs = append(queryArgs, params.EndDate)
		paramIndex++
	}

	if params.SearchText != "" {
		searchPattern := "%" + params.SearchText + "%"
		searchParamIndex := paramIndex
		whereConditions = append(whereConditions, fmt.Sprintf(`(
			s.Name LIKE @p%d OR
			a.Name LIKE @p%d OR
			CONVERT(VARCHAR, aa.Date, 120) LIKE @p%d OR
			CAST(aa.StartTime AS VARCHAR) LIKE @p%d OR
			CAST(aa.EndTime AS VARCHAR) LIKE @p%d OR
			CAST(br.Price AS VARCHAR) LIKE @p%d
		)`, searchParamIndex, searchParamIndex, searchParamIndex, searchParamIndex, searchParamIndex, searchParamIndex))
		countArgs = append(countArgs, searchPattern)
		queryArgs = append(queryArgs, searchPattern)
		paramIndex++
	}

	whereClause := "WHERE " + whereConditions[0]
	for i := 1; i < len(whereConditions); i++ {
		whereClause += " AND " + whereConditions[i]
	}

	countQuery := `
		SELECT COUNT(*) 
		FROM Payments p
		INNER JOIN BookingRequest br ON p.BookingRequestID = br.BookingRequestId
		INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
		INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		` + whereClause

	orderByColumn := getOrderByColumnForPayment(sortColumn)

	query := fmt.Sprintf(`
		SELECT 
			p.PaymentID,
			s.Name AS StadiumName,
			a.Name AS ArenaName,
			CONVERT(VARCHAR, aa.Date, 120) AS Date,
			CAST(aa.StartTime AS VARCHAR) AS StartTime,
			CAST(aa.EndTime AS VARCHAR) AS EndTime,
			DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
			br.Price AS Price,
			p.IsPaid AS IsPaid
		FROM Payments p
		INNER JOIN BookingRequest br ON p.BookingRequestID = br.BookingRequestId
		INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
		INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		%s
		ORDER BY %s %s 
		OFFSET @p%d ROWS FETCH NEXT @p%d ROWS ONLY
	`, whereClause, orderByColumn, sortDirection, paramIndex, paramIndex+1)

	queryArgs = append(queryArgs, offset, params.PageSize)

	var totalCount int
	err := config.DB.QueryRow(countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	totalPages := (totalCount + params.PageSize - 1) / params.PageSize
	if params.PageNumber > totalPages && totalPages > 0 {
		params.PageNumber = totalPages
		
		offset = (params.PageNumber - 1) * params.PageSize
		queryArgs[len(queryArgs)-2] = offset
	}

	rows, err := config.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to query payments: %w", err)
	}
	defer rows.Close()

	var payments []models.PaymentWithDetails
	var totalPrice float64 = 0

	for rows.Next() {
		var payment models.PaymentWithDetails
		var isPaidBool bool

		err := rows.Scan(
			&payment.PaymentID,
			&payment.StadiumName,
			&payment.ArenaName,
			&payment.Date,
			&payment.StartTime,
			&payment.EndTime,
			&payment.TotalDuration,
			&payment.Price,
			&isPaidBool,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}

		payment.IsPaid = isPaidBool
		totalPrice += payment.Price
		payments = append(payments, payment)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	result := &models.PaginatedPayments{
		Payments:   payments,
		TotalCount: totalCount,
		TotalPages: totalPages,
		PageNumber: params.PageNumber,
		PageSize:   params.PageSize,
	}

	if params.IsPaid != nil {
		if *params.IsPaid {
			result.TotalPaid = totalPrice
		} else {
			result.TotalPayable = totalPrice
		}
	}

	return result, nil
}

func ProcessPayment(paymentID int, userID int) error {
	
	var createdBy int
	var isPaid bool
	err := config.DB.QueryRow(`
		SELECT CreatedBy, IsPaid 
		FROM Payments 
		WHERE PaymentID = @p1 AND IsDeleted = 0
	`, paymentID).Scan(&createdBy, &isPaid)

	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("payment not found")
		}
		return fmt.Errorf("failed to verify payment: %w", err)
	}

	if createdBy != userID {
		return errors.New("you don't have permission to process this payment")
	}

	if isPaid {
		return errors.New("payment is already processed")
	}

	_, err = config.DB.Exec(`
		UPDATE Payments 
		SET IsPaid = 1, PaidDate = GETDATE()
		WHERE PaymentID = @p1
	`, paymentID)

	if err != nil {
		return fmt.Errorf("failed to process payment: %w", err)
	}

	return nil
}

func getOrderByColumnForOwnerPayment(sortColumn string) string {
	columnMap := map[string]string{
		"StadiumName": "s.Name",
		"ArenaName":   "a.Name",
		"Date":        "aa.Date",
		"StartTime":   "aa.StartTime",
		"EndTime":     "aa.EndTime",
		"Price":       "br.Price",
		"BookerName":  "u.FullName",
		"BookerEmail": "u.Email",
	}

	if mapped, ok := columnMap[sortColumn]; ok {
		return mapped
	}
	return "aa.Date" 
}

func GetOwnerPaymentsPaginated(params models.OwnerPaymentSearchParams) (*models.PaginatedOwnerPayments, error) {
	
	sortColumn := params.SortColumn
	if sortColumn == "" {
		sortColumn = "Date"
	}
	validSortColumns := map[string]bool{
		"StadiumName": true, "ArenaName": true, "Date": true,
		"StartTime": true, "EndTime": true, "Price": true,
		"BookerName": true, "BookerEmail": true,
	}
	if !validSortColumns[sortColumn] {
		sortColumn = "Date"
	}

	sortDirection := params.SortDirection
	if sortDirection != "ASC" && sortDirection != "DESC" {
		sortDirection = "DESC"
	}

	if params.PageNumber < 1 {
		params.PageNumber = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 10
	}
	if params.PageSize > 100 {
		params.PageSize = 100
	}

	offset := (params.PageNumber - 1) * params.PageSize

	var whereConditions []string
	var countArgs []interface{}
	var queryArgs []interface{}
	paramIndex := 1

	whereConditions = append(whereConditions, "p.IsDeleted = 0")
	whereConditions = append(whereConditions, fmt.Sprintf("s.OwnerId = @p%d", paramIndex))
	countArgs = append(countArgs, params.OwnerID)
	queryArgs = append(queryArgs, params.OwnerID)
	paramIndex++

	if params.IsPaid != nil {
		isPaidValue := 0
		if *params.IsPaid {
			isPaidValue = 1
		}
		whereConditions = append(whereConditions, fmt.Sprintf("p.IsPaid = @p%d", paramIndex))
		countArgs = append(countArgs, isPaidValue)
		queryArgs = append(queryArgs, isPaidValue)
		paramIndex++
	}

	if params.StartDate != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("aa.Date >= @p%d", paramIndex))
		countArgs = append(countArgs, params.StartDate)
		queryArgs = append(queryArgs, params.StartDate)
		paramIndex++
	}
	if params.EndDate != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("aa.Date <= @p%d", paramIndex))
		countArgs = append(countArgs, params.EndDate)
		queryArgs = append(queryArgs, params.EndDate)
		paramIndex++
	}

	if params.SearchText != "" {
		searchPattern := "%" + params.SearchText + "%"
		searchParamIndex := paramIndex
		whereConditions = append(whereConditions, fmt.Sprintf(`(
			s.Name LIKE @p%d OR
			a.Name LIKE @p%d OR
			CONVERT(VARCHAR, aa.Date, 120) LIKE @p%d OR
			CAST(aa.StartTime AS VARCHAR) LIKE @p%d OR
			CAST(aa.EndTime AS VARCHAR) LIKE @p%d OR
			CAST(br.Price AS VARCHAR) LIKE @p%d OR
			u.FullName LIKE @p%d OR
			u.Email LIKE @p%d
		)`, searchParamIndex, searchParamIndex, searchParamIndex, searchParamIndex, searchParamIndex, searchParamIndex, searchParamIndex, searchParamIndex))
		countArgs = append(countArgs, searchPattern)
		queryArgs = append(queryArgs, searchPattern)
		paramIndex++
	}

	whereClause := "WHERE " + whereConditions[0]
	for i := 1; i < len(whereConditions); i++ {
		whereClause += " AND " + whereConditions[i]
	}

	countQuery := `
		SELECT COUNT(*) 
		FROM Payments p
		INNER JOIN BookingRequest br ON p.BookingRequestID = br.BookingRequestId
		INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
		INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		INNER JOIN Users u ON br.CreatedBy = u.UserId
		` + whereClause

	orderByColumn := getOrderByColumnForOwnerPayment(sortColumn)

	query := fmt.Sprintf(`
		SELECT 
			p.PaymentID,
			s.Name AS StadiumName,
			a.Name AS ArenaName,
			CONVERT(VARCHAR, aa.Date, 120) AS Date,
			CAST(aa.StartTime AS VARCHAR) AS StartTime,
			CAST(aa.EndTime AS VARCHAR) AS EndTime,
			DATEDIFF(MINUTE, aa.StartTime, aa.EndTime) AS TotalDuration,
			br.Price AS Price,
			p.IsPaid AS IsPaid,
			u.FullName AS BookerName,
			u.Email AS BookerEmail
		FROM Payments p
		INNER JOIN BookingRequest br ON p.BookingRequestID = br.BookingRequestId
		INNER JOIN ArenaAvailability aa ON br.AvailabilityId = aa.Id
		INNER JOIN Arenas a ON br.ArenaID = a.ArenaId
		INNER JOIN Stadiums s ON a.StadiumId = s.StadiumId
		INNER JOIN Users u ON br.CreatedBy = u.UserId
		%s
		ORDER BY %s %s 
		OFFSET @p%d ROWS FETCH NEXT @p%d ROWS ONLY
	`, whereClause, orderByColumn, sortDirection, paramIndex, paramIndex+1)

	queryArgs = append(queryArgs, offset, params.PageSize)

	var totalCount int
	err := config.DB.QueryRow(countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	totalPages := (totalCount + params.PageSize - 1) / params.PageSize
	if params.PageNumber > totalPages && totalPages > 0 {
		params.PageNumber = totalPages
		
		offset = (params.PageNumber - 1) * params.PageSize
		queryArgs[len(queryArgs)-2] = offset
	}

	rows, err := config.DB.Query(query, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to query payments: %w", err)
	}
	defer rows.Close()

	var payments []models.PaymentWithOwnerDetails
	var totalPrice float64 = 0

	for rows.Next() {
		var payment models.PaymentWithOwnerDetails
		var isPaidBool bool

		err := rows.Scan(
			&payment.PaymentID,
			&payment.StadiumName,
			&payment.ArenaName,
			&payment.Date,
			&payment.StartTime,
			&payment.EndTime,
			&payment.TotalDuration,
			&payment.Price,
			&isPaidBool,
			&payment.BookerName,
			&payment.BookerEmail,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}

		payment.IsPaid = isPaidBool
		totalPrice += payment.Price
		payments = append(payments, payment)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	result := &models.PaginatedOwnerPayments{
		Payments:   payments,
		TotalCount: totalCount,
		TotalPages: totalPages,
		PageNumber: params.PageNumber,
		PageSize:   params.PageSize,
	}

	if params.IsPaid != nil {
		if *params.IsPaid {
			result.TotalReceived = totalPrice
		} else {
			result.TotalPending = totalPrice
		}
	}

	return result, nil
}
