import type { Env } from "./env.ts";

const API = "https://api.github.com";
const UA = "torch-worker";

interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  content?: string;
  sha?: null; // null deletes the path
}

export interface FileWrite {
  path: string;
  content: string;
}

function headers(token: string, scheme: "Bearer" = "Bearer") {
  return {
    authorization: `${scheme} ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": UA,
    "content-type": "application/json",
  };
}

async function gh<T>(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, { ...init, headers: headers(token) });
  if (!res.ok) {
    const body = await res.text();
    throw new GitHubError(res.status, `${init.method ?? "GET"} ${url} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/* -------------------------------------------------------------------------- */
/* App authentication                                                         */
/* -------------------------------------------------------------------------- */

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * GitHub hands out PKCS#1 ("BEGIN RSA PRIVATE KEY"). WebCrypto only imports
 * PKCS#8, so the key must be converted once before being stored as a secret:
 *
 *   openssl pkcs8 -topk8 -nocrypt -in app.pem -out app.pkcs8.pem
 */
function pemToBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

async function appJwt(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  // 60s back-dated for clock drift; GitHub rejects anything over 10 minutes.
  const payload = { iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID };

  const encoder = new TextEncoder();
  const signingInput = `${b64url(encoder.encode(JSON.stringify(header)))}.${b64url(
    encoder.encode(JSON.stringify(payload)),
  )}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuffer(env.GITHUB_APP_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signingInput),
  );

  return `${signingInput}.${b64url(signature)}`;
}

const TOKEN_CACHE_KEY = "installation-token";

/** Installation tokens last an hour, so they are cached rather than minted per claim. */
export async function installationToken(env: Env): Promise<string> {
  const cached = await env.TORCH_KV.get(TOKEN_CACHE_KEY);
  if (cached) return cached;

  const jwt = await appJwt(env);
  const installation = await gh<{ id: number }>(
    `${API}/repos/${env.REPO_OWNER}/${env.REPO_NAME}/installation`,
    jwt,
  );
  const minted = await gh<{ token: string; expires_at: string }>(
    `${API}/app/installations/${installation.id}/access_tokens`,
    jwt,
    { method: "POST" },
  );

  const ttl = Math.floor((Date.parse(minted.expires_at) - Date.now()) / 1000) - 120;
  if (ttl > 60) {
    await env.TORCH_KV.put(TOKEN_CACHE_KEY, minted.token, { expirationTtl: ttl });
  }
  return minted.token;
}

/* -------------------------------------------------------------------------- */
/* Contents                                                                   */
/* -------------------------------------------------------------------------- */

export async function readFile(
  env: Env,
  token: string,
  path: string,
): Promise<string> {
  const file = await gh<{ content: string; encoding: string }>(
    `${API}/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${path}?ref=${env.REPO_BRANCH}`,
    token,
  );
  if (file.encoding !== "base64") throw new Error(`unexpected encoding for ${path}`);
  const binary = atob(file.content.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Writes every file in one commit. Tree entries carry their content inline, so
 * this is four API calls regardless of how many files change.
 *
 * Returns false when the ref moved underneath us — the caller re-reads and retries.
 */
export async function commit(
  env: Env,
  token: string,
  writes: FileWrite[],
  deletions: string[],
  message: string,
): Promise<boolean> {
  const owner = env.REPO_OWNER;
  const repo = env.REPO_NAME;
  const base = `${API}/repos/${owner}/${repo}/git`;

  const ref = await gh<{ object: { sha: string } }>(
    `${base}/ref/heads/${env.REPO_BRANCH}`,
    token,
  );
  const headSha = ref.object.sha;
  const head = await gh<{ tree: { sha: string } }>(`${base}/commits/${headSha}`, token);

  const tree: TreeEntry[] = [
    ...writes.map<TreeEntry>((w) => ({
      path: w.path,
      mode: "100644",
      type: "blob",
      content: w.content,
    })),
    ...deletions.map<TreeEntry>((path) => ({
      path,
      mode: "100644",
      type: "blob",
      sha: null,
    })),
  ];

  const newTree = await gh<{ sha: string }>(`${base}/trees`, token, {
    method: "POST",
    body: JSON.stringify({ base_tree: head.tree.sha, tree }),
  });

  const newCommit = await gh<{ sha: string }>(`${base}/commits`, token, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  });

  try {
    await gh(`${base}/refs/heads/${env.REPO_BRANCH}`, token, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    return true;
  } catch (err) {
    // 422 is a non-fast-forward: someone else claimed while we were building.
    if (err instanceof GitHubError && err.status === 422) return false;
    throw err;
  }
}
