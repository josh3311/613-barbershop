# 613 Barbershop — Project handoff (plan & status)

**Session order:** See **`START-HERE.md`** first, then **`PROJECT_STATUS.md`** (active sprint), then this file for security/store history.

Use this document to stay aligned with what was planned and what is already done.

---

## What this project is

- **Stack:** Expo SDK 54, React Native 0.81, React Navigation, React Native Paper (dark + gold theme), Firebase (Auth, Firestore, Storage).
- **Path:** `barbershop-613/` (workspace root may be `c:\amir-barber-shop\`).
- **Roles:** Clients book services; barbers/admins see dashboards (some screens still placeholders).

---

## Plan we followed (store + security)

### Priority 1 — Security (done)

1. **C-1 — Firebase config out of source**
   - Keys live in **`.env`** at project root (`EXPO_PUBLIC_FIREBASE_*`).
   - **`src/config/firebase.ts`** reads `process.env.EXPO_PUBLIC_*` only.
   - **`.gitignore`** includes `.env` so keys are not committed.

2. **C-2 — Firestore rules**
   - **`firestore.rules`** in project root (users, bookings, barbers, services, haircutHistory; default deny).
   - Firebase CLI: **`firebase init firestore`**, then **`firebase deploy --only firestore:rules`** (deployed successfully).
   - **`firebase.json`** / **`.firebaserc`** link this folder to Firebase project `barbershop-613`.

3. **Firebase CLI login on Windows**
   - If `localhost:9005` fails, use: **`firebase login --no-localhost`** (paste auth code).

### Priority 2 — App Store / Play configuration (done)

4. **C-3 — iOS privacy strings**
   - In **`app.json`** → `expo.ios.infoPlist`: camera, photo library, photo library add, notifications usage descriptions.

5. **C-4 — Assets**
   - **`assets/`**: `icon.png`, `splash-icon.png`, `adaptive-icon.png`, `favicon.png` (placeholders with 613 branding; replace with final art later).

6. **C-5 — Bookings persist**
   - **`BookingConfirmationScreen`** calls **`BookingService.create(...)`** with Firestore; success uses real doc id for confirmation code (not random).

7. **C-6 — Bundle IDs**
   - **`app.json`**: `ios.bundleIdentifier` + `android.package` = `com.barbershop613.app`; `ios.buildNumber`, `android.versionCode` set.

### Extra hardening (done)

8. **Error boundary**
   - **`src/components/ErrorBoundary.tsx`** wraps the app in **`App.tsx`** so uncaught JS errors show a retry screen instead of a blank white screen.

9. **EAS builds**
   - **`eas.json`** added with `development`, `preview`, `production` profiles; submit section placeholders for Apple/Google (fill when submitting).

10. **Dependencies**
    - **`@expo/metro-runtime`** moved to **`devDependencies`** in **`package.json`**.

11. **`.gitignore`**
    - Added patterns for **`google-play-key.json`**, **`GoogleService-Info.plist`**, etc., so store secrets are not committed.

---

## What is intentionally not “finished” (optional / later)

- Several **tab screens** are still **“Coming Soon”** placeholders (e.g. parts of client Home/History/Book barber Schedule/Clients) — may affect review if the app is submitted as a full product; polish or scope the listing accordingly.
- **`app.json` → `extra.eas.projectId`** may need the real **EAS project UUID** after `eas init` / first `eas build`.
- **Crash reporting** (Sentry, Crashlytics) not wired — ErrorBoundary is the baseline.
- **Storage Security Rules** file in repo — verify **`firebase storage:rules`** in Firebase console if you use uploads heavily.

---

## Commands reference

```bash
# Dev
npm start

# Firebase rules (from project root)
firebase deploy --only firestore:rules

# Production builds (after eas login)
eas build --platform all --profile production
```

---

## Files to know

| Area | Files |
|------|--------|
| Env / Firebase client | `.env`, `src/config/firebase.ts` |
| App config | `app.json` |
| Rules | `firestore.rules`, `firebase.json` |
| Booking write | `src/screens/client/BookingConfirmationScreen.tsx`, `src/services/booking.service.ts` |
| Error boundary | `src/components/ErrorBoundary.tsx`, `App.tsx` |
| EAS | `eas.json` |

---

*Last updated for handoff to other assistants (e.g. Kimi AI).*
