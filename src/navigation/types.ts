import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp }    from '@react-navigation/bottom-tabs';
import { HaircutStyle }               from '../types';

// ─── Auth Stack ───────────────────────────────────────────
export type AuthStackParams = {
  Login:      undefined;
  Register:   undefined;
  RoleSelect: { uid: string; email: string };
};

// ─── Client Tabs ─────────────────────────────────────────
export type ClientTabParams = {
  Home:      undefined;
  Book:      undefined;
  Styles:    undefined;
  History:   undefined;
  AIStyler:  undefined;   // ← new AI Stylist chat tab
  Profile:   undefined;
};

// ─── Client Stack ─────────────────────────────────────────
export type ClientStackParams = {
  ClientTabs:          undefined;
  BookingFlow:         { barberId?: string; serviceId?: string };
  BarberSelection:     undefined;
  DateTimeSelection:   undefined;
  BookingConfirm:      undefined;
  BookingSuccess:      undefined;
  Chat:                { bookingId: string; recipientName: string };
  StyleChat:           undefined;
  AddToBooking:        undefined;
  StyleCardView: {     // ← view a post-session style card
    styleCardId: string;
    clientId:    string;
  };
};

// ─── Barber Stack ─────────────────────────────────────────
export type BarberTabParams = {
  Dashboard: undefined;
  Schedule:  undefined;
  Messages:  undefined;
  Profile:   undefined;
};

export type BarberStackParams = {
  BarberTabs:    undefined;
  BookingDetail: { bookingId: string };
  Chat:          { bookingId: string; recipientName: string };
  CutGuide: {
    bookingId:      string;
    serviceName:    string;
    clientName:     string;
    scheduledAt:    string;
    requestedStyle?: HaircutStyle | null;   // ← optional style data
  };
  StyleDocument: {    // ← post-session style documentation
    bookingId:   string;
    clientId:    string;
    clientName:  string;
    barberId:    string;
    barberName:  string;
    serviceName: string;
  };
};

// ─── Admin Stack ──────────────────────────────────────────
export type AdminTabParams = {
  Dashboard: undefined;
  Reviews:   undefined;   // ← new reviews tab
  AI:        undefined;
};

export type AdminStackParams = {
  AdminTabs:  undefined;
  Dashboard:  undefined;
  Reviews:    undefined;
  Analytics:  undefined;
  Services:   undefined;
  AI:         undefined;
};

// ─── Navigation prop helpers ──────────────────────────────
export type AuthNavProp   = NativeStackNavigationProp<AuthStackParams>;
export type ClientNavProp = NativeStackNavigationProp<ClientStackParams>;
export type BarberNavProp = NativeStackNavigationProp<BarberStackParams>;
export type AdminNavProp  = NativeStackNavigationProp<AdminStackParams>;