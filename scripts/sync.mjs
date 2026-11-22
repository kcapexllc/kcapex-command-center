#!/usr/bin/env node
// Two-way sync between the KCAPEX Pipeline artifact database in Claude and the
// phone app's database at kcapex-command-center.netlify.app.
//
// A scheduled Claude session runs it in three steps:
//   1. Export every artifact collection with ArtifactData (list, out_dir) into EXPORT_DIR,
//      one folder per collection (create an empty folder for an empty collection).
//   2. node sync.mjs plan EXPORT_DIR WORK_DIR
//        - writes app-side changes straight to the app
//        - writes WORK_DIR/to-artifact.json: the changes the session must make with ArtifactData
//   3. After applying those (get each doc for its version, then set or delete with if_version):
//      node sync.mjs commit WORK_DIR [FAILED_JSON]
//        - saves the new baseline. FAILED_JSON lists [{collection, doc_id}] writes that failed,
//          so they are retried next run.
//
// For each document it compares the artifact copy (A), the app copy (P) and the copy
// both sides had at the last sync (baseline B). A side that changed since B wins. If both
// changed, the newer updatedAt wins (artifact on a tie or when either has no updatedAt).
// Auth: the session's network proxy adds the app's bearer credential to requests.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.KC_APP_URL || "https://kcapex-command-center.netlify.app";
const COLLS = ["opportunities", "contacts", "subs", "pastperf", "tasks", "feeds", "inbox", "portals", "settings"];

function curl(args) {
  const extra = process.env.KC_COOKIE_FILE ? ["-b", process.env.KC_COOKIE_FILE] : [];
  const out = execFileSync("curl", ["-sS", "--fail-with-body", "--max-time", "120", ...extra, ...args], { maxBuffer: 256 * 1024 * 1024 });
  return JSON.parse(out.toString("utf8"));
}
function post(body, workDir) {
  const f = path.join(workDir, ".post.json");
  fs.writeFileSync(f, JSON.stringify(body));
  return curl(["-H", "content-type: application/json", "--data-binary", "@" + f, BASE + "/api/db"]);
}

function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
const hash = (doc) => (doc === undefined ? null : createHash("sha1").update(canon(doc)).digest("hex"));
const newer = (x, y) => String((x && x.updatedAt) || "") > String((y && y.updatedAt) || "");

function readExport(dir) {
  const out = {};
  for (const c of COLLS) {
    const d = path.join(dir, c);
    if (!fs.existsSync(d)) throw new Error(`Export folder missing for "${c}" (${d}). Create it, empty if the collection is empty. Refusing to sync.`);
    out[c] = {};
    for (const f of fs.readdirSync(d)) if (f.endsWith(".json")) out[c][f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
  }
  return out;
}

function plan(exportDir, workDir) {
  fs.mkdirSync(path.join(workDir, "docs"), { recursive: true });
  const A = readExport(exportDir);
  const app = curl([BASE + "/api/db?c=" + COLLS.join(",")]).collections;
  const B = post({ op: "baseline-get" }, workDir).baseline;
  if (!B) throw new Error("No baseline on the app yet. Seed it first (see README). Refusing to sync.");
  fs.writeFileSync(path.join(workDir, "prev-baseline.json"), JSON.stringify(B));

  // Guard against a partial export: a big drop in an artifact collection means the list was cut short.
  for (const c of COLLS) {
    const before = Object.keys(B[c] || {}).length, now = Object.keys(A[c]).length;
    if (before >= 20 && now < before * 0.5) throw new Error(`Artifact "${c}" has ${now} docs but had ${before} at the last sync. The export looks incomplete (did you page past 1000?). Refusing to sync.`);
    if (now > 0 && now % 1000 === 0) console.warn(`Warning: "${c}" exported exactly ${now} docs; make sure every page was read.`);
  }

  const next = {}, toArtifact = [], summary = {};
  for (const c of COLLS) {
    const a = A[c], p = app[c] || {}, b = B[c] || {};
    const set = {}, del = [];
    next[c] = {};
    for (const id of new Set([...Object.keys(a), ...Object.keys(p), ...Object.keys(b)])) {
      const ha = hash(a[id]), hp = hash(p[id]), hb = b[id] || null;
      let winner; // "same" | "toApp" | "toArtifact"
      if (ha === hp) winner = "same";
      else if (hp === hb) winner = "toApp";
      else if (ha === hb) winner = "toArtifact";
      else if (a[id] === undefined) winner = "toArtifact";
      else if (p[id] === undefined) winner = "toApp";
      else winner = newer(p[id], a[id]) ? "toArtifact" : "toApp";

      if (winner === "same") { if (ha) next[c][id] = ha; continue; }
      if (winner === "toApp") {
        if (a[id] === undefined) del.push(id); else set[id] = a[id];
        if (ha) next[c][id] = ha;
      } else {
        if (p[id] === undefined) toArtifact.push({ collection: c, doc_id: id, op: "delete" });
        else {
          const f = path.join(workDir, "docs", `${c}__${id}.json`);
          fs.writeFileSync(f, JSON.stringify(p[id], null, 1));
          toArtifact.push({ collection: c, doc_id: id, op: "set", file: f });
        }
        if (hp) next[c][id] = hp;
      }
    }
    if (Object.keys(set).length || del.length) post({ op: "merge", collection: c, set, del }, workDir);
    summary[c] = { toApp: Object.keys(set).length + del.length, toArtifact: toArtifact.filter((x) => x.collection === c).length };
  }
  fs.writeFileSync(path.join(workDir, "next-baseline.json"), JSON.stringify(next));
  fs.writeFileSync(path.join(workDir, "to-artifact.json"), JSON.stringify(toArtifact, null, 1));
  console.log(JSON.stringify({ summary, toArtifactCount: toArtifact.length, toArtifactFile: path.join(workDir, "to-artifact.json") }, null, 1));
}

function commit(workDir, failedFile) {
  const next = JSON.parse(fs.readFileSync(path.join(workDir, "next-baseline.json"), "utf8"));
  const prev = JSON.parse(fs.readFileSync(path.join(workDir, "prev-baseline.json"), "utf8"));
  const failed = failedFile && fs.existsSync(failedFile) ? JSON.parse(fs.readFileSync(failedFile, "utf8")) : [];
  for (const { collection: c, doc_id: id } of failed) {
    next[c] = next[c] || {};
    if (prev[c] && prev[c][id]) next[c][id] = prev[c][id]; else delete next[c][id];
  }
  post({ op: "baseline-set", baseline: next }, workDir);
  console.log(`Baseline saved. ${failed.length} failed write(s) left for the next run.`);
}

// Seed the baseline from an export that already matches the app (first-time setup only).
function seed(exportDir, workDir) {
  fs.mkdirSync(workDir, { recursive: true });
  const A = readExport(exportDir), base = {};
  for (const c of COLLS) { base[c] = {}; for (const [id, d] of Object.entries(A[c])) base[c][id] = hash(d); }
  post({ op: "baseline-set", baseline: base }, workDir);
  console.log("Baseline seeded.");
}

const [cmd, x, y] = process.argv.slice(2);
try {
  if (cmd === "plan" && x && y) plan(x, y);
  else if (cmd === "commit" && x) commit(x, y);
  else if (cmd === "seed" && x && y) seed(x, y);
  else { console.error("usage: sync.mjs plan EXPORT_DIR WORK_DIR | commit WORK_DIR [FAILED_JSON] | seed EXPORT_DIR WORK_DIR"); process.exit(2); }
} catch (e) {
  console.error("SYNC ERROR: " + (e.stderr ? e.stderr.toString() : e.message));
  process.exit(1);
}
