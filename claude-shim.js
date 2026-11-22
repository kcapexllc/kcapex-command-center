/* Stands in for the Claude artifact runtime (window.claude.use) so the
   KCAPEX Pipeline page runs as a standalone phone app. The "db" capability
   is backed by /api/db (a Netlify Function + Netlify Blobs) instead of the
   Claude artifact database. Claude-only features (AI drafting, Tango pulls)
   report as unavailable, and the page hides them. */
(function () {
  'use strict';
  var COLLS = ['opportunities', 'contacts', 'subs', 'pastperf', 'tasks', 'feeds', 'inbox', 'portals', 'settings', 'leads', 'jobs', 'contracts', 'messages', 'invoices', 'visits', 'chats', 'projects'];
  var CACHE_KEY = 'kc.pipeline.cache.v1';
  var POLL_MS = 20000;

  var cache = {};          // { coll: { id: doc } }
  var revs = {};           // { coll: rev } as last fetched from the server
  var shown = {};          // { coll: JSON string } last snapshot delivered to listeners
  var collListeners = {};  // coll -> [ {cb, err} ]
  var docListeners = {};   // "coll/id" -> [ {cb, err} ]
  var loaded = false;

  try {
    var saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (saved && saved.cache) { cache = saved.cache; revs = saved.revs || {}; loaded = true; }
  } catch (e) { /* storage unavailable */ }

  function persist() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cache: cache, revs: revs })); } catch (e) { /* full or blocked */ }
  }

  function collSnap(c) {
    var m = cache[c] || {};
    return { docs: Object.keys(m).map(function (id) { return { id: id, exists: true, data: function () { return m[id]; } }; }) };
  }
  function docSnap(path) {
    var parts = path.split('/'), m = cache[parts[0]] || {}, d = m[parts[1]];
    return { id: parts[1], exists: d !== undefined, data: function () { return d; } };
  }

  function notify(force) {
    COLLS.forEach(function (c) {
      var s = JSON.stringify(cache[c] || {});
      if (!force && s === shown[c]) return;
      shown[c] = s;
      (collListeners[c] || []).forEach(function (l) { try { l.cb(collSnap(c)); } catch (e) { console.error(e); } });
      Object.keys(docListeners).forEach(function (p) {
        if (p.split('/')[0] !== c) return;
        docListeners[p].forEach(function (l) { try { l.cb(docSnap(p)); } catch (e) { console.error(e); } });
      });
    });
  }

  // Signed out: reload past the offline cache so the sign-in page shows.
  function onAuthLost(r) { if (r.status === 401) { location.replace('/?fresh=' + Date.now()); throw new Error('Signed out'); } return r; }

  var pulling = null;
  function pull() {
    if (pulling) return pulling;
    pulling = fetch('/api/db', { credentials: 'same-origin', cache: 'no-store' })
      .then(onAuthLost).then(function (r) { return r.json(); })
      .then(function (j) {
        window.kcMeta = { lastSync: j.lastSync || null, pulledAt: new Date().toISOString() };
        try { window.dispatchEvent(new Event('kc-meta')); } catch (e) { /* ignore */ }
        var stale = COLLS.filter(function (c) { return !loaded || (j.revs || {})[c] !== revs[c]; });
        if (!stale.length) return;
        return fetch('/api/db?c=' + stale.join(','), { credentials: 'same-origin', cache: 'no-store' })
          .then(onAuthLost).then(function (r) { return r.json(); })
          .then(function (k) {
            stale.forEach(function (c) { cache[c] = (k.collections || {})[c] || {}; revs[c] = (k.revs || {})[c]; });
            loaded = true; persist(); notify(false);
          });
      })
      .catch(function (e) {
        COLLS.forEach(function (c) { (collListeners[c] || []).forEach(function (l) { if (l.err) l.err(e); }); });
      })
      .then(function () { pulling = null; });
    return pulling;
  }

  // Writes go out one at a time so two edits to the same collection never race.
  var queue = Promise.resolve();
  function write(op) {
    var run = function () {
      return fetch('/api/db', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(op)
      }).then(onAuthLost).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.code = 'unavailable'; throw e; }
          if (j.rev) revs[op.path.split('/')[0]] = j.rev;
          return j;
        });
      });
    };
    var p = queue.then(run, run);
    queue = p.catch(function () {});
    return p;
  }

  function apply(path, body) {
    var parts = path.split('/'), c = parts[0], id = parts[1];
    cache[c] = cache[c] || {};
    if (body === undefined) delete cache[c][id]; else cache[c][id] = body;
    persist(); notify(false);
  }

  var db = {
    collection: function (c) {
      return {
        onSnapshot: function (cb, err) {
          var l = { cb: cb, err: err };
          (collListeners[c] = collListeners[c] || []).push(l);
          if (loaded) setTimeout(function () { cb(collSnap(c)); }, 0);
          return function () { collListeners[c] = (collListeners[c] || []).filter(function (x) { return x !== l; }); };
        }
      };
    },
    doc: function (path) {
      return {
        set: function (body) {
          var clean = JSON.parse(JSON.stringify(body));
          return write({ op: 'set', path: path, body: clean }).then(function () { apply(path, clean); });
        },
        delete: function () {
          return write({ op: 'delete', path: path }).then(function () { apply(path, undefined); });
        },
        get: function () { return pull().then(function () { return docSnap(path); }); },
        onSnapshot: function (cb, err) {
          var l = { cb: cb, err: err };
          (docListeners[path] = docListeners[path] || []).push(l);
          if (loaded) setTimeout(function () { cb(docSnap(path)); }, 0);
          return function () { docListeners[path] = (docListeners[path] || []).filter(function (x) { return x !== l; }); };
        }
      };
    }
  };

  var user = { can: function () { return true; } };

  window.claude = {
    use: function (name) {
      if (name === 'db') { pull(); return Promise.resolve(db); }
      if (name === 'user') return Promise.resolve(user);
      return Promise.resolve(null); // sample (Claude AI) and mcp (Tango) are not available outside Claude
    }
  };

  window.kcPull = pull;
  setInterval(function () { if (document.visibilityState === 'visible') pull(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') pull(); });
  window.addEventListener('online', function () { pull(); });
})();
