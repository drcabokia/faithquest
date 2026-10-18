import type { JourneyState } from "../lib/state";
import { dateInZone } from "../lib/dates";
import {
  prayerChangeSchema,
  prayerIdSchema,
  PrayerError,
  PRAYER_LIMIT,
  FOLLOW_UP_LIMIT,
  type PrayerChange,
} from "../lib/prayers";
export function changePrayer(
  state: JourneyState,
  id: string,
  input: PrayerChange,
  expectedRevision: string | null,
  now = new Date(),
): JourneyState {
  prayerIdSchema.parse(id);
  if (expectedRevision !== null) prayerIdSchema.parse(expectedRevision);
  const change = prayerChangeSchema.parse(input);
  const prayers = { ...state.prayers };
  const current = prayers[id];
  if (
    change.action === "followUp" &&
    change.value.date > dateInZone(state.profile.timeZone, now)
  )
    throw new Error("Follow-up dates cannot be after today.");
  if (change.action === "delete" && !current) return state;
  if (
    change.action === "save" &&
    current &&
    current.title === change.value.title &&
    current.text === change.value.text &&
    current.status === change.value.status
  )
    return state;
  if (
    change.action === "followUp" &&
    current?.followUps[change.value.id]?.text === change.value.text &&
    current.followUps[change.value.id].date === change.value.date
  )
    return state;
  if (!current && (change.action !== "save" || expectedRevision !== null))
    throw new PrayerError("prayer_missing");
  if ((current?.revision ?? null) !== expectedRevision)
    throw new PrayerError("prayer_conflict");
  if (change.action === "delete") delete prayers[id];
  else if (change.action === "save") {
    if (!current && Object.keys(prayers).length >= PRAYER_LIMIT)
      throw new PrayerError("prayer_limit");
    prayers[id] = {
      ...change.value,
      followUps: current?.followUps ?? {},
      createdAt: current?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      revision: crypto.randomUUID(),
    };
  } else {
    if (Object.hasOwn(current.followUps, change.value.id))
      throw new PrayerError("prayer_conflict");
    if (Object.keys(current.followUps).length >= FOLLOW_UP_LIMIT)
      throw new PrayerError("follow_up_limit");
    const { id: noteId, text, date } = change.value;
    prayers[id] = {
      ...current,
      followUps: { ...current.followUps, [noteId]: { text, date } },
      updatedAt: now.toISOString(),
      revision: crypto.randomUUID(),
    };
  }
  return { ...state, prayers };
}
