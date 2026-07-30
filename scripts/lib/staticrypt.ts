import { $ } from "bun";
import { readFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

/**
 * Encrypt an HTML file with the site's staticrypt password (Keychain service
 * `preed-ee-staticrypt`) and return the encrypted HTML. Single owner of the
 * unlock-page branding — used by encrypt.ts (projects) and build-fitness.ts.
 *
 * SALT is shared across every page on the site (and duplicated in
 * preed-ee-src/build.ts) so staticrypt's remember-me unlocks the whole site
 * from one prompt. --config false stops the CLI writing ./.staticrypt.json,
 * which crashed EROFS under launchd's read-only CWD.
 */
const SALT = "710dec0865f6ee98a353d543b735e4e2";

export async function staticryptFile(inputPath: string, title: string): Promise<string> {
  const password = (await $`security find-generic-password -s preed-ee-staticrypt -w`.text()).trim();
  if (!password) throw new Error("password not found in Keychain under service 'preed-ee-staticrypt'");

  const outDir = join(dirname(inputPath), ".staticrypt-out");
  await rm(outDir, { recursive: true, force: true });
  await $`bunx staticrypt ${inputPath} -p ${password} --short --remember ${30} --salt ${SALT} --config ${"false"} --template-title ${title} --template-instructions ${"enter password to continue"} --template-button ${"unlock"} --template-color-primary ${"#7dd3c0"} --template-color-secondary ${"#0a0a0a"} --template-placeholder ${"password"} --template-remember ${"remember this device for 30 days"} -d ${outDir}`.quiet();

  const encrypted = await readFile(join(outDir, basename(inputPath)), "utf8");
  await rm(outDir, { recursive: true, force: true });
  return encrypted;
}