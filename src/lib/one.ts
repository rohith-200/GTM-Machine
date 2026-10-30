// Sending email through One (withone.ai) -> Gmail.
// One passthrough: {METHOD} https://api.withone.ai/v1/passthrough{path}
// headers: x-one-secret, x-one-connection-key, x-one-action-id
import { env } from "./env";

/** Safety: unless SEND_TO_REAL=true, every email goes to TEST_INBOX. */
export function recipientFor(realEmail: string | null): { to: string; redirected: boolean } {
  if (process.env.SEND_TO_REAL === "true" && realEmail) return { to: realEmail, redirected: false };
  return { to: env("TEST_INBOX"), redirected: true };
}

function rfc822(to: string, subject: string, body: string) {
  // Encode subject so non-ASCII characters survive.
  const subj = /^[\x20-\x7e]*$/.test(subject) ? subject : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  return Buffer.from(
    `To: ${to}\r\nSubject: ${subj}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`,
  ).toString("base64url");
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const actionId = env("ONE_GMAIL_SEND_ACTION_ID");
  const path = process.env.ONE_GMAIL_SEND_PATH || "/users/me/messages/send";
  const url = `https://api.withone.ai/v1/passthrough${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    "x-one-secret": env("ONE_API_KEY"),
    "x-one-connection-key": env("ONE_GMAIL_CONNECTION_KEY"),
    "x-one-action-id": actionId,
    "Content-Type": "application/json",
  };

  const attempts: { name: string; body: unknown }[] = [
    { name: "gmail-raw", body: { raw: rfc822(to, subject, body) } },
    { name: "simple", body: { to, subject, body } },
  ];
  const errors: string[] = [];
  for (const a of attempts) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(a.body) });
    if (res.ok) return;
    const text = (await res.text()).replace(/\s+/g, " ").slice(0, 300);
    errors.push(`${a.name}: ${res.status} ${text}`);
    console.error(`[one] ${a.name} -> ${res.status} ${text}`);
  }
  throw new Error(`One send failed (POST ${path}). ${errors.join(" | ")}`);
}
