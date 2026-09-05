# DDD AI Dispatch

This is a starter for DDD to own a Smith.ai-style answering assistant where **513-409-1342 remains the public number** after it ports to Twilio.

The call path is:

```text
Caller -> 513-409-1342 on Twilio -> OpenAI Realtime SIP -> this webhook
```

The browser voice widget is included only as a local test harness so you can tune the receptionist without placing phone calls.

## Cost Reality

Google Voice cannot directly stream a live call into your app. The current production path uses Twilio for the phone number, SMS, and SIP handoff, then OpenAI Realtime for the AI receptionist voice.

Once wired, the receptionist can run by itself for normal answering, intake, booking creation, SMS follow-up, and lead capture. You still need to keep OpenAI billing active, keep the Twilio balance active, and update the dashboard when DDD details, links, pricing, or policies change. For production reliability, use always-on hosting and persistent storage for settings/leads.

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

Use the admin dashboard to turn answering on/off, choose the voice, preview the voice, change speaking speed, edit the greeting, update business knowledge, tune caller handling, and maintain booking/app/apply destination links.
Edit `config/business.json` only for deeper defaults like hours, FAQs, services, and escalation rules.
Set `BOOKING_URL` if you already have a scheduler. If it is blank, the assistant uses the built-in booking request page at `/api/book` after deployment.

## AI-Created Bookings

The AI can create the booking during the call. It stores a local booking record first, then optionally syncs that same booking into the DDD website/portal system.

For the DDD WordPress platform, use:

```text
DDD_BOOKING_WEBHOOK_URL=https://dddcincy.com/wp-json/ddd/v1/booking-job
```

The payload is compatible with the existing DDD platform fields:

```text
customer_name
customer_phone
customer_email
service_type
vehicle
service_address
preferred_time
notes
lead_source=Phone call
```

That lets the website create the normal DDD job, notify tech/admin flows, and match customer bookings by phone/email in the customer app/portal.

For the AutoHub business-job intake API, use:

```text
DDD_BOOKING_WEBHOOK_URL=https://ddd-auto-hub-you-are-an.vercel.app/api/business-jobs/intake
AUTOHUB_INTAKE_API_KEY=your-intake-key
```

Customer/app lookup is available for a trusted app backend with:

```text
GET /api/customer/bookings?phone=+15135551212
x-customer-lookup-secret: your-secret
```

Each AI booking also gets a private status URL:

```text
/api/bookings/:bookingId/status?token=private-token
```

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

## iPhone Admin App

The `mobile/` folder contains an Expo iOS admin app that talks to the live Render backend. It lets you control answering, voice, speaking speed, voice previews, greeting, business knowledge, DDD destination links, follow-up rules, and recent activity from a phone.

```bash
cd mobile
npm install
npm run ios
```

