#!/usr/bin/env bun
import { readdir, stat, readFile, writeFile, rm, mkdir, copyFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { $ } from "bun";

const COWORK_ROOT = "/Users/preedee/Desktop/Cowork";
const SITE_ROOT = resolve(import.meta.dir, "../docs");
const LOGOS_DIR = join(SITE_ROOT, "logos");
const DASHBOARD_TEMPLATE = resolve(import.meta.dir, "dashboard-template.html");
const DASHBOARD_HTML = join(SITE_ROOT, "projects", "index.html");
const NOTES_FILE = resolve(import.meta.dir, "../NOTES.md");

const TOP_EXCLUDE = new Set([".claude", ".DS_Store", "Plans", "libs", "preed-ee"]);
const TBDC_EXCLUDE = new Set(["Plans"]);

const DATA_START = "<!-- DATA:START -->";
const DATA_END = "<!-- DATA:END -->";

type LogoSpec =
  | { kind: "copy"; from: string; as: string }
  | { kind: "local"; file: string; as: string }
  | { kind: "monogram"; letter: string; bg: string; fg: string; as: string };

type ProjectStatus = "live" | "wip" | "paused" | "skill" | "fork" | "archived";

type Meta = { stack: string; purpose: string; group: string; logo: LogoSpec; status: ProjectStatus; pendingActions?: string[]; gitExcludePaths?: string[]; website?: string };

const GROUP_TBDC = "Tooth Boutique Dental Clinic";
const GROUP_CLINERA = "Clinera";
const GROUP_MATCHDAY = "Matchday";
const GROUP_PADEL = "The Padel Society";
const GROUP_PADEL_THAILAND = "Padel Thailand";
const GROUP_OTHER = "Other";

const TBDC_LOGO: LogoSpec = { kind: "copy", from: "tbdc/brand-deck/assets/logo-monogram.png", as: "tbdc.png" };
const TPS_LOGO: LogoSpec = { kind: "local", file: "tps-logo.png", as: "tps.png" };
const MATCHDAY_LOGO: LogoSpec = { kind: "local", file: "matchday-logo.png", as: "matchday.png" };
const AMITY_LOGO: LogoSpec = { kind: "copy", from: "amity-social-uikit-flutter/assets/images/ShareWorldLogo.png", as: "amity.png" };
const PADEL_THAILAND_LOGO: LogoSpec = { kind: "copy", from: "padelthailand/img/logo.svg", as: "padelthailand.svg" };

const META: Record<string, Meta> = {
  "tbdc / web":                 { stack: "Next.js 16, React 19, TS",     purpose: "Clinic website for Tooth Boutique Dental Clinic", group: GROUP_TBDC, logo: TBDC_LOGO, status: "live" },
  "tbdc / invoices":            { stack: "Bun, TypeScript, Playwright",   purpose: "Monthly multi-vendor invoice aggregator",         group: GROUP_TBDC, logo: TBDC_LOGO, status: "live" },
  "tbdc / docs":                { stack: "Docs",                          purpose: "HR job descriptions (Thai + English)",            group: GROUP_TBDC, logo: TBDC_LOGO, status: "live" },
  "tbdc / brand-deck":          { stack: "Bun, TS, pptxgenjs",            purpose: "Bilingual deck generators: onboarding, team profiles, monthly schedule, operations manual", group: GROUP_TBDC, logo: TBDC_LOGO, status: "live" },
  "tbdc / ads-monitor":         { stack: "Bun, TS, google-ads-api",       purpose: "Google Ads spend/KPI monitor + weekly digest",    group: GROUP_TBDC, logo: TBDC_LOGO, status: "wip" },
  "tbdc / chatbot":             { stack: "Planning phase",                purpose: "AI chatbot for TBDC patient inquiries",           group: GROUP_TBDC, logo: TBDC_LOGO, status: "wip" },
  "tbdc / payroll":             { stack: "Python, gspread, weasyprint",   purpose: "Payroll automation for Tooth Boutique Dental Clinic", group: GROUP_TBDC, logo: TBDC_LOGO, status: "live" },
  "tbdc / df":                  { stack: "Planning phase",                purpose: "Doctor fee tracking and payout management for TBDC clinic", group: GROUP_TBDC, logo: TBDC_LOGO, status: "wip" },
  "tbdc / inventory":           { stack: "Google Sheets, conditional formatting", purpose: "Sheets-based clinic inventory — 3 tabs, live stock, role-based", group: GROUP_TBDC, logo: TBDC_LOGO, status: "wip", website: "https://docs.google.com/spreadsheets/d/1BAm_CD_dpssyqH-Xya_JsdCtTF9mvvBnF7aUUSQCmvg/edit" },
  "clinera":                    { stack: "Planning phase",                purpose: "Dental clinic ops + LINE booking + reminders",   group: GROUP_CLINERA, logo: { kind: "monogram", letter: "C", bg: "#5C8A5A", fg: "#ffffff", as: "clinera.svg" }, status: "wip" },
  "dentsoft-strategy-deck":     { stack: "Bun, TS, pptxgenjs, HTML",      purpose: "Competitive strategy brief on Dentsoft (dentsoft.in) — PPTX deck + single-page web brief", group: GROUP_CLINERA, logo: { kind: "monogram", letter: "D", bg: "#0B2545", fg: "#ffffff", as: "dentsoft.svg" }, status: "live", website: "https://preed.ee/clinera/dentsoft" },
  "matchday":                   { stack: "Next.js (product-hub), MD specs", purpose: "Matchday spec docs + product-hub marketing site", group: GROUP_MATCHDAY, logo: MATCHDAY_LOGO, status: "wip", website: "https://padelthailand.com/matchday/" },
  "matchday-backend":           { stack: "Supabase (PG17 + Edge Fns)",    purpose: "Matchday backend — Postgres + Edge Functions + Realtime", group: GROUP_MATCHDAY, logo: MATCHDAY_LOGO, status: "wip" },
  "matchday-web":               { stack: "Next.js 16, React 19, Tailwind 4", purpose: "Matchday Next.js frontend — single-elim padel tournaments", group: GROUP_MATCHDAY, logo: MATCHDAY_LOGO, status: "wip" },
  "tps-scraping":               { stack: "Python",                        purpose: "Parse Thai Padel Series tournament PDFs → CSV",  group: GROUP_MATCHDAY, logo: MATCHDAY_LOGO, status: "wip" },
  "mobile-app-padel":           { stack: "Flutter",                       purpose: "TPS mobile app",                                  group: GROUP_PADEL, logo: TPS_LOGO, status: "wip" },
  "padel-backend":              { stack: "Express / Node",                purpose: "Padel API backend",                               group: GROUP_PADEL, logo: TPS_LOGO, status: "live" },
  "the-padel-society-admin":    { stack: "Next.js 14, React 18",          purpose: "Padel Society admin console",                     group: GROUP_PADEL, logo: TPS_LOGO, status: "live" },
  "amity-social-uikit-flutter": { stack: "Flutter (fork)",                purpose: "Amity Social UIKit fork",                         group: GROUP_PADEL, logo: AMITY_LOGO, status: "fork" },
  "tps-monthly-reports":        { stack: "Skill",                         purpose: "The Padel Society monthly reports skill",         group: GROUP_PADEL, logo: TPS_LOGO, status: "skill" },
  "tps-tournament-dashboard":   { stack: "HTML/CSS/JS",                   purpose: "Static tournament results dashboard",             group: GROUP_PADEL, logo: TPS_LOGO, status: "wip" },
  "ptp-league-scheduler":       { stack: "Python",                        purpose: "Generate padel league round-robin schedule",      group: GROUP_PADEL, logo: TPS_LOGO, status: "wip" },
  "tps-data-analytics":         { stack: "Planning phase",                purpose: "Data analytics for The Padel Society",            group: GROUP_PADEL, logo: TPS_LOGO, status: "wip" },
  "padelthailand":              { stack: "HTML/CSS/JS, Leaflet",          purpose: "Tournament calendar for padel in Thailand",       group: GROUP_PADEL_THAILAND, logo: PADEL_THAILAND_LOGO, status: "live", gitExcludePaths: ["matchday", ".nojekyll"], website: "https://padelthailand.com/" },
  "padel-clubs-scraper":        { stack: "Python, Google Places",         purpose: "Scrape Thailand padel clubs directory",           group: GROUP_PADEL_THAILAND, logo: PADEL_THAILAND_LOGO, status: "wip" },
  "anthropic-course":           { stack: "Docs",                          purpose: "Anthropic course notes",                          group: GROUP_OTHER, logo: { kind: "monogram", letter: "A", bg: "#d97757", fg: "#ffffff", as: "anthropic.svg" }, status: "paused" },
  "convert-xlsx-to-sheets":     { stack: "Skill",                         purpose: "Scheduled skill definition",                      group: GROUP_OTHER, logo: { kind: "monogram", letter: "X", bg: "#475569", fg: "#f8fafc", as: "xlsx.svg" }, status: "skill" },
  "playbypoint":                { stack: "Docs",                          purpose: "PlayByPoint build specs and prompt templates",    group: GROUP_OTHER, logo: { kind: "monogram", letter: "P", bg: "#334155", fg: "#f8fafc", as: "playbypoint.svg" }, status: "wip" },
  "new-project":                { stack: "PAI skill (in design)",         purpose: "/new-project slash command — auto-register a new Cowork project on this dashboard", group: GROUP_OTHER, logo: { kind: "monogram", letter: "N", bg: "#7dd3c0", fg: "#0a0a0a", as: "new-project.svg" }, status: "wip" },
  "organize-folder":            { stack: "Bun, TypeScript",               purpose: "Reusable CLI: dedupe + translate Thai filenames + route into folder structure", group: GROUP_OTHER, logo: { kind: "monogram", letter: "O", bg: "#475569", fg: "#f8fafc", as: "organize-folder.svg" }, status: "live" },
};

const GROUP_ORDER = [GROUP_TBDC, GROUP_CLINERA, GROUP_PADEL, GROUP_MATCHDAY, GROUP_PADEL_THAILAND, GROUP_OTHER];

const GROUP_NAV_LABELS: Record<string, string> = {
  [GROUP_TBDC]: "TBDC",
  [GROUP_CLINERA]: "Clinera",
  [GROUP_MATCHDAY]: "Matchday",
  [GROUP_PADEL]: "TPS",
  [GROUP_PADEL_THAILAND]: "Padel TH",
  [GROUP_OTHER]: "Other",
};

type Project = {
  name: string;
  stack: string;
  purpose: string;
  createdAt: string;
  updatedAt: string;
  isGit: boolean;
  group: string;
  logoPath: string;
  status: ProjectStatus;
  pendingActions?: string[];
  website?: string;
};

function monogramSvg(letter: string, bg: string, fg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${bg}"/><text x="32" y="44" font-family="ui-monospace, SF Mono, Menlo, monospace" font-size="36" font-weight="600" fill="${fg}" text-anchor="middle">${letter}</text></svg>`;
}

async function materializeLogos(): Promise<void> {
  await rm(LOGOS_DIR, { recursive: true, force: true });
  await mkdir(LOGOS_DIR, { recursive: true });
  const done = new Set<string>();
  for (const meta of Object.values(META)) {
    const { logo } = meta;
    if (done.has(logo.as)) continue;
    done.add(logo.as);
    const dest = join(LOGOS_DIR, logo.as);
    if (logo.kind === "copy") {
      await copyFile(join(COWORK_ROOT, logo.from), dest);
    } else if (logo.kind === "local") {
      await copyFile(resolve(import.meta.dir, logo.file), dest);
    } else {
      await writeFile(dest, monogramSvg(logo.letter, logo.bg, logo.fg));
    }
  }
}

async function gitDates(dir: string, excludePaths?: string[]): Promise<{ first: string; last: string } | null> {
  try {
    const pathspec = excludePaths && excludePaths.length > 0
      ? ["--", ".", ...excludePaths.map((p) => `:(exclude)${p}`)]
      : [];
    const out = (await $`git -C ${dir} log --format=%aI ${pathspec}`.quiet().text()).trim();
    if (!out) return null;
    const lines = out.split("\n");
    return { first: lines[lines.length - 1]!, last: lines[0]! };
  } catch { return null; }
}

type NotesData = { pending: Map<string, string[]>; order: string[] };

async function readNotesMd(): Promise<NotesData> {
  const pending = new Map<string, string[]>();
  const order: string[] = [];
  let raw: string;
  try { raw = await readFile(NOTES_FILE, "utf8"); } catch { return { pending, order }; }
  let currentName: string | null = null;
  let currentItems: string[] = [];
  const flush = () => {
    if (currentName && currentItems.length > 0) pending.set(currentName, currentItems);
    currentName = null;
    currentItems = [];
  };
  for (const line of raw.split("\n")) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      currentName = heading[1]!.trim();
      order.push(currentName);
      continue;
    }
    if (!currentName) continue;
    const bullet = /^[-*]\s+(\S.*)$/.exec(line.trim());
    if (bullet) currentItems.push(bullet[1]!.trim());
  }
  flush();
  return { pending, order };
}

