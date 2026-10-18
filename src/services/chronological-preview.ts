import { BOOKS } from "../data/books";
import {
  CHRONOLOGICAL_DRAFT_ID,
  CHRONOLOGICAL_SEGMENTS,
  CHRONOLOGICAL_NOTES,
} from "../data/chronological-draft";
import {
  CHAPTER_KEYS,
  getPlan,
  makeMission,
  PLAN_DETAILS,
  type PlanId,
  type Mission,
} from "./reading-plan";
export { CHRONOLOGICAL_DRAFT_ID, CHRONOLOGICAL_NOTES };
export type PreviewPlanId = PlanId | typeof CHRONOLOGICAL_DRAFT_ID;
export type DraftMission = Mission & { contexts: string[]; noteIds: string[] };
const ordered = CHRONOLOGICAL_SEGMENTS.flatMap((segment) =>
  segment.readings.flatMap((range) => {
    const book = typeof range === "string" ? range : range[0];
    const metadata = BOOKS.find((b) => b.id === book);
    if (!metadata) throw new Error("Unknown chronological draft book.");
    const start = typeof range === "string" ? 1 : range[1];
    const end = typeof range === "string" ? metadata.chapters : range[2];
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      end > metadata.chapters
    )
      throw new Error("Invalid chronological draft range.");
    return Array.from({ length: end - start + 1 }, (_, i) => ({
      book,
      chapter: start + i,
      key: `${book}.${start + i}`,
      segment,
    }));
  }),
);
if (
  ordered.length !== 1189 ||
  new Set(ordered.map((c) => c.key)).size !== CHAPTER_KEYS.size ||
  ordered.some((c) => !CHAPTER_KEYS.has(c.key))
)
  throw new Error(
    "The chronological draft must cover every chapter exactly once.",
  );
const noteIds = new Set(CHRONOLOGICAL_NOTES.map((n) => n.id));
if (CHRONOLOGICAL_SEGMENTS.some((s) => s.notes.some((id) => !noteIds.has(id))))
  throw new Error("Unknown chronological placement note.");
export const CHRONOLOGICAL_DRAFT: DraftMission[] = Array.from(
  { length: 365 },
  (_, i) => {
    const part = ordered.slice(
      Math.floor((i * 1189) / 365),
      Math.floor(((i + 1) * 1189) / 365),
    );
    return {
      ...makeMission(
        i + 1,
        part.map(({ book, chapter, key }) => ({ book, chapter, key })),
      ),
      contexts: [...new Set(part.map((c) => c.segment.title))],
      noteIds: [...new Set(part.flatMap((c) => c.segment.notes))],
    };
  },
);
export function previewPlan(id: PreviewPlanId): Mission[] {
  return id === CHRONOLOGICAL_DRAFT_ID ? CHRONOLOGICAL_DRAFT : getPlan(id);
}
export function previewName(id: PreviewPlanId) {
  return id === CHRONOLOGICAL_DRAFT_ID
    ? "Chronological Journey"
    : PLAN_DETAILS[id].name;
}
export function draftScheduleExport() {
  // No journey state is accepted here: this artifact contains public references only.
  return {
    kind: "faithquest-reading-plan-draft",
    draftId: CHRONOLOGICAL_DRAFT_ID,
    status: "preview-only",
    independentEditorialReview: "pending",
    authoredOn: "2026-10-18",
    scope: "66-book Protestant canon; 365 days; every whole chapter once",
    method:
      "Original contextual ordering, partitioned into 365 days with floor(i * 1189 / 365) boundaries. Parallel accounts and anthologies remain in blocks. Not a strict event-by-event chronology or composition-date order.",
    scripture:
      "Existing World English Bible Classic 2020; Scripture text is not included or modified.",
    reuse:
      "No third-party reading schedule imported. Notes are editorial paraphrases; linked sources support context, not the full proposed ordering.",
    segments: CHRONOLOGICAL_SEGMENTS,
    placementNotes: CHRONOLOGICAL_NOTES,
    days: CHRONOLOGICAL_DRAFT,
  };
}
