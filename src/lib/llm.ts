// Nebius Token Factory (OpenAI-compatible) + a robust JSON helper.
import OpenAI from "openai";
import { env } from "./env";
import { ApiError } from "./http";

const g = globalThis as unknown as { __llm?: OpenAI };

export function llm(): OpenAI {
  if (!g.__llm) {
    g.__llm = new OpenAI({
      baseURL: "https://api.tokenfactory.nebius.com/v1/",
      apiKey: env("NEBIUS_API_KEY"),
      timeout: 60_000,
      maxRetries: 1,
    });
  }
  return g.__llm;
}

/** Pull a JSON object out of model text: strips <think> blocks and ``` fences. */
export function extractJson(text: string): unknown {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  t = t.replace(/^[\s\S]*<\/think>/i, ""); // unclosed opening tag case
  t = t.replace(/```(?:json)?/gi, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(t.slice(start, end + 1));
}

type ChatOpts = { system: string; user: string; temperature?: number; maxTokens?: number };

async function complete(opts: ChatOpts, jsonMode: boolean): Promise<string> {
  const res = await llm().chat.completions.create({
    model: env("NEBIUS_MODEL"),
    temperature: opts.temperature ?? 0.3,
    max_tokens: Math.max(opts.maxTokens ?? 2000, 4000),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
  const choice = res.choices[0];
  const text = choice?.message?.content ?? "";
  if (!text.trim()) {
    // Reasoning models can spend the whole budget "thinking" and return empty content.
    throw new Error(
      `Empty content from ${env("NEBIUS_MODEL")} (finish_reason=${choice?.finish_reason}). ` +
        `Likely a reasoning model: switch NEBIUS_MODEL to a non-thinking instruct model.`,
    );
  }
  return text;
}

/** Ask for JSON and get parsed JSON back. Retries once with a stricter reminder. */
export async function chatJSON(opts: ChatOpts): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const o = attempt === 0 ? opts : { ...opts, user: `${opts.user}\n\nReturn ONLY one valid JSON object. No prose, no markdown.` };
    try {
      let text: string;
      try {
        text = await complete(o, true);
      } catch (e) {
        // Some models reject response_format; retry this attempt without it.
        if ((e as { status?: number }).status === 400) text = await complete(o, false);
        else throw e;
      }
      try {
        return extractJson(text);
      } catch (e) {
        console.error("[llm] unparseable output:", text.slice(0, 800));
        throw new Error(`${(e as Error).message}. Output started with: ${JSON.stringify(text.slice(0, 160))}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new ApiError("UPSTREAM_FAILED", `LLM failed: ${(lastErr as Error)?.message ?? "unknown error"}`);
}