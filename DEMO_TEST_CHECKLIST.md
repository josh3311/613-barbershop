# Demo manual test checklist — 613 Barbershop

Use this before the Amir demo. Tick each box when verified.

**Expo Go / device:** Phone and computer should be on the **same Wi‑Fi**. Start the dev server with:

`npm start`

Then scan the QR code in **Expo Go**. If the phone cannot reach the dev server (timeout / “could not connect”), run:

`npm run start:tunnel`

and scan again (works across networks; slower but reliable).

**Firebase:** Ensure `.env` exists (copy from `.env.example`) with all `EXPO_PUBLIC_FIREBASE_*` values filled, then restart Metro after any `.env` change.

---

## Client Flow

- [ ] Register new client account
- [ ] Log in as client
- [ ] Browse services on Book tab
- [ ] Select a service and proceed
- [ ] Select Joseph as barber
- [ ] Pick a date and time
- [ ] Confirm booking — verify it saves to Firestore
- [ ] Check History tab — booking shows as Pending
- [ ] Message Joseph from History
- [ ] Send a message in chat
- [ ] Cancel an appointment

## Barber Flow

- [ ] Log in as Joseph (barber)
- [ ] See new booking on Dashboard
- [ ] Go to Schedule — find the pending booking
- [ ] Confirm the booking
- [ ] Switch back to client — History shows Confirmed
- [ ] Mark client In Chair
- [ ] Mark booking Completed
- [ ] Switch to client — Rate this cut button appears
- [ ] Submit a 5 star rating
- [ ] Verify rating updates on barber profile

## Admin Flow

- [ ] Log in as admin
- [ ] Dashboard shows today's bookings count
- [ ] Dashboard shows correct revenue
- [ ] Joseph's barber card shows correct stats
- [ ] Tap Joseph's card — see his schedule
- [ ] Profile tab shows role: admin

## Chat Flow

- [ ] Client sends message to barber
- [ ] Log in as barber — message appears
- [ ] Barber replies
- [ ] Log in as client — reply appears
- [ ] No errors on any message send
