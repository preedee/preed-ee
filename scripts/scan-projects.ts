#!/usr/bin/env bun
import { readdir, stat, readFile, writeFile, rm, mkdir, copyFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { $ } from "bun";

const COWORK_ROOT = "/Users/preedee/Desktop/Cowork";
const SITE_ROOT = resolve(import.meta.dir, "../docs");
const LOGOS_DIR = join(SITE_ROOT, "logos");
const DASHBOARD_TEMPLATE = resolve(import.meta.dir, "dashboard-template.html");
const DASHBOARD_HTML = join(SITE_ROOT, "projects", "index.html");

const TOP_EXCLUDE = new Set([".claude", ".DS_Store", "Plans", "libs", "preed-ee"]);
const TBDC_EXCLUDE = new Set(["Plans"]);

const DATA_START = "<!-- DATA:START -->";
const DATA_END = "<!-- DATA:END -->";

type LogoSpec =
  | { kind: "copy"; from: string; as: string }
  | { kind: "local"; file: string; as: string }
  | { kind: "monogram"; letter: string; bg: string; fg: string; as: string };

type ProjectStatus = "live" | "wip" | "paused" | "skill" | "fork" | "archived";

type Meta = { stack: string; purpose: string; group: string; logo: LogoSpec; status: ProjectStatus };

const GROUP_TBDC = "Tooth Boutique Dental Clinic";
const GROUP_PADEL = "Padel";
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
  "tbdc / brand-deck":          { stack: "Bun, TS, pptxgenjs",            purpose: "Bilingual onboarding deck generator",             group: GROUP_TBDC, logo: TBDC_LOGO, status: "live" },
  "matchday":                   { stack: "Next.js + specs",               purpose: "Matchday product hub site + spec docs",           group: GROUP_PADEL, logo: MATCHDAY_LOGO, status: "wip" },
  "mobile-app-padel":           { stack: "Flutter",                       purpose: "TPS mobile app",                                  group: GROUP_PADEL, logo: TPS_LOGO, status: "wip" },
  "padel-backend":              { stack: "Express / Node",                purpose: "Padel API backend",                               group: GROUP_PADEL, logo: TPS_LOGO, status: "live" },
  "the-padel-society-admin":    { stack: "Next.js 14, React 18",          purpose: "Padel Society admin console",                     group: GROUP_PADEL, logo: TPS_LOGO, status: "live" },
  "amity-social-uikit-flutter": { stack: "Flutter (fork)",                purpose: "Amity Social UIKit fork",                         group: GROUP_PADEL, logo: AMITY_LOGO, status: "fork" },
  "tps-monthly-reports":        { stack: "Skill",                         purpose: "The Padel Society monthly reports skill",         group: GROUP_PADEL, logo: TPS_LOGO, status: "skill" },
  "padelthailand":              { stack: "HTML/CSS/JS, Leaflet",          purpose: "Tournament calendar for padel in Thailand",       group: GROUP_PADEL_THAILAND, logo: PADEL_THAILAND_LOGO, status: "live" },
  "anthropic-course":           { stack: "Docs",                          purpose: "Anthropic course notes",                          group: GROUP_OTHER, logo: { kind: "monogram", letter: "A", bg: "#d97757", fg: "#ffffff", as: "anthropic.svg" }, status: "paused" },
  "convert-xlsx-to-sheets":     { stack: "Skill",                         purpose: "Scheduled skill definition",                      group: GROUP_OTHER, logo: { kind: "monogram", letter: "X", bg: "#475569", fg: "#f8fafc", as: "xlsx.svg" }, status: "skill" },
};

const GROUP_ORDER = [GROUP_TBDC, GROUP_PADEL, GROUP_PADEL_THAILAND, GROUP_OTHER];

const GROUP_NAV_LABELS: Record<string, string> = {
  [GROUP_TBDC]: "TBDC",
  [GROUP_PADEL]: "Padel",
  [GROUP_PADEL_THAILAND]: "Padel TH",
  [GROUP_OTHER]: "Other",
};

const PADEL_ORDER = [
  "the-padel-society-admin",
  "padel-backend",
  "mobile-app-padel",
  "tps-monthly-reports",
  "matchday",
  "amity-social-uikit-flutter",
];

const GROUP_EXPLICIT_ORDER: Record<string, string[]> = {
  [GROUP_PADEL]: PADEL_ORDER,
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

async function gitDates(dir: string): Promise<{ first: string; last: string } | null> {
  try {
    const out = (await $`git -C ${dir} log --format=%aI`.quiet().text()).trim();
    if (!out) return null;
    const lines = out.split("\n");
    return { first: lines[lines.length - 1]!, last: lines[0]! };
  } catch { return null; }
}

async function describe(name: string, path: string): Promise<Project | null> {
  const meta = META[name];
  if (!meta) return null;
  const [dates, fs] = await Promise.all([gitDates(path), stat(path)]);
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
  };
}

async function listDirs(path: string, exclude: Set<string>) {
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !exclude.has(e.name))
    .map((e) => ({ name: e.name, full: join(path, e.name) }));
}

async function scan(): Promise<Project[]> {
  const top = await listDirs(COWORK_ROOT, TOP_EXCLUDE);
  const jobs: Promise<Project | null>[] = [];
  for (const { name, full } of top) {
    if (name === "tbdc") {
      const subs = await listDirs(full, TBDC_EXCLUDE);
      for (const s of subs) jobs.push(describe(`tbdc / ${s.name}`, s.full));
    } else {
      jobs.push(describe(name, full));
    }
  }
  const resolved = await Promise.all(jobs);
  const projects = resolved.filter((p): p is Project => p !== null);
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return projects;
}

function groupProjects(projects: Project[]) {
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
      projects: applyGroupOrder(g, byGroup.get(g)!),
    }));
}

function applyGroupOrder(group: string, projects: Project[]): Project[] {
  const explicit = GROUP_EXPLICIT_ORDER[group];
  if (!explicit) return projects;
  const indexOf = (name: string) => {
    const i = explicit.indexOf(name);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const missing = projects.filter((p) => !explicit.includes(p.name)).map((p) => p.name);
  if (missing.length > 0) console.warn(`[${group}] not in explicit order, appended: ${missing.join(", ")}`);
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
  const projects = await scan();
  const groups = groupProjects(projects);
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
