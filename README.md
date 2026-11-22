# KCAPEX Command Center

Private GovCon dashboard for KCAPEX LLC. Installs to a phone home screen and
gives Claude a connector to read and update the same data.

## Screens
Today, Pipeline, Subs, Outreach, Contracts, Invoices, Price intel, Hours, Settings.

## How it runs
- `app.py` is the server (Flask). `schema.py` lists every screen and field.
- `static/` is the app the phone loads.
- `render.yaml` tells Render to create one web service and one Postgres database.
- Company data never lives in this code. Starting records can be loaded once,
  into an empty database, from a private `SEED_JSON` setting on Render.

## Signing in
The first person to open a new deployment chooses the password. Change it
later in Settings.

## Settings Render needs
| Name | What it is |
| --- | --- |
| `SECRET_KEY` | Keeps sign-ins valid. Render generates it. |
| `MCP_TOKEN` | Secret part of the Claude connector address. Render generates it. |
| `DATABASE_URL` | Filled in by Render from the database. |

## Run it on a computer
```
pip install flask
MCP_TOKEN=any-secret python app.py
```
Open http://127.0.0.1:5050. Without `DATABASE_URL` it saves to `local.db`.

## Change what it tracks
Edit `schema.py`. Add a field to a list or add a new collection. The forms,
lists and the Claude connector pick it up on the next deploy.
