const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** A practice aid, never a replacement for the source Scripture. */
export function firstLetterHint(text: string): string {
  return text.replace(WORD, (word) =>
    Array.from(word)
      .map((character, index) =>
        index === 0 || !/[\p{L}\p{N}]/u.test(character) ? character : "_",
      )
      .join(""),
  );
}

function words(text: string): string[] {
  return (text.normalize("NFKC").toLowerCase().match(WORD) ?? []).map((word) =>
    word.replace(/['’]/gu, ""),
  );
}

/** Compare words in order, ignoring case, punctuation and whitespace. */
export function recallMatches(recall: string, source: string): boolean {
  const actual = words(recall),
    expected = words(source);
  return (
    expected.length > 0 &&
    actual.length === expected.length &&
    actual.every((word, index) => word === expected[index])
  );
}
