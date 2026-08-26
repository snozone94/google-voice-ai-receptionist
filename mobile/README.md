# DDD AI Receptionist Mobile

Expo admin app for controlling the live DDD AI receptionist from iPhone.

## What It Controls

- AI answering on/off
- Voice selection
- Speaking speed
- Voice preview
- Greeting
- Business knowledge
- Custom instructions
- DDD booking/app/apply destination links
- Qualifying services and follow-up rules
- Recent calls, leads, and booking requests

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
