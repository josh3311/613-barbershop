// ─── User ────────────────────────────────────────────────
export type UserRole = 'client' | 'barber' | 'admin';

export interface User {
  id:            string;
  email:         string;
  displayName:   string;
  photoURL:      string | null;
  role:          UserRole;
  phone:         string | null;
  createdAt:     Date;

  // Client-only
  loyaltyStamps?: number;
  preferredBarberId?: string;

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
export interface HaircutStyle {
  id:           string;
  name:         string;
  photoURL:     string | null;
  description:  string | null;
  barberNotes:  string | null;
  aiGenerated:  boolean;
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