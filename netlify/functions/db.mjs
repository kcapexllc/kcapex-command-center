// Shared database for the KCAPEX Pipeline app, stored in Netlify Blobs.
// One blob per collection holds { id: doc }. The edge function in
// netlify/edge-functions/auth.ts gates every request; this function also
// checks the sign-in cookie itself so it is never reachable without it.
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

const COLLS = ["opportunities", "contacts", "subs", "pastperf", "tasks", "feeds", "inbox", "portals", "settings", "leads", "jobs", "contracts", "messages"];
const ID = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

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

const newRev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default async (req) => {
  if (!authorized(req)) return json({ error: "Not signed in" }, 401);
  const store = getStore({ name: "pipeline", consistency: "strong" });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const revs = {};
    await Promise.all(COLLS.map(async (c) => {
      const m = await store.getMetadata(c);
      revs[c] = (m && m.metadata && m.metadata.rev) || "0";
    }));
    const want = (url.searchParams.get("c") || "").split(",").filter((c) => COLLS.includes(c));
    const out = { revs };
    if (want.length) {
      out.collections = {};
      await Promise.all(want.map(async (c) => { out.collections[c] = (await store.get(c, { type: "json" })) || {}; }));
    }
    return json(out);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  // Bulk load of one collection (used to copy data in from the Claude artifact).
  if (b.op === "import") {
    if (!COLLS.includes(b.collection) || !b.docs || typeof b.docs !== "object") return json({ error: "Bad import" }, 400);
    const cur = (await store.get(b.collection, { type: "json" })) || {};
    if (Object.keys(cur).length && !b.replace) return json({ error: "Collection not empty; pass replace:true" }, 409);
    const rev = newRev();
    await store.setJSON(b.collection, b.docs, { metadata: { rev } });
    return json({ ok: true, rev, count: Object.keys(b.docs).length });
  }

  // Sync job: read or save the last-synced fingerprints (one blob, not a collection).
  if (b.op === "baseline-get") return json({ baseline: (await store.get("_baseline", { type: "json" })) || null });
  if (b.op === "baseline-set") {
    if (!b.baseline || typeof b.baseline !== "object") return json({ error: "Bad baseline" }, 400);
    await store.setJSON("_baseline", b.baseline);
    return json({ ok: true });
  }

  // Sync job: apply many sets and deletes to one collection in a single write.
  if (b.op === "merge") {
    if (!COLLS.includes(b.collection)) return json({ error: "Bad collection" }, 400);
    const set = b.set && typeof b.set === "object" ? b.set : {};
    const del = Array.isArray(b.del) ? b.del : [];
    if ([...Object.keys(set), ...del].some((id) => !ID.test(String(id)))) return json({ error: "Bad id" }, 400);
    const cur = (await store.get(b.collection, { type: "json" })) || {};
    for (const [id, doc] of Object.entries(set)) cur[id] = doc;
    for (const id of del) delete cur[id];
    const rev = newRev();
    await store.setJSON(b.collection, cur, { metadata: { rev } });
    return json({ ok: true, rev, set: Object.keys(set).length, del: del.length });
  }

  const [c, id, extra] = String(b.path || "").split("/");
  if (!COLLS.includes(c) || !ID.test(id || "") || extra !== undefined) return json({ error: "Bad path" }, 400);
  const cur = (await store.get(c, { type: "json" })) || {};
  if (b.op === "set") {
    if (!b.body || typeof b.body !== "object" || Array.isArray(b.body)) return json({ error: "Bad body" }, 400);
    cur[id] = b.body;
  } else if (b.op === "delete") {
    delete cur[id];
  } else {
    return json({ error: "Unknown op" }, 400);
  }
  const rev = newRev();
  await store.setJSON(c, cur, { metadata: { rev } });
  return json({ ok: true, rev });
};

export const config = { path: "/api/db" };
