# 613 Barbershop — Claude Instructions

## Project Overview
Premium barbershop booking app for 613 Barbershop in Ottawa.
Real client: Amir. Three user roles: Client, Barber, Admin.
Rebuild from scratch — reference old project at ../barbershop-613

## Tech Stack
- React Native + Expo SDK 54 + TypeScript (strict mode)
- Firebase (Firestore + Auth + Storage + Functions)
- Go + Gin backend on port 8080
- Theme: #0A0A0A background, #D4AF37 gold accent
- Icons: Ionicons ONLY — never emoji as icons
- Fonts: BebasNeue_400Regular + Inter (400/600/700)

## Strict Coding Rules
- NEVER use `any` type — always strict TypeScript
- NEVER hardcode API keys — always use process.env / EXPO_PUBLIC_
- ALWAYS return FirestoreResult<T> from services
- ALWAYS handle loading + error states in every screen
- ALWAYS use built-in Animated API — NEVER react-native-reanimated
- ALL colors from theme.ts — never hardcode hex values
- ALL spacing from theme.ts spacing object
- ALL icons from theme.ts icons object
- NEVER call Firestore directly in a component — use hooks/services

## File Structure
src/
├── components/      → reusable UI only
├── config/          → firebase.ts
├── constants/       → app.ts, collections.ts
├── context/         → AuthContext, etc.
├── hooks/           → useAuth, useBookings, useCollection
├── navigation/      → RootNavigator + all navigators + types.ts
├── screens/
│   ├── auth/        → Login, Register, RoleSelect
│   ├── client/      → Home, Book, Styles, History, Profile, StyleChat
│   ├── barber/      → Dashboard, Schedule, Chat, CutGuide
│   ├── admin/       → Dashboard, Analytics
│   └── chat/        → ChatScreen
├── services/        → booking.service.ts, user.service.ts, etc.
├── theme.ts         → SINGLE SOURCE OF TRUTH for all design
└── types/           → all TypeScript interfaces

## Navigation Rules
- RootNavigator checks auth state + profileLoaded before routing
- Never guess user role — always read from Firestore users collection
- All navigation params strictly typed in navigation/types.ts
- `BarberStackParams.CutGuide` includes optional `requestedStyle?: HaircutStyle | null`

## Service Layer Rules
- Every service returns: { data: T | null, error: string | null }
- Use withConverter for ALL Firestore collections
- Services are const objects — never classes
- All async methods wrapped in try/catch

## AI Features (Go Backend)
- ALL Claude API calls go through Go backend on port 8080
- Frontend NEVER calls Claude API directly
- Backend URL from: EXPO_PUBLIC_AI_BACKEND_URL

### Models
- Style analysis + face detection: claude-sonnet-4-20250514
- Chat responses + simple text:    claude-haiku-4-5-20251001

### Endpoints
- POST /api/analyze-profile    → face + hair analysis (Sonnet)
- POST /api/generate-briefing  → barber AI cut guide (Haiku)
- POST /api/analyze-style      → style photo analysis (Sonnet)
- POST /api/style-chat         → AI stylist chat (Haiku)
- POST /api/try-on-kontext     → FLUX Kontext virtual try-on
- POST /api/barber-cut-guide   → cut instructions (Haiku)
- POST /api/upload-photo       → photo upload to Firebase Storage

### Style Analysis Rules
- Analyze face shape, ethnicity, hair texture, skin tone
- Reference historical style catalog from 2010-2026 by ethnicity
- Normalize ethnicity strings before matching catalog
- Return TOP 6 styles ranked by suitability score
- Each recommendation includes era, style name, description, suitability score
- Ethnicity categories: Black, White/Caucasian, Asian, Latino, Middle Eastern, Mixed
- Face shapes: oval, round, square, heart, diamond
- Hair textures: coily, kinky, wavy, straight, curly

### Historical Style Catalog (2010-2026)
Black hair:
- 2010-2013: Hi-top fades, waves, box fades
- 2014-2016: Temp fades, dreads, afros
- 2017-2019: Drop fades, 360 waves, braids
- 2020-2022: Burst fades, Edgar cuts, twists
- 2023-2026: Skin fades, bald fades, modern tapers

Latino hair:
- Slick backs, mid fades, textured crops
- Edgar cuts, French crops, lineups

Asian hair:
- Two-block cuts, curtain bangs, textured undercuts, perms
- Modern bowl cuts, middle parts

White/Caucasian hair:
- Undercuts, pompadours, quiffs
- Textured crops, side parts, modern mullets

Middle Eastern hair:
- Skin fades with beard combos
- Slick backs, pompadours, Caesar cuts

### Analysis Flow
1. Client uploads selfie
2. Sonnet analyzes: face shape, ethnicity, hair texture, skin tone, current length
3. AI cross-references historical catalog + current 2026 trends + Amir's specialties
4. Returns TOP 6 recommendations ranked by suitability score
5. Client taps any style → FLUX Kontext shows them wearing that style
6. Client books directly from try-on result

## Replicate (Virtual Try-On)
- Model: flux-kontext-apps/change-haircut
- API key from: EXPO_PUBLIC_REPLICATE_API_KEY
- Called from Go backend ONLY — never from frontend
- Cost: ~$0.04 per image generation
- Best identity preservation — keeps face, changes only hair
- 196,000+ production runs verified

## What NEVER To Do
- No react-native-reanimated (breaks web)
- No hardcoded route strings (use typed params)
- No console.log in production code
- No `any` types anywhere
- No direct Firestore calls from components
- No Claude or Replicate API calls from frontend
- No hardcoded model names — always reference this file

