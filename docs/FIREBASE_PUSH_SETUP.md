# RaktSetu Firebase Web Push setup

This branch replaces WhatsApp donor alerts with browser push notifications. Donors must explicitly enable notifications on each device they want to use.

## 1. Create the Firebase web app

1. Open the Firebase console and create a project for RaktSetu.
2. Add a Web App and copy its Firebase web configuration into `apps/web/.env.local` using the keys in `apps/web/.env.example`.
3. In Firebase Console → Project settings → Cloud Messaging, generate a Web Push certificate key pair. Set its public key as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. In Project settings → Service accounts, create a service-account key for the API. Keep the JSON file outside this repository. Set `GOOGLE_APPLICATION_CREDENTIALS` to its local path and `FIREBASE_PROJECT_ID` in `apps/api/.env`. Never put the service-account JSON in a `NEXT_PUBLIC_*` variable or commit it.

## 2. Configure the API

Set `DONOR_SESSION_SECRET` to a cryptographically random value with at least 32 characters. This signs the donor session returned by the registration endpoint and the one-request response links included in push messages.

Install workspace dependencies with Bun after pulling this branch:

```bash
bun install
```

## 3. Apply the database migration

Before running the new API against an existing database, apply `packages/db/migrations/20261031_fcm_push.sql` in the Supabase SQL Editor. It renames the notification message ID column, removes the obsolete WhatsApp consent field, and creates the device subscription table.

Do not deploy the new API before applying this migration.

## 4. Run locally

- Start the API on port 3002 with Firebase Admin credentials configured.
- Start the Next.js web app on port 3000.
- Open the donor registration page on localhost or an HTTPS origin.
- Complete donor registration, then choose **Enable notifications** on the success screen or donor dashboard.
- Grant browser notification permission.
- Create a test blood request compatible with that donor.
- Verify that a notification appears, then use its action or open it and choose Accept / Not available. The response uses a signed, expiring token and is recorded by the API.

For automated tests, the mock store seeds push subscriptions for its test donors and the push sender records mock deliveries without contacting Firebase.

## Browser behavior

The visual card with large Accept / Decline controls is the RaktSetu response page opened from the native browser notification. Browsers own the notification surface itself, so its styling and action-button support vary by OS and browser. The service worker displays native actions when supported and falls back to opening the response page.

Web push requires a secure context (HTTPS in production; localhost is allowed for local development). iOS web push requires the user to add the web app to the Home Screen and grant notification permission. A donor who has not enabled push on a device will not receive alerts on that device.
