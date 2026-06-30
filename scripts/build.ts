/**
 * Production build with the Tailwind plugin registered.
 * Run with:  bun run build   ->  outputs ./dist
 */
import tailwind from "bun-plugin-tailwind";
import { rm } from "fs/promises";
import { resolve } from "path";

const root = resolve(import.meta.dir, "..");
await rm(resolve(root, "dist"), { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [resolve(root, "index.html")],
  outdir: resolve(root, "dist"),
  minify: true,
  plugins: [tailwind],
  sourcemap: "none",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
console.log(`Built ${result.outputs.length} files to ./dist`);
for (const o of result.outputs) {
  console.log(`  ${o.path.replace(root + "/", "")}  (${(o.size / 1024).toFixed(1)} KB)`);
}
