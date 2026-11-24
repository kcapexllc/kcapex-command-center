// Stores chat attachments in Netlify Blobs so large files (solicitations, wage determinations,
// exhibits) can reach Claude. Phones send each file in pieces small enough for a function request;
// /api/chat puts the pieces back together when it builds the message for Claude.
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

const TYPES = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)$/;
const MAX_PARTS = 12; // 12 pieces of up to 4 MB (the app's PIECE): 48 MB, above what Claude accepts in one request anyway

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
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (!authorized(req)) return json({ error: "Not signed in" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "That piece of the file was too large." }, 413); }
  const total = Number(b.total), index = Number(b.index);
  if (!TYPES.test(b.type || "") || typeof b.data !== "string" || !Number.isInteger(total) || total < 1 || total > MAX_PARTS || !Number.isInteger(index) || index < 0 || index >= total)
    return json({ error: "Bad upload" }, 400);
  const id = index === 0 ? randomUUID() : String(b.id || "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Bad upload id" }, 400);
  const store = getStore({ name: "uploads", consistency: "strong" });
  await store.set(`${id}/${index}`, b.data);
  if (index === 0) await store.setJSON(`${id}/meta`, { name: String(b.name || "file").slice(0, 200), type: b.type, total, pages: Number(b.pages) || null, note: String(b.note || "").slice(0, 300), at: new Date().toISOString() });
  return json({ ok: true, id });
};

export const config = { path: "/api/upload" };
