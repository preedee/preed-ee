#!/usr/bin/env bun
/**
 * build-fitness.ts — render the Whoop fitness dashboard to docs/personal/fitness/
 *
 * Reads ~/.claude/MEMORY/health/whoop_daily.jsonl (written by PAI Whoop.ts pull),
 * renders a self-contained static page, and staticrypt-encrypts it with the
 * site password so no plaintext health data is ever committed.
 *
 *   bun run scripts/build-fitness.ts               # build + encrypt → docs/
 *   bun run scripts/build-fitness.ts --no-encrypt  # plaintext preview → .tmp-fitness/preview.html
 */

import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { staticryptFile } from "./lib/staticrypt";

const ROOT = resolve(import.meta.dir, "..");
const DATA = join(homedir(), ".claude", "MEMORY", "health", "whoop_daily.jsonl");
const DEXA = join(homedir(), ".claude", "MEMORY", "health", "dexa.json");
const OUT_DIR = join(ROOT, "docs", "personal", "fitness");
const TMP_DIR = join(ROOT, ".tmp-fitness");
const DAYS = 30;
const ICT_OFFSET_MS = 7 * 3600_000;
const SLEEP_TARGET_H = 7.5;
// Whoop's own recovery zone thresholds — single source for zone() and the legend
const REC_GREEN_MIN = 67;
const REC_YELLOW_MIN = 34;

// ---------- data ----------

type Rec = Record<string, any>;

function ictDay(iso: string): string {
  return new Date(new Date(iso).getTime() + ICT_OFFSET_MS).toISOString().slice(0, 10);
}

// NOTE: full-file parse of an append-only, ever-growing JSONL. Fine for years at
// ~20 records/day; if it ever feels slow, compact the file (keep newest per id).
function loadLatest(): Map<string, Rec> {
  const byKey = new Map<string, Rec>();
  for (const line of readFileSync(DATA, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let r: Rec;
    try { r = JSON.parse(line); } catch { continue; }
    const key = `${r.type}:${r.id}`;
    const prev = byKey.get(key);
    if (!prev || (r.updated_at ?? "") > (prev.updated_at ?? "")) byKey.set(key, r);
  }
  return byKey;
}

function sleepHours(s: Rec): number | null {
  const st = s.score?.stage_summary;
  if (!st) return null;
  return (st.total_light_sleep_time_milli + st.total_slow_wave_sleep_time_milli + st.total_rem_sleep_time_milli) / 3_600_000;
}

interface Day {
  date: string;            // YYYY-MM-DD (ICT)
  sleepH: number | null;
  sleepPerf: number | null;
  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  strain: number | null;
  workouts: { sport: string; strain: number | null; avgHr: number | null; start: string }[];
}

function buildDays(records: Map<string, Rec>): Day[] {
  const sleepsById = new Map<string, Rec>();
  const days = new Map<string, Day>();
  const today = ictDay(new Date().toISOString());
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(new Date(today + "T00:00:00Z").getTime() - i * 86_400_000).toISOString().slice(0, 10);
    days.set(d, { date: d, sleepH: null, sleepPerf: null, recovery: null, hrv: null, rhr: null, strain: null, workouts: [] });
  }
  const get = (d: string) => days.get(d);

  for (const r of records.values()) {
    if (r.type === "sleep") {
      sleepsById.set(String(r.id), r);
      if (r.nap) continue;
      const day = get(ictDay(r.end));
      if (!day) continue;
      const h = sleepHours(r);
      // keep the longest sleep of the day (main sleep beats fragments)
      if (h !== null && h > (day.sleepH ?? -1)) {
        day.sleepH = h;
        day.sleepPerf = r.score?.sleep_performance_percentage ?? null;
      }
    }
  }
  for (const r of records.values()) {
    if (r.type === "recovery" && r.score) {
      const sleep = sleepsById.get(String(r.sleep_id));
      const day = get(ictDay(sleep?.end ?? r.created_at));
      if (!day) continue;
      day.recovery = r.score.recovery_score ?? null;
      day.hrv = r.score.hrv_rmssd_milli ?? null;
      day.rhr = r.score.resting_heart_rate ?? null;
    } else if (r.type === "cycle" && r.score) {
      const day = get(ictDay(r.start));
      if (day) day.strain = r.score.strain ?? null;
    } else if (r.type === "workout") {
      const day = get(ictDay(r.start));
      if (day) day.workouts.push({
        sport: r.sport_name ?? "activity",
        strain: r.score?.strain ?? null,
        avgHr: r.score?.average_heart_rate ?? null,
        start: r.start,
      });
    }
  }
  for (const d of days.values()) d.workouts.sort((a, b) => a.start.localeCompare(b.start));
  return [...days.values()];
}

