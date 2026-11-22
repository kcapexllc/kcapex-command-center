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
  const DBC = ['opportunities', 'inbox', 'contacts', 'subs', 'pastperf', 'leads', 'jobs', 'contracts', 'messages'];
  const data = Object.fromEntries(DBC.map((c) => [c, {}]));
  let db = null;
  const list = (c) => Object.entries(data[c]).map(([id, d]) => ({ id, ...d }));

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
  const etDay = (iso) => { if (!iso) return ''; const s = String(iso); if (s.length <= 10) return s; const d = new Date(s); if (isNaN(d)) return s.slice(0, 10); try { return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (_) { return s.slice(0, 10); } };
  const qtWin = (x) => { const p = etDay(x.posted), u = etDay(x.due); if (!p || !u) return null; const a = Date.parse(p + 'T00:00:00Z'), b = Date.parse(u + 'T00:00:00Z'); return isNaN(a) || isNaN(b) ? null : Math.round((b - a) / 864e5); };
  const qtAmended = (x) => { if (x.amended === true) return true; if (x.lastNotice) return etDay(x.lastNotice) !== etDay(x.posted); if (x.watch && x.watch.noticesCount != null) return Number(x.watch.noticesCount) > 1; if (/\bamend/i.test((x.rank && x.rank.why) || '')) return true; if (x.amended === false) return false; return null; };
  const qtOk = (x) => { const w = qtWin(x), u = etDay(x.due); if (w === null || w < 1 || !u || u < etDay(new Date().toISOString())) return false; return w <= (qtAmended(x) === true ? 9 : 8); };
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
      coll: 'opportunities', label: 'Bids', singular: 'Bid', icon: 'bids', statusField: 'status', defaultFilter: 'Active',
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
      value: (r) => r.ourPrice || r.estValue,
      meta: (r) => [['Due', fmtDate(r.due)], ['Type', r.noticeType], ['Set-aside', r.setAside], ['NAICS', r.naics]],
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
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending', 'Closed'] },
        { key: 'value', label: 'Total value ($)', type: 'number' },
        { key: 'start', label: 'PoP start', type: 'date' },
        { key: 'end', label: 'PoP end', type: 'date' },
        { key: 'notesTxt', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.title, sub: (r) => [r.agency, r.number].filter(Boolean).join(' · '), value: (r) => r.value,
      meta: (r) => [['Type', r.type], ['PoP', [fmtDate(r.start), fmtDate(r.end)].filter(Boolean).join(' → ')]],
      search: ['title', 'agency', 'number', 'notesTxt', 'type'], dateKey: 'end',
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
  ];
  const TITLES = { dashboard: 'GovCon Command Center', more: 'More', new: 'New opportunities', quick: 'Quick-turn bids' };

  // ---------- Routing ----------
  const ui = { view: 'dashboard', filter: {}, query: {}, level: 'all' };
  function go(view) { ui.view = view; try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignore */ } render(); window.scrollTo({ top: 0 }); }

  // ---------- Rendering ----------
  function counts() {
    return {
      bids: list('opportunities').filter((o) => ACTIVE.includes(o.status || 'found') && !isPastOpp(o)).length,
      leads: list('leads').filter((l) => !['Converted', 'Dead'].includes(l.status)).length,
      jobs: list('jobs').filter((j) => j.status !== 'Complete').length,
      contracts: list('contracts').filter((c) => c.status === 'Active').length,
      messages: list('messages').filter((m) => m.status === 'Needs reply').length,
      new: newItems().length, quick: quickItems().length,
    };
  }
  function renderNav() {
    const n = counts();
    const btn = (v) => `<button data-go="${v.id}" class="${ui.view === v.id ? 'active' : ''}">${icon(v.icon)}<span>${v.id === 'dashboard' ? 'Dashboard' : v.label}</span>${n[v.id] ? `<span class="count">${n[v.id]}</span>` : ''}</button>`;
    $('#nav').innerHTML = TABS.map(btn).join('') + '<div style="height:10px"></div>' + EXTRA.map(btn).join('') + btn({ id: 'more', label: 'Settings', icon: 'settings' });
    $('#tabbar').innerHTML = TABS.map((v) => `<button data-go="${v.id}" class="${ui.view === v.id ? 'active' : ''}" aria-label="${v.label}">${icon(v.icon)}<span>${v.label}</span></button>`).join('');
  }

  function render() {
    renderNav();
    const c = COLLECTIONS[ui.view];
    $('#view-title').textContent = TITLES[ui.view] || (c ? c.label : '');
    $('#fab').hidden = !(c || ui.view === 'dashboard');
    const ae = document.activeElement, keep = ae && ae.dataset && ae.dataset.search ? [ae.dataset.search, ae.selectionStart] : null;
    const el = $('#view');
    try {
      if (ui.view === 'dashboard') el.innerHTML = renderDashboard();
      else if (ui.view === 'more') el.innerHTML = renderMore();
      else if (ui.view === 'new') el.innerHTML = renderNew();
      else if (ui.view === 'quick') el.innerHTML = renderQuick();
      else el.innerHTML = renderList(ui.view);
    } catch (err) { console.error(err); el.innerHTML = `<div class="notice">This page hit a problem drawing a record (${esc(err.message)}). Your data is safe.</div>`; }
    if (keep) { const s = $(`[data-search="${keep[0]}"]`); if (s) { s.focus(); try { s.setSelectionRange(keep[1], keep[1]); } catch (e) { /* ignore */ } } }
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

  function renderDashboard() {
    const opps = list('opportunities');
    const open = opps.filter((o) => ACTIVE.includes(o.status || 'found') && !isPastOpp(o));
    const val = (o) => Number(o.ourPrice || o.estValue) || 0;
    const pipeline = open.reduce((a, o) => a + val(o), 0);
    const won = opps.filter((o) => o.status === 'awarded'), lost = opps.filter((o) => o.status === 'lost');
    const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) + '%' : '—';
    const awarded = won.reduce((a, o) => a + val(o), 0);
    const waiting = opps.filter((o) => isPastOpp(o) && ACTIVE.includes(o.status || 'found')).length;
    const openLeads = list('leads').filter((l) => !['Converted', 'Dead'].includes(l.status)).length;
    const needsReply = list('messages').filter((m) => m.status === 'Needs reply').length;
    const deadlines = collectDeadlines();
    const dueWeek = deadlines.filter((d) => d.days >= 0 && d.days <= 7).length;
    const nw = newItems(), lv = (k) => nw.filter((x) => levelOf(x) === k).length, qk = quickItems().length;

    const stages = ['found', 'reviewing', 'bid', 'submitted'];
    const byStage = stages.map((s) => { const items = open.filter((o) => (o.status || 'found') === s); return { s, n: items.length, v: items.reduce((a, o) => a + val(o), 0) }; });
    const maxN = Math.max(1, ...byStage.map((x) => x.n));
    const activeJobs = list('jobs').filter((j) => j.status !== 'Complete');

    return `
      <div class="hero">
        ${nw.length ? `<article class="card" data-go="new"><div class="card-title">${nw.length} new opportunit${nw.length === 1 ? 'y' : 'ies'} from your saved searches</div><div class="card-sub">Local ${lv('local')} · State ${lv('state')} · Federal ${lv('federal')}</div></article>` : ''}
        ${qk ? `<article class="card" data-go="quick"><div class="card-title">${qk} quick-turn bid${qk === 1 ? '' : 's'} open</div><div class="card-sub">Posted to due in 1 to 8 days · tap to see them</div></article>` : ''}
      </div>
      <div class="kpis">
        <div class="kpi accent"><div class="kpi-label">Open pipeline</div><div class="kpi-value">${money(pipeline)}</div><div class="kpi-sub">${open.length} open bids</div></div>
        <div class="kpi"><div class="kpi-label">Due in 7 days</div><div class="kpi-value" style="color:${dueWeek ? 'var(--red)' : 'inherit'}">${dueWeek}</div><div class="kpi-sub">deadlines & follow-ups</div></div>
        <div class="kpi"><div class="kpi-label">Awarded</div><div class="kpi-value">${money(awarded)}</div><div class="kpi-sub">${won.length} win${won.length === 1 ? '' : 's'}</div></div>
        <div class="kpi"><div class="kpi-label">Win rate</div><div class="kpi-value">${winRate}</div><div class="kpi-sub">${won.length} won · ${lost.length} lost</div></div>
        <div class="kpi"><div class="kpi-label">Awaiting decision</div><div class="kpi-value">${waiting}</div><div class="kpi-sub">submitted or past due</div></div>
        <div class="kpi"><div class="kpi-label">Needs reply</div><div class="kpi-value">${needsReply}</div><div class="kpi-sub">${openLeads} open lead${openLeads === 1 ? '' : 's'}</div></div>
      </div>
      ${seasonBlock()}
      <div class="grid-2">
        <div class="panel">
          <h2>Upcoming deadlines <span style="text-transform:none;letter-spacing:0;font-size:12.5px">next 30 days</span></h2>
          ${deadlines.length ? deadlines.slice(0, 10).map((d) => {
            const dt = parseDate(d.date); const cls = d.days < 0 ? 'overdue' : d.days <= 3 ? 'soon' : '';
            const when = d.days < 0 ? `${-d.days}d overdue` : d.days === 0 ? 'Today' : d.days === 1 ? 'Tomorrow' : `in ${d.days} days`;
            return `<div class="deadline" data-open="${d.view}:${d.id}"><div class="date-chip ${cls}"><small>${dt.toLocaleDateString(undefined, { month: 'short' })}</small><b>${dt.getDate()}</b></div>
              <div class="deadline-main"><div class="deadline-title">${esc(d.title)}</div><div class="deadline-sub">${esc(d.kind)} · ${when}</div></div></div>`;
          }).join('') : '<div class="empty">Nothing due in the next 30 days.</div>'}
        </div>
        <div class="panel">
          <h2>Bid pipeline <button data-go="bids">View all</button></h2>
          ${byStage.map((x) => `<div class="stage-row"><span style="text-transform:capitalize">${x.s} <span style="color:var(--muted)">(${x.n})</span></span>
            <div class="stage-bar"><span style="width:${x.n ? Math.max(4, (x.n / maxN) * 100) : 0}%;background:${STAGE_BAR[x.s]}"></span></div><span class="stage-val">${money(x.v)}</span></div>`).join('')}
          <h2 style="margin-top:22px">Active jobs <button data-go="jobs">View all</button></h2>
          ${activeJobs.length ? activeJobs.slice(0, 4).map((j) => `<div class="deadline" data-open="jobs:${j.id}"><div class="deadline-main"><div class="deadline-title">${esc(j.title)}</div><div class="deadline-sub">${esc(j.client || '')}</div></div><span class="badge ${STATUS_COLORS[j.status] || 'b-muted'}">${esc(j.status || '')}</span></div>`).join('') : '<div class="empty">No active jobs.</div>'}
        </div>
      </div>`;
  }

  function collectDeadlines() {
    const out = [];
    const push = (view, r, date, kind, title) => { const days = daysUntil(date); if (days !== null && days <= 30 && days >= -7) out.push({ view, id: r.id, date: dayOf(date), days, kind, title }); };
    list('opportunities').filter((o) => !isPastOpp(o)).forEach((o) => push('bids', o, o.due, /sources sought|presol/i.test(o.noticeType || '') ? 'Response due' : 'Bid due', o.title || o.sol));
    list('leads').filter((l) => !['Converted', 'Dead'].includes(l.status)).forEach((l) => push('leads', l, l.followUp, 'Follow up', l.name + (l.company ? ' — ' + l.company : '')));
    list('contacts').forEach((c) => push('people', c, c.nextFollow, 'Follow up', c.name + (c.agency ? ' — ' + c.agency : '')));
    list('jobs').filter((j) => j.status !== 'Complete').forEach((j) => { if (j.status === 'Scheduled') push('jobs', j, j.start, 'Job starts', j.title); push('jobs', j, j.due, 'Job due', j.title); });
    list('contracts').filter((c) => c.status === 'Active').forEach((c) => push('contracts', c, c.end, 'Contract ends', c.title));
    return out.sort((a, b) => a.days - b.days);
  }

  function renderList(key) {
    const c = COLLECTIONS[key];
    const items = list(c.coll);
    const sf = c.fields.find((x) => x.key === c.statusField);
    const statusOpts = [...new Set([...sf.options, ...items.map((i) => i[c.statusField]).filter(Boolean)])];
    const f = ui.filter[key] || c.defaultFilter || 'All';
    const q = (ui.query[key] || '').toLowerCase();
    const cnt = (s) => items.filter((i) => (i[c.statusField] || (key === 'bids' ? 'found' : '')) === s).length;
    const activeOf = (i) => ACTIVE.includes(i.status || 'found') && !isPastOpp(i);
    let rows = items.filter((i) => (f === 'All' || (f === 'Active' ? activeOf(i) : (i[c.statusField] || (key === 'bids' ? 'found' : '')) === f)) &&
      (!q || c.search.some((k) => String(i[k] || '').toLowerCase().includes(q))));
    if (c.sortTitle) rows.sort((a, b) => String(c.title(a)).localeCompare(String(c.title(b))));
    else if (c.newestFirst) rows.sort((a, b) => String(b[c.dateKey] || '').localeCompare(String(a[c.dateKey] || '')));
    else rows.sort((a, b) => String(dayOf(a[c.dateKey]) || '9999').localeCompare(String(dayOf(b[c.dateKey]) || '9999')));
    const total = rows.reduce((a, r) => a + (Number(c.value(r)) || 0), 0);
    const chips = [...(key === 'bids' ? [['Active', items.filter(activeOf).length]] : []), ['All', items.length], ...statusOpts.filter((s) => cnt(s)).map((s) => [s, cnt(s)])];
    return `
      <div class="toolbar">
        <input class="search" type="search" placeholder="Search ${c.label.toLowerCase()}…" value="${esc(ui.query[key] || '')}" data-search="${key}" />
        <div class="chips">${chips.map(([s, n]) => `<button class="chip ${f === s ? 'active' : ''}" data-filter="${key}:${esc(s)}" style="text-transform:${key === 'bids' ? 'capitalize' : 'none'}">${esc(s)}<span class="n">${n}</span></button>`).join('')}</div>
      </div>
      ${total ? `<p style="color:var(--muted);margin:0 0 10px;font-size:13px">${rows.length} shown · ${money(total)} total</p>` : ''}
      ${rows.length ? `<div class="cards">${rows.map((r) => renderCard(key, r)).join('')}</div>` : `<div class="empty">${items.length ? 'No matches.' : `No ${c.label.toLowerCase()} yet.`}<br /><button class="btn primary" data-action="new">Add ${c.singular.toLowerCase()}</button></div>`}`;
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
        ${meta.map(([k, val]) => `<span>${esc(k)} <b>${esc(val)}</b></span>`).join('')}
        ${link ? `<a class="lnk" href="${esc(link)}" target="_blank" rel="noopener" data-stop="1">Open notice ↗</a>` : ''}
      </div></article>`;
  }

  function oppLine(x, src) {
    const n = daysUntil(x.due), w = qtWin(x), am = qtAmended(x), link = safeUrl(x.link);
    const tags = [x.noticeType || x.src, x.setAside, x.naics ? 'NAICS ' + x.naics : '', ui.view === 'quick' && w !== null ? `${w}-day window` : '', ui.view === 'quick' && am === true ? 'Amended' : ''].filter(Boolean);
    return `<article class="card" ${src === 'opportunities' ? `data-open="bids:${esc(x.id)}"` : ''} style="${src === 'inbox' ? 'cursor:default' : ''}"><div class="opp-row">
      <div class="days ${n !== null && n <= 3 ? 'hot' : ''}">${n === null ? '--' : n}<small>${n === null ? 'no date' : n === 1 ? 'day left' : 'days left'}</small></div>
      <div style="min-width:0;flex:1"><div class="card-title">${esc(x.title || x.sol)}</div><div class="card-sub">${esc([x.sol, x.agency, x.place].filter(Boolean).join(' · '))}</div>
      <div class="card-meta">${tags.map((t) => `<span class="badge b-purple">${esc(t)}</span>`).join('')}${src === 'opportunities' ? `<span class="badge ${STATUS_COLORS[x.status] || 'b-muted'}">In bids: ${esc(x.status || 'found')}</span>` : ''}</div>
      ${x.rank && x.rank.why ? `<div class="card-sub" style="margin-top:6px">${esc(x.rank.why)}</div>` : ''}
      ${src === 'inbox' ? `<div class="btn-row" style="margin-top:10px"><button class="btn primary" data-action="take" data-id="${esc(x.id)}">Add to bids</button><button class="btn" data-action="dismiss" data-id="${esc(x.id)}">Dismiss</button>${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener" style="text-decoration:none">Open notice ↗</a>` : ''}</div>` : link ? `<div style="margin-top:8px"><a class="lnk" href="${esc(link)}" target="_blank" rel="noopener" data-stop="1">Open notice ↗</a></div>` : ''}
      </div></div></article>`;
  }

  function renderNew() {
    const all = newItems();
    const shown = all.filter((x) => ui.level === 'all' || levelOf(x) === ui.level)
      .sort((a, b) => ((b.rank?.score ?? -1) - (a.rank?.score ?? -1)) || String(a.due || '9').localeCompare(String(b.due || '9')));
    const chip = (k, l) => `<button class="chip ${ui.level === k ? 'active' : ''}" data-level="${k}">${l}<span class="n">${k === 'all' ? all.length : all.filter((x) => levelOf(x) === k).length}</span></button>`;
    return `<p style="color:var(--muted);margin:0 0 10px">New bids from your saved searches. Your Claude Pipeline pulls these each day, and they sync here.</p>
      <div class="toolbar"><div class="chips">${chip('all', 'All')}${chip('local', 'Local')}${chip('state', 'State')}${chip('federal', 'Federal')}</div></div>
      ${shown.length ? `<div class="cards">${shown.slice(0, 150).map((x) => oppLine(x, 'inbox')).join('')}</div>${shown.length > 150 ? `<p style="color:var(--muted)">Showing 150 of ${shown.length}. Filter by level to see more.</p>` : ''}` : '<div class="empty">Nothing new right now.</div>'}`;
  }

  function renderQuick() {
    const items = quickItems();
    return `<p style="color:var(--muted);margin:0 0 10px">Bids with 1 to 8 days from posted to due (under 10 days if amended). Soonest first.</p>
      ${items.length ? `<div class="cards">${items.map((x) => oppLine(x, x._src)).join('')}</div>` : '<div class="empty">No open quick-turn bids right now.</div>'}`;
  }

  function renderMore() {
    const n = counts();
    const tile = (v, sub) => `<button class="tile" data-go="${v.id}">${icon(v.icon)}<b>${esc(v.label)}</b><span>${sub}</span></button>`;
    return `<div class="tiles">
        ${tile(EXTRA[0], `${n.new} new`)}${tile(EXTRA[1], `${n.quick} open`)}
        ${tile(EXTRA[2], `${list('contacts').length} contacts`)}${tile(EXTRA[3], `${list('subs').length} subcontractors`)}${tile(EXTRA[4], `${list('pastperf').length} past performance`)}
      </div>
      <div class="panel settings" style="margin-bottom:14px"><h2>Install on your phone</h2>
        <ol class="install-steps"><li><b>iPhone:</b> Safari → Share → <b>Add to Home Screen</b>.</li><li><b>Android:</b> Chrome → ⋮ → <b>Install app</b>.</li></ol></div>
      <div class="panel settings" style="margin-bottom:14px"><h2>Sync</h2><p>Bids, New, Quick-turn, People, Subs and Library sync with your KCAPEX Pipeline in Claude on a schedule. Leads, Jobs, Contracts and Inbox live in this app and are shared across your devices.</p>
        <div class="btn-row"><button class="btn" data-action="export">Export backup</button><a class="btn" href="/__logout" style="text-decoration:none">Sign out</a></div></div>`;
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
        if (f.type === 'select') { const opts = v && !f.options.includes(v) ? [v, ...f.options] : f.options; input = `<select id="${fid}" name="${f.key}">${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; }
        else if (f.type === 'textarea') input = `<textarea id="${fid}" name="${f.key}">${esc(v)}</textarea>`;
        else input = `<input id="${fid}" name="${f.key}" type="${f.type}" ${f.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(v)}" ${f.required ? 'required' : ''} />`;
        return `<div class="field ${f.full ? 'full' : ''}"><label for="${fid}">${esc(f.label)}</label>${input}</div>`;
      }).join('')}</div>
      ${rec && safeUrl(rec.link) ? `<p style="margin:12px 0 0"><a class="lnk" href="${esc(safeUrl(rec.link))}" target="_blank" rel="noopener">Open notice ↗</a></p>` : ''}
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
    const t = e.target.closest('[data-go],[data-open],[data-filter],[data-action],[data-level]');
    if (!t) return;
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.open) { const i = t.dataset.open.indexOf(':'); return openForm(t.dataset.open.slice(0, i), t.dataset.open.slice(i + 1)); }
    if (t.dataset.filter) { const i = t.dataset.filter.indexOf(':'); ui.filter[t.dataset.filter.slice(0, i)] = t.dataset.filter.slice(i + 1); return render(); }
    if (t.dataset.level) { ui.level = t.dataset.level; return render(); }
    const a = t.dataset.action;
    if (a === 'close') modal.close();
    else if (a === 'new') openForm(ui.view);
    else if (a === 'delete') {
      if (!confirm('Delete this record? This cannot be undone.')) return;
      const c = COLLECTIONS[editing.key];
      if (await removeDoc(c.coll, editing.id)) { modal.close(); toast('Deleted'); }
    } else if (a === 'take') { t.disabled = true; await takeIn(t.dataset.id); }
    else if (a === 'dismiss') { const x = data.inbox[t.dataset.id]; if (x && await saveDoc('inbox', t.dataset.id, { ...x, state: 'dismissed' })) toast('Dismissed'); }
    else if (a === 'export') exportData();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.card[data-open]')) e.target.click(); });
  document.addEventListener('input', (e) => { if (!e.target.matches('[data-search]')) return; ui.query[e.target.dataset.search] = e.target.value; render(); });
  $('#fab').addEventListener('click', () => openForm(ui.view === 'dashboard' ? 'bids' : ui.view));
  $('#more-btn').addEventListener('click', () => go('more'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kcapex-backup-${isoDay()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200); }

  // ---------- Boot ----------
  $('#today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const initial = location.hash.slice(1);
  if (initial && (COLLECTIONS[initial] || TITLES[initial])) ui.view = initial;
  render();
  window.claude.use('db').then((d) => {
    db = d;
    DBC.forEach((c) => d.collection(c).onSnapshot((snap) => {
      const m = {}; snap.docs.forEach((s) => { const b = s.data(); if (b && !b.deleted) m[s.id] = b; });
      data[c] = m; $('#sync').textContent = 'Synced'; scheduleRender();
    }, () => { $('#sync').textContent = 'Offline'; }));
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
