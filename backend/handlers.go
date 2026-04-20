package main

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

type FaceAnalysisRequest struct {
	ImageBase64 string `json:"image_base64"`
	MediaType   string `json:"media_type"`
}

func analyzeFace(c *gin.Context) {
	var req FaceAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	if req.ImageBase64 == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "image_base64 is required",
		})
		return
	}

	mediaType := req.MediaType
	if mediaType == "" {
		mediaType = "image/jpeg"
	}

	messages := []ClaudeMessage{
		{
			Role: "user",
			Content: []ClaudeContent{
				{
					Type: "text",
					Text: `You are an expert barber consultant analyzing a client photo for hairstyle recommendations at 613 Barbershop in Ottawa.

Analyze the uploaded photo and return ONLY valid JSON, no other text, no markdown, no backticks:

{
  "face_shape": "oval",
  "confidence": 0.92,
  "features": {
    "forehead": "average",
    "jawline": "soft",
    "face_length": "average"
  },
  "recommendations": [
    {
      "style_name": "Low Skin Fade with Textured Top",
      "suitability_score": 95,
      "reason": "Balances the face by adding height on top",
      "category": "fade"
    },
    {
      "style_name": "Mid Taper with Waves",
      "suitability_score": 88,
      "reason": "Clean sides complement the face shape",
      "category": "taper"
    },
    {
      "style_name": "Caesar Cut with Lineup",
      "suitability_score": 82,
      "reason": "Structured top works well with this face shape",
      "category": "classic"
    }
  ],
  "styles_to_avoid": ["Heavy bangs", "Buzz cut"]
}

face_shape must be one of: oval, round, square, heart, diamond, oblong
confidence is a number between 0 and 1
suitability_score is a number between 0 and 100`,
				},
				{
					Type: "image",
					Source: &ImageSource{
						Type:      "base64",
						MediaType: mediaType,
						Data:      req.ImageBase64,
					},
				},
			},
		},
	}

	result, err := callClaude(messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to analyze face: " + err.Error(),
		})
		return
	}

	var analysis map[string]interface{}
	if err := json.Unmarshal([]byte(result), &analysis); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to parse Claude response",
			"raw":   result,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"analysis": analysis,
	})
}

func generateBriefing(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Briefing generation endpoint - coming soon",
	})
}

func analyzeStyle(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Style analysis endpoint - coming soon",
	})
}

func portfolioMatch(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Portfolio match endpoint - coming soon",
	})
}
