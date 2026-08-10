import { geoInterpolate, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Hop, TorchData } from "./geo.ts";
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
 * Backgrounds match GitHub's own so the map sits flush against the page.
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
@media(prefers-color-scheme:dark){
.bg{fill:#0d1117}
.graticule{stroke:#161b22}
.land{fill:#20262e}
.edge{stroke:#2b323b}
.arc{stroke:#ff7b3d}
.dot{fill:#57606a}
.flame{fill:#ff7b3d}
.wick{fill:#0d1117}
}
.halo{animation:pulse 2.8s ease-in-out infinite}
@keyframes pulse{0%,100%{r:10px;opacity:.9}50%{r:16px;opacity:.35}}
@media(prefers-reduced-motion:reduce){.halo{animation:none}}
`.replace(/\n/g, "");

// precision(0) turns off adaptive resampling. The arcs are sampled by hand
// below and the land was projected at build time, so nothing here benefits
// from paying for it.
const projection = geoNaturalEarth1().scale(SCALE).translate(TRANSLATE).precision(0);
const path = geoPath(projection);

const project = (hop: Hop): [number, number] =>
  projection([hop.lon, hop.lat]) ?? [0, 0];

const fixed = (n: number) => Number(n.toFixed(1));

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
  const flame =
    `<circle class="flame halo" cx="${fixed(cx)}" cy="${fixed(cy)}" r="10" fill-opacity="0.18"/>` +
    `<circle class="flame" cx="${fixed(cx)}" cy="${fixed(cy)}" r="4.5"/>` +
    `<circle class="wick" cx="${fixed(cx)}" cy="${fixed(cy)}" r="1.8" fill-opacity="0.85"/>`;

  const label = `The torch is in ${current.city}. ${hops.length} ${
    hops.length === 1 ? "holder" : "holders"
  } so far, ${Math.round(current.totalKm)} km travelled.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${label}">
<title>${label}</title>
<style>${STYLE}</style>
<rect class="bg" width="${WIDTH}" height="${HEIGHT}"/>
<path class="graticule" d="${GRATICULE_PATH}" fill="none" stroke-width="0.6"/>
<path class="land" d="${LAND_PATH}"/>
<path class="edge" d="${SPHERE_PATH}" fill="none" stroke-width="1"/>
${arcs.join("")}
${dots}
${flame}
</svg>
`;
}

export const mapPath = (n: number): string =>
  `assets/map-${String(n).padStart(4, "0")}.svg`;
