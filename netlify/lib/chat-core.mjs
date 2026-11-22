// Shared by /api/chat (streamed) and chat-background (long answers). Claude chat for the KCAPEX Command Center: streams replies, can search the web, read
// attached PDFs and photos, look up records in the app, and make a small set of changes
// in the app (notes, bid status and price, tasks, site visits, invoices) when asked.
// Credentials come from Netlify's AI Gateway (or an ANTHROPIC_API_KEY set in Netlify).
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

// Sonnet keeps the cost per question low; set CLAUDE_MODEL in Netlify to use another model.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const MAX_TURNS = 8;
const STATUSES = ["found", "reviewing", "bid", "submitted", "awarded", "lost", "no-bid", "cancelled"];
const COLL = { bids: "opportunities", new_opportunities: "inbox", contracts: "contracts", invoices: "invoices", contacts: "contacts", subs: "subs", past_performance: "pastperf", tasks: "tasks", site_visits: "visits", messages: "messages", leads: "leads", jobs: "jobs" };

export function authorized(req) {
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
If the newest message is exactly "[continue]", your previous answer was stopped by a time limit, possibly mid-sentence: carry on from the exact point it stopped, with no preamble and no repetition.
Attached files stay with the conversation. When working from a solicitation package, be specific: cite the document and page or section, and pull out due dates and times, submission method and address, questions deadline, site visit, set-aside and NAICS, period of performance, CLINs and the price breakout, wage determination rates that drive labor cost, evaluation basis, required forms and past performance requirements, and anything that would stop KCAPEX from bidding. Long PDFs and Word files arrive as extracted text, so tables may be flattened: read them carefully and say when a value is uncertain.
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

// Loads an attachment that /api/upload stored in pieces.
async function loadUpload(uploads, id) {
  if (!/^[0-9a-f-]{36}$/.test(String(id || ""))) return null;
  const meta = await uploads.get(`${id}/meta`, { type: "json" });
  if (!meta) return null;
  const parts = await Promise.all(Array.from({ length: meta.total }, (_, i) => uploads.get(`${id}/${i}`)));
  if (parts.some((x) => typeof x !== "string")) return null;
  return { ...meta, data: parts.join("") };
}

// Turns the app's chat history into API messages. Files stay with the conversation (like the Claude app),
// newest first, until the per-request budget runs out; older ones are then named only.
const BIN_BUDGET = 22 * 1024 * 1024, TEXT_BUDGET = 500000, PAGE_BUDGET = 100, IMAGE_BUDGET = 40;
async function toApiMessages(history, snapshot, uploads, project) {
  let bin = 0, txt = 0, pdfPages = 0, imgs = 0, lastFileBlock = null;
  const built = [];
  // A chat inside a project (like Claude Projects) always carries the project's files and instructions.
  // They go first, so they win the size budget over files attached in individual messages.
  const projBlocks = [], projSkipped = [];
  if (project && typeof project === "object") {
    for (const ref of (Array.isArray(project.fileRefs) ? project.fileRefs : []).slice(0, 15)) {
      const f = uploads ? await loadUpload(uploads, ref && ref.id).catch(() => null) : null;
      if (!f) { if (ref && ref.name) projSkipped.push(ref.name); continue; }
      const title = String(f.name || "file").slice(0, 200); let block = null;
      if (f.type === "text/plain") { if (txt + f.data.length <= TEXT_BUDGET) { txt += f.data.length; block = { type: "document", source: { type: "text", media_type: "text/plain", data: f.data }, title, ...(f.note ? { context: f.note } : {}) }; } }
      else if (bin + f.data.length <= BIN_BUDGET) {
        if (f.type === "application/pdf" && pdfPages + (f.pages || 10) <= PAGE_BUDGET) { pdfPages += f.pages || 10; bin += f.data.length; block = { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data }, title }; }
        else if (/^image\/(png|jpeg|gif|webp)$/.test(f.type) && imgs < IMAGE_BUDGET) { imgs++; bin += f.data.length; block = { type: "image", source: { type: "base64", media_type: f.type, data: f.data } }; }
      }
      if (block) projBlocks.push(block); else projSkipped.push(title);
    }
    if (projBlocks.length) projBlocks[projBlocks.length - 1].cache_control = { type: "ephemeral" };
    const s = (v, n) => String(v || "").slice(0, n);
    projBlocks.push({ type: "text", text: `This chat is in the project "${s(project.name, 200)}".${project.description ? ` About: ${s(project.description, 500)}.` : ""}${project.bidId ? ` Linked bid id in the app: ${s(project.bidId, 80)}.` : ""}${projBlocks.length ? " The documents above are the project's files." : ""}${projSkipped.length ? ` Not included this time (size limits): ${projSkipped.join(", ")}.` : ""}${project.instructions ? `\nProject instructions from the owners:\n${s(project.instructions, 8000)}` : ""}` });
  }
  for (let k = history.length - 1; k >= 0; k--) {
    const m = history[k];
    if (m.role === "assistant") { if (m.text) built.unshift({ role: "assistant", content: m.text }); continue; }
    const content = [], skipped = [];
    const files = [...(Array.isArray(m.files) ? m.files : [])];
    for (const ref of Array.isArray(m.fileRefs) ? m.fileRefs : []) {
      const f = uploads ? await loadUpload(uploads, ref && ref.id).catch(() => null) : null;
      if (f) files.push(f); else if (ref && ref.name) skipped.push(ref.name);
    }
    for (const f of files) {
      if (!f || typeof f.data !== "string") continue;
      const title = String(f.name || "file").slice(0, 200);
      let block = null;
      if (f.type === "text/plain") {
        if (txt + f.data.length <= TEXT_BUDGET) { txt += f.data.length; block = { type: "document", source: { type: "text", media_type: "text/plain", data: f.data }, title, ...(f.note ? { context: f.note } : {}) }; }
      } else if (bin + f.data.length <= BIN_BUDGET) {
        // Claude reads up to about 100 PDF pages per request; photos are capped too.
        if (f.type === "application/pdf" && pdfPages + (f.pages || 10) <= PAGE_BUDGET) { pdfPages += f.pages || 10; bin += f.data.length; block = { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data }, title }; }
        else if (/^image\/(png|jpeg|gif|webp)$/.test(f.type) && imgs < IMAGE_BUDGET) { imgs++; bin += f.data.length; block = { type: "image", source: { type: "base64", media_type: f.type, data: f.data } }; }
      }
      if (block) { content.push(block); if (!lastFileBlock) lastFileBlock = block; } else skipped.push(title);
    }
    const names = (Array.isArray(m.fileNames) ? m.fileNames : []).filter(Boolean);
    let text = m.text || "";
    if (skipped.length) text += `\n\n(Attached earlier but not included this time, to stay within limits: ${skipped.join(", ")}. Ask me to re-attach if you need them.)`;
    else if (names.length && !files.length) text += `\n\n(Earlier in this chat I attached: ${names.join(", ")}.)`;
    content.push({ type: "text", text: text || "(attachment)" });
    built.unshift({ role: "user", content });
  }
  // The files in the newest message carrying any are cached, so follow-up questions re-read them cheaply.
  if (lastFileBlock) lastFileBlock.cache_control = { type: "ephemeral" };
  while (built.length && built[0].role !== "user") built.shift();
  if (built.length) {
    const first = built[0];
    // Cached so the extra steps of one answer (searches, lookups) re-read it at a fraction of the price.
    first.content = [{ type: "text", text: `Command center snapshot (JSON, as of now):\n${JSON.stringify(snapshot || {}).slice(0, 40000)}`, cache_control: { type: "ephemeral" } }, ...projBlocks, ...first.content];
  }
  return built;
}

