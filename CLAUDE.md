# 613 Barbershop — V3

## Project
React Native barbershop app for 613 Barbershop, 598 Rideau St, Ottawa ON.
Active branch: v3 | Main branch = V2 (never touch main)

## Stack
React Native, Expo SDK 54, Firebase (Firestore/Auth/Storage),
Anthropic Claude API, OpenAI API (gpt-image-1 edits), ImgBB, TypeScript

## Key Rules
- Always on v3 branch, never modify main
- TextInput color must be in StyleSheet (#FFFFFF), not as a prop
- Use expo-file-system/legacy not expo-file-system
- Commit prefix: "v3: description"
- gpt-image-1 edits endpoint takes real photo as FormData, returns base64
- App targets dev build (Android/iOS only) — Reanimated is fully supported
- Web target is no longer a requirement — expo start --web not used
- All booking flow screens use 3-column centered header layout:
  [backBtn 40px] | [flex:1 centered title] | [spacer 40px]
- Never modify src/services/squareSync.ts maps until Amir provides Square IDs
- Never modify functions/ folder without testing deploy after

## Animation Stack (installed, dev build only)
- @shopify/react-native-skia — GPU canvas, shaders, gold effects
- react-native-reanimated — springs, layout animations, shared elements
- react-native-gesture-handler — touch handling
- moti — declarative animations on top of Reanimated
- expo-linear-gradient — gold gradients
- expo-blur — frosted glass effects
- expo-image — optimized image loading with fade-in
- expo-haptics — physical feedback on press/confirm

---

## V3 Feature Status

### DONE ✅
- StyleDocumentScreen simplified (photo + description only)
- RatingModal Google Reviews redirect
- StylesScreen rebuilt as Style with AI chat + gpt-image-1 hair try-on
- ClientNavigator merged AI Chat + Styles into one StyleAI tab
- Fixed HomeScreen "My Styles" quick action (was navigating to dead
  route 'Styles', now navigates to 'StyleAI')
- Fixed HomeScreen "Chat" quick action (was navigating to 'History',
  now navigates to 'StyleAI')
- Fixed "PICK A SERVICE" header clipping on ServiceSelectionScreen
  (3-column layout implemented)
- Fixed same header on BookingConfirmScreen, BarberSelectionScreen,
  DateTimeSelectionScreen
- Added Firestore error handling + empty state to ServiceSelectionScreen
- Cleaned navigation/types.ts (removed stale 'Styles', 'AIStyler',
  'StyleChat' routes)
- Deleted dead files: StyleChatScreen.tsx, AIStylistChatScreen.tsx
- Updated version label to v3.0 on ProfileScreen + BarberProfileScreen
- Square Appointments sync infrastructure deployed:
  - src/services/squareSync.ts (fire-and-forget, never blocks booking)
  - functions/src/index.ts (syncToSquare Cloud Function, us-central1)
  - Square Access Token in Firebase Secret Manager
  - BookingConfirmScreen calls syncBookingToSquare() after Firestore write
- Firebase Functions initialized, Blaze plan confirmed
- All required Google Cloud APIs enabled (Secret Manager, Cloud Build,
  Cloud Run, Artifact Registry, Eventarc, Pub/Sub)
- Dev build set up on Pixel 9 Android emulator
- Animation libraries installed (see Animation Stack above)
- TypeScript passes clean (tsc --noEmit) after all changes
- Bug sweep complete — all client, barber, admin, auth flows audited

### IN PROGRESS 🔄
- UI/UX upgrade: Apple-website-level animations using Skia + Reanimated
  - PremiumButton, GoldCard, AnimatedHeader, GoldShimmer components
  - All client screens getting spring animations + Skia gold effects
  - Tab bar getting frosted glass + spring tab indicator

### PENDING — WAITING ON AMIR ⏸
- Square sync activation:
  Fill SERVICE_MAP and BARBER_MAP in src/services/squareSync.ts
  Needs: service variation IDs + team member IDs from Square Dashboard

### PENDING — READY TO BUILD 🟡
- Hair try-on (OpenAI gpt-image-1):
  OpenAI credits added ($5), gpt-image-1 enabled and confirmed.
  Build the try-on endpoint call in StylesScreen.
- 360 view (4 hair angles): build after try-on confirmed working

---

## Architecture Notes
- Firestore is source of truth for all bookings
- Square sync is fire-and-forget — failure never blocks a booking
- squareSync.ts has placeholder guard — skips sync until real IDs filled
- Firebase Cloud Function syncToSquare deployed to us-central1 Node.js 24
- All Skia Canvas components must be wrapped in React.memo
- Skia transparent color bug (SDK 53/54): use Skia.Color with explicit
  alpha, never the string "transparent"
- Shared Element Transitions work on native-stack only (not tab navigator)