export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Please wait ${retryAfterSeconds} seconds before trying again. Your saved progress is unchanged.`,
    );
  }
}

export function readAdmission(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !("allowed" in value) ||
    typeof value.allowed !== "boolean" ||
    !("retryAfterSeconds" in value) ||
    typeof value.retryAfterSeconds !== "number" ||
    !Number.isInteger(value.retryAfterSeconds) ||
    value.retryAfterSeconds < 0 ||
    value.retryAfterSeconds > 900 ||
    (value.allowed
      ? value.retryAfterSeconds !== 0
      : value.retryAfterSeconds < 1)
  )
    throw new Error("Account request admission is unavailable.");
  return { allowed: value.allowed, retryAfterSeconds: value.retryAfterSeconds };
}

export function databaseRateLimit(error: unknown) {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    error.code !== "PT429"
  )
    return null;
  try {
    const admission = readAdmission(
      JSON.parse(
        "details" in error && typeof error.details === "string"
          ? error.details
          : "null",
      ),
    );
    if (!admission.allowed)
      return new RateLimitError(admission.retryAfterSeconds);
  } catch {}
  return new RateLimitError(60);
}

export type Operation =
  | "journey"
  | "export"
  | "delete"
  | "health"
  | "proxy"
  | "restore"
  | "fellowship";
const operations = new Set<Operation>([
  "journey",
  "export",
  "delete",
  "health",
  "proxy",
  "restore",
  "fellowship",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only allowlisted primitives enter logs. No error object, request, identity,
// payload, URL, token, email or reflection is accepted. Sampling bounds log spam.
export function createReporter(
  write: (line: string) => void = (line) => console.warn(line),
  clock = () => Date.now(),
) {
  const last = new Map<string, { time: number; requestId: string }>();
  return (operation: Operation, status: number, requestId: string) => {
    if (
      !operations.has(operation) ||
      ![429, 500, 503].includes(status) ||
      !uuid.test(requestId)
    )
      return;
    const key = `${operation}:${status}`,
      now = clock();
    const previous = last.get(key);
    if (previous && now - previous.time < 30000) return previous.requestId;
    last.set(key, { time: now, requestId });
    write(
      JSON.stringify({
        event: "account_service",
        operation,
        status,
        category: status === 429 ? "rate_limited" : "unavailable",
        requestId,
        time: new Date(now).toISOString(),
      }),
    );
    return requestId;
  };
}
const report = createReporter();
export function operationTrace(operation: Operation) {
  const requestId = crypto.randomUUID();
  return {
    requestId,
    record: (status: number) =>
      report(operation, status, requestId) ?? requestId,
  };
}
