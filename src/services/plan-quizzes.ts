import { BOOKS } from "../data/books";
import { QUIZ_PROMPTS, type QuizPrompt } from "../data/quiz-prompts";
import { getPlan, type PlanId } from "./reading-plan";

// A question follows its source chapter, never the canonical schedule's day number.
export function quizChapter(question: QuizPrompt) {
  const book = BOOKS.find((b) => question.reference.startsWith(`${b.name} `));
  if (!book) throw new Error("Unknown quiz reference.");
  return {
    book: book.id,
    chapter: Number(
      question.reference.slice(book.name.length + 1).split(":")[0],
    ),
  };
}
export function quizDay(question: QuizPrompt, id: PlanId): number {
  const ref = quizChapter(question);
  return getPlan(id).find((m) =>
    m.chapters.some((c) => c.book === ref.book && c.chapter === ref.chapter),
  )!.day;
}
export function questionsForDay(day: number, id: PlanId) {
  return QUIZ_PROMPTS.filter((q) => quizDay(q, id) === day);
}
