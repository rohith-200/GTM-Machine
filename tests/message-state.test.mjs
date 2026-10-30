import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/lead-state.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { mergeMessages } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("message updates replace matching drafts and preserve other cached messages", () => {
  const pending = { id: "email_1", channel: "email", createdAt: "2026-10-30T12:00:00Z", status: "pending_approval" };
  const recent = { id: "sent_1", channel: "email", createdAt: "2026-10-30T11:00:00Z", status: "sent" };
  const updated = { ...pending, status: "sent", createdAt: "2026-10-30T12:00:00Z" };
  const added = { id: "linkedin_1", channel: "linkedin", createdAt: "2026-10-30T12:30:00Z", status: "pending_approval" };

  const result = mergeMessages([pending, recent], [updated, added]);

  assert.deepEqual(result.map(message => message.id), ["linkedin_1", "email_1", "sent_1"]);
  assert.equal(result[1], updated);
  assert.equal(result[2], recent);
  assert.equal(pending.status, "pending_approval");
});

test("message updates initialize an empty cache and sort newest first", () => {
  const older = { id: "older", channel: "email", createdAt: "2026-10-30T10:00:00Z" };
  const newer = { id: "newer", channel: "linkedin", createdAt: "2026-10-30T11:00:00Z" };

  assert.deepEqual(mergeMessages(undefined, [older, newer]).map(message => message.id), ["newer", "older"]);
});
