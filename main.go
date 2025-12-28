package main

import (
	"BookMyArena/backend/config"
	"BookMyArena/backend/routes"
	"BookMyArena/backend/services"
	"log"
	"net/http"
	"time"
)

func main() {
	// Initialize database
	config.InitDB()
	defer config.CloseDB()

	// Clean expired sessions periodically
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			services.CleanExpiredSessions()
		}
	}()

	// Setup routes
	router := routes.SetupRoutes()

	// Start server
	port := ":8080"
	log.Printf("Server starting on port %s\n", port)
	log.Println("BookMyArena API is ready!")
	
	if err := http.ListenAndServe(port, router); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

