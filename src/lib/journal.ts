import { z } from "zod";

export const journalCategorySchema = z.enum([
  "reflection",
  "prayer",
  "gratitude",
  "application",
]);
export type JournalCategory = z.infer<typeof journalCategorySchema>;
export const journalRevisionSchema = z.uuidv4();
// Older demo entries predate revisions. Their stable timestamp is accepted only
// as a legacy comparison token; every successful edit mints a UUID revision.
export const journalExpectedRevisionSchema = z.union([
  journalRevisionSchema,
  z.iso.datetime(),
]);
export function journalRevision(
  entry: { revision?: string; updatedAt: string } | undefined,
): string | null {
  return entry?.revision ?? entry?.updatedAt ?? null;
}
export class JournalConflictError extends Error {
  constructor() {
    super(
      "This journal entry changed elsewhere. Check saved progress and review the saved entry before replacing it. Your draft is still here.",
    );
  }
}
export const JOURNAL_CATEGORIES: Record<JournalCategory, string> = {
  reflection: "Reflection",
  prayer: "Prayer",
  gratitude: "Gratitude",
  application: "Application",
};
