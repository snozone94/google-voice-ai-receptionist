# DDD Dispatch: two-phase update

## Phase 1 — dependable follow-up

- Separate personal unread state from the shared need to reply. Reading is not replying.
- Claim or assign conversations to active staff. Only admins can assign another staff member; owners/admins can release them.
- Configurable reminder and admin escalation, defaulting to 5 and 15 minutes. A durable activation baseline avoids flooding staff with historical alerts on rollout.
- Durable, per-channel notification delivery tracking and bounded retries. Accepted and delivered are distinguished; ambiguous email acceptance is not blindly resent.
- One automatic call follow-up per recent customer window, with a short booking link and opt-out footer.
- Reopen archived customers when they contact DDD again, retaining history.
- Save booking requests before external sync; reconcile status, technician and service time only against matching platform booking identities. Expose unavailable/stale sync rather than inventing updates.
- Recover active call assistance after restart, verify provider state before fallback, and protect the opening greeting through playback with a bounded release.
- Admin service health for calling, texts, notifications, email, staff sync, booking sync and storage.

## Phase 2 — a calmer workspace

- Home first: live calls, unread texts, reply queue, today's open bookings and quick actions.
- Home / Inbox / Calls / Bookings / Account navigation; technical settings stay under admin controls.
- One customer thread with messages, call history, transcripts and bookings; clear unread/reply/ownership states.
- Explicit newest-message controls and stable reading position, instead of forced scrolling on every refresh.
- Clear active/history booking lists, scheduled service time and technician ownership.
- DDD Dispatch name and approved Rainbow Road icon, dark navy surfaces, readable cards and restrained rainbow accents.
- Browser notification taps route to the relevant customer, calls or bookings after staff sign-in.
- Existing real calling, listen-in, takeover, transcription, role restrictions and sound choices retained.

## Release boundaries

The web/backend can be deployed separately from the next native app. Mobile configuration is prepared as build 18 with the iOS scene-lifecycle fix retained. Changing source does not update an installed App Store binary. Do not replace or cancel the existing Apple submission merely to publish these web/backend improvements. A signed native build, physical-device checks and a separate store submission remain release gates for the new native interface.

WordPress lifecycle metadata must be available from the actual platform; missing information remains visibly unverified. Automatic retry of an external booking creation with an unknown result is deliberately avoided to prevent duplicate jobs. Current file-backed stores require a single server writer; this update does not claim distributed database transactions or guaranteed end-to-end provider delivery.
