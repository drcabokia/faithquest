import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

// Only a confirmed missing/invalid identity should send the browser back to login.
export function authFailure(error: unknown) {
  const unavailable =
    error != null &&
    (!isAuthError(error) ||
      isAuthRetryableFetchError(error) ||
      !error.status ||
      error.status === 429 ||
      error.status >= 500);
  return unavailable
    ? {
        status: 503,
        message:
          "Your account service is temporarily unavailable. Please retry.",
      }
    : { status: 401, message: "Please sign in again." };
}
