# DDD AI Dispatch TODO

## Production Now

- [x] Upgrade the Render service from Free to Starter so the persistent disk can attach.
- [x] Confirm `DATA_DIR=/var/data/ddd-ai-dispatch` is set on Render.
- [x] Confirm `/api/setup-status` shows `persistentStorage: true`.
- [ ] Confirm desktop admin edits show on phone browser after reload.
- [ ] Add Twilio voice status callback to the active number: `/api/twilio/call-status?secret=TWILIO_SMS_WEBHOOK_SECRET`.
- [ ] Confirm Twilio recording callback is wired: `/api/twilio/recording?secret=TWILIO_SMS_WEBHOOK_SECRET`.
- [ ] Deploy the DDD platform `/api/technicians` GET endpoint and set `DDD_TECH_TEAM_URL` / `DDD_TECH_TEAM_SECRET` on AI Dispatch.
- [ ] Run a live call test from a non-linked phone and confirm call log, intake, transcript, and SMS behavior.

## Smith-Level Features

- [x] Voice selection, preview, and speaking speed.
- [x] AI answering on/off switch.
- [x] Editable greeting, voice direction, business knowledge, caller flows, and follow-up text.
- [x] Free script/dry-run testing that does not spend phone call quota.
- [x] Better caller outcome rules for booking, existing customer, sales, apply-to-work, and other callers.
- [x] Missed-call/fallback rules for busy, failed, no-answer, dropped, or incomplete calls.
- [x] Admin call log with intake, recordings, transcripts, and call details.
- [x] Shared inbox with separate staff codes, replies, typing, and status.
- [x] Shared inbox can use DDD platform/Tech Assist team sync when configured, with manual codes as fallback.
- [x] QA dashboard with health checks and recent issue visibility.
- [ ] Add a true end-to-end simulated call tester that scores the AI response against the QA checklist.
- [ ] Add call outcome tags that staff can manually correct after a call.
- [ ] Add missed-call automatic SMS: "Sorry we missed you, here is the best DDD link..."
- [ ] Add optional referral/directory page for services DDD does not do, such as towing, heavy mechanical jobs, body work, glass, paint, impound, or tire sales.
- [ ] Add optional referral/directory SMS automation once the referral URL and wording are approved.
- [ ] Add human transfer/handoff once a live transfer number/SIP route is chosen.
- [ ] Add after-hours scheduling logic with business-hour awareness.
- [ ] Add admin roles: owner, dispatcher, tech, read-only.
- [ ] Add audit history for who changed settings and when.
- [ ] Add customer privacy/recording consent wording before recording is enabled broadly.

## Sellable Version

- [ ] Replace single-business settings with per-business accounts.
- [ ] Add customer onboarding wizard: business info, services, hours, call rules, voice, SMS copy, review link.
- [ ] Add number setup wizard: buy a new number, port an existing number, or forward an existing Google Voice/business number.
- [ ] Automate Twilio setup behind the scenes: number purchase, voice webhook, SMS webhook, recording/status callbacks.
- [ ] Add plan/billing system with Stripe.
- [ ] Add usage tracking per customer: minutes, calls, SMS, recordings, OpenAI spend, margin.
- [ ] Add domain/custom branding options for each customer.
- [ ] Add support tools for admins to impersonate/view customer accounts safely.
- [ ] Add legal pages: terms, privacy policy, acceptable use, call recording policy, SMS consent.
- [ ] Add customer cancellation/export flow.

## iOS App

- [x] Expo admin starter exists.
- [ ] Point iOS app at the same persistent backend after Render storage is active.
- [ ] Add staff inbox and call log to iOS, not just settings.
- [ ] Add push notifications for new calls, missed calls, bookings, and texts.
- [ ] Add production login before App Store/TestFlight.
- [ ] Prepare Apple Developer account, bundle ID, icons, screenshots, and TestFlight build.
