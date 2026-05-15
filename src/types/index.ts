// ─── User ────────────────────────────────────────────────
export type UserRole = 'client' | 'barber' | 'admin';

// Barber approval lifecycle. Missing field is treated as 'pending'.
export type UserStatus = 'pending' | 'active' | 'declined';

export interface User {
  id:            string;
  email:         string;
  displayName:   string;
  photoURL:      string | null;
  role:          UserRole;
  phone:         string | null;
  createdAt:     Date;

  // Approval status (barbers only — clients/admins are implicitly active)
  status?:       UserStatus;

  // Expo push notification token (set on login from notifications service)
  expoPushToken?: string;

  // Client-only
  loyaltyStamps?: number;
  preferredBarberId?: string;
  birthday?:     string; // ISO format: "MM-DD" (e.g. "05-13")
  savedStyle?: {
    name:               string;
    description:        string;
    // ── Current shape (set by StylesScreen v2 — FLUX face-preserved flow) ──
    whyItFits?:         string;
    fluxPrompt?:        string;
    generatedImageUrl?: string;
    originalSelfieRef?: string;
    // ── Legacy fields (older saves from the Unsplash/two-image flow) ──
    prompt?:            string;
    imageQuery?:        string;
    referenceImageUrl?: string;
    tryOnImageUrl?:     string;
    savedAt?:           Date;
  };

  // Barber-only
  bio?:          string;
  specialties?:  string[];
  isAvailable?:  boolean;
}

// ─── Service (haircut menu item) ─────────────────────────
export interface Service {
  id:          string;
  name:        string;
  description: string;
  price:       number;
  durationMin: number;
  imageURL:    string | null;
  isActive:    boolean;
}

// ─── Style (AI feature — client's requested look) ────────
// Attached to a booking via Booking.requestedStyle, and mirrored on
// User.savedStyle (see below). All fields except `name` are optional
// because Claude/Replicate-attached styles only carry a subset.
export interface HaircutStyle {
  name:               string;
  description?:       string | null;
  prompt?:            string;
  imageQuery?:        string;
  referenceImageUrl?: string;
  tryOnImageUrl?:     string;

  // ── LightX / new FLUX flow ──────────────────────────────
  // generatedImageUrl: the AI try-on output (replaces tryOnImageUrl in new saves)
  generatedImageUrl?: string;
  // selfieUrl: the client's original selfie used as the "before" image
  selfieUrl?:         string;

  // Legacy fields kept optional for compatibility with the original schema.
  id?:           string;
  photoURL?:     string | null;
  barberNotes?:  string | null;
  aiGenerated?:  boolean;
}

// ─── Booking ─────────────────────────────────────────────
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface Booking {
  id:             string;
  clientId:       string;
  clientName:     string;
  clientPhotoURL: string | null;
  barberId:       string;
  barberName:     string;
  serviceId:      string;
  serviceName:    string;
  servicePrice:   number;
  status:         BookingStatus;
  scheduledAt:    Date;
  createdAt:      Date;
  notes:          string | null;

  // AI feature — what the client wants
  requestedStyle: HaircutStyle | null;

  // Rating (filled after completion)
  rating:         number | null;
  review:         string | null;

  // Birthday free haircut applied at booking time
  birthdayDiscount?: boolean;
}

// ─── Message (real-time chat) ────────────────────────────
export interface Message {
  id:         string;
  bookingId:  string;
  senderId:   string;
  senderName: string;
  content:    string;
  createdAt:  Date;
  read:       boolean;
}

// ─── Notification ────────────────────────────────────────
export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'new_message'
  | 'booking_completed';

export interface AppNotification {
  id:         string;
  userId:     string;
  type:       NotificationType;
  title:      string;
  body:       string;
  bookingId:  string | null;
  read:       boolean;
  createdAt:  Date;
}

// ─── Service layer wrapper ────────────────────────────────
export interface FirestoreResult<T> {
  data:  T | null;
  error: string | null;
}

// ─── AI Styles tab ───────────────────────────────────────
export interface FaceAnalysis {
  faceShape:    string;
  headSize:     string;
  hairTexture:  string;
  skinTone:     string;
  currentStyle: string;
  faceSummary:  string;
}

export interface StyleRecommendation {
  name:             string;
  year:             string;
  shortDescription: string;
  whyItFits:        string;
  fluxPrompt:       string;
}