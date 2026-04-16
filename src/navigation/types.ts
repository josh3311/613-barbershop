import { NavigatorScreenParams } from '@react-navigation/native';

// ─── Auth Stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  RoleSelection: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  BarberLogin: undefined;
};

// ─── Client Tab Navigator ─────────────────────────────────────────────────────

export type ClientTabParamList = {
  Home: undefined;
  Book: undefined;
  History: undefined;
  Profile: undefined;
};

// ─── Client Stack (nested inside each tab) ───────────────────────────────────

export type HomeStackParamList = {
  HomeScreen: undefined;
  BarberDetail: { barberId: string };
  ServiceDetail: { serviceId: string };
};

export type BookStackParamList = {
  SelectService: { barberId: string };
  SelectDateTime: { barberId: string; serviceId: string };
  SelectBarber:   { serviceId: string; scheduledAt: number };
  BookingConfirm: { barberId: string; barberName: string; serviceId: string; scheduledAt: number };
  BookingSuccess: { bookingId: string };
};

export type HistoryStackParamList = {
  HistoryList: undefined;
  HistoryDetail: { historyId: string };
  SubmitReview: { historyId: string; barberId: string };
};

export type ProfileStackParamList = {
  ProfileScreen: undefined;
  EditProfile: undefined;
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

// ─── Root Navigator ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  ClientApp: NavigatorScreenParams<ClientTabParamList>;
  BarberApp: NavigatorScreenParams<BarberTabParamList>;
};

// ─── React Navigation module augmentation ─────────────────────────────────────
// Allows typed useNavigation() throughout the app without explicit generics.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
