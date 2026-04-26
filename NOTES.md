# Project notes

Central pending-tasks file for the preed.ee/projects dashboard.
Each `## {project name}` heading must match the dashboard project name exactly.
Bullet lines (`-` or `*`) become pending items. Non-bullet lines are ignored.
Re-run `bun run build` to regenerate.

## tbdc / web
- Push to a GitHub remote (currently local-only repo)
- Deploy to Vercel and wire toothboutique.com (Phase 3 launch)
- Finish Phase 2 content + SEO + PDPA if still open

## tbdc / invoices
- Live-validate the new Canva invoice source on the next monthly run

## tbdc / docs
_(no pending items)_

## tbdc / brand-deck
_(no pending items)_

## tbdc / ads-monitor
- Move scheduled daily + weekly jobs from local launchd to GitHub Actions cron
- Unblock real-mode runs once Google Ads developer-token application is approved

## clinera
- Interview clinic staff on current booking workflow (1-hour conversation)
- Verify LINE Official Account + Messaging API channel exist (register if not)
- Resolve open decisions in Plans/foundation.md §2 (framework / runtime / DB / ORM / auth / hosting)
- Scaffold session — fresh Algorithm following matchday v0.1.0 pattern

## matchday
- Visual sanity check of magic-link flow once dev environment is fully wired
- Native-Thai review of matchday-web/messages/th.json before any visible launch

## matchday-backend
- v0.1.0 Foundation shipped (auth schema, RLS, on-signup trigger, Realtime POC, CI green)
- Set SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD repo secrets so deploy.yml can run
- Push v0.1.0 schema to remote prod project (`supabase db push` once secrets are set)
- v0.2.0 Player Identity: full profile fields, social OAuth providers, email infra

## matchday-web
- v0.1.0 Foundation shipped (Next.js 16 + shadcn + i18n TH/EN + magic-link auth)
- Visual smoke-test of magic-link → /me end-to-end (dev server fix landed today)
- v0.2.0 Player Identity: real player home, profile completion, OAuth buttons
- Set up Vercel project at v0.2.0+ and replace deploy.yml stub

## tps-scraping
_(no pending items)_

## the-padel-society-admin
_(no pending items)_

## padel-backend
_(no pending items)_

## mobile-app-padel
_(no pending items)_

## tps-monthly-reports
_(no pending items)_

## tps-tournament-dashboard
_(no pending items)_

## ptp-league-scheduler
_(no pending items)_

## amity-social-uikit-flutter
_(no pending items)_

## padelthailand
_(no pending items)_

## padel-clubs-scraper
_(no pending items)_

## anthropic-course
_(no pending items)_

## convert-xlsx-to-sheets
_(no pending items)_

## playbypoint
_(no pending items)_

## new-project
- Resume design — confirm 3 defaults (group prompt, status default, idempotency)
- Build skill at `~/.claude/skills/new-project/` (SKILL.md + run.ts)
- See PRD at `MEMORY/WORK/20260426-175239_build-new-project-skill/`
