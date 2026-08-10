import { geoInterpolate, geoNaturalEarth1, geoPath } from "d3-geo";
import { MOON_KM, type Hop, type TorchData } from "./geo.ts";
import {
  GRATICULE_PATH,
  HEIGHT,
  LAND_PATH,
  SCALE,
  SPHERE_PATH,
  TRANSLATE,
  WIDTH,
} from "./land.ts";

/**
 * Both palettes live in one file rather than in a <picture> pair. GitHub's
 * <source media="(prefers-color-scheme: dark)"> and an @media block inside the
 * SVG read the same signal from the same browser, so the behaviour is identical
 * — but one file is half the bytes, and every byte here is committed forever.
 *
 * The headline lives in here too. Markdown gives no control over type on a
 * GitHub profile; a generated image gives all of it.
 */
const STYLE = `
.bg{fill:#ffffff}
.graticule{stroke:#f1efeb}
.land{fill:#e7e4dd}
.edge{stroke:#dcd8d0}
.arc{stroke:#d1440a}
.dot{fill:#a39c8d}
.flame{fill:#f04e23}
.wick{fill:#ffffff}
.wash stop{stop-color:#ffffff}
.eyebrow{fill:#8a8272}
.city{fill:#1c1a17}
.meta{fill:#5f594e}
.pill{fill:#f04e23}
.pill-text{fill:#ffffff}
.track{fill:#dcd8d0}
@media(prefers-color-scheme:dark){
.bg{fill:#0d1117}
.graticule{stroke:#161b22}
.land{fill:#20262e}
.edge{stroke:#2b323b}
.arc{stroke:#ff7b3d}
.dot{fill:#57606a}
.flame{fill:#ff7b3d}
.wick{fill:#0d1117}
.wash stop{stop-color:#0d1117}
.eyebrow{fill:#6e7681}
.city{fill:#e6edf3}
.meta{fill:#9198a1}
.pill{fill:#ff7b3d}
.pill-text{fill:#0d1117}
.track{fill:#2b323b}
}
text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.halo{animation:pulse 2.8s ease-in-out infinite}
@keyframes pulse{0%,100%{r:10px;opacity:.9}50%{r:16px;opacity:.35}}
@media(prefers-reduced-motion:reduce){.halo{animation:none}}
`.replace(/\n/g, "");

// precision(0) turns off adaptive resampling. The arcs are sampled by hand
// below and the land was projected at build time, so nothing here benefits
// from paying for it.
const projection = geoNaturalEarth1().scale(SCALE).translate(TRANSLATE).precision(0);
const path = geoPath(projection);

const regions = new Intl.DisplayNames(["en"], { type: "region" });
const numbers = new Intl.NumberFormat("en-US");

const project = (hop: Hop): [number, number] =>
  projection([hop.lon, hop.lat]) ?? [0, 0];

const fixed = (n: number) => Number(n.toFixed(1));