// ---------- formatting ----------

const f1 = (n: number | null) => (n === null ? "–" : (Math.round(n * 10) / 10).toFixed(1));
const f0 = (n: number | null) => (n === null ? "–" : String(Math.round(n)));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dayLabel = (d: string) => {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};
const weekday = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const SPORT_LABELS: Record<string, string> = {
  "paddle-tennis": "Padel", weightlifting: "Gym", walking: "Walk",
  tennis: "Tennis", cycling: "Cycling", running: "Run", activity: "Activity",
};
const sportLabel = (s: string) => SPORT_LABELS[s] ?? s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const zone = (r: number) => (r >= REC_GREEN_MIN ? "good" : r >= REC_YELLOW_MIN ? "warn" : "crit");
const ZONE_META = {
  good: { label: "Green", icon: "▲", verdict: "Train hard — the body is ready.", padel: "Full-send padel day. Book the tough match." },
  warn: { label: "Yellow", icon: "◆", verdict: "Moderate — train, but leave a gear in reserve.", padel: "Padel is fine; skip the third set and max sprints." },
  crit: { label: "Red", icon: "▼", verdict: "Recover — light movement only today.", padel: "If padel is booked, play social pace or reschedule." },
};

// ---------- SVG charts ----------
// viewBox is 720 units wide but renders at ~292 CSS px on a phone (scale ~0.41),
// so in-SVG font sizes / strokes are authored ~2.4x their intended CSS px size.

const CW = 720, CH = 190, PAD_L = 52, PAD_R = 10, PAD_T = 20, PAD_B = 34;
const plotW = CW - PAD_L - PAD_R;
const TICK_LABEL_PX = 48;   // approx rendered width of a "29 Jul" tick label, in viewBox units

function xBand(i: number, n: number) {
  const step = plotW / n;
  return { x: PAD_L + i * step, w: Math.max(2, step - 2), cx: PAD_L + i * step + step / 2, step };
}

function gridY(vals: number[], yOf: (v: number) => number, fmt: (v: number) => string): string {
  return vals.map(v =>
    `<line x1="${PAD_L}" x2="${CW - PAD_R}" y1="${yOf(v)}" y2="${yOf(v)}" class="grid"/>` +
    `<text x="${PAD_L - 8}" y="${yOf(v) + 7}" class="tick" text-anchor="end">${fmt(v)}</text>`
  ).join("");
}

function gridVals(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min + step; v <= max; v += step) out.push(v);
  return out;
}

function xTicks(days: Day[], H: number, every = 7): string {
  const step = plotW / days.length;
  return days.map((d, i) => {
    const isLast = i === days.length - 1;
    // suppress periodic labels that would land within one label-width of the final label
    if (!isLast && (i % every !== 0 || (days.length - 1 - i) * step < TICK_LABEL_PX)) return "";
    const { cx } = xBand(i, days.length);
    // right-align the final label so it can't clip past the viewBox edge
    return isLast
      ? `<text x="${CW - 2}" y="${H - 10}" class="tick" text-anchor="end">${dayLabel(d.date)}</text>`
      : `<text x="${cx}" y="${H - 10}" class="tick" text-anchor="middle">${dayLabel(d.date)}</text>`;
  }).join("");
}

// full-height invisible per-day hit columns: one generous touch/hover target per
// day instead of skinny bars / tiny dots carrying the tooltip
function hitCols(days: Day[], H: number, tip: (d: Day) => string | null): string {
  return days.map((d, i) => {
    const t = tip(d);
    if (!t) return "";
    const { x, step } = xBand(i, days.length);
    return `<rect x="${x - 1}" y="${PAD_T}" width="${step}" height="${H - PAD_T - PAD_B}" class="hitcol" data-tip="${esc(t)}"/>`;
  }).join("");
}

