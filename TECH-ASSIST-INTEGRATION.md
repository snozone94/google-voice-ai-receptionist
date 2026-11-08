# Shared Tech Assist Coordination

DDD Dispatch now reads the same WordPress technician roster and internal inbox as Tech Assist, through a narrow authenticated proxy. On Dispatch Home, expand **Team & dispatch notes**. Customers' SMS/calls remain in the existing customer Inbox/Calls screens; internal notes never become customer texts.

- Existing individual technician codes are reverified by WordPress. Server-wide privileged tokens and a Dispatch-only admin PIN are not substituted for individual workflow identity. Staff using a separate Dispatch-only PIN must sign in with their own active DDD technician code for coordination.
- WordPress remains the source of truth for job availability, notes, pings, per-person read state and backup responses. No second inbox database or synchronization writer is created.
- The proxy derives its address from the already-configured WordPress technician authentication URL. No new production secret is required.
- Existing owner/administrator location rules remain in WordPress; this integration cannot override them. Tech Assist remains the full native map/job workspace. Dispatch includes an Open Tech Assist shortcut.
- Existing booking lifecycle sync continues using exact platform booking IDs; customer intake records are not converted into new jobs by this integration.
- Phone answering coverage and job availability have different purposes. Existing Dispatch call-coverage controls are preserved; they are not silently rewritten from job status.
- New coordination UI polls only while expanded and foregrounded. This is refresh-based synchronization, not guaranteed instantaneous delivery. Existing push registration is unchanged; a Dispatch-specific push fan-out for internal Tech Assist notes is not added here.
- WordPress requires DDD Tech Workflow 1.0.2 or later for its already-supported persistent setup codes to identify the same technician as the full Tech Assist token.

## Release
Backend and web can deploy independently. The native additions in both apps require new signed releases to reach installed phones. JavaScript exports do not constitute an App Store release. Test actual app switching, map/background location, native sheets and two-device push behavior before native submission.

## Verification
Run `node --test --test-concurrency=1 test/*.test.js`, `node --test mobile/test/*.test.js` and native Expo exports. The companion WordPress regression suite covers code identity, revocation, ownership, location privacy and saved response state. No real customer or technician ping needs to be sent to run the isolated tests.
