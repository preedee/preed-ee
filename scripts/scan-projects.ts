#!/usr/bin/env bun
import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";

const COWORK_ROOT = "/Users/preedee/Desktop/Cowork";
const OUT_JSON = resolve(import.meta.dir, "../site/projects.json");
const INDEX_HTML = resolve(import.meta.dir, "../site/index.html");

const TOP_EXCLUDE = new Set([".claude", ".DS_Store", "Plans", "libs", "preed-ee"]);
const TBDC_EXCLUDE = new Set(["Plans"]);

const DATA_START = "<!-- DATA:START -->";
const DATA_END = "<!-- DATA:END -->";

type Registry = { stack: string; purpose: string };
const UNKNOWN: Registry = { stack: "—", purpose: "—" };

const META: Record<string, Registry> = {
  "tbdc / web":                 { stack: "Next.js 16, React 19, TS",  purpose: "Clinic website for Tooth Boutique Dental Clinic" },
  "tbdc / invoices":            { stack: "Bun, TypeScript, Playwright", purpose: "Monthly multi-vendor invoice aggregator" },
  "tbdc / docs":                { stack: "Docs",                        purpose: "HR job descriptions (Thai + English)" },
  "tbdc / brand-deck":          { stack: "Bun, TS, pptxgenjs",          purpose: "Bilingual onboarding deck generator" },
  "matchday":                   { stack: "Next.js + specs",             purpose: "Matchday product hub site + spec docs" },
  "mobile-app-padel":           { stack: "Flutter",                     purpose: "Padel mobile app" },
  "padel-backend":              { stack: "Express / Node",              purpose: "Padel API backend" },
  "the-padel-society-admin":    { stack: "Next.js 14, React 18",        purpose: "Padel Society admin console" },
  "amity-social-uikit-flutter": { stack: "Flutter (fork)",              purpose: "Amity Social UIKit fork" },
  "anthropic-course":           { stack: "Docs",                        purpose: "Anthropic course notes" },
  "convert-xlsx-to-sheets":     { stack: "Skill",                       purpose: "Scheduled skill definition" },
  "tps-monthly-reports":        { stack: "Skill",                       purpose: "The Padel Society monthly reports skill" },
};

type Project = {
  name: string;
  path: string;
  stack: string;
  purpose: string;
  createdAt: string;
  updatedAt: string;
  isGit: boolean;
};

async function gitDates(dir: string): Promise<{ first: string; last: string } | null> {
  try {
    const out = (await $`git -C ${dir} log --format=%aI`.quiet().text()).trim();
    if (!out) return null;
    const lines = out.split("\n");
    return { first: lines[lines.length - 1]!, last: lines[0]! };
  } catch { return null; }
}

async function describe(name: string, path: string): Promise<Project> {
  const meta = META[name] ?? UNKNOWN;
  const [dates, fs] = await Promise.all([gitDates(path), stat(path)]);
  const createdAt = dates?.first ?? fs.birthtime.toISOString();
  const updatedAt = dates?.last ?? fs.mtime.toISOString();
  return { name, path, stack: meta.stack, purpose: meta.purpose, createdAt, updatedAt, isGit: Boolean(dates) };
}

async function listDirs(path: string, exclude: Set<string>): Promise<{ name: string; full: string }[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !exclude.has(e.name))
    .map((e) => ({ name: e.name, full: join(path, e.name) }));
}

async function scan(): Promise<Project[]> {
  const top = await listDirs(COWORK_ROOT, TOP_EXCLUDE);
  const jobs: Promise<Project>[] = [];

  for (const { name, full } of top) {
    if (name === "tbdc") {
      const subs = await listDirs(full, TBDC_EXCLUDE);
      for (const s of subs) jobs.push(describe(`tbdc / ${s.name}`, s.full));
    } else {
      jobs.push(describe(name, full));
    }
  }

  const projects = await Promise.all(jobs);
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return projects;
}

async function injectIntoHtml(inlineJson: string): Promise<boolean> {
  let html: string;
  try { html = await readFile(INDEX_HTML, "utf8"); }
  catch { return false; }
  const s = html.indexOf(DATA_START);
  const e = html.indexOf(DATA_END);
  if (s === -1 || e === -1) return false;
  const next = html.slice(0, s + DATA_START.length) + "\n" + inlineJson + "\n    " + html.slice(e);
  await writeFile(INDEX_HTML, next);
  return true;
}

async function main() {
  const projects = await scan();
  const payload = { scannedAt: new Date().toISOString(), count: projects.length, projects };
  await writeFile(OUT_JSON, JSON.stringify(payload, null, 2) + "\n");
  const injected = await injectIntoHtml(JSON.stringify(payload));

  console.log(`scanned ${projects.length} projects`);
  console.log(`wrote ${OUT_JSON}`);
  console.log(injected ? `injected into ${INDEX_HTML}` : `index.html not found — skipped inject`);
  for (const p of projects) {
    console.log(`  ${p.createdAt.slice(0, 10)}  ${p.updatedAt.slice(0, 10)}  ${p.isGit ? "git" : "fs "}  ${p.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