function svgOpen(title: string, H = CH): string {
  return `<svg viewBox="0 0 ${CW} ${H}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet">`;
}

function barChart(days: Day[], opts: {
  title: string; value: (d: Day) => number | null; max: number; yStep: number;
  color: (d: Day, v: number) => string; tip: (d: Day, v: number) => string;
  target?: number; targetLabel?: string; fmt?: (v: number) => string;
}): string {
  const yOf = (v: number) => PAD_T + (CH - PAD_T - PAD_B) * (1 - v / opts.max);
  const fmt = opts.fmt ?? ((v: number) => String(v));
  const pts: { i: number; v: number }[] = [];
  let bars = "";
  days.forEach((d, i) => {
    const v = opts.value(d);
    if (v === null) return;
    pts.push({ i, v });
    const { x, w } = xBand(i, days.length);
    const y = yOf(Math.min(v, opts.max));
    bars += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(1, CH - PAD_B - y)}" rx="3" ry="3" fill="${opts.color(d, v)}" class="bar"/>`;
  });
  const last = pts[pts.length - 1];
  const lastLabel = last
    ? `<text x="${xBand(last.i, days.length).cx}" y="${yOf(Math.min(last.v, opts.max)) - 8}" class="dlabel" text-anchor="middle">${fmt(last.v)}</text>`
    : "";
  const target = opts.target !== undefined
    ? `<line x1="${PAD_L}" x2="${CW - PAD_R}" y1="${yOf(opts.target)}" y2="${yOf(opts.target)}" class="target"/>` +
      `<text x="${CW - PAD_R}" y="${yOf(opts.target) - 6}" class="tlabel" text-anchor="end">${esc(opts.targetLabel ?? "")}</text>`
    : "";
  return svgOpen(opts.title) + gridY(gridVals(0, opts.max, opts.yStep), yOf, fmt) +
    `<line x1="${PAD_L}" x2="${CW - PAD_R}" y1="${CH - PAD_B}" y2="${CH - PAD_B}" class="axis"/>` +
    bars + target + lastLabel + xTicks(days, CH) +
    hitCols(days, CH, d => { const v = opts.value(d); return v === null ? null : opts.tip(d, v); }) +
    "</svg>";
}

function lineChart(days: Day[], opts: {
  title: string; value: (d: Day) => number | null; yStep: number;
  min?: number; max?: number; colorVar: string; tip: (d: Day, v: number) => string;
  fmt?: (v: number) => string; height?: number;
}): string {
  const H = opts.height ?? CH;
  const fmt = opts.fmt ?? ((v: number) => String(v));
  const vals = days.map(d => opts.value(d)).filter((v): v is number => v !== null);
  // auto-domain from data unless pinned, so drifting values never clip
  const min = opts.min ?? Math.max(0, Math.floor((Math.min(...vals) - opts.yStep / 2) / opts.yStep) * opts.yStep);
  const max = opts.max ?? Math.ceil((Math.max(...vals) + opts.yStep / 2) / opts.yStep) * opts.yStep;
  const yOf = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / (max - min));
  const pts: { i: number; cx: number; y: number; v: number }[] = [];
  days.forEach((d, i) => {
    const v = opts.value(d);
    if (v === null) return;
    pts.push({ i, cx: xBand(i, days.length).cx, y: yOf(Math.max(min, Math.min(v, max))), v });
  });
  // break the line at missing days — never draw through a gap in the data
  const path = pts.map((p, k) =>
    `${k === 0 || pts[k - 1].i !== p.i - 1 ? "M" : "L"}${p.cx.toFixed(1)},${p.y.toFixed(1)}`
  ).join(" ");
  const dots = pts.map(p => `<circle cx="${p.cx}" cy="${p.y}" r="5" fill="var(${opts.colorVar})"/>`).join("");
  const last = pts[pts.length - 1];
  const lastLabel = last ? `<text x="${last.cx}" y="${last.y - 12}" class="dlabel" text-anchor="middle">${fmt(last.v)}</text>` : "";
  return svgOpen(opts.title, H) + gridY(gridVals(min, max, opts.yStep), yOf, fmt) +
    `<line x1="${PAD_L}" x2="${CW - PAD_R}" y1="${H - PAD_B}" y2="${H - PAD_B}" class="axis"/>` +
    `<path d="${path}" fill="none" stroke="var(${opts.colorVar})" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` +
    dots + lastLabel + xTicks(days, H) +
    hitCols(days, H, d => { const v = opts.value(d); return v === null ? null : opts.tip(d, v); }) +
    "</svg>";
}

