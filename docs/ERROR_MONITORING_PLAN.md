# Error monitoring — proposal

Status: **plan only** for audit item 11. No SDK, external project, DSN, instrumentation, environment configuration or alert delivery is enabled. The current application reporter remains the source of safe operational diagnostics; see [the logging policy](LOGGING_POLICY.md).

## Proposed collection

Evaluate Sentry as an errors-only destination after choosing region, retention and budget. Route the existing allowlisted events from `supabase/functions/_shared/operations.ts` through an optional server transport. For browser failures, send a manually constructed event containing a static error code, a known route pattern, release identifier, UTC time and an incident reference generated for that failure. Do not attach account identity or a stable device/session identifier.

Build each outgoing event afresh from validated, allowlisted primitives. Do not pass raw exceptions or request objects through a general-purpose scrubber. Drop unknown fields and reject invalid events. Keep the application usable if reporting is disabled, blocked, rate-limited or unavailable; reporting must never delay a save or change its outcome.

Sentry provides [`beforeSend` and breadcrumb filtering](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/filtering/). Use them as a final rejection boundary, with all breadcrumbs dropped initially. They do not replace explicit controls for other telemetry types. Turn off automatic exception capture initially, console capture, Replay, screenshots, attachments, tracing, profiling, logs and metrics. Add an integration only after inspecting its serialized output.

Keep `sendDefaultPii` disabled, but do not treat that setting as a complete privacy guarantee. [Sentry's sensitive-data guidance](https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/) describes additional request/context data that needs review. Exclude URLs with query strings, headers, cookies, bodies, DOM content, raw exception messages and stacks, source context and local filesystem paths. If file/line diagnostics are later necessary, allow only validated application-relative filenames and numbers through a separately reviewed schema.

Never collect names, emails, account IDs, IP addresses, stable hashed identifiers, credentials, invitations, journals, prayers, verse notes, recall typing, drafts, backups or push subscription endpoints/keys. A route pattern such as `/bible/[book]/[chapter]` is preferable to a visited URL or reading history. Do not call user-context APIs.

## Project and release controls

- Apply project-side scrubbing as defense in depth, configure IP storage prevention and restrict accepted origins. Confirm actual event contents rather than relying on defaults.
- Bound volume and costs. Exclude expected authentication, permission and rate-limit outcomes from error alerts. Group actionable failures by static operation/error code and release; alert on sustained service failures, not every failed request.
- Start with incident references and release identifiers. Source-map upload is optional later work using a narrowly scoped CI token; review uploaded artifacts and never upload environment files, private content or secrets.
- Restrict project access to approved operators. Propose a maximum 14-day diagnostic retention only if the selected plan can enforce it. Review region, deletion and provider terms before enabling delivery.
- A provider necessarily receives network metadata when contacted. Application event filtering does not control hosting access logs, database audit logs or every provider-managed record. Review those systems separately; do not promise that all infrastructure records contain no personal data.

Existing request references and recovery behavior stay intact. This proposal does not replace [account security controls](AUTH_AND_SECURITY.md) or authorize changing authentication flows.

## Acceptance before activation

Intercept and decode complete server and browser event envelopes using synthetic errors. Plant distinctive test values in account identifiers, emails, request queries/bodies/headers, cookies, tokens, journal/prayer/note text, recall typing, backup data and subscription endpoints. Assert that none reach the destination, including breadcrumbs, SDK context and attachments. Unknown fields or filter failures must drop an event. Verify no additional telemetry envelope types are emitted.

Test an absent configuration, blocked collector, exhausted quota and collector outage: reading, navigation, saves and recovery must behave identically. Test grouping and thresholds with an approved synthetic sink before sending any alert to an operator. Verify retention and access settings in the selected project, then review public privacy disclosures before enabling external reporting.

Owner decisions: keep current local/platform diagnostics or select a vendor; choose the permitted region, enforceable retention and spending cap; name the operators and alert recipient. Implementation and service activation require a separate task after these decisions.
