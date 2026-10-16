import { describe, it, expect } from "vitest";
import { commandSchema, validOrigin } from "../../src/lib/commands";
describe("authenticated command validation", () => {
  it("rejects client-controlled ownership and rewards", () => {
    expect(
      commandSchema.safeParse({
        type: "complete",
        book: "GEN",
        chapter: 1,
        user_id: "victim",
        xp: 150,
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "answer",
        id: "gen-light",
        answer: 0,
        correct: true,
      }).success,
    ).toBe(false);
  });
  it("validates chapter, quiz, reflection, and timezone inputs", () => {
    expect(
      commandSchema.safeParse({ type: "complete", book: "GEN", chapter: 999 })
        .success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({ type: "complete", book: "GEN", chapter: 1 })
        .success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({ type: "answer", id: "gen-light", answer: 4 })
        .success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "reflect",
        date: "2026-02-30",
        text: "A reflection about gratitude and faith.",
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({ type: "initialize", timeZone: "Bogus/Zone" })
        .success,
    ).toBe(false);
  });
  it("accepts only the exact configured origin", () => {
    expect(
      validOrigin("https://faithquest.test", "https://faithquest.test"),
    ).toBe(true);
    expect(
      validOrigin(
        "https://faithquest.test.evil.example",
        "https://faithquest.test",
      ),
    ).toBe(false);
    expect(validOrigin(null, "https://faithquest.test")).toBe(false);
  });
});
