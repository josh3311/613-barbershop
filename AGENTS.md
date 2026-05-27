# Agent Instructions — 613 Barbershop V3

## Goal
Complete V3 Amir changes: Style with AI, simplified docs, Google Reviews, website sync

## Feature Status
| Feature | Status |
|---------|--------|
| StyleDocumentScreen simplified | DONE |
| Google Reviews redirect | DONE |
| Style with AI (chat + hair try-on) | DONE |
| Tab merge (Styles + AI Chat) | DONE |
| Website booking sync | TODO |

## API Guide
- Claude Haiku: text chat responses (fast, cheap)
- Claude Haiku Vision: image analysis
- gpt-image-1 via /v1/images/edits: hair try-on (takes real photo, returns base64)
- ImgBB: photo hosting fallback
- Firebase Storage: barber profiles, style cards

## Firestore Collections
bookings, users, services, messages, notifications, aiChats, styleCards, barbers
