# Dispatch backend reliability rollout

This document describes the prepared changes. It does not authorize or record a deployment.

## Preventing historical reminder floods

The reminder worker persists `activations["reply-escalation-v1"]` in `DATA_DIR/notification-state.json` before its first inbox scan. The initial value is the current timestamp, with no historical lookback. It is created only when reminders are enabled and the reply policy is valid. If persistence or validation fails, that scan sends no reminders.

Keep the existing persistent data volume and notification ledger across restarts, upgrades, and rollbacks. The activation timestamp does not expire and is not moved forward on restart. Existing claims, delivery outcomes, and outbox entries remain intact. Do not delete, backdate, or reset this timestamp to replay historical requests.

Unanswered messages before activation remain visible on Home, with their original unread and waiting state. They do not generate the new reminder or escalation stages merely because this version starts. The worker applies the baseline to both its initial scan and its final pre-send check.

A new inbound message at or after activation on an old unresolved thread starts an eligible reminder clock at that new message. Later inbound messages do not keep restarting that clock. A successful staff reply or a shared handled watermark still suppresses resolved requests. Dashboard waiting time continues to represent the complete unresolved history; notification waiting time represents the first eligible post-activation request.

Previously persisted unversioned `unanswered-text:<phone>:<message>` claims suppress a duplicate reminder for that same message. They do not suppress its separate escalation stage if the message is eligible under the persisted activation baseline. Stage and per-recipient delivery dedupe remain in place. Unresolved post-activation requests can resume their outstanding stages after an outage; pre-activation backlog does not become eligible on restart.

## Policy and verification

The default reminder is five minutes to the assigned active staff member; escalation is fifteen minutes to admins. Unassigned or unavailable-owner requests route to admins. Administrators can inspect or update the validated policy through GET/POST `/api/admin/reply-policy`. `REPLY_REMINDERS_ENABLED=false` pauses reminder scans; initial activation occurs when the worker is first enabled, rather than while disabled.

Before rollout, retain a backup of the persistent ledger and confirm the application uses the same `DATA_DIR`. After startup, confirm that the versioned activation entry exists and that historical threads remain visible without newly generated backlog emails. For a genuine new test request, verify one owner reminder and one admin escalation at the configured thresholds; mark it handled and verify no further reminders. Use provider records to distinguish acceptance from actual delivery.

## Existing SMS template migration and email branding

Automatic opening, missed, and completed-call texts use the common durable phone reservation and compact one-booking-link defaults. Existing environment overrides are retained except for the recognized old stock template: it starts with “Thanks for calling DDD” or “Sorry we missed you”, contains the old iPhone app ID `6762315831`, the Android package `com.dddroadside.mobile`, and a booking link. That signature is migrated at send time to the compact default without editing environment values. Genuine custom templates and their explicitly supplied links remain unchanged.

Email headers display `DDD Dispatch` as the sender name. Sender addresses, application IDs, notification IDs, event keys, and other technical identifiers are unchanged. SMTP acceptance is not displayed as confirmed delivery; uncertain DATA submissions are held rather than automatically resent.

## Regression gate

Use Node 22 with environment-file loading disabled and run:

```sh
DOTENV_CONFIG_PATH=/dev/null NODE_ENV=test node --test --test-concurrency=1 test/*.test.js mobile/test/*.test.js
```

The HTTP tests need permission to bind a temporary localhost listener. External SMS, push, roster/history, and SMTP providers are mocked. The suite checks persisted activation across restart, old-backlog suppression, a new request on an old thread, legacy reminder claims, shared handling, recognized old environment templates, custom-link preservation, and the displayed email sender.
