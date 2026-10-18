import { describe, expect, it } from "vitest";
import { firstLetterHint, recallMatches } from "../src/lib/memory-practice";

describe("temporary verse recall aids", () => {
  it("keeps word initials, punctuation, whitespace and Unicode intact in hints", () => {
    expect(firstLetterHint("“God’s love,” he said.\nÉlan 12!")).toBe(
      "“G__’_ l___,” h_ s___.\nÉ___ 1_!",
    );
  });

  it("compares words in order without grading punctuation or capitalization", () => {
    expect(
      recallMatches(
        "  FOR god so loved\n the WORLD!!",
        "For God so loved the world,",
      ),
    ).toBe(true);
    expect(recallMatches("Gods loving kindness", "God’s loving-kindness")).toBe(
      true,
    );
    expect(recallMatches("don't fear", "Don’t fear.")).toBe(true);
  });

  it("does not accept missing, substituted, repeated or reordered words", () => {
    const source = "For God so loved the world";
    for (const recall of [
      "For God loved the world",
      "For God so likes the world",
      "For God so so loved the world",
      "God For so loved the world",
    ])
      expect(recallMatches(recall, source)).toBe(false);
  });

  it("preserves word boundaries rather than accepting merged words", () => {
    expect(recallMatches("inthe beginning", "In the beginning")).toBe(false);
    expect(recallMatches("can not", "cannot")).toBe(false);
  });

  it("does not treat empty or punctuation-only recall as a match", () => {
    expect(recallMatches("", "For God so loved the world")).toBe(false);
    expect(recallMatches("!!!", "For God so loved the world")).toBe(false);
    expect(recallMatches("", "")).toBe(false);
  });
});
