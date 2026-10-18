import { z } from "zod";
import { prayerChangeSchema, prayerIdSchema } from "./prayers";
import { noteTextSchema } from "./verse-notes";
import { profileSchema } from "./state";
import { CHAPTER_KEYS } from "../services/reading-plan";
import { verseReferenceSchema } from "./verses";
import { journalCategorySchema } from "./journal";
import { PLAN_IDS } from "../services/reading-plan";
const ref = { book: z.string(), chapter: z.number().int().positive() };
const reference = z
  .object(ref)
  .refine((r) => CHAPTER_KEYS.has(`${r.book}.${r.chapter}`));
export const commandSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("prayer"),
        id: prayerIdSchema,
        change: prayerChangeSchema,
        expectedRevision: prayerIdSchema.nullable(),
      })
      .strict(),
    z
      .object({ type: z.literal("selectPlan"), plan: z.enum(PLAN_IDS) })
      .strict(),
    z.object({ type: z.literal("joinChallenge") }).strict(),
    z
      .object({
        type: z.literal("verseNote"),
        book: z.string(),
        chapter: z.number().int().positive(),
        verse: z.number().int().positive(),
        text: noteTextSchema.nullable(),
        expectedText: noteTextSchema.nullable(),
      })
      .strict(),
    z
      .object({
        type: z.literal("initialize"),
        timeZone: profileSchema.shape.timeZone,
      })
      .strict(),
    z.object({ type: z.literal("complete"), ...ref }).strict(),
    z.object({ type: z.literal("remember"), ...ref }).strict(),
    z
      .object({
        type: z.literal("answer"),
        id: z.string().min(1).max(80),
        answer: z.number().int().min(0).max(3),
      })
      .strict(),
    z
      .object({
        type: z.literal("reflect"),
        date: z.iso.date(),
        text: z.string().trim().min(20).max(10000),
        category: journalCategorySchema.optional(),
      })
      .strict(),
    z.object({ type: z.literal("profile"), profile: profileSchema }).strict(),
    z
      .object({
        type: z.literal("saveVerse"),
        book: z.string(),
        chapter: z.number().int().positive(),
        verse: z.number().int().positive(),
        saved: z.boolean(),
      })
      .strict(),
  ])
  .refine(
    (command) =>
      (command.type !== "complete" && command.type !== "remember") ||
      reference.safeParse(command).success,
  )
  .refine(
    (c) =>
      (c.type !== "saveVerse" && c.type !== "verseNote") ||
      verseReferenceSchema.safeParse({
        book: c.book,
        chapter: c.chapter,
        verse: c.verse,
      }).success,
  );
export type JourneyCommand = z.infer<typeof commandSchema>;
export function validOrigin(origin: string | null, expected: string) {
  return origin === expected;
}
