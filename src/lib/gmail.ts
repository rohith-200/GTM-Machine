// Direct Gmail API sending (OAuth refresh token, scope gmail.send). No extra dependencies.
import { env } from "./env";

const g = globalThis as unknown as { __gmailToken?: { value: string; expires: number } };

async function accessToken(): Promise<string> {
  const cached = g.__gmailToken;
  if (cached && cached.expires > Date.now() + 60_000) return cached.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GMAIL_CLIENT_ID"),
      client_secret: env("GMAIL_CLIENT_SECRET"),
      refresh_token: env("GMAIL_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Gmail auth failed: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  }
  g.__gmailToken = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

function rfc822(to: string, subject: string, body: string) {
  const subj = /^[\x20-\x7e]*$/.test(subject) ? subject : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const from = process.env.SENDER_NAME ? `From: ${process.env.SENDER_NAME} <me>\r\n` : "";
  return Buffer.from(
    `${from}To: ${to}\r\nSubject: ${subj}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`,
  ).toString("base64url");
}

export async function sendViaGmail(to: string, subject: string, body: string): Promise<string> {
  const token = await accessToken();
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: rfc822(to, subject, body) }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${data.error?.message ?? "send failed"}`);
  return data.id ?? "";
}
