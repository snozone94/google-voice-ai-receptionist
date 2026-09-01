# DDD AI Dispatch Mobile

Expo admin app for controlling the live DDD AI Dispatch system from iPhone.

## What It Controls

- Rainbow DDD-branded tabbed admin shell
- AI answering on/off
- Access-code login and live backend URL
- Team tab for editing saved tech names/codes
- Run-cost links for Twilio, OpenAI, and Render
- Voice selection
- Speaking speed
- Voice preview
- Greeting
- Business knowledge
- Custom instructions
- DDD booking/app/apply destination links
- Qualifying services and follow-up rules
- Shared inbox preview
- Recent calls, leads, and booking requests
- Daily/weekly/monthly insights preview
- Native push notification registration and test alerts
- Shared inbox replies from the DDD number
- Outbound customer calls that ring the tech first, then show DDD caller ID

## Product Structure

Use this app as the DDD internal app first. Keep one shared backend, then add per-business accounts later for the sellable version. That lets the same codebase support:

- DDD-branded internal app now
- White-label customer accounts later
- Per-business phone numbers, scripts, links, voices, teams, inboxes, and billing when it becomes sellable

## Default Backend

```text
https://google-voice-ai-receptionist.onrender.com
```

You can change this inside the app if the backend moves.

## Callback Number Flow

The app cannot make the native iPhone dialer spoof the DDD number. Instead, the tech enters their own call-back phone on Home. When they tap Call Customer, the backend asks Twilio to call that tech phone first. Once the tech answers, Twilio bridges the customer and uses the configured DDD/Twilio caller ID. The customer sees DDD, not the tech's personal number.

Texts work similarly: replies in Inbox call the backend, and the backend sends the SMS from the configured DDD/Twilio texting number.

## Push Notifications

Native push is wired for new calls, missed/busy calls, customer texts, and test alerts. Local test alerts can appear in development, but real remote push alerts need an installed Expo development/App Store build so the phone can register a production push token. Expo Go is useful for layout testing, but the final push setup belongs in the real iOS build.

## Run For Testing

```bash
cd mobile
npm install
npm run ios
```

For a physical iPhone, run:

```bash
cd mobile
npm start
```

Then scan the Expo QR code with the Expo Go app.

## Before App Store

This is ready as an admin-app starter. Before selling it or putting it in the App Store, add login/auth, persistent database storage, per-business accounts, billing, and production privacy/security wording.
