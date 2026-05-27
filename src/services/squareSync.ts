// src/services/squareSync.ts
// ─────────────────────────────────────────────────────────────
// Fire-and-forget Square Appointments sync via Firebase Cloud Function.
// Errors here are silent — Firestore is the source of truth.
// Fill SERVICE_MAP and BARBER_MAP once Amir provides his Square IDs.
// ─────────────────────────────────────────────────────────────

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../config/firebase';   // ← default export, not named

const functions = getFunctions(app);
const syncToSquare = httpsCallable(functions, 'syncToSquare');

// ── Map app service names → Square catalog variation IDs ──────
// Replace placeholders with real IDs from:
// Square Dashboard → Items & Orders → Items → click service → Variation ID
const SERVICE_MAP: Record<string, { squareServiceId: string; durationMinutes: number }> = {
  'Haircut':            { squareServiceId: 'REPLACE_WITH_SQUARE_VAR_ID', durationMinutes: 30 },
  'Skin Fade':          { squareServiceId: 'REPLACE_WITH_SQUARE_VAR_ID', durationMinutes: 45 },
  'Bald & Beard Combo': { squareServiceId: 'REPLACE_WITH_SQUARE_VAR_ID', durationMinutes: 30 },
  'Shampoo':            { squareServiceId: 'REPLACE_WITH_SQUARE_VAR_ID', durationMinutes: 5  },
  'Beard Trim':         { squareServiceId: 'REPLACE_WITH_SQUARE_VAR_ID', durationMinutes: 20 },
  // Add remaining services — names must match Firestore exactly
};

// ── Map barber Firestore UIDs → Square team member IDs ────────
// Replace placeholders with real IDs from:
// Square Dashboard → Team → click barber → ID in URL (TMxxxxxxxx)
const BARBER_MAP: Record<string, string> = {
  'REPLACE_BARBER_FIRESTORE_UID_1': 'REPLACE_WITH_TM_SQUARE_ID_1',
  'REPLACE_BARBER_FIRESTORE_UID_2': 'REPLACE_WITH_TM_SQUARE_ID_2',
};

// ── Payload shape ─────────────────────────────────────────────
export interface SquareSyncPayload {
  bookingId:      string;
  customerName:   string;
  customerEmail?: string;
  serviceName:    string;
  barberId:       string;
  startAt:        string;   // ISO 8601
  styleNote?:     string;
  tryOnImageUrl?: string;
}

// ── Main export ───────────────────────────────────────────────
export async function syncBookingToSquare(payload: SquareSyncPayload): Promise<void> {
  const serviceInfo    = SERVICE_MAP[payload.serviceName];
  const squareBarberID = BARBER_MAP[payload.barberId];

  if (!serviceInfo || !squareBarberID) {
    console.warn(
      `[Square] Unmapped service ("${payload.serviceName}") or barber ("${payload.barberId}") — skipping`
    );
    return;
  }

  // Guard: skip if placeholders haven't been replaced yet
  if (
    serviceInfo.squareServiceId.startsWith('REPLACE') ||
    squareBarberID.startsWith('REPLACE')
  ) {
    console.warn('[Square] Placeholder IDs still present — sync skipped until Amir provides real IDs');
    return;
  }

  try {
    const result = await syncToSquare({
      bookingId:       payload.bookingId,
      customerName:    payload.customerName,
      squareServiceId: serviceInfo.squareServiceId,
      squareBarberID,
      startAt:         payload.startAt,
      durationMinutes: serviceInfo.durationMinutes,
      styleNote:       payload.styleNote     ?? '',
      tryOnImageUrl:   payload.tryOnImageUrl ?? '',
    });

    console.log('[Square] Sync result:', result.data);
  } catch (e) {
    // Never surface to user — Firestore booking already saved
    console.warn('[Square] Sync exception (booking still saved in Firestore):', e);
  }
}