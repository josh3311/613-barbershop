/**
 * Firestore-triggered Expo push notifications for booking lifecycle.
 * Deploy: from repo root, `firebase deploy --only functions`
 * Optional: set secret EXPO_ACCESS_TOKEN for Expo Push (recommended for production).
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';

initializeApp();
const db = getFirestore();

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade',
  s2: 'Lineup',
  s3: 'Beard Trim',
  s4: 'Haircut',
  s5: 'Beard + Haircut',
};

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

interface BookingDoc {
  clientId?: string;
  clientName?: string;
  barberId?: string;
  barberName?: string;
  serviceId?: string;
  status?: BookingStatus;
  declinedReason?: string | null;
  cancelledBy?: string | null;
}

function expoClient(): Expo {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  return new Expo({ accessToken: accessToken || undefined });
}

async function getExpoTokenForUser(uid: string): Promise<string | null> {
  const snap = await db.collection('users').doc(uid).get();
  const raw = snap.data()?.fcmToken;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return raw;
}

async function sendExpoPush(
  expoPushToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    logger.warn('Skipping invalid Expo push token shape');
    return;
  }
  const expo = expoClient();
  const message: ExpoPushMessage = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
  };
  const chunks = expo.chunkPushNotifications([message]);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          logger.error('Expo ticket error', ticket.message, ticket.details);
        }
      }
    } catch (e) {
      logger.error('sendPushNotificationsAsync failed', e);
    }
  }
}

async function notifyUser(uid: string, title: string, body: string, data: Record<string, string>): Promise<void> {
  const token = await getExpoTokenForUser(uid);
  if (!token) {
    logger.info(`No Expo token stored for user ${uid}; skip push`);
    return;
  }
  await sendExpoPush(token, title, body, data);
}

function serviceLabel(serviceId: string | undefined): string {
  if (!serviceId) return 'Appointment';
  return SERVICE_NAMES[serviceId] ?? 'Appointment';
}

/** New booking (usually pending) → barber */
export const onBookingCreated = onDocumentCreated(
  { document: 'bookings/{bookingId}', region: 'us-central1' },
  async (event) => {
    const bookingId = event.params.bookingId as string;
    const d = event.data?.data() as BookingDoc | undefined;
    if (!d?.barberId || d.status !== 'pending') return;

    const clientName = d.clientName?.trim() || 'A client';
    const svc = serviceLabel(d.serviceId);
    await notifyUser(
      d.barberId,
      'New booking request',
      `${clientName} requested ${svc}.`,
      { bookingId, type: 'booking_new' },
    );
  },
);

/** Status changes → client or barber */
export const onBookingUpdated = onDocumentUpdated(
  { document: 'bookings/{bookingId}', region: 'us-central1' },
  async (event) => {
    const bookingId = event.params.bookingId as string;
    const before = event.data?.before.data() as BookingDoc | undefined;
    const after = event.data?.after.data() as BookingDoc | undefined;
    if (!before || !after) return;

    const prev = before.status;
    const next = after.status;
    if (!next || prev === next) return;

    const clientId = after.clientId;
    const barberId = after.barberId;
    if (!clientId || !barberId) return;

    const barberName = after.barberName?.trim() || 'Your barber';
    const clientName = after.clientName?.trim() || 'Client';

    switch (next) {
      case 'confirmed':
        await notifyUser(clientId, 'Booking confirmed', `${barberName} confirmed your appointment.`, {
          bookingId,
          type: 'booking_confirmed',
        });
        break;
      case 'declined': {
        const reason = after.declinedReason?.trim();
        const body = reason ? `${barberName} declined: ${reason}` : `${barberName} declined your request.`;
        await notifyUser(clientId, 'Booking declined', body, {
          bookingId,
          type: 'booking_declined',
        });
        break;
      }
      case 'in_progress':
        await notifyUser(clientId, 'You’re up', `${barberName} has started your service.`, {
          bookingId,
          type: 'booking_in_progress',
        });
        break;
      case 'completed':
        await notifyUser(clientId, 'Service completed', `Thanks for visiting ${barberName}.`, {
          bookingId,
          type: 'booking_completed',
        });
        break;
      case 'cancelled': {
        const by = after.cancelledBy;
        if (by === 'client') {
          await notifyUser(barberId, 'Booking cancelled', `${clientName} cancelled an appointment.`, {
            bookingId,
            type: 'booking_cancelled_barber',
          });
        } else {
          await notifyUser(clientId, 'Booking cancelled', `Your appointment was cancelled.`, {
            bookingId,
            type: 'booking_cancelled_client',
          });
        }
        break;
      }
      default:
        break;
    }
  },
);
