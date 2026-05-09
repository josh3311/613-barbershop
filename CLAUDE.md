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
- Model: claude-haiku-4-5-20251001

## What NEVER To Do
- No react-native-reanimated (breaks web)
- No hardcoded route strings (use typed params)
- No console.log in production code
- No `any` types anywhere
- No direct Firestore calls from components