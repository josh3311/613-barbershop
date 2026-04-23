import { NavigatorScreenParams } from '@react-navigation/native';
import type { ProfileAnalysisResult } from '@/services/ai.service';

// ─── Auth Stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  BarberLogin: undefined;
};

// ─── Client Tab Navigator ─────────────────────────────────────────────────────

export type StyleStackParamList = {
  StyleOnboarding: undefined;
  StyleResults: {
    analysis: ProfileAnalysisResult;
    readOnly?: boolean;
    selfieUri?: string;
    /** Raw base64 data URL saved to Firestore on "Save profile" (no Storage). */
    selfieDataUrl?: string;
  };
  /** Omit params to load saved `styleProfile` from Firestore, or start with an empty profile. */
  StyleChat: {
    analysis?: ProfileAnalysisResult;
    recommendationPhotos?: Record<string, string>;
  };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
};

export type ClientTabParamList = {
  Home: undefined;
  Book: undefined;
  Style: NavigatorScreenParams<StyleStackParamList>;
  History: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// ─── Client Stack (nested inside each tab) ───────────────────────────────────

export type HomeStackParamList = {
  HomeScreen: undefined;
  BarberDetail: { barberId: string };
  ServiceDetail: { serviceId: string };
};

export type BookStackParamList = {
  /** Step 1 — pick a service (no barber yet). */
  SelectService: undefined;
  /** Step 2 — pick barber (photo + name). */
  SelectBarber: { serviceId: string };
  /** Step 3 — date/time filtered by that barber's working hours. */
  SelectDateTime: { barberId: string; serviceId: string; barberName: string };
  BookingConfirm: { barberId: string; barberName: string; serviceId: string; scheduledAt: number };
  BookingSuccess: { bookingId: string };
};

/** Params for `ChatScreen` — same shape in client History stack and barber Schedule stack */
export type ChatRouteParams = {
  clientId: string;
  clientName: string;
  barberId: string;
  barberName: string;
  bookingId?: string;
};

export type HistoryStackParamList = {
  HistoryList: undefined;
  HistoryDetail: { historyId: string };
  SubmitReview: { historyId: string; barberId: string };
  Chat: ChatRouteParams;
};

export type ScheduleStackParamList = {
  ScheduleList: undefined;
  Chat: ChatRouteParams;
};

// ─── Barber Tab Navigator ─────────────────────────────────────────────────────

export type BarberTabParamList = {
  Dashboard: undefined;
  Schedule: undefined;
  Clients: undefined;
  BarberProfile: undefined;
};

export type DashboardStackParamList = {
  DashboardScreen: undefined;
  BookingDetail: { bookingId: string };
};

// ─── Admin (shop owner) ───────────────────────────────────────────────────────

export type AdminStackParamList = {
  AdminDashboardMain: undefined;
  BarberTodaySchedule: { barberId: string; barberName: string };
};

export type AdminTabParamList = {
  Dashboard: undefined;
  AdminProfile: undefined;
};

// ─── Root Navigator ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  ClientApp: NavigatorScreenParams<ClientTabParamList>;
  BarberApp: NavigatorScreenParams<BarberTabParamList>;
  AdminApp: NavigatorScreenParams<AdminTabParamList>;
};

// ─── React Navigation module augmentation ─────────────────────────────────────
// Allows typed useNavigation() throughout the app without explicit generics.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
