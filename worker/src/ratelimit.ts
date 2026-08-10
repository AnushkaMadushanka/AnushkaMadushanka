import type { Env } from "./env.ts";

export type Rejection = "cooldown" | "daily-cap";

/**
 * IPs are salted and hashed before they touch storage, and the hash is only
 * ever a KV key with a TTL — nothing about a visitor is written to the repo.
 */
async function fingerprint(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${ip}`),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const today = () => new Date().toISOString().slice(0, 10);

/** Checked before the claim runs; nothing is consumed yet. */
export async function check(
  env: Env,
  ip: string,
): Promise<Rejection | null> {
  const key = `rl:${await fingerprint(ip, env.IP_SALT)}`;
  if (await env.TORCH_KV.get(key)) return "cooldown";

  const cap = Number(env.DAILY_HOP_CAP);
  const used = Number((await env.TORCH_KV.get(`cap:${today()}`)) ?? "0");
  if (Number.isFinite(cap) && used >= cap) return "daily-cap";

  return null;
}

/** Called only once a hop has actually landed. */
export async function consume(env: Env, ip: string): Promise<void> {
  const key = `rl:${await fingerprint(ip, env.IP_SALT)}`;
  const hours = Number(env.CLAIM_COOLDOWN_HOURS) || 24;
  const capKey = `cap:${today()}`;
  const used = Number((await env.TORCH_KV.get(capKey)) ?? "0");

  await Promise.all([
    env.TORCH_KV.put(key, "1", { expirationTtl: Math.round(hours * 3600) }),
    // Racy under simultaneous claims, which costs us at most a hop of slack.
    env.TORCH_KV.put(capKey, String(used + 1), { expirationTtl: 172800 }),
  ]);
}
