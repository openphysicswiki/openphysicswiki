import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { spawnSync } from "node:child_process";
import path from "node:path";

function pagefindIntegration() {
  return {
    name: "openphysics-pagefind",
    hooks: {
      "astro:build:done": () => {
        const executable = path.resolve("node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
        const result = spawnSync(executable, ["scripts/index-search.ts"], {
          cwd: process.cwd(),
          stdio: "inherit",
          shell: process.platform === "win32",
        });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`Pagefind indexing failed with exit code ${result.status ?? 1}.`);
      },
    },
  };
}

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://openphysics.wiki",
  output: "static",
  integrations: [pagefindIntegration()],
  trailingSlash: "always",
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
