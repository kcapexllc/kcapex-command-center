// "Ask Claude" for the KCAPEX Command Center. The app sends the conversation and a
// snapshot of its data; this function calls the Claude API with the key stored in the
// Netlify environment variable ANTHROPIC_API_KEY (never in this repo).
import Anthropic from "@anthropic-ai/sdk";
import { createHash, timingSafeEqual } from "node:crypto";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function authorized(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  const want = createHash("sha256").update(`kcapex-command-center:${pw}`).digest("hex");
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)kc_auth=([0-9a-f]{64})/);
  if (m && timingSafeEqual(Buffer.from(m[1]), Buffer.from(want))) return true;
  const b = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!b) return false;
  const got = createHash("sha256").update(`kcapex-command-center:${b[1].trim()}`).digest("hex");
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const SYSTEM = `You are the assistant inside the KCAPEX Command Center, the internal dashboard of KCAPEX LLC, a small federal prime contractor in Chicago (UEI PCATNSPCZFE9, CAGE 190W7) run by Kobe Williams (CEO) and the majority owner. KCAPEX is self-certified small business only: it cannot bid 8(a), SDVOSB, VOSB, WOSB, EDWOSB or HUBZone set-asides. It bids single-trade, subcontractable work (janitorial, facility services, HVAC, flooring, painting, roofing, doors, mold remediation) and performs through local subcontractors.
Rules the owners use: quick-turn bids are 3 to 6 days from posted to due; Kobe approves bids from $10K to $500K and the majority owner signs off above $500K; FY27 goals are $2M revenue invoiced, 15 bids submitted a month and a 20% win rate.
Answer from the JSON snapshot of the app's data in the first user message. If the snapshot does not hold the answer, say so plainly instead of guessing. Be short and specific: name solicitation numbers, dates and dollar amounts. Write for a phone screen: a few sentences or a short list, no tables, no markdown headings.`;

export default async (req) => {
  if (!authorized(req)) return json({ error: "Not signed in" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "Claude isn't turned on yet. Add your Anthropic API key in Netlify as ANTHROPIC_API_KEY, then redeploy." }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12);
  if (!history.length || history[history.length - 1].role !== "user") return json({ error: "Ask a question first" }, 400);
  while (history.length && history[0].role !== "user") history.shift();
  const snapshot = JSON.stringify(body.snapshot || {}).slice(0, 200000);
  const messages = [
    { role: "user", content: `App data snapshot (JSON):\n${snapshot}` },
    { role: "assistant", content: "Got it. I'll answer from this snapshot." },
    ...history,
  ];

  const client = new Anthropic();
  const params = { model: MODEL, max_tokens: 4000, system: SYSTEM, messages };
  // Server-side refusal fallbacks are supported on Opus and Sonnet models, not Haiku.
  const canFallback = !/haiku/i.test(MODEL);
  try {
    const res = canFallback
      ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await client.messages.create(params);
    if (res.stop_reason === "refusal") return json({ text: "Claude declined to answer that one. Try asking it another way." });
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return json({ text: text || "(no answer)" });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "The Anthropic API key in Netlify was rejected. Check ANTHROPIC_API_KEY." }, 502);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Claude is busy right now. Try again in a minute." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Claude error ${e.status}: ${e.message}` }, 502);
    return json({ error: "Could not reach Claude." }, 502);
  }
};

export const config = { path: "/api/ask" };
