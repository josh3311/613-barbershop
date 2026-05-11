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
│   ├── client/      → Home, Book, History, Profile
│   ├── barber/      → Dashboard, Schedule, Chat
│   ├── admin/       → Dashboard, Analytics
│   └── chat/        → ChatScreen
├── services/        → booking.service.ts, user.service.ts, etc.
├── theme.ts         → SINGLE SOURCE OF TRUTH for all design
└── types/           → all TypeScript interfaces

## Navigation Rules
- RootNavigator checks auth state + profileLoaded before routing
- Never guess user role — always read from Firestore users collection
- All navigation params strictly typed in navigation/types.ts

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