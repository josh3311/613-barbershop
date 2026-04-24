package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

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
					Text: `Analyze this person's photo for personalized haircut recommendations at 613 Barbershop, 598 Rideau St, Ottawa, ON K1N 6A2, Canada.

Identify and consider ALL of the following:
- Face shape: oval, round, square, heart, diamond, oblong, triangle
- Ethnicity/heritage (for culturally appropriate styles): Black/African, White/Caucasian, Asian (East/South/Southeast), Latino/Hispanic, Middle Eastern, South Asian, Mixed heritage
- Hair texture: straight (Type 1), wavy (Type 2a/2b/2c), curly (Type 3a/3b/3c), coily/kinky (Type 4a/4b/4c)
- Current hair length: shaved, short, medium, long
- Hair density: thin, medium, thick
- Head shape and size
- Hairline type: straight, widows peak, receding, rounded
- Forehead size: small, medium, large

Return ONLY valid JSON, no markdown, no backticks, no extra text:

{
  "face_shape": "oval",
  "ethnicity": "Black/African",
  "hair_texture": "coily type 4c",
  "hair_length": "short",
  "hair_density": "thick",
  "hairline": "rounded",
  "forehead": "medium",
  "skin_tone": "deep",
  "recommendations": [
    {
      "rank": 1,
      "style_name": "Low Skin Fade with Shape-Up",
      "why_it_fits": "Your round face benefits from the clean lines...",
      "maintenance": "Easy to keep up",
      "duration": "30 min appointment",
      "visit_frequency": "Every 2-3 weeks",
      "occasion_tags": ["everyday", "professional", "casual"],
      "suitability_score": 96
    }
  ]
}

STYLE RECOMMENDATIONS BY ETHNICITY — give styles that are ACTUALLY worn by people of this background:

Black/African clients:
- Coily/kinky hair: temp fades, drop fades, high top fades, shape-ups with designs, 360 waves, twist outs, locs, Edgar cuts, Afros, Caesar cuts, taper fades, skin fades, bald fades, line-ups, coil outs, sponge twists
- Wavy/curly: twist outs, wash and go, defined curls with fade

White/Caucasian clients:
- Straight/wavy hair: undercuts, pompadours, quiffs, side parts, textured crops, French crops, slick backs, ivy league cuts, faux hawks, buzz cuts, Caesar cuts, flow cuts

Asian clients (East/Southeast):
- Straight hair: two-block cuts, curtain bangs, textured crops, bowl cuts modern, undercuts, perms (for texture), kpop-inspired styles, wolf cuts, mullets modern

South Asian clients:
- Thick straight/wavy: undercuts, pompadours, side parts, textured fades, quiffs, slick backs

Latino/Hispanic clients:
- Wavy/curly: burst fades, Edgar cuts, temple fades, slick backs, textured tops, blow-out fades, line-ups

Middle Eastern clients:
- Thick straight/wavy: pompadours, slick backs, undercuts, side parts, quiffs, textured fades

Mixed heritage:
- Assess actual hair texture and face shape primarily, combine styles from relevant backgrounds

NEVER recommend a style that doesn't naturally suit the person's actual hair texture. A person with Type 4 coily hair cannot wear a straight pompadour without chemical processing — never recommend that. Always recommend styles that work WITH their natural texture.`,
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

	// Step 2: Get style recommendations based on profile (already included in Step 1)
	// If profile doesn't have recommendations, generate them
	if _, ok := profile["recommendations"]; !ok {
		profileJSON, _ := json.Marshal(profile)

		stylesMessages := []ClaudeMessage{
			{
				Role: "user",
				Content: []ClaudeContent{
					{
						Type: "text",
						Text: fmt.Sprintf(`You are an expert barber at 613 Barbershop, 598 Rideau St, Ottawa, ON K1N 6A2, Canada.

Client profile: %s

Recommend exactly 5 hairstyles. Rules:
- For Black/African clients with coily/kinky hair: prioritize temp fades, drop fades, high top fades, shape-ups with designs, 360 waves, twist outs, locs, Edgar cuts, taper fades, skin fades
- For White/Caucasian clients: prioritize undercuts, pompadours, quiffs, textured crops, French crops, slick backs, ivy league cuts
- For Asian clients: prioritize two-block cuts, textured crops, perms, curtain bangs, kpop-inspired styles
- For South Asian clients: prioritize undercuts, pompadours, textured fades, quiffs
- For Latino/Hispanic clients: prioritize burst fades, Edgar cuts, temple fades, slick backs, textured tops
- For Middle Eastern clients: prioritize pompadours, slick backs, undercuts, textured fades
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
	return
}

	// Profile already has recommendations, wrap in styles response
	styles := map[string]interface{}{
		"recommendations": profile["recommendations"],
	}
	delete(profile, "recommendations")

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
	StyleName    string `json:"style_name"`
	Ethnicity    string `json:"ethnicity,omitempty"`
	HairTexture  string `json:"hair_texture,omitempty"`
	FaceShape    string `json:"face_shape,omitempty"`
}

// buildStylePhotoUnsplashQuery returns an ethnicity-aware Unsplash search string.
func buildStylePhotoUnsplashQuery(styleName, ethnicity string) string {
	name := strings.TrimSpace(styleName)
	if name == "" {
		return ""
	}
	e := strings.ToLower(strings.TrimSpace(ethnicity))
	if strings.Contains(e, "black") || strings.Contains(e, "afro") {
		return name + " haircut Black man"
	}
	if strings.Contains(e, "asian") {
		return name + " haircut Asian man"
	}
	if strings.Contains(e, "latino") || strings.Contains(e, "latin") {
		return name + " haircut Latino man"
	}
	if strings.Contains(e, "white") || strings.Contains(e, "european") {
		return name + " haircut man"
	}
	return name + " haircut men"
}

type unsplashSearchAPIResponse struct {
	Results []struct {
		URLs struct {
			Regular string `json:"regular"`
			Small   string `json:"small"`
		} `json:"urls"`
	} `json:"results"`
}

func stylePhoto(c *gin.Context) {
	var req stylePhotoRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.StyleName) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "style_name required"})
		return
	}

	key := os.Getenv("UNSPLASH_ACCESS_KEY")
	if key == "" {
		log.Printf("[stylePhoto] UNSPLASH_ACCESS_KEY not set — returning placeholder")
		c.JSON(http.StatusOK, gin.H{"photo_url": ""})
		return
	}

	// If the caller sent only style_name, enrich with ethnicity-aware keyword.
	// If the caller already pre-baked the query (frontend does this), pass through.
	query := strings.TrimSpace(req.StyleName)
	if req.Ethnicity != "" {
		query = buildStylePhotoUnsplashQuery(req.StyleName, req.Ethnicity)
	}

	escaped := url.QueryEscape(query)
	apiURL := fmt.Sprintf(
		"https://api.unsplash.com/search/photos?query=%s&per_page=1&client_id=%s&orientation=portrait",
		escaped,
		key,
	)

	httpClient := &http.Client{Timeout: 8 * time.Second}
	resp, err := httpClient.Get(apiURL)
	if err != nil {
		log.Printf("[stylePhoto] unsplash request failed: %v", err)
		c.JSON(http.StatusOK, gin.H{"photo_url": ""})
		return
	}
	defer resp.Body.Close()

	var result unsplashSearchAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Results) == 0 {
		log.Printf("[stylePhoto] unsplash decode/empty for query %q: %v", query, err)
		c.JSON(http.StatusOK, gin.H{"photo_url": ""})
		return
	}

	c.JSON(http.StatusOK, gin.H{"photo_url": result.Results[0].URLs.Regular})
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
		loc, err := time.LoadLocation("America/Toronto")
		if err != nil {
			loc = time.UTC
		}
		now := time.Now().In(loc)
		dateStr := now.Format("Monday, January 2, 2006")
		yearStr := fmt.Sprintf("%d", now.Year())
		system = strings.Join([]string{
			"You are an expert barber and AI stylist at 613 Barbershop, 598 Rideau St, Ottawa, ON K1N 6A2, Canada.",
			"",
			"Client profile: " + profileStr,
			"Their current style recommendations: " + recStr,
			"Today's date: " + dateStr,
			"",
			"SHOP KNOWLEDGE:",
			"Location: 598 Rideau St, Ottawa, ON K1N 6A2, Canada. Give this full address when clients ask where the shop is.",
			"Services and prices: Fade $40 (30 min); Haircut $35 (45 min); Beard Trim $25 (20 min); Beard + Cut $50 (60 min).",
			"Loyalty: every 7 completed cuts earns one free cut, tracked automatically in the app.",
			"Booking: real-time in-app booking; barber confirms each appointment. Free cancellation up to 2 hours before the appointment.",
			"Barber services: professional cuts, shape-ups, fades, beard trimming. Barber profiles are available in the app.",
			"AI features: photo-based style analysis, personalized recommendations with real reference photos, AI stylist chat.",
			"Answer shop questions only from this knowledge. If unsure, tell the client to confirm in the app. Proactively mention loyalty or other benefits when it fits. Do not use emojis.",
			"",
			"CONTEXT — TRENDING HAIR (use " + yearStr + ", not outdated looks):",
			"Today's date is " + dateStr + ". You are aware of current trending haircut styles for " + yearStr + ". Always recommend styles that are currently trending when it fits the client.",
			"For Black men in " + yearStr + ", trending styles often include: high top fades, temp fades, drop fades, Edgar cuts, twist outs, loc styles, 360 waves, and shape-ups with designs.",
			"",
			"YOUR JOB:",
			"- Recommend the most current trending styles for " + yearStr + " that suit this specific client",
			"- Always consider: their face shape, hair texture, skin tone, ethnicity, and lifestyle",
			"- For Black clients with coily/kinky hair, prioritize: temp fades, drop fades, high top fades, shape-ups with designs, 360 waves, twist outs, locs, Edgar cuts",
			"- For Asian clients: two-block cuts, textured crops, perms, curtain bangs",
			"- For Latino clients: temple fades, Edgar cuts, slick backs, burst fades",
			"- Always mention HOW LONG the style takes and HOW EASY it is to maintain",
			"- If client doesn't know what they want, ask 3 quick questions: occasion, maintenance preference, how often they visit the barber",
			"- Then recommend 3 specific styles with reasons why each suits them personally",
			"- NEVER recommend outdated styles",
			"- Speak casually like a friendly expert barber — not like a robot",
			"",
			"BOOKING INTEGRATION:",
			"- When client picks a style, ask: \"Want me to add this to your booking with full specs for your barber?\"",
			"- When they say yes, create a detailed barber brief and use [BOOK_STYLE:StyleName] marker",
			"- The barber brief format: Style name + specific details (guard numbers, fade height, design details, texture treatment) + client's hair texture + any special requests",
			"- Example: [BOOK_STYLE:Temp Fade with 360 Waves] followed by \"Barber notes: Start with #1.5 on sides, temp fade at the temple, blend to skin, 360 wave pattern on top, shape-up the hairline, client has coily type 4 hair\"",
			"",
			"YOU CANNOT create bookings or see the calendar. Direct booking time to the Book tab.",
		}, "\n")
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
	Question    string `json:"question"`
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
	question := strings.TrimSpace(req.Question)

	var prompt string
	if question != "" {
		prompt = fmt.Sprintf(
			`You are a senior barber instructor. A barber is preparing to do a %s on a client with %s hair. The barber asked this specific question: %q. Answer the question with clear, practical, numbered steps. Return ONLY valid JSON, no markdown, no backticks: {"steps":[{"number":1,"title":"string","description":"plain English instruction","tools":"clippers guard 2"}]}. Focus your steps directly on the question.`,
			style,
			tex,
			question,
		)
	} else {
		prompt = fmt.Sprintf(
			`You are a senior barber instructor. Explain step by step how to do a %s on a client with %s hair. Return ONLY valid JSON, no markdown, no backticks: {"steps":[{"number":1,"title":"string","description":"plain English instruction","tools":"clippers guard 2"}]}. Keep each step practical and simple.`,
			style,
			tex,
		)
	}

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

// tryOn is a stub; virtual try-on is paused until a face-preserving solution is available.
func tryOn(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"error": "Feature coming soon"})
}

// --- Try-On Kontext (FLUX Kontext on Replicate) ---

type tryOnKontextRequest struct {
	SelfieBase64 string `json:"selfie_base64"`
	StylePrompt  string `json:"style_prompt"`
}

type tryOnKontextResponse struct {
	ResultURL string `json:"result_url"`
}

// imgbbUploadResponse represents the JSON response from imgbb API
type imgbbUploadResponse struct {
	Data struct {
		URL string `json:"url"`
	} `json:"data"`
	Status int    `json:"status"`
	Error  string `json:"error,omitempty"`
}

// tryOnUploadImgbb uploads a base64 image to imgbb and returns the public URL
func tryOnUploadImgbb(base64Image string) (string, error) {
	apiKey := os.Getenv("IMGBB_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("IMGBB_API_KEY not set")
	}

	// Prepare the form data
	formData := url.Values{}
	formData.Set("key", apiKey)
	formData.Set("image", base64Image)

	// Make the request to imgbb
	resp, err := http.PostForm("https://api.imgbb.com/1/upload", formData)
	if err != nil {
		return "", fmt.Errorf("failed to upload to imgbb: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read imgbb response: %w", err)
	}

	var imgbbResp imgbbUploadResponse
	if err := json.Unmarshal(body, &imgbbResp); err != nil {
		return "", fmt.Errorf("failed to parse imgbb response: %w", err)
	}

	if imgbbResp.Status != 200 || imgbbResp.Data.URL == "" {
		return "", fmt.Errorf("imgbb upload failed: %s", imgbbResp.Error)
	}

	return imgbbResp.Data.URL, nil
}

// replicatePredictionRequest represents the request body for Replicate API
// For FLUX Kontext model route, we only send input (no version field)
type replicatePredictionRequest struct {
	Input map[string]interface{} `json:"input"`
}

// replicatePredictionResponse represents the response from Replicate API
type replicatePredictionResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Output interface{} `json:"output"`
	Error  string `json:"error,omitempty"`
}

// tryOnKontext handles the virtual try-on using FLUX Kontext on Replicate
func tryOnKontext(c *gin.Context) {
	// Fix 1: Log handler reached as very first line
	log.Printf("[kontext] handler reached")

	var req tryOnKontextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[kontext] ERROR: invalid request body: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Fix 4: Log request details
	log.Printf("[kontext] selfie base64 length: %d", len(req.SelfieBase64))
	log.Printf("[kontext] style prompt: %s", req.StylePrompt)

	if req.SelfieBase64 == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "selfie_base64 is required"})
		return
	}

	if req.StylePrompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "style_prompt is required"})
		return
	}

	// Step 1: Upload selfie to imgbb
	publicURL, err := tryOnUploadImgbb(req.SelfieBase64)
	if err != nil {
		log.Printf("[kontext] ERROR: imgbb upload failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload image: " + err.Error()})
		return
	}

	// Fix 4: Log and verify imgbb URL
	log.Printf("[kontext] imgbb upload result: %s", publicURL)
	if publicURL == "" || !strings.HasPrefix(publicURL, "http") {
		log.Printf("[kontext] ERROR: invalid imgbb URL: %s", publicURL)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not upload photo. Try again."})
		return
	}
	log.Printf("[kontext] imgbb URL confirmed: %s", publicURL)

	// Step 2: Call FLUX Kontext on Replicate
	replicateToken := os.Getenv("REPLICATE_API_TOKEN")
	if replicateToken == "" {
		log.Printf("[kontext] ERROR: REPLICATE_API_TOKEN not set")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "REPLICATE_API_TOKEN not set"})
		return
	}

	// Fix 2: Use correct Replicate API format for hosted deployments
	// No "version" field, just "input" with the correct parameters
	predictionBody := map[string]interface{}{
		"input": map[string]interface{}{
			"input_image":      publicURL,
			"prompt":           req.StylePrompt,
			"output_format":    "png",
			"safety_tolerance": 2,
			"output_quality":   90,
		},
	}

	jsonData, err := json.Marshal(predictionBody)
	if err != nil {
		log.Printf("[kontext] ERROR: failed to marshal prediction request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal prediction request"})
		return
	}

	// Fix 2: Use correct model deployments endpoint URL
	replicateURL := "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions"
	log.Printf("[kontext] replicate request URL: %s", replicateURL)

	httpReq, err := http.NewRequest("POST", replicateURL, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("[kontext] ERROR: failed to create prediction request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create prediction request"})
		return
	}

	// Fix 5: Ensure all required headers are set
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Token "+replicateToken)
	httpReq.Header.Set("Prefer", "wait")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("[kontext] ERROR: replicate prediction request failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start prediction: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[kontext] ERROR: failed to read prediction response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read prediction response"})
		return
	}

	// Fix 3: Log response status and body for debugging
	log.Printf("[kontext] replicate create status: %d", resp.StatusCode)
	log.Printf("[kontext] replicate create body: %s", string(body))

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("[kontext] ERROR: replicate prediction failed with status %d: %s", resp.StatusCode, string(body))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Replicate API error: " + string(body)})
		return
	}

	var predictionResp replicatePredictionResponse
	if err := json.Unmarshal(body, &predictionResp); err != nil {
		log.Printf("[kontext] ERROR: failed to parse prediction response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse prediction response"})
		return
	}

	predictionID := predictionResp.ID
	if predictionID == "" {
		log.Printf("[kontext] ERROR: prediction ID is empty in response")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid prediction response: no ID"})
		return
	}
	log.Printf("[kontext] prediction ID: %s", predictionID)

	// Step 3: Poll for result
	resultURL, err := pollReplicatePrediction(client, replicateToken, predictionID)
	if err != nil {
		log.Printf("[kontext] ERROR: polling failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Fix 4: Log final result
	log.Printf("[kontext] final result URL: %s", resultURL)

	// Step 4: Return result
	c.JSON(http.StatusOK, tryOnKontextResponse{
		ResultURL: resultURL,
	})
}

// pollReplicatePrediction polls the Replicate API for prediction result
// Polls every 3 seconds, max 120 seconds (40 attempts)
func pollReplicatePrediction(client *http.Client, token, predictionID string) (string, error) {
	maxAttempts := 40
	pollInterval := 3 * time.Second
	pollURL := fmt.Sprintf("https://api.replicate.com/v1/predictions/%s", predictionID)
	pollCount := 0

	for attempt := 0; attempt < maxAttempts; attempt++ {
		time.Sleep(pollInterval)
		pollCount++

		req, err := http.NewRequest("GET", pollURL, nil)
		if err != nil {
			log.Printf("[kontext] ERROR: failed to create poll request: %v", err)
			return "", fmt.Errorf("failed to create poll request: %w", err)
		}

		req.Header.Set("Authorization", "Token "+token)

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[kontext] poll attempt %d failed: %v", pollCount, err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()

		if err != nil {
			log.Printf("[kontext] poll attempt %d read failed: %v", pollCount, err)
			continue
		}

		// Fix 3: Log poll response body for debugging
		log.Printf("[kontext] poll response body: %s", string(body))

		var pollResp replicatePredictionResponse
		if err := json.Unmarshal(body, &pollResp); err != nil {
			log.Printf("[kontext] poll attempt %d parse failed: %v", pollCount, err)
			continue
		}

		status := pollResp.Status
		// Fix 4: Log poll count with status
		log.Printf("[kontext] poll #%d status: %s", pollCount, status)

		switch status {
		case "succeeded":
			// Fix 3: Handle FLUX Kontext output format - returns string URL, not array
			resultURL := extractResultURLFromInterface(pollResp.Output)
			if resultURL == "" {
				return "", fmt.Errorf("prediction succeeded but no result URL found")
			}
			return resultURL, nil
		case "failed":
			errorMsg := pollResp.Error
			if errorMsg == "" {
				errorMsg = "Prediction failed"
			}
			log.Printf("[kontext] ERROR: prediction failed: %s", errorMsg)
			return "", fmt.Errorf("%s", errorMsg)
		case "canceled":
			log.Printf("[kontext] ERROR: prediction was canceled")
			return "", fmt.Errorf("prediction was canceled")
		}
		// Continue polling for "starting", "processing" statuses
	}

	log.Printf("[kontext] ERROR: polling timeout after %d attempts", maxAttempts)
	return "", fmt.Errorf("polling timeout: prediction did not complete within 120 seconds")
}

// extractResultURLFromInterface extracts the result URL from Replicate output
// Fix 3: FLUX Kontext returns output as a plain string URL, not an array
func extractResultURLFromInterface(output interface{}) string {
	if output == nil {
		return ""
	}

	// Try string first (FLUX Kontext returns single string URL)
	if str, ok := output.(string); ok {
		return str
	}

	// Try array (fallback for other models)
	if arr, ok := output.([]interface{}); ok && len(arr) > 0 {
		if str, ok := arr[0].(string); ok {
			return str
		}
	}

	return ""
}

