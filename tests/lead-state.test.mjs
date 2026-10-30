import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/lead-state.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { mergeLeadUpdates, formatSignalDate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("a partial enrichment response retains all unselected leads", () => {
  const selected = { id: "lead_b", fitScore: 70, person: { email: null, emailStatus: "not_enriched" } };
  const other = { id: "lead_a", fitScore: 90, person: { email: null, emailStatus: "not_enriched" } };
  const update = { ...selected, person: { email: "buyer@example.com", emailStatus: "verified" } };
  const result = mergeLeadUpdates([other, selected], [update]);
  assert.equal(result.length, 2);
  assert.equal(result[0], other);
  assert.equal(result[1], update);
  assert.equal(selected.person.email, null);
});

test("partial updates preserve score ordering without mutating the original array", () => {
  const current = [{ id: "a", fitScore: 80 }, { id: "b", fitScore: 60 }, { id: "c", fitScore: 20 }];
  const result = mergeLeadUpdates(current, [{ id: "b", fitScore: 95 }]);
  assert.deepEqual(result.map(lead => lead.id), ["b", "a", "c"]);
  assert.deepEqual(current.map(lead => lead.id), ["a", "b", "c"]);
});

test("enrichment cannot insert an unrelated lead into a discovery result", () => {
  const current = [{ id: "a", fitScore: 80 }];
  assert.deepEqual(mergeLeadUpdates(current, [{ id: "unrelated", fitScore: 100 }]), current);
  assert.deepEqual(mergeLeadUpdates(current, []), current);
});

test("a stage response updates only its matching lead and preserves the rest of the board", () => {
  const first = { id: "a", fitScore: 80, stage: "matched", lastActor: "ai" };
  const second = { id: "b", fitScore: 60, stage: "contacted", lastActor: "rep" };
  const updated = { ...first, stage: "replied", lastActor: "rep" };
  const result = mergeLeadUpdates([first, second], [updated]);

  assert.deepEqual(result, [updated, second]);
  assert.equal(first.stage, "matched");
});

test("unknown and invalid signal dates remain readable placeholders", () => {
  assert.equal(formatSignalDate(null), "—");
  assert.equal(formatSignalDate("not-a-date"), "—");
});
