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
  "<sub>Your approximate city comes from Cloudflare's edge network. " +
  "Coordinates are rounded to about a kilometre before they are written down, " +
  "and nothing else about you is recorded.</sub>";

/** Phase 1 is text only. The map lands in phase 2 above the heading. */
export function renderBlock(data: TorchData, env: Env): string {
  const hops = data.hops;
  const current = hops[hops.length - 1];
  const total = current.totalKm;
  const laps = Math.floor(total / LAP_KM);

  let summary =
    `Carried **${numbers.format(Math.round(total))} km** by ` +
    `**${hops.length}** ${hops.length === 1 ? "pair of hands" : "pairs of hands"} — ` +
    `**${((total / MOON_KM) * 100).toFixed(1)}%** of the way to the Moon.`;
  if (laps >= 1) {
    summary += ` That is ${laps} ${laps === 1 ? "lap" : "laps"} of the Earth.`;
  }

  const recent = hops
    .slice(-6, -1)
    .reverse()
    .map((hop) => `- ${place(hop)} — ${numbers.format(Math.round(hop.km))} km`)
    .join("\n");

  const parts = [
    `### 🔥 The torch is in **${place(current)}**`,
    summary,
    `[**Take the torch →**](${env.CLAIM_URL})`,
    recent ? `<sub>**Before that**</sub>\n\n${recent}` : null,
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
