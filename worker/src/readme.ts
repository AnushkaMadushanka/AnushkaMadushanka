import type { Env } from "./env.ts";
import { LAP_KM, MOON_KM, type Hop, type TorchData } from "./geo.ts";

export const START = "<!-- torch:start -->";
export const END = "<!-- torch:end -->";

const regions = new Intl.DisplayNames(["en"], { type: "region" });
const numbers = new Intl.NumberFormat("en-US");

function place(hop: Hop): string {
  let country = hop.country;
  try {
    country = regions.of(hop.country) ?? hop.country;
  } catch {
    /* unknown code — fall back to the raw two-letter one */
  }
  return `${hop.city}, ${country}`;
}

const DISCLOSURE =
  "<sub>City from Cloudflare's edge, rounded to ~1 km. Nothing else recorded.</sub>";

/**
 * Below this the percentage rounds to 0.0% and reads as a bug rather than a
 * statistic, so it stays hidden until it means something.
 */
const MOON_VISIBLE_FROM = MOON_KM * 0.01;

/**
 * Absolute rather than relative, because GitHub's image proxy keys its cache on
 * the full URL — and because the filename carries the hop number, every claim
 * produces a URL the proxy has never seen and therefore cannot serve stale.
 */
function raw(env: Env, path: string): string {
  return `https://raw.githubusercontent.com/${env.REPO_OWNER}/${env.REPO_NAME}/${env.REPO_BRANCH}/${path}`;
}

function mapPicture(data: TorchData, env: Env): string | null {
  if (!data.map) return null;
  const current = data.hops[data.hops.length - 1];
  const alt = `World map of the torch's route, currently in ${place(current)}`;

  // The map is the button — clicking it takes the torch.
  return `<a href="${env.CLAIM_URL}"><img alt="${alt}" src="${raw(env, data.map)}" width="100%"></a>`;
}

export function renderBlock(data: TorchData, env: Env): string {
  const hops = data.hops;
  const current = hops[hops.length - 1];
  const total = current.totalKm;
  const laps = Math.floor(total / LAP_KM);

  const stats = [
    `**${numbers.format(Math.round(total))} km**`,
    `**${hops.length}** ${hops.length === 1 ? "hand" : "hands"}`,
  ];
  if (total >= MOON_VISIBLE_FROM) {
    stats.push(`**${((total / MOON_KM) * 100).toFixed(1)}%** to the Moon`);
  }
  if (laps >= 1) {
    stats.push(`**${laps}** ${laps === 1 ? "lap" : "laps"} of the Earth`);
  }

  const previous = hops.slice(0, -1).reverse();
  const shown = previous.slice(0, 20);
  const lines = shown.map(
    (hop) => `- ${place(hop)} — ${numbers.format(Math.round(hop.km))} km`,
  );
  if (previous.length > shown.length) {
    lines.push(`- …and ${previous.length - shown.length} before that`);
  }
  const history = previous.length
    ? `<details>\n<summary>Where it has been</summary>\n\n${lines.join("\n")}\n\n</details>`
    : null;

  const parts = [
    mapPicture(data, env),
    `### 🔥 The torch is in **${place(current)}**`,
    `${stats.join(" · ")} · [**take it →**](${env.CLAIM_URL})`,
    history,
    DISCLOSURE,
  ].filter((part): part is string => Boolean(part));

  return `${START}\n\n${parts.join("\n\n")}\n\n${END}`;
}

export function spliceReadme(readme: string, block: string): string {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("README is missing its torch markers");
  }
  return readme.slice(0, start) + block + readme.slice(end + END.length);
}
