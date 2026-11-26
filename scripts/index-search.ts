import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function hasEntryPages(directory: string): boolean {
  if (!existsSync(directory)) return false;
  for (const field of readdirSync(directory, { withFileTypes: true })) {
    if (!field.isDirectory()) continue;
    const fieldDirectory = path.join(directory, field.name);
    for (const entry of readdirSync(fieldDirectory, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(path.join(fieldDirectory, entry.name, "index.html"))) return true;
    }
  }
  return false;
}

function main() {
  const outputDirectory = path.resolve(process.cwd(), "dist");
  if (!hasEntryPages(outputDirectory)) {
    // Do not leave a stale index behind when the last entry is removed.
    rmSync(path.join(outputDirectory, "pagefind"), { recursive: true, force: true });
    console.log("✓ No entry pages; skipped Pagefind indexing.");
    return;
  }

  const result = spawnSync("pagefind", {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

main();
