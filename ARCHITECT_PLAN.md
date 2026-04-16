# 613 Barbershop — Architecture Plan

**Session note (agents):** Read this file at the start of work in this repo so implementation stays aligned with the agreed navigation, Firestore schema, and types. Pair with `PROJECT_STATUS.md` for what to build this sprint.

**Audience:** Architect Agent (data models, navigation, Firebase schema)  
**Stack:** React Native (Expo), TypeScript (strict), Firebase Auth, Firestore, Storage

---

## Navigation structure

Navigation is implemented with **React Navigation** (`@react-navigation/native`, native stack, bottom tabs). Param lists live in `src/navigation/types.ts` and are augmented globally so `useNavigation()` stays typed.

### Root

| Route | Purpose |
| --- | --- |
| `Auth` | Unauthenticated flows (role selection, login, register, barber login, forgot password) |
| `ClientApp` | Bottom tabs for clients (`Home`, `Book`, `History`, `Profile`) |
| `BarberApp` | Bottom tabs for barbers/admins (`Dashboard`, `Schedule`, `Clients`, `BarberProfile`) |

The root navigator chooses `Auth` vs `ClientApp` vs `BarberApp` from Firebase Auth plus the Firestore `users` document (`role`: `client` | `barber` | `admin`).

### Auth stack (`AuthStackParamList`)

| Screen | Params |
| --- | --- |
| `RoleSelection` | — |
| `Login` | — |
| `Register` | — |
| `ForgotPassword` | — |
| `BarberLogin` | — |

### Client tabs (`ClientTabParamList`)

| Tab | Notes |
| --- | --- |
| `Home` | Discovery; nested stacks can add `BarberDetail`, `ServiceDetail` (see `HomeStackParamList`) |
| `Book` | Booking flow (see `BookStackParamList`) |
| `History` | Past cuts and reviews (see `HistoryStackParamList`) |
| `Profile` | Account (see `ProfileStackParamList`) |

**Nested client stacks (param types only; wire nested navigators as screens grow):**

- **Home:** `HomeScreen`, `BarberDetail { barberId }`, `ServiceDetail { serviceId }`
- **Book:** `SelectService { barberId }` → `SelectDateTime { barberId, serviceId }` → `SelectBarber { serviceId, scheduledAt }` → `BookingConfirm { barberId, barberName, serviceId, scheduledAt }` → `BookingSuccess { bookingId }`
- **History:** `HistoryList`, `HistoryDetail { historyId }`, `SubmitReview { historyId, barberId }`
- **Profile:** `ProfileScreen`, `EditProfile`

### Barber tabs (`BarberTabParamList`)

| Tab | Notes |
| --- | --- |
| `Dashboard` | Today’s queue; `DashboardStackParamList` includes `BookingDetail { bookingId }` |
| `Schedule` | Calendar / day view |
| `Clients` | Client list / history shortcuts |
| `BarberProfile` | Barber-facing profile and settings |

---

## Firebase schema (Firestore)

All **document IDs are strings** (typically Auth `uid` for `users`; barber docs often mirror `users` id). All **stored dates use `Timestamp`** (`firebase/firestore`).

| Collection | Document ID | Purpose |
| --- | --- | --- |
| `users` | Auth `uid` | Profile, `role`, contact, `fcmToken`, audit timestamps |
| `barbers` | String (often same as `userId`) | Bio, specialties, `workingHours`, ratings, availability |
| `services` | Auto-ID or string | Catalog: price, duration, category, `isActive` |
| `bookings` | Auto-ID or string | Client ↔ barber appointment: status, `scheduledAt`, price snapshot |
| `haircutHistory` | Auto-ID or string | Completed visit record: photos, optional client `rating` / `review` |

Constants: `src/constants/collections.ts` (`COLLECTIONS`).

### Suggested indexes (composite)

Create as the app adds queries (Firebase Console → Firestore → Indexes):

- `bookings`: `clientId` + `scheduledAt` (desc); `barberId` + `scheduledAt`; `barberId` + `scheduledAt` range filters for day queries
- `haircutHistory`: `clientId` + `completedAt` (desc); `barberId` + `completedAt` (desc)

---

## TypeScript data models

Source of truth: `src/types/*.types.ts` (re-exported from `src/types/index.ts`).

| Domain | Key interfaces |
| --- | --- |
| Shared | `UserRole`, `WorkingHours`, `FirestoreResult<T>` |
| Users | `User`, `CreateUserPayload`, `UpdateUserPayload` |
| Barbers | `Barber`, create/update payloads |
| Services | `Service`, `ServiceCategory`, create/update payloads |
| Bookings | `Booking`, `BookingStatus`, `CreateBookingPayload`, status updates |
| History | `HaircutHistory`, `CreateHaircutHistoryPayload`, `SubmitReviewPayload` |

**Rules:** Strict typing; avoid `any`. Services and converters live under `src/services/` with Firestore converters for typed reads/writes.

---

## Storage (Firebase Storage)

Path constants: `src/constants/app.ts` (`STORAGE_PATHS`) — avatars, haircut before/after photos, service images. Store **download URLs** in Firestore on the relevant documents.

---

## Revision

Update this file when navigation param lists or Firestore fields change so architect and implementation stay aligned.
