// Picks the email provider. EMAIL_PROVIDER=gmail (direct Gmail API) or one (withone.ai).
// Default: gmail when GMAIL_REFRESH_TOKEN is set, otherwise one.
import { sendViaGmail } from "./gmail";
import { sendEmail as sendViaOne } from "./one";
export { recipientFor } from "./one";

export function providerName(): "Gmail API" | "One (Gmail)" {
  const p = process.env.EMAIL_PROVIDER ?? (process.env.GMAIL_REFRESH_TOKEN ? "gmail" : "one");
  return p === "gmail" ? "Gmail API" : "One (Gmail)";
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (providerName() === "Gmail API") await sendViaGmail(to, subject, body);
  else await sendViaOne(to, subject, body);
}
