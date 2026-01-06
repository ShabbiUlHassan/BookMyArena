package services

import (
	"BookMyArena/backend/config"
	"BookMyArena/backend/models"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func VerifyPassword(hashedPassword, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

func CreateUser(req models.SignupRequest) (*models.User, error) {
	
	var count int
	err := config.DB.QueryRow("SELECT COUNT(*) FROM Users WHERE Email = @p1", req.Email).Scan(&count)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, errors.New("email already exists")
	}

	if req.Role != "Owner" && req.Role != "User" {
		return nil, errors.New("invalid role. Must be 'Owner' or 'User'")
	}

	passwordHash, err := HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	result := config.DB.QueryRow(
		"INSERT INTO Users (FullName, Email, PasswordHash, Role) OUTPUT INSERTED.UserId, INSERTED.FullName, INSERTED.Email, INSERTED.Role, INSERTED.CreatedAt VALUES (@p1, @p2, @p3, @p4)",
		req.FullName, req.Email, passwordHash, req.Role,
	)

	user := &models.User{}
	err = result.Scan(&user.UserID, &user.FullName, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func AuthenticateUser(email, password string) (*models.User, error) {
	user := &models.User{}
	err := config.DB.QueryRow(
		"SELECT UserId, FullName, Email, PasswordHash, Role, CreatedAt FROM Users WHERE Email = @p1",
		email,
	).Scan(&user.UserID, &user.FullName, &user.Email, &user.PasswordHash, &user.Role, &user.CreatedAt)

	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	if !VerifyPassword(user.PasswordHash, password) {
		return nil, errors.New("invalid email or password")
	}

	return user, nil
}

func GenerateSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func CreateSession(userID int) (string, error) {
	token, err := GenerateSessionToken()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(24 * time.Hour)

	_, err = config.DB.Exec(
		"INSERT INTO Sessions (UserId, Token, ExpiresAt) VALUES (@p1, @p2, @p3)",
		userID, token, expiresAt,
	)
	if err != nil {
		return "", err
	}

	return token, nil
}

func ValidateSession(token string) (*models.User, error) {
	var userID int
	var expiresAt time.Time

	err := config.DB.QueryRow(
		"SELECT UserId, ExpiresAt FROM Sessions WHERE Token = @p1",
		token,
	).Scan(&userID, &expiresAt)

	if err != nil {
		return nil, errors.New("invalid session")
	}

	if time.Now().After(expiresAt) {
		
		config.DB.Exec("DELETE FROM Sessions WHERE Token = @p1", token)
		return nil, errors.New("session expired")
	}

	user := &models.User{}
	err = config.DB.QueryRow(
		"SELECT UserId, FullName, Email, PasswordHash, Role, CreatedAt FROM Users WHERE UserId = @p1",
		userID,
	).Scan(&user.UserID, &user.FullName, &user.Email, &user.PasswordHash, &user.Role, &user.CreatedAt)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func DeleteSession(token string) error {
	_, err := config.DB.Exec("DELETE FROM Sessions WHERE Token = @p1", token)
	return err
}

func CleanExpiredSessions() {
	config.DB.Exec("DELETE FROM Sessions WHERE ExpiresAt < GETDATE()")
}

