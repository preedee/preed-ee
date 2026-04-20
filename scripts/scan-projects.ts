#!/usr/bin/env bun
import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { $ } from "bun";

const COWORK_ROOT = "/Users/preedee/Desktop/Cowork";
const OUT_JSON = resolve(import.meta.dir, "../site/projects.json");
const INDEX_HTML = resolve(import.meta.dir, "../site/index.html");

const TOP_EXCLUDE = new Set([".claude", ".DS_Store", "Plans", "libs", "preed-ee"]);
const TBDC_EXCLUDE = new Set(["Plans"]);

type Registry = { stack: string; purpose: string };
const META: Record<string, Registry> = {
  "tbdc / web":              { stack: "Next.js 16, React 19, TS", purpose: "Clinic website for Tooth Boutique Dental Clinic" },
  "tbdc / invoices":         { stack: "Bun, TypeScript, Playwright", purpose: "Monthly multi-vendor invoice aggregator" },
  "tbdc / docs":             { stack: "Docs",                      purpose: "HR job descriptions (Thai + English)" },
  "tbdc / brand-deck":       { stack: "Bun, TS, pptxgenjs",        purpose: "Bilingual onboarding deck generator" },
  "matchday":                { stack: "Next.js + specs",           purpose: "Matchday product hub site + spec docs" },
  "mobile-app-padel":        { stack: "Flutter",                   purpose: "Padel mobile app" },
  "padel-backend":           { stack: "Express / Node",            purpose: "Padel API backend" },
  "the-padel-society-admin": { stack: "Next.js 14, React 18",      purpose: "Padel Society admin console" },
  "amity-social-uikit-flutter": { stack: "Flutter (fork)",         purpose: "Amity Social UIKit fork" },
  "anthropic-course":        { stack: "Docs",                      purpose: "Anthropic course notes" },
  "convert-xlsx-to-sheets":  { stack: "Skill",                     purpose: "Scheduled skill definition" },
  "tps-monthly-reports":     { stack: "Skill",                     purpose: "The Padel Society monthly reports skill" },
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

async function isDir(p: string): Promise<boolean> {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

async function gitFirstCommit(dir: string): Promise<string | null> {
  try {
    const out = await $`git -C ${dir} log --reverse --format=%aI`.quiet().text();
    const first = out.split("\n").find((l) => l.trim().length > 0);
    return first?.trim() || null;
  } catch { return null; }
}

async function gitLastCommit(dir: string): Promise<string | null> {
  try {
    const out = (await $`git -C ${dir} log -1 --format=%aI`.quiet().text()).trim();
    return out || null;
  } catch { return null; }
}

async function describe(name: string, path: string): Promise<Project> {
  const meta = META[name] ?? { stack: "—", purpose: "—" };
  const hasGit = existsSync(join(path, ".git"));
  let createdAt: string | null = null;
  let updatedAt: string | null = null;
  let isGit = false;

  if (hasGit) {
    createdAt = await gitFirstCommit(path);
    updatedAt = await gitLastCommit(path);
    isGit = Boolean(createdAt && updatedAt);
  }
  if (!createdAt || !updatedAt) {
    const s = await stat(path);
    createdAt = createdAt ?? s.birthtime.toISOString();
    updatedAt = updatedAt ?? s.mtime.toISOString();
  }

  return { name, path, stack: meta.stack, purpose: meta.purpose, createdAt, updatedAt, isGit };
}

async function scan(): Promise<Project[]> {
  const entries = await readdir(COWORK_ROOT);
  const projects: Project[] = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    if (TOP_EXCLUDE.has(entry)) continue;
    const full = join(COWORK_ROOT, entry);
    if (!(await isDir(full))) continue;

    if (entry === "tbdc") {
      const subs = await readdir(full);
      for (const sub of subs) {
        if (sub.startsWith(".")) continue;
        if (TBDC_EXCLUDE.has(sub)) continue;
        const subFull = join(full, sub);
        if (!(await isDir(subFull))) continue;
        projects.push(await describe(`tbdc / ${sub}`, subFull));
      }
      continue;
    }

    projects.push(await describe(entry, full));
  }

  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return projects;
}

async function injectIntoHtml(json: string): Promise<boolean> {
  if (!existsSync(INDEX_HTML)) return false;
  const html = await readFile(INDEX_HTML, "utf8");
  const START = "<!-- DATA:START -->";
  const END = "<!-- DATA:END -->";
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if (s === -1 || e === -1) return false;
  const before = html.slice(0, s + START.length);
  const after = html.slice(e);
  const next = `${before}\n${json}\n    ${after}`;
  await writeFile(INDEX_HTML, next);
  return true;
}

async function main() {
  const projects = await scan();
  const payload = {
    scannedAt: new Date().toISOString(),
    count: projects.length,
    projects,
  };
  const json = JSON.stringify(payload, null, 2);
  await writeFile(OUT_JSON, json + "\n");
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
