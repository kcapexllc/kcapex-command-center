# KCAPEX Command Center

The KCAPEX Pipeline (bids, quick-turn, past bids, people, subs, library) as an installable phone app.
It is hosted on Netlify at https://kcapex-command-center.netlify.app behind a password.

## How it is built
- `index.html`, `styles.css` and `app.js` hold the Command Center dashboard (Home, Bids, Leads, Jobs, Contracts, Inbox, plus New, Quick-turn, People, Subs and Library under More), in purple.
- Bids, New, Quick-turn, People, Subs and Library read and write the KCAPEX Pipeline collections, which sync with Claude.
  Leads, Jobs, Contracts and Inbox are app-only collections, shared across devices.
- `netlify/functions/ask.mjs` powers Ask Claude through the Claude API (official SDK). The model defaults to `claude-opus-5-5`; set `CLAUDE_MODEL` in Netlify to change it. The key comes from Netlify's AI Gateway, or from an `ANTHROPIC_API_KEY` you set.
- `claude-shim.js` provides the database client (`window.claude.use('db')`), backed by `/api/db`.
- `netlify/functions/db.mjs` is the database: one Netlify Blobs entry per collection
  (Pipeline: opportunities, contacts, subs, pastperf, tasks, feeds, inbox, portals, settings; app-only: leads, jobs, contracts, messages).
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

## Ask Claude (chat)

`netlify/functions/chat.mjs` (`/api/chat`) streams Claude's answers as newline-delimited JSON. Claude gets a snapshot of the app, can search the web, read attached PDFs and photos, look up records (`app_search`), and, when asked, add notes, update a bid's status, price or due date, create tasks, add site visits and log invoices. Conversations are saved in the `chats` collection (shared across devices, not synced to the Pipeline). Keys come from Netlify's AI Gateway, or from the owners' own Anthropic key in `KC_ANTHROPIC_KEY` (billed by Anthropic, not Netlify credits) when set; `CLAUDE_MODEL` overrides the model.