/** City names carry apostrophes and ampersands; SVG is XML and will not have it. */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function country(code: string): string {
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Great-circle rather than straight: a line drawn between two projected points
 * cuts across the map in a way that is simply wrong, and looks it. geoPath also
 * splits the result where it crosses the antimeridian, so a Tokyo → San
 * Francisco hop leaves one edge and re-enters the other instead of streaking
 * back across the whole map.
 */
function arc(from: Hop, to: Hop, samples: number): string {
  const interpolate = geoInterpolate([from.lon, from.lat], [to.lon, to.lat]);
  const coordinates = Array.from({ length: samples + 1 }, (_, i) =>
    interpolate(i / samples),
  );
  return path({ type: "LineString", coordinates }) ?? "";
}

export function renderMap(data: TorchData): string {
  const hops = data.hops;
  const current = hops[hops.length - 1];
  const total = current.totalKm;

  // Keeps the whole render inside the 10ms budget however long the chain gets.
  const samples = hops.length > 120 ? 16 : hops.length > 40 ? 32 : 64;

  const arcs: string[] = [];
  for (let i = 1; i < hops.length; i++) {
    if (hops[i].km < 1) continue; // same place, nothing to draw

    const age = (i - 1) / Math.max(1, hops.length - 1);
    const d = arc(hops[i - 1], hops[i], samples);
    if (d) {
      arcs.push(
        `<path class="arc" d="${d}" fill="none" stroke-width="1.4" stroke-opacity="${fixed(
          0.22 + age * 0.63,
        )}" stroke-linecap="round"/>`,
      );
    }
  }

  const dots = hops
    .slice(0, -1)
    .map((hop) => {
      const [x, y] = project(hop);
      return `<circle class="dot" cx="${fixed(x)}" cy="${fixed(y)}" r="2"/>`;
    })
    .join("");

  const [cx, cy] = project(current);
  // Drawn after the wash so the flame is never dimmed by its own headline.
  const flame =
    `<circle class="flame halo" cx="${fixed(cx)}" cy="${fixed(cy)}" r="10" fill-opacity="0.18"/>` +
    `<circle class="flame" cx="${fixed(cx)}" cy="${fixed(cy)}" r="4.5"/>` +
    `<circle class="wick" cx="${fixed(cx)}" cy="${fixed(cy)}" r="1.8" fill-opacity="0.85"/>`;

  const meta = [
    country(current.country),
    `${numbers.format(Math.round(total))} km`,
    `${hops.length} ${hops.length === 1 ? "hand" : "hands"}`,
  ].join("  ·  ");

  // Below 1% the figure rounds to 0.0% and reads as a bug rather than a stat.
  const moonPct = (total / MOON_KM) * 100;
  const hasMoon = moonPct >= 1;

  // Optically centred: the block is measured, then placed, so adding or losing
  // the Moon bar never leaves a dead band above or below it.
  const top = Math.round((HEIGHT - (hasMoon ? 170 : 105)) / 2);

  const moon = hasMoon
    ? `<text class="meta" x="56" y="${top + 140}" font-size="15">${moonPct.toFixed(
        1,
      )}% of the way to the Moon</text>
<rect class="track" x="56" y="${top + 152}" width="300" height="5" rx="2.5"/>
<rect class="pill" x="56" y="${top + 152}" width="${fixed(
        Math.min(300, (moonPct / 100) * 300),
      )}" height="5" rx="2.5"/>`
    : "";

  const label = `The torch is in ${current.city}, ${country(current.country)}. ${
    hops.length
  } ${hops.length === 1 ? "holder" : "holders"} so far, ${numbers.format(
    Math.round(total),
  )} km travelled.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<style>${STYLE}</style>
<defs><linearGradient class="wash" id="wash" x1="0" x2="1" y1="0" y2="0">
<stop offset="0" stop-opacity="0.96"/><stop offset="0.5" stop-opacity="0.82"/><stop offset="1" stop-opacity="0"/>
</linearGradient></defs>
<rect class="bg" width="${WIDTH}" height="${HEIGHT}"/>
<path class="graticule" d="${GRATICULE_PATH}" fill="none" stroke-width="0.6"/>
<path class="land" d="${LAND_PATH}"/>
<path class="edge" d="${SPHERE_PATH}" fill="none" stroke-width="1"/>
${arcs.join("")}
${dots}
<rect x="0" y="0" width="620" height="${HEIGHT}" fill="url(#wash)"/>
<text class="eyebrow" x="56" y="${top}" font-size="15" letter-spacing="3.5">THE TORCH IS IN</text>
<text class="city" x="56" y="${top + 54}" font-size="46" font-weight="700">${esc(current.city)}</text>
<text class="meta" x="56" y="${top + 90}" font-size="17">${esc(meta)}</text>
${moon}
${flame}
</svg>
`;
}

export const mapPath = (n: number): string =>
  `assets/map-${String(n).padStart(4, "0")}.svg`;

export const BUTTON_PATH = "assets/take-the-torch.svg";

/**
 * Its own file rather than part of the map, and the same 1200-unit canvas so
 * that at width="100%" the pill lands on exactly the same left margin as the
 * headline above it. Content never changes, so the blob is identical on every
 * commit and git stores it once.
 */
export function renderButton(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 64" width="1200" height="64" role="img" aria-label="Take the torch">
<title>Take the torch</title>
<style>.pill{fill:#f04e23}.pill-text{fill:#ffffff}@media(prefers-color-scheme:dark){.pill{fill:#ff7b3d}.pill-text{fill:#0d1117}}text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}</style>
<rect class="pill" x="56" y="8" width="252" height="48" rx="24"/>
<text class="pill-text" x="182" y="39" font-size="18" font-weight="600" text-anchor="middle">take the torch  →</text>
</svg>
`;
}
