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

## Sync with the Pipeline in Claude
The scheduled task "KCAPEX app sync" runs every 2 hours, 6:25 AM to 10:25 PM Central. It runs `scripts/sync.mjs`, which the session downloads from the app.
- The session exports the artifact database with ArtifactData, then runs `node sync.mjs plan EXPORT WORK`. That writes artifact-side changes into the app and lists the app-side changes the session writes back to the artifact.
- For each record it compares the artifact copy, the app copy and the last-synced fingerprint (stored in Blobs as `_baseline`). The side that changed wins. If both changed, the newer `updatedAt` wins.
- It refuses to run if an export looks incomplete, so a failed list can never wipe records.
- Auth: the cloud environment holds the app password as a network secret for this host. The proxy sends it as `Authorization: Bearer`, which the edge function and `/api/db` accept.

## Install on a phone
- **iPhone:** open the site in Safari, sign in, then Share → Add to Home Screen. Sign in once more inside the app.
- **Android:** open it in Chrome, sign in, then ⋮ → Install app.

## Password
To change it: Netlify → project → Site configuration → Environment variables → edit `APP_PASSWORD` → redeploy.
Changing it signs out every device. To sign out one device, visit `/__logout`.
