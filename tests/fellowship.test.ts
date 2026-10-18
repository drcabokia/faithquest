import { describe, expect, it } from "vitest";
import {
  fellowshipCommandSchema,
  fellowshipSnapshotSchema,
} from "../src/lib/fellowship";
import { initialState } from "../src/lib/state";
import { parseBackup, restoreSchema } from "../src/lib/backup";
import { restoreDemo } from "../src/services/restore-demo";
const id = "10000000-0000-4000-8000-000000000001";
describe("fellowship contracts", () => {
  it("requires explicit consent and rejects client-selected ownership, roles and progress", () => {
    const create = {
      type: "create",
      requestId: id,
      name: "  A private group  ",
      consent: true,
    };
    expect(fellowshipCommandSchema.parse(create)).toMatchObject({
      name: "A private group",
    });
    for (const extra of [
      { consent: false },
      { owner_id: id },
      { role: "leader" },
      { participationPercent: 100 },
      { members: [] },
    ])
      expect(
        fellowshipCommandSchema.safeParse({ ...create, ...extra }).success,
      ).toBe(false);
  });
  it("normalizes full invitations without accepting URLs or short guessable codes", () => {
    expect(
      fellowshipCommandSchema.parse({
        type: "join",
        code: ` ${"A".repeat(32)} `,
        consent: true,
      }),
    ).toMatchObject({ code: "a".repeat(32) });
    for (const code of [
      "123456",
      "https://example.test/invite",
      "z".repeat(32),
    ])
      expect(
        fellowshipCommandSchema.safeParse({ type: "join", code, consent: true })
          .success,
      ).toBe(false);
  });
  it("bounds names and IDs and requires exact close confirmation", () => {
    expect(
      fellowshipCommandSchema.safeParse({
        type: "create",
        requestId: id,
        name: "x".repeat(81),
        consent: true,
      }).success,
    ).toBe(false);
    expect(
      fellowshipCommandSchema.safeParse({
        type: "remove",
        groupId: "other",
        memberId: id,
      }).success,
    ).toBe(false);
    expect(
      fellowshipCommandSchema.safeParse({
        type: "close",
        groupId: id,
        confirmation: "close group",
      }).success,
    ).toBe(false);
    expect(
      fellowshipCommandSchema.safeParse({
        type: "close",
        groupId: id,
        confirmation: "CLOSE GROUP",
      }).success,
    ).toBe(true);
  });
  it("fails closed on private activity, oversized rosters and owner-only fields in member responses", () => {
    const group = {
      id,
      name: "Fixture",
      owner: false,
      members: [{ name: "Reader", participationPercent: 5, isYou: true }],
    };
    expect(
      fellowshipSnapshotSchema.safeParse({ groups: [group] }).success,
    ).toBe(true);
    for (const extra of [
      { inviteCode: "a".repeat(32) },
      { creationRequestId: id },
      { reflections: "private" },
      { members: [{ ...group.members[0], memberId: id }] },
    ])
      expect(
        fellowshipSnapshotSchema.safeParse({ groups: [{ ...group, ...extra }] })
          .success,
      ).toBe(false);
    expect(
      fellowshipSnapshotSchema.safeParse({
        groups: [{ ...group, members: Array(21).fill(group.members[0]) }],
      }).success,
    ).toBe(false);
    expect(
      fellowshipSnapshotSchema.safeParse({
        groups: [
          {
            ...group,
            members: [{ ...group.members[0], participationPercent: 101 }],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("exports own membership metadata without granting group access from a personal backup", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    const s = initialState(now);
    s.profile.timeZone = "UTC";
    s.fellowshipMemberships = [
      {
        groupId: id,
        name: "Own membership",
        role: "member",
        joinedAt: now.toISOString(),
      },
    ];
    const backup = parseBackup(JSON.stringify(s), "UTC", now);
    expect(backup).not.toHaveProperty("fellowshipMemberships");
    const destination = initialState(now);
    destination.profile.timeZone = "UTC";
    expect(restoreDemo(destination, backup, now)).not.toHaveProperty(
      "fellowshipMemberships",
    );
    expect(
      restoreSchema.safeParse({
        ...backup,
        fellowshipMemberships: s.fellowshipMemberships,
      }).success,
    ).toBe(false);
  });
});