async function describe(name: string, path: string, notes: Map<string, string[]>): Promise<Project | null> {
  const meta = META[name];
  if (!meta) return null;
  const [dates, fs] = await Promise.all([gitDates(path, meta.gitExcludePaths), stat(path)]);
  const nextActions = notes.get(name);
  return {
    name,
    stack: meta.stack,
    purpose: meta.purpose,
    createdAt: dates?.first ?? fs.birthtime.toISOString(),
    updatedAt: dates?.last ?? fs.mtime.toISOString(),
    isGit: Boolean(dates),
    group: meta.group,
    logoPath: `/logos/${meta.logo.as}`,
    status: meta.status,
    pendingActions: nextActions ?? meta.pendingActions,
    website: meta.website,
  };
}

async function listDirs(path: string, exclude: Set<string>) {
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !exclude.has(e.name))
    .map((e) => ({ name: e.name, full: join(path, e.name) }));
}

async function scan(): Promise<{ projects: Project[]; notesOrder: string[] }> {
  const notes = await readNotesMd();
  const top = await listDirs(COWORK_ROOT, TOP_EXCLUDE);
  const jobs: Promise<Project | null>[] = [];
  const knownNames: string[] = [];
  for (const { name, full } of top) {
    if (name === "tbdc") {
      const subs = await listDirs(full, TBDC_EXCLUDE);
      for (const s of subs) {
        const fullName = `tbdc / ${s.name}`;
        knownNames.push(fullName);
        jobs.push(describe(fullName, s.full, notes.pending));
      }
    } else {
      knownNames.push(name);
      jobs.push(describe(name, full, notes.pending));
    }
  }
  const unknownHeadings = notes.order.filter((k) => !knownNames.includes(k));
  if (unknownHeadings.length > 0) {
    console.warn(`[NOTES.md] unknown project headings (not matched): ${unknownHeadings.join(", ")}`);
  }
  const resolved = await Promise.all(jobs);
  const projects = resolved.filter((p): p is Project => p !== null);
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { projects, notesOrder: notes.order };
}

