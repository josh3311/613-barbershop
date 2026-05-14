# 613 Barbershop — AI-Powered Booking App

A full-stack React Native mobile app built for **613 Barbershop** in Ottawa, Canada. The app serves three user roles — clients, barbers, and admin — with a complete booking system, real-time chat, loyalty rewards, and an AI styling feature that generates personalized hairstyle previews on the user's actual face.

---

## Features

### Client
- Register and log in with role selection
- Browse services and book appointments in 4 steps
- AI Style Analysis — upload a selfie, get 4 AI-generated hairstyle previews on your face
- Save a preferred style and attach it to bookings
- Chat with an AI stylist about your chosen style
- Real-time chat with your barber
- Booking history with status tracking
- Loyalty stamp system — every 10 cuts earns a free haircut
- Birthday free haircut reward
- Push notifications for booking confirmations

### Barber
- Dashboard with pending, confirmed, and completed bookings
- View client's attached style request with reference photos
- AI Cut Guide — generates step-by-step cutting instructions per client
- Mark bookings complete (triggers loyalty stamp increment)
- Real-time messaging with clients
- Barber approval flow (pending until admin approves)

### Admin (Amir)
- Revenue dashboard — today, this week, this month
- Per-barber earnings breakdown
- Full bookings list with status filters
- Approve or decline barber account requests
- AI Assistant powered by Claude — answers questions using live Firestore data

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native + Expo SDK 54 (TypeScript) |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| Face Analysis | Claude Haiku (Anthropic API) |
| Style Recommendations | Claude Sonnet (Anthropic API) |
| Virtual Try-On | Replicate — flux-kontext-apps/change-haircut |
| Image Hosting | ImgBB API |
| Push Notifications | Expo Notifications |
| CI/CD | GitHub Actions + EAS Build |
| Fonts | Bebas Neue + Inter (Google Fonts) |
| Icons | Expo Vector Icons (Ionicons) |

---

## AI Features

### My Styles Tab
1. User uploads a selfie
2. **Claude Haiku** analyzes face shape, head size, hair texture, and skin tone
3. **Claude Sonnet** recommends 4 unique modern hairstyles (2015–present) tailored to the user's specific features
4. **FLUX Kontext** generates 4 images of the user's actual face with each style applied — in parallel
5. User selects their favourite, sees a before/after comparison, and saves it
6. Saved style attaches to their next booking so the barber knows exactly what to do

### AI Cut Guide (Barber)
- Barber selects a client booking and taps Cut Guide
- Claude Haiku generates a step-by-step cutting guide specific to that service and client
- Barber can regenerate at any time

### Admin AI Assistant
- Live Firestore data (revenue, bookings, barber stats) is passed as context
- Claude Haiku answers natural language questions about the shop's performance

---

## Project Structure

```
src/
├── components/         # Reusable UI components
├── config/             # Firebase configuration
├── constants/          # Collection names, app constants
├── context/            # AuthContext (user state, role)
├── hooks/              # Custom React hooks
├── navigation/         # Root, Client, Barber, Admin navigators
├── screens/
│   ├── auth/           # Login, Register, RoleSelect, PendingApproval
│   ├── client/         # Home, Booking flow, History, Profile, Styles, StyleChat
│   ├── barber/         # Dashboard, Schedule, CutGuide, Profile
│   ├── admin/          # Dashboard, AI Assistant
│   └── chat/           # ChatScreen
├── services/           # Notifications service
├── types/              # TypeScript interfaces
└── theme.ts            # Design system (colors, fonts, spacing, shadows)
```

---

## Environment Variables

Create a `.env` file at the project root:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_ANTHROPIC_API_KEY=
EXPO_PUBLIC_REPLICATE_API_TOKEN=
EXPO_PUBLIC_IMGBB_API_KEY=
EXPO_PUBLIC_UNSPLASH_ACCESS_KEY=
EXPO_PUBLIC_AI_BACKEND_URL=http://localhost:8080
```

> Never commit `.env` to version control. It is listed in `.gitignore`.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npx expo start --clear

# Scan the QR code with Expo Go (iOS or Android)
```

### EAS Build (Preview APK)

```bash
# Install EAS CLI
npm install -g eas-cli

# Build a preview APK for Android
eas build --platform android --profile preview
```

---

## Design System

- **Background:** `#0A0A0A`
- **Gold accent:** `#D4AF37`
- **Surface:** `#141414`
- **Headings:** Bebas Neue
- **Body:** Inter
- **Icons:** Ionicons only — no emojis in UI

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `users` | All accounts (clients, barbers, admin) |
| `bookings` | Appointments with status, style requests |
| `services` | Menu items with price and duration |
| `conversations` | Real-time chat threads |
| `messages` | Individual chat messages |
| `notifications` | Push notification records |

---

## CI/CD

GitHub Actions runs on every push to `v2-rebuild` and `main`:
- TypeScript check (`npx tsc --noEmit`)
- EAS Build on merge to main
- Deployment to TestFlight (iOS) and Play Store (Android) on production builds

---

## Pre-Launch Checklist

- [ ] Apple Developer Account ($99/year) — required for TestFlight and App Store
- [ ] Google Play Console ($25 one-time) — required for Android store
- [ ] Unsplash Production Access — apply at unsplash.com/oauth/applications for 5000 requests/hour (currently on demo tier, 50/hour)
- [ ] Add production environment variables to EAS dashboard

---

## Client

**613 Barbershop** — 598 Rideau Street, Ottawa, Ontario  
Built by Joshua Fowah
