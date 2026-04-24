# AI Features Documentation — 613 Barbershop

Last Updated: 2026-04-24 (photo lookup reverted to Unsplash backend + booking requestedStyle wiring verified)

---

## Feature 1: AI Style Profile Analysis

**What it does:**
- Client uploads a selfie (camera or gallery)
- Claude AI analyzes face shape, hair texture, ethnicity, skin tone, hairline, forehead size
- Returns 5 personalized style recommendations ranked by suitability score

**Key implementation notes:**
- Uses Anthropic Claude 3.5 Sonnet via backend
- Supports ALL ethnicities with culturally appropriate recommendations
- Photo lookup switched from broken hardcoded Pexels catalog back to Unsplash backend proxy. Search queries now include ethnicity keyword (e.g., "Low Skin Fade Black man haircut") for accurate matching. `src/data/styleCatalog.ts` removed.
- Frontend calls `POST /api/style-photo` async in parallel for all 5 recommendations; placeholder shown until each resolves
- Photo preview uses `resizeMode="contain"` — full face always visible before analysis
- Loading screen shows cycling messages during analysis for better UX

**Files:**
- `src/screens/client/StyleOnboardingScreen.tsx` — camera/gallery flow, photo preview, analysis loading, async saved-recs photo row
- `src/screens/client/StyleResultsScreen.tsx` — results display with redesigned cards, async photo fetch via `Promise.all`
- `src/services/unsplash.service.ts` — builds ethnicity-aware query, calls backend proxy
- `backend/handlers.go` — `/api/analyze-profile` and `/api/style-photo` (Unsplash portrait search)

---

## Feature 2: AI Virtual Try-On (FLUX Kontext Pro)

**What it does:**
- Client taps "Try this on me" from any style recommendation
- Backend uploads selfie to imgbb, calls Replicate FLUX Kontext Pro
- Returns photorealistic before/after showing the style on their actual face
- Can save the look to "Your Looks" gallery

**Key implementation notes:**
- ~$0.04 per generation via Replicate
- FLUX Kontext preserves face identity while changing only hair
- Before/after modal shows 50/50 split with draggable divider
- Saved looks appear in "Your Looks" horizontal gallery on Style tab

**Files:**
- `src/screens/client/StyleResultsScreen.tsx` — "Try this on me" buttons, before/after modal
- `src/screens/client/StyleOnboardingScreen.tsx` — "Your Looks" gallery display
- `backend/handlers.go` — `/api/try-on-kontext` endpoint
- `src/services/tryon.service.ts` — frontend service

---

## Feature 3: AI Stylist Chat

**What it does:**
- Real-time chat with AI barber stylist
- Knows client's style profile (face shape, hair texture, ethnicity)
- Answers questions about styles, maintenance, shop info
- Can trigger booking with `[BOOK_STYLE:Name]` marker

**Key implementation notes:**
- Chat history stored in Firestore: `users/{uid}/styleChats`
- System prompt includes shop knowledge (address, prices, loyalty)
- Strict focus — won't answer off-topic questions
- Booking integration via booking service

**Files:**
- `src/screens/client/StyleChatScreen.tsx` — chat UI
- `src/services/aiChat.service.ts` — chat service, system prompt builder
- `backend/handlers.go` — `/api/style-chat` endpoint

---

## Feature 5: Booking Integration (Requested Style)

**What it does:**
- When a client picks a style in results or chat, tapping "Book" opens a **booking picker modal** showing all upcoming bookings (pending/confirmed/in_progress)
- User selects which specific booking to attach the style to — no more auto-picking
- If no upcoming bookings exist, shows a toast: "No upcoming bookings found. Book an appointment first, then you can add your style preference."
- When booking from the Book tab, the confirmation screen has an optional **Style Preference** section letting users pick a saved look and add a note before confirming
- If no upcoming booking exists when adding from chat, the style is saved to `users/{uid}.savedStyle` and auto-attached on the next `create()` call
- Barbers see a **CLIENT WANTS** block on the schedule card with thumbnail, style name, barber notes, and a **"How do I do this cut?"** AI guide button

