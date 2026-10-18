import { z } from "zod";
export const PRAYER_LIMIT = 200;
export const FOLLOW_UP_LIMIT = 50;
export const prayerIdSchema = z
  .uuidv4()
  .refine((id) => id === id.toLowerCase());
export const prayerStatusSchema = z.enum(["ongoing", "answered", "archived"]);
export type PrayerStatus = z.infer<typeof prayerStatusSchema>;
export const PRAYER_STATUS_LABELS: Record<PrayerStatus, string> = {
  ongoing: "Ongoing",
  answered: "Answered",
  archived: "Archived",
};
export const prayerText = (limit: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine((v) => Array.from(v).length <= limit);
export const prayerDetailsSchema = z
  .object({
    title: prayerText(120),
    text: prayerText(2000),
    status: prayerStatusSchema,
  })
  .strict();
export const followUpSchema = z
  .object({ text: prayerText(1000), date: z.iso.date() })
  .strict();
export const prayerContentSchema = prayerDetailsSchema
  .extend({
    followUps: z
      .record(prayerIdSchema, followUpSchema)
      .refine((v) => Object.keys(v).length <= FOLLOW_UP_LIMIT),
  })
  .strict();
export const prayerSchema = prayerContentSchema
  .extend({
    revision: prayerIdSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type Prayer = z.infer<typeof prayerSchema>;
export type PrayerContent = z.infer<typeof prayerContentSchema>;
export const prayersSchema = z
  .record(prayerIdSchema, prayerSchema)
  .refine((v) => Object.keys(v).length <= PRAYER_LIMIT);
export const restoredPrayersSchema = z
  .record(prayerIdSchema, prayerContentSchema)
  .refine((v) => Object.keys(v).length <= PRAYER_LIMIT);
export const prayerChangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), value: prayerDetailsSchema }).strict(),
  z
    .object({
      action: z.literal("followUp"),
      value: followUpSchema.extend({ id: prayerIdSchema }).strict(),
    })
    .strict(),
  z
    .object({ action: z.literal("delete"), value: z.object({}).strict() })
    .strict(),
]);
export type PrayerChange = z.infer<typeof prayerChangeSchema>;
export const PRAYER_ERRORS = {
  prayer_conflict:
    "This prayer changed elsewhere. Check saved progress and review the saved version. Your draft is still here.",
  prayer_missing:
    "This prayer was deleted elsewhere. Your draft is still here; you can save it as a new prayer.",
  prayer_limit:
    "You can keep up to 200 prayer requests. Export and delete an old request before adding another.",
  follow_up_limit:
    "This prayer has 50 follow-up notes. Start another prayer request to continue.",
} as const;
export class PrayerError extends Error {
  constructor(public readonly code: keyof typeof PRAYER_ERRORS) {
    super(PRAYER_ERRORS[code]);
  }
}
export function isPrayerError(
  value: unknown,
): value is keyof typeof PRAYER_ERRORS {
  return typeof value === "string" && Object.hasOwn(PRAYER_ERRORS, value);
}
export function prayerContent(prayer: Prayer): PrayerContent {
  const { title, text, status, followUps } = prayer;
  return { title, text, status, followUps };
}
export function samePrayerContent(a: PrayerContent, b: PrayerContent) {
  return (
    a.title === b.title &&
    a.text === b.text &&
    a.status === b.status &&
    Object.keys(a.followUps).length === Object.keys(b.followUps).length &&
    Object.entries(a.followUps).every(
      ([id, n]) =>
        b.followUps[id]?.text === n.text && b.followUps[id]?.date === n.date,
    )
  );
}
