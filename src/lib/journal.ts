import { z } from "zod";

export const journalCategorySchema = z.enum([
  "reflection",
  "prayer",
  "gratitude",
  "application",
]);
export type JournalCategory = z.infer<typeof journalCategorySchema>;
export const JOURNAL_CATEGORIES: Record<JournalCategory, string> = {
  reflection: "Reflection",
  prayer: "Prayer",
  gratitude: "Gratitude",
  application: "Application",
};
