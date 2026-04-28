# Project notes

Central pending-tasks file for the preed.ee/projects dashboard.
Each `## {project name}` heading must match the dashboard project name exactly.
Bullet lines (`-` or `*`) become pending items. Non-bullet lines are ignored.

**Display order:** Within each group, cards appear in the order their `##` headings
appear in this file. To reorder, move a `##` section up or down within its group.

**Group dividers below (`# Group Name`) are visual-only** — the parser ignores
single-`#` headings. Group membership is set in `scripts/scan-projects.ts` META,
not here. Moving a `##` section across `# Group` boundaries does nothing on the
dashboard until you also update its META group.

Re-run `bun run build` to regenerate.

---

# TBDC

## tbdc / web
- Push to a GitHub remote (currently local-only repo)
- Deploy to Vercel and wire toothboutique.com (Phase 3 launch)
- Finish Phase 2 content + SEO + PDPA if still open

## tbdc / invoices
- Live-validate the new Canva invoice source on the next monthly run
- Add Shopee invoice downloads
- Add CSV summary to paste into Expenses sheet

## tbdc / docs
_(no pending items)_

## tbdc / brand-deck
- Split into brand deck and training deck
- Enhance training deck to add daily checklist, TBDC contact info

## tbdc / ads-monitor
- Move scheduled daily + weekly jobs from local launchd to GitHub Actions cron
- Unblock real-mode runs once Google Ads developer-token application is approved

## tbdc / chatbot
_(no pending items)_

---

# Clinera

## clinera
- Verify LINE Official Account + Messaging API channel exist (register if not)
- Resolve open decisions in Plans/foundation.md §2 (framework / runtime / DB / ORM / auth / hosting)
- Scaffold session — fresh Algorithm following matchday v0.1.0 pattern

## dentsoft-strategy-deck
_(no pending items)_

---

# TPS

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

## tps-data-analytics
_(no pending items)_

---

# Matchday

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
- Test scraping script with latest TPS tournament

---

# Padel Thailand

## padelthailand
_(no pending items)_

## padel-clubs-scraper
- Scrape padel clubs in Bangkok

---

# Other

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