## Current App Status (v2-rebuild)
All features below are BUILT and WORKING:
- Full auth flow (Login, Register, RoleSelect)
- Three roles: Client, Barber, Admin
- Client: Home, Book, Styles, History, Profile, Chat
  - Styles tab: selfie analysis, AI recommendations, virtual try-on, saved styles gallery
  - AI Stylist Chat tab (scissors icon): business-aware stylist chat, new/saved threads
- Barber: Dashboard, Schedule, Chats, Profile, Cut Guide
- Admin: Dashboard (Overview/Barbers/Bookings/Profile), AI Assistant
- Full booking flow (Service → Barber → DateTime → Confirm → Success)
- Real-time chat per booking (client ↔ barber)
- Push notifications (expo-notifications)
  - Barber notified on new booking
  - Client notified on booking confirm
- Loyalty stamps (10 stamps = free haircut)
  - Auto-increments via Firestore transaction on MARK COMPLETE
- Birthday free haircut feature
  - Stored as MM-DD in user.birthday
  - Banner shows on HomeScreen on birthday
  - Price set to $0 in BookingConfirmScreen
- Barber approval flow
  - New barbers see PendingApprovalScreen
  - Admin approves/declines from Profile tab
- Admin AI Business Intelligence
  - Calls Anthropic directly (claude-3-5-haiku-20241022)
  - Real Firestore stats injected into system prompt
  - Markdown rendering via react-native-markdown-display
- Rating & Reviews
  - Clients rate completed bookings (1–5 stars + text review)
  - Stored on booking doc (`rating`, `review`)
  - Barbers see average rating; admin sees all reviews
- Post-Session Style Cards
  - After MARK COMPLETE, barber photographs finished style
  - Claude vision analyzes photo → plain-English reproduction guide
  - Saved to `styleCards` collection; clients view in BookingHistoryScreen
- AI Stylist Chat (client tab)
  - Bottom tab with scissors icon; chats in `aiChats` collection
  - AI knows services, prices, how to book; users can start new chats
- Saved Styles Gallery
  - AI recommendations + user-saved pictures in `User.savedStyles[]`
  - Gallery section on StylesScreen

## Data Model (key fields)
- `Booking`: `rating`, `review` (post-completion); `requestedStyle: HaircutStyle | null`
- `HaircutStyle`: `generatedImageUrl`, `selfieUrl` (try-on before/after); legacy `tryOnImageUrl`, `referenceImageUrl`
- `User.savedStyles[]`: gallery of AI-recommended and user-saved style entries
- `styleCards`: barber-captured finished cuts + AI reproduction guide (linked to booking/client)
- `aiChats`: persisted AI stylist conversations per client
- `BarberStackParams.CutGuide`: optional `requestedStyle` (client’s requested look for context)

## Firestore Rules (deployed)
- users: owner + admin full access
  barber can READ all users + UPDATE loyaltyStamps only
- services/barbers: public read, admin write
- bookings: client/barber/admin read; anyone create;
  barber/client/admin update (includes `rating` / `review` on completion)
- messages: authenticated read/write
- ratings: public read, authenticated write
- styleCards: barber create; client read own; admin read all
- aiChats: owner read/write; admin read

## Key Technical Decisions
- barberId stored as barber.userId (auth UID), NOT barbers doc ID
- Loyalty stamps use runTransaction to prevent race conditions
- All notification calls wrapped in try/catch — never block main flow
- expo-notifications SDK 54 requires shouldShowBanner + shouldShowList
  (NOT shouldShowAlert)
- Admin AI calls Anthropic directly from client — deviation from
  "ALL AI calls through Go backend" rule — acceptable for admin only
- Birthday stored as "MM-DD" string format
- `HaircutStyle.generatedImageUrl` preferred over legacy `tryOnImageUrl` for after-image
- `HaircutStyle.selfieUrl` used as before-image when present
- Cut Guide receives optional `requestedStyle` via navigation params (not only booking fetch)
- Reviews aggregated from `bookings.rating` / `bookings.review` for barber averages

## Environment Variables Required
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_ANTHROPIC_API_KEY
REPLICATE_API_TOKEN
LIGHTX_API_KEY
IMGBB_API_KEY
EXPO_PUBLIC_UNSPLASH_ACCESS_KEY

## EAS Build
- Bundle ID: com.barbershop613.app
- Android package: com.barbershop613.app
- Version: 1.0.0 (versionCode: 1)
- Preview APK built and tested ✅
- Production build pending Apple Developer Account

## What Is NOT Built Yet
- Book directly from try-on result (one-tap into booking flow with style attached)
- Migrate all client AI calls to Go backend (Styles, StyleChat, Cut Guide, style cards still use direct Anthropic/Replicate from app in places)
- Apple Developer Account (iOS TestFlight)
- Google Play Console (Android store submission)

## CI/CD Pipeline
- ci.yml: TypeScript check on push to v2-rebuild/main
- preview.yml: EAS preview build on PRs to main
- deploy.yml: Production build + store submit on push to main
- pr-checks.yml: Quality gate + PR comment
- Branch strategy:
  v2-rebuild → active development
  main → production (triggers store deployment)

## PRE-LAUNCH CHECKLIST
- [ ] Unsplash Production Access — current plan is
  demo tier (50 requests/hour). Before launch, apply
  at unsplash.com/oauth/applications for Production
  access (5000 requests/hour, free). Requires showing
  the live app. Each "Analyze My Face" uses 3 requests.

Last Updated: 2026-05-15