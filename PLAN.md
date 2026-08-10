# The Torch

A relay that lives in a GitHub profile README. One person holds the torch at a
time. Anyone can take it with a single click, and the map draws a line from the
last holder's city to theirs. Over time the route becomes a single unbroken
thread stitched around the planet, with a running total of distance covered and
progress toward the Moon.

Built for `AnushkaMadushanka/AnushkaMadushanka`.

## Flow

1. README shows the map and one link: **take the torch** →
   `https://torch.<name>.workers.dev/claim`
2. The Worker reads `request.cf` — city, country, latitude, longitude.
3. It reads `data/torch.json` from the GitHub API, appends the hop, and computes
   the haversine distance from the previous holder plus the new total.
4. It renders the map and the README block and writes everything in a **single
   commit** via the Git Data API.
5. It `302`s the visitor to `https://github.com/AnushkaMadushanka`.

About one to two seconds end to end. The profile they land on is already updated.

Anonymous — no GitHub account needed, no sign-in, one click. The chain is a chain
of cities. Optional "put my face on it" sign-in is a phase 3 idea, not a
requirement.

## Design decisions

**Everything runs in the Worker. There is no GitHub Action.** Rendering in a
`push`-triggered workflow would take 20–60s, so a visitor redirected immediately
would land on a stale map.

**Camo caches by full URL.** GitHub proxies every image, so overwriting
`map-dark.svg` can serve a stale copy for hours. The filename carries the hop
number instead — `assets/map-0047-dark.svg` — and the previous one is deleted in
the same commit. New URL every time, and the repo stays lean.

**The Worker has a 10ms CPU budget** on Cloudflare's free plan, and projecting
world geometry per request would blow it. The land layer is pre-computed *once*
into a fixed SVG path string committed to the repo; at request time the Worker
only projects the new dot and arc and concatenates strings.

**A GitHub App, not a PAT.** Installation tokens are short-lived and rotate
themselves, so nothing expires in your face at the twelve-month mark. The same
app can later provide sign-in.

**Coordinates are rounded to 2 decimals (~1 km)** before they are committed.
`request.cf.latitude` is precise enough that writing it raw into a public repo
forever would be careless. City level is all the map needs.

## Abuse controls

The claim endpoint is a public URL anyone can curl.

- One claim per hashed IP per 24h. IPs are salted and hashed, never stored raw.
- A daily cap on total hops, so nobody floods the artifact overnight.
- A claim from the same city as the current holder is a no-op, which kills the
  refresh-spam case.

Someone determined with a VPN can still cycle it. The cap limits the damage, and
every claim is a commit, so reverting is trivial.

## Concurrency

Two simultaneous claims both build off the same parent and the second
`updateRef` fails as non-fast-forward. The Worker re-reads head and retries, up
to three times. No locking needed at this volume.

## Cost

Free. Cloudflare's Workers free plan covers 100,000 requests/day with 10ms CPU
per invocation, `request.cf` geolocation is available on all plans, and a
`*.workers.dev` subdomain is included. KV usage is one read and one write per
claim, far inside the free tier.

## Layout

```
worker/src/{index,github,geo,readme,ratelimit}.ts
worker/wrangler.toml
data/torch.json
assets/{land-light.path,land-dark.path,map-NNNN-*.svg}
README.md
```

## Phases

1. **Claim path end to end** — geolocate, rate limit, append, commit, redirect.
   README shows a text list of recent hops and the km total. No map yet.
2. **The map** — pre-computed land layer, great-circle arcs via `geoInterpolate`
   so they curve properly and clip at the antimeridian, dots per holder, current
   holder glowing, light and dark variants embedded with `<picture>`.
3. **Polish** — Moon progress bar, milestones (first circumnavigation),
   `HISTORY.md`, optional sign-in for avatars.
