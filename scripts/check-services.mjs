import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
try {
  const origin = new URL(
    process.env.FAITHQUEST_APP_ORIGIN ?? "http://127.0.0.1:3000",
  );
  if (
    origin.username ||
    origin.password ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(origin.hostname)
      ))
  )
    throw new Error();
  const response = await fetch(new URL("/api/health", origin), {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  const healthy = response.ok && data?.status === "ok";
  const reference = response.headers.get("x-request-id");
  console.log(
    JSON.stringify({
      service: healthy ? "ready" : "unavailable",
      httpStatus: response.status,
      reference:
        reference &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          reference,
        )
          ? reference
          : null,
    }),
  );
  if (!healthy) process.exitCode = 1;
} catch {
  console.error(
    "Service health could not be checked. Start FaithQuest and check its configured origin.",
  );
  process.exitCode = 1;
}
