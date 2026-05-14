import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// ─── Auth Stack ───────────────────────────────────────────
export type AuthStackParams = {
  Login:      undefined;
  Register:   undefined;
  RoleSelect: { uid: string; email: string };
};

// ─── Client Stack ─────────────────────────────────────────
export type ClientTabParams = {
  Home:    undefined;
  Book:    undefined;
  History: undefined;
  Profile: undefined;
};

export type ClientStackParams = {
  ClientTabs:    undefined;
  BookingFlow:   { barberId?: string; serviceId?: string };
  Chat:          { bookingId: string; recipientName: string };
  StylePicker:   { bookingId: string };
};

// ─── Barber Stack ─────────────────────────────────────────
export type BarberTabParams = {
  Dashboard: undefined;
  Schedule:  undefined;
  Chat:      undefined;
  Profile:   undefined;
};

export type BarberStackParams = {
  BarberTabs:     undefined;
  BookingDetail:  { bookingId: string };
  Chat:           { bookingId: string; recipientName: string };
  CutGuide: {
    bookingId:    string;
    serviceName:  string;
    clientName:   string;
    scheduledAt:  string;
  };
};

// ─── Admin Stack ──────────────────────────────────────────
export type AdminStackParams = {
  Dashboard:  undefined;
  Users:      undefined;
  Analytics:  undefined;
  Services:   undefined;
};

// ─── Navigation prop helpers ──────────────────────────────
export type AuthNavProp    = NativeStackNavigationProp<AuthStackParams>;
export type ClientNavProp  = NativeStackNavigationProp<ClientStackParams>;
export type BarberNavProp  = NativeStackNavigationProp<BarberStackParams>;
export type AdminNavProp   = NativeStackNavigationProp<AdminStackParams>;