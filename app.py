"""KCAPEX Command Center: a private dashboard with a Claude connector.

Runs on Postgres when DATABASE_URL is set (Render) and on a local SQLite
file otherwise (testing on a laptop).
"""
import datetime as dt
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from functools import wraps

from flask import Flask, Response, g, jsonify, request, send_from_directory, session
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

from schema import COLLECTIONS, OPEN_STAGES, field_map

HERE = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
SQLITE_PATH = os.environ.get("SQLITE_PATH", os.path.join(HERE, "local.db"))
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")
MCP_TOKEN = os.environ.get("MCP_TOKEN", "")
ON_RENDER = bool(os.environ.get("RENDER"))

app = Flask(__name__, static_folder=os.path.join(HERE, "static"), static_url_path="")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.json.sort_keys = False  # keep the screens in the order schema.py lists them
app.config.update(
    SESSION_COOKIE_NAME="kc_session",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=ON_RENDER,
    PERMANENT_SESSION_LIFETIME=dt.timedelta(days=60),
    SEND_FILE_MAX_AGE_DEFAULT=0,
    MAX_CONTENT_LENGTH=8 * 1024 * 1024,
)


# ---------------------------------------------------------------- database

def get_db():
    if "db" not in g:
        if DATABASE_URL:
            import psycopg2  # only needed in production

            conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
            conn.autocommit = True
        else:
            conn = sqlite3.connect(SQLITE_PATH, isolation_level=None)
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass


def run(sql, params=(), fetch=False):
    """Run one statement. SQL is written with ? placeholders for both databases."""
    if DATABASE_URL:
        sql = sql.replace("?", "%s")
    cur = get_db().cursor()
    try:
        if params:
            cur.execute(sql, tuple(params))
        else:
            cur.execute(sql)
        return cur.fetchall() if fetch else None
    finally:
        cur.close()


_ready = False


def ensure_db():
    global _ready
    if _ready:
        return
    run("CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, collection TEXT NOT NULL, "
        "data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)")
    run("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    if get_setting("seeded") is None:
        seed = load_seed()
        count = run("SELECT COUNT(*) FROM records", fetch=True)[0][0]
        if seed and count == 0:
            for collection, items in seed.items():
                if collection == "goals":
                    save_goals(items)
                    continue
                if collection not in COLLECTIONS:
                    continue
                for item in items:
                    try:
                        create_record(collection, item, stamp=False)
                    except ValueError as err:
                        app.logger.warning("starting data skipped in %s: %s", collection, err)
        if seed or count:
            set_setting("seeded", now_iso())
    _ready = True


def load_seed():
    """Starting data. Kept out of the code: it comes from the SEED_JSON setting or a local seed.json."""
    raw = os.environ.get("SEED_JSON", "").strip()
    path = os.path.join(HERE, "seed.json")
    try:
        if raw:
            return json.loads(raw)
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
    except ValueError as err:
        app.logger.error("starting data is not valid JSON: %s", err)
    return None


def get_goals():
    raw = get_setting("goals")
    return json.loads(raw) if raw else None


def save_goals(body):
    goals = {}
    for key, label in (("revenue", "Revenue goal"), ("bids_per_month", "Bids per month"), ("win_rate", "Win rate")):
        try:
            value = float(str((body or {}).get(key, "")).replace("$", "").replace(",", "").replace("%", ""))
        except ValueError:
            raise ValueError("%s must be a number" % label)
        if value <= 0:
            raise ValueError("%s must be more than zero" % label)
        goals[key] = int(value) if value == int(value) else value
    set_setting("goals", json.dumps(goals))
    return goals


def fiscal_year():
    """The federal fiscal year starts 1 October."""
    today = dt.date.today()
    start_year = today.year if today.month >= 10 else today.year - 1
    return {"label": "FY%02d" % ((start_year + 1) % 100), "start": "%d-10-01" % start_year}


def get_setting(key):
    rows = run("SELECT value FROM settings WHERE key = ?", (key,), fetch=True)
    return rows[0][0] if rows else None


def set_setting(key, value):
    run("DELETE FROM settings WHERE key = ?", (key,))
    run("INSERT INTO settings (key, value) VALUES (?, ?)", (key, value))


def now_iso():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ----------------------------------------------------------------- records

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")


def clean(collection, data, creating):
    """Check and tidy incoming fields. Raises ValueError with a plain message."""
    if not isinstance(data, dict):
        raise ValueError("data must be an object of field names and values")
    fields = field_map(collection)
    unknown = [k for k in data if k not in fields]
    if unknown:
        raise ValueError("Unknown field(s) for %s: %s. Valid fields: %s"
                         % (collection, ", ".join(unknown), ", ".join(fields)))
    out = {}
    for key, value in data.items():
        spec = fields[key]
        kind = spec["type"]
        label = spec["label"]
        if isinstance(value, str):
            value = value.strip()
        if value in ("", None):
            out[key] = None
        elif kind in ("money", "number"):
            try:
                number = float(str(value).replace("$", "").replace(",", ""))
            except ValueError:
                raise ValueError("%s must be a number" % label)
            out[key] = int(number) if number == int(number) else round(number, 2)
        elif kind == "checkbox":
            out[key] = value is True or str(value).lower() in ("true", "1", "yes", "on")
        elif kind == "select":
            match = [o for o in spec["options"] if o.lower() == str(value).lower()]
            if not match:
                raise ValueError("%s must be one of: %s" % (label, ", ".join(spec["options"])))
            out[key] = match[0]
        elif kind == "date":
            if not DATE_RE.match(str(value)):
                raise ValueError("%s must be a date like 2026-12-01" % label)
            out[key] = str(value)
        elif kind == "datetime":
            if DATE_RE.match(str(value)):
                value = str(value) + "T17:00"
            if not DATETIME_RE.match(str(value)):
                raise ValueError("%s must be a date and time like 2026-12-01T13:00" % label)
            out[key] = str(value)[:16]
        else:
            out[key] = str(value)[: 20000 if kind == "textarea" else 2000]
        if spec.get("required") and out[key] in (None, ""):
            raise ValueError("%s is required" % label)
    if creating:
        today = dt.date.today().isoformat()
        for key, spec in fields.items():
            if out.get(key) is None and spec.get("default"):
                out[key] = today if spec["default"] == "today" else spec["default"]
            if spec.get("required") and out.get(key) in (None, ""):
                raise ValueError("%s is required" % spec["label"])
    return out


def to_record(row):
    return {"id": row[0], "collection": row[1], "data": json.loads(row[2]),
            "created_at": row[3], "updated_at": row[4]}


def all_records(collection=None):
    if collection:
        rows = run("SELECT id, collection, data, created_at, updated_at FROM records "
                   "WHERE collection = ? ORDER BY updated_at DESC", (collection,), fetch=True)
    else:
        rows = run("SELECT id, collection, data, created_at, updated_at FROM records "
                   "ORDER BY updated_at DESC", fetch=True)
    return [to_record(r) for r in rows]


def get_record(collection, record_id):
    rows = run("SELECT id, collection, data, created_at, updated_at FROM records "
               "WHERE id = ? AND collection = ?", (record_id, collection), fetch=True)
    return to_record(rows[0]) if rows else None


def stamp_submitted(collection, data):
    if collection == "opportunities" and data.get("stage") == "Submitted" and not data.get("submitted_on"):
        data["submitted_on"] = dt.date.today().isoformat()


def create_record(collection, data, stamp=True):
    data = {k: v for k, v in clean(collection, data, creating=True).items() if v is not None}
    if stamp:
        stamp_submitted(collection, data)
    record_id = uuid.uuid4().hex[:12]
    stamp = now_iso()
    run("INSERT INTO records (id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (record_id, collection, json.dumps(data), stamp, stamp))
    return {"id": record_id, "collection": collection, "data": data,
            "created_at": stamp, "updated_at": stamp}


def update_record(collection, record_id, changes):
    record = get_record(collection, record_id)
    if record is None:
        return None
    merged = dict(record["data"])
    for key, value in clean(collection, changes, creating=False).items():
        if value is None:
            merged.pop(key, None)
        else:
            merged[key] = value
    if "stage" in changes:
        stamp_submitted(collection, merged)
    stamp = now_iso()
    run("UPDATE records SET data = ?, updated_at = ? WHERE id = ? AND collection = ?",
        (json.dumps(merged), stamp, record_id, collection))
    record.update(data=merged, updated_at=stamp)
    return record


def delete_record(collection, record_id):
    if get_record(collection, record_id) is None:
        return False
    run("DELETE FROM records WHERE id = ? AND collection = ?", (record_id, collection))
    return True


def overview():
    by = {name: [] for name in COLLECTIONS}
    for record in all_records():
        by.setdefault(record["collection"], []).append(record)

    def total(records, key):
        return round(sum((r["data"].get(key) or 0) for r in records), 2)

    bids = by["opportunities"]
    open_bids = [b for b in bids if b["data"].get("stage") in OPEN_STAGES]
    submitted = [b for b in bids if b["data"].get("stage") == "Submitted"]
    active = [c for c in by["contracts"] if c["data"].get("status") in ("Active", "Awaiting start")]
    unpaid = [i for i in by["invoices"] if i["data"].get("status") == "Submitted"]
    due = sorted((b for b in open_bids if b["data"].get("due")), key=lambda b: b["data"]["due"])
    stages = {}
    for bid in bids:
        stage = bid["data"].get("stage") or "New"
        stages[stage] = stages.get(stage, 0) + 1
    return {
        "counts": {name: len(items) for name, items in by.items()},
        "pipeline_by_stage": stages,
        "open_bids": {"count": len(open_bids), "value": total(open_bids, "our_price")},
        "awaiting_award": {"count": len(submitted), "value": total(submitted, "our_price")},
        "active_contracts": {"count": len(active), "value": total(active, "value")},
        "unpaid_invoices": {"count": len(unpaid), "value": total(unpaid, "amount")},
        "goals": get_goals(),
        "fiscal_year": fiscal_year(),
        "next_deadlines": [{"id": b["id"], "title": b["data"].get("title"), "due": b["data"]["due"],
                            "stage": b["data"].get("stage")} for b in due[:10]],
    }


# -------------------------------------------------------------------- auth

_attempts = {}


def too_many_attempts(ip):
    recent = [t for t in _attempts.get(ip, []) if time.time() - t < 600]
    _attempts[ip] = recent
    return len(recent) >= 8


def password_ok(candidate):
    stored = get_setting("password_hash")
    if stored:
        return check_password_hash(stored, candidate)
    if APP_PASSWORD:
        return hmac.compare_digest(APP_PASSWORD.encode(), candidate.encode())
    return False


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("ok"):
            return jsonify(error="Sign in first."), 401
        if request.method != "GET" and request.headers.get("X-KC") != "1":
            return jsonify(error="Request blocked."), 403
        return view(*args, **kwargs)
    return wrapped


@app.before_request
def prepare():
    if request.path.startswith("/api/") or request.path.startswith("/mcp/"):
        try:
            ensure_db()
        except Exception as err:  # database still starting, or unreachable
            app.logger.error("database not ready: %s", err)
            return jsonify(error="The database is starting up. Try again in a moment."), 503


@app.after_request
def harden(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    if request.path.startswith("/api/") or request.path.startswith("/mcp/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/healthz")
def healthz():
    return "ok"


@app.get("/api/session")
def api_session():
    configured = bool(APP_PASSWORD or get_setting("password_hash"))
    return jsonify(authed=bool(session.get("ok")), configured=configured)


@app.post("/api/login")
def api_login():
    ip = request.remote_addr or "?"
    if too_many_attempts(ip):
        return jsonify(error="Too many tries. Wait ten minutes and try again."), 429
    body = request.get_json(silent=True) or {}
    if password_ok(str(body.get("password", ""))):
        session.clear()
        session["ok"] = True
        session.permanent = True
        return jsonify(ok=True)
    _attempts.setdefault(ip, []).append(time.time())
    return jsonify(error="That password is not right."), 401


@app.post("/api/setup")
def api_setup():
    """First visit only: whoever opens the empty app chooses its password."""
    if APP_PASSWORD or get_setting("password_hash"):
        return jsonify(error="A password is already set. Sign in instead."), 403
    new = str((request.get_json(silent=True) or {}).get("password", ""))
    if len(new) < 10:
        return jsonify(error="Use at least 10 characters."), 400
    set_setting("password_hash", generate_password_hash(new))
    session.clear()
    session["ok"] = True
    session.permanent = True
    return jsonify(ok=True)


@app.post("/api/logout")
def api_logout():
    session.clear()
    return jsonify(ok=True)


@app.post("/api/password")
@login_required
def api_password():
    body = request.get_json(silent=True) or {}
    if not password_ok(str(body.get("current", ""))):
        return jsonify(error="The current password is not right."), 400
    new = str(body.get("new", ""))
    if len(new) < 10:
        return jsonify(error="Use at least 10 characters."), 400
    set_setting("password_hash", generate_password_hash(new))
    return jsonify(ok=True)


# --------------------------------------------------------------------- api

@app.get("/api/bootstrap")
@login_required
def api_bootstrap():
    grouped = {name: [] for name in COLLECTIONS}
    for record in all_records():
        if record["collection"] in grouped:
            grouped[record["collection"]].append(record)
    connector = None
    if MCP_TOKEN:
        connector = request.host_url.rstrip("/") + "/mcp/" + MCP_TOKEN
    return jsonify(schema=COLLECTIONS, open_stages=OPEN_STAGES, goals=get_goals(), fiscal_year=fiscal_year(),
                   records=grouped, connector=connector)


@app.post("/api/records/<collection>")
@login_required
def api_create(collection):
    if collection not in COLLECTIONS:
        return jsonify(error="No such list."), 404
    try:
        return jsonify(create_record(collection, request.get_json(silent=True) or {}))
    except ValueError as err:
        return jsonify(error=str(err)), 400


@app.put("/api/records/<collection>/<record_id>")
@login_required
def api_update(collection, record_id):
    if collection not in COLLECTIONS:
        return jsonify(error="No such list."), 404
    try:
        record = update_record(collection, record_id, request.get_json(silent=True) or {})
    except ValueError as err:
        return jsonify(error=str(err)), 400
    if record is None:
        return jsonify(error="That item was already deleted."), 404
    return jsonify(record)


@app.delete("/api/records/<collection>/<record_id>")
@login_required
def api_delete(collection, record_id):
    if collection not in COLLECTIONS or not delete_record(collection, record_id):
        return jsonify(error="That item was already deleted."), 404
    return jsonify(ok=True)


@app.post("/api/goals")
@login_required
def api_goals():
    try:
        return jsonify(save_goals(request.get_json(silent=True) or {}))
    except ValueError as err:
        return jsonify(error=str(err)), 400


@app.get("/api/export")
@login_required
def api_export():
    payload = {"exported_at": now_iso(), "goals": get_goals(), "records": all_records()}
    name = "kcapex-command-center-%s.json" % dt.date.today().isoformat()
    return Response(json.dumps(payload, indent=1), mimetype="application/json",
                    headers={"Content-Disposition": 'attachment; filename="%s"' % name})


@app.post("/api/import")
@login_required
def api_import():
    body = request.get_json(silent=True) or {}
    items = body.get("records")
    if not isinstance(items, list):
        return jsonify(error="That file is not a command center backup."), 400
    if isinstance(body.get("goals"), dict) and get_goals() is None:
        try:
            save_goals(body["goals"])
        except ValueError:
            pass
    added = skipped = 0
    for item in items:
        collection = (item or {}).get("collection")
        record_id = str((item or {}).get("id") or "")
        if collection not in COLLECTIONS or not record_id:
            skipped += 1
            continue
        if get_record(collection, record_id):
            skipped += 1
            continue
        try:
            data = {k: v for k, v in clean(collection, item.get("data") or {}, creating=True).items()
                    if v is not None}
        except ValueError:
            skipped += 1
            continue
        stamp = now_iso()
        run("INSERT INTO records (id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (record_id[:40], collection, json.dumps(data), item.get("created_at") or stamp,
             item.get("updated_at") or stamp))
        added += 1
    return jsonify(added=added, skipped=skipped)


# ------------------------------------------------------- Claude connector

MCP_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]
COLLECTION_NAMES = list(COLLECTIONS)


def describe_collections():
    out = {}
    for name, spec in COLLECTIONS.items():
        out[name] = {"shown_in_app_as": spec["label"], "fields": [
            {k: f[k] for k in ("key", "label", "type", "options", "required") if k in f}
            for f in spec["fields"]]}
    return out


MCP_TOOLS = [
    {"name": "get_overview",
     "description": "Summary of the KCAPEX Command Center: counts for every list, the pipeline by stage, "
                    "next quote deadlines, active contract value and unpaid invoices. Start here.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "describe_collections",
     "description": "The lists the command center keeps (opportunities, subs, outreach, contracts, invoices, "
                    "price_intel, hours) with every field name, type and allowed option. Call before writing.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "list_records",
     "description": "List records in one collection, newest change first. Optional text search across all "
                    "fields and an exact status filter (stage for opportunities, status or outcome elsewhere).",
     "inputSchema": {"type": "object", "properties": {
         "collection": {"type": "string", "enum": COLLECTION_NAMES},
         "search": {"type": "string"}, "status": {"type": "string"},
         "limit": {"type": "integer", "minimum": 1, "maximum": 500}}, "required": ["collection"]}},
    {"name": "get_record",
     "description": "Read one record by id.",
     "inputSchema": {"type": "object", "properties": {
         "collection": {"type": "string", "enum": COLLECTION_NAMES}, "id": {"type": "string"}},
         "required": ["collection", "id"]}},
    {"name": "create_record",
     "description": "Add a record. data is an object of field keys and values from describe_collections. "
                    "Dates are YYYY-MM-DD, quote due is YYYY-MM-DDTHH:MM, money is a plain number.",
     "inputSchema": {"type": "object", "properties": {
         "collection": {"type": "string", "enum": COLLECTION_NAMES}, "data": {"type": "object"}},
         "required": ["collection", "data"]}},
    {"name": "update_record",
     "description": "Change fields on a record. Only the fields in data change; send null to clear a field.",
     "inputSchema": {"type": "object", "properties": {
         "collection": {"type": "string", "enum": COLLECTION_NAMES}, "id": {"type": "string"},
         "data": {"type": "object"}}, "required": ["collection", "id", "data"]}},
    {"name": "delete_record",
     "description": "Delete one record for good. Only when the user asks for it.",
     "inputSchema": {"type": "object", "properties": {
         "collection": {"type": "string", "enum": COLLECTION_NAMES}, "id": {"type": "string"}},
         "required": ["collection", "id"]}},
]


def mcp_call(name, args):
    if name == "get_overview":
        return overview()
    if name == "describe_collections":
        return describe_collections()
    collection = args.get("collection")
    if collection not in COLLECTIONS:
        raise ValueError("collection must be one of: " + ", ".join(COLLECTION_NAMES))
    if name == "list_records":
        records = all_records(collection)
        status_key = COLLECTIONS[collection].get("status")
        if args.get("status") and status_key:
            wanted = str(args["status"]).lower()
            records = [r for r in records if str(r["data"].get(status_key, "")).lower() == wanted]
        if args.get("search"):
            needle = str(args["search"]).lower()
            records = [r for r in records if needle in json.dumps(r["data"]).lower()]
        limit = int(args.get("limit") or 100)
        return {"total": len(records), "records": records[:limit]}
    if name == "create_record":
        return create_record(collection, args.get("data") or {})
    record_id = str(args.get("id") or "")
    if name == "get_record":
        record = get_record(collection, record_id)
    elif name == "update_record":
        record = update_record(collection, record_id, args.get("data") or {})
    elif name == "delete_record":
        record = {"deleted": True} if delete_record(collection, record_id) else None
    else:
        raise ValueError("Unknown tool: %s" % name)
    if record is None:
        raise ValueError("No record with id %s in %s" % (record_id, collection))
    return record


def mcp_handle(message):
    method = message.get("method")
    msg_id = message.get("id")
    params = message.get("params") or {}
    if msg_id is None:  # a notification: nothing to answer
        return None

    def reply(result):
        return {"jsonrpc": "2.0", "id": msg_id, "result": result}

    if method == "initialize":
        wanted = params.get("protocolVersion")
        return reply({
            "protocolVersion": wanted if wanted in MCP_VERSIONS else MCP_VERSIONS[0],
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "kcapex-command-center", "title": "KCAPEX Command Center", "version": "1.0.0"},
            "instructions": "KCAPEX LLC's private GovCon command center: bid pipeline, subcontractors and "
                            "outreach, contracts, invoices, award price intel and owner hours. Call "
                            "describe_collections before the first write so field names and options match.",
        })
    if method == "ping":
        return reply({})
    if method == "tools/list":
        return reply({"tools": MCP_TOOLS})
    if method == "tools/call":
        try:
            result = mcp_call(params.get("name"), params.get("arguments") or {})
            return reply({"content": [{"type": "text", "text": json.dumps(result)}], "isError": False})
        except ValueError as err:
            return reply({"content": [{"type": "text", "text": str(err)}], "isError": True})
    if method in ("resources/list", "prompts/list"):
        return reply({method.split("/")[0]: []})
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": "Method not found"}}


@app.route("/mcp/<token>", methods=["GET", "POST", "DELETE"])
def mcp(token):
    if not MCP_TOKEN or not hmac.compare_digest(MCP_TOKEN.encode(), token.encode()):
        return jsonify(error="Not found"), 404
    if request.method != "POST":
        return Response(status=405, headers={"Allow": "POST"})
    body = request.get_json(silent=True)
    if body is None:
        return jsonify(jsonrpc="2.0", id=None, error={"code": -32700, "message": "Parse error"}), 400
    if isinstance(body, list):
        answers = [a for a in (mcp_handle(m) for m in body if isinstance(m, dict)) if a is not None]
        return jsonify(answers) if answers else Response(status=202)
    if not isinstance(body, dict):
        return jsonify(jsonrpc="2.0", id=None, error={"code": -32600, "message": "Invalid request"}), 400
    answer = mcp_handle(body)
    return jsonify(answer) if answer is not None else Response(status=202)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5050")), debug=False)
