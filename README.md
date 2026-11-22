# KCAPEX Command Center

The KCAPEX Pipeline (bids, quick-turn, past bids, people, subs, library) as an installable phone app.
It is hosted on Netlify at https://kcapex-command-center.netlify.app behind a password.

## How it is built
- `index.html` is the KCAPEX Pipeline page from Claude, plus phone-app tags (manifest, icons, service worker).
- `claude-shim.js` stands in for the Claude artifact runtime. Its database calls go to `/api/db`.
  Claude-only features (AI drafting and scoring, Tango pulls for the New tab) are hidden.
- `netlify/functions/db.mjs` is the database: one Netlify Blobs entry per collection
  (opportunities, contacts, subs, pastperf, tasks, feeds, inbox, portals, settings).
- `netlify/edge-functions/auth.ts` is the password gate. The password is the Netlify environment variable `APP_PASSWORD`.
  It also strips Netlify's free-plan badge script from pages.
- `sw.js` caches the app shell for offline use. It never caches `/api/` data calls.

Records live in Netlify Blobs, not in this repo.

## Install on a phone
- **iPhone:** open the site in Safari, sign in, then Share → Add to Home Screen. Sign in once more inside the app.
- **Android:** open it in Chrome, sign in, then ⋮ → Install app.

## Password
To change it: Netlify → project → Site configuration → Environment variables → edit `APP_PASSWORD` → redeploy.
Changing it signs out every device. To sign out one device, visit `/__logout`.
