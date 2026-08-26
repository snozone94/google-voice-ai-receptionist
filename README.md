# Google Voice Forwarded AI Receptionist

This is a starter for owning your own Smith.ai-style answering assistant where **Google Voice remains the public number**.

The call path is:

```text
Caller -> Google Voice number -> forwarded AI number -> OpenAI Realtime SIP -> this webhook
```

The browser voice widget is included only as a local test harness so you can tune the receptionist without placing phone calls.

## Cost Reality

You can avoid Smith.ai and Twilio. Google Voice cannot directly stream a live call into your app, so the forwarded AI number still has to come from one of these:

- A low-cost SIP number/trunk
- A PBX you already control
- A Google Workspace Voice SIP Link setup, if you already have that admin-level infrastructure

For this architecture, your recurring costs are the AI forwarding number/SIP route plus OpenAI Realtime API usage.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Then open:

```text
http://localhost:8787
```

Edit `config/business.json` to teach the receptionist your hours, FAQs, services, and escalation rules.

## Google Voice Forwarding

1. Get an AI forwarding number from a SIP provider or phone system that can route inbound calls to OpenAI Realtime SIP.
2. In Google Voice, add that AI forwarding number as a linked number.
3. Complete Google's verification call or SMS. If needed, temporarily route the AI number to your cell phone for this step.
4. In Google Voice settings, turn on forwarding to the AI number.
5. If you only want the AI to answer some calls, use Google Voice custom call forwarding rules.
6. Point OpenAI webhooks to this app:

```text
https://your-domain.example/openai/sip-webhook
```

7. Set `OPENAI_WEBHOOK_SECRET` in `.env`.

When OpenAI sends `realtime.call.incoming`, this app accepts the call with your business instructions.

## Local Test Call

Open `http://localhost:8787` and click "Start voice call".

This lets you test the same AI receptionist from your browser before wiring phone forwarding.

The browser page creates a WebRTC offer and sends it to `/api/webrtc-offer`.
The server forwards that offer to OpenAI's Realtime Calls endpoint with your receptionist instructions.

## Lead Capture

Manual lead capture from the web page writes JSON lines to:

```text
data/leads.jsonl
```

The voice assistant also has a `save_lead` Realtime tool. After the caller confirms their details, the assistant can save the lead automatically.

Call activity and summaries are stored in:

```text
data/calls.jsonl
data/summaries.jsonl
```

Optional outbound webhooks:

```text
LEAD_WEBHOOK_URL=https://your-crm-or-automation-webhook.example/leads
CALL_SUMMARY_WEBHOOK_URL=https://your-crm-or-automation-webhook.example/calls
```

## Recommended Production Shape

- Keep your Google Voice number as the number customers know.
- Forward it to one AI number.
- Keep one human backup number in Google Voice for contacts or emergency rules.
- Use Google Voice custom forwarding rules for VIPs, spam-heavy contacts, and after-hours behavior.
- Store call summaries and leads in a database, CRM, Google Sheet, or email notification instead of the local JSONL file.
- Set `LEAD_WEBHOOK_URL` and `CALL_SUMMARY_WEBHOOK_URL` to push data into your CRM or automation tool.

## Deploy

Any Node host works: Render, Fly.io, Railway, a VPS, or your own server. Use HTTPS for microphone access and webhooks.

This starter includes:

```text
Dockerfile
render.yaml
fly.toml.example
```

Environment variables:

```text
OPENAI_API_KEY
OPENAI_WEBHOOK_SECRET
PORT
PUBLIC_BASE_URL
BUSINESS_NAME
BUSINESS_PHONE
GOOGLE_VOICE_NUMBER
AI_FORWARDING_NUMBER
TRANSFER_SIP_URI
LEAD_WEBHOOK_URL
CALL_SUMMARY_WEBHOOK_URL
```
