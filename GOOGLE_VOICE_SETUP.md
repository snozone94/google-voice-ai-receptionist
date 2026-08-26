# Google Voice Forwarding Setup

Use this when you want Google Voice to stay as the public-facing number, while the AI answers on a separate forwarding number.

## Call Flow

```text
Customer dials your Google Voice number
Google Voice forwards the call to your AI forwarding number
The AI forwarding number routes to OpenAI Realtime SIP
OpenAI sends this app a realtime.call.incoming webhook
This app accepts the call with your receptionist instructions
The caller talks to the AI
```

## What You Need

- Your existing Google Voice number
- One AI forwarding number that can receive calls over SIP
- An OpenAI API key
- A public HTTPS URL for this app
- OpenAI webhook secret
- Your DDD booking link

## Google Voice Steps

1. Go to `voice.google.com` on a computer.
2. Open Settings.
3. Under linked numbers, add the AI forwarding number.
4. Complete the verification call or SMS.
5. Turn forwarding on for the AI number.
6. Optional: create custom forwarding rules for specific contacts or contact labels.

## Verification Tip

Google Voice may call or text the AI forwarding number to verify it. If the AI/SIP route is not ready yet, temporarily point that number to your cell phone, complete verification, then point it back to the AI route.

## AI Route Steps

1. Configure the AI forwarding number to send inbound calls to OpenAI Realtime SIP.
2. Configure OpenAI webhooks to send events to:

```text
https://your-domain.example/openai/sip-webhook
```

3. Set these environment variables:

```text
OPENAI_API_KEY=...
OPENAI_WEBHOOK_SECRET=...
GOOGLE_VOICE_NUMBER=...
AI_FORWARDING_NUMBER=...
BOOKING_URL=...
```

4. Start the app:

```bash
npm install
npm run start
```

## Testing

Test in this order:

1. Open `/health` on your deployed URL.
2. Use the browser test call at `/`.
3. Call the AI forwarding number directly.
4. Call the Google Voice number and confirm it forwards.

## Important Limit

Google Voice itself does not provide the live-call programming layer. It is only forwarding the call. The programmable answering happens after the call reaches the AI forwarding number.