**Key implementation notes:**
- Booking picker modal — when adding a style from AI chat, user selects which specific booking to attach it to instead of auto-picking
- Style preference in booking flow — Book screen confirmation step has optional style attachment letting users pick a saved look and add a note before confirming
- `requestedStyle` writes `name`, `photoURL`, `description`, `barberNotes`, optional `beforePhotoURL` / `clientNote` to the booking document (not to the user)
- Console logs `[booking] requestedStyle saved to booking: <id> <name>` so writes are verifiable in dev console
- Barber `ScheduleScreen` uses `BookingService.onSnapshotByBarber`, so newly attached `requestedStyle` appears in real time without refresh
- AI guide button calls `POST /api/barber-cut-guide` with `style_name` and `hair_texture` (taken from `requestedStyle.description`)

**Files:**
- `src/services/booking.service.ts` — `attachRequestedStyleForClient` (booking write), `attachRequestedStyleToBooking` (direct booking ID attachment), `create` (auto-attach from `savedStyle` or passed-in style)
- `src/screens/client/StyleChatScreen.tsx` — booking picker modal with upcoming bookings list
- `src/screens/client/BookingConfirmationScreen.tsx` — style preference section with saved style picker
- `src/screens/barber/ScheduleScreen.tsx` — `CLIENT WANTS` block + AI guide modal
- `src/types/booking.types.ts` — `RequestedStyle` type definition

---

## Feature 4: Barber AI Cut Guide

**What it does:**
- When barber views a client's requested style, they can tap "How do I do this cut?"
- AI generates step-by-step instructions with tools and techniques
- Optional: barber can ask specific questions about the cut

**Key implementation notes:**
- Returns structured JSON with numbered steps
- Each step includes: title, description, tools needed
- Adapts instructions based on client's hair texture
- Supports follow-up questions via optional `question` field

**Files:**
- `src/screens/barber/ScheduleScreen.tsx` — "How do I do this cut?" button, AI Q&A section
- `backend/handlers.go` — `/api/barber-cut-guide` endpoint

---

## Backend Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze-profile` | POST | Claude face/hair analysis, returns profile + recommendations |
| `/api/style-chat` | POST | AI stylist chat with conversation history |
| `/api/style-photo` | POST | Unsplash portrait search; body `{ style_name, ethnicity? }`. Ethnicity keyword is baked into the query (e.g. "Low Skin Fade Black man haircut") |
| `/api/try-on-kontext` | POST | FLUX Kontext virtual try-on via Replicate |
| `/api/barber-cut-guide` | POST | Step-by-step cut instructions for barbers |

---

## Environment Variables Required

**Backend (.env):**
```
ANTHROPIC_API_KEY=your_claude_key
REPLICATE_API_TOKEN=your_replicate_token
IMGBB_API_KEY=your_imgbb_key
UNSPLASH_ACCESS_KEY=your_unsplash_key
```

**Frontend (exposed to app):**
- None required for AI features — all API keys stay backend-only

---

## Architecture Decisions

1. **Unsplash backend proxy (after curated-catalog experiment failed):** A hand-picked Pexels catalog was attempted, but hardcoded photo IDs kept returning wrong subjects (tools, women, backs of heads). Reverted to Unsplash `/search/photos?orientation=portrait` with an ethnicity keyword baked into the query. This keeps API keys server-side and adapts automatically as Unsplash's library grows.

2. **Async photo lookup via `Promise.all`:** The 5 recommendation photos are fetched in parallel; a `placehold.co` dark placeholder keeps cards from jumping when a result returns empty.

3. **Backend keeps all API keys:** Claude, Replicate, imgbb, Unsplash keys never exposed to frontend. All AI calls go through Go backend.

4. **Base64 image handling:** Selfies uploaded as base64 → imgbb for Replicate (FLUX needs public URL). Try-on result returned as public URL.

5. **Universal ethnicity support:** Analysis prompts explicitly ask Claude to consider heritage for culturally appropriate recommendations.