// ---------- page ----------

// dark theme variables — one source, interpolated under both the OS media query
// and the explicit toggle scope (toggle must win in both directions)
const DARK_VARS = `
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10); --accent: #7dd3c0;
  --series-sleep: #3987e5; --series-strain: #d95926; --series-hrv: #199e70; --series-rhr: #c98500;
  --status-warn: #fab219;
  --status-good-ink: #0ca30c; --status-warn-ink: #fab219; --status-crit-ink: #e66767;`;

interface DexaScan {
  date: string; clinic: string; weight_kg: number; bmi: number; body_fat_pct: number;
  lean_mass_kg: number; bmd_centile: number; bmd_t_score: number; visceral_fat_cm3: number;
  ag_ratio: number; rmr_kcal: number; rsmi_kg_m2: number;
}

function loadDexa(): DexaScan[] {
  try { return JSON.parse(readFileSync(DEXA, "utf8")).scans ?? []; } catch { return []; }
}

function dexaSection(scans: DexaScan[]): string {
  if (!scans.length) return "";
  const latest = scans[scans.length - 1];
  const cell = (k: string, v: string, s: string) =>
    `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const history = scans.length > 1
    ? `<div class="tablewrap"><table>
        <thead><tr><th scope="col">Date</th><th scope="col">Weight kg</th><th scope="col">Fat %</th><th scope="col">Lean kg</th><th scope="col">RSMI</th><th scope="col">Visceral cm³</th><th scope="col">Bone centile</th></tr></thead>
        <tbody>${scans.map(s =>
          `<tr><th scope="row">${dayLabel(s.date)} ${s.date.slice(0, 4)}</th><td class="num">${s.weight_kg}</td><td class="num">${s.body_fat_pct}</td><td class="num">${s.lean_mass_kg}</td><td class="num">${s.rsmi_kg_m2}</td><td class="num">${s.visceral_fat_cm3}</td><td class="num">${s.bmd_centile}</td></tr>`
        ).join("")}</tbody></table></div>`
    : "";
  return `<details class="secbox">
  <summary><h2>Body composition</h2> <span class="sum-desc">DEXA · ${esc(latest.clinic)} · ${dayLabel(latest.date)} ${latest.date.slice(0, 4)}</span></summary>
  <div class="secbody">
    <div class="tiles" style="margin-bottom: 8px;">
      ${cell("Body fat", `${latest.body_fat_pct}<span class="u">%</span>`, "lean for age (Z −1.0)")}
      ${cell("Lean mass", `${latest.lean_mass_kg}<span class="u">kg</span>`, `of ${latest.weight_kg} kg · BMI ${latest.bmi}`)}
      ${cell("Bone density", `${latest.bmd_centile}<span class="u">th</span>`, `centile · T ${latest.bmd_t_score}`)}
      ${cell("Visceral fat", `${latest.visceral_fat_cm3}<span class="u">cm³</span>`, "male 25–49 median ≈746")}
      ${cell("RSMI", `${latest.rsmi_kg_m2}`, "limb muscle — healthy band 9–10 ⚠")}
      ${cell("RMR", `${latest.rmr_kcal.toLocaleString()}<span class="u">kcal</span>`, "≈2,400–2,700 maintenance")}
    </div>
    <p class="fine">RSMI (arm+leg lean mass ÷ height²) sits below the healthy-normal band for men — the training lever is lifting, especially legs. Bone density top 6% for age. Next scan ~Feb 2027.</p>
    ${history}
  </div>
</details>`;
}

function render(days: Day[], dexa: DexaScan[], records: Map<string, Rec>): string {
  const today = days[days.length - 1];
  const latestRec = days.findLast(d => d.recovery !== null);
  const latestSleep = days.findLast(d => d.sleepH !== null);
  const last7 = days.slice(-7);
  const sleep7 = avg(last7.map(d => d.sleepH));
  const strain7 = avg(last7.map(d => d.strain));
  const z = latestRec ? zone(latestRec.recovery!) : null;
  const zm = z ? ZONE_META[z] : null;
  const recIsToday = latestRec?.date === today.date;

  let padelCount = 0, gymCount = 0;
  for (const d of days) for (const w of d.workouts) {
    if (w.sport === "paddle-tennis") padelCount++;
    else if (w.sport === "weightlifting") gymCount++;
  }
  const latestBody = [...records.values()].filter(r => r.type === "body" && r.weight_kilogram)
    .sort((a, b) => String(a.id).localeCompare(String(b.id))).pop();
  const weightTile = latestBody
    ? `<div class="tile"><div class="k">Weight</div><div class="v">${f1(latestBody.weight_kilogram)}<span class="u">kg</span></div><div class="s">Whoop profile</div></div>`
    : "";

  const recoveryChart = barChart(days, {
    title: "Daily recovery percentage, last 30 days",
    value: d => d.recovery, max: 100, yStep: 25,
    color: (_d, v) => `var(--status-${zone(v)})`,
    tip: (d, v) => `${weekday(d.date)} ${dayLabel(d.date)} · Recovery ${Math.round(v)}% · HRV ${f0(d.hrv)} ms · RHR ${f0(d.rhr)}`,
    fmt: v => `${v}`,
  });

  const sleepChart = barChart(days, {
    title: "Sleep hours per night, last 30 days",
    value: d => d.sleepH, max: 10, yStep: 2.5,
    color: () => "var(--series-sleep)",
    tip: (d, v) => `${weekday(d.date)} ${dayLabel(d.date)} · ${f1(v)} h asleep${d.sleepPerf !== null ? ` · ${f0(d.sleepPerf)}% of need` : ""}`,
    target: SLEEP_TARGET_H, targetLabel: `${SLEEP_TARGET_H} h target`, fmt: f1,
  });

  const strainChart = lineChart(days, {
    title: "Day strain, last 30 days",
    value: d => d.strain, min: 0, max: 21, yStep: 7,
    colorVar: "--series-strain",
    tip: (d, v) => `${weekday(d.date)} ${dayLabel(d.date)} · Strain ${f1(v)}${d.workouts.length ? " · " + d.workouts.map(w => sportLabel(w.sport)).join(", ") : ""}`,
    fmt: f1,
  });

  const hrvChart = lineChart(days, {
    title: "Heart-rate variability, last 30 days", height: 170,
    value: d => d.hrv, yStep: 20, colorVar: "--series-hrv",
    tip: (d, v) => `${weekday(d.date)} ${dayLabel(d.date)} · HRV ${f0(v)} ms`, fmt: f0,
  });

  const rhrChart = lineChart(days, {
    title: "Resting heart rate, last 30 days", height: 170,
    value: d => d.rhr, yStep: 10, colorVar: "--series-rhr",
    tip: (d, v) => `${weekday(d.date)} ${dayLabel(d.date)} · RHR ${f0(v)} bpm`, fmt: f0,
  });

  const workoutRows = days.toReversed().flatMap(d =>
    d.workouts.toReversed().map(w => {
      const padel = w.sport === "paddle-tennis";
      return `<tr${padel ? ' class="padel-row"' : ""}><th scope="row">${weekday(d.date)} ${dayLabel(d.date)}</th>` +
        `<td><span class="chip${padel ? " chip-padel" : ""}">${padel ? "🎾 " : ""}${esc(sportLabel(w.sport))}</span></td>` +
        `<td class="num">${f1(w.strain)}</td><td class="num">${w.avgHr ? f0(w.avgHr) + " bpm" : "–"}</td></tr>`;
    })
  ).slice(0, 20).join("");

  const dataRows = days.toReversed().map(d =>
    `<tr><th scope="row">${dayLabel(d.date)}</th><td class="num">${f1(d.sleepH)}</td><td class="num">${f0(d.recovery)}</td>` +
    `<td class="num">${f1(d.strain)}</td><td class="num">${f0(d.hrv)}</td><td class="num">${f0(d.rhr)}</td>` +
    `<td>${d.workouts.map(w => esc(sportLabel(w.sport))).join(", ") || "–"}</td></tr>`
  ).join("");

  const generated = new Date(Date.now() + ICT_OFFSET_MS).toISOString().replace("T", " ").slice(0, 16);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>preed.ee / fitness</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎾</text></svg>">
<script>
(function () {
  try {
    var saved = localStorage.getItem('preed-ee-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}
})();
</script>
<style>
@font-face { font-family: "Jost"; src: url("../../trips/fonts/jost-v20-latin-regular.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Jost"; src: url("../../trips/fonts/jost-v20-latin-600.woff2") format("woff2"); font-weight: 600; font-display: swap; }

:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #6e6c67;
  --grid: #e1e0d9; --axis: #c3c2b7; --ring: rgba(11,11,11,0.10); --accent: #0f766e;
  --series-sleep: #2a78d6; --series-strain: #eb6834; --series-hrv: #1baf7a; --series-rhr: #b87b00;
  --status-good: #0ca30c; --status-warn: #d98f00; --status-crit: #d03b3b;
  --status-good-ink: #006300; --status-warn-ink: #7a5200; --status-crit-ink: #a32020;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {${DARK_VARS}
  }
}
:root[data-theme="dark"] {${DARK_VARS}
}

/* type scale: 2 / 1.5 / 1.25 / 1 / 0.875 / 0.75 rem */
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.5; }
.wrap { max-width: 880px; margin: 0 auto; padding: 20px 16px 48px; }
header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
h1 { font-family: "Jost", system-ui, sans-serif; font-weight: 600; font-size: 1.25rem; margin: 0; letter-spacing: 0.01em; }
h1 a { color: var(--muted); text-decoration: none; font-weight: 400; }
.spacer { flex: 1; }
#theme-toggle { background: none; border: 1px solid var(--ring); border-radius: 999px; color: var(--ink); font-size: 1.25rem; width: 44px; height: 44px; cursor: pointer; }
#theme-toggle:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.subtitle { color: var(--ink-2); margin: 0 0 16px; font-size: 0.875rem; }

.verdict { border: 1px solid var(--ring); border-left: 5px solid var(--vcolor); border-radius: 12px; background: var(--surface); padding: 16px; margin-bottom: 24px; }
.verdict h2 { font-family: "Jost", system-ui, sans-serif; font-weight: 600; font-size: 2rem; line-height: 1.2; margin: 0; color: var(--vink); }
.verdict p { margin: 6px 0 0; color: var(--ink-2); font-size: 1rem; }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 24px; }
.tile { background: var(--surface); border: 1px solid var(--ring); border-radius: 12px; padding: 12px 16px; }
.tile .k { color: var(--muted); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.06em; }
.tile .v { font-size: 1.5rem; font-weight: 600; line-height: 1.2; }
.tile .u { font-size: 0.875rem; color: var(--ink-2); font-weight: 400; }
.tile .s { font-size: 0.875rem; color: var(--ink-2); }

details.secbox { background: var(--surface); border: 1px solid var(--ring); border-radius: 12px; margin-bottom: 12px; overflow: hidden; }
details.secbox > summary { cursor: pointer; padding: 14px 16px; min-height: 44px; list-style: none; display: flex; align-items: baseline; gap: 10px; }
details.secbox > summary:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
details.secbox > summary::-webkit-details-marker { display: none; }
details.secbox > summary::before { content: "▸"; color: var(--muted); font-size: 0.875em; transition: transform 0.15s; }
details[open].secbox > summary::before { transform: rotate(90deg); }
summary h2 { display: inline; font-family: "Jost", system-ui, sans-serif; font-weight: 600; font-size: 1rem; margin: 0; }
.sum-desc { font-family: system-ui, sans-serif; font-weight: 400; font-size: 0.875rem; color: var(--muted); }
.secbody { padding: 4px 16px 16px; }

/* SVG text: viewBox 720 renders ~0.41x on phones — sizes are ~2.4x intended CSS px */
svg { width: 100%; height: auto; display: block; }
.grid { stroke: var(--grid); stroke-width: 1; }
.axis { stroke: var(--axis); stroke-width: 1; }
.tick { fill: var(--muted); font-size: 22px; font-family: system-ui, sans-serif; }
.dlabel { fill: var(--ink); font-size: 24px; font-weight: 600; font-family: system-ui, sans-serif; }
.tlabel { fill: var(--ink-2); font-size: 20px; font-family: system-ui, sans-serif; }
.target { stroke: var(--ink-2); stroke-width: 2; stroke-dasharray: 6 5; }
.bar { stroke: var(--surface); stroke-width: 1; }
.hitcol { fill: transparent; }
.hitcol:hover { fill: color-mix(in srgb, var(--ink) 6%, transparent); }
.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.875rem; color: var(--ink-2); margin: 2px 0 8px; }
.legend .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: baseline; }

.duo { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 620px) { .duo { grid-template-columns: 1fr; } }
.duo h3 { font-size: 0.875rem; margin: 6px 0 2px; color: var(--ink-2); font-weight: 600; }

.tablewrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--grid); white-space: nowrap; }
thead th { color: var(--muted); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }
th[scope="row"] { font-weight: 400; color: var(--ink-2); }
td.num { font-variant-numeric: tabular-nums; }
.chip { display: inline-block; border: 1px solid var(--ring); border-radius: 999px; padding: 1px 9px; font-size: 0.875rem; }
.chip-padel { border-color: var(--series-sleep); color: var(--series-sleep); font-weight: 600; }
.padel-row th, .padel-row td { background: color-mix(in srgb, var(--series-sleep) 6%, transparent); }

.fine { color: var(--ink-2); font-size: 0.875rem; margin: 4px 0 12px; }
#tip { position: fixed; z-index: 10; background: var(--ink); color: var(--page); font-size: 0.875rem; padding: 6px 10px; border-radius: 7px; pointer-events: none; opacity: 0; transition: opacity 0.1s; max-width: 280px; }
footer { color: var(--muted); font-size: 0.875rem; margin-top: 24px; }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1><a href="/">preed.ee</a> / fitness</h1>
  <div class="spacer"></div>
  <button id="theme-toggle" aria-label="Toggle dark or light theme">◐</button>
</header>
<p class="subtitle">Whoop recovery &amp; padel readiness · last ${DAYS} days · updated ${generated} ICT</p>

${zm ? `<section class="verdict" style="--vcolor: var(--status-${z}); --vink: var(--status-${z}-ink);" aria-label="Today's readiness verdict">
  <h2>${zm.icon} ${zm.label} — ${f0(latestRec!.recovery)}% recovery${recIsToday ? "" : ` (as of ${dayLabel(latestRec!.date)})`}</h2>
  <p>${zm.verdict} ${zm.padel}</p>
</section>` : ""}

<div class="tiles">
  <div class="tile"><div class="k">Last night</div><div class="v">${f1(latestSleep?.sleepH ?? null)}<span class="u">h</span></div><div class="s">${latestSleep?.sleepPerf !== null && latestSleep ? f0(latestSleep.sleepPerf) + "% of need" : ""}</div></div>
  <div class="tile"><div class="k">HRV</div><div class="v">${f0(latestRec?.hrv ?? null)}<span class="u">ms</span></div><div class="s">RHR ${f0(latestRec?.rhr ?? null)} bpm</div></div>
  <div class="tile"><div class="k">Sleep 7d avg</div><div class="v">${f1(sleep7)}<span class="u">h</span></div><div class="s">target ${SLEEP_TARGET_H} h</div></div>
  <div class="tile"><div class="k">Strain 7d avg</div><div class="v">${f1(strain7)}</div><div class="s">of 21</div></div>
  <div class="tile"><div class="k">Padel 30d</div><div class="v">${padelCount}<span class="u">sessions</span></div><div class="s">${gymCount} gym</div></div>
  ${weightTile}
</div>

<details class="secbox" open>
  <summary><h2>Recovery</h2> <span class="sum-desc">30 days, Whoop green / yellow / red zones</span></summary>
  <div class="secbody">
    <div class="legend">
      <span><span class="sw" style="background: var(--status-good)"></span>▲ Green ≥ ${REC_GREEN_MIN}%</span>
      <span><span class="sw" style="background: var(--status-warn)"></span>◆ Yellow ${REC_YELLOW_MIN}–${REC_GREEN_MIN - 1}%</span>
      <span><span class="sw" style="background: var(--status-crit)"></span>▼ Red &lt; ${REC_YELLOW_MIN}%</span>
    </div>
    ${recoveryChart}
  </div>
</details>

<details class="secbox">
  <summary><h2>Sleep</h2> <span class="sum-desc">nightly hours vs the ${SLEEP_TARGET_H} h target</span></summary>
  <div class="secbody">${sleepChart}</div>
</details>

<details class="secbox">
  <summary><h2>Strain</h2> <span class="sum-desc">daily cardiovascular load, 0–21 scale</span></summary>
  <div class="secbody">${strainChart}</div>
</details>

<details class="secbox">
  <summary><h2>HRV &amp; resting HR</h2> <span class="sum-desc">the two recovery inputs, trending</span></summary>
  <div class="secbody duo">
    <div><h3>HRV (ms)</h3>${hrvChart}</div>
    <div><h3>Resting HR (bpm)</h3>${rhrChart}</div>
  </div>
</details>

<details class="secbox">
  <summary><h2>Workouts</h2> <span class="sum-desc">last 20 sessions — padel highlighted</span></summary>
  <div class="secbody tablewrap">
    <table>
      <thead><tr><th scope="col">Date</th><th scope="col">Sport</th><th scope="col">Strain</th><th scope="col">Avg HR</th></tr></thead>
      <tbody>${workoutRows}</tbody>
    </table>
  </div>
</details>

${dexaSection(dexa)}

<details class="secbox">
  <summary><h2>Data table</h2> <span class="sum-desc">every day, every metric — the numbers behind the charts</span></summary>
  <div class="secbody tablewrap">
    <table>
      <thead><tr><th scope="col">Date</th><th scope="col">Sleep h</th><th scope="col">Recovery %</th><th scope="col">Strain</th><th scope="col">HRV ms</th><th scope="col">RHR</th><th scope="col">Workouts</th></tr></thead>
      <tbody>${dataRows}</tbody>
    </table>
  </div>
</details>

<footer>Data: Whoop API v2, pulled daily at 07:00 ICT. Recovery zones per Whoop convention. Private page — not indexed.</footer>
</div>
<div id="tip" role="tooltip"></div>
<script>
document.getElementById('theme-toggle').addEventListener('click', function () {
  var cur = document.documentElement.getAttribute('data-theme');
  var next = cur === 'dark' ? 'light'
    : cur === 'light' ? 'dark'
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('preed-ee-theme', next); } catch (e) {}
});
(function () {
  var tip = document.getElementById('tip');
  function place(text, x, y) {
    tip.textContent = text;
    tip.style.opacity = 1;
    var tx = Math.min(x + 12, window.innerWidth - tip.offsetWidth - 8);
    var ty = y - tip.offsetHeight - 12;
    if (ty < 4) ty = y + 18;
    tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = ty + 'px';
  }
  function hide() { tip.style.opacity = 0; }
  document.addEventListener('mousemove', function (e) {
    var t = e.target.getAttribute && e.target.getAttribute('data-tip');
    if (t) place(t, e.clientX, e.clientY); else hide();
  });
  document.addEventListener('touchstart', function (e) {
    var el = e.target;
    var t = el.getAttribute && el.getAttribute('data-tip');
    if (t) { var touch = e.touches[0]; place(t, touch.clientX, touch.clientY - 40); }
    else hide();
  }, { passive: true });
  document.addEventListener('scroll', hide, { passive: true });
})();
</script>
</body>
</html>`;
}

// ---------- main ----------

const noEncrypt = process.argv.includes("--no-encrypt");
const records = loadLatest();
const days = buildDays(records);
const html = render(days, loadDexa(), records);

mkdirSync(TMP_DIR, { recursive: true });

if (noEncrypt) {
  const preview = join(TMP_DIR, "preview.html");
  writeFileSync(preview, html);
  console.log(`preview (plaintext, NOT for commit): ${preview}`);
} else {
  const plain = join(TMP_DIR, "index.html");
  writeFileSync(plain, html);
  const encrypted = await staticryptFile(plain, "preed.ee / fitness");
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "index.html"), encrypted);
  rmSync(TMP_DIR, { recursive: true, force: true });
  console.log(`encrypted → ${join(OUT_DIR, "index.html")}`);
}
