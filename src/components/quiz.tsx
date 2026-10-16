"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Check, X, Sparkles, BookOpen } from "lucide-react";
import { QUESTIONS, type QuizQuestion } from "@/data/quizzes";
import { useJourney, JourneyLoading } from "@/components/journey-provider";
import { PageHeading, EmptyState } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { currentDay } from "@/services/reading-plan";
import { cn } from "@/lib/utils";
function Question({
  question,
  index,
}: {
  question: QuizQuestion;
  index: number;
}) {
  const { state, busy, answer } = useJourney();
  const [choice, setChoice] = useState<number | null>(null);
  const attempt = state?.attempts[question.id];
  return (
    <article className="card quiz-card">
      <span className="eyebrow">
        QUESTION {index + 1}{" "}
        <span className="quiz-reward">+10 XP FOR A CORRECT ANSWER</span>
      </span>
      <h2>{question.question}</h2>
      <fieldset disabled={!!attempt || busy}>
        <legend className="sr-only">{question.question}</legend>
        {question.options.map((option, i) => (
          <label
            key={option}
            className={cn(
              "answer-option",
              choice === i && "chosen",
              attempt && question.correct === i && "correct",
              attempt &&
                !attempt.correct &&
                attempt.answer === i &&
                "incorrect",
            )}
          >
            <input
              type="radio"
              name={question.id}
              checked={(attempt?.answer ?? choice) === i}
              value={i}
              onChange={() => setChoice(i)}
            />
            <span className="option-letter">{String.fromCharCode(65 + i)}</span>
            <span>{option}</span>
            {attempt && question.correct === i ? (
              <Check size={19} />
            ) : attempt && attempt.answer === i ? (
              <X size={19} />
            ) : null}
          </label>
        ))}
      </fieldset>
      {attempt ? (
        <div
          className={cn(
            "answer-explanation",
            !attempt.correct && "answer-review",
          )}
          role="status"
        >
          <strong>
            {attempt.correct
              ? "That’s right. A little discovery!"
              : "A moment to learn something new."}
          </strong>
          <p>{question.explanation}</p>
          <Link href={`/bible?day=${question.day}`}>
            <BookOpen size={14} />
            {question.reference} · Read in context
          </Link>
          <span>
            {attempt.correct
              ? "10 XP awarded once"
              : "Answer recorded · No XP awarded"}
          </span>
        </div>
      ) : (
        <Button
          disabled={choice === null || busy}
          onClick={() => {
            if (choice !== null) void answer(question.id, choice);
          }}
        >
          Check my answer
          <Sparkles size={16} />
        </Button>
      )}
    </article>
  );
}
export function Quiz() {
  const query = useSearchParams();
  const { state, today } = useJourney();
  const [selected, setSelected] = useState<number | null>(null);
  if (!state) return <JourneyLoading />;
  const requested = Number(query.get("day"));
  const day =
    selected ??
    (Number.isInteger(requested) && requested >= 1 && requested <= 365
      ? requested
      : currentDay(state.profile.startDate, today));
  const questions = QUESTIONS.filter((q) => q.day === day);
  const history = QUESTIONS.filter((q) => state.attempts[q.id]);
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE CURIOSITY GOES A LONG WAY"
        title="Read. Wonder. Discover."
        description="Let a few thoughtful questions deepen your time in Scripture."
      />
      <div className="quiz-intro">
        <label>
          Reading day
          <select
            value={day}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {![1, 2, 3].includes(day) && (
              <option value={day}>Day {day} · No reviewed questions yet</option>
            )}
            {[1, 2, 3].map((n) => (
              <option value={n} key={n}>
                Day {n} · Genesis
              </option>
            ))}
          </select>
        </label>
        <p className="small muted">
          Six manually reviewed demo questions cover days 1–3. Each question can
          be submitted once.
        </p>
      </div>
      <div className="quiz-layout">
        <div>
          {questions.length ? (
            questions.map((q, i) => (
              <Question key={q.id} question={q} index={i} />
            ))
          ) : (
            <EmptyState title="A quiet day for discovery">
              There isn’t a reviewed quiz for this reading yet. Choose day 1, 2,
              or 3 to explore the demo questions.
            </EmptyState>
          )}
        </div>
        <aside>
          <section className="card quiz-summary">
            <Sparkles size={27} />
            <span className="eyebrow">YOUR DISCOVERIES</span>
            <h2>
              {history.filter((q) => state.attempts[q.id].correct).length}{" "}
              correct answers
            </h2>
            <p>
              {history.length} of {QUESTIONS.length} questions explored
            </p>
            <strong className="xp-large">
              {history.filter((q) => state.attempts[q.id].correct).length * 10}
              <small> XP earned</small>
            </strong>
            <p className="small muted">
              This is a chance to learn, not a test of your faith. Take your
              time with the explanations.
            </p>
          </section>
          {history.length > 0 && (
            <section className="card quiz-history">
              <h3>Your quiz history</h3>
              {history.map((q) => (
                <div key={q.id}>
                  {state.attempts[q.id].correct ? (
                    <Check size={15} />
                  ) : (
                    <BookOpen size={15} />
                  )}
                  <span>
                    {q.reference}
                    <small>{state.attempts[q.id].date}</small>
                  </span>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
