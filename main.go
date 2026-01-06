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
	
	config.InitDB()
	defer config.CloseDB()

	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			services.CleanExpiredSessions()
		}
	}()

	router := routes.SetupRoutes()

	port := ":8080"
	log.Printf("Server starting on port %s\n", port)
	log.Println("BookMyArena API is ready!")
	
	if err := http.ListenAndServe(port, router); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

