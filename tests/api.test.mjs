import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { api, ApiClientError } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("unwraps success and preserves a null result", async () => {
  globalThis.fetch = async () => Response.json({ ok: true, data: null });
  assert.equal(await api("/api/icp"), null);
});

test("sends JSON headers, keeps custom headers, and disables caching", async () => {
  let request;
  globalThis.fetch = async (path, init) => { request = { path, init }; return Response.json({ ok: true, data: { id: "icp_01" } }); };
  assert.deepEqual(await api("/api/icp", { method: "POST", headers: { "X-Request-ID": "test" }, body: JSON.stringify({ productDescription: "Example" }) }), { id: "icp_01" });
  assert.equal(request.path, "/api/icp");
  assert.equal(request.init.headers.get("Content-Type"), "application/json");
  assert.equal(request.init.headers.get("X-Request-ID"), "test");
  assert.equal(request.init.cache, "no-store");
});

test("preserves the backend error message, code, and status", async () => {
  globalThis.fetch = async () => Response.json({ ok: false, error: { code: "UPSTREAM_FAILED", message: "Research is temporarily unavailable." } }, { status: 502 });
  await assert.rejects(api("/api/icp"), error => error instanceof ApiClientError && error.code === "UPSTREAM_FAILED" && error.status === 502 && error.message === "Research is temporarily unavailable.");
});

test("rejects malformed responses and contradictory HTTP successes", async () => {
  for (const response of [new Response("not JSON"), Response.json({ data: {} }), Response.json({ ok: true }), Response.json({ ok: true, data: {} }, { status: 500 })]) {
    globalThis.fetch = async () => response;
    await assert.rejects(api("/api/icp"), error => error instanceof ApiClientError && error.code === "INVALID_RESPONSE");
  }
});

test("keeps cancellation distinguishable from connection errors", async () => {
  const aborted = new DOMException("Cancelled", "AbortError");
  globalThis.fetch = async () => { throw aborted; };
  await assert.rejects(api("/api/icp"), error => error === aborted);
  globalThis.fetch = async () => { throw new TypeError("Connection failed"); };
  await assert.rejects(api("/api/icp"), error => error.code === "NETWORK_ERROR");
});

test("blocks external URLs before making any request", async () => {
  globalThis.fetch = async () => { throw new Error("Should not be called"); };
  await assert.rejects(api("https://example.com/api/icp"), error => error.code === "INVALID_PATH");
});
