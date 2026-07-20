// Stamp out/sw.js with a unique per-build cache version so the service worker
// changes on EVERY deploy → the auto-updater reloads clients to the newest code
// (not only when sw.js is hand-edited). Runs after `next build` (postbuild);
// only touches the build output (out/), never the committed source.
import { readFileSync, writeFileSync, existsSync } from "fs";

let id = "";
try {
  id = readFileSync(".next/BUILD_ID", "utf8").trim();
} catch {
  /* fall through */
}
if (!id) id = String(Date.now());

const path = "out/sw.js";
if (!existsSync(path)) {
  console.log("[stamp-sw] out/sw.js not found — skipping (dev build?)");
  process.exit(0);
}
let src = readFileSync(path, "utf8");
const next = src.replace(/const CACHE = "pasto-[^"]*"/, `const CACHE = "pasto-${id}"`);
if (next === src) {
  console.log("[stamp-sw] CACHE line not found — sw.js unchanged");
} else {
  writeFileSync(path, next);
  console.log(`[stamp-sw] out/sw.js → pasto-${id}`);
}
