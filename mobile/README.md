# DDD AI Dispatch Mobile

Expo admin app for controlling the live DDD AI Dispatch system from iPhone.

## What It Controls

- Rainbow DDD-branded tabbed admin shell
- AI answering on/off
- Admin PIN and live backend URL
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
