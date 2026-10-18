import { describe, it, expect, vi } from "vitest";
import {
  createReporter,
  databaseRateLimit,
  RateLimitError,
  readAdmission,
} from "../../supabase/functions/_shared/operations";

const first = "10000000-0000-4000-8000-000000000001",
  second = "10000000-0000-4000-8000-000000000002";
describe("private operational reporting", () => {
  it("logs only allowlisted primitives and reuses a reference while sampling repeated errors", () => {
    const write = vi.fn();
    let time = 1800000000000;
    const report = createReporter(write, () => time);
    expect(report("export", 503, first)).toBe(first);
    expect(report("export", 503, second)).toBe(first);
    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(write.mock.calls[0][0])).toEqual({
      event: "account_service",
      operation: "export",
      status: 503,
      category: "unavailable",
      requestId: first,
      time: new Date(time).toISOString(),
    });
    time += 30001;
    expect(report("export", 503, second)).toBe(second);
    expect(write).toHaveBeenCalledTimes(2);
  });
  it("never logs attacker-controlled categories, IDs, successful responses or ordinary denials", () => {
    const write = vi.fn(),
      report = createReporter(write);
    report("export", 503, "secret-token-or-reflection");
    report("private reflection" as "export", 503, first);
    for (const status of [200, 400, 401, 403, 404])
      report("journey", status, first);
    expect(write).not.toHaveBeenCalled();
  });
});
describe("bounded quota response decoding", () => {
  it.each([
    null,
    {},
    true,
    { allowed: "true", retryAfterSeconds: 0 },
    { allowed: true, retryAfterSeconds: 1 },
    { allowed: false, retryAfterSeconds: 0 },
    { allowed: false, retryAfterSeconds: 901 },
    { allowed: false, retryAfterSeconds: 1.5 },
  ])("rejects malformed admission: %j", (value) => {
    expect(() => readAdmission(value)).toThrow();
  });
  it("retains only the safe admission fields and parses PT429 without relaying database messages", () => {
    expect(
      readAdmission({
        allowed: true,
        retryAfterSeconds: 0,
        private: "never return",
      }),
    ).toEqual({ allowed: true, retryAfterSeconds: 0 });
    const error = databaseRateLimit({
      code: "PT429",
      details: JSON.stringify({ allowed: false, retryAfterSeconds: 45 }),
      message: "private database detail",
    });
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error?.retryAfterSeconds).toBe(45);
    expect(error?.message).not.toContain("private database detail");
    expect(
      databaseRateLimit({ code: "PT429", details: "invalid" })
        ?.retryAfterSeconds,
    ).toBe(60);
    expect(databaseRateLimit({ code: "42501" })).toBeNull();
  });
});
