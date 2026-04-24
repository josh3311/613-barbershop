# PROJECT_STATUS.md
For: Builder Agent (What to build, what's done, UI specs)

> **Every session (humans + AI):** Follow **`START-HERE.md`** for the full read order. At minimum, read **this file** first for sprint/backlog/UI. Then **`PROJECT-HANDOFF-FOR-KIMI.md`** (security/store context) and **`REVIEWER_CHECKLIST.md`** (compliance) when touching infra or release. After shipping a meaningful feature, update **Last Updated** and the relevant checklists so the plan stays true.

# 613 Barbershop - Project Status
**Last Updated:** 2026-04-24 (All AI features complete: FLUX try-on, saved looks, barber preview, loyalty stamps; demo prep mode)  
**Stack:** Expo SDK ~54, React Native, TypeScript, Firebase, Go backend  
**Theme:** Dark (#0A0A0A), Gold (#D4AF37), Bebas Neue + Inter typography

## ✅ COMPLETED (Do Not Rebuild)
- [x] Auth flow (Login/Register/Forgot) for Clients & Barbers
- [x] Role-based navigation (RootNavigator detects role from Firestore)
- [x] Client booking flow: **Select Service → Select Barber → Select Date/Time → Confirm** (`BookNavigator.tsx`); date strip and 30‑min slots follow each barber’s `workingHours` in Firestore; barber list shows **profile photos** when `photoURL` is set
- [x] Booking saves to Firestore with status 'pending'
- [x] Barber Dashboard with real-time bookings (onSnapshot)
- [x] Barber Schedule screen with date strip and booking counts
- [x] Barber Clients screen (aggregated from bookings)
- [x] Client History screen with cancel functionality
- [x] Confirm/Decline buttons on Barber Schedule for pending bookings
- [x] All icons migrated to Ionicons (professional look)
- [x] Dev tools removed from Profile screens
- [x] Client Home: "Next appointment" card (real-time) — confirmed/upcoming or in-chair; "Book your first cut" CTA when none; View Details → History tab (`HomeScreen.tsx`)
- [x] **Priority 2 — Real booking status flow (verified Apr 2026):** Barber Confirm/Decline/In Chair/Complete; Firestore timestamps; client History + cancel → `cancelled` real-time; dashboard/schedule match barber workflow
- [x] **Priority 3 — Barber Profile Management:** `BarberProfileScreen` loads/saves `barbers/{uid}` (display name, bio, **photo upload** to Firebase Storage → URL, specialties, availability, working hours); syncs `users/{uid}`; Auth profile update is non-blocking (avoids stuck Save on web)
- [x] **Client ↔ barber hours:** Booking only lists **days the barber marked working** and times within their start/end; `src/utils/workingHours.utils.ts`
- [x] **Push (client):** Expo token saved on `users.fcmToken` — `push.service.ts`, `PushTokenEffect`
- [x] **Push (server):** Cloud Functions `functions/src/index.ts` — `onBookingCreated` (pending → barber), `onBookingUpdated` (confirmed / declined / in_progress / completed / cancelled → client or barber) via **Expo Push API** (`expo-server-sdk`). **Deploy:** `firebase deploy --only functions` (needs **Blaze**). Optional env **`EXPO_ACCESS_TOKEN`** on the function (Expo dashboard access token) for production quotas.
- [x] In-app chat (Firestore-backed, real-time, both client and barber sides)
      - Conversations collection with messages subcollection
      - Entry points: client History → "Message barber", barber Schedule → "Message client"
      - Timestamp null safety fixed across all files via safeToDate helper (src/utils/date.utils.ts)
      - Firestore rules deployed for conversations and messages collections
- [x] Barber ratings system
      - RatingModal with 5 gold stars and optional comment
      - rating.service.ts with submitRating and hasRated
      - Firestore ratings collection with rules deployed
      - Barber aggregate (average rating + reviewCount) updated on submit
      - "Rate this cut" button on completed bookings in HistoryScreen
      - "★ Rated" replaces button after submission
      - Rating displays on SelectBarberScreen barber cards
      - Rating displays on barber's own Profile screen
- [x] Admin Dashboard for Amir
      - AdminDashboardScreen with stats, status row, barbers overview
      - Real-time bookings listener via AdminTodayContext
      - Barber detail schedule screen
      - AdminNavigator with Dashboard and Profile tabs
      - role: 'admin' routes to AdminNavigator in RootNavigator
      - Firestore rules updated with isAdmin() function
- [x] **AI Virtual Try-On with FLUX Kontext Pro** — Before/after comparison with draggable slider, saves to `users/{uid}.savedLooks`
- [x] **Camera flow for style analysis** — Native `expo-camera` with preview modal, web fallback to `expo-image-picker`
- [x] **Gallery upload flow for style analysis** — `expo-image-picker` with crop/preview, saves base64 selfie to Firestore
- [x] **AI Chat Stylist fully rebuilt** — Strict focus mode, photo uploads trigger re-analysis, chat history in `users/{uid}/styleChats`, style profile context on open, `[BOOK_STYLE:Name]` booking integration
- [x] **FLUX Kontext AI virtual try-on** — Before/after comparison with draggable slider, saves to `users/{uid}.savedLooks`, $0.04/generation
- [x] **Saved looks gallery** — "YOUR LOOKS" horizontal scroll section on Style tab, before/after modal with Book + Remove
- [x] **Barber sees client before/after + notes** — Schedule booking cards show requested style preview with barber notes and client notes
- [x] **Client notes to barber** — Free-form text field when booking a style
- [x] **Barber AI guide** — "How do I do this cut?" calls `/api/barber-cut-guide`, "Not sure about this style?" Q&A with AI
- [x] **Loyalty stamps** — Connected to Complete button, visual stamps on profile
- [x] **Full app audit** — Web compatibility fixes, Alert.cancel bug fixed, Reanimated issues identified

## 🚧 ACTIVE SPRINT (Build These Now)

**Current Sprint Status:** "AI features complete. Next: fix Reanimated Book tab crash, design polish, EAS build."

   Priority 1: Web compatibility and design polish
   - Replace all `react-native-reanimated` with React Native's built-in `Animated` API
   - Fix Booking tab crash on web (Reanimated root cause)
   - Design polish pass: Bebas Neue fonts, 3D card shadows, full `theme.ts` rollout
   - Test full client + barber + admin flows after Reanimated fix

## ⚠️ REQUIRED FIX (Before Release)
- [x] **Barber `BarberProfileScreen` — Save / persist:** Fixed Apr 2026 — `BarberService.saveProfile(uid, …)` **upserts** (`create` if `barbers/{uid}` missing, else `update`). Post-save uses `await load(…).catch(…)` so reload errors don’t leave ambiguous state. Re-test on web + native after deploy.

## 🐛 KNOWN ISSUES / NEXT STEPS

- **Reanimated web error:** `react-native-reanimated` causes crashes on web platform — replace all usage with built-in `Animated` API
- **Booking tab crash on web:** Same root cause as Reanimated error
- **Design polish incomplete:** Some screens still need full `theme.ts` integration (Bebas Neue headers, 3D card shadows, consistent spacing)
- **Post-Reanimated testing:** Verify all client + barber + admin flows work correctly after animation library swap

### Known Issues (AI Features)
- Reanimated web crash on Book tab — replace with built-in Animated API
- BebasNeue fonts not loading on all screens
- Firebase Storage not enabled (Blaze plan needed) — base64 workaround in place
- Push notifications disabled in Expo Go (need EAS dev build)

## 📋 BACKLOG (Future Sprints)
- [ ] Cancel window enforcement (e.g., no cancel within 2 hours)
- [ ] "Add to Calendar" button on Booking Success
- [ ] Optional polish: align **Completed** badge color with UI spec (grey `#666666` vs current green in History/Dashboard) if product wants consistency

## 🎨 UI REQUIREMENTS (Always Follow)
- Background: `#0A0A0A` (near black)
- Primary Accent: `#D4AF37` (gold)
- Secondary Text: `#666666` (grey)
- Cards: `#141414` with `#252525` border
- Icons: Ionicons only (no emojis, no generic icons)
- Buttons: Gold for primary, dark grey for secondary
- Status Badges:
  - pending: Orange (`#FFA500`)
  - confirmed: Green (`#4CAF50`)
  - declined: Red (`#FF4444`)
  - in-chair: Blue (`#2196F3`)
  - completed: Grey (`#666666`)

## 📁 KEY FILES REFERENCE
- Utils: `src/utils/date.utils.ts` (safe timestamp helpers)
- Chat: `src/screens/chat/ChatScreen.tsx`
- Chat Service: `src/services/chat.service.ts`
- Chat Types: `src/types/chat.types.ts`
- Navigation: `src/navigation/RootNavigator.tsx`, `ClientNavigator.tsx`, `BarberNavigator.tsx`, `HistoryNavigator.tsx`, `ScheduleNavigator.tsx`
- Screens Client: `src/screens/client/HomeScreen.tsx`, `ServicesScreen.tsx`, `SelectBarberScreen.tsx`, `BookingScreen.tsx`, `HistoryScreen.tsx`, `BookingConfirmationScreen.tsx`, `src/screens/chat/ChatScreen.tsx`, `StyleOnboardingScreen.tsx`, `StyleResultsScreen.tsx`, `StyleChatScreen.tsx`
- Screens Barber: `src/screens/barber/BarberDashboardScreen.tsx`, `ScheduleScreen.tsx`, `ClientsScreen.tsx`, `BarberProfileScreen.tsx`
- Services: `src/services/booking.service.ts`, `barber.service.ts`, `push.service.ts`, `chat.service.ts`, `aiChat.service.ts`, `ai.service.ts`
- Cloud Functions: `functions/src/index.ts` (Expo push on booking create/update)
- Hooks: `src/hooks/useAuth.ts`
- Theme: `src/theme.ts` (design system — colors, fonts, spacing, animations)

### Environment Variables (Backend)
- `ANTHROPIC_API_KEY` — Claude API for analysis and chat
- `REPLICATE_API_TOKEN` — Replicate — FLUX Kontext Pro try-on
- `IMGBB_API_KEY` — imgbb.com — public image hosting for Replicate input
- `UNSPLASH_ACCESS_KEY` — Unsplash API for style reference photos (backend only)
- `EXPO_PUBLIC_UNSPLASH_KEY` — moved to backend only (frontend uses proxy)
- `LIGHTX_API_KEY` — LightX (paused, kept for reference)

### Backend Endpoints (Go)
- `POST /api/analyze-profile` — Claude face + hair analysis
- `POST /api/style-chat` — AI stylist chat with full conversation history
- `POST /api/style-photo` — Unsplash photo proxy (ethnicity-aware queries)
- `POST /api/try-on-kontext` — FLUX Kontext hair try-on via Replicate
- `POST /api/barber-cut-guide` — Barber AI step-by-step guide

## 🚨 CURRENT BLOCKERS
- None

## 🚀 AFTER DEMO / POST-MVP

- [ ] Deploy push notifications (Cloud Functions)
  - Requires Firebase Blaze plan upgrade (add credit card, free tier covers 2M requests)
  - Run: firebase deploy --only functions
  - Optional: Add EXPO_ACCESS_TOKEN in Google Cloud Console for reliability
  - Code is already written in functions/ folder, just needs deployment

- [ ] Set up EAS Build for app stores
  - Run: eas build --platform all
  - Requires Apple Developer account ($99/year) for iOS
  - Requires Google Play Developer account ($25 one-time) for Android

