package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type ProfileAnalysisRequest struct {
	ImageBase64 string `json:"image_base64"`
	MediaType   string `json:"media_type"`
}

type ProfileAnalysisResponse struct {
	Success bool                   `json:"success"`
	Profile map[string]interface{} `json:"profile"`
	Styles  map[string]interface{} `json:"styles"`
}

func analyzeProfile(c *gin.Context) {
	var req ProfileAnalysisRequest
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

	// Step 1: Analyze the photo
	profileMessages := []ClaudeMessage{
		{
			Role: "user",
			Content: []ClaudeContent{
				{
					Type: "text",
					Text: `You are an AI style consultant for 613 Barbershop in Ottawa.
Analyze this photo and return ONLY valid JSON, no markdown, no backticks, no extra text:

{
  "ethnicity": "Black",
  "skin_tone": "deep",
  "face_shape": "oval",
  "hair_texture": "coily",
  "forehead": "average",
  "jawline": "average",
  "face_length": "average",
  "current_style": "short natural"
}

ethnicity must be one of: Black, White, Asian, Latino, Mixed, Other
skin_tone must be one of: deep, medium-deep, medium, light-medium, light
face_shape must be one of: oval, round, square, heart, diamond, oblong
hair_texture must be one of: coily, kinky, wavy, straight, curly, unknown`,
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

	profileResult, err := callClaude(profileMessages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to analyze photo: " + err.Error(),
		})
		return
	}

	// Clean response in case Claude adds markdown fences
	profileResult = strings.TrimSpace(profileResult)
	profileResult = strings.TrimPrefix(profileResult, "```json")
	profileResult = strings.TrimPrefix(profileResult, "```")
	profileResult = strings.TrimSuffix(profileResult, "```")
	profileResult = strings.TrimSpace(profileResult)

	var profile map[string]interface{}
	if err := json.Unmarshal([]byte(profileResult), &profile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to parse profile response",
			"raw":   profileResult,
		})
		return
	}

	// Step 2: Get style recommendations based on profile
	profileJSON, _ := json.Marshal(profile)

	stylesMessages := []ClaudeMessage{
		{
			Role: "user",
			Content: []ClaudeContent{
				{
					Type: "text",
					Text: fmt.Sprintf(`You are an expert barber at 613 Barbershop in Ottawa.

Client profile: %s

Recommend exactly 5 hairstyles. Rules:
- For Black clients with coily/kinky hair: prioritize fades, tapers, waves, shape-ups, caesars, afros, locs, twists
- For Asian clients: prioritize two-block cuts, textured crops, perms, undercuts
- For White/Latino clients: prioritize tapers, pompadours, undercuts, textured crops
- Always match hair texture — never recommend styles that dont work with their texture
- Include why each style suits THIS specific person

Return ONLY valid JSON, no markdown, no backticks:

{
  "recommendations": [
    {
      "rank": 1,
      "style_name": "Low Skin Fade with Shape-Up",
      "suitability_score": 96,
      "why_it_suits_you": "2 sentences specific to this client's features",
      "hair_texture_compatibility": "works well with coily hair",
      "maintenance_level": "low",
      "duration_minutes": 30,
      "best_for": "everyday",
      "category": "fade"
    }
  ]
}

maintenance_level: low, medium, or high
best_for: everyday, professional, casual, or special occasion
category: fade, taper, natural, loc, twist, classic, or modern`, string(profileJSON)),
				},
			},
		},
	}

	stylesResult, err := callClaude(stylesMessages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get style recommendations: " + err.Error(),
		})
		return
	}

	// Clean response
	stylesResult = strings.TrimSpace(stylesResult)
	stylesResult = strings.TrimPrefix(stylesResult, "```json")
	stylesResult = strings.TrimPrefix(stylesResult, "```")
	stylesResult = strings.TrimSuffix(stylesResult, "```")
	stylesResult = strings.TrimSpace(stylesResult)

	var styles map[string]interface{}
	if err := json.Unmarshal([]byte(stylesResult), &styles); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to parse styles response",
			"raw":   stylesResult,
		})
		return
	}

	c.JSON(http.StatusOK, ProfileAnalysisResponse{
		Success: true,
		Profile: profile,
		Styles:  styles,
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
