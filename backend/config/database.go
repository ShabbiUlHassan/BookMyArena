package config

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/microsoft/go-mssqldb"
)

var DB *sql.DB

func InitDB() {
	connectionString := os.Getenv("DB_CONNECTION_STRING")
	if connectionString == "" {

		connectionString = "server=localhost,1433;database=BookMyArena;trusted_connection=yes;encrypt=disable"
	}

	var err error
	DB, err = sql.Open("sqlserver", connectionString)
	if err != nil {
		log.Fatal("Error connecting to database:", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("Error pinging database:", err)
	}

	log.Println("Database connection established successfully")
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
