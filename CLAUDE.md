# 613 Barbershop — V3

## Project
React Native barbershop app for 613 Barbershop, 598 Rideau St, Ottawa ON.
Active branch: v3 | Main branch = V2 (never touch main)

## Stack
React Native, Expo SDK 54, Firebase (Firestore/Auth/Storage), 
Anthropic Claude API, OpenAI API (gpt-image-1 edits), ImgBB, TypeScript

## V3 Status
- StyleDocumentScreen simplified (photo + description only) — DONE
- RatingModal Google Reviews redirect — DONE  
- StylesScreen rebuilt as Style with AI chat + gpt-image-1 hair try-on — DONE
- ClientNavigator merged AI Chat + Styles into one Style AI tab — DONE
- Website booking connection — TODO

## Key Rules
- Always on v3 branch, never modify main
- TextInput color must be in StyleSheet (#FFFFFF), not as a prop
- Use expo-file-system/legacy not expo-file-system
- Commit prefix: "v3: description"
- gpt-image-1 edits endpoint takes real photo as FormData, returns base64

---

## COMPLETED IN THIS SESSION (v3 branch)

### Bug Fixes
- Fixed "My Styles" quick action on HomeScreen — was navigating to 'Styles' 
  (old route, no longer exists). Now correctly navigates to 'StyleAI' tab.
- Fixed "Chat" quick action on HomeScreen — was navigating to 'History'. 
  Now correctly navigates to 'StyleAI' tab (chat lives in StylesScreen).
- Fixed "PICK A SERVICE" header text clipping on ServiceSelectionScreen — 
  back button had no mirror spacer, title overflowed off-screen. 
  Implemented 3-column header layout (back btn | centered title | spacer).
- Applied same 3-column header fix to BookingConfirmScreen.

### New Features
- Square Appointments sync infrastructure:
  - Created src/services/squareSync.ts — fire-and-forget sync service,
    calls Firebase Cloud Function, never blocks booking flow.
  - Created functions/src/index.ts — Firebase Cloud Function (syncToSquare),
    deployed to us-central1, Node.js 24 Gen 2.
  - Square Access Token stored securely in Firebase Secret Manager.
  - BookingConfirmScreen updated to call syncBookingToSquare() after 
    Firestore write succeeds.
  - SERVICE_MAP and BARBER_MAP have placeholder IDs — awaiting Amir's 
    Square service variation IDs and team member IDs.

### Infrastructure
- Firebase Functions initialized in project (functions/ folder).
- Enabled APIs: Secret Manager, Cloud Build, Cloud Run, Artifact Registry,
  Eventarc, Pub/Sub on barbershop-613 Google Cloud project.
- Firebase project confirmed on Blaze plan.

---

## PENDING / BLOCKED

- Square IDs from Amir:
    Needs: Square Access Token (production), service variation IDs per service,
    team member IDs per barber (from Square Dashboard → Team).
    Action: Fill SERVICE_MAP and BARBER_MAP in src/services/squareSync.ts.

- Hair try-on (OpenAI gpt-image-1 edit endpoint):
    Blocked until OpenAI credits added (expected Friday).
    
- 360 view (4 hair angles):
    Blocked until hair try-on is confirmed working.

---

## TODO NEXT SESSION

- UI/UX design upgrade:
    Use Phosphor/Lucide icons, Reanimated animations, component rebuilds.
    Reference design tokens in theme.ts.
    
- Full app bug sweep:
    Audit client, barber, and admin flows end-to-end.
    Check for any remaining broken navigation routes.
    Verify all screens use consistent 3-column header layout.
