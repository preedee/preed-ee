#!/usr/bin/env bun
import { $ } from "bun";

const R = "/Users/preedee/Desktop/Cowork/preed-ee";

await $`/Users/preedee/.bun/bin/bun ${R}/scripts/scan-projects.ts`;
await $`/Users/preedee/.bun/bin/bun ${R}/scripts/encrypt.ts`;

await $`git -C ${R} add docs/index.html docs/styles.css docs/projects docs/logos`;

const diff = await $`git -C ${R} diff --cached --quiet`.nothrow();
if (diff.exitCode === 0) {
  console.log("no changes — skipping commit");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/:\d{2}\.\d{3}Z$/, "Z");
await $`git -C ${R} commit -m ${`daily rescan ${stamp}`}`;
await $`git -C ${R} push`;
console.log("pushed daily rescan");