For physical iPhone testing, use `npm start` and scan the Expo QR code with Expo Go.

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
data/bookings.jsonl
```

Optional outbound webhooks:

```text
LEAD_WEBHOOK_URL=https://your-crm-or-automation-webhook.example/leads
CALL_SUMMARY_WEBHOOK_URL=https://your-crm-or-automation-webhook.example/calls
SMS_FOLLOWUP_WEBHOOK_URL=https://your-sms-automation-webhook.example/send
DDD_BOOKING_WEBHOOK_URL=https://dddcincy.com/wp-json/ddd/v1/booking-job
DDD_BOOKING_WEBHOOK_SECRET=optional-shared-secret
CUSTOMER_LOOKUP_SECRET=shared-secret-for-ddd-mobile-backend
DDD_PHOTO_UPLOAD_BASE_URL=https://dddcincy.com/customer-photo-upload/
DDD_PHOTO_UPLOAD_WEBHOOK_URL=https://dddcincy.com/wp-json/ddd/v1/ai-booking-photos
DDD_CUSTOMER_HISTORY_URL=https://dddcincy.com/wp-json/ddd/v1/customer-history
VOIPMS_API_USERNAME=bria@dddcincy.com
VOIPMS_API_PASSWORD=your-voip-ms-api-password
VOIPMS_SMS_DID=5136445016
```

Cheapest SMS option: use the same VoIP.ms account. Outbound follow-up texts use the VoIP.ms `sendSMS` API from `VOIPMS_SMS_DID`, which avoids Twilio. VoIP.ms still requires API access to be enabled, the Render outbound IP/domain to be allowed in the VoIP.ms API settings, and any required business texting/A2P approval for production business SMS.

## Tech Team Sync

The shared inbox should use DDD Platform/TechAssist as the source of truth for real tech access. The WordPress platform already stores TechAssist admin access and technician setup codes/tokens hashed, so AI Dispatch should validate against those routes instead of copying raw codes.

Configure AI Dispatch with:

```text
DDD_TECH_AUTH_URL=https://dddcincy.com/wp-json/ddd/v1/tech-auth-test
DDD_TECH_TEAM_URL=https://dddcincy.com/wp-json/ddd/v1/techs
DDD_TECH_TEAM_TOKEN=private-tech-token-or-setup-code-that-can-list-the-team
```

When `DDD_TECH_AUTH_URL` is set, staff can sign into AI Dispatch with the same TechAssist setup code/token. AI Dispatch sends that code to the WordPress endpoint and WordPress validates it with its existing hashed-token logic. When `DDD_TECH_TEAM_URL` and `DDD_TECH_TEAM_TOKEN` are set, AI Dispatch loads the live DDD roster, availability, profile phone, device name, and last-seen data for the Team tab.

Customer photo uploads avoid MMS costs. Every booking gets a private `photoUploadUrl` based on the booking token. The follow-up SMS can include `{{photoUploadLink}}`, customers upload photos from their browser, and the admin call detail shows the upload link plus saved photo links.

Use `DDD_PHOTO_UPLOAD_BASE_URL` when the customer-facing upload link should show a `dddcincy.com` page instead of the Render backend. The branded page should pass the `booking` and `token` query params through to the Render upload flow or embed that flow in an iframe. Use `DDD_PHOTO_UPLOAD_WEBHOOK_URL` when the DDD Platform exposes an endpoint that can attach uploaded photo metadata to the real booking/job record.

Use `DDD_CUSTOMER_HISTORY_URL` when the DDD Platform exposes a phone lookup endpoint for prior jobs, vehicles, oil type, oil quantity, and repeat services. AI Dispatch will merge that platform history with local AI Dispatch bookings so returning customers can be recognized during intake.

The included WordPress bridge plugin at `wordpress/ddd-ai-dispatch-bridge.php` creates the branded `customer-photo-upload` page and adds:

```text
GET  /wp-json/ddd/v1/customer-history
POST /wp-json/ddd/v1/ai-booking-photos
```

After installing that bridge on `dddcincy.com`, set these Render env vars:

```text
DDD_PHOTO_UPLOAD_BASE_URL=https://dddcincy.com/customer-photo-upload/
DDD_PHOTO_UPLOAD_WEBHOOK_URL=https://dddcincy.com/wp-json/ddd/v1/ai-booking-photos
DDD_CUSTOMER_HISTORY_URL=https://dddcincy.com/wp-json/ddd/v1/customer-history
```

Manual `STAFF_ACCESS_CODES` remain only as emergency backup codes so the inbox still works if WordPress is down or team sync is temporarily unavailable.

Missed/busy/no-answer calls can trigger an automatic fallback text through Twilio. It is on by default when Twilio SMS is configured. Set `MISSED_CALL_SMS_ENABLED=false` to disable it or `MISSED_CALL_SMS_MESSAGE` to customize the wording. STOP language is appended automatically.

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
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_SMS_FROM
TWILIO_VOICE_FROM
ADMIN_PIN
ADMIN_STAFF_NAME
STAFF_ACCESS_CODES
BOOKING_URL
TRANSFER_SIP_URI
LEAD_WEBHOOK_URL
CALL_SUMMARY_WEBHOOK_URL
DDD_BOOKING_WEBHOOK_URL
DDD_BOOKING_WEBHOOK_SECRET
CUSTOMER_LOOKUP_SECRET
DDD_TECH_AUTH_URL
DDD_TECH_TEAM_URL
DDD_TECH_TEAM_TOKEN
DDD_TECH_TEAM_SECRET
DDD_PHOTO_UPLOAD_BASE_URL
DDD_PHOTO_UPLOAD_WEBHOOK_URL
DDD_CUSTOMER_HISTORY_URL
ALERT_EMAIL_TO
SMTP_USER
GMAIL_APP_PASSWORD
SMTP_HOST
SMTP_PORT
SMTP_FROM
EARLY_HANGUP_ALERT_SECONDS
COMPLETED_CALL_SMS_ENABLED
COMPLETED_CALL_SMS_MESSAGE
CALL_FOLLOWUP_SMS_DEDUPE_MINUTES
CALL_START_SMS_ENABLED
CALL_START_SMS_MESSAGE
CALL_START_SMS_DEDUPE_MINUTES
```

`ADMIN_PIN` controls settings edits. `DDD_TECH_AUTH_URL` / `DDD_TECH_TEAM_URL` connect AI Dispatch to DDD Platform/TechAssist. `STAFF_ACCESS_CODES` is a backup-only fallback for Inbox access with a comma-separated list like `Backup Owner:1111,Backup Tech:2222`.

Outbound calls from the mobile app use Twilio to call the staff member first, then bridge to the customer with `TWILIO_VOICE_FROM` as caller ID. Use the same Twilio number as `TWILIO_SMS_FROM` if you want texts and outbound calls to show the same DDD number.

Native app push alerts use Expo push tokens. The mobile app registers a phone through `POST /api/push/register`; the backend sends alerts for new calls, missed/busy calls, incoming texts, and manual test alerts. Real remote push notifications need an installed Expo development/App Store build so iOS can issue a usable push token.

Email fallback alerts can notify `dddroadhelp@gmail.com` when browser or iOS notifications are missed. For Gmail, enable 2-step verification on the Gmail account, create a Gmail App Password, then set these Render environment variables:

```text
ALERT_EMAIL_TO=dddroadhelp@gmail.com
SMTP_USER=dddroadhelp@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_FROM=dddroadhelp@gmail.com
EARLY_HANGUP_ALERT_SECONDS=30
```

Incoming calls trigger a team alert as soon as Twilio reaches the voice webhook. `CALL_START_SMS_ENABLED` controls whether the caller also receives a short reply-able safety-net text at call start. Missed, busy, no-answer, canceled, failed, and very short completed calls trigger team alerts and the missed-call fallback SMS so the caller shows in the inbox for follow-up. Completed inbound calls also send a team alert, and `COMPLETED_CALL_SMS_ENABLED` controls whether the backend sends a short "reply here" text when no outbound SMS was already sent to that caller recently.

Twilio incoming SMS webhook:

```text
https://google-voice-ai-receptionist.onrender.com/api/twilio/sms
```

Twilio signs webhook requests, so the backend can accept this clean URL when `TWILIO_AUTH_TOKEN` is set. The older `?secret=TWILIO_SMS_WEBHOOK_SECRET` URL also still works as a fallback.

Twilio voice webhook:

```text
https://google-voice-ai-receptionist.onrender.com/api/twilio/voice
```

Set `TRANSFER_SIP_URI` or `OPENAI_SIP_URI` to the OpenAI SIP destination. The Twilio webhook logs the incoming call, dials the SIP destination, and sends call status/recording callbacks back into the admin dashboard.
