// Is this string a real person's name (not a job title or placeholder)?
const TITLE_WORDS = /\b(new|global|senior|associate|director|vp|svp|evp|vice|president|chief|officer|cfo|ceo|coo|cto|controller|manager|head|lead|operations|finance|financial|supply|chain|accounting|treasurer|team|department|executive|role|position|hire|unknown|null|none|not|identified|n\/a)\b/i;

export function isPersonName(n?: string | null): boolean {
  if (!n) return false;
  const s = n.trim();
  if (!s || /\d/.test(s) || s.includes(",")) return false;
  const parts = s.split(/\s+/);
  if (parts.length < 2 || parts.length > 5) return false;
  if (TITLE_WORDS.test(s)) return false;
  // Most name tokens should start with a capital letter (allow "de", "van", initials like "J.")
  const capped = parts.filter((p) => /^[A-ZÀ-Ý]/.test(p)).length;
  return capped >= 2;
}
