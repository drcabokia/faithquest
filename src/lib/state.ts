import { z } from "zod";
import { dateInZone } from "./dates";
import { CHAPTER_KEYS } from "../services/reading-plan";
const date = z.iso.date();
const chapterKey = z.string().refine((key) => CHAPTER_KEYS.has(key));
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(50),
  startDate: date,
  timeZone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  theme: z.enum(["light", "dark", "system"]),
});
export const stateSchema = z.object({
  version: z.literal(1),
  profile: profileSchema,
  chapters: z.record(chapterKey, date),
  days: z.record(
    z.string().regex(/^(?:[1-9]|[1-9][0-9]|[12][0-9]{2}|3[0-5][0-9]|36[0-5])$/),
    date,
  ),
  rewards: z.record(
    z.string().max(100),
    z.object({ amount: z.number().int().nonnegative().max(150), date }),
  ),
  attempts: z.record(
    z.string(),
    z.object({
      answer: z.number().int().min(0).max(3),
      correct: z.boolean(),
      date,
    }),
  ),
  reflections: z.record(
    date,
    z.object({
      text: z.string().min(20).max(10000),
      updatedAt: z.iso.datetime(),
    }),
  ),
  resume: z
    .object({ book: z.string(), chapter: z.number().int().positive() })
    .refine((ref) => CHAPTER_KEYS.has(`${ref.book}.${ref.chapter}`))
    .optional(),
});
export type JourneyState = z.infer<typeof stateSchema>;
export type Profile = JourneyState["profile"];
export function initialState(now = new Date()): JourneyState {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    version: 1,
    profile: {
      name: "Faith Explorer",
      startDate: dateInZone(timeZone, now),
      timeZone,
      theme: "system",
    },
    chapters: {},
    days: {},
    rewards: {},
    attempts: {},
    reflections: {},
  };
}