function groupProjects(projects: Project[], notesOrder: string[]) {
  const byGroup = new Map<string, Project[]>();
  for (const p of projects) {
    const arr = byGroup.get(p.group) ?? [];
    arr.push(p);
    byGroup.set(p.group, arr);
  }
  return GROUP_ORDER
    .filter((g) => byGroup.has(g))
    .map((g) => ({
      name: g,
      navLabel: GROUP_NAV_LABELS[g] ?? g,
      projects: applyNotesOrder(g, byGroup.get(g)!, notesOrder),
    }));
}

function applyNotesOrder(group: string, projects: Project[], notesOrder: string[]): Project[] {
  const indexOf = (name: string) => {
    const i = notesOrder.indexOf(name);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const missing = projects.filter((p) => !notesOrder.includes(p.name)).map((p) => p.name);
  if (missing.length > 0) console.warn(`[${group}] not in NOTES.md, falling back to date-sort: ${missing.join(", ")}`);
  return [...projects].sort((a, b) => {
    const ia = indexOf(a.name);
    const ib = indexOf(b.name);
    if (ia !== ib) return ia - ib;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

async function renderDashboard(inlineJson: string): Promise<void> {
  const template = await readFile(DASHBOARD_TEMPLATE, "utf8");
  const s = template.indexOf(DATA_START);
  const e = template.indexOf(DATA_END);
  if (s === -1 || e === -1) throw new Error("template missing DATA:START/END markers");
  const next = template.slice(0, s + DATA_START.length) + "\n" + inlineJson + "\n    " + template.slice(e);
  await mkdir(dirname(DASHBOARD_HTML), { recursive: true });
  await writeFile(DASHBOARD_HTML, next);
}

async function main() {
  await materializeLogos();
  const { projects, notesOrder } = await scan();
  const groups = groupProjects(projects, notesOrder);
  const payload = {
    scannedAt: new Date().toISOString(),
    count: projects.length,
    groups,
  };
  await renderDashboard(JSON.stringify(payload));
  console.log(`scanned ${projects.length} projects across ${groups.length} groups`);
  console.log(`rendered ${DASHBOARD_HTML}`);
  for (const g of groups) {
    console.log(`  [${g.name}] ${g.projects.length}`);
    for (const p of g.projects) {
      console.log(`    ${p.updatedAt.slice(0, 10)}  ${p.isGit ? "git" : "fs "}  ${p.name}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
