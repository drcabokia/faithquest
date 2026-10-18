import { z } from "zod";
import { restoredVerseNotesSchema } from "./verse-notes";
import { stateSchema, type JourneyState } from "./state";
import { QUIZ_PROMPTS } from "../data/quiz-prompts";
import { dateInZone } from "./dates";
import { verseKeySchema, SAVED_VERSE_LIMIT } from "./verses";

import { challengeStartsSchema, mergeChallengeStarts } from "./challenges";
import { journalCategorySchema } from "./journal";
import { PLAN_IDS, planId, type PlanId } from "../services/reading-plan";

export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
const questionIds = new Set(QUIZ_PROMPTS.map((q) => q.id));
const date = z.iso.date();
// This is the entire restore command. Identity, preferences, XP, achievements,
// answer keys and timestamps never cross this boundary from a backup file.
export const restoreSchema = z
  .object({
    version: z.literal(1),
    readingPlan: z.enum(PLAN_IDS).optional(),
    timeZone: stateSchema.shape.profile.shape.timeZone,
    challengeStarts: challengeStartsSchema.optional(),
    verseNotes: restoredVerseNotesSchema.optional(),
    savedVerses: z.array(verseKeySchema).max(SAVED_VERSE_LIMIT).optional(),
    chapters: stateSchema.shape.chapters,
    attempts: z.record(
      z.string().refine((id) => questionIds.has(id)),
      z
        .object({
          answer: z.number().int().min(0).max(3),
          date,
        })
        .strict(),
    ),
    reflections: z.record(
      date,
      z
        .object({
          text: z.string().trim().min(20).max(10000),
          category: journalCategorySchema.optional(),
        })
        .strict(),
    ),
  })
  .strict()
  .refine((b) => Object.keys(b.reflections).length <= 3660)
  .refine((b) =>
    Object.keys(b.verseNotes ?? {}).every((key) =>
      (b.savedVerses ?? []).includes(key),
    ),
  );
export type RestoreData = z.infer<typeof restoreSchema>;

export function validateRestore(
  data: unknown,
  timeZone: string,
  now = new Date(),
  readingPlan: PlanId = "canonical-v1",
): RestoreData {
  const result = restoreSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      "This backup contains unsupported or invalid journey data.",
    );
  const backup = result.data;
  if (planId(backup) !== readingPlan)
    throw new Error(
      "The backup reading plan must match your current journey. No changes were applied.",
    );
  if (backup.timeZone !== timeZone)
    throw new Error(
      "The backup timezone must match your journey timezone. Check your reading preferences.",
    );
  const today = dateInZone(timeZone, now);
  if (
    [
      ...Object.values(backup.chapters),
      ...Object.values(backup.attempts).map((a) => a.date),
      ...Object.keys(backup.reflections),
      ...(backup.challengeStarts ?? []),
    ].some((d) => d > today)
  )
    throw new Error("A backup cannot contain activity dated after today.");
  return backup;
}

export function parseBackup(
  text: string,
  timeZone: string,
  now = new Date(),
  readingPlan: PlanId = "canonical-v1",
) {
  if (new TextEncoder().encode(text).byteLength > BACKUP_MAX_BYTES)
    throw new Error("Choose a backup smaller than 5 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Choose a valid FaithQuest JSON backup.");
  }
  const parsed = stateSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error("Choose a supported FaithQuest version 1 backup.");
  const state = parsed.data;
  return validateRestore(
    {
      version: 1,
      ...(state.readingPlan ? { readingPlan: state.readingPlan } : {}),
      timeZone: state.profile.timeZone,
      chapters: state.chapters,
      ...(state.challengeStarts
        ? { challengeStarts: state.challengeStarts }
        : {}),
      ...(state.savedVerses
        ? { savedVerses: Object.keys(state.savedVerses) }
        : {}),
      ...(state.verseNotes
        ? {
            verseNotes: Object.fromEntries(
              Object.entries(state.verseNotes).map(([key, note]) => [
                key,
                note.text,
              ]),
            ),
          }
        : {}),
      attempts: Object.fromEntries(
        Object.entries(state.attempts).map(([id, a]) => [
          id,
          { answer: a.answer, date: a.date },
        ]),
      ),
      reflections: Object.fromEntries(
        Object.entries(state.reflections).map(([day, r]) => [
          day,
          { text: r.text, ...(r.category ? { category: r.category } : {}) },
        ]),
      ),
    },
    timeZone,
    now,
    readingPlan,
  );
}

export function previewRestore(current: JourneyState, backup: RestoreData) {
  let challengeError: string | undefined;
  try {
    if (planId(current) !== planId(backup))
      throw new Error(
        "The backup reading plan must match your current journey. Choose another backup.",
      );
    mergeChallengeStarts(
      current.challengeStarts ?? [],
      backup.challengeStarts ?? [],
    );
  } catch (error) {
    challengeError =
      error instanceof Error ? error.message : "Challenge periods overlap.";
  }
  const missing = (source: object, saved: object) =>
    Object.keys(source).filter((key) => !Object.hasOwn(saved, key)).length;
  return {
    ...(challengeError ? { challengeError } : {}),
    chapters: missing(backup.chapters, current.chapters),
    attempts: missing(backup.attempts, current.attempts),
    reflections: missing(backup.reflections, current.reflections),
    challenges: (backup.challengeStarts ?? []).filter(
      (date) => !(current.challengeStarts ?? []).includes(date),
    ).length,
    savedVerses: (backup.savedVerses ?? []).filter(
      (key) => !Object.hasOwn(current.savedVerses ?? {}, key),
    ).length,
    verseNotes: missing(backup.verseNotes ?? {}, current.verseNotes ?? {}),
    noteConflicts: Object.entries(backup.verseNotes ?? {}).filter(
      ([key, text]) =>
        Object.hasOwn(current.verseNotes ?? {}, key) &&
        current.verseNotes![key].text !== text,
    ).length,
    conflicts: Object.entries(backup.reflections).filter(
      ([day, r]) =>
        Object.hasOwn(current.reflections, day) &&
        (current.reflections[day].text !== r.text ||
          (current.reflections[day].category ?? "reflection") !==
            (r.category ?? "reflection")),
    ).length,
  };
}
