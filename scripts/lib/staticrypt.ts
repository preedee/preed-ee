import { $ } from "bun";
import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Encrypt an HTML file with the site's staticrypt password (Keychain service
 * `preed-ee-staticrypt`) and return the encrypted HTML. Single owner of the
 * unlock-page branding — used by encrypt.ts (projects) and build-fitness.ts.
 */
export async function staticryptFile(inputPath: string, title: string): Promise<string> {
  const password = (await $`security find-generic-password -s preed-ee-staticrypt -w`.text()).trim();
  if (!password) throw new Error("password not found in Keychain under service 'preed-ee-staticrypt'");

  const outDir = join(dirname(inputPath), ".staticrypt-out");
  await rm(outDir, { recursive: true, force: true });
  await $`bunx staticrypt ${inputPath} -p ${password} --short --remember ${30} --template-title ${title} --template-instructions ${"enter password to continue"} --template-button ${"unlock"} --template-color-primary ${"#7dd3c0"} --template-color-secondary ${"#0a0a0a"} --template-placeholder ${"password"} --template-remember ${"remember this device for 30 days"} -d ${outDir}`.quiet();

  const encrypted = await readFile(join(outDir, basename(inputPath)), "utf8");
  await rm(outDir, { recursive: true, force: true });
  return encrypted;
}

function basename(p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}
