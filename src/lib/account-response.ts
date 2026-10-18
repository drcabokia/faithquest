import { NextResponse } from "next/server";
import {
  operationTrace,
  type Operation,
  RateLimitError,
} from "../../supabase/functions/_shared/operations";

export function accountReply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      ...(status === 503 ? { "Retry-After": "5" } : {}),
    },
  });
}

export function accountResponder(operation: Operation) {
  const trace = operationTrace(operation);
  return (
    data: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ) => {
    const reference = trace.record(status);
    const response = accountReply(data, status);
    response.headers.set("X-Request-ID", reference);
    for (const [name, value] of Object.entries(headers))
      response.headers.set(name, value);
    return response;
  };
}

export function limitedReply(
  reply: ReturnType<typeof accountResponder>,
  error: unknown,
) {
  return error instanceof RateLimitError
    ? reply({ error: error.message }, 429, {
        "Retry-After": String(error.retryAfterSeconds),
      })
    : null;
}
