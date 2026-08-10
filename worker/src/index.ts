import type { Env } from "./env.ts";
import {
  haversineKm,
  label,
  placeFromRequest,
  samePlace,
  type Hop,
  type TorchData,
} from "./geo.ts";
import { commit, installationToken, readFile } from "./github.ts";
import { mapPath, renderMap } from "./map.ts";
import { check, consume } from "./ratelimit.ts";
import { renderBlock, spliceReadme } from "./readme.ts";

const DATA_PATH = "data/torch.json";
const README_PATH = "README.md";
const MAX_ATTEMPTS = 3;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/claim") {
      return handleClaim(request, env);
    }
    if (url.pathname === "/status") {
      return status(env);
    }
    return home(env);
  },
};

function home(env: Env): Response {
  return new Response(null, {
    status: 302,
    headers: { location: env.PROFILE_URL, "cache-control": "no-store" },
  });
}

/**
 * Link unfurlers and prefetchers follow URLs without anyone clicking anything.
 * Left alone they would quietly pass the torch around every time the link got
 * pasted into a chat window, so a claim has to look like a real navigation.
 */
function isRealVisit(request: Request): boolean {
  const h = request.headers;
  if (request.method !== "GET") return false;
  if ((h.get("sec-purpose") ?? "").includes("prefetch")) return false;
  if (h.get("purpose") === "prefetch") return false;

  const dest = h.get("sec-fetch-dest");
  const mode = h.get("sec-fetch-mode");
  if (dest && dest !== "document") return false;
  if (mode && mode !== "navigate") return false;

  const ua = (h.get("user-agent") ?? "").toLowerCase();
  if (!ua) return false;
  return !/bot|crawler|spider|preview|slack|discord|whatsapp|telegram|curl|wget|python|okhttp|headless/.test(
    ua,
  );
}

async function handleClaim(request: Request, env: Env): Promise<Response> {
  const back = home(env);
  if (!isRealVisit(request)) return back;

  const place = placeFromRequest(request);
  if (!place) return back; // no usable geolocation — send them on their way

  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return back;
  if (await check(env, ip)) return back;

  const token = await installationToken(env);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const [rawData, readme] = await Promise.all([
      readFile(env, token, DATA_PATH),
      readFile(env, token, README_PATH),
    ]);
    const data = JSON.parse(rawData) as TorchData;
    const previous = data.hops[data.hops.length - 1];

    // Holding it already: refreshing the page should not extend the chain.
    if (samePlace(previous, place)) return back;

    const km = haversineKm(previous, place);
    const hop: Hop = {
      ...place,
      n: previous.n + 1,
      km: Math.round(km * 10) / 10,
      totalKm: Math.round((previous.totalKm + km) * 10) / 10,
      at: new Date().toISOString(),
    };

    const map = mapPath(hop.n);
    const next: TorchData = { ...data, hops: [...data.hops, hop], map };

    // The previous map is dropped from the tree in the same commit. Git history
    // keeps it; the working tree stays at exactly one.
    const stale = data.map ? [data.map] : [];

    const landed = await commit(
      env,
      token,
      [
        { path: DATA_PATH, content: `${JSON.stringify(next, null, 2)}\n` },
        { path: README_PATH, content: spliceReadme(readme, renderBlock(next, env)) },
        { path: map, content: renderMap(next) },
      ],
      stale,
      `🔥 the torch moves to ${label(hop)} (+${Math.round(km)} km)`,
    );

    if (landed) {
      await consume(env, ip);
      return back;
    }
    // Someone claimed while we were building. Re-read and try again.
  }

  return back;
}

async function status(env: Env): Promise<Response> {
  const token = await installationToken(env);
  const data = JSON.parse(await readFile(env, token, DATA_PATH)) as TorchData;
  const current = data.hops[data.hops.length - 1];

  return Response.json(
    {
      holder: label(current),
      hops: data.hops.length,
      totalKm: current.totalKm,
      since: current.at,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
