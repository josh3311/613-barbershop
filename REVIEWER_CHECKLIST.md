# 613 Barbershop — Reviewer Checklist

**For:** Reviewer Agent (Security, App Store compliance, code quality)  
**Role:** Strict Code Reviewer for iOS/Android App Store Submission

> **Alignment:** Read **`START-HERE.md`** and **`PROJECT_STATUS.md`** before reviews so checklist items match current sprint and architecture.

> **Snapshot (last codebase audit):** Most CRITICAL items below are implemented; re-verify on every PR before release.

---

## CRITICAL (Will Cause Rejection)

- [x] **Security:** No hardcoded API keys in source (check `firebase.ts` uses `process.env`)
- [x] **Security:** `.env` is in `.gitignore` (never commit secrets)
- [x] **Security:** Firestore rules deployed and restrictive (no public read/write) — verify in Firebase Console after each rules change
- [x] **iOS:** `NSCameraUsageDescription` present in `app.json`
- [x] **iOS:** `NSPhotoLibraryUsageDescription` present in `app.json`
- [x] **iOS:** `NSPhotoLibraryAddUsageDescription` present in `app.json` (required if saving photos to library)
- [x] **iOS:** `NSUserNotificationsUsageDescription` present in `app.json`
- [x] **iOS:** `bundleIdentifier` set: `com.barbershop613.app`
- [x] **Android:** `package` set: `com.barbershop613.app`
- [x] **Assets:** App icon exists at `assets/icon.png` (target 1024×1024 for store; replace placeholder when final art is ready)
- [x] **Assets:** Splash screen exists at `assets/splash-icon.png` (dark background aligned with app)
- [x] **Error Handling:** ErrorBoundary wraps the app in `App.tsx` (no white screens on crash)

---

## WARNING (Should Fix)

- [x] **Performance:** No `console.log` in production `src/` (only `ErrorBoundary` uses `console.error` in `__DEV__`)
- [ ] **Performance:** Images optimized (audit any remote URIs / large assets before release)
- [ ] **Memory:** Image pickers close properly (audit screens using `expo-image-picker` / `expo-camera` when those flows ship)
- [ ] **Accessibility:** All interactive elements have `accessibilityLabel` / hints (spot-check new screens)
- [x] **Network:** Firebase / Google APIs use HTTPS (default)
- [x] **Build:** `eas.json` exists with production profile
- [x] **Dependencies:** `@expo/metro-runtime` in `devDependencies` (not `dependencies`)

---

## MINOR (Nice to Have)

- [ ] **UX:** Loading states on all async operations
- [ ] **UX:** Pull-to-refresh on lists (partially present on barber dashboard)
- [ ] **Code:** No unused imports or variables
- [ ] **Code:** TypeScript strict mode compliance
- [ ] **Tests:** Error boundaries / critical flows tested

---

## FILES TO AUDIT

Always check these on every review:

1. `src/config/firebase.ts` — Keys must use `process.env.EXPO_PUBLIC_*`
2. `firestore.rules` — Must restrict by `request.auth` / ownership (no `allow read, write: if true`)
3. `app.json` — Privacy strings, bundle IDs, splash, plugins
4. `package.json` — No secrets; runtime vs devDependencies correct
5. `App.tsx` — `ErrorBoundary` present
6. `src/services/*.ts` — No hardcoded IDs or secrets

---

## SUBMISSION READINESS (Before EAS Build / Store Upload)

- [ ] Run **`npx tsc --noEmit`** (or add `npm run lint` / ESLint when configured) — zero errors
- [ ] Test on **small phone** (e.g. iPhone SE class width ~320pt) — no layout overflow / crash
- [ ] Test **Android back** / predictive back where enabled
- [ ] Verify **deep links** (if implemented)
- [ ] **Dark mode** consistent (app is dark-themed; verify no accidental light flashes)

---

## QUICK COMMANDS

```bash
# Typecheck
npx tsc --noEmit

# Redeploy rules after editing firestore.rules
firebase deploy --only firestore:rules

# Production build (after eas login / project linked)
eas build --platform all --profile production
```

---

*Regenerate unchecked items each sprint; keep this file in repo for reviewer agents.*
