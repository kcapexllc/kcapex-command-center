# KCapex Command Center

Internal GovCon dashboard for KCapex: **bids, leads, jobs, contracts and messages** in one place.
It is an installable web app (PWA), so it can sit on your phone's home screen like a native app and works offline.

## Features
- **Dashboard**: open pipeline (total and win-probability weighted), deadlines due in the next 7 days, backlog, win rate, open leads and messages that need a reply
- **Upcoming deadlines**: proposal due dates, lead follow-ups, job start and due dates, contract end dates
- **Bids**: GovCon pipeline stages (Identified → Qualifying → Capture → Proposal → Submitted → Won/Lost/No-Bid), set-aside, NAICS, solicitation #, value, Pwin, link
- **Leads, Jobs, Contracts, Inbox**: search, filter by status, add, edit and delete
- **Backup**: export and import JSON from Settings

Data is stored privately in the browser on each device. Export a backup to move it between devices.

## Run locally
```
python3 -m http.server 8000
# open http://localhost:8000
```

## Put it on your phone
1. Deploy the folder to any static host. Netlify works with the included `netlify.toml` (publish directory `.`).
2. **iPhone:** open the URL in Safari → Share → **Add to Home Screen**.
3. **Android:** open the URL in Chrome → ⋮ → **Install app**.

## Password gate (Netlify)
`netlify/edge-functions/auth.ts` puts a sign-in page in front of the whole site. The password is read from the
Netlify environment variable **`APP_PASSWORD`**, so it never lives in the repo. To change it:
Netlify → project → Site configuration → Environment variables → edit `APP_PASSWORD` → redeploy.
Changing it signs out every device. Settings → **Sign out** clears the gate on one device.
