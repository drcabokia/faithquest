import { JournalConflictError } from "@/lib/journal";
import { GraceDayError } from "@/lib/grace-days";
import { PrayerError } from "@/lib/prayers";
import { VerseNoteError } from "@/lib/verse-notes";
import type { NextRequest } from "next/server";
import { accountsEnabled, appOrigin } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { commandSchema, validOrigin } from "@/lib/commands";
import { SupabaseJourneyRepository } from "@/services/supabase-journey";
import type { BookId } from "@/data/books";
import { accountResponder, limitedReply } from "@/lib/account-response";
import { verifiedAccount } from "@/lib/supabase/account-session";
import { ReadingPlanSelectionError } from "@/services/select-reading-plan";
export const dynamic = "force-dynamic";
async function handle(request: NextRequest, write: boolean) {
  const reply = accountResponder("journey");
  if (!accountsEnabled())
    return reply({ error: "Account access is not enabled." }, 503);
  try {
    if (write && !validOrigin(request.headers.get("origin"), appOrigin()))
      return reply({ error: "Request origin was not accepted." }, 403);
    if (write && Number(request.headers.get("content-length") ?? 0) > 20000)
      return reply({ error: "Request is too large." }, 413);
    const client = await serverSupabase();
    const identity = await verifiedAccount(client);
    if (identity.failure) {
      const failure = identity.failure;
      return reply({ error: failure.message }, failure.status);
    }
    const repository = new SupabaseJourneyRepository(client);
    if (!write) return reply({ state: await repository.getJourney() });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (!reader) return reply({ error: "Activity data is required." }, 400);
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 20000) {
        await reader.cancel();
        return reply({ error: "Request is too large." }, 413);
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return reply({ error: "Activity data must be valid JSON." }, 400);
    }
    const result = commandSchema.safeParse(payload);
    if (!result.success)
      return reply({ error: "Please check the submitted activity." }, 400);
    const command = result.data;
    let state;
    switch (command.type) {
      case "grace":
        state = await repository.claimGrace(command.date);
        break;
      case "prayer":
        state = await repository.changePrayer(
          command.id,
          command.change,
          command.expectedRevision,
        );
        break;
      case "selectPlan":
        state = await repository.selectPlan(command.plan);
        break;
      case "joinChallenge":
        state = await repository.joinChallenge();
        break;
      case "initialize": {
        const raw = identity.user.user_metadata.full_name;
        const name =
          typeof raw === "string" ? raw.trim().slice(0, 50) : "Faith Explorer";
        state = await repository.initialize(
          name || "Faith Explorer",
          command.timeZone,
        );
        break;
      }
      case "complete":
        state = await repository.completeChapter(
          command.book as BookId,
          command.chapter,
        );
        break;
      case "remember":
        state = await repository.rememberChapter(
          command.book as BookId,
          command.chapter,
        );
        break;
      case "answer":
        state = await repository.submitQuiz(command.id, command.answer);
        break;
      case "reflect":
        state = await repository.saveReflection(
          command.date,
          command.text,
          command.category,
          command.expectedRevision,
        );
        break;
      case "profile":
        state = await repository.updatePreferences(command.profile);
        break;
      case "verseNote":
        state = await repository.setVerseNote(
          command.book as BookId,
          command.chapter,
          command.verse,
          command.text,
          command.expectedText,
        );
        break;
      case "saveVerse":
        state = await repository.setSavedVerse(
          command.book as BookId,
          command.chapter,
          command.verse,
          command.saved,
        );
        break;
    }
    return reply({ state });
  } catch (error) {
    if (error instanceof GraceDayError)
      return reply({ error: error.message }, 409);
    if (error instanceof JournalConflictError)
      return reply({ error: error.message, code: "journal_conflict" }, 409);
    if (error instanceof PrayerError)
      return reply({ error: error.message }, 409);
    if (error instanceof VerseNoteError)
      return reply({ error: error.message }, 409);
    if (error instanceof ReadingPlanSelectionError)
      return reply({ error: error.message }, 400);
    const limited = limitedReply(reply, error);
    if (limited) return limited;
    return reply(
      {
        error: "Your account data could not be loaded or saved. Please retry.",
      },
      500,
    );
  }
}
export async function GET(request: NextRequest) {
  return handle(request, false);
}
export async function POST(request: NextRequest) {
  return handle(request, true);
}
