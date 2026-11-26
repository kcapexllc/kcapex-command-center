// Streams a Claude answer (newline-delimited JSON). Netlify ends a request at about 30 seconds, so this
// stops at 25 and sends "cont"; long answers go through chat-background instead.
import { authorized, runChat } from "../lib/chat-core.mjs";

export default async (req) => {
  if (!authorized(req)) return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { "content-type": "application/json" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 }); }
  const enc = new TextEncoder(), started = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      await runChat(body, (o) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n")), started + 25000);
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
};

export const config = { path: "/api/chat" };