// Runs one Claude answer. send() receives events: text, status, tool, error, cont, done.
// deadline: stop cleanly at this time (ms epoch) and send "cont"; background runs pass Infinity.
export async function runChat(body, send, deadline = Infinity) {
  const history = (Array.isArray(body && body.messages) ? body.messages : []).filter((m) => m && (m.role === "user" || m.role === "assistant")).slice(-30);
  // KC_ANTHROPIC_KEY is the owners' own Anthropic key: billed by Anthropic directly instead of Netlify credits.
  const ownKey = process.env.KC_ANTHROPIC_KEY, gwKey = process.env.NETLIFY_AI_GATEWAY_KEY, gwUrl = process.env.NETLIFY_AI_GATEWAY_URL;
  try {
    if (!history.length || history[history.length - 1].role !== "user") { send({ t: "error", d: "Ask something first." }); return; }
    if (!ownKey && !process.env.ANTHROPIC_API_KEY && !(gwKey && gwUrl)) {
      send({ t: "error", d: "Claude isn't available right now: no Claude key. Add your Anthropic key as KC_ANTHROPIC_KEY in Netlify." });
      return;
    }
    const client = ownKey ? new Anthropic({ apiKey: ownKey, baseURL: "https://api.anthropic.com" }) : process.env.ANTHROPIC_API_KEY ? new Anthropic() : new Anthropic({ apiKey: gwKey, baseURL: gwUrl });
    const store = getStore({ name: "pipeline", consistency: "strong" });
    send({ t: "status", d: history.some((m) => (m.fileRefs || []).length) || (body.project && (body.project.fileRefs || []).length) ? "Reading your files…" : "Thinking…" });
    const messages = await toApiMessages(history, body.snapshot, getStore({ name: "uploads", consistency: "strong" }), body.project);
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (deadline - Date.now() < 2500) { send({ t: "cont" }); return; }
      // Refusal fallbacks are not used here: Netlify's AI Gateway does not pass beta headers through.
      const s = client.messages.stream({ model: MODEL, max_tokens: 16000, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], tools: TOOLS, messages });
      s.on("text", (d) => send({ t: "text", d }));
      s.on("streamEvent", (ev) => {
        if (ev.type !== "content_block_start") return;
        if (ev.content_block.type === "server_tool_use") send({ t: "status", d: "Searching the web…" });
        else if (ev.content_block.type === "thinking") send({ t: "status", d: "Thinking it through…" });
      });
      let timedOut = false;
      const timer = deadline === Infinity ? null : setTimeout(() => { timedOut = true; s.abort(); }, deadline - Date.now());
      let msg;
      try { msg = await s.finalMessage(); } catch (e) { if (!timedOut) throw e; } finally { if (timer) clearTimeout(timer); }
      if (timedOut) { send({ t: "cont" }); return; }
      for (const b of msg.content) if (b.type === "server_tool_use" && b.input && b.input.query) send({ t: "tool", d: `Searched the web for "${b.input.query}"` });
      if (msg.stop_reason === "refusal") { send({ t: "text", d: "\n\nI can't help with that one." }); break; }
      if (msg.stop_reason === "max_tokens") { send({ t: "text", d: "\n\n(That's as long as one answer can go. Ask me to continue.)" }); break; }
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
    else if (e instanceof Anthropic.AuthenticationError) msg = "The Claude key was rejected. Check KC_ANTHROPIC_KEY in Netlify.";
    else if (e instanceof Anthropic.BadRequestError) msg = `Claude couldn't read that request: ${e.message}`;
    else if (e instanceof Anthropic.APIError) msg = `Claude error ${e.status}: ${e.message}`;
    send({ t: "error", d: msg });
  } finally {
    send({ t: "done" });
  }
}
