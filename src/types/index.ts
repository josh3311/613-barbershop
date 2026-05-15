// ─── User ────────────────────────────────────────────────
export type UserRole   = 'client' | 'barber' | 'admin';
export type UserStatus = 'pending' | 'active' | 'declined';

export interface User {
  id:            string;
  email:         string;
  displayName:   string;
  photoURL:      string | null;
  role:          UserRole;
  phone:         string | null;
  createdAt:     Date;
  status?:       UserStatus;
  expoPushToken?: string;

  // Client-only
  loyaltyStamps?:     number;
  preferredBarberId?: string;
  birthday?:          string;
  savedStyle?: {
    name:               string;
    description:        string;
    whyItFits?:         string;
    fluxPrompt?:        string;
    generatedImageUrl?: string;
    originalSelfieRef?: string;
    prompt?:            string;
    imageQuery?:        string;
    referenceImageUrl?: string;
    tryOnImageUrl?:     string;
    savedAt?:           Date;
  };

  // Barber-only
  bio?:           string;
  specialties?:   string[];
  isAvailable?:   boolean;
  averageRating?: number;   // recalculated on every new review
  reviewCount?:   number;
}

// ─── Service ─────────────────────────────────────────────
export interface Service {
  id:          string;
  name:        string;
  description: string;
  price:       number;
  durationMin: number;
  imageURL:    string | null;
  isActive:    boolean;
}

// ─── HaircutStyle ────────────────────────────────────────
export interface HaircutStyle {
  name:               string;
  description?:       string | null;
  prompt?:            string;
  imageQuery?:        string;
  referenceImageUrl?: string;
  tryOnImageUrl?:     string;
  generatedImageUrl?: string;   // LightX / new FLUX try-on output
  selfieUrl?:         string;   // client's original selfie
  id?:                string;
  photoURL?:          string | null;
  barberNotes?:       string | null;
  aiGenerated?:       boolean;
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
  requestedStyle: HaircutStyle | null;
  rating:         number | null;
  review:         string | null;
  birthdayDiscount?: boolean;
  // Set by StyleDocumentScreen when barber documents the finished style
  styleCardId?:   string | null;
}

// ─── Style Card (post-session documentation) ─────────────
export interface StyleCard {
  id:          string;
  bookingId:   string;
  clientId:    string;
  clientName:  string;
  barberId:    string;
  barberName:  string;
  serviceName: string;
  photoURL:    string;       // Firebase Storage URL of finished style photo
  aiGuide:     string;       // Claude's plain-English reproduction guide
  barberNotes: string | null;
  createdAt:   Date;
}

// ─── AI Chat ─────────────────────────────────────────────
export interface AiChatMessage {
  role:      'user' | 'assistant';
  content:   string;
  createdAt: string; // ISO string for Firestore compatibility
}

export interface AiChatSession {
  id:        string;
  userId:    string;
  title:     string;        // first user message, truncated to 40 chars
  messages:  AiChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Message (barber ↔ client chat) ──────────────────────
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

// ─── Service layer ────────────────────────────────────────
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