package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

const stylePhotoPlaceholderURL = "https://placehold.co/400x300/0A0A0A/D4AF37?text=Style"

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

type stylePhotoRequest struct {
	StyleName string `json:"style_name"`
}

type unsplashSearchAPIResponse struct {
	Results []struct {
		URLs struct {
			Regular string `json:"regular"`
			Small   string `json:"small"`
		} `json:"urls"`
	} `json:"results"`
}

// stylePhoto proxies Unsplash so the app (including web) never needs an Unsplash key.
func stylePhoto(c *gin.Context) {
	var req stylePhotoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	name := strings.TrimSpace(req.StyleName)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "style_name is required"})
		return
	}

	key := strings.TrimSpace(os.Getenv("UNSPLASH_ACCESS_KEY"))
	if key == "" {
		c.JSON(http.StatusOK, gin.H{"photo_url": stylePhotoPlaceholderURL})
		return
	}

	vals := url.Values{}
	vals.Set("query", strings.TrimSpace(name)+" haircut men")
	vals.Set("per_page", "1")
	vals.Set("client_id", key)
	full := "https://api.unsplash.com/search/photos?" + vals.Encode()

	client := &http.Client{}
	resp, err := client.Get(full)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"photo_url": stylePhotoPlaceholderURL})
		return
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil || resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusOK, gin.H{"photo_url": stylePhotoPlaceholderURL})
		return
	}

	var data unsplashSearchAPIResponse
	if err := json.Unmarshal(raw, &data); err != nil || len(data.Results) == 0 {
		c.JSON(http.StatusOK, gin.H{"photo_url": stylePhotoPlaceholderURL})
		return
	}
	u := strings.TrimSpace(data.Results[0].URLs.Regular)
	if u == "" {
		u = strings.TrimSpace(data.Results[0].URLs.Small)
	}
	if u == "" {
		c.JSON(http.StatusOK, gin.H{"photo_url": stylePhotoPlaceholderURL})
		return
	}
	c.JSON(http.StatusOK, gin.H{"photo_url": u})
}

type styleChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type styleChatAPIRequest struct {
	Messages        []styleChatMessage `json:"messages"`
	System          string             `json:"system"`
	Profile         json.RawMessage    `json:"profile,omitempty"`
	Recommendations json.RawMessage    `json:"recommendations,omitempty"`
}

func styleChat(c *gin.Context) {
	var req styleChatAPIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	system := strings.TrimSpace(req.System)
	if system == "" {
		profileStr := strings.TrimSpace(string(req.Profile))
		if profileStr == "" || profileStr == "null" {
			profileStr = "{}"
		}
		recStr := strings.TrimSpace(string(req.Recommendations))
		if recStr == "" || recStr == "null" {
			recStr = "[]"
		}
		system = fmt.Sprintf(
			`You are a friendly barber at 613 Barbershop helping a client choose their next haircut. You know their style profile: %s. Their top recommendations are: %s. Speak casually and in plain English. No jargon. When recommending a style, mention it by its exact name from the recommendations list. If the client says they want to book a style or add it to their booking, respond with this exact marker on its own line: [BOOK_STYLE:Style Name Here]`,
			profileStr,
			recStr,
		)
	}
	if system == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "system (or profile and recommendations) is required"})
		return
	}

	var claudeMsgs []ClaudeMessage
	for _, m := range req.Messages {
		if m.Role != "user" && m.Role != "assistant" {
			continue
		}
		claudeMsgs = append(claudeMsgs, ClaudeMessage{
			Role:    m.Role,
			Content: []ClaudeContent{{Type: "text", Text: m.Content}},
		})
	}
	if len(claudeMsgs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Add a message to continue the chat."})
		return
	}

	text, err := callClaudeFull(claudeMsgs, system, 2048)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "We could not reach the stylist just now. Please try again in a moment.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": text})
}

type barberCutGuideRequest struct {
	StyleName   string `json:"style_name"`
	HairTexture string `json:"hair_texture"`
}

func barberCutGuide(c *gin.Context) {
	var req barberCutGuideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	style := strings.TrimSpace(req.StyleName)
	if style == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "style_name is required"})
		return
	}
	tex := strings.TrimSpace(req.HairTexture)
	if tex == "" {
		tex = "typical"
	}

	prompt := fmt.Sprintf(
		`You are a senior barber instructor. Explain step by step how to do a %s on a client with %s hair. Return ONLY valid JSON, no markdown, no backticks: {"steps":[{"number":1,"title":"string","description":"plain English instruction","tools":"clippers guard 2"}]}. Keep each step practical and simple.`,
		style,
		tex,
	)

	messages := []ClaudeMessage{
		{
			Role:    "user",
			Content: []ClaudeContent{{Type: "text", Text: prompt}},
		},
	}

	raw, err := callClaudeFull(messages, "", 2048)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not load cut instructions. Try again shortly.",
		})
		return
	}

	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Instructions came back in an unexpected format.",
			"raw":   raw,
		})
		return
	}

	c.JSON(http.StatusOK, parsed)
}
