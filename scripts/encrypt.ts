#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { staticryptFile } from "./lib/staticrypt";

const ROOT = resolve(import.meta.dir, "..");
const TARGET = join(ROOT, "docs/projects/index.html");

const encrypted = await staticryptFile(TARGET, "preed.ee / projects");
await writeFile(TARGET, encrypted);

console.log(`encrypted ${TARGET}`);
