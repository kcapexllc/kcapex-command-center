// Claude chat for the KCAPEX Command Center: streams replies, can search the web, read
// attached PDFs and photos, look up records in the app, and make a small set of changes
// in the app (notes, bid status and price, tasks, site visits, invoices) when asked.
// Credentials come from Netlify's AI Gateway (or an ANTHROPIC_API_KEY set in Netlify).
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const MAX_TURNS = 8;
const STATUSES = ["found", "reviewing", "bid", "submitted", "awarded", "lost", "no-bid", "cancelled"];
const COLL = { bids: "opportunities", new_opportunities: "inbox", contracts: "contracts", invoices: "invoices", contacts: "contacts", subs: "subs", past_performance: "pastperf", tasks: "tasks", site_visits: "visits", messages: "messages", leads: "leads", jobs: "jobs" };

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

const SYSTEM = `You are Claude, working inside the KCAPEX Command Center, the internal dashboard of KCAPEX LLC: a small-business federal prime contractor in Chicago (UEI PCATNSPCZFE9, CAGE 190W7) run by Kobe Williams (Co-Owner/Managing Director) and the majority owner, Chellsea Neely. KCAPEX is self-certified small business only and cannot bid 8(a), SDVOSB, VOSB, WOSB, EDWOSB or HUBZone set-asides. It bids single-trade, subcontractable work (janitorial, facility services, HVAC, flooring, painting, roofing, doors, mold remediation) and performs through local subcontractors.
Owners' rules: quick-turn bids are 3 to 6 days from posted to due; Kobe approves bids from $10K to $500K and the majority owner signs off above $500K; FY27 (1 Oct 2026 to 30 Sep 2027) goals are $2M revenue invoiced, 15 bids submitted a month and a 20% win rate.
Help the owners the way you would in the Claude app: answer questions, think through bids and pricing, read attached solicitations and documents, draft emails and proposals, and search the web when current information helps (SAM.gov notices, agencies, wage determinations, companies).
You have the app's data. A snapshot comes in the first message; use app_search for anything more detailed or not in the snapshot. Name solicitation numbers, dates and dollar amounts. If the data does not hold an answer, say so instead of guessing.
You can change records in the app with the write tools. Only make a change when the person asked for it or clearly agreed to it, and say plainly what you changed. Changes to bids, tasks, contacts, subs and past performance also reach the owners' Pipeline in Claude at the next twice-daily sync. You cannot send email or submit bids: draft them for the person to send.
Email drafts use the KCAPEX house style: short and factual, solicitation or contract number in the subject, ask for confirmation of receipt where it fits, no marketing language, signed Kobe Williams, Co-Owner/Managing Director, KCAPEX LLC, 219-333-6902, kcapexllc@gmail.com. Output "Subject: ..." then the body.
Format answers in Markdown that reads well on a phone: short paragraphs and lists, tables only when they truly help.`;

