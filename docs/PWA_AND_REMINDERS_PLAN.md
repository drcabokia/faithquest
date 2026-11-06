# Installable app and reading reminders — proposal

Status: **plan only** for audit item 10. No manifest, service worker, permission prompt, scheduler, subscription table, migration, secret or notification delivery is implemented by this proposal. The app remains a private test release.

## Experience

Add an **Install FaithQuest365** section in Profile & Settings. Offer the browser's install action when supported, concise platform instructions otherwise, and an Installed state in standalone mode. Use the existing brand mark, green/cream palette and signature. Installation must preserve the existing Vercel and Google sign-in boundaries.

Propose `src/app/manifest.ts` with name/short name **FaithQuest365**, app-domain scope `/`, start URL `/dashboard`, standalone display, and 192/512 px icons plus a maskable variant generated from the existing SVG. The information site must not register the app's service worker. Next supports the [App Router manifest convention](https://nextjs.org/docs/app/guides/progressive-web-apps#creating-the-web-app-manifest).

Add **Daily reading reminder**, off by default, beneath the install section. A user chooses a time, sees their account's IANA timezone, then explicitly enables notifications. Request browser permission only after that action. Denial or missing support must leave reading usable. Provide Disable on this device and a test action after consent. Notification text stays generic, for example “A little time in the Word.” It must contain no name, prayer, journal text, reading history or invitation.

## Offline and update boundaries

Start with a small, public, branded offline shell: one heading explaining the connection is unavailable, a reconnect action and the existing signature. It must not display a previous account or pretend that private content has loaded.

| Resource                                                         | Proposed handling                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Branded offline HTML, CSS and icons                              | Explicit, bounded, versioned cache allowlist.                                                                                         |
| App document navigations and RSC payloads                        | Network only; use the public offline shell on a network failure, without caching account HTML. Preserve online 401/403/503 responses. |
| `/auth/*`, Google/Supabase redirects and login                   | Network only; never cache tokens, verifier cookies, callbacks or redirect responses.                                                  |
| Account/journey/fellowship APIs, exports, restores and mutations | Network only; never queue or replay writes in a service worker.                                                                       |
| Journals, prayers, notes, backups and account snapshots          | Never put them in service-worker caches or IndexedDB. Preserve the current draft/conflict protections.                                |
| Public Bible chapter downloads                                   | Outside the first shell release; a separate explicit, bounded download design can follow.                                             |

Show an update-ready message rather than forcing reloads. Do not activate an update that interrupts unsaved drafts in this or another open tab; exchange only draft-present booleans, not text. Bound old caches and retire old shell versions safely. An account connection failure must never switch the user into demo mode.

## Background reminder design

Recommended sequence: installable shell first, then opt-in background delivery after the backend additions below are reviewed. An in-app-only daily nudge is a smaller alternative, but does not deliver while the app is closed. Mobile support and permission behavior require device testing; [Next's guide](https://nextjs.org/docs/app/guides/progressive-web-apps#implementing-web-push-notifications) describes home-screen installation requirements for iOS Web Push.

- Store per-device subscriptions, consent/time/timezone and a due timestamp privately. Subscription endpoints and keys are sensitive capability data: owner-only access, bounded input, no logs/exports and no fellowship exposure.
- Use a bounded scheduled sender, with server-only VAPID credentials. Existing Supabase is a candidate: [Cron](https://supabase.com/docs/guides/cron) can [schedule Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions). Do not provision it in this audit.
- Recompute delivery from local time and timezone, including daylight-saving transitions. Deduplicate by subscription and local date. Delivery is best-effort, not an exact alarm.
- Offer skipping a reminder when a mission was already completed on that local date. Read only the completion predicate required for that decision, never journal/prayer/note contents.
- Validate HTTPS push-provider endpoints and prohibit arbitrary internal/redirect destinations. Authenticate subscription changes and apply owner-only access controls.
- Disable revoked subscriptions, remove expired endpoints, and integrate device sign-out, all-device revocation and account deletion. A sender must check eligibility rather than trusting an old browser opt-in forever.

This needs a separate reviewed migration, deletion/revocation integration, scheduling configuration, server-only secrets and a privacy-policy update. Those changes require a subsequent implementation task.

## Acceptance and decisions

Test install/launch/update on desktop, Android and an installed iOS app; verify Google/Vercel sign-in on the canonical domain. Test offline launches, cache inspection for forbidden data, account switching, logout, multiple tabs with unsaved drafts, storage limits and rollback. Test permission denial, disabled reminders, timezone/DST cases, duplicate scheduler runs, revoked/deleted accounts and generic notification payloads using synthetic data before one explicitly approved test device.

Owner decisions: choose background delivery or in-app-only reminders; approve the sender hosting/budget and subscription-data retention; confirm the reminder/timezone and completed-day behavior. No paid service or schema/environment change is authorized by this document.
