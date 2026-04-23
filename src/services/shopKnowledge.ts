/**
 * Static knowledge base injected into the AI stylist system prompt (RAG-style context).
 * Keep aligned with in-app services, pricing, and policies.
 */
export const SHOP_KNOWLEDGE = `
613 BARBERSHOP — REFERENCE FOR CLIENT QUESTIONS

LOCATION
- Address: 598 Rideau St, Ottawa, ON K1N 6A2, Canada.
- When clients ask where the shop is, give this full street address.

SERVICES AND PRICING
- Fade — $40, 30 minutes.
- Haircut — $35, 45 minutes.
- Beard Trim — $25, 20 minutes.
- Beard + Cut — $50, 60 minutes.

BARBER SERVICES
- Professional cuts, shape-ups, fades, and beard trimming; quality-focused service by appointment.

LOYALTY PROGRAM
- Every 7 completed paid visits earns one free haircut, tracked automatically in the app (stamp progress).
- When relevant, remind clients of this benefit.

BOOKING
- Real-time booking through the app; each appointment is confirmed by the barber after the client requests a time.
- Clients may cancel free of charge up to 2 hours before the scheduled appointment.

BARBERS
- Barber profiles and specialties are available in the app for clients to browse when booking.

AI FEATURES (613 APP)
- Photo-based style analysis, personalized style recommendations with real reference photos, and AI stylist chat for advice.

ROADMAP (FOR CONTEXT ONLY — DO NOT QUOTE DATES)
- The product team may expand features and locations over time; do not promise specific launch dates.
`.trim();