const str = { type: "string" };
const TOOLS = [
  { type: "web_search_20260209", name: "web_search", max_uses: 5 },
  {
    name: "app_search", description: "Look up records in the KCAPEX Command Center. Returns matching records with their ids. Use it before changing a record, to get its id.",
    input_schema: { type: "object", additionalProperties: false, required: ["collection"], properties: {
      collection: { type: "string", enum: Object.keys(COLL) },
      query: { type: "string", description: "Words to match anywhere in the record (solicitation number, title, agency, name). Leave empty to list recent records." },
      limit: { type: "integer", minimum: 1, maximum: 40 },
    } },
  },
  {
    name: "add_note", description: "Add a dated note to a bid, contact or subcontractor.",
    input_schema: { type: "object", additionalProperties: false, required: ["collection", "id", "text"], properties: {
      collection: { type: "string", enum: ["bids", "contacts", "subs"] }, id: str, text: str,
    } },
  },
  {
    name: "update_bid", description: "Change a bid's status, our price or due date. Adds a note recording the change.",
    input_schema: { type: "object", additionalProperties: false, required: ["id"], properties: {
      id: str, status: { type: "string", enum: STATUSES }, our_price: { type: "number", minimum: 0 }, due: { type: "string", description: "YYYY-MM-DD" },
    } },
  },
  {
    name: "create_task", description: "Create a task, optionally linked to a bid.",
    input_schema: { type: "object", additionalProperties: false, required: ["text"], properties: { text: str, due: { type: "string", description: "YYYY-MM-DD" }, bid_id: str } },
  },
  {
    name: "add_site_visit", description: "Add a site visit to the tracker.",
    input_schema: { type: "object", additionalProperties: false, required: ["title", "date"], properties: { title: str, date: { type: "string", description: "YYYY-MM-DD" }, time: str, location: str, bid_id: str, notes: str } },
  },
  {
    name: "log_invoice", description: "Log an invoice against a contract (use app_search on contracts for the id).",
    input_schema: { type: "object", additionalProperties: false, required: ["contract_id", "number", "amount", "sent"], properties: {
      contract_id: str, number: str, amount: { type: "number", minimum: 0 }, sent: { type: "string", description: "YYYY-MM-DD" },
      status: { type: "string", enum: ["Sent", "Paid", "Draft", "Disputed"] }, system: { type: "string", enum: ["WAWF / PIEE", "IPP", "Email", "Mail", "Other"] }, paid: { type: "string", description: "YYYY-MM-DD" },
    } },
  },
].map((t) => (t.type ? t : { ...t, eager_input_streaming: true }));

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const nowIso = () => new Date().toISOString();
const stamp = () => new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
const newRev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function readColl(store, c) { return (await store.get(c, { type: "json" })) || {}; }
async function writeDoc(store, c, id, doc) {
  const cur = await readColl(store, c); cur[id] = doc;
  await store.setJSON(c, cur, { metadata: { rev: newRev() } });
}

