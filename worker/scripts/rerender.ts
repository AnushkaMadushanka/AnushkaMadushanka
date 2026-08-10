/**
 * Rewrites README.md and the current map from the committed torch data, using
 * the same code the Worker runs. For when the copy changes and you don't want
 * to wait for a stranger to claim the torch before the fix is visible.
 *
 *   node --experimental-strip-types scripts/rerender.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { TorchData } from "../src/geo.ts";
import { BUTTON_PATH, mapPath, renderButton, renderMap } from "../src/map.ts";
import { renderBlock, spliceReadme } from "../src/readme.ts";

const ROOT = new URL("../../", import.meta.url);

/** Single source of truth for these values is wrangler.toml. */
function vars(): Record<string, string> {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const out: Record<string, string> = {};
  for (const [, key, value] of toml.matchAll(/^(\w+)\s*=\s*"([^"]*)"$/gm)) {
    out[key] = value;
  }
  return out;
}

const env = vars() as unknown as Parameters<typeof renderBlock>[1];
const dataUrl = new URL("data/torch.json", ROOT);
const readmeUrl = new URL("README.md", ROOT);

const data = JSON.parse(readFileSync(dataUrl, "utf8")) as TorchData;
const current = data.hops[data.hops.length - 1];

// Hop 0 alone has no route worth drawing; the Worker only starts writing maps
// once the torch has actually moved.
if (current.n > 0) {
  data.map = mapPath(current.n);
  const file = new URL(data.map, ROOT);
  mkdirSync(dirname(fileURLToPath(file)), { recursive: true });
  writeFileSync(file, renderMap(data));
}

writeFileSync(new URL(BUTTON_PATH, ROOT), renderButton());
writeFileSync(dataUrl, `${JSON.stringify(data, null, 2)}\n`);
writeFileSync(
  readmeUrl,
  spliceReadme(readFileSync(readmeUrl, "utf8"), renderBlock(data, env)),
);

console.log(`rewrote README.md${data.map ? ` and ${data.map}` : ""}`);
