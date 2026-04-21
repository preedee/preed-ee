#!/usr/bin/env bun
import { $ } from "bun";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const TARGET = join(ROOT, "docs/projects/index.html");
const ENCRYPTED_TMP_DIR = join(ROOT, "docs/projects/.staticrypt-out");

const password = (await $`security find-generic-password -s preed-ee-staticrypt -w`.text()).trim();
if (!password) {
  console.error("password not found in Keychain under service 'preed-ee-staticrypt'");
  process.exit(1);
}

await rm(ENCRYPTED_TMP_DIR, { recursive: true, force: true });

await $`bunx staticrypt ${TARGET} -p ${password} --short --remember ${30} --template-title ${"preed.ee / projects"} --template-instructions ${"enter password to continue"} --template-button ${"unlock"} --template-color-primary ${"#7dd3c0"} --template-color-secondary ${"#0a0a0a"} --template-placeholder ${"password"} --template-remember ${"remember this device for 30 days"} -d ${ENCRYPTED_TMP_DIR}`.quiet();

const encryptedPath = join(ENCRYPTED_TMP_DIR, "index.html");
const encrypted = await readFile(encryptedPath, "utf8");
await writeFile(TARGET, encrypted);
await rm(ENCRYPTED_TMP_DIR, { recursive: true, force: true });

console.log(`encrypted ${TARGET}`);