// Runs one app tool. Returns [resultText, summaryForTheUI].
async function runTool(store, name, input) {
  const bad = (msg) => [JSON.stringify({ error: msg }), null];
  if (!input || typeof input !== "object") return bad("Tool input could not be read.");
  if (name === "app_search") {
    const c = COLL[input.collection]; if (!c) return bad("Unknown collection.");
    let rows = Object.entries(await readColl(store, c)).filter(([, d]) => d && !d.deleted);
    if (c === "inbox") rows = rows.filter(([, d]) => d.state === "new");
    const q = String(input.query || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (q.length) rows = rows.filter(([id, d]) => { const s = (id + " " + JSON.stringify(d)).toLowerCase(); return q.every((w) => s.includes(w)); });
    rows.sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")));
    const lim = Math.min(Number(input.limit) || 15, 40);
    const out = rows.slice(0, lim).map(([id, d]) => { const { notes, pricing, followups, watch, ...rest } = d;
      return { id, ...rest, recentNotes: Array.isArray(notes) ? notes.slice(-5) : undefined, pricing: pricing || undefined, followupsSent: followups ? followups.sent : undefined }; });
    let text = JSON.stringify({ total: rows.length, shown: out.length, records: out });
    if (text.length > 40000) text = text.slice(0, 40000) + "…(truncated; narrow the query)";
    return [text, `Looked up ${input.collection.replace("_", " ")}${input.query ? ` for "${input.query}"` : ""}`];
  }
  if (name === "add_note") {
    const c = COLL[input.collection]; if (!["opportunities", "contacts", "subs"].includes(c) || typeof input.id !== "string" || !String(input.text || "").trim()) return bad("Need a collection, a record id and note text.");
    const all = await readColl(store, c); const d = all[input.id]; if (!d || d.deleted) return bad("No record with that id. Use app_search first.");
    const notes = [...(Array.isArray(d.notes) ? d.notes : []), { t: stamp(), text: String(input.text).trim() + " (Claude, in the app)" }];
    await writeDoc(store, c, input.id, { ...d, notes, updatedAt: nowIso() });
    return [JSON.stringify({ ok: true }), `Added a note to ${d.title || d.name || d.company || input.id}`];
  }
  if (name === "update_bid") {
    if (typeof input.id !== "string") return bad("Need the bid id.");
    if (input.status && !STATUSES.includes(input.status)) return bad("Unknown status.");
    if (input.due && !isDate(input.due)) return bad("Due date must be YYYY-MM-DD.");
    const all = await readColl(store, "opportunities"); const d = all[input.id]; if (!d || d.deleted) return bad("No bid with that id. Use app_search first.");
    const changes = []; const next = { ...d };
    if (input.status && input.status !== d.status) { changes.push(`status ${d.status || "found"} to ${input.status}`); next.status = input.status; if (input.status === "submitted" && !d.submittedOn) next.submittedOn = new Date().toISOString().slice(0, 10); }
    if (typeof input.our_price === "number") { changes.push(`our price to $${input.our_price.toLocaleString()}`); next.ourPrice = input.our_price; }
    if (input.due) { changes.push(`due date to ${input.due}`); next.due = input.due; }
    if (!changes.length) return [JSON.stringify({ ok: true, note: "Nothing to change." }), null];
    next.notes = [...(Array.isArray(d.notes) ? d.notes : []), { t: stamp(), text: `Changed ${changes.join(", ")} (Claude, in the app).` }];
    next.updatedAt = nowIso();
    await writeDoc(store, "opportunities", input.id, next);
    return [JSON.stringify({ ok: true, changed: changes }), `Updated ${d.sol || d.title}: ${changes.join(", ")}`];
  }
  if (name === "create_task") {
    if (!String(input.text || "").trim()) return bad("Need the task text.");
    if (input.due && !isDate(input.due)) return bad("Due date must be YYYY-MM-DD.");
    const id = "claude-" + randomUUID().slice(0, 8);
    await writeDoc(store, "tasks", id, { text: String(input.text).trim(), due: input.due || "", done: "No", ...(input.bid_id ? { linkType: "opportunities", linkId: input.bid_id } : {}), createdAt: nowIso(), updatedAt: nowIso() });
    return [JSON.stringify({ ok: true, id }), `Created task: ${String(input.text).trim()}${input.due ? ` (due ${input.due})` : ""}`];
  }
  if (name === "add_site_visit") {
    if (!String(input.title || "").trim() || !isDate(input.date)) return bad("Need a title and a YYYY-MM-DD date.");
    const id = "visit-" + randomUUID().slice(0, 8);
    await writeDoc(store, "visits", id, { title: String(input.title).trim(), date: input.date, time: input.time || "", location: input.location || "", bidId: input.bid_id || "", status: "Scheduled", notesTxt: (input.notes || "") + " (Added by Claude in the app.)", createdAt: nowIso(), updatedAt: nowIso() });
    return [JSON.stringify({ ok: true, id }), `Added site visit: ${input.title} on ${input.date}`];
  }
  if (name === "log_invoice") {
    if (typeof input.contract_id !== "string" || !String(input.number || "").trim() || typeof input.amount !== "number" || !isDate(input.sent)) return bad("Need contract_id, number, amount and a YYYY-MM-DD sent date.");
    const contracts = await readColl(store, "contracts"); const c = contracts[input.contract_id]; if (!c) return bad("No contract with that id. Use app_search on contracts first.");
    const id = "inv-claude-" + randomUUID().slice(0, 8);
    await writeDoc(store, "invoices", id, { contractId: input.contract_id, number: String(input.number).trim(), amount: input.amount, status: input.status || "Sent", system: input.system || "", sent: input.sent, paid: input.paid || "", notesTxt: "Logged by Claude in the app.", createdAt: nowIso(), updatedAt: nowIso() });
    return [JSON.stringify({ ok: true, id }), `Logged invoice ${input.number} for $${input.amount.toLocaleString()} on ${c.title}`];
  }
  return bad("Unknown tool.");
}

// Turns the app's chat history into API messages. Attachments travel only on the turn that carries them.
function toApiMessages(history, snapshot) {
  const msgs = [];
  for (const m of history) {
    if (m.role === "assistant") { if (m.text) msgs.push({ role: "assistant", content: m.text }); continue; }
    const content = [];
    for (const f of Array.isArray(m.files) ? m.files : []) {
      if (!f || typeof f.data !== "string") continue;
      if (f.type === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data }, title: String(f.name || "document.pdf").slice(0, 200) });
      else if (/^image\/(png|jpeg|gif|webp)$/.test(f.type)) content.push({ type: "image", source: { type: "base64", media_type: f.type, data: f.data } });
    }
    const names = (Array.isArray(m.fileNames) ? m.fileNames : []).filter(Boolean);
    content.push({ type: "text", text: (m.text || "") + (names.length && !(m.files || []).length ? `\n\n(Earlier in this chat I attached: ${names.join(", ")}.)` : "") || "(attachment)" });
    msgs.push({ role: "user", content });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (msgs.length) {
    const first = msgs[0];
    first.content = [{ type: "text", text: `Command center snapshot (JSON, as of now):\n${JSON.stringify(snapshot || {}).slice(0, 150000)}` }, ...first.content];
  }
  return msgs;
}

