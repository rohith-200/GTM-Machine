// Central place for env access. Missing keys fail loudly with a clear message.
export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (check .env.local / Vercel settings)`);
  return v;
}

/** Emergency switch: USE_FIXTURES=true makes routes fall back to stub behaviour. */
export const useFixtures = () => process.env.USE_FIXTURES === "true";
