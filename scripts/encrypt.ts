#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { staticryptFile } from "./lib/staticrypt";

const ROOT = resolve(import.meta.dir, "..");
const TARGET = join(ROOT, "docs/projects/index.html");

if ((await readFile(TARGET, "utf8")).includes("staticrypt-html")) {
  console.log(`already encrypted — skipping ${TARGET}`);
  process.exit(0);
}

const encrypted = await staticryptFile(TARGET, "preed.ee / projects");
await writeFile(TARGET, encrypted);

console.log(`encrypted ${TARGET}`);