export default async (req) => {
  if (!authorized(req)) return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { "content-type": "application/json" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 }); }
  const history = (Array.isArray(body.messages) ? body.messages : []).filter((m) => m && (m.role === "user" || m.role === "assistant")).slice(-30);
  if (!history.length || history[history.length - 1].role !== "user") return new Response(JSON.stringify({ error: "Ask something first" }), { status: 400 });

  const gwKey = process.env.NETLIFY_AI_GATEWAY_KEY, gwUrl = process.env.NETLIFY_AI_GATEWAY_URL;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        if (!process.env.ANTHROPIC_API_KEY && !(gwKey && gwUrl)) {
          send({ t: "error", d: "Claude isn't available right now: Netlify's AI Gateway is not supplying a key. Check that AI features are on and AI credits remain in your Netlify team, or add your own ANTHROPIC_API_KEY in Netlify." });
          return;
        }
        const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : new Anthropic({ apiKey: gwKey, baseURL: gwUrl });
        const store = getStore({ name: "pipeline", consistency: "strong" });
        const messages = toApiMessages(history, body.snapshot);
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          // Refusal fallbacks are not used here: Netlify's AI Gateway does not pass beta headers through.
          const s = client.messages.stream({ model: MODEL, max_tokens: 16000, system: SYSTEM, tools: TOOLS, messages });
          s.on("text", (d) => send({ t: "text", d }));
          s.on("streamEvent", (ev) => {
            if (ev.type === "content_block_start" && ev.content_block.type === "server_tool_use") send({ t: "status", d: "Searching the web…" });
          });
          const msg = await s.finalMessage();
          for (const b of msg.content) if (b.type === "server_tool_use" && b.input && b.input.query) send({ t: "tool", d: `Searched the web for "${b.input.query}"` });
          if (msg.stop_reason === "refusal") { send({ t: "text", d: "\n\nI can't help with that one." }); break; }
          if (msg.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: msg.content }); continue; }
          const uses = msg.content.filter((b) => b.type === "tool_use");
          if (msg.stop_reason !== "tool_use" || !uses.length) break;
          messages.push({ role: "assistant", content: msg.content });
          const results = [];
          for (const u of uses) {
            send({ t: "status", d: u.name === "app_search" ? "Looking through your records…" : "Updating your command center…" });
            const [text, summary] = await runTool(store, u.name, u.input).catch((e) => [JSON.stringify({ error: String(e.message || e) }), null]);
            if (summary) send({ t: "tool", d: summary, write: u.name !== "app_search" });
            results.push({ type: "tool_result", tool_use_id: u.id, content: text, ...(text.startsWith('{"error"') ? { is_error: true } : {}) });
          }
          messages.push({ role: "user", content: results });
        }
      } catch (e) {
        let msg = "Something went wrong reaching Claude. Try again.";
        if (e instanceof Anthropic.RateLimitError) msg = "Claude is busy right now. Try again in a minute.";
        else if (e instanceof Anthropic.AuthenticationError) msg = "The Claude key was rejected. Check AI features or ANTHROPIC_API_KEY in Netlify.";
        else if (e instanceof Anthropic.BadRequestError) msg = `Claude couldn't read that request: ${e.message}`;
        else if (e instanceof Anthropic.APIError) msg = `Claude error ${e.status}: ${e.message}`;
        send({ t: "error", d: msg });
      } finally {
        send({ t: "done" });
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
};

export const config = { path: "/api/chat" };
