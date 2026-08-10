export interface Env {
  /* bindings */
  TORCH_KV: KVNamespace;

  /* vars — see wrangler.toml */
  REPO_OWNER: string;
  REPO_NAME: string;
  REPO_BRANCH: string;
  PROFILE_URL: string;
  CLAIM_URL: string;
  DAILY_HOP_CAP: string;
  CLAIM_COOLDOWN_HOURS: string;

  /* secrets — wrangler secret put */
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  IP_SALT: string;
}
