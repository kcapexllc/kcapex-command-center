// Password gate for the whole site. The password lives in the Netlify
// environment variable APP_PASSWORD (Functions scope) — never in this repo.
import type { Config, Context } from "@netlify/edge-functions";

const COOKIE = "kc_auth";

async function token(password: string): Promise<string> {
  const data = new TextEncoder().encode(`kcapex-command-center:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const loginPage = (error = false) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0b1220" /><title>KCapex — Sign in</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1220; color: #e6edf7;
    font: 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; box-sizing: border-box; }
  form { width: 100%; max-width: 360px; background: #131f36; border: 1px solid #22355a; border-radius: 18px; padding: 28px 22px; }
  h1 { font-size: 20px; margin: 0 0 4px; } p { color: #8ea0bd; margin: 0 0 20px; font-size: 14px; }
  input { width: 100%; box-sizing: border-box; padding: 13px 14px; border-radius: 12px; border: 1px solid #22355a;
    background: #0f1a2e; color: inherit; font: inherit; outline: none; }
  input:focus { border-color: #4c8dff; }
  button { width: 100%; margin-top: 14px; padding: 13px; border: 0; border-radius: 12px; background: #f5b301;
    color: #1a1300; font: inherit; font-weight: 700; cursor: pointer; }
  .err { color: #ff5d5d; font-size: 14px; margin: 10px 0 0; }
  .mark { width: 48px; height: 48px; border-radius: 12px; background: #0f1a2e; border: 1px solid #22355a;
    display: grid; place-items: center; font-weight: 800; color: #f5b301; margin-bottom: 14px; }
</style></head>
<body><form method="post" action="/__login">
  <div class="mark">KC</div>
  <h1>KCapex Command Center</h1><p>Internal access only.</p>
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required />
  ${error ? '<div class="err">Incorrect password. Try again.</div>' : ""}
  <button type="submit">Sign in</button>
</form></body></html>`;

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export default async (req: Request, context: Context) => {
  const password = Netlify.env.get("APP_PASSWORD");
  if (!password) return html("<h1>Site locked</h1><p>APP_PASSWORD is not configured.</p>", 503);
  const expected = await token(password);
  const url = new URL(req.url);

  if (url.pathname === "/__login" && req.method === "POST") {
    const form = await req.formData();
    const given = await token(String(form.get("password") ?? ""));
    if (!safeEqual(given, expected)) return html(loginPage(true), 401);
    context.cookies.set({
      name: COOKIE, value: expected, path: "/", httpOnly: true, secure: true, sameSite: "Lax",
      expires: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    });
    return new Response(null, { status: 303, headers: { location: "/" } });
  }

  if (url.pathname === "/__logout") {
    context.cookies.delete({ name: COOKIE, path: "/" });
    return new Response(null, { status: 303, headers: { location: "/" } });
  }

  // The sync job (a scheduled Claude session) sends the password as a bearer token.
  const bearer = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  const bearerOk = !!bearer && safeEqual(await token(bearer[1].trim()), expected);
  const cookie = context.cookies.get(COOKIE) ?? "";
  if (bearerOk || safeEqual(cookie, expected)) {
    // Authorized. For HTML pages, strip the "Powered by Netlify" badge script
    // that Netlify injects on free-plan sites; everything else passes through.
    const res = await context.next();
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) return res;
    const body = (await res.text())
      .replace(/<script[^>]*\/\.netlify\/scripts\/hud[^>]*>\s*<\/script>/gi, "")
      .replace(/<!--\s*This site is hosted on Netlify[\s\S]*?-->/i, "");
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    headers.delete("etag");
    return new Response(body, { status: res.status, statusText: res.statusText, headers });
  }

  return html(loginPage(false), 401);
};

export const config: Config = { path: "/*" };
