# PROJECT_STATUS.md
For: Builder Agent (What to build, what's done, UI specs)

> **Every session (humans + AI):** Follow **`START-HERE.md`** for the full read order. At minimum, read **this file** first for sprint/backlog/UI. Then **`PROJECT-HANDOFF-FOR-KIMI.md`** (security/store context) and **`REVIEWER_CHECKLIST.md`** (compliance) when touching infra or release. After shipping a meaningful feature, update **Last Updated** and the relevant checklists so the plan stays true.

# 613 Barbershop - Project Status
**Last Updated:** 2026-04-16 (in-app chat)  
**Stack:** Expo SDK ~54, React Native, TypeScript, Firebase  
**Theme:** Dark (#0A0A0A), Gold (#D4AF37)

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
- [x] **In-app chat:** Firestore `conversations/{id}` + `messages` subcollection; `ChatService`, `ChatScreen`; client **History** and barber **Schedule** stacks (`HistoryNavigator`, `ScheduleNavigator`); rules in `firestore.rules`

## 🚧 ACTIVE SPRINT (Build These Now)
**Next:** first item in **Backlog** (barber ratings).

## ⚠️ REQUIRED FIX (Before Release)
- [x] **Barber `BarberProfileScreen` — Save / persist:** Fixed Apr 2026 — `BarberService.saveProfile(uid, …)` **upserts** (`create` if `barbers/{uid}` missing, else `update`). Post-save uses `await load(…).catch(…)` so reload errors don’t leave ambiguous state. Re-test on web + native after deploy.

## 📋 BACKLOG (Future Sprints)
- [ ] Barber ratings (stars + comment after completed visit)
- [ ] Owner/Admin dashboard (Amir sees all barbers' stats)
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
- Navigation: `src/navigation/RootNavigator.tsx`, `ClientNavigator.tsx`, `BarberNavigator.tsx`, `HistoryNavigator.tsx`, `ScheduleNavigator.tsx`
- Screens Client: `src/screens/client/HomeScreen.tsx`, `ServicesScreen.tsx`, `SelectBarberScreen.tsx`, `BookingScreen.tsx`, `HistoryScreen.tsx`, `BookingConfirmationScreen.tsx`, `src/screens/chat/ChatScreen.tsx`
- Screens Barber: `src/screens/barber/BarberDashboardScreen.tsx`, `ScheduleScreen.tsx`, `ClientsScreen.tsx`, `BarberProfileScreen.tsx`
- Services: `src/services/booking.service.ts`, `barber.service.ts`, `push.service.ts`, `chat.service.ts`
- Cloud Functions: `functions/src/index.ts` (Expo push on booking create/update)
- Hooks: `src/hooks/useAuth.ts`

## 🚨 CURRENT BLOCKERS
- None — next up: **Barber ratings** (see Backlog).

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

- [ ] Add barber ratings system
  - Client rates barber after completed visit (1-5 stars + comment)
  - Show average rating on barber cards

- [ ] Owner/Admin dashboard for Amir
  - See all barbers' schedules and shop-wide revenue
