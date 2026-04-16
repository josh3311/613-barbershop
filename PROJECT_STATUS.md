# PROJECT_STATUS.md
For: Builder Agent (What to build, what's done, UI specs)

> **Every session (humans + AI):** Follow **`START-HERE.md`** for the full read order. At minimum, read **this file** first for sprint/backlog/UI. Then **`PROJECT-HANDOFF-FOR-KIMI.md`** (security/store context) and **`REVIEWER_CHECKLIST.md`** (compliance) when touching infra or release. After shipping a meaningful feature, update **Last Updated** and the relevant checklists so the plan stays true.

# 613 Barbershop - Project Status
**Last Updated:** 2026-04-17  
**Stack:** Expo SDK ~54, React Native, TypeScript, Firebase  
**Theme:** Dark (#0A0A0A), Gold (#D4AF37)

## ✅ COMPLETED (Do Not Rebuild)
- [x] Auth flow (Login/Register/Forgot) for Clients & Barbers
- [x] Role-based navigation (RootNavigator detects role from Firestore)
- [x] Client booking flow: Select Service → Date/Time → Select Barber → Confirm
- [x] Booking saves to Firestore with status 'pending'
- [x] Barber Dashboard with real-time bookings (onSnapshot)
- [x] Barber Schedule screen with date strip and booking counts
- [x] Barber Clients screen (aggregated from bookings)
- [x] Client History screen with cancel functionality
- [x] Confirm/Decline buttons on Barber Schedule for pending bookings
- [x] All icons migrated to Ionicons (professional look)
- [x] Dev tools removed from Profile screens
- [x] Client Home: "Next appointment" card (real-time) — confirmed/upcoming or in-chair; "Book your first cut" CTA when none; View Details → History tab (`HomeScreen.tsx`)

## 🚧 ACTIVE SPRINT (Build These Now)
Priority 2: Real Booking Status Flow *(mostly implemented — verify & polish)*
- Barber Confirm → `confirmed` + `confirmedAt` ✓
- Barber Decline → `declined` + timestamps ✓
- Client History real-time + status colors ✓
- Client cancel → `cancelled` ✓
- Remaining: spot-check edge cases, copy, and badge colors vs UI REQUIREMENTS

Priority 3: Barber Profile Management
- Barber can edit: Display name, Bio, Photo URL, Working Hours
- File: `src/screens/barber/BarberProfileScreen.tsx`
- Save to Firestore barbers/{uid}

## 📋 BACKLOG (Future Sprints)
- [ ] Push notifications (Expo Notifications) when status changes
- [ ] In-app chat between client and barber (post-decline/reschedule)
- [ ] Barber ratings (stars + comment after completed visit)
- [ ] Owner/Admin dashboard (Amir sees all barbers' stats)
- [ ] Cancel window enforcement (e.g., no cancel within 2 hours)
- [ ] "Add to Calendar" button on Booking Success

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
- Navigation: `src/navigation/RootNavigator.tsx`, `ClientNavigator.tsx`, `BarberNavigator.tsx`
- Screens Client: `src/screens/client/HomeScreen.tsx`, `HistoryScreen.tsx`, `BookingConfirmationScreen.tsx`
- Screens Barber: `src/screens/barber/BarberDashboardScreen.tsx`, `ScheduleScreen.tsx`, `ClientsScreen.tsx`
- Services: `src/services/booking.service.ts`, `barber.service.ts`
- Hooks: `src/hooks/useAuth.ts`

## 🚨 CURRENT BLOCKERS
None — next up: **Barber Profile Management** (Priority 3) unless you reprioritize backlog.
