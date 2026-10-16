# Project plan

## Scope

Deliver a runnable, polished demo before external account integration. Start from this workspace and preserve existing user files. Never include recovery codes, credentials, environment files, or personal demo data in Git.

## Ordered milestones

1. **Planning:** repository inspection, architecture, roadmap, database model, and this plan; commit the planning baseline.
2. **Setup:** current compatible Next.js/React, TypeScript strict mode, Tailwind, ESLint, scripts, reusable components, and folders; verify the foundation and commit.
3. **UI:** landing page, desktop sidebar/mobile navigation, dashboard, reading plan, reader, quiz, journal, achievements, community information, profile, and themes.
4. **Functional demo:** 365-day canonical schedule; chapter and day completion; idempotent rewards; date-based streaks; curated quizzes; saved/editable private reflections; validated browser persistence. Commit a working UI and demo milestone after checks.
5. **Database preparation:** Supabase SQL schema, RLS, uniqueness, transaction boundary, repository contract, and Google OAuth integration plan. No credentials required and no production-auth claims.
6. **Validation:** lint, TypeScript, business-rule unit tests, production build, and browser checks where supported. Fix observed failures before committing.
7. **Handoff:** installation, demo limits, content licensing, deployment, implementation status, and remaining production work. Push validated milestones to the supplied GitHub repository if access is available.

## MVP acceptance

Run `npm install`, `npm run dev`, and open localhost:3000. Open the dashboard, read a mission, complete its chapters, earn XP once, answer a quiz, save/edit a reflection, inspect achievements, and retain demo progress after refresh. Dark mode and mobile navigation must work. Storage failure must be visible instead of reporting a false save.

## Deliberate limits

Canonical is the complete initial plan. Chronological and balanced plans require editorial review and will be clearly marked as future options rather than represented by fabricated schedules. Scripture must come from verified public-domain WEB files with provenance. Google sign-in, groups, grace-day policy, memory exercises, seven-day challenges, AI, push, and multilingual text follow the demo. No inactive buttons suggesting these features exist.

## Decisions

- Use a browser repository behind a typed persistence interface; production must replace it with authenticated Supabase access.
- Store completion calendar dates and a fixed journey timezone; derive XP from unique activity events.
- Make completion explicit and irreversible in the demo UI; editing a reflection never re-awards XP.
- Separate chapter completion from mission completion so a day earns 50 XP only when all its chapters are recorded.
- Use system fonts and code-native illustrations so builds do not depend on a font/image service.
- Use small curated quiz coverage and label days without questions honestly.
