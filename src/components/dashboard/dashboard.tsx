"use client";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Flame,
  Sparkles,
  Check,
  ChevronRight,
  Leaf,
  Quote,
  CircleHelp,
  NotebookPen,
  Trophy,
  Compass,
} from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useJourney, JourneyLoading } from "@/components/journey-provider";
import { JourneyArt } from "@/components/journey-art";
import { Button } from "@/components/ui/button";
import { Progress, SectionLink } from "@/components/ui/shared";
import { PLAN, currentDay } from "@/services/reading-plan";
import {
  achievements,
  levelInfo,
  readingDates,
  streak,
  totalXp,
} from "@/services/gamification-display";
import { addDays, displayDate } from "@/lib/dates";
import { QUIZ_PROMPTS } from "@/data/quiz-prompts";
import psalm from "../../../public/bible/PSA/119.json";
export function Dashboard() {
  const { state, today } = useJourney();
  if (!state) return <JourneyLoading />;
  const day = currentDay(state.profile.startDate, today),
    mission = PLAN[day - 1],
    completed = Object.keys(state.days).length,
    xp = totalXp(state),
    level = levelInfo(xp),
    streakDays = streak(readingDates(state), today);
  const badges = achievements(state),
    earned = badges.filter((b) => b.earned);
  const chapterCount = mission.chapters.filter(
    (c) => state.chapters[c.key],
  ).length;
  const resume =
    mission.chapters.find((c) => !state.chapters[c.key]) ?? mission.chapters[0];
  const quiz = QUIZ_PROMPTS.filter((q) => q.day === day);
  const quizDone = quiz.length > 0 && quiz.every((q) => state.attempts[q.id]);
  const activity = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return {
      label: new Date(date + "T12:00Z").toLocaleDateString("en", {
        weekday: "short",
        timeZone: "UTC",
      }),
      xp: Object.values(state.rewards)
        .filter((r) => r.date === date)
        .reduce((n, r) => n + r.amount, 0),
    };
  });
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">
            <span className="tiny-line" />
            YOUR DAILY MOMENT IN THE WORD
          </p>
          <h1>
            Welcome back, {state.profile.name}.{" "}
            <span className="greeting-leaf">
              <Leaf size={28} />
            </span>
          </h1>
          <p className="page-description">
            One small step today. A deeper faith along the way.
          </p>
        </div>
        <span className="date-label">{displayDate(today)}</span>
      </div>
      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-icon green">
            <BookOpen size={21} />
          </span>
          <div>
            <span className="stat-label">YOUR JOURNEY</span>
            <strong>
              {completed}
              <small> / 365 days</small>
            </strong>
            <Progress
              value={(completed / 365) * 100}
              label="Annual completion"
            />
            <p>
              {((completed / 365) * 100).toFixed(1)}% of your Bible adventure
            </p>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon gold">
            <Sparkles size={21} />
          </span>
          <div>
            <span className="stat-label">TOTAL EXPERIENCE</span>
            <strong>
              {xp.toLocaleString()}
              <small> XP</small>
            </strong>
            <p>
              <span className="level-dot" />
              Level {level.number} · {level.name}
            </p>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon orange">
            <Flame size={21} />
          </span>
          <div>
            <span className="stat-label">READING STREAK</span>
            <strong>
              {streakDays}
              <small> {streakDays === 1 ? "day" : "days"}</small>
            </strong>
            <p>
              {streakDays
                ? "A lovely rhythm. Keep it growing!"
                : "A fresh start is always welcome."}
            </p>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon blue">
            <Trophy size={21} />
          </span>
          <div>
            <span className="stat-label">MILESTONES EARNED</span>
            <strong>
              {earned.length}
              <small> / {badges.length}</small>
            </strong>
            <p>Small steps worth celebrating</p>
          </div>
        </article>
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="mission-card">
            <div className="mission-copy">
              <span className="mission-kicker">
                <span className="live-dot" />
                TODAY’S READING MISSION{" "}
                <span>DAY {String(day).padStart(3, "0")}</span>
              </span>
              <h2>
                {day === 1
                  ? `Every great journey\nbegins with a word.`
                  : `A new day.\nA little deeper in the Word.`}
              </h2>
              <p className="mission-reference">{mission.label}</p>
              <p className="mission-description">
                Make a little room for Scripture today.
                <br />
                Read slowly. Notice what speaks to your heart.
              </p>
              <div className="mission-meta">
                <BookOpen size={15} />
                {mission.chapters.length} chapters <span />
                Canonical Journey
              </div>
              <Button asChild>
                <Link
                  href={`/bible?day=${day}&book=${resume.book}&chapter=${resume.chapter}`}
                >
                  {state.days[day]
                    ? "Revisit today’s reading"
                    : "Continue reading"}
                  <ArrowRight size={17} />
                </Link>
              </Button>
              <span className="mission-reward">
                {state.days[day] ? <Check size={14} /> : <Sparkles size={14} />}{" "}
                {state.days[day]
                  ? "Mission complete · XP awarded"
                  : "Complete your mission to earn 50 XP"}
              </span>
            </div>
            <JourneyArt className="mission-art" />
            <div className="mission-footer">
              <span>
                {chapterCount} of {mission.chapters.length} chapters completed
              </span>
              <Progress
                value={(chapterCount / mission.chapters.length) * 100}
                label="Today's reading progress"
              />
              <span>
                {Math.round((chapterCount / mission.chapters.length) * 100)}%
              </span>
            </div>
          </section>
          <section className="card daily-steps">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MAKE TIME FOR WHAT MATTERS</span>
                <h2>Your daily rhythm</h2>
              </div>
              <span className="soft-label">At your own pace</span>
            </div>
            {[
              {
                icon: BookOpen,
                title: "Spend time in Scripture",
                text: mission.label,
                href: `/bible?day=${day}`,
                done: !!state.days[day],
                reward: "50 XP",
              },
              {
                icon: CircleHelp,
                title: "Discover something new",
                text: quiz.length
                  ? `${quiz.length} thoughtful questions from today’s reading`
                  : "Explore the reviewed quiz collection",
                href: `/quiz?day=${day}`,
                done: quizDone,
                reward: quiz.length ? "10 XP / answer" : "Explore",
              },
              {
                icon: NotebookPen,
                title: "Pause. Reflect. Grow.",
                text: "What is God teaching you today?",
                href: "/journal",
                done: !!state.reflections[today],
                reward: "20 XP",
              },
            ].map(({ icon: Icon, title, text, href, done, reward }) => (
              <Link className="rhythm-row" href={href} key={title}>
                <span className={`rhythm-icon ${done ? "is-done" : ""}`}>
                  {done ? <Check size={20} /> : <Icon size={20} />}
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
                <span className="rhythm-reward">
                  {done ? "Completed" : reward}
                </span>
                <ChevronRight size={17} />
              </Link>
            ))}
          </section>
          <section className="card journey-preview">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CHAPTER BY CHAPTER</span>
                <h2>A story worth exploring</h2>
              </div>
              <SectionLink href="/achievements">View adventure map</SectionLink>
            </div>
            <div className="journey-books">
              {[
                {
                  name: "Genesis",
                  subtitle: "Beginnings",
                  id: "GEN",
                  total: 50,
                },
                {
                  name: "Exodus",
                  subtitle: "Deliverance",
                  id: "EXO",
                  total: 40,
                },
                {
                  name: "Leviticus",
                  subtitle: "A holy people",
                  id: "LEV",
                  total: 27,
                },
                {
                  name: "Numbers",
                  subtitle: "In the wilderness",
                  id: "NUM",
                  total: 36,
                },
              ].map((book, i) => {
                const read = Object.keys(state.chapters).filter((k) =>
                  k.startsWith(book.id + "."),
                ).length;
                return (
                  <Link
                    href={`/bible?book=${book.id}&chapter=1`}
                    className={`journey-book ${i === 0 ? "current" : ""}`}
                    key={book.id}
                  >
                    <span className="book-node">
                      {read === book.total ? (
                        <Check size={19} />
                      ) : (
                        <BookOpen size={19} />
                      )}
                    </span>
                    <strong>{book.name}</strong>
                    <small>{book.subtitle}</small>
                    <span className="book-count">
                      {read} / {book.total} chapters
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="dashboard-secondary">
          <section className="verse-card">
            <div className="verse-heading">
              <span className="eyebrow">A WORD FOR YOUR WALK</span>
              <Quote size={21} />
            </div>
            <blockquote>
              {psalm.verses.find((v) => v.number === 105)?.text}
            </blockquote>
            <span className="verse-reference">PSALM 119:105 · WEB</span>
            <div className="verse-divider" />
            <p>Let the Word light your next step.</p>
            <SectionLink href="/bible?book=PSA&chapter=119">
              Read the chapter
            </SectionLink>
          </section>
          <section className="card level-card">
            <div className="section-heading">
              <h2>Your next chapter</h2>
              <Compass size={21} />
            </div>
            <div className="level-summary">
              <span className="level-medallion">
                <Leaf size={27} />
              </span>
              <div>
                <small>LEVEL {level.number}</small>
                <strong>{level.name}</strong>
              </div>
            </div>
            <div className="level-progress-label">
              <span>{xp.toLocaleString()} XP</span>
              <span>
                {level.next
                  ? `${level.next.xp.toLocaleString()} XP`
                  : "Highest level"}
              </span>
            </div>
            <Progress value={level.progress} label="Level progression" />
            <p className="small muted">
              {level.next
                ? `${level.next.xp - xp} XP to ${level.next.name}`
                : "Keep exploring at your own pace."}
            </p>
          </section>
          <section className="card activity-card">
            <div className="section-heading">
              <h2>A little, every day</h2>
              <span className="soft-label">This week</span>
            </div>
            <div
              className="activity-chart"
              role="img"
              aria-label={`XP earned in the last seven days: ${activity.map((d) => `${d.label} ${d.xp}`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height={126}>
                <BarChart
                  data={activity}
                  margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
                >
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 14, fill: "var(--muted)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#8ba88920" }}
                    contentStyle={{
                      borderRadius: 10,
                      fontSize: 16,
                      background: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar
                    dataKey="xp"
                    name="XP"
                    fill="#6e927a"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="small muted">
              {xp
                ? "Every little moment adds up."
                : "Your first reading will plant the seed."}
            </p>
          </section>
        </aside>
      </div>
      <div className="gentle-reminder">
        <Leaf size={17} />
        <span>
          Your XP celebrates participation and consistency. Your faith is so
          much more than a number.
        </span>
      </div>
    </>
  );
}
