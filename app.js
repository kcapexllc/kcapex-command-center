/* KCAPEX Command Center: the original dashboard layout, in purple, running on the
   synced KCAPEX Pipeline data (window.claude.use('db') from claude-shim.js). */
(() => {
  'use strict';

  // ---------- Icons ----------
  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    bids: '<path d="M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h8M9 9h3"/>',
    leads: '<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 3.65a3.5 3.5 0 0 1 0 6.7"/>',
    jobs: '<path d="M3 8h18v12H3zM8 8V5h8v3M3 13h18"/>',
    contracts: '<path d="M7 3h10v18H7zM10 7h4M10 11h4M10 15h2M4 6v15M20 6v15"/>',
    messages: '<path d="M4 5h16v11H8l-4 4z"/>',
    new: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    quick: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    people: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    subs: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>',
    library: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-.9 2.8 15.4-3.5.9z"/>',
    visits: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    ask: '<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    invoices: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
    intel: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

  // ---------- Utils ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const isoDay = (d = new Date()) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const dayOf = (s) => { if (!s) return ''; s = String(s); if (s.length <= 10) return s; const d = new Date(s); return isNaN(d) ? s.slice(0, 10) : isoDay(d); };
  const parseDate = (s) => (s ? new Date(dayOf(s) + 'T00:00:00') : null);
  const daysUntil = (s) => { const d = parseDate(s); if (!d || isNaN(d)) return null; return Math.round((d - parseDate(isoDay())) / 86400000); };
  const fmtDate = (s) => { const d = parseDate(s); return d && !isNaN(d) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : ''; };
  const money = (n) => { n = Number(n) || 0; if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M'; if (Math.abs(n) >= 1e4) return '$' + Math.round(n / 1e3) + 'K'; return '$' + n.toLocaleString(); };
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');

  // ---------- Data (synced database) ----------
  const DBC = ['opportunities', 'inbox', 'contacts', 'subs', 'pastperf', 'leads', 'jobs', 'contracts', 'messages', 'invoices', 'visits', 'chats', 'projects'];
  const APP_VERSION = '2026.11.23-10';
  const data = Object.fromEntries(DBC.map((c) => [c, {}]));
  const loadedColls = new Set();
  let db = null;
  // Speed: a screen draw asks for these lists dozens of times, so each one is built once and reused until its data changes.
  const listMemo = {}; let dataRev = 0;
  const list = (c) => { const src = data[c]; let m = listMemo[c]; if (!m || m.src !== src) m = listMemo[c] = { src, arr: Object.entries(src).map(([id, d]) => ({ id, ...d })) }; return m.arr.slice(); };

  async function saveDoc(c, id, body) {
    if (!db) { toast('Not connected yet. Try again in a moment.'); return false; }
    body.updatedAt = new Date().toISOString(); if (!body.createdAt) body.createdAt = body.updatedAt;
    try { await db.doc(c + '/' + id).set(body); return true; }
    catch (e) { toast('Save failed: ' + (e.message || 'network error')); return false; }
  }
  // The Pipeline marks records deleted rather than erasing them, so the sync can carry deletes across.
  const removeDoc = (c, id) => saveDoc(c, id, { ...data[c][id], deleted: true });

  // ---------- Pipeline rules (from the KCAPEX Pipeline) ----------
  const STATUSES = ['found', 'reviewing', 'bid', 'submitted', 'awarded', 'lost', 'no-bid', 'cancelled'];
  const ACTIVE = ['found', 'reviewing', 'bid', 'submitted'];
  const LOCALRX = /\b(city|village|town|township|county|school|schools|district|park|college|university|library|municipal|cps|board of education|forest preserve)\b/i;
  const levelOf = (x) => { if (x.level) return x.level; if (x.src === 'Federal') return 'federal'; const j = String(x.jur || x.setAside || '').toLowerCase(); if (/^(local|education)/.test(j)) return 'local'; if (/^state/.test(j)) return 'state'; return LOCALRX.test(x.agency || '') ? 'local' : 'state'; };
  const blockedPlace = (p) => { const s = String(p || '').trim().toUpperCase(); if (!s) return false; if (/CALIFORNIA/.test(s)) return true; return s.split(',').pop().trim() === 'CA'; };
  // Eastern-time calendar day. The formatter is built once and results are remembered: building it per call
  // made every screen draw slow on phones.
  const ET_FMT = (() => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (_) { return null; } })();
  const etMemo = new Map();
  const etDay = (iso) => { if (!iso) return ''; const s = String(iso); if (s.length <= 10) return s; let v = etMemo.get(s); if (v !== undefined) return v; const d = new Date(s); v = isNaN(d) ? s.slice(0, 10) : ET_FMT ? ET_FMT.format(d) : d.toISOString().slice(0, 10); if (etMemo.size > 5000) etMemo.clear(); etMemo.set(s, v); return v; };
  const qtWin = (x) => { const p = etDay(x.posted), u = etDay(x.due); if (!p || !u) return null; const a = Date.parse(p + 'T00:00:00Z'), b = Date.parse(u + 'T00:00:00Z'); return isNaN(a) || isNaN(b) ? null : Math.round((b - a) / 864e5); };
  const qtAmended = (x) => { if (x.amended === true) return true; if (x.lastNotice) return etDay(x.lastNotice) !== etDay(x.posted); if (x.watch && x.watch.noticesCount != null) return Number(x.watch.noticesCount) > 1; if (/\bamend/i.test((x.rank && x.rank.why) || '')) return true; if (x.amended === false) return false; return null; };
  const QT_MIN = 3, QT_MAX = 6; // owners' rule: 3 to 6 days from posted to due
  const qtOk = (x) => { const w = qtWin(x), u = etDay(x.due); if (w === null || !u || u < etDay(new Date().toISOString())) return false; return w >= QT_MIN && w <= QT_MAX; };
  // ---- KPI helpers ----
  const FY_START = '2026-10-01', FY_END = '2027-09-30';
  const GOALS = { revenue: 2000000, bids: 180, winRate: 20, wins: 36, approvalOver: 500000, kobeFrom: 10000 };
  const fyFrac = () => Math.min(1, Math.max(0, (parseDate(isoDay()) - parseDate(FY_START)) / 86400000 / 365));
  const liveOpps = () => list('opportunities').filter((o) => o.status !== 'pursuing');
  const pricingTotal = (o) => { const p = o.pricing; if (!p || !Array.isArray(p.lines)) return 0; const m = (Number(p.pct) || 0) / 100;
    return p.lines.reduce((a, l) => { const c = Number(l.cost) || 0; return a + (p.mode === 'margin' ? (m >= 1 ? c : c / (1 - m)) : c * (1 + m)); }, 0); };
  const oppPrice = (o) => Number(o.ourPrice) || pricingTotal(o) || Number(o.estValue) || 0;
  const isSS = (o) => /sources sought|presol|rfi/i.test(o.noticeType || '');
  const awards = () => list('contracts').filter((c) => c.status !== 'Cancelled');
  const invoicedFor = (cid) => list('invoices').filter((i) => i.contractId === cid && i.status !== 'Draft');
  const coReplies = () => liveOpps().filter((o) => o.followups && o.followups.lastReplyId && !o.followups.replyHandled);
  const signups = () => list('subs').filter((s) => s.signup && !s.reviewed);
  // Returns 'owner' (over $500K, majority owner signs off), 'kobe' ($10K to $500K) or '' when no approval is pending.
  const approvalTier = (o) => { const p = oppPrice(o); return p > GOALS.approvalOver ? 'owner' : p >= GOALS.kobeFrom ? 'kobe' : ''; };
  const isApproved = (o, tier) => Array.isArray(o.notes) && o.notes.some((n) => { const t = String((n && n.text) || ''); return tier === 'owner' ? /approved by the majority owner/i.test(t) : /approved by (kobe|the majority owner)/i.test(t); });
  const needsApproval = (o) => { if (!['reviewing', 'bid'].includes(o.status) || isPastOpp(o)) return false; const tier = approvalTier(o); return !!tier && !isApproved(o, tier); };
  const methodTag = (m) => { const s = String(m || ''); return /piee|wawf/i.test(s) ? 'PIEE' : /sam\.gov|\bsam\b/i.test(s) ? 'SAM' : /portal|bidbuy|emacs|isupplier|fedconnect/i.test(s) ? 'Portal' : /mail(?!\w)|post/i.test(s) && !/e-?mail/i.test(s) ? 'Mail' : /e-?mail/i.test(s) ? 'Email' : s ? 'Other' : ''; };
  const RESTRICTED = /8\(a\)|\b8a\b|sdvosb|service-disabled|veteran|wosb|women|hubzone|native|indian|tribal|isbee/i;
  const eligible = (x) => !RESTRICTED.test(String(x.setAside || ''));
  const relState = (c) => { const cad = Number(c.cadence) || 45; let last = c.lastTouch || '';
    if (!last) { const ns = (Array.isArray(c.notes) ? c.notes : []).map((n) => new Date(n && n.t)).filter((d) => !isNaN(d)).sort((a, b) => b - a); if (ns.length) last = isoDay(ns[0]); }
    const since = last ? -daysUntil(last) : null; if (since === null) return { k: 'none', since, cad };
    if (since > cad) return { k: 'cold', since, cad }; if (c.nextFollow && dayOf(c.nextFollow) <= isoDay()) return { k: 'due', since, cad }; return { k: 'warm', since, cad }; };
  const quoteSummary = (o) => { const q = Object.values(o.quotes || {}); if (!q.length) return ''; const got = q.filter((x) => x.status === 'received').length, out = q.filter((x) => x.status === 'requested').length;
    return [got ? got + ' in' : '', out ? out + ' out' : ''].filter(Boolean).join(', ') || q.length + ' closed'; };
  const isPastOpp = (o) => { const st = o.status || 'found'; if (!['found', 'reviewing', 'bid'].includes(st)) return true; const n = daysUntil(o.due); return n !== null && n < 0; };
  const newItems = () => list('inbox').filter((x) => x.state === 'new' && !blockedPlace(x.place));
  const quickItems = () => [
    ...newItems().filter(qtOk).map((x) => ({ ...x, _src: 'inbox' })),
    ...list('opportunities').filter((o) => !isPastOpp(o) && qtOk(o)).map((o) => ({ ...o, _src: 'opportunities' })),
  ].sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SEASON = [
    { lv: 'Local', md: ['Bid', 'Bid', 'Bid', 'Bid', 'Bid', 'Quiet', 'Snow bids', 'Market', 'Market', 'Market', 'Market', 'Bid'],
      sb: ['Chicago new year', 'Chicago and schools', 'School summer work', 'Schools, crunch', 'Schools, crunch', 'Slow month', 'Snow removal', 'Portals, snow bids', 'Portals, snow bids', 'Capability statements', 'Budgets set', 'Cook County new year'] },
    { lv: 'State', md: ['Market', 'Bid', 'Bid', 'Bid', 'Bid', 'Bid', 'Snow bids', 'Snow bids', 'Snow bids', 'Market', 'Market', 'Market'],
      sb: ['Agency intros', 'IL and MT posting', 'Peak', 'Peak, crunch', 'Peak, crunch', 'Awards by Jun 30', 'Snow removal', 'Snow removal', 'Snow removal', 'BidBuy, IPG, eMACS', 'Agency intros', 'Agency intros'] },
    { lv: 'Federal', md: ['Market', 'Market', 'Market', 'Bid', 'Bid', 'Bid', 'Bid', 'Bid', 'Bid', 'Market', 'Market', 'Market'],
      sb: ['Sources sought', 'Sources sought', 'Sources sought', 'Federal first', 'Federal first', 'Bid', 'Peak', 'Peak', 'Peak', 'Sources sought', 'Sources sought', 'Sources sought'] },
  ];
  const isBidMonth = (m) => /^(Bid|Snow)/.test(m);

  // ---------- Views (schema) ----------
  const opt = (arr) => arr;
  const COLLECTIONS = {
    bids: {
      coll: 'opportunities', label: 'Bids', singular: 'Bid', icon: 'bids', statusField: 'status', defaultFilter: 'Working',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, full: true },
        { key: 'sol', label: 'Solicitation #', type: 'text' },
        { key: 'agency', label: 'Agency', type: 'text' },
        { key: 'office', label: 'Contracting office', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: STATUSES },
        { key: 'noticeType', label: 'Notice type', type: 'select', options: opt(['RFQ', 'RFP', 'Sources sought', 'Presolicitation', 'Combined synopsis', 'Solicitation', 'IFB', 'State or local', 'Other']) },
        { key: 'setAside', label: 'Set-aside', type: 'text' },
        { key: 'naics', label: 'NAICS', type: 'text' },
        { key: 'place', label: 'Place of performance', type: 'text' },
        { key: 'posted', label: 'Posted', type: 'date' },
        { key: 'due', label: 'Due date', type: 'date' },
        { key: 'dueTime', label: 'Due time and zone', type: 'text' },
        { key: 'method', label: 'Submission method', type: 'select', options: ['Email', 'SAM.gov', 'PIEE', 'Portal', 'Mail'] },
        { key: 'estValue', label: 'Estimated value ($)', type: 'number' },
        { key: 'ourPrice', label: 'Our price ($)', type: 'number' },
        { key: 'contactsTxt', label: 'Government contacts', type: 'text', full: true },
        { key: 'link', label: 'Link (SAM.gov etc.)', type: 'url', full: true },
      ],
      title: (r) => r.title || r.sol || 'Untitled',
      sub: (r) => [r.sol, r.agency].filter(Boolean).join(' · '),
      value: (r) => oppPrice(r),
      meta: (r) => [['Due', fmtDate(r.due)], ['Type', r.noticeType], ['Set-aside', r.setAside], ['Quotes', quoteSummary(r)]],
      search: ['title', 'sol', 'agency', 'office', 'naics', 'place', 'setAside'],
      dateKey: 'due', notes: true,
    },
    leads: {
      coll: 'leads', label: 'Leads', singular: 'Lead', icon: 'leads', statusField: 'status',
      fields: [
        { key: 'name', label: 'Contact name', type: 'text', required: true },
        { key: 'company', label: 'Company / Agency', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['New', 'Contacted', 'Qualified', 'Converted', 'Dead'] },
        { key: 'source', label: 'Source', type: 'select', options: ['Referral', 'Website', 'Thumbtack', 'SAM.gov', 'Prime contractor', 'Event', 'Cold outreach', 'Other'] },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'value', label: 'Potential value ($)', type: 'number' },
        { key: 'followUp', label: 'Next follow-up', type: 'date' },
        { key: 'notesTxt', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.name, sub: (r) => [r.company, r.source].filter(Boolean).join(' · '), value: (r) => r.value,
      meta: (r) => [['Follow-up', fmtDate(r.followUp)], ['Phone', r.phone], ['Email', r.email]],
      search: ['name', 'company', 'email', 'phone', 'notesTxt', 'source'], dateKey: 'followUp',
    },
    jobs: {
      coll: 'jobs', label: 'Jobs', singular: 'Job', icon: 'jobs', statusField: 'status',
      fields: [
        { key: 'title', label: 'Job title', type: 'text', required: true, full: true },
        { key: 'client', label: 'Client / Agency', type: 'text' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'In Progress', 'On Hold', 'Complete'] },
        { key: 'value', label: 'Job value ($)', type: 'number' },
        { key: 'start', label: 'Start date', type: 'date' },
        { key: 'due', label: 'Due / Completion', type: 'date' },
        { key: 'notesTxt', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.title, sub: (r) => [r.client, r.location].filter(Boolean).join(' · '), value: (r) => r.value,
      meta: (r) => [['Start', fmtDate(r.start)], ['Due', fmtDate(r.due)]],
      search: ['title', 'client', 'location', 'notesTxt'], dateKey: 'due',
    },
    contracts: {
      coll: 'contracts', label: 'Contracts', singular: 'Contract', icon: 'contracts', statusField: 'status',
      fields: [
        { key: 'title', label: 'Contract title', type: 'text', required: true, full: true },
        { key: 'agency', label: 'Agency / Prime', type: 'text' },
        { key: 'number', label: 'Contract #', type: 'text' },
        { key: 'type', label: 'Type', type: 'select', options: ['FFP', 'T&M', 'Cost-Plus', 'IDIQ', 'BPA', 'Subcontract', 'Commercial'] },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Completed', 'Pending', 'Closed', 'Cancelled'] },
        { key: 'value', label: 'Award value ($)', type: 'number' },
        { key: 'awardDate', label: 'Award date', type: 'date' },
        { key: 'start', label: 'PoP start', type: 'date' },
        { key: 'end', label: 'PoP end', type: 'date' },
        { key: 'notesTxt', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.title, sub: (r) => [r.agency, r.number].filter(Boolean).join(' · '), value: (r) => r.value,
      meta: (r) => { const inv = invoicedFor(r.id); const billed = inv.reduce((a, i) => a + (Number(i.amount) || 0), 0), paid = inv.filter((i) => i.status === 'Paid').reduce((a, i) => a + (Number(i.amount) || 0), 0);
        return [['Awarded', fmtDate(r.awardDate)], ['PoP', [fmtDate(r.start), fmtDate(r.end)].filter(Boolean).join(' → ')], ['Invoiced', billed ? money(billed) : ''], ['Paid', paid ? money(paid) : '']]; },
      search: ['title', 'agency', 'number', 'notesTxt', 'type'], dateKey: 'end',
    },
    visits: {
      coll: 'visits', label: 'Site visits', singular: 'Site visit', icon: 'visits', statusField: 'status', dateKey: 'date',
      fields: [
        { key: 'title', label: 'Site visit', type: 'text', required: true, full: true },
        { key: 'bidId', label: 'Bid', type: 'select', optionsFn: () => liveOpps().filter((o) => !isPastOpp(o) || o.status === 'submitted').sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9'))).map((o) => [o.id, (o.sol ? o.sol + ' · ' : '') + (o.title || '')]), full: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'Done', 'Skipped'] },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'time', label: 'Time and zone', type: 'text' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'who', label: 'Who attends (KCAPEX or sub)', type: 'text' },
        { key: 'contact', label: 'Government contact', type: 'text' },
        { key: 'notesTxt', label: 'Notes, access, photos to take', type: 'textarea', full: true },
      ],
      title: (r) => r.title, sub: (r) => { const o = data.opportunities[r.bidId]; return [r.location, o ? (o.sol || o.title) : ''].filter(Boolean).join(' · '); }, value: () => null,
      meta: (r) => [['Date', fmtDate(r.date)], ['Time', r.time], ['Who', r.who]], search: ['title', 'location', 'who', 'contact', 'notesTxt'],
    },
    invoices: {
      coll: 'invoices', label: 'Invoices', singular: 'Invoice', icon: 'invoices', statusField: 'status', newestFirst: true, dateKey: 'sent',
      fields: [
        { key: 'contractId', label: 'Contract', type: 'select', optionsFn: () => awards().sort((a, b) => String(a.title).localeCompare(String(b.title))).map((c) => [c.id, c.title]), full: true },
        { key: 'number', label: 'Invoice #', type: 'text', required: true },
        { key: 'amount', label: 'Amount ($)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: ['Sent', 'Paid', 'Draft', 'Disputed'] },
        { key: 'system', label: 'Submitted through', type: 'select', options: ['WAWF / PIEE', 'IPP', 'Email', 'Mail', 'Other'] },
        { key: 'sent', label: 'Date sent', type: 'date' },
        { key: 'due', label: 'Payment due', type: 'date' },
        { key: 'paid', label: 'Date paid', type: 'date' },
        { key: 'notesTxt', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => 'Invoice ' + (r.number || ''), sub: (r) => (data.contracts[r.contractId] || {}).title || 'No contract', value: (r) => r.amount,
      meta: (r) => [['Sent', fmtDate(r.sent)], ['Due', fmtDate(r.due)], ['Paid', fmtDate(r.paid)], ['Via', r.system]],
      search: ['number', 'notesTxt', 'system'],
    },
    messages: {
      coll: 'messages', label: 'Inbox', singular: 'Message', icon: 'messages', statusField: 'status',
      fields: [
        { key: 'subject', label: 'Subject', type: 'text', required: true, full: true },
        { key: 'from', label: 'From / To', type: 'text' },
        { key: 'channel', label: 'Channel', type: 'select', options: ['Email', 'Phone', 'Text', 'Portal', 'In person'] },
        { key: 'status', label: 'Status', type: 'select', options: ['Needs reply', 'Waiting', 'Done'] },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'regarding', label: 'Regarding', type: 'text' },
        { key: 'body', label: 'Message / Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.subject, sub: (r) => [r.from, r.channel].filter(Boolean).join(' · '), value: () => null,
      meta: (r) => [['Date', fmtDate(r.date)], ['Re', r.regarding]],
      search: ['subject', 'from', 'regarding', 'body'], dateKey: 'date', newestFirst: true,
    },
    people: {
      coll: 'contacts', label: 'People', singular: 'Contact', icon: 'people', statusField: 'role',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'role', label: 'Role', type: 'select', options: ['Contracting Officer', 'Contract Specialist', 'COR', 'Small Business Specialist', 'Other'] },
        { key: 'agency', label: 'Agency', type: 'text' },
        { key: 'office', label: 'Office', type: 'text' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'cadence', label: 'Touch every (days)', type: 'select', options: ['45', '30', '60', '90'] },
        { key: 'lastTouch', label: 'Last touch', type: 'date' },
        { key: 'nextFollow', label: 'Next follow-up', type: 'date' },
      ],
      title: (r) => r.name || 'Unnamed', sub: (r) => [r.role, r.agency].filter(Boolean).join(' · '), value: () => null,
      meta: (r) => [['Email', r.email], ['Phone', r.phone], ['Next', fmtDate(r.nextFollow)]],
      search: ['name', 'title', 'agency', 'office', 'email', 'phone'], sortTitle: true, notes: true,
    },
    subs: {
      coll: 'subs', label: 'Subs', singular: 'Subcontractor', icon: 'subs', statusField: 'rating',
      fields: [
        { key: 'company', label: 'Company', type: 'text', required: true, full: true },
        { key: 'trade', label: 'Trade or NAICS', type: 'text' },
        { key: 'area', label: 'Service area', type: 'text' },
        { key: 'contact', label: 'Contact name', type: 'text' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'certs', label: 'Certifications and licenses', type: 'text' },
        { key: 'insurance', label: 'Insurance on file', type: 'text' },
        { key: 'rating', label: 'Rating', type: 'select', options: ['Untested', 'Good', 'Great', 'Avoid'] },
        { key: 'pricing', label: 'Pricing', type: 'text' },
        { key: 'equipment', label: 'Equipment and notes', type: 'textarea', full: true },
      ],
      title: (r) => r.company || 'Unnamed', sub: (r) => [r.trade, r.area].filter(Boolean).join(' · '), value: () => null,
      meta: (r) => [['Contact', r.contact], ['Phone', r.phone], ['Email', r.email]],
      search: ['company', 'trade', 'area', 'contact', 'email', 'certs'], sortTitle: true, notes: true,
    },
    library: {
      coll: 'pastperf', label: 'Library', singular: 'Past performance', icon: 'library', statusField: 'status',
      fields: [
        { key: 'contract', label: 'Contract number', type: 'text', required: true },
        { key: 'agency', label: 'Agency', type: 'text' },
        { key: 'value', label: 'Value ($)', type: 'number' },
        { key: 'period', label: 'Period', type: 'text' },
        { key: 'poc', label: 'Government POC', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Completed'] },
        { key: 'scope', label: 'Scope', type: 'textarea', full: true },
      ],
      title: (r) => r.contract || 'Untitled', sub: (r) => [r.agency, r.period].filter(Boolean).join(' · '), value: (r) => r.value,
      meta: (r) => [['POC', r.poc]], search: ['contract', 'agency', 'scope', 'poc'], sortTitle: true,
    },
  };

  const STATUS_COLORS = {
    found: 'b-muted', reviewing: 'b-blue', bid: 'b-orange', submitted: 'b-gold', awarded: 'b-green', lost: 'b-red', 'no-bid': 'b-muted', cancelled: 'b-muted',
    New: 'b-blue', Contacted: 'b-purple', Qualified: 'b-gold', Converted: 'b-green', Dead: 'b-muted',
    Scheduled: 'b-blue', 'In Progress': 'b-gold', 'On Hold': 'b-orange', Complete: 'b-green',
    Active: 'b-green', Pending: 'b-orange', Closed: 'b-muted', Completed: 'b-muted',
    'Needs reply': 'b-gold', Waiting: 'b-blue', Done: 'b-muted',
    Great: 'b-green', Good: 'b-blue', Untested: 'b-muted', Avoid: 'b-red',
  };
  const STAGE_BAR = { found: '#a78bfa', reviewing: '#7c3aed', bid: '#5b21b6', submitted: '#4c1d95' };

  const TABS = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'bids', label: 'Bids', icon: 'bids' },
    { id: 'leads', label: 'Leads', icon: 'leads' },
    { id: 'jobs', label: 'Jobs', icon: 'jobs' },
    { id: 'contracts', label: 'Contracts', icon: 'contracts' },
    { id: 'messages', label: 'Inbox', icon: 'messages' },
  ];
  const EXTRA = [
    { id: 'new', label: 'New opportunities', icon: 'new' },
    { id: 'quick', label: 'Quick-turn', icon: 'quick' },
    { id: 'people', label: 'People', icon: 'people' },
    { id: 'subs', label: 'Subs', icon: 'subs' },
    { id: 'library', label: 'Library', icon: 'library' },
    { id: 'invoices', label: 'Invoices', icon: 'invoices' },
    { id: 'intel', label: 'Price intel', icon: 'intel' },
    { id: 'visits', label: 'Site visits', icon: 'visits' },
    { id: 'ask', label: 'Ask Claude', icon: 'ask' },
  ];
  const TITLES = { dashboard: 'Command Center', more: 'Opportunities', new: 'New opportunities', quick: 'Quick-turn bids', intel: 'Price intel', ask: 'Ask Claude' };

  // ---------- Routing ----------
  const ui = { view: 'dashboard', filter: {}, query: {}, level: 'all' };
  // Each screen remembers how far down you were, like the Claude app. A tap switches screens at once, with no fade.
  // `drawn` is set by the swipe pager: it has already drawn the screen beside the old one and puts it in place itself.
  const scrollMem = {}, navStack = []; let pagerFinish = null;
  function go(view, isBack, drawn) {
    if (!drawn && pagerFinish) pagerFinish();
    if (view !== ui.view) { scrollMem[ui.view] = window.scrollY; if (!isBack) { navStack.push(ui.view); if (navStack.length > 30) navStack.shift(); } }
    const same = view === ui.view; ui.view = view; try { closeTopMenu(); } catch (_) { /* menu not ready yet */ }
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignore */ }
    if (drawn) { renderChrome(); return; }
    render(); window.scrollTo({ top: same || view === 'ask' ? 0 : scrollMem[view] || 0 });
  }

  // ---------- Rendering ----------
  let countsMemo = null;
  function counts() {
    const key = dataRev + '|' + isoDay(); if (countsMemo && countsMemo.key === key) return countsMemo.n;
    const n = countsNow(); countsMemo = { key, n }; return n;
  }
  function countsNow() {
    return {
      bids: liveOpps().filter((o) => ['reviewing', 'bid', 'submitted'].includes(o.status)).length,
      leads: list('leads').filter((l) => !['Converted', 'Dead'].includes(l.status)).length + signups().length,
      jobs: list('jobs').filter((j) => j.status !== 'Complete').length + awards().filter((c) => c.status === 'Active').length,
      contracts: awards().length,
      messages: list('messages').filter((m) => m.status === 'Needs reply').length + coReplies().length,
      invoices: list('invoices').filter((i) => i.status === 'Sent').length,
      visits: list('visits').filter((v) => v.status === 'Scheduled' && daysUntil(v.date) !== null && daysUntil(v.date) >= 0).length,
      new: newItems().length, quick: quickItems().length,
    };
  }
  function renderNav() {
    const n = counts();
    const btn = (v) => `<button data-go="${v.id}" class="${ui.view === v.id ? 'active' : ''}">${icon(v.icon)}<span>${v.id === 'dashboard' ? 'Dashboard' : v.label}</span>${n[v.id] ? `<span class="count">${n[v.id]}</span>` : ''}</button>`;
    setHTML($('#nav'), TABS.map(btn).join('') + '<div style="height:10px"></div>' + EXTRA.map(btn).join('') + btn({ id: 'more', label: 'Settings', icon: 'settings' }));
    // Phone tab bar: the six main screens plus Opportunities, which opens the More screen (New, Quick-turn, People, Subs…).
    const inMore = ui.view === 'more' || EXTRA.some((v) => v.id === ui.view);
    const tab = (v) => `<button data-go="${v.id}" class="${ui.view === v.id ? 'active' : ''}" aria-label="${v.label}">${icon(v.icon)}<span>${v.label}</span></button>`;
    const opps = `<button data-go="more" class="${inMore ? 'active' : ''}" aria-label="Opportunities">${icon('new')}<span>Opps</span>${n.new ? `<i class="tbadge">${n.new > 99 ? '99+' : n.new}</i>` : ''}</button>`;
    const byId = Object.fromEntries(TABS.map((v) => [v.id, v]));
    // Order on phones: Home, Opportunities, Leads, Bids, Jobs, Contracts, Inbox.
    setHTML($('#tabbar'), tab(byId.dashboard) + opps + ['leads', 'bids', 'jobs', 'contracts', 'messages'].map((id) => tab(byId[id])).join(''));
  }
  // Writes markup only when it differs from what is already there (redrawing identical tab bars cost time on every screen change).
  function setHTML(el, html) { if (el._kcHTML !== html) { el.innerHTML = html; el._kcHTML = html; } }

  // Top bar title, the live line under it, the tabs and the + button.
  function renderChrome() {
    renderNav();
    const c = COLLECTIONS[ui.view];
    $('#view-title').textContent = TITLES[ui.view] || (c ? c.label : '');
    $('#view-sub').textContent = viewSub();
    $('#fab').hidden = !(c || ui.view === 'dashboard');
  }
  // The markup for the current screen's body.
  function viewHTML() {
    try {
      if (ui.view === 'dashboard') return renderDashboard();
      if (ui.view === 'more') return renderMore();
      if (ui.view === 'new') return renderNew();
      if (ui.view === 'quick') return renderQuick();
      if (ui.view === 'intel') return renderIntel();
      if (ui.view === 'ask') return renderAsk();
      return renderList(ui.view);
    } catch (err) { console.error(err); return `<div class="notice">This page hit a problem drawing a record (${esc(err.message)}). Your data is safe.</div>`; }
  }
  // The markup for another screen, without leaving this one (used to draw the next screen beside it during a swipe).
  function htmlFor(v) { const cur = ui.view; ui.view = v; try { return viewHTML(); } finally { ui.view = cur; } }
  function render() {
    if (pagerFinish) pagerFinish();
    renderChrome();
    const ae = document.activeElement, keep = ae && ae.dataset && ae.dataset.search ? [ae.dataset.search, ae.selectionStart] : null, keepAsk = ae && ae.id === 'ask-in';
    const el = $('#view');
    el.innerHTML = viewHTML();
    if (keepAsk) { const s = $('#ask-in'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
    if (keep) { const s = $(`[data-search="${keep[0]}"]`); if (s) { s.focus(); try { s.setSelectionRange(keep[1], keep[1]); } catch (e) { /* ignore */ } } }
  }
  // The small line under the title: a greeting on Home, a live count everywhere else, plus when Claude last synced.
  function viewSub() {
    try {
      const n = counts(), h = new Date().getHours(), m = window.kcMeta || {};
      const synced = m.lastSync ? new Date(m.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      switch (ui.view) {
        case 'dashboard': return `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, Kobe · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        case 'more': return `${n.new} new · ${n.quick} quick-turn`;
        case 'bids': return `${n.bids} working${synced ? ' · synced ' + synced : ''}`;
        case 'leads': return `${n.leads} open`;
        case 'jobs': return `${n.jobs} active`;
        case 'contracts': return `${n.contracts} awards`;
        case 'messages': return n.messages ? `${n.messages} need a reply` : 'All caught up';
        case 'ask': return projView === 'list' ? 'One folder per bid' : projView ? 'Bid folder' : 'Chats and bid folders';
        case 'new': return `${n.new} from your saved searches`;
        case 'quick': return `${n.quick} open · 3 to 6 days`;
        case 'invoices': return `${n.invoices} unpaid`;
        case 'visits': return `${n.visits} upcoming`;
        default: return synced ? `Synced ${synced}` : '';
      }
    } catch (_) { return ''; }
  }
  let raf = 0; const scheduleRender = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); };

  function seasonBlock() {
    const m = new Date().getMonth();
    const strip = SEASON.map((s) => `<div class="${isBidMonth(s.md[m]) ? 'bid' : ''}"><div class="lv">${s.lv}</div><div class="md">${esc(s.md[m])}</div><div class="sb">${esc(s.sb[m])}</div></div>`).join('');
    const rows = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<tr class="${i === m ? 'now' : ''}"><td>${MONTHS[i]}</td>${SEASON.map((s) => `<td class="${isBidMonth(s.md[i]) ? 'b' : ''}">${esc(s.md[i])}</td>`).join('')}</tr>`).join('');
    return `<div class="panel" style="margin-bottom:16px"><h2>Bid calendar, ${new Date().toLocaleDateString(undefined, { month: 'long' })}</h2><div class="season">${strip}</div>
      <details class="yr"><summary>Full year</summary><table class="yr"><tr><th>Month</th><th>Local</th><th>State</th><th>Federal</th></tr>${rows}</table>
      <p style="color:var(--muted);font-size:12.5px;margin:8px 0 0">Local is Chicago, Cook County, CPS and school and park districts. State is Illinois and Montana. April and May are the overlap crunch: federal first.</p></details></div>`;
  }

  function goalRow(label, actual, target, fmt, sub) {
    const pct = target ? actual / target : 1;
    const st = pct >= 1 ? ['On track', 'b-green'] : pct >= 0.9 ? ['Slightly behind', 'b-orange'] : ['Behind', 'b-red'];
    return `<div class="goal"><div class="goal-top"><b>${esc(label)}</b><span class="badge ${st[1]}">${st[0]}</span></div>
      <div class="stage-bar"><span style="width:${Math.min(100, Math.round(pct * 100))}%;background:var(--accent)"></span></div>
      <div class="goal-sub">${fmt(actual)} vs ${fmt(target)} target to date${sub ? ' · ' + esc(sub) : ''}</div></div>`;
  }

  function renderDashboard() {
    const opps = liveOpps();
    const today = isoDay();
    const working = opps.filter((o) => ['reviewing', 'bid'].includes(o.status) && !isPastOpp(o));
    const submitted = opps.filter((o) => o.status === 'submitted');
    const foundOpen = opps.filter((o) => (o.status || 'found') === 'found' && !isPastOpp(o));
    const stale = opps.filter((o) => ['found', 'reviewing', 'bid'].includes(o.status || 'found') && isPastOpp(o));
    const pipeline = [...working, ...submitted].reduce((a, o) => a + oppPrice(o), 0);
    const unpriced = [...working, ...submitted].filter((o) => !oppPrice(o)).length;
    const aw = awards(), awardedTotal = aw.reduce((a, c) => a + (Number(c.value) || 0), 0);
    const lost = opps.filter((o) => o.status === 'lost');
    const winRate = aw.length + lost.length ? Math.round((aw.length / (aw.length + lost.length)) * 100) : null;
    const deadlines = collectDeadlines();
    const mine = deadlines.filter((d) => d.kind !== 'Found bid due');
    const bidDue = mine.filter((d) => d.group === 'bid'), fuDue = mine.filter((d) => d.group !== 'bid');
    const dueWeek = bidDue.filter((d) => d.days >= 0 && d.days <= 7).length;
    const fuWeek = fuDue.filter((d) => d.days <= 7).length;
    const foundWeek = deadlines.filter((d) => d.days >= 0 && d.days <= 7 && d.kind === 'Found bid due').length;
    const replies = coReplies().length + list('messages').filter((m) => m.status === 'Needs reply').length;
    const leadsN = list('leads').filter((l) => !['Converted', 'Dead'].includes(l.status)).length + signups().length;
    const nw = newItems(), lv = (k) => nw.filter((x) => levelOf(x) === k).length, qk = quickItems().length;
    const approvals = opps.filter(needsApproval);

    // FY27 goals (1 Oct 2026 to 30 Sep 2027), targets prorated to today.
    const f = fyFrac();
    const invoicedFY = list('invoices').filter((i) => i.status !== 'Draft' && dayOf(i.sent) >= FY_START && dayOf(i.sent) <= FY_END).reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const bidsFY = opps.filter((o) => ['submitted', 'awarded', 'lost'].includes(o.status) && !isSS(o) && dayOf(o.submittedOn || o.due) >= FY_START).length;
    const winsFY = aw.filter((c) => dayOf(c.awardDate) >= FY_START).length;
    const awardedFY = aw.filter((c) => dayOf(c.awardDate) >= FY_START).reduce((a, c) => a + (Number(c.value) || 0), 0);
    const pctFmt = (n) => n + '%';

    const stages = ['found', 'reviewing', 'bid', 'submitted'];
    const byStage = stages.map((s) => { const items = s === 'found' ? foundOpen : s === 'submitted' ? submitted : working.filter((o) => o.status === s); return { s, n: items.length, v: items.reduce((a, o) => a + oppPrice(o), 0) }; });
    const maxN = Math.max(1, ...byStage.map((x) => x.n));
    const activeWork = aw.filter((c) => c.status === 'Active');

    return `
      <div class="hero">
        ${nw.length ? `<article class="card" data-go="new"><div class="card-title">${nw.length} new opportunit${nw.length === 1 ? 'y' : 'ies'} from your saved searches</div><div class="card-sub">Local ${lv('local')} · State ${lv('state')} · Federal ${lv('federal')}</div></article>` : ''}
        ${qk ? `<article class="card" data-go="quick"><div class="card-title">${qk} quick-turn bid${qk === 1 ? '' : 's'} open</div><div class="card-sub">Posted to due in 3 to 6 days · tap to see them</div></article>` : ''}
        ${approvals.length ? `<article class="card" data-filter="bids:Needs approval" data-go2="bids" style="border-color:var(--red)"><div class="card-title">${approvals.length} bid${approvals.length === 1 ? '' : 's'} waiting for approval</div><div class="card-sub">${approvals.filter((o) => approvalTier(o) === 'kobe').length} for Kobe ($10K to $500K) · ${approvals.filter((o) => approvalTier(o) === 'owner').length} for the majority owner (over $500K)</div></article>` : ''}
      </div>
      <div class="kpis">
        <div class="kpi accent"><div class="kpi-label">Open pipeline</div><div class="kpi-value">${money(pipeline)}</div><div class="kpi-sub">${submitted.length} submitted · ${working.length} in progress${unpriced ? ` · ${unpriced} unpriced` : ''}</div></div>
        <div class="kpi"><div class="kpi-label">Bids due in 7 days</div><div class="kpi-value" style="color:${dueWeek ? 'var(--red)' : 'inherit'}">${dueWeek}</div><div class="kpi-sub">hard deadlines you're working · ${fuWeek} follow-up${fuWeek === 1 ? '' : 's'} due</div></div>
        <div class="kpi"><div class="kpi-label">Awarded</div><div class="kpi-value">${money(awardedTotal)}</div><div class="kpi-sub">${aw.length} win${aw.length === 1 ? '' : 's'} · ${activeWork.length} active</div></div>
        <div class="kpi"><div class="kpi-label">Win rate</div><div class="kpi-value">${winRate === null ? '—' : winRate + '%'}</div><div class="kpi-sub">${aw.length} won · ${lost.length} lost</div></div>
        <div class="kpi"><div class="kpi-label">Awaiting decision</div><div class="kpi-value">${submitted.length}</div><div class="kpi-sub" ${stale.length ? 'data-filter="bids:Needs close-out" data-go2="bids" style="cursor:pointer"' : ''}>submitted${stale.length ? ` · <b style="color:var(--red)">${stale.length} need close-out</b>` : ''}</div></div>
        <div class="kpi"><div class="kpi-label">Needs reply</div><div class="kpi-value" style="color:${replies ? 'var(--red)' : 'inherit'}">${replies}</div><div class="kpi-sub">${coReplies().length} CO repl${coReplies().length === 1 ? 'y' : 'ies'} · ${leadsN} lead${leadsN === 1 ? '' : 's'}</div></div>
      </div>
      ${askBox(true)}
      ${todayPanel(stale)}
      <div class="panel" style="margin-bottom:16px"><h2>FY27 scorecard <span style="text-transform:none;letter-spacing:0;font-size:12.5px">${Math.round(f * 100)}% of the year gone</span></h2>
        <div class="goals">
          ${goalRow('Revenue invoiced', invoicedFY, Math.round(GOALS.revenue * f), money, invoicedFY ? '' : 'log invoices on your contracts to track this')}
          ${goalRow('Bids submitted', bidsFY, Math.round(GOALS.bids * f), String, '15 a month')}
          ${goalRow('Wins', winsFY, Math.max(1, Math.round(GOALS.wins * f)), String, money(awardedFY) + ' awarded this FY')}
          <div class="goal"><div class="goal-top"><b>Win rate</b><span class="badge ${winRate === null ? 'b-muted' : winRate >= GOALS.winRate ? 'b-green' : winRate >= 18 ? 'b-orange' : 'b-red'}">${winRate === null ? 'No data' : winRate >= GOALS.winRate ? 'On track' : 'Behind'}</span></div>
            <div class="stage-bar"><span style="width:${Math.min(100, winRate || 0)}%;background:var(--accent)"></span></div><div class="goal-sub">${winRate === null ? '—' : pctFmt(winRate)} vs ${GOALS.winRate}% target, all time</div></div>
        </div></div>
      ${seasonBlock()}
      <div class="grid-2">
        <div class="panel">
          <h2>Bid deadlines <span style="text-transform:none;letter-spacing:0;font-size:12.5px">next 30 days</span></h2>
          ${bidDue.length ? bidDue.slice(0, 10).map(dlRow).join('') : '<div class="empty">None of your working bids are due in the next 30 days.</div>'}
          ${foundWeek ? `<p class="kpi-sub" data-filter="bids:Found, not reviewed" data-go2="bids" style="cursor:pointer;margin:8px 0 0">+ ${foundWeek} found bid${foundWeek === 1 ? '' : 's'} close this week that nobody has reviewed. <b style="color:var(--blue)">See them</b></p>` : ''}
          <h2 style="margin-top:22px">Follow-ups and site visits</h2>
          ${fuDue.length ? fuDue.slice(0, 8).map(dlRow).join('') : '<div class="empty">No follow-ups or site visits due.</div>'}
        </div>
        <div class="panel">
          <h2>Bid pipeline <button data-go="bids">View all</button></h2>
          ${byStage.map((x) => `<div class="stage-row"><span style="text-transform:capitalize">${x.s} <span style="color:var(--muted)">(${x.n})</span></span>
            <div class="stage-bar"><span style="width:${x.n ? Math.max(4, (x.n / maxN) * 100) : 0}%;background:${STAGE_BAR[x.s]}"></span></div><span class="stage-val">${money(x.v)}</span></div>`).join('')}
          <h2 style="margin-top:22px">Active work <button data-go="jobs">View all</button></h2>
          ${activeWork.length ? activeWork.slice(0, 6).map((c) => `<div class="deadline" data-open="contracts:${esc(c.id)}"><div class="deadline-main"><div class="deadline-title">${esc(c.title)}</div><div class="deadline-sub">${esc([c.agency, c.end ? 'ends ' + fmtDate(c.end) : ''].filter(Boolean).join(' · '))}</div></div><span class="card-value">${money(c.value)}</span></div>`).join('') : '<div class="empty">No active contracts.</div>'}
        </div>
      </div>`;
  }

  function dlRow(d) {
    const dt = parseDate(d.date); const cls = d.days < 0 ? 'overdue' : d.days <= 3 ? 'soon' : '';
    const when = d.days < 0 ? `${-d.days}d overdue` : d.days === 0 ? 'Today' : d.days === 1 ? 'Tomorrow' : `in ${d.days} days`;
    return `<div class="deadline" data-open="${d.view}:${esc(d.id)}"><div class="date-chip ${cls}"><small>${dt.toLocaleDateString(undefined, { month: 'short' })}</small><b>${dt.getDate()}</b></div>
      <div class="deadline-main"><div class="deadline-title">${esc(d.title)}</div><div class="deadline-sub">${esc(d.kind)} · ${when}${d.extra ? ' · ' + esc(d.extra) : ''}</div></div></div>`;
  }

  function todayPanel(stale) {
    const today = isoDay();
    const quotes = []; liveOpps().filter((o) => !isPastOpp(o) || o.status === 'submitted').forEach((o) => Object.entries(o.quotes || {}).forEach(([sid, q]) => { if (q.status === 'requested') quotes.push({ o, sid, q }); }));
    const cold = list('contacts').map((c) => ({ c, r: relState(c) })).filter((x) => x.r.k === 'cold' || x.r.k === 'due').sort((a, b) => (b.r.since ?? 0) - (a.r.since ?? 0));
    const staleWork = liveOpps().filter((o) => ['reviewing', 'bid'].includes(o.status) && !isPastOpp(o) && o.updatedAt && -daysUntil(o.updatedAt) > 7);
    const visits = list('visits').filter((v) => v.status !== 'Done' && v.status !== 'Skipped' && daysUntil(v.date) !== null && daysUntil(v.date) >= -1 && daysUntil(v.date) <= 14).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const approvals = liveOpps().filter(needsApproval);
    const row = (open, title, sub, badge) => `<div class="deadline" data-open="${open}"><div class="deadline-main"><div class="deadline-title">${esc(title)}</div><div class="deadline-sub">${esc(sub)}</div></div>${badge || ''}</div>`;
    const block = (h, n, body, empty) => `<div class="tblock"><h3 class="sec">${h} <span class="n">${n}</span></h3>${n ? body : `<div class="tempty">${empty}</div>`}</div>`;
    return `<div class="panel" style="margin-bottom:16px"><h2>Today</h2><div class="today-grid">
      ${block('Site visits', visits.length, visits.slice(0, 4).map((v) => row('visits:' + v.id, v.title, [fmtDate(v.date) + (v.time ? ' ' + v.time : ''), v.location].filter(Boolean).join(' · '), daysUntil(v.date) <= 1 ? '<span class="badge b-red">Soon</span>' : '')).join(''), 'No site visits in the next two weeks.')}
      ${block('Approvals', approvals.length, approvals.slice(0, 4).map((o) => row('bids:' + o.id, o.title || o.sol, (approvalTier(o) === 'owner' ? 'Majority owner' : 'Kobe') + ' · ' + money(oppPrice(o)) + ' · due ' + fmtDate(o.due), '<span class="badge b-red">Approve</span>')).join(''), 'Nothing waiting for approval.')}
      ${block('Sub quotes outstanding', quotes.length, quotes.slice(0, 5).map(({ o, sid, q }) => row('bids:' + o.id, (data.subs[sid] || {}).company || 'Sub', (o.sol || o.title) + ' · need by ' + (q.dueOn || '?') + (q.chases ? ' · chased ' + q.chases + 'x' : ''), q.dueOn && q.dueOn < today ? '<span class="badge b-red">Late</span>' : '')).join(''), 'No quote requests waiting on a sub.')}
      ${block('Contacts to touch', cold.length, cold.slice(0, 5).map(({ c, r }) => row('people:' + c.id, c.name || 'Contact', [c.role, c.agency].filter(Boolean).join(' · '), `<span class="badge ${r.k === 'cold' ? 'b-red' : 'b-gold'}">${r.k === 'cold' ? 'Cold ' + r.since + 'd' : 'Due'}</span>`)).join('') + (cold.length > 5 ? `<p class="kpi-sub" data-go="people" style="cursor:pointer;margin:6px 0 0">+ ${cold.length - 5} more</p>` : ''), 'Every contact is within its touch cadence.')}
      ${block('Stale bids', staleWork.length + stale.length, staleWork.slice(0, 4).map((o) => row('bids:' + o.id, o.title || o.sol, 'not touched in ' + (-daysUntil(o.updatedAt)) + ' days · due ' + fmtDate(o.due), '')).join('') + (stale.length ? `<div class="deadline" data-filter="bids:Needs close-out" data-go2="bids"><div class="deadline-main"><div class="deadline-title">${stale.length} past due and never sent</div><div class="deadline-sub">Close them out as no-bid</div></div><span class="badge b-red">Close out</span></div>` : ''), 'No stale bids.')}
    </div></div>`;
  }

  function collectDeadlines() {
    const out = [];
    const push = (view, r, date, kind, title, group, extra) => { const days = daysUntil(date); if (days !== null && days <= 30 && days >= -7) out.push({ view, id: r.id, date: dayOf(date), days, kind, title, group: group || 'fu', extra }); };
    list('visits').filter((v) => v.status !== 'Done' && v.status !== 'Skipped').forEach((v) => push('visits', v, v.date, 'Site visit', v.title, 'fu', [v.time, v.location].filter(Boolean).join(' ')));
    liveOpps().filter((o) => !isPastOpp(o)).forEach((o) => push('bids', o, o.due, (o.status || 'found') === 'found' ? 'Found bid due' : isSS(o) ? 'Response due' : 'Bid due', o.title || o.sol, 'bid', [methodTag(o.method), o.dueTime].filter(Boolean).join(' · ')));
    list('leads').filter((l) => !['Converted', 'Dead'].includes(l.status)).forEach((l) => push('leads', l, l.followUp, 'Follow up', l.name + (l.company ? ' — ' + l.company : '')));
    list('contacts').forEach((c) => push('people', c, c.nextFollow, 'Follow up', c.name + (c.agency ? ' — ' + c.agency : '')));
    list('jobs').filter((j) => j.status !== 'Complete').forEach((j) => { if (j.status === 'Scheduled') push('jobs', j, j.start, 'Job starts', j.title); push('jobs', j, j.due, 'Job due', j.title); });
    list('contracts').filter((c) => c.status === 'Active').forEach((c) => push('contracts', c, c.end, 'Contract ends', c.title));
    return out.sort((a, b) => a.days - b.days);
  }

  function renderList(key) {
    const c = COLLECTIONS[key];
    const items = key === 'bids' ? liveOpps() : list(c.coll);
    const sf = c.fields.find((x) => x.key === c.statusField);
    const statusOpts = [...new Set([...sf.options, ...items.map((i) => i[c.statusField]).filter(Boolean)])];
    const f = ui.filter[key] || c.defaultFilter || 'All';
    const q = (ui.query[key] || '').toLowerCase();
    const cnt = (s) => items.filter((i) => (i[c.statusField] || (key === 'bids' ? 'found' : '')) === s).length;
    const activeOf = (i) => ACTIVE.includes(i.status || 'found') && !isPastOpp(i);
    const SPECIAL = { Working: (i) => ['reviewing', 'bid', 'submitted'].includes(i.status), 'Found, not reviewed': (i) => (i.status || 'found') === 'found' && !isPastOpp(i),
      'Needs approval': needsApproval, 'Needs close-out': (i) => ['found', 'reviewing', 'bid'].includes(i.status || 'found') && isPastOpp(i) };
    let rows = items.filter((i) => (f === 'All' || (key === 'bids' && SPECIAL[f] ? SPECIAL[f](i) : (i[c.statusField] || (key === 'bids' ? 'found' : '')) === f)) &&
      (!q || c.search.some((k) => String(i[k] || '').toLowerCase().includes(q))));
    if (c.sortTitle) rows.sort((a, b) => String(c.title(a)).localeCompare(String(c.title(b))));
    else if (c.newestFirst) rows.sort((a, b) => String(b[c.dateKey] || '').localeCompare(String(a[c.dateKey] || '')));
    else rows.sort((a, b) => String(dayOf(a[c.dateKey]) || '9999').localeCompare(String(dayOf(b[c.dateKey]) || '9999')));
    const total = rows.reduce((a, r) => a + (Number(c.value(r)) || 0), 0);
    const special = key === 'bids' ? Object.entries(SPECIAL).map(([k, fn]) => [k, items.filter(fn).length]).filter(([k, n]) => n || k === 'Working') : [];
    const chips = [...special, ['All', items.length], ...statusOpts.filter((s) => cnt(s)).map((s) => [s, cnt(s)])];
    const extra = listExtras(key) + (key === 'bids' && f === 'Needs close-out' && rows.length ? `<div class="notice">These bids passed their due date and were never sent. Closing them as no-bid keeps them out of your open numbers. <button class="btn" data-action="closeout-all" style="margin-left:6px">Close all ${rows.length} as no-bid</button></div>` : '');
    return `
      <div class="toolbar">
        <input class="search" type="search" placeholder="Search ${c.label.toLowerCase()}…" value="${esc(ui.query[key] || '')}" data-search="${key}" />
        <div class="chips">${chips.map(([s, n]) => `<button class="chip ${f === s ? 'active' : ''}" data-filter="${key}:${esc(s)}" style="text-transform:${key === 'bids' ? 'capitalize' : 'none'}">${esc(s)}<span class="n">${n}</span></button>`).join('')}</div>
      </div>
      ${extra}
      ${total ? `<p style="color:var(--muted);margin:0 0 10px;font-size:13px">${rows.length} shown · ${money(total)} total</p>` : ''}
      ${extra && !items.length ? '' : rows.length ? `<div class="cards">${rows.map((r) => renderCard(key, r)).join('')}</div>` : `<div class="empty">${items.length ? 'No matches.' : `No ${c.label.toLowerCase()} yet.`}<br /><button class="btn primary" data-action="new">Add ${c.singular.toLowerCase()}</button></div>`}`;
  }

  // Records from the Pipeline and the award register that belong on Jobs, Leads and Inbox.
  function listExtras(key) {
    const sec = (title, cards) => cards ? `<h3 class="sec">${title}</h3><div class="cards" style="margin-bottom:16px">${cards}</div>` : '';
    const mini = (open, title, sub, right, badge) => `<article class="card" data-open="${open}"><div class="card-top"><div style="min-width:0"><div class="card-title">${esc(title)}</div><div class="card-sub">${esc(sub)}</div></div>${right ? `<div class="card-value">${right}</div>` : ''}</div>${badge ? `<div class="card-meta">${badge}</div>` : ''}</article>`;
    if (key === 'jobs') {
      const act = awards().filter((c) => c.status === 'Active').sort((a, b) => String(a.end || '9').localeCompare(String(b.end || '9')));
      return sec(`Active contracts (${act.length})`, act.map((c) => mini('contracts:' + c.id, c.title, [c.agency, c.end ? 'PoP ends ' + fmtDate(c.end) : ''].filter(Boolean).join(' · '), money(c.value), '<span class="badge b-green">Active</span>')).join('')) +
        (list('jobs').length ? '<h3 class="sec">Other jobs</h3>' : '');
    }
    if (key === 'leads') {
      const su = signups();
      return sec(`New sub sign-ups from kcapexllc.com (${su.length})`, su.map((s) => mini('subs:' + s.id, s.company || 'Unnamed', [s.trade, s.area, s.signedUp ? 'signed up ' + fmtDate(s.signedUp) : ''].filter(Boolean).join(' · '), '', '<span class="badge b-gold">Not reviewed</span>')).join('')) +
        (list('leads').length ? '<h3 class="sec">Your leads</h3>' : '');
    }
    if (key === 'messages') {
      const r = coReplies();
      return sec(`Contracting officer replies to follow-ups (${r.length})`, r.map((o) => mini('bids:' + o.id, o.title || o.sol, [o.sol, o.agency, o.followups.last ? 'last touch ' + fmtDate(o.followups.last) : ''].filter(Boolean).join(' · '), '', '<span class="badge b-gold">Needs reply</span>')).join('')) +
        (list('messages').length ? '<h3 class="sec">Messages</h3>' : '');
    }
    return '';
  }

  function renderIntel() {
    const rows = liveOpps().filter((o) => o.awardPrice || o.awardee).map((o) => ({ o, ours: oppPrice(o), win: Number(o.awardPrice) || 0 }))
      .sort((a, b) => String(b.o.due || '').localeCompare(String(a.o.due || '')));
    const both = rows.filter((r) => r.ours && r.win);
    const avg = both.length ? Math.round(both.reduce((a, r) => a + (r.ours - r.win) / r.win * 100, 0) / both.length) : null;
    return `<p style="color:var(--muted);margin:0 0 10px">Who won the bids KCAPEX lost, and at what price. Use it to set price-to-win.</p>
      ${avg !== null ? `<div class="kpis" style="grid-template-columns:repeat(2,1fr)"><div class="kpi accent"><div class="kpi-label">Our price vs winner</div><div class="kpi-value">${avg > 0 ? '+' : ''}${avg}%</div><div class="kpi-sub">average over ${both.length} priced losses</div></div>
        <div class="kpi"><div class="kpi-label">Losses logged</div><div class="kpi-value">${liveOpps().filter((o) => o.status === 'lost').length}</div><div class="kpi-sub">${rows.length} with award data</div></div></div>` : ''}
      ${rows.length ? `<div class="cards">${rows.map(({ o, ours, win }) => { const d = ours && win ? Math.round((ours - win) / win * 100) : null;
        return `<article class="card" data-open="bids:${esc(o.id)}"><div class="card-title">${esc(o.title || o.sol)}</div><div class="card-sub">${esc([o.sol, o.agency].filter(Boolean).join(' · '))}</div>
          <div class="card-meta"><span>Winner <b>${esc(String(o.awardee || 'Not released').split(',')[0])}</b></span><span>Won at <b>${win ? money(win) : '—'}</b></span><span>Ours <b>${ours ? money(ours) : '—'}</b></span>${d !== null ? `<span class="badge ${d > 0 ? 'b-red' : 'b-green'}">${d > 0 ? '+' : ''}${d}%</span>` : ''}</div></article>`; }).join('')}</div>` : '<div class="empty">No award results logged yet.</div>'}`;
  }

  function renderCard(key, r) {
    const c = COLLECTIONS[key];
    const status = r[c.statusField] || (key === 'bids' ? 'found' : '');
    const v = c.value(r);
    const days = key === 'bids' ? daysUntil(r.due) : null;
    const urgent = days !== null && days >= 0 && days <= 7 && ['found', 'reviewing', 'bid'].includes(status);
    const meta = c.meta(r).filter(([, val]) => val);
    const link = key === 'bids' && safeUrl(r.link);
    return `<article class="card" data-open="${key}:${esc(r.id)}" tabindex="0">
      <div class="card-top"><div style="min-width:0"><div class="card-title">${key === 'messages' && status === 'Needs reply' ? '<span class="unread"></span>' : ''}${esc(c.title(r))}</div>
        ${c.sub(r) ? `<div class="card-sub">${esc(c.sub(r))}</div>` : ''}</div>${v ? `<div class="card-value">${money(v)}</div>` : ''}</div>
      <div class="card-meta">
        ${status ? `<span class="badge ${STATUS_COLORS[status] || 'b-muted'}">${esc(status)}</span>` : ''}
        ${urgent ? `<span class="badge b-red">Due ${days === 0 ? 'today' : `in ${days}d`}</span>` : ''}
        ${key === 'bids' && methodTag(r.method) ? `<span class="badge b-blue">${methodTag(r.method)}</span>` : ''}
        ${key === 'bids' && needsApproval(r) ? `<span class="badge b-red">Needs ${approvalTier(r) === 'owner' ? 'owner' : 'Kobe'} approval</span>` : ''}
        ${meta.map(([k, val]) => `<span>${esc(k)} <b>${esc(val)}</b></span>`).join('')}
        ${link ? `<a class="lnk" href="${esc(link)}" target="_blank" rel="noopener" data-stop="1">Open notice ↗</a>` : ''}
      </div></article>`;
  }

  function oppLine(x, src) {
    const n = daysUntil(x.due), w = qtWin(x), am = qtAmended(x), link = safeUrl(x.link);
    const tags = [x.noticeType || x.src, x.setAside, x.naics ? 'NAICS ' + x.naics : '', ui.view === 'quick' && w !== null ? `${w}-day window` : '', ui.view === 'quick' && am === true ? 'Amended' : ''].filter(Boolean);
    const score = x.rank && x.rank.score != null ? `<span class="badge ${x.rank.score >= 70 ? 'b-green' : x.rank.score >= 50 ? 'b-gold' : 'b-muted'}">Score ${esc(x.rank.score)}</span>` : '';
    const lock = !eligible(x) ? '<span class="badge b-red">Needs certification</span>' : '';
    return `<article class="card" ${src === 'opportunities' ? `data-open="bids:${esc(x.id)}"` : ''} style="${src === 'inbox' ? 'cursor:default' : ''}"><div class="opp-row">
      <div class="days ${n !== null && n <= 3 ? 'hot' : ''}">${n === null ? '--' : n}<small>${n === null ? 'no date' : n === 1 ? 'day left' : 'days left'}</small></div>
      <div style="min-width:0;flex:1"><div class="card-title">${esc(x.title || x.sol)}</div><div class="card-sub">${esc([x.sol, x.agency, x.place].filter(Boolean).join(' · '))}</div>
      <div class="card-meta">${score}${lock}${tags.map((t) => `<span class="badge b-purple">${esc(t)}</span>`).join('')}${src === 'opportunities' ? `<span class="badge ${STATUS_COLORS[x.status] || 'b-muted'}">In bids: ${esc(x.status || 'found')}</span>` : ''}</div>
      ${x.rank && x.rank.why ? `<div class="card-sub" style="margin-top:6px">${esc(x.rank.why)}</div>` : ''}
      ${src === 'inbox' ? `<div class="btn-row" style="margin-top:10px"><button class="btn primary" data-action="take" data-id="${esc(x.id)}">Add to bids</button><button class="btn" data-action="dismiss" data-id="${esc(x.id)}">Dismiss</button>${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener" style="text-decoration:none">Open notice ↗</a>` : ''}</div>` : link ? `<div style="margin-top:8px"><a class="lnk" href="${esc(link)}" target="_blank" rel="noopener" data-stop="1">Open notice ↗</a></div>` : ''}
      </div></div></article>`;
  }

  function renderNew() {
    const inbox = list('inbox').filter((x) => x.state === 'new');
    const caOut = inbox.filter((x) => blockedPlace(x.place)).length;
    const pool = newItems();
    const elig = ui.elig || 'eligible';
    const all = pool.filter((x) => elig === 'all' || (elig === 'eligible' ? eligible(x) : !eligible(x)));
    const shown = all.filter((x) => ui.level === 'all' || levelOf(x) === ui.level)
      .sort((a, b) => ((b.rank?.score ?? -1) - (a.rank?.score ?? -1)) || String(a.due || '9').localeCompare(String(b.due || '9')));
    const chip = (k, l) => `<button class="chip ${ui.level === k ? 'active' : ''}" data-level="${k}">${l}<span class="n">${k === 'all' ? all.length : all.filter((x) => levelOf(x) === k).length}</span></button>`;
    const echip = (k, l, n) => `<button class="chip ${elig === k ? 'active' : ''}" data-elig="${k}">${l}<span class="n">${n}</span></button>`;
    const scored = all.filter((x) => x.rank && x.rank.score != null).length;
    return `<p style="color:var(--muted);margin:0 0 10px">New bids from your saved searches, highest Claude score first. ${caOut} California bid${caOut === 1 ? ' is' : 's are'} excluded. ${scored} of ${all.length} have a score.</p>
      <div class="toolbar"><div class="chips">${echip('eligible', 'KCAPEX can bid', pool.filter(eligible).length)}${echip('locked', 'Needs a certification', pool.filter((x) => !eligible(x)).length)}${echip('all', 'All', pool.length)}</div>
      <div class="chips">${chip('all', 'All levels')}${chip('local', 'Local')}${chip('state', 'State')}${chip('federal', 'Federal')}</div></div>
      ${shown.length ? `<div class="cards">${shown.slice(0, 150).map((x) => oppLine(x, 'inbox')).join('')}</div>${shown.length > 150 ? `<p style="color:var(--muted)">Showing 150 of ${shown.length}. Filter by level to see more.</p>` : ''}` : '<div class="empty">Nothing new right now.</div>'}`;
  }

  function renderQuick() {
    const items = quickItems();
    return `<p style="color:var(--muted);margin:0 0 10px">Bids with 3 to 6 days from posted to due. Soonest first.</p>
      ${items.length ? `<div class="cards">${items.map((x) => oppLine(x, x._src)).join('')}</div>` : '<div class="empty">No open quick-turn bids right now.</div>'}`;
  }

  // ---------- Claude chat ----------
  // Works like the Claude app: streamed answers, saved conversations (shared across devices),
  // PDFs and photos, web search, and changes to records when asked.
  let askFocus = null, chatId = null, chatBusy = null, chatDraft = '', chatFiles = [], chatStatus = '', showChats = false;
  const live = { msgs: null }; // the conversation on screen while it streams
  const QUICK_ASKS = [
    'What should I work on today?',
    'Which bids are due this week, and what does each still need?',
    'How am I tracking against the FY27 goals?',
    'Where is my pricing too high compared with the winners?',
    'Which subs fit my open bids?',
    'Draft an award status follow-up email for my oldest submitted bid.',
  ];
  const curMsgs = () => live.msgs || (chatId && data.chats && data.chats[chatId] ? data.chats[chatId].messages || [] : []);

  // Small, safe Markdown renderer: everything is escaped first, then a known set of formats is added.
  function md(src) {
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`)
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
    const lines = String(src || '').replace(/\r/g, '').split('\n');
    let out = '', i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue; }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        let t = `<div class="tblwrap"><table><tr>${cells(l).map((c) => `<th>${inline(c)}</th>`).join('')}</tr>`; i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) t += `<tr>${cells(lines[i++]).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`;
        out += t + '</table></div>'; continue;
      }
      const h = l.match(/^(#{1,6})\s+(.*)$/); if (h) { out += `<h${Math.min(h[1].length + 2, 6)}>${inline(h[2])}</h${Math.min(h[1].length + 2, 6)}>`; i++; continue; }
      if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
        const ordered = /^\s*\d+[.)]\s+/.test(l); let t = ordered ? '<ol>' : '<ul>';
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) t += `<li>${inline(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>`;
        out += t + (ordered ? '</ol>' : '</ul>'); continue;
      }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out += '<hr>'; i++; continue; }
      if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out += `<blockquote>${inline(buf.join(' '))}</blockquote>`; continue; }
      if (!l.trim()) { i++; continue; }
      const buf = []; while (i < lines.length && lines[i].trim() && !/^(```|#{1,6}\s|\s*([-*•]|\d+[.)])\s+|>|\s*\|)/.test(lines[i])) buf.push(lines[i++]);
      if (!buf.length) buf.push(lines[i++]);
      out += `<p>${buf.map(inline).join('<br>')}</p>`;
    }
    return out;
  }

  function askBox(home) {
    if (!home) return '';
    return `<div class="panel askhome"><h2>Ask Claude</h2>
      <div class="ask-row"><textarea id="ask-home" placeholder="Ask Claude anything: bids, pricing, emails, a solicitation…" rows="2"></textarea><button class="btn primary" data-action="ask-home">Ask</button></div>
      <div class="chips" style="margin-top:8px">${QUICK_ASKS.map((q) => `<button class="chip" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
  }

  function msgHtml(m, idx, last) {
    if (m.role === 'user') return `<div class="msg user">${m.fileNames && m.fileNames.length ? `<div class="mfiles">${m.fileNames.map((n) => `<span>📎 ${esc(n)}</span>`).join('')}</div>` : ''}${esc(m.text)}</div>`;
    const streaming = last && chatBusy;
    const acts = (m.tools || []).map((t) => `<div class="act ${t.write ? 'write' : ''}">${t.write ? '✓' : '•'} ${esc(t.d)}</div>`).join('');
    const body = m.text ? md(m.text) : (streaming ? '' : '<p>(no answer)</p>');
    return `<div class="msg assistant" ${streaming ? 'id="live-msg"' : ''}>${acts ? `<div class="acts">${acts}</div>` : ''}<div class="mbody">${body}</div>
      ${streaming ? `<div class="typing"><span></span><span></span><span></span> <em id="live-status">${esc(chatStatus || 'Thinking…')}</em></div>` : ''}
      ${m.error ? `<div class="merr">${esc(m.error)}</div>` : ''}
      ${!streaming && m.text ? `<div class="mtools"><button class="copy" data-copy="${idx}">Copy</button>${last && !m.error ? '' : ''}</div>` : ''}${!streaming && last && m.error ? '<div class="mtools"><button class="copy" data-action="chat-retry">Try again</button></div>' : ''}</div>`;
  }

  // ---------- Bid folders (like Claude Projects) ----------
  // Every working bid has a folder automatically: its solicitation files, instructions and every chat about it.
  // Anything that isn't about a bid stays a plain chat. Folder extras (files, instructions, pin) are saved in
  // the "projects" collection under "bid-<bid id>" the first time they're used.
  let projView = null, chatProject = null, projMenu = null, projBusy = 0;
  const FOLDER_OPEN = ['reviewing', 'bid', 'submitted'];
  const folderId = (bidId) => 'bid-' + bidId;
  function folder(pid) {
    if (!pid || !String(pid).startsWith('bid-')) return null;
    const bidId = String(pid).slice(4), o = data.opportunities[bidId]; if (!o) return null;
    const extra = data.projects[pid] || {};
    const base = [o.sol, o.title].filter(Boolean).join(' – ').slice(0, 120) || 'Bid';
    return { id: pid, bidId, bid: o, num: extra.num || null, name: (extra.num ? `#${extra.num} ` : '') + base, description: [o.agency, o.place].filter(Boolean).join(' · '),
      files: extra.files || [], instructions: extra.instructions || '', pinned: !!extra.pinned, updatedAt: extra.updatedAt,
      closed: !FOLDER_OPEN.includes(o.status || 'found') || (o.status !== 'submitted' && isPastOpp(o)) };
  }
  const projChats = (pid) => Object.entries(data.chats || {}).map(([id, c]) => ({ id, ...c })).filter((c) => c.projectId === pid).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  function folderList() {
    const ids = new Set(liveOpps().filter((o) => FOLDER_OPEN.includes(o.status)).map((o) => folderId(o.id)));
    Object.keys(data.projects || {}).forEach((id) => ids.add(id));
    Object.values(data.chats || {}).forEach((c) => { if (c.projectId) ids.add(c.projectId); });
    return [...ids].map(folder).filter(Boolean).map((f) => { const ch = projChats(f.id)[0]; return { ...f, last: [f.updatedAt, ch && ch.updatedAt].filter(Boolean).sort().pop() }; });
  }
  // Folders are numbered #1, #2, #3… in the order the bids were added, and keep their number for good.
  // New bids get the next number as soon as their folder appears.
  let numbering = false;
  async function numberFolders() {
    if (numbering || !db || !loadedColls.has('projects') || !loadedColls.has('opportunities')) return;
    const need = folderList().filter((f) => !f.num);
    if (!need.length) return;
    numbering = true;
    try {
      let next = Math.max(0, ...Object.values(data.projects || {}).map((x) => Number(x.num) || 0)) + 1;
      const when = (f) => String(f.bid.createdAt || f.bid.posted || f.bid.updatedAt || f.bidId);
      for (const f of need.sort((a, b) => when(a).localeCompare(when(b)))) { if (await saveFolder(f.id, { num: next })) next++; }
    } finally { numbering = false; }
  }
  const curProjectId = () => { const c = chatId && data.chats && data.chats[chatId]; const id = c ? c.projectId : chatProject; return folder(id) ? id : null; };
  const ago = (iso) => { const d = new Date(iso || 0), s = (Date.now() - d) / 1000; if (!iso || isNaN(d)) return ''; if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`; if (s < 86400) return `${Math.round(s / 3600)} hours ago`; if (s < 604800) return `${Math.round(s / 86400)} days ago`; return `${Math.round(s / 604800)} weeks ago`; };
  const dueTxt = (o) => o && o.due ? `Due ${new Date(String(o.due).slice(0, 10) + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${o.dueTime ? ' ' + o.dueTime : ''}` : 'No due date';
  function projPayload(pid) {
    const f = folder(pid); if (!f) return null;
    return { name: f.name, description: f.description, instructions: f.instructions, bidId: f.bidId, fileRefs: f.files.map((x) => ({ id: x.id, name: x.name })) };
  }
  const saveFolder = (pid, patch) => saveDoc('projects', pid, { ...(data.projects[pid] || {}), ...patch });
  const openProject = (id) => { projView = id; projMenu = null; if (ui.view !== 'ask') go('ask'); else { render(); window.scrollTo({ top: 0 }); } };

  function renderProjects() {
    const q = (ui.query.projects || '').toLowerCase(), filt = ui.projFilter || 'open';
    const all = folderList(), open = all.filter((f) => !f.closed), closed = all.filter((f) => f.closed);
    const shown = (filt === 'open' ? open : closed).filter((f) => !q || `${f.name} ${f.description}`.toLowerCase().includes(q))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.num || 1e9) - (a.num || 1e9));
    const row = (f) => `<div class="proj-row ${projMenu === f.id ? 'open' : ''}"><button class="pr-open" data-proj="${esc(f.id)}"><span class="pr-ic">${f.pinned ? '📌' : '📁'}</span><span class="pr-tx"><b>${esc(f.name)}</b><em>${esc([f.closed ? (f.bid.status || 'closed') : dueTxt(f.bid), projChats(f.id).length ? `${projChats(f.id).length} chats` : '', f.files.length ? `${f.files.length} files` : '', ago(f.last)].filter(Boolean).join(' · '))}</em></span></button><button class="pr-more" data-proj-menu="${esc(f.id)}" aria-label="Folder options">⋯</button>
      ${projMenu === f.id ? `<div class="pr-menu"><button data-proj-do="pin:${esc(f.id)}">${f.pinned ? 'Unpin' : '📌 Pin'}</button><button data-open="bids:${esc(f.bidId)}">✎ Open bid</button></div>` : ''}</div>`;
    return `<div class="projwrap"><div class="chat-head"><button class="btn" data-action="proj-back">‹ Chat</button><div class="chat-title">Bid folders</div><span></span></div>
      <p class="muted" style="margin:0 0 8px">Every bid you're working has a folder. Its files, instructions and chats stay together. Other questions are just chats.</p>
      <input class="proj-search" data-search="projects" placeholder="Search bids" value="${esc(ui.query.projects || '')}" />
      <div class="chips" style="margin:8px 0"><button class="chip ${filt === 'open' ? 'active' : ''}" data-proj-filter="open">Open<span class="n">${open.length}</span></button><button class="chip ${filt === 'closed' ? 'active' : ''}" data-proj-filter="closed">Closed<span class="n">${closed.length}</span></button></div>
      <div class="proj-list">${shown.length ? shown.map(row).join('') : `<div class="tempty">${q ? 'No bids match.' : filt === 'closed' ? 'No closed bid folders yet.' : 'No bids in progress. When a bid moves to Reviewing, Bid or Submitted, its folder appears here.'}</div>`}</div></div>`;
  }

  function renderProject(id) {
    const f = folder(id); if (!f) { projView = 'list'; return renderProjects(); }
    const o = f.bid, chats = projChats(id), files = f.files;
    return `<div class="projwrap"><div class="chat-head"><button class="btn" data-action="proj-list">‹ Bid folders</button><div class="chat-title"></div><button class="btn" data-open="bids:${esc(f.bidId)}">✎ Bid</button></div>
      <div class="proj-top"><span class="pr-ic big">📁</span><div><h2>${esc(f.name)}</h2>${f.description ? `<p>${esc(f.description)}</p>` : ''}<p class="proj-bid">${esc(o.status || 'found')} · ${esc(dueTxt(o))}</p></div></div>
      <button class="btn primary proj-newchat" data-action="proj-chat">＋ New chat about this bid</button>
      <div class="panel proj-sec"><h3>Chats <span class="n">${chats.length}</span></h3>${chats.length ? chats.map((c) => `<button class="pc-row" data-chat="${esc(c.id)}"><b>${esc(c.title || 'Untitled')}</b><span>${esc(ago(c.updatedAt))} · ${(c.messages || []).length} messages</span></button>`).join('') : '<p class="muted">No chats yet. Start one above; Claude will have this bid’s files and instructions.</p>'}</div>
      <div class="panel proj-sec"><h3>Files <span class="n">${files.length} of ${MAX_FILES}</span></h3>
        ${files.map((x, i) => `<div class="pf-row"><span>${x.type === 'image/jpeg' ? '🖼' : '📄'} ${esc(x.name)}${x.label ? ` <em>${esc(x.label)}</em>` : ''}</span><button data-pfile-x="${i}" aria-label="Remove">✕</button></div>`).join('') || '<p class="muted">Add the solicitation, PWS, wage determinations, price schedule and exhibits. Every chat in this folder reads them.</p>'}
        ${projBusy ? `<p class="muted">⏳ Adding ${projBusy} file${projBusy === 1 ? '' : 's'}…</p>` : ''}
        <button class="btn" data-action="proj-attach" ${files.length >= MAX_FILES ? 'disabled' : ''}>📎 Add files</button>
        <input type="file" id="proj-file" accept="application/pdf,image/*,.docx,.txt,.csv,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple hidden /></div>
      <div class="panel proj-sec"><h3>Instructions</h3><p class="muted">What Claude should always keep in mind for this bid.</p>
        <textarea id="proj-instr" rows="4" placeholder="e.g. Price janitorial with WD 2015-4761. Use KG Grounds as the mowing sub. Keep emails short.">${esc(f.instructions)}</textarea>
        <button class="btn" data-action="proj-instr-save">Save instructions</button></div></div>`;
  }

  async function addProjectFiles(pid, list) {
    const f = folder(pid); if (!f) return;
    const room = MAX_FILES - f.files.length;
    if (room <= 0) { toast(`A bid folder holds up to ${MAX_FILES} files.`); return; }
    if (list.length > room) toast(`A bid folder holds up to ${MAX_FILES} files. Adding the first ${room}.`);
    const take = list.slice(0, room); projBusy += take.length; render();
    const added = [];
    for (const file of take) {
      try { added.push(await uploadFile(await prepFile(file))); }
      catch (e) { toast(e.message || `Couldn't add ${file.name}`); }
      projBusy--; render();
    }
    if (added.length) { await saveFolder(pid, { files: [...(folder(pid).files || []), ...added] }); toast(`Added ${added.length} file${added.length === 1 ? '' : 's'} to the bid folder`); }
    render();
  }

  function renderAsk() {
    if (projView === 'list') return renderProjects();
    if (projView) return renderProject(projView);
    const all = Object.entries(data.chats || {}).map(([id, c]) => ({ id, ...c })).filter((c) => !folder(c.projectId)).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const msgs = curMsgs(); const cur = chatId && data.chats ? data.chats[chatId] : null;
    const pid = curProjectId(), pj = folder(pid);
    const head = `<div class="chat-head"><button class="btn" data-action="proj-list">📁 Bids</button><button class="btn" data-action="chat-list">☰ Chats${all.length ? ` <span class="n">${all.length}</span>` : ''}</button>
      <div class="chat-title">${esc((cur && cur.title) || '')}</div>
      <button class="btn" data-action="chat-new" ${chatBusy ? 'disabled' : ''} aria-label="New chat" title="New chat">＋ New</button></div>
      ${pj ? `<button class="proj-chip" data-proj="${esc(pid)}">📁 ${esc(pj.name)} <span>· ${pj.files.length} files ›</span></button>` : ''}`;
    const listHtml = showChats ? `<div class="chat-list">${all.length ? all.map((c) => `<div class="chat-item ${c.id === chatId ? 'on' : ''}"><button class="ci-open" data-chat="${esc(c.id)}"><b>${esc(c.title || 'Untitled')}</b><span>${esc(new Date(c.updatedAt || Date.now()).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} · ${(c.messages || []).length} messages</span></button><button class="ci-act" data-chat-move="${esc(c.id)}" title="Move to a bid folder">📁</button><button class="ci-act" data-chat-rename="${esc(c.id)}" title="Rename">✎</button><button class="ci-act" data-chat-del="${esc(c.id)}" title="Delete">🗑</button></div>`).join('') : '<div class="tempty">No saved chats yet.</div>'}</div>` : '';
    const empty = pj ? `<div class="chat-hello"><div class="spark">📁</div><h2>${esc(pj.name)}</h2><p>New chat about this bid. Claude has its ${pj.files.length} file${pj.files.length === 1 ? '' : 's'}${pj.instructions ? ', instructions' : ''} and the bid record.</p>
      <div class="chips"><button class="chip" data-quick="Give me a bid summary: scope, due date and how to submit, site visit, evaluation, what I must price, wage rates, required forms, and whether KCAPEX should bid.">Bid summary</button><button class="chip" data-quick="Make a compliance checklist of everything the quote must include, with the section or page for each.">Compliance checklist</button><button class="chip" data-quick="Draft questions to the contracting officer about anything unclear or conflicting in this solicitation.">Questions for the CO</button><button class="chip" data-quick="Help me build the price: list each line I must price, the labor and wage rates that drive it, and what I need from subs.">Build my price</button></div></div>` : `<div class="chat-hello"><div class="spark">${icon('ask')}</div><h2>How can I help, Kobe?</h2>
      <p>I can see your bids, awards, invoices, subs and deadlines. Attach a solicitation package (PDFs, Word files, photos), ask me to search the web, draft an email, or update a record.</p>
      <div class="chips">${QUICK_ASKS.map((q) => `<button class="chip" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
    const focus = askFocus ? `<div class="focus-chip">Talking about bid <b>${esc(askFocus.sol || askFocus.title || '')}</b> <button data-action="chat-unfocus" aria-label="Stop focusing on this bid">✕</button></div>` : '';
    const files = chatFiles.length ? `<div class="cfiles-n">${chatFiles.length} of ${MAX_FILES} files</div><div class="cfiles">${chatFiles.map((f, i) => `<span class="cfile">${f.pending ? '⏳' : f.type === 'image/jpeg' ? '🖼' : '📄'} ${esc(f.name)}${f.pending ? ' <em>reading…</em>' : f.label ? ` <em>${esc(f.label)}</em>` : ''} <button data-file-x="${i}" aria-label="Remove">✕</button></span>`).join('')}</div>` : '';
    return `<div class="chatwrap">${head}${listHtml}
      <div class="chat" id="chat">${msgs.length ? msgs.map((m, i) => msgHtml(m, i, i === msgs.length - 1)).join('') : empty}</div>
      <div class="composer">${focus}${files}
        <div class="ask-row"><button class="attach-btn" data-action="chat-attach" aria-label="Attach files" title="Attach files"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
        <textarea id="ask-in" placeholder="Reply to Claude…" rows="1" enterkeyhint="send">${esc(chatDraft)}</textarea>
        ${chatBusy ? '<button class="send-btn stop" data-action="chat-stop" aria-label="Stop"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg></button>' : '<button class="send-btn" data-action="ask" id="ask-btn" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'}</div>
        <div class="attach-help" id="attach-help" hidden><b>iPhone can’t paste PDFs into web apps.</b> Tap <b>＋</b> → <b>Choose Files</b>, tap <b>Select</b> at the top right, check up to 15 files and tap <b>Open</b>. Photos and screenshots can be pasted. <button type="button" data-action="chat-attach">Choose files</button></div>
        <input type="file" id="chat-file" accept="application/pdf,image/*,.docx,.txt,.csv,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple hidden />
        <p class="chat-foot">Claude can search the web and change records in this app when you ask. It can't send email or submit bids.</p></div></div>`;
  }

  function snapshot() {
    const o = liveOpps(), pick = (x) => ({ id: x.id, sol: x.sol, title: x.title, agency: x.agency, status: x.status, due: x.due, price: oppPrice(x) || null, method: methodTag(x.method), quotes: quoteSummary(x) || null, approval: needsApproval(x) ? approvalTier(x) : null });
    return {
      today: isoDay(), fiscalYear: 'FY27 runs 1 Oct 2026 to 30 Sep 2027', goals: GOALS,
      working: o.filter((x) => ['reviewing', 'bid'].includes(x.status) && !isPastOpp(x)).map(pick),
      submitted: o.filter((x) => x.status === 'submitted').map(pick),
      foundOpen: o.filter((x) => (x.status || 'found') === 'found' && !isPastOpp(x)).slice(0, 15).map(pick),
      needsCloseOut: o.filter((x) => ['found', 'reviewing', 'bid'].includes(x.status || 'found') && isPastOpp(x)).length,
      lost: o.filter((x) => x.status === 'lost').slice(-20).map((x) => ({ sol: x.sol, title: x.title, ours: oppPrice(x) || null, winner: x.awardee || null, winningPrice: x.awardPrice || null })),
      awards: Object.entries(data.contracts || {}).filter(([, c]) => c.status !== 'Cancelled').map(([id, c]) => ({ id, title: c.title, agency: c.agency, value: c.value, status: c.status, awardDate: c.awardDate, end: c.end })),
      invoices: list('invoices').slice(-30).map((i) => ({ contract: (data.contracts[i.contractId] || {}).title, number: i.number, amount: i.amount, status: i.status, sent: i.sent })),
      siteVisits: list('visits').map((v) => ({ title: v.title, date: v.date, time: v.time, location: v.location, status: v.status })),
      quickTurn: quickItems().slice(0, 15).map((x) => ({ sol: x.sol, title: x.title, due: x.due, window: qtWin(x) })),
      contactsToTouch: list('contacts').filter((c) => ['cold', 'due'].includes(relState(c).k)).slice(0, 15).map((c) => ({ name: c.name, agency: c.agency, role: c.role })),
      subs: list('subs').slice(0, 30).map((x) => ({ company: x.company, trade: x.trade, area: x.area, rating: x.rating })),
      focusBid: askFocus,
    };
  }

  function scrollChat() { const c = $('#chat'); if (c) c.scrollTop = c.scrollHeight; }
  let liveRaf = 0;
  // Smooth reveal, like the Claude app: text arrives in bursts from the server, but the screen eases it in a
  // few characters per frame, catching up faster when it falls behind.
  let shownLen = 0;
  function paintLive() { if (!liveRaf) liveRaf = requestAnimationFrame(revealStep); }
  function revealStep() {
    liveRaf = 0;
    if (ui.view !== 'ask') return;
    const msgs = curMsgs(), m = msgs[msgs.length - 1], el = $('#live-msg');
    if (!el || !m) return render();
    const target = m.text || '', back = target.length - shownLen;
    shownLen = back > 0 ? Math.min(target.length, shownLen + Math.max(2, Math.ceil(back / 8))) : target.length;
    const c = $('#chat'); const atBottom = c && c.scrollHeight - c.scrollTop - c.clientHeight < 90;
    el.querySelector('.mbody').innerHTML = md(target.slice(0, shownLen));
    const acts = (m.tools || []).map((t) => `<div class="act ${t.write ? 'write' : ''}">${t.write ? '✓' : '•'} ${esc(t.d)}</div>`).join('');
    let a = el.querySelector('.acts'); if (acts) { if (!a) { a = document.createElement('div'); a.className = 'acts'; el.prepend(a); } a.innerHTML = acts; }
    const st = $('#live-status'); if (st) st.textContent = chatStatus || 'Thinking…';
    if (atBottom) scrollChat();
    if (shownLen < target.length) liveRaf = requestAnimationFrame(revealStep);
  }
  const revealDone = (reply) => new Promise((res) => { const t0 = Date.now(); (function wait() { if (shownLen >= (reply.text || '').length || Date.now() - t0 > 2500 || ui.view !== 'ask') return res(); paintLive(); setTimeout(wait, 50); })(); });

  async function saveChat(msgs) {
    if (!chatId) return;
    const prev = (data.chats || {})[chatId] || {};
    const firstQ = (msgs.find((m) => m.role === 'user') || {}).text || 'New chat';
    const clean = msgs.map((m) => ({ role: m.role, text: m.text || '', ...(m.fileNames ? { fileNames: m.fileNames } : {}), ...(m.fileRefs ? { fileRefs: m.fileRefs } : {}), ...(m.tools ? { tools: m.tools } : {}), ...(m.error ? { error: m.error } : {}) })).slice(-60);
    const body = { ...prev, title: prev.title || firstQ.replace(/\s+/g, ' ').slice(0, 60), messages: clean, ...(prev.projectId || chatProject ? { projectId: prev.projectId || chatProject } : {}) };

    data.chats = { ...(data.chats || {}), [chatId]: body };
    await saveDoc('chats', chatId, body);
  }

  // ----- Attachments -----
  // PDFs: long ones with real text go to Claude as text (cheaper, no size limit); scanned or short ones go
  // as the PDF itself so Claude can see the pages. Word files go as text. Photos are shrunk to 1600px.
  // Everything uploads in 3 MB pieces first, so phone-sized requests never hit the function limit.
  // Up to 15 files per message. The size caps (20 MB of PDFs/photos, about 450,000 characters of text) keep
  // each request inside what Claude reads in one go, so answers stay fast.
  const MAX_FILES = 15, NATIVE_MAX = 20 * 1024 * 1024, TEXT_MAX = 450000, PIECE = 4000000;
  const libs = {};
  function loadScript(url) { return libs[url] || (libs[url] = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = url; sc.onload = res; sc.onerror = () => { delete libs[url]; rej(new Error('Could not load the file reader. Check your connection.')); }; document.head.appendChild(sc); })); }
  async function pdfjs() {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return window.pdfjsLib;
  }
  const fmtMB = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const isDocx = (f) => /\.docx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isText = (f) => /^text\//.test(f.type) || /\.(txt|csv|md)$/i.test(f.name);

  async function prepFile(f) {
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      let pages = 0, text = '';
      try {
        const lib = await pdfjs(); const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise; pages = doc.numPages;
        for (let i = 1; i <= Math.min(pages, 400) && text.length < 320000; i++) {
          const tc = await (await doc.getPage(i)).getTextContent();
          text += `\n--- Page ${i} ---\n` + tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+\n/g, '\n');
        }
      } catch (e) { if (f.size > NATIVE_MAX) throw new Error(`${f.name}: ${e.message}`); }
      const textual = pages && text.replace(/--- Page \d+ ---|\s/g, '').length / pages > 250;
      const asText = { name: f.name, type: 'text/plain', text: text.slice(0, 300000), pages, label: `${pages} pages, read as text`, note: `Text pulled from the PDF ${f.name} (${pages} pages).${text.length > 300000 ? ' Cut off after about 300,000 characters.' : ''}` };
      if (textual && (pages > 10 || f.size > 8 * 1048576)) return asText;
      if (f.size <= NATIVE_MAX && (!pages || pages <= 100)) return { name: f.name, type: 'application/pdf', blob: f, pages, label: pages ? `${pages} page${pages === 1 ? '' : 's'}` : fmtMB(f.size) };
      if (textual) return asText;
      throw new Error(`${f.name} is a scanned PDF too large to send (${pages} pages, ${fmtMB(f.size)}). Split it into parts under 100 pages and 20 MB.`);
    }
    if (isDocx(f)) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
      const r = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
      return { name: f.name, type: 'text/plain', text: r.value.slice(0, 300000), label: 'Word file, read as text', note: `Text of the Word document ${f.name}.` };
    }
    if (isText(f)) { const t = await f.text(); return { name: f.name, type: 'text/plain', text: t.slice(0, 300000), label: 'text', note: `Contents of ${f.name}.` }; }
    if (/^image\//.test(f.type)) {
      const url = URL.createObjectURL(f);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }).catch(() => null);
      URL.revokeObjectURL(url);
      if (!img) throw new Error(`Couldn't read ${f.name}`);
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      return { name: f.name || 'photo.jpg', type: 'image/jpeg', data: cv.toDataURL('image/jpeg', 0.85).split(',')[1], label: 'photo' };
    }
    throw new Error(`${f.name}: attach a PDF, Word file, text file or photo`);
  }

  function attachHelp() {
    const el = $('#attach-help'); if (el) { el.hidden = false; el.scrollIntoView({ block: 'nearest' }); }
    else toast('iPhone can’t paste PDFs into apps like this. Tap 📎, then Choose Files.');
  }
  async function readFiles(fileList) {
    const room = MAX_FILES - chatFiles.length;
    if (room <= 0) { toast(`Up to ${MAX_FILES} files per message. Send these first, then attach more.`); return; }
    if (fileList.length > room) toast(`Up to ${MAX_FILES} files per message. Added the first ${room}; send, then attach the rest.`);
    for (const f of fileList.slice(0, room)) {
      const ph = { name: f.name || 'file', pending: true }; chatFiles.push(ph); render();
      try {
        const a = await prepFile(f); const i = chatFiles.indexOf(ph); if (i < 0) continue; // removed while reading
        const bin = chatFiles.reduce((n, x) => n + (x.blob ? x.blob.size : x.data ? x.data.length * 0.75 : 0), 0) + (a.blob ? a.blob.size : 0);
        const txt = chatFiles.reduce((n, x) => n + (x.text ? x.text.length : 0), 0) + (a.text ? a.text.length : 0);
        const pages = chatFiles.reduce((n, x) => n + (x.blob ? x.pages || 10 : 0), 0) + (a.blob ? a.pages || 10 : 0);
        if (bin > NATIVE_MAX || txt > TEXT_MAX || pages > 100) { chatFiles.splice(i, 1); toast(`${f.name} would put this message over the limit. Send it in the next message.`); }
        else chatFiles[i] = a;
      } catch (e) { chatFiles = chatFiles.filter((x) => x !== ph); toast(e.message || `Couldn't read ${f.name}`); }
      render();
    }
    const t = $('#ask-in'); if (t) t.focus();
  }

  async function uploadFile(a, onPiece) {
    const payload = a.blob ? await toB64(a.blob) : a.text != null ? a.text : a.data;
    const total = Math.max(1, Math.ceil(payload.length / PIECE)); let id = null;
    for (let i = 0; i < total; i++) {
      onPiece && onPiece(i, total);
      const r = await fetch('/api/upload', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, index: i, total, name: a.name, type: a.type, pages: a.pages, note: a.note, data: payload.slice(i * PIECE, (i + 1) * PIECE) }) });
      if (r.status === 401) { location.replace('/?fresh=' + Date.now()); throw new Error('Signed out'); }
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Upload failed (error ${r.status}).`);
      id = j.id;
    }
    return { id, name: a.name, type: a.type, label: a.label };
  }

  async function askClaude(preset, retry) {
    if (chatBusy) return;
    const inp = $('#ask-in') || $('#ask-home');
    const q = retry ? '' : (preset || (inp && inp.value) || '').trim();
    if (!retry && !q && !chatFiles.length) return;
    projView = null;
    if (ui.view !== 'ask') { showChats = false; go('ask'); }
    if (!chatId) chatId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let msgs = [...curMsgs()];
    if (chatFiles.some((f) => f.pending)) { toast('Still reading your file. One moment.'); return; }
    const files = retry ? [] : chatFiles;
    let userMsg = null;
    if (retry) { if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop(); }
    else { userMsg = { role: 'user', text: q || 'Please look at the attached files.', ...(files.length ? { fileNames: files.map((f) => f.name) } : {}) }; msgs.push(userMsg); }
    const reply = { role: 'assistant', text: '', tools: [] }; msgs.push(reply);
    live.msgs = msgs; chatDraft = ''; chatFiles = []; chatStatus = files.length ? 'Uploading your files…' : 'Thinking…';
    const ctrl = new AbortController(); chatBusy = ctrl; shownLen = 0;
    render(); scrollChat();
    let wrote = false;
    try {
      // Files upload first, then stay with the conversation so follow-up questions can use them too.
      if (files.length) {
        // Three uploads at a time keeps a 15-file package quick without flooding a phone connection.
        const refs = new Array(files.length); let next = 0, doneN = 0;
        const status = () => { chatStatus = files.length > 1 ? `Uploading files (${doneN} of ${files.length} done)…` : `Uploading ${files[0].name}…`; paintLive(); };
        status();
        await Promise.all(Array.from({ length: Math.min(3, files.length) }, async () => {
          while (next < files.length) { const n = next++; refs[n] = await uploadFile(files[n]); doneN++; status(); }
        }));
        userMsg.fileRefs = refs; chatStatus = 'Reading your files…'; paintLive();
      }
      const send = msgs.slice(0, -1).map((m) => ({ role: m.role, text: m.text, fileNames: m.fileNames, fileRefs: m.fileRefs }));
      const project = projPayload(curProjectId());
      const apply = (ev, cont) => {
        if (ev.t === 'text') { reply.text += ev.d; chatStatus = 'Writing…'; }
        else if (ev.t === 'status') { if (!reply.text) chatStatus = ev.d; }
        else if (ev.t === 'tool') { reply.tools.push({ d: ev.d, write: !!ev.write }); if (ev.write) wrote = true; }
        else if (ev.t === 'error') reply.error = ev.d;
        paintLive();
      };
      const sleep = (ms) => new Promise((res, rej) => { const t = setTimeout(res, ms); ctrl.signal.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('Stopped'), { name: 'AbortError' })); }, { once: true }); });
      // Fast path: stream the answer live, word by word (most questions finish well inside the ~25 s a request may run).
      async function stream(msgsToSend) {
        const r = await fetch('/api/chat', { method: 'POST', credentials: 'same-origin', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: msgsToSend, snapshot: snapshot(), project }) });
        if (r.status === 401) { location.replace('/?fresh=' + Date.now()); throw new Error('Signed out'); }
        if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Claude could not answer (error ${r.status}).`); }
        const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', done = false, more = false;
        while (!done) {
          const { value, done: end } = await rd.read(); if (end) break;
          buf += dec.decode(value, { stream: true }); let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl); buf = buf.slice(nl + 1); if (!line.trim()) continue;
            let ev; try { ev = JSON.parse(line); } catch (_) { continue; }
            if (ev.t === 'cont') more = true; else if (ev.t === 'done') done = true; else apply(ev);
          }
        }
        return { done, more };
      }
      // Long path: run in the background (no time limit) and check progress twice a second.
      async function background(msgsToSend, keepText) {
        const base = keepText ? reply.text : '', baseTools = keepText ? [...reply.tools] : [];
        const jobId = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        const st = await fetch('/.netlify/functions/chat-background', { method: 'POST', credentials: 'same-origin', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobId, messages: msgsToSend, snapshot: snapshot(), project }) });
        if (st.status === 401) { location.replace('/?fresh=' + Date.now()); throw new Error('Signed out'); }
        if (!st.ok) throw new Error(`Claude could not start (error ${st.status}).`);
        let lastChange = Date.now(), lastUpdated = 0, misses = 0;
        for (;;) {
          await sleep(450);
          let j;
          try { const r = await fetch('/api/job?id=' + jobId, { credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal }); if (r.status === 401) { location.replace('/?fresh=' + Date.now()); return; } j = await r.json(); misses = 0; }
          catch (e) { if (e.name === 'AbortError') throw e; if (++misses > 40) throw new Error('Lost touch with Claude. Check your connection.'); continue; }
          if (j.pending) { if (Date.now() - lastChange > 60000) throw new Error('Claude did not start. Try again.'); continue; }
          if (j.updated !== lastUpdated) { lastUpdated = j.updated; lastChange = Date.now(); }
          else if (Date.now() - lastChange > 120000) throw new Error('Claude stopped responding. Try again.');
          reply.text = base + (j.text || ''); reply.tools = [...baseTools, ...(j.tools || [])];
          if (reply.tools.some((t) => t.write)) wrote = true;
          chatStatus = j.text ? 'Writing…' : (j.status || 'Thinking…');
          if (j.error) reply.error = j.error;
          paintLive();
          if (j.done) return;
        }
      }
      const heavy = send.some((m) => (m.fileRefs || []).length) || (project && project.fileRefs.length);
      if (heavy) await background(send);
      else {
        const r1 = await stream(send);
        if (r1.more && !reply.error) {
          // Ran past the time limit: carry on in the background from where it stopped.
          chatStatus = 'Still working…'; paintLive();
          if (reply.text) await background([...send, { role: 'assistant', text: reply.text }, { role: 'user', text: '[continue]' }], true);
          else { reply.tools = []; await background(send); }
        } else if (!r1.done && !reply.error) reply.error = 'The answer was cut off. Ask Claude to continue.';
      }
      await revealDone(reply);
    } catch (e) {
      reply.error = e.name === 'AbortError' ? 'Stopped.' : (e.message && !/fetch|network/i.test(e.message) ? e.message : 'Could not reach Claude. Check your connection.');
    }
    if (!reply.tools.length) delete reply.tools;
    chatBusy = null; chatStatus = '';
    await saveChat(msgs);
    live.msgs = null;
    if (wrote) { toast('Claude updated your command center'); if (window.kcPull) window.kcPull(); }
    if (ui.view === 'ask') { render(); scrollChat(); }
  }
  function syncLine(long) {
    const m = window.kcMeta || {}; const t = (iso) => { if (!iso) return 'never'; const d = new Date(iso); return isNaN(d) ? 'never' : (isoDay(d) === isoDay() ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ') + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
    return long ? `Last sync with Claude: <b>${t(m.lastSync)}</b>. App refreshed: <b>${t(m.pulledAt)}</b>. The sync runs at 6:40 AM and 7:40 PM Central.` : `Claude sync ${t(m.lastSync)}`;
  }

  function renderMore() {
    const n = counts();
    const tile = (v, sub) => `<button class="tile" data-go="${v.id}">${icon(v.icon)}<b>${esc(v.label)}</b><span>${sub}</span></button>`;
    return `<div class="tiles">
        ${tile(EXTRA[0], `${n.new} new`)}${tile(EXTRA[1], `${n.quick} open`)}
        ${tile(EXTRA[2], `${list('contacts').length} contacts`)}${tile(EXTRA[3], `${list('subs').length} subcontractors`)}${tile(EXTRA[4], `${list('pastperf').length} past performance`)}
        ${tile(EXTRA[5], `${list('invoices').length} logged · ${n.invoices} unpaid`)}${tile(EXTRA[6], `${liveOpps().filter((o) => o.awardPrice || o.awardee).length} award results`)}
        ${tile(EXTRA[7], `${n.visits} upcoming`)}${tile(EXTRA[8], 'Ask about your bids')}<button class="tile" data-action="proj-open-list">${icon('folder')}<b>Bid folders</b><span>${folderList().filter((f) => !f.closed).length} open</span></button>
      </div>
      <div class="panel settings" style="margin-bottom:14px"><h2>Install on your phone</h2>
        <ol class="install-steps"><li><b>iPhone:</b> Safari → Share → <b>Add to Home Screen</b>.</li><li><b>Android:</b> Chrome → ⋮ → <b>Install app</b>.</li></ol></div>
      <div class="panel settings" style="margin-bottom:14px"><h2>Sync</h2><p>Bids, New, Quick-turn, People, Subs and Library sync with your KCAPEX Pipeline in Claude on a schedule. Leads, Jobs, Contracts, Invoices and Inbox live in this app and are shared across your devices.</p>
        <p>${syncLine(true)}</p>
        <div class="btn-row"><button class="btn" data-action="export">Export backup</button><button class="btn" data-action="reload">Get the latest version</button><a class="btn" href="/__logout" style="text-decoration:none">Sign out</a></div>
        <p style="color:var(--muted);font-size:12px;margin-top:10px">App version ${APP_VERSION}</p></div>`;
  }

  // ---------- Modal / CRUD ----------
  const modal = $('#modal'), form = $('#modal-form');
  let editing = null;

  function openForm(key, id) {
    const c = COLLECTIONS[key]; if (!c) return;
    const rec = id ? data[c.coll][id] : null;
    if (id && !rec) return;
    editing = { key, id };
    const sf = c.fields.find((f) => f.key === c.statusField);
    const defaults = { [c.statusField]: sf.options[0], date: isoDay(), method: 'Email' };
    form.innerHTML = `
      <div class="modal-head"><h3>${rec ? 'Edit' : 'New'} ${esc(c.singular.toLowerCase())}</h3><button type="button" class="icon-btn" data-action="close" aria-label="Close">✕</button></div>
      <div class="fields">${c.fields.map((f) => {
        let v = rec ? rec[f.key] ?? '' : defaults[f.key] ?? '';
        if (f.type === 'date') v = dayOf(v);
        const fid = 'f-' + f.key; let input;
        if (f.optionsFn) { const opts = f.optionsFn(); input = `<select id="${fid}" name="${f.key}"><option value="">Choose…</option>${opts.map(([val, lab]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`; }
        else if (f.type === 'select') { const opts = v && !f.options.includes(v) ? [v, ...f.options] : f.options; input = `<select id="${fid}" name="${f.key}">${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; }
        else if (f.type === 'textarea') input = `<textarea id="${fid}" name="${f.key}">${esc(v)}</textarea>`;
        else input = `<input id="${fid}" name="${f.key}" type="${f.type}" ${f.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(v)}" ${f.required ? 'required' : ''} />`;
        return `<div class="field ${f.full ? 'full' : ''}"><label for="${fid}">${esc(f.label)}</label>${input}</div>`;
      }).join('')}</div>
      ${rec && safeUrl(rec.link) ? `<p style="margin:12px 0 0"><a class="lnk" href="${esc(safeUrl(rec.link))}" target="_blank" rel="noopener">Open notice ↗</a></p>` : ''}
      ${rec && key === 'bids' ? bidExtras(rec) : ''}
      ${rec && key === 'contracts' ? contractExtras(id) : ''}
      ${c.notes && rec ? `<div class="notes"><div class="field"><label for="f-note">Add a note</label><input id="f-note" name="__note" placeholder="Call, email, site visit, decision..." /></div>
        ${(Array.isArray(rec.notes) ? rec.notes : []).slice(-6).reverse().map((nt) => `<div class="note"><small>${esc(nt && nt.t)}</small>${esc(nt && nt.text)}</div>`).join('')}</div>` : ''}
      <div class="modal-actions">${rec ? '<button type="button" class="btn danger" data-action="delete">Delete</button>' : '<span></span>'}
        <div class="btn-row"><button type="button" class="btn" data-action="close">Cancel</button><button type="submit" class="btn primary">Save</button></div></div>`;
    modal.showModal();
    if (!rec) setTimeout(() => form.querySelector('input,select,textarea')?.focus(), 50);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { key, id } = editing; const c = COLLECTIONS[key];
    const docId = id || uid();
    const body = { ...(id ? data[c.coll][id] : {}) };
    c.fields.forEach((f) => { const raw = form.elements[f.key].value.trim(); body[f.key] = f.type === 'number' ? (raw === '' ? null : Number(raw)) : raw; });
    const note = form.elements.__note && form.elements.__note.value.trim();
    if (note) body.notes = [...(Array.isArray(body.notes) ? body.notes : []), { t: new Date().toLocaleString(), text: note }];
    if (key === 'bids' && id && data.opportunities[id] && data.opportunities[id].status !== body.status) {
      body.notes = [...(Array.isArray(body.notes) ? body.notes : []), { t: new Date().toLocaleString(), text: `Moved from ${data.opportunities[id].status || 'found'} to ${body.status}` }];
    }
    if (await saveDoc(c.coll, docId, body)) { modal.close(); toast(`${c.singular} saved`); }
  });

  function bidExtras(o) {
    const box = (t, body) => body ? `<div class="xbox"><h4>${t}</h4>${body}</div>` : '';
    const subs = [...(o.subIds || []).map((x) => data.subs[x] && data.subs[x].company).filter(Boolean), ...(o.subsTxt ? [o.subsTxt] : [])];
    const quotes = Object.entries(o.quotes || {}).map(([sid, q]) => `<div class="xrow"><span>${esc((data.subs[sid] || {}).company || sid)}</span><span class="badge ${q.status === 'received' ? 'b-green' : q.status === 'requested' ? 'b-gold' : 'b-muted'}">${esc(q.status)}${q.amount ? ' ' + money(q.amount) : ''}</span><small>asked ${esc(q.sentOn || '')}${q.dueOn ? ' · need by ' + esc(q.dueOn) : ''}${q.chases ? ' · chased ' + q.chases + 'x' : ''}</small></div>`).join('');
    const pt = pricingTotal(o);
    const intel = o.awardee || o.awardPrice ? `<div class="xrow"><span>Winner: <b>${esc(o.awardee || 'Not released')}</b></span>${o.awardPrice ? `<span>at <b>${money(o.awardPrice)}</b></span>` : ''}${o.awardPrice && oppPrice(o) ? `<span class="badge ${oppPrice(o) > o.awardPrice ? 'b-red' : 'b-green'}">ours ${money(oppPrice(o))} (${Math.round((oppPrice(o) - o.awardPrice) / o.awardPrice * 100)}%)</span>` : ''}</div>` : '';
    return `<div class="xboxes">
      <button type="button" class="btn askbid" data-action="ask-bid">${icon('ask')} Ask Claude about this bid</button>
      <button type="button" class="btn" data-action="bid-project">📁 Open bid folder</button>
      ${needsApproval(o) ? `<div class="xbox" style="border-color:var(--red)"><h4>${approvalTier(o) === 'owner' ? "Needs the majority owner's sign-off" : "Needs Kobe's approval"}</h4><p>${money(oppPrice(o))} · ${approvalTier(o) === 'owner' ? 'over $500K' : '$10K to $500K'}. Approve before it is submitted.</p><button type="button" class="btn primary" data-action="approve" data-tier="${approvalTier(o)}">Mark approved by ${approvalTier(o) === 'owner' ? 'the majority owner' : 'Kobe'}</button></div>` : ''}
      ${['found', 'reviewing', 'bid'].includes(o.status || 'found') && isPastOpp(o) ? `<div class="xbox" style="border-color:var(--red)"><h4>Past due and never sent</h4><p>Close it out so it stops counting as open.</p><button type="button" class="btn" data-action="nobid">Close as no-bid</button></div>` : ''}
      ${box('Subcontractors and quotes', (subs.length ? `<p>${esc(subs.join(' · '))}</p>` : '') + (quotes || (subs.length ? '<p style="color:var(--muted)">No quote requests logged.</p>' : '')))}
      ${box('Pricing and margin', marginBox(o))}
      ${box('Submission', o.method || o.submittedOn ? `<p>${esc(o.method || '')}${o.submittedOn ? ' · submitted ' + esc(fmtDate(o.submittedOn)) : ''}</p>` : '')}
      ${box('Evaluation', o.evaluation ? `<p>${esc(typeof o.evaluation === 'string' ? o.evaluation : JSON.stringify(o.evaluation))}</p>` : '')}
      ${box('Price intel', intel)}
      ${o.followups && o.followups.lastReplyId && !o.followups.replyHandled ? `<div class="xbox"><h4>The contracting officer replied</h4><p>Last touch ${esc(fmtDate(o.followups.last))}. Answer it in Gmail, then clear it here.</p><button type="button" class="btn" data-action="replied">Mark replied</button></div>` : ''}
    </div>`;
  }
  function marginBox(o) {
    const lines = (o.pricing && Array.isArray(o.pricing.lines)) ? o.pricing.lines : [];
    const cost = lines.reduce((a, l) => a + (Number(l.cost) || 0), 0), price = pricingTotal(o);
    const subQ = Object.values(o.quotes || {}).filter((q) => q.status === 'received' && q.amount).reduce((a, q) => a + Number(q.amount), 0);
    const ours = Number(o.ourPrice) || price;
    const base = cost || subQ;
    if (!ours && !base) return '';
    const m = ours && base ? Math.round((ours - base) / ours * 1000) / 10 : null;
    return `<p>Our price <b>${ours ? money(Math.round(ours)) : '—'}</b> · sub cost <b>${base ? money(Math.round(base)) : '—'}</b>${m !== null ? ` · margin <b style="color:${m < 5 ? 'var(--red)' : 'var(--green)'}">${m}%</b>` : ''}</p>${lines.length ? `<p style="color:var(--muted)">${lines.length} CLIN${lines.length === 1 ? '' : 's'} on the pricing sheet · ${o.pricing.mode === 'margin' ? 'margin' : 'markup'} ${o.pricing.pct}%</p>` : ''}`;
  }
  function contractExtras(cid) {
    const inv = list('invoices').filter((i) => i.contractId === cid).sort((a, b) => String(b.sent || '').localeCompare(String(a.sent || '')));
    const billed = inv.filter((i) => i.status !== 'Draft').reduce((a, i) => a + (Number(i.amount) || 0), 0), paid = inv.filter((i) => i.status === 'Paid').reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const val = Number((data.contracts[cid] || {}).value) || 0;
    return `<div class="xboxes"><div class="xbox"><h4>Invoices and payments</h4>
      <p>Invoiced <b>${money(billed)}</b> · paid <b>${money(paid)}</b>${val ? ` · left to bill <b>${money(Math.max(0, val - billed))}</b>` : ''}</p>
      ${inv.map((i) => `<div class="xrow"><span>${esc(i.number || '')}</span><span>${money(i.amount)}</span><span class="badge ${i.status === 'Paid' ? 'b-green' : i.status === 'Sent' ? 'b-gold' : 'b-muted'}">${esc(i.status || '')}</span><small>${esc(fmtDate(i.sent))}</small></div>`).join('')}
      <button type="button" class="btn" data-action="new-invoice" data-id="${esc(cid)}">Add invoice</button></div></div>`;
  }

  async function takeIn(id) {
    const x = data.inbox[id]; if (!x) return;
    const body = { title: x.title, sol: x.sol, agency: x.agency, office: x.office, noticeType: x.noticeType || 'Other', setAside: x.setAside, naics: x.naics, place: x.place,
      posted: dayOf(x.posted), due: dayOf(x.due), dueTime: x.due && String(x.due).length > 10 ? new Date(x.due).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '',
      method: 'Email', status: 'found', link: x.link, contactIds: [], contactsTxt: x.contact ? [x.contact.name, x.contact.email, x.contact.phone].filter(Boolean).join(', ') : '',
      ...(x.lastNotice ? { lastNotice: x.lastNotice } : {}), ...(typeof x.amended === 'boolean' ? { amended: x.amended } : {}),
      notes: [{ t: new Date().toLocaleString(), text: `Added from saved search "${x.feed || ''}" (${x.src || ''}) in the phone app.` }] };
    if (await saveDoc('opportunities', id, body)) { await saveDoc('inbox', id, { ...x, state: 'added' }); toast('Added to bids'); }
  }

  // ---------- Events ----------
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-stop]')) return; // links inside cards
    const qk = e.target.closest('[data-quick]'); if (qk) { if (ui.view !== 'ask') { chatId = null; askFocus = null; } askClaude(qk.dataset.quick); return; }
    const cp = e.target.closest('[data-copy]'); if (cp) { const m = curMsgs()[Number(cp.dataset.copy)]; const txt = m ? m.text : ''; navigator.clipboard?.writeText(txt).then(() => toast('Copied'), () => toast('Select and copy manually')); return; }
    const ch = e.target.closest('[data-chat]'); if (ch) { if (!chatBusy) { chatId = ch.dataset.chat; chatProject = (data.chats[chatId] || {}).projectId || null; askFocus = null; showChats = false; projView = null; render(); scrollChat(); } return; }
    const pj = e.target.closest('[data-proj]'); if (pj) { openProject(pj.dataset.proj); return; }
    const pm = e.target.closest('[data-proj-menu]'); if (pm) { projMenu = projMenu === pm.dataset.projMenu ? null : pm.dataset.projMenu; render(); return; }
    const pf = e.target.closest('[data-proj-filter]'); if (pf) { ui.projFilter = pf.dataset.projFilter; projMenu = null; render(); return; }
    const pd = e.target.closest('[data-proj-do]'); if (pd) {
      const [act, id] = [pd.dataset.projDo.split(':')[0], pd.dataset.projDo.slice(pd.dataset.projDo.indexOf(':') + 1)]; const f = folder(id); projMenu = null; if (!f) return;
      if (act === 'pin') await saveFolder(id, { pinned: !f.pinned });
      render(); return;
    }
    const px = e.target.closest('[data-pfile-x]'); if (px) { const f = folder(projView); if (!f) return; const files = [...f.files]; const [gone] = files.splice(Number(px.dataset.pfileX), 1); if (gone && confirm(`Remove ${gone.name} from this bid folder?`)) await saveFolder(projView, { files }); render(); return; }
    const mv = e.target.closest('[data-chat-move]'); if (mv) {
      const id = mv.dataset.chatMove, c = data.chats[id]; const ps = folderList().filter((f) => !f.closed).sort((a, b) => String(a.bid.due || '9').localeCompare(String(b.bid.due || '9')));
      if (!ps.length) { toast('No open bids to move it to. Set the bid to Reviewing, Bid or Submitted first.'); return; }
      const ans = prompt(`Move this chat to which bid folder? Type the number.\n${ps.map((p, i) => `${i + 1}. ${p.name}`).join('\n')}\n0. Just a chat (no folder)`);
      if (ans === null) return; const k = Number(ans);
      if (k === 0) { const { projectId, ...rest } = c; await saveDoc('chats', id, rest); }
      else if (ps[k - 1]) await saveDoc('chats', id, { ...c, projectId: ps[k - 1].id });
      if (chatId === id) chatProject = k ? (ps[k - 1] || {}).id || null : null; render(); return;
    }
    const cr = e.target.closest('[data-chat-rename]'); if (cr) { const id = cr.dataset.chatRename, c = data.chats[id]; const n = c && prompt('Rename this chat', c.title || ''); if (n && n.trim()) await saveDoc('chats', id, { ...c, title: n.trim().slice(0, 80) }); render(); return; }
    const cd = e.target.closest('[data-chat-del]'); if (cd) { const id = cd.dataset.chatDel; if (!confirm('Delete this chat?')) return; await removeDoc('chats', id); if (chatId === id) chatId = null; render(); return; }
    const fx = e.target.closest('[data-file-x]'); if (fx) { chatFiles.splice(Number(fx.dataset.fileX), 1); render(); return; }
    const t = e.target.closest('[data-go],[data-open],[data-filter],[data-action],[data-level],[data-elig]');
    if (!t) return;
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.open) { const i = t.dataset.open.indexOf(':'); return openForm(t.dataset.open.slice(0, i), t.dataset.open.slice(i + 1)); }
    if (t.dataset.filter) { const i = t.dataset.filter.indexOf(':'); ui.filter[t.dataset.filter.slice(0, i)] = t.dataset.filter.slice(i + 1); return t.dataset.go2 ? go(t.dataset.go2) : render(); }
    if (t.dataset.level) { ui.level = t.dataset.level; return render(); }
    if (t.dataset.elig) { ui.elig = t.dataset.elig; return render(); }
    const a = t.dataset.action;
    if (a === 'close') modal.close();
    else if (a === 'new') openForm(ui.view);
    else if (a === 'delete') {
      if (!confirm('Delete this record? This cannot be undone.')) return;
      const c = COLLECTIONS[editing.key];
      if (await removeDoc(c.coll, editing.id)) { modal.close(); toast('Deleted'); }
    } else if (a === 'approve' || a === 'replied') {
      const id = editing.id, o = data.opportunities[id]; if (!o) return;
      const body = { ...o, notes: [...(Array.isArray(o.notes) ? o.notes : []), { t: new Date().toLocaleString(), text: a === 'approve' ? (t.dataset.tier === 'owner' ? 'Approved by the majority owner (bid over $500K), from the phone app.' : 'Approved by Kobe ($10K to $500K), from the phone app.') : 'Contracting officer reply answered, from the phone app.' }] };
      if (a === 'replied') body.followups = { ...o.followups, replyHandled: o.followups.lastReplyId };
      if (await saveDoc('opportunities', id, body)) { modal.close(); toast(a === 'approve' ? 'Marked approved' : 'Marked replied'); }
    } else if (a === 'nobid') {
      const o = data.opportunities[editing.id]; if (!o) return;
      if (await saveDoc('opportunities', editing.id, { ...o, status: 'no-bid', notes: [...(Array.isArray(o.notes) ? o.notes : []), { t: new Date().toLocaleString(), text: 'Closed as no-bid: due date passed without a submission (phone app).' }] })) { modal.close(); toast('Closed as no-bid'); }
    } else if (a === 'closeout-all') {
      const stale = liveOpps().filter((o) => ['found', 'reviewing', 'bid'].includes(o.status || 'found') && isPastOpp(o));
      if (!stale.length || !confirm(`Close ${stale.length} past-due bids as no-bid? They were never submitted.`)) return;
      t.disabled = true; let n = 0;
      for (const o of stale) { const { id, ...rest } = o; if (await saveDoc('opportunities', id, { ...rest, status: 'no-bid', notes: [...(Array.isArray(rest.notes) ? rest.notes : []), { t: new Date().toLocaleString(), text: 'Closed as no-bid: due date passed without a submission (phone app).' }] })) n++; }
      toast(`Closed ${n} as no-bid`);
    } else if (a === 'ask') { askClaude(); }
    else if (a === 'ask-home') { const h = $('#ask-home'); if (h && h.value.trim()) { chatId = null; askFocus = null; askClaude(h.value.trim()); } }
    else if (a === 'chat-new') { chatId = null; chatProject = null; askFocus = null; showChats = false; chatFiles = []; render(); const i = $('#ask-in'); if (i) i.focus(); }
    else if (a === 'proj-open-list') { projView = 'list'; go('ask'); }
    else if (a === 'proj-list') { projView = 'list'; projMenu = null; render(); window.scrollTo({ top: 0 }); }
    else if (a === 'proj-back') { projView = null; render(); }
    else if (a === 'proj-chat') { chatId = null; chatProject = projView; askFocus = null; chatFiles = []; projView = null; render(); const i = $('#ask-in'); if (i) i.focus(); }
    else if (a === 'proj-instr-save') { if (folder(projView) && await saveFolder(projView, { instructions: $('#proj-instr').value.trim().slice(0, 8000) })) toast('Instructions saved'); }
    else if (a === 'proj-attach') { const f = $('#proj-file'); if (f) f.click(); }
    else if (a === 'bid-project') {
      const id = editing.id, o = data.opportunities[id]; if (!o) return; modal.close();
      openProject(folderId(id));
    }
    else if (a === 'chat-list') { showChats = !showChats; render(); }
    else if (a === 'chat-stop') { if (chatBusy) chatBusy.abort(); }
    else if (a === 'chat-retry') { askClaude('', true); }
    else if (a === 'chat-unfocus') { askFocus = null; render(); }
    else if (a === 'chat-attach') { const f = $('#chat-file'); if (f) f.click(); }
    else if (a === 'ask-bid') {
      const o = data.opportunities[editing.id]; if (!o) return; modal.close();
      const { notes, ...rest } = o; chatId = null; projView = null; chatProject = folderId(editing.id); askFocus = { id: editing.id, ...rest, recentNotes: (Array.isArray(notes) ? notes : []).slice(-8) };
      askClaude(`Tell me about bid ${o.sol || ''} ${o.title || ''}: where it stands, what it still needs before it goes in, the risks, and the next step.`);
    }
    else if (a === 'reload') { try { const regs = await navigator.serviceWorker?.getRegistrations?.() || []; for (const r of regs) await r.update(); for (const k of await caches.keys()) await caches.delete(k); } catch (_) { /* ignore */ } location.replace('/?fresh=' + Date.now() + location.hash); }
    else if (a === 'new-invoice') { const cid = t.dataset.id; modal.close(); openForm('invoices'); const sel = form.elements.contractId; if (sel) sel.value = cid; }
    else if (a === 'take') { t.disabled = true; await takeIn(t.dataset.id); }
    else if (a === 'dismiss') { const x = data.inbox[t.dataset.id]; if (x && await saveDoc('inbox', t.dataset.id, { ...x, state: 'dismissed' })) toast('Dismissed'); }
    else if (a === 'export') exportData();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.card[data-open]')) e.target.click(); });
  // Paste a screenshot, photo or PDF straight into the message box (or drop files on the chat on a computer).
  document.addEventListener('paste', (e) => {
    if (e.target.id !== 'ask-in' && e.target.id !== 'ask-home') return;
    const files = [...(e.clipboardData?.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
    if (!files.length) {
      // iPhone only hands websites pasted text and pictures. A PDF copied from Files arrives as nothing (or as its
      // file name), so explain the way that works.
      const t = (e.clipboardData?.getData('text/plain') || '').trim();
      if (!t || /^[^\n]*\.(pdf|docx?|xlsx?)$/im.test(t) && t.split('\n').every((l) => /\.(pdf|docx?|xlsx?)\s*$/i.test(l))) {
        e.preventDefault(); attachHelp();
      }
      return;
    }
    e.preventDefault(); if (ui.view !== 'ask') go('ask'); readFiles(files);
  });
  document.addEventListener('dragover', (e) => { const w = e.target.closest && e.target.closest('.chatwrap'); if (w && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); w.classList.add('drop'); } });
  document.addEventListener('dragleave', (e) => { const w = e.target.closest && e.target.closest('.chatwrap'); if (w && !w.contains(e.relatedTarget)) w.classList.remove('drop'); });
  document.addEventListener('drop', (e) => { const w = e.target.closest && e.target.closest('.chatwrap'); if (!w) return; e.preventDefault(); w.classList.remove('drop'); if (e.dataTransfer.files.length) readFiles([...e.dataTransfer.files]); });
  document.addEventListener('focusin', (e) => { if (e.target.id === 'ask-in' && matchMedia('(max-width: 899px)').matches) document.body.classList.add('kc-typing'); });
  // Wait a moment before the tab bar comes back, so a tap on Send isn't caught by the bar sliding in.
  document.addEventListener('focusout', (e) => { if (e.target.id === 'ask-in') setTimeout(() => { if (document.activeElement?.id !== 'ask-in') document.body.classList.remove('kc-typing'); }, 350); });
  document.addEventListener('change', (e) => { if (e.target.id === 'proj-file' && e.target.files.length) { addProjectFiles(projView, [...e.target.files]); e.target.value = ''; return; } if (e.target.id === 'chat-file' && e.target.files.length) { readFiles([...e.target.files]); e.target.value = ''; } });
  document.addEventListener('input', (e) => { if (e.target.id === 'ask-in') { chatDraft = e.target.value; e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; return; } if (!e.target.matches('[data-search]')) return; ui.query[e.target.dataset.search] = e.target.value; render(); });
  $('#fab').addEventListener('click', () => openForm(ui.view === 'dashboard' ? 'bids' : ui.view));
  $('#title-btn').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  $('#more-btn').addEventListener('click', () => (topMenu.hidden ? openTopMenu() : closeTopMenu()));
  $('#claude-btn').addEventListener('click', () => go('ask'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kcapex-backup-${isoDay()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200); }

  // ---------- Side menu (like the Claude app) ----------
  // ☰ or a swipe in from the left edge opens it: new chat, bid folders, recent chats and every screen.
  const drawer = $('#drawer'), drawerBack = $('#drawer-back');
  function renderDrawer() {
    const n = counts();
    const item = (id, label, ic, count) => `<button class="dr-item ${ui.view === id && !(id === 'ask' && projView) ? 'on' : ''}" data-dr-go="${id}">${icon(ic)}<span>${esc(label)}</span>${count ? `<i>${count}</i>` : ''}</button>`;
    const recents = Object.entries(data.chats || {}).map(([id, c]) => ({ id, ...c })).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 8);
    drawer.innerHTML = `<div class="dr-head"><img src="icons/kc-logo-192.png" alt="" width="30" height="30" /><b>KCAPEX</b></div>
      <button class="dr-new" data-dr-act="new-chat">${icon('ask')}<span>New chat</span></button>
      <button class="dr-item" data-dr-act="folders">${icon('folder')}<span>Bid folders</span><i>${folderList().filter((f) => !f.closed).length || ''}</i></button>
      <div class="dr-sec">Command center</div>
      ${TABS.map((t) => item(t.id, t.id === 'dashboard' ? 'Home' : t.label, t.icon, t.id === 'dashboard' ? 0 : n[t.id])).join('')}
      ${item('more', 'Opportunities', 'new', n.new)}
      <div class="dr-sec">More</div>
      ${EXTRA.filter((x) => x.id !== 'ask').map((x) => item(x.id, x.label, x.icon, n[x.id])).join('')}
      ${recents.length ? `<div class="dr-sec">Recent chats</div>${recents.map((c) => `<button class="dr-chat" data-dr-chat="${esc(c.id)}">${esc(c.title || 'Untitled')}<em>${c.projectId && folder(c.projectId) ? '📁 ' + esc(folder(c.projectId).num ? '#' + folder(c.projectId).num : 'Bid') + ' · ' : ''}${esc(ago(c.updatedAt))}</em></button>`).join('')}` : ''}
      <div class="dr-foot"><button class="dr-item" data-dr-go="more">${icon('settings')}<span>Settings and sync</span></button><span>Version ${APP_VERSION}</span></div>`;
  }
  function openDrawer() { renderDrawer(); drawerBack.hidden = false; requestAnimationFrame(() => { document.body.classList.add('dr-open'); }); drawer.setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { document.body.classList.remove('dr-open'); drawer.setAttribute('aria-hidden', 'true'); setTimeout(() => { if (!document.body.classList.contains('dr-open')) drawerBack.hidden = true; }, 260); }
  $('#menu-btn').addEventListener('click', openDrawer);
  drawerBack.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (e) => {
    const g = e.target.closest('[data-dr-go]'), c = e.target.closest('[data-dr-chat]'), a = e.target.closest('[data-dr-act]');
    if (!g && !c && !a) return;
    closeDrawer();
    if (g) { projView = null; go(g.dataset.drGo); }
    else if (c) { chatId = c.dataset.drChat; chatProject = (data.chats[chatId] || {}).projectId || null; askFocus = null; showChats = false; projView = null; go('ask'); scrollChat(); }
    else if (a.dataset.drAct === 'new-chat') { chatId = null; chatProject = null; askFocus = null; chatFiles = []; projView = null; showChats = false; go('ask'); setTimeout(() => { const i = $('#ask-in'); if (i) i.focus(); }, 280); }
    else if (a.dataset.drAct === 'folders') { projView = 'list'; go('ask'); }
  });
  // Swipe in from the left edge to open; swipe left on the menu to close.
  let edge = null;
  document.addEventListener('touchstart', (e) => {
    edge = null; if (e.touches.length !== 1 || modal.open || !matchMedia('(max-width: 899px)').matches) return;
    const p = e.touches[0], open = document.body.classList.contains('dr-open');
    if (open || p.clientX <= 22) edge = { x: p.clientX, y: p.clientY, open };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!edge) return; const p = e.changedTouches[0], dx = p.clientX - edge.x, dy = p.clientY - edge.y, was = edge; edge = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (!was.open && dx > 0) openDrawer(); else if (was.open && dx < 0) closeDrawer();
  }, { passive: true });

  // ---------- Swipe navigation (phones) ----------
  // The screen follows your finger. Swipe left for the next tab, right for the previous one; on other screens
  // (a chat, a bid folder, Quick-turn…) swiping right goes back to where you came from.
  const SWIPE_ORDER = ['dashboard', 'more', 'leads', 'bids', 'jobs', 'contracts', 'messages'];
  function scrollsSideways(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 4) { const ox = getComputedStyle(n).overflowX; if (ox === 'auto' || ox === 'scroll') return true; }
    }
    return false;
  }
  function goBack() { const prev = navStack.pop() || (SWIPE_ORDER.includes(ui.view) ? null : 'dashboard'); if (prev) go(prev, true); }
  // dir -1: finger moves right (back / previous). dir +1: finger moves left (next).
  // Returns { view, back } for a whole screen (drawn beside this one while you swipe), { fn } for a step inside Ask Claude, or null.
  function swipeTarget(dir) {
    if (ui.view === 'ask') {
      if (dir > 0) return null;
      if (projView && projView !== 'list') return { fn: () => { projView = 'list'; render(); } };
      if (projView === 'list') return { fn: () => { projView = null; render(); } };
    } else {
      const i = SWIPE_ORDER.indexOf(ui.view);
      if (i >= 0) { const j = i + dir; return j >= 0 && j < SWIPE_ORDER.length ? { view: SWIPE_ORDER[j], back: false } : null; }
      if (dir > 0) return null;
    }
    const prev = navStack[navStack.length - 1] || (SWIPE_ORDER.includes(ui.view) ? null : 'dashboard');
    if (!prev) return null;
    return prev === 'ask' ? { fn: () => goBack() } : { view: prev, back: true };
  }
  // The pager. While your finger moves, the next screen is already drawn and slides in beside the current one,
  // the way the Claude app does it. Nothing is redrawn and nothing goes blank when you let go.
  const view = $('#view'); let g = null;
  const EASE = 'cubic-bezier(.22,.8,.26,1)';
  const resetView = () => { view.style.transition = ''; view.style.transform = ''; view.style.opacity = ''; view.style.willChange = ''; };
  const viewTop = () => view.getBoundingClientRect().top + window.scrollY;
  // Draws `target` in a layer over the page, parked one screen-width to the side, at the spot it was last scrolled to.
  function buildPeek(target, dir) {
    const layer = document.createElement('div'); layer.className = 'peek';
    const inner = document.createElement('section'); inner.className = 'view';
    inner.innerHTML = htmlFor(target.view); layer.appendChild(inner); view.parentNode.appendChild(layer);
    const top = viewTop(), maxScroll = Math.max(0, top + inner.offsetHeight - innerHeight);
    const scroll = Math.min(scrollMem[target.view] || 0, maxScroll);
    const pk = { layer, inner, target, dir, rev: dataRev, scroll, y: top - scroll };
    placePeek(pk, dir * innerWidth); return pk;
  }
  const placePeek = (pk, x) => { pk.inner.style.transform = `translate3d(${x}px,${pk.y}px,0)`; };
  const dropPeeks = (was) => { ['back', 'fwd'].forEach((k) => { if (was[k + 'Peek']) { was[k + 'Peek'].layer.remove(); was[k + 'Peek'] = null; } }); };
  document.addEventListener('touchstart', (e) => {
    g = null;
    if (pagerFinish) return; // a swipe is still settling
    if (e.touches.length !== 1 || modal.open || document.body.classList.contains('dr-open') || !$('#top-menu').hidden || !matchMedia('(max-width: 899px)').matches) return;
    const t = e.target, p = e.touches[0];
    if (!t.closest || !t.closest('#view') || t.closest('input, textarea, select, .composer, .pr-menu') || scrollsSideways(t)) return;
    if (p.clientX <= 22 || p.clientX >= innerWidth - 10) return; // left edge opens the menu
    g = { x: p.clientX, y: p.clientY, t: Date.now(), lock: null, lx: p.clientX, lt: Date.now(), v: 0 };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!g) return;
    const p = e.touches[0], dx = p.clientX - g.x, dy = p.clientY - g.y;
    if (g.lock === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
      if (g.lock === 'h') { g.back = swipeTarget(-1); g.fwd = swipeTarget(1); view.style.transition = 'none'; view.style.willChange = 'transform'; }
    }
    if (g.lock !== 'h') return;
    e.preventDefault();
    const now = Date.now(); if (now > g.lt) { g.v = (p.clientX - g.lx) / (now - g.lt); g.lx = p.clientX; g.lt = now; }
    const side = dx > 0 ? 'back' : 'fwd', other = dx > 0 ? 'fwd' : 'back', ok = g[side], tx = ok ? dx : dx * 0.22;
    if (ok && ok.view && !g[side + 'Peek']) g[side + 'Peek'] = buildPeek(ok, dx > 0 ? -1 : 1);
    view.style.transform = `translate3d(${tx}px,0,0)`;
    if (g[side + 'Peek']) placePeek(g[side + 'Peek'], tx + g[side + 'Peek'].dir * innerWidth);
    if (g[other + 'Peek']) placePeek(g[other + 'Peek'], g[other + 'Peek'].dir * innerWidth);
  }, { passive: false });
  document.addEventListener('touchend', (e) => {
    if (!g) return; const was = g; g = null;
    if (was.lock !== 'h') return;
    const W = innerWidth, p = e.changedTouches[0], dx = p.clientX - was.x, dt = Math.max(1, Date.now() - was.t), sign = dx > 0 ? 1 : -1;
    const side = dx > 0 ? 'back' : 'fwd', tgt = was[side], pk = was[side + 'Peek'];
    const v = Date.now() - was.lt > 90 ? 0 : was.v; // a finger that stopped before lifting is not a flick
    const flick = (Math.abs(v) > 0.35 && Math.sign(v) === sign) || (Math.abs(dx) / dt > 0.4 && Math.abs(dx) > 45);
    const commit = tgt && Math.abs(dx) > 12 && (Math.abs(dx) > W * 0.2 || flick);
    if (commit && pk) {
      // Let go: the top bar and tabs switch at once, and both screens glide the rest of the way.
      const ms = Math.round(Math.max(90, Math.min(210, 230 * (1 - Math.abs(dx) / W))));
      if (tgt.back) navStack.pop();
      go(tgt.view, tgt.back, true);
      const other = was[side === 'back' ? 'fwdPeek' : 'backPeek']; if (other) other.layer.remove();
      view.style.transition = pk.inner.style.transition = `transform ${ms}ms ${EASE}`;
      view.style.transform = `translate3d(${sign * W}px,0,0)`; placePeek(pk, 0);
      let timer = 0;
      pagerFinish = () => {
        pagerFinish = null; clearTimeout(timer);
        if (ui.view === tgt.view) {
          if (pk.rev === dataRev) { view.replaceChildren(...pk.inner.childNodes); resetView(); pk.layer.remove(); window.scrollTo(0, pk.scroll); }
          else { resetView(); pk.layer.remove(); render(); window.scrollTo(0, pk.scroll); } // data changed mid-swipe: draw it fresh
        } else { resetView(); pk.layer.remove(); }
      };
      timer = setTimeout(() => { if (pagerFinish) pagerFinish(); }, ms + 20);
    } else if (commit) {
      // A step inside Ask Claude (folder list, back to a chat): switch right away and slide the new screen in.
      dropPeeks(was);
      if (tgt.fn) tgt.fn(); else { if (tgt.back) navStack.pop(); go(tgt.view, tgt.back); }
      view.style.transition = 'none'; view.style.transform = `translate3d(${-sign * W * 0.3}px,0,0)`; void view.offsetWidth;
      view.style.transition = `transform 160ms ${EASE}`; view.style.transform = 'translate3d(0,0,0)';
      setTimeout(resetView, 180);
    } else {
      // Not far enough: everything slides back.
      const ms = 160;
      view.style.transition = `transform ${ms}ms ${EASE}`; view.style.transform = 'translate3d(0,0,0)';
      ['back', 'fwd'].forEach((k) => { const q = was[k + 'Peek']; if (q) { q.inner.style.transition = `transform ${ms}ms ${EASE}`; placePeek(q, q.dir * W); } });
      setTimeout(() => { resetView(); dropPeeks(was); }, ms + 20);
    }
  }, { passive: true });
  document.addEventListener('touchcancel', () => { if (g && g.lock === 'h') { resetView(); dropPeeks(g); } g = null; }, { passive: true });

  // ---------- ⋯ menu (top right), like the Claude app ----------
  const topMenu = $('#top-menu'), topBack = $('#top-menu-back');
  function topMenuItems() {
    const it = (act, label, danger) => `<button role="menuitem" data-tm="${act}" class="${danger ? 'danger' : ''}">${label}</button>`;
    const out = [];
    const cur = chatId && data.chats[chatId];
    if (ui.view === 'ask' && projView && projView !== 'list') { const f = folder(projView); if (f) out.push(it('folder-chat', '✦ New chat about this bid'), it('folder-bid', '✎ Open bid'), it('folder-files', '📎 Add files'), it('folder-pin', f.pinned ? 'Unpin folder' : '📌 Pin folder')); }
    else if (ui.view === 'ask' && cur && !projView) out.push(it('chat-rename', '✎ Rename chat'), it('chat-move', '📁 Move to a bid folder'), it('chat-copy', '⧉ Copy whole chat'), it('chat-del', '🗑 Delete chat', true));
    else if (COLLECTIONS[ui.view]) out.push(it('add', `＋ Add ${COLLECTIONS[ui.view].label.replace(/s$/, '').toLowerCase()}`));
    if (out.length) out.push('<hr>');
    out.push(it('new-chat', '✦ New chat'), it('folders', '📁 Bid folders'), it('opps', '☷ Opportunities and more'), it('latest', '↻ Get the latest version'), it('export', '⤓ Export backup'), it('signout', 'Sign out'));
    return out.join('');
  }
  function openTopMenu() { topMenu.innerHTML = topMenuItems(); topMenu.hidden = false; topBack.hidden = false; requestAnimationFrame(() => topMenu.classList.add('show')); }
  function closeTopMenu() { if (topMenu.hidden) return; topMenu.classList.remove('show'); topMenu.hidden = true; topBack.hidden = true; }
  topBack.addEventListener('click', closeTopMenu);
  topMenu.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tm]'); if (!b) return; const a = b.dataset.tm; closeTopMenu();
    const cur = chatId && data.chats[chatId];
    if (a === 'chat-rename' && cur) { const n = prompt('Rename this chat', cur.title || ''); if (n && n.trim()) { await saveDoc('chats', chatId, { ...cur, title: n.trim().slice(0, 80) }); render(); } }
    else if (a === 'chat-move' && cur) { const btn = document.createElement('button'); btn.dataset.chatMove = chatId; btn.hidden = true; document.body.appendChild(btn); btn.click(); btn.remove(); }
    else if (a === 'chat-copy' && cur) { const txt = (cur.messages || []).map((m) => (m.role === 'user' ? 'You: ' : 'Claude: ') + m.text).join('\n\n'); navigator.clipboard?.writeText(txt).then(() => toast('Chat copied'), () => toast('Could not copy')); }
    else if (a === 'chat-del' && cur) { if (confirm('Delete this chat?')) { await removeDoc('chats', chatId); chatId = null; render(); } }
    else if (a === 'folder-chat') { chatId = null; chatProject = projView; askFocus = null; chatFiles = []; projView = null; render(); }
    else if (a === 'folder-bid') { const f = folder(projView); if (f) openForm('bids', f.bidId); }
    else if (a === 'folder-files') { const f = $('#proj-file'); if (f) f.click(); }
    else if (a === 'folder-pin') { const f = folder(projView); if (f) { await saveFolder(projView, { pinned: !f.pinned }); render(); } }
    else if (a === 'add') openForm(ui.view);
    else if (a === 'new-chat') { chatId = null; chatProject = null; askFocus = null; chatFiles = []; projView = null; showChats = false; go('ask'); }
    else if (a === 'folders') { projView = 'list'; go('ask'); }
    else if (a === 'opps') go('more');
    else if (a === 'latest') { const r = document.createElement('button'); r.dataset.action = 'reload'; r.hidden = true; document.body.appendChild(r); r.click(); r.remove(); }
    else if (a === 'export') exportData();
    else if (a === 'signout') location.href = '/__logout';
  });

  // ---------- Boot ----------
  $('#today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const initial = location.hash.slice(1);
  if (initial && (COLLECTIONS[initial] || TITLES[initial])) ui.view = initial;
  render();
  window.claude.use('db').then((d) => {
    db = d;
    DBC.forEach((c) => d.collection(c).onSnapshot((snap) => {
      const m = {}; snap.docs.forEach((s) => { const b = s.data(); if (b && !b.deleted) m[s.id] = b; });
      data[c] = m; dataRev++; loadedColls.add(c); if (c === 'projects' || c === 'opportunities' || c === 'chats') setTimeout(numberFolders, 500); $('#sync').textContent = syncLine(false); if (!(ui.view === 'ask' && (c !== 'chats' || chatBusy))) scheduleRender();
    }, () => { $('#sync').textContent = 'Offline'; }));
  });
  window.addEventListener('kc-meta', () => { $('#sync').textContent = syncLine(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || !['ask-in', 'ask-home'].includes(e.target.id)) return;
    if (e.target.id === 'ask-in' && matchMedia('(pointer: coarse)').matches) return; // on phones Enter is a new line; tap Send
    e.preventDefault(); if (e.target.id === 'ask-home') { chatId = null; askFocus = null; } askClaude();
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((reg) => { setInterval(() => reg.update().catch(() => {}), 30 * 60000); }).catch(() => {}));
    // A new version finished installing in the background: offer it (one tap) instead of waiting for the next launch.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      const t = $('#toast'); t.innerHTML = 'Update ready. <button class="toast-btn" type="button">Refresh</button>'; t.hidden = false; clearTimeout(toastTimer);
      t.querySelector('button').onclick = () => location.reload();
    });
  }
  if (location.search.includes('fresh=')) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ } }
})();
