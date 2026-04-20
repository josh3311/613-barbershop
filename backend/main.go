package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using environment variables")
	}

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods",
			"GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers",
			"Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "613-ai-backend"})
	})

	r.POST("/api/analyze-profile", analyzeProfile)
	r.POST("/api/generate-briefing", generateBriefing)
	r.POST("/api/analyze-style", analyzeStyle)
	r.POST("/api/portfolio-match", portfolioMatch)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("613 AI Backend running on port %s", port)
	r.Run(":" + port)
}
