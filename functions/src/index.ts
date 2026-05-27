import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

// ── Secret stored in Firebase Secret Manager ──────────────────
// Set it once via: firebase functions:secrets:set SQUARE_ACCESS_TOKEN
const squareToken = defineSecret('SQUARE_ACCESS_TOKEN');

// ── Amir's Square Location ID (from his booking URL) ──────────
const SQUARE_LOCATION_ID = 'LNCQ3EK621DXB';

// ─────────────────────────────────────────────────────────────
export const syncToSquare = onCall(
  { secrets: [squareToken] },
  async (request) => {

    const token = squareToken.value();
    if (!token) {
      throw new HttpsError('failed-precondition', 'Square token not configured');
    }

    const {
      bookingId,
      customerName,
      squareServiceId,
      squareBarberID,
      startAt,
      durationMinutes,
      styleNote,
      tryOnImageUrl,
    } = request.data;

    // Validate required fields
    if (!bookingId || !squareServiceId || !squareBarberID || !startAt) {
      throw new HttpsError('invalid-argument', 'Missing required booking fields');
    }

    // Build the note Amir's team sees in Square dashboard
    let customerNote = `Booked via 613 App | ${customerName}`;
    if (styleNote)     customerNote += ` | Style: ${styleNote}`;
    if (tryOnImageUrl) customerNote += ` | Try-On: ${tryOnImageUrl}`;

    const squarePayload = {
      idempotency_key: bookingId,   // reuse Firestore ID — safe for retries
      booking: {
        location_id:  SQUARE_LOCATION_ID,
        start_at:     startAt,      // ISO 8601 e.g. "2026-05-30T10:00:00-05:00"
        customer_note: customerNote,
        appointment_segments: [
          {
            duration_minutes:          durationMinutes,
            service_variation_id:      squareServiceId,
            team_member_id:            squareBarberID,
            service_variation_version: 1,
          },
        ],
      },
    };

    const response = await fetch('https://connect.squareup.com/v2/bookings', {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify(squarePayload),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      // Log server-side, return generic error to client
      console.error('[Square] API error:', JSON.stringify(result));
      throw new HttpsError('internal', 'Square sync failed', result?.errors ?? []);
    }

    console.log('[Square] Booking synced:', result.booking?.id);
    return { success: true, squareBookingId: result.booking?.id ?? null };
  }
);