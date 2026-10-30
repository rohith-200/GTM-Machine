// Run: node --env-file=.env.local scripts/test-gmail.mjs   -> sends one test email to TEST_INBOX
const e = process.env;
for (const k of ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "TEST_INBOX"]) {
  if (!e[k]) { console.log(`Missing ${k} in .env.local`); process.exit(1); }
}
const tok = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: e.GMAIL_CLIENT_ID, client_secret: e.GMAIL_CLIENT_SECRET, refresh_token: e.GMAIL_REFRESH_TOKEN, grant_type: "refresh_token" }),
}).then((r) => r.json());
if (!tok.access_token) { console.log("Auth FAILED:", tok); process.exit(1); }
console.log("Auth OK");
const raw = Buffer.from(`To: ${e.TEST_INBOX}\r\nSubject: GTM Engine Gmail test\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\nIt works.`).toString("base64url");
const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ raw }),
});
console.log(res.ok ? `Sent OK to ${e.TEST_INBOX}` : `Send FAILED ${res.status}: ${await res.text()}`);
