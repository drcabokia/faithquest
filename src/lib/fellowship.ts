import { z } from "zod";
const id = z.uuid();
const name = z.string().trim().min(1).max(80);
const code = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[0-9a-f]{32}$/);
export const fellowshipCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create"),
      requestId: id,
      name,
      consent: z.literal(true),
    })
    .strict(),
  z
    .object({ type: z.literal("join"), code, consent: z.literal(true) })
    .strict(),
  z.object({ type: z.literal("rename"), groupId: id, name }).strict(),
  z.object({ type: z.literal("rotate"), groupId: id }).strict(),
  z.object({ type: z.literal("leave"), groupId: id }).strict(),
  z.object({ type: z.literal("remove"), groupId: id, memberId: id }).strict(),
  z
    .object({
      type: z.literal("close"),
      groupId: id,
      confirmation: z.literal("CLOSE GROUP"),
    })
    .strict(),
]);
export type FellowshipCommand = z.infer<typeof fellowshipCommandSchema>;
export const fellowshipSnapshotSchema = z
  .object({
    groups: z
      .array(
        z
          .object({
            id,
            name,
            owner: z.boolean(),
            inviteCode: code.optional(),
            creationRequestId: id.optional(),
            members: z
              .array(
                z
                  .object({
                    name: z.string().min(1).max(50),
                    participationPercent: z.number().int().min(0).max(100),
                    isYou: z.boolean(),
                    memberId: id.optional(),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict()
          .refine(
            (group) =>
              group.owner ||
              (!group.inviteCode &&
                !group.creationRequestId &&
                group.members.every((m) => !m.memberId)),
            "Owner-only fields cannot appear in member summaries.",
          ),
      )
      .max(5),
  })
  .strict();
export type FellowshipSnapshot = z.infer<typeof fellowshipSnapshotSchema>;
export const fellowshipMembershipsSchema = z
  .array(
    z.object({
      groupId: id,
      name,
      role: z.enum(["owner", "member"]),
      joinedAt: z.iso.datetime(),
    }),
  )
  .max(5);
// Only these domain messages can leave the database adapter; never raw errors.
export const FELLOWSHIP_ERRORS = {
  invite:
    "This invitation is unavailable. Check the code with the group owner.",
  access: "This group action is unavailable. Check saved groups and try again.",
  limit:
    "You can belong to five groups, own two, and have up to twenty people in each group.",
  owner: "Group owners must close their group instead of leaving it.",
  requests: "The account's group creation limit has been reached.",
} as const;
