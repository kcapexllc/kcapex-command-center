// Progress of a background Claude answer (see chat-background).
import { getStore } from "@netlify/blobs";
import { authorized } from "../lib/chat-core.mjs";

export default async (req) => {
  if (!authorized(req)) return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { "content-type": "application/json" } });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-z0-9]{8,40}$/.test(id)) return new Response(JSON.stringify({ error: "Bad id" }), { status: 400 });
  // POST ?id=…&cancel=1: the app's Stop button. The background answer checks this before each step.
  if (req.method === "POST" && new URL(req.url).searchParams.get("cancel")) { await getStore({ name: "jobs", consistency: "strong" }).set(id + "-cancel", "1"); return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }); }
  const j = await getStore({ name: "jobs", consistency: "strong" }).get(id);
  return new Response(j || JSON.stringify({ pending: true }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
};

export const config = { path: "/api/job" };
