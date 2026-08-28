# Production Checklist

## Before Calls

- Edit `config/business.json`.
- Set `OPENAI_API_KEY`.
- Deploy the app behind HTTPS.
- Confirm `/health` returns `{ "ok": true }`.
- Confirm Render has a persistent disk mounted at `/var/data` and `DATA_DIR=/var/data/ddd-ai-dispatch`, so saved admin settings/logs show on desktop and phone and survive deploys.
- Confirm the browser test call works from `/`.

## Google Voice

- Add the AI forwarding number as a linked number.
- Complete the verification call or SMS.
- Turn forwarding on.
- Disable call screening for the AI forwarding path.
- Decide whether calls should always forward or only forward under custom rules.

## AI Forwarding Number

- Confirm the number can receive inbound calls.
- Confirm inbound calls route to OpenAI Realtime SIP.
- Confirm OpenAI sends webhooks to `/openai/sip-webhook`.
- Set `OPENAI_WEBHOOK_SECRET`.
- Enable Twilio call recording only after consent/legal wording is decided, and send the recording callback to `/api/twilio/recording?secret=TWILIO_SMS_WEBHOOK_SECRET` so audio links appear in the admin Calls tab.
- Call the AI forwarding number directly before testing through Google Voice.

## Launch Test

- Call the Google Voice number from a non-linked phone.
- Confirm the AI answers.
- Ask a common FAQ.
- Ask for a callback, confirm your details, and verify the lead appears on the dashboard.
- Hang up and confirm the call appears under recent activity.

## After Launch

- Set `LEAD_WEBHOOK_URL` to send leads into a CRM, Google Sheet automation, email tool, or database.
- Set `CALL_SUMMARY_WEBHOOK_URL` for call summary notifications.
- Add a human handoff route for urgent calls.
- Review call recording and consent requirements for your state and caller locations before turning recording on.
