import { z } from "zod";
import { profileSchema } from "./state";
import { CHAPTER_KEYS } from "../services/reading-plan";
const ref = { book: z.string(), chapter: z.number().int().positive() };
const reference = z
  .object(ref)
  .refine((r) => CHAPTER_KEYS.has(`${r.book}.${r.chapter}`));
export const commandSchema = z
  .discriminatedUnion("type", [
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
      })
      .strict(),
    z.object({ type: z.literal("profile"), profile: profileSchema }).strict(),
  ])
  .refine(
    (command) =>
      (command.type !== "complete" && command.type !== "remember") ||
      reference.safeParse(command).success,
  );
export type JourneyCommand = z.infer<typeof commandSchema>;
export function validOrigin(origin: string | null, expected: string) {
  return origin === expected;
}
