// Runs a Claude answer in the background (Netlify allows up to 15 minutes), so big solicitation packages
// and long answers aren't cut off at 30 seconds. Progress is written to the "jobs" blob store about twice a
// second; the app reads it from /api/job.
import { getStore } from "@netlify/blobs";
import { authorized, runChat } from "../lib/chat-core.mjs";

export default async (req) => {
  if (!authorized(req) || req.method !== "POST") return;
  let body;
  try { body = await req.json(); } catch { return; }
  const id = String(body.jobId || "");
  if (!/^[a-z0-9]{8,40}$/.test(id)) return;
  const jobs = getStore({ name: "jobs", consistency: "strong" });
  const state = { text: "", tools: [], status: "Thinking…", error: "", done: false, updated: Date.now() };
  let timer = null, writing = Promise.resolve();
  const flush = () => { timer = null; state.updated = Date.now(); const snap = JSON.stringify(state); writing = writing.then(() => jobs.set(id, snap)).catch(() => {}); return writing; };
  const later = () => { if (!timer) timer = setTimeout(flush, 250); };
  await flush();
  await runChat(body, (ev) => {
    if (ev.t === "text") state.text += ev.d;
    else if (ev.t === "status") state.status = ev.d;
    else if (ev.t === "tool") state.tools.push({ d: ev.d, write: !!ev.write });
    else if (ev.t === "error") state.error = ev.d;
    else if (ev.t === "done") state.done = true;
    later();
  });
  if (timer) clearTimeout(timer);
  await flush();
};
