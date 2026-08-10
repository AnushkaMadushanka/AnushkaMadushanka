/**
 * Replays a chain of claims against the real seed data without touching
 * Cloudflare or GitHub, and prints the README the Worker would have committed.
 *
 *   node --experimental-strip-types scripts/dryrun.ts
 *   node --experimental-strip-types scripts/dryrun.ts --hops 40
 */
import { readFileSync } from "node:fs";
import { haversineKm, type Hop, type Place, type TorchData } from "../src/geo.ts";
import { renderBlock, spliceReadme } from "../src/readme.ts";

const ROOT = new URL("../../", import.meta.url);

const CITIES: Place[] = [
  { city: "Lagos", region: "Lagos", country: "NG", lat: 6.45, lon: 3.4 },
  { city: "Helsinki", region: "Uusimaa", country: "FI", lat: 60.17, lon: 24.94 },
  { city: "São Paulo", region: "São Paulo", country: "BR", lat: -23.55, lon: -46.63 },
  { city: "Melbourne", region: "Victoria", country: "AU", lat: -37.81, lon: 144.96 },
  { city: "Reykjavík", region: "Capital", country: "IS", lat: 64.15, lon: -21.94 },
  { city: "Lima", region: "Lima", country: "PE", lat: -12.05, lon: -77.04 },
  { city: "Vancouver", region: "British Columbia", country: "CA", lat: 49.28, lon: -123.12 },
  { city: "Karachi", region: "Sindh", country: "PK", lat: 24.86, lon: 67.01 },
];

const requested = Number(process.argv[process.argv.indexOf("--hops") + 1]);
const count = Number.isFinite(requested) && requested > 0 ? requested : 5;

const data = JSON.parse(
  readFileSync(new URL("data/torch.json", ROOT), "utf8"),
) as TorchData;
const readme = readFileSync(new URL("README.md", ROOT), "utf8");

for (let i = 0; i < count; i++) {
  const previous = data.hops[data.hops.length - 1];
  const place = CITIES[i % CITIES.length];
  const km = haversineKm(previous, place);
  const hop: Hop = {
    ...place,
    n: previous.n + 1,
    km: Math.round(km * 10) / 10,
    totalKm: Math.round((previous.totalKm + km) * 10) / 10,
    at: new Date().toISOString(),
  };
  data.hops.push(hop);
  console.error(
    `  ${String(hop.n).padStart(3)}  ${hop.city.padEnd(12)} +${Math.round(km)
      .toString()
      .padStart(6)} km   total ${Math.round(hop.totalKm)}`,
  );
}

const env = {
  CLAIM_URL: "https://torch.example.workers.dev/claim",
} as Parameters<typeof renderBlock>[1];

console.error("\n─── README ───\n");
console.log(spliceReadme(readme, renderBlock(data, env)));
