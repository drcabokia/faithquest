# Application logging policy

This technical policy covers diagnostics created by FaithQuest365. External monitoring and alert delivery are currently disabled. Provider-managed access, audit and database logs have separate controls and retention; the application logger does not sanitize those systems.

The existing reporter accepts only the `account_service` event, an allowlisted operation, status 429/500/503, a generic category, UTC time and a generated incident UUID. Repeated operation/status events reuse the incident reference for thirty seconds to bound volume. See `supabase/functions/_shared/operations.ts` and [account security](AUTH_AND_SECURITY.md).

Do not log raw errors, requests, visited URLs/query strings, headers, bodies, cookies, tokens, passwords, secrets, names, emails, account IDs, IP addresses or stable hashed identifiers. Private journal/prayer/note content, drafts, recall typing, backups, invitation capabilities and push subscription endpoints/keys are forbidden. DOM capture, screenshots and session replay are also excluded.

Construct records from validated allowlisted fields; drop unknown fields and fail closed. Avoid raw console logging. Future static error codes, route patterns and release identifiers require a reviewed schema. Automated SDK collection must remain disabled until complete serialized payloads pass synthetic privacy tests; a default PII-off switch alone is insufficient.

Restrict diagnostic access to approved operators. Before activating external collection, select an enforceable retention limit (proposed maximum: 14 days), region and spending cap, and review provider-side metadata handling. Do not claim that this proposal already changes hosted retention. Alerting must use generic operations and incident references without user content.

The [monitoring proposal](ERROR_MONITORING_PLAN.md) defines the activation checks and decisions. No new data collection is authorized by this policy.
