/* KCapex Command Center — schema-driven internal dashboard (no build step). */
(() => {
  'use strict';

  const STORE_KEY = 'kcapex.cc.v1';

  // ---------- Icons ----------
  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    bids: '<path d="M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h8M9 9h3"/>',
    leads: '<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 3.65a3.5 3.5 0 0 1 0 6.7"/>',
    jobs: '<path d="M3 8h18v12H3zM8 8V5h8v3M3 13h18"/>',
    contracts: '<path d="M7 3h10v18H7zM10 7h4M10 11h4M10 15h2M4 6v15M20 6v15"/>',
    messages: '<path d="M4 5h16v11H8l-4 4z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  // ---------- Schema ----------
  const SET_ASIDES = ['None / Full & Open', 'Small Business', '8(a)', 'HUBZone', 'SDVOSB', 'WOSB', 'EDWOSB', 'VOSB'];

  const COLLECTIONS = {
    bids: {
      label: 'Bids', singular: 'Opportunity', icon: 'bids',
      statusField: 'stage',
      fields: [
        { key: 'title', label: 'Opportunity title', type: 'text', required: true, full: true },
        { key: 'agency', label: 'Agency / Buyer', type: 'text' },
        { key: 'solicitation', label: 'Solicitation #', type: 'text' },
        { key: 'stage', label: 'Stage', type: 'select', options: ['Identified', 'Qualifying', 'Capture', 'Proposal', 'Submitted', 'Won', 'Lost', 'No-Bid'] },
        { key: 'setAside', label: 'Set-aside', type: 'select', options: SET_ASIDES },
        { key: 'naics', label: 'NAICS', type: 'text' },
        { key: 'value', label: 'Est. value ($)', type: 'number' },
        { key: 'due', label: 'Response due', type: 'date' },
        { key: 'pwin', label: 'Win probability (%)', type: 'number' },
        { key: 'link', label: 'Link (SAM.gov etc.)', type: 'url', full: true },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.title,
      sub: (r) => [r.agency, r.solicitation].filter(Boolean).join(' · '),
      value: (r) => r.value,
      meta: (r) => [['Due', fmtDate(r.due)], ['Set-aside', r.setAside], ['NAICS', r.naics], ['Pwin', r.pwin ? r.pwin + '%' : '']],
      search: ['title', 'agency', 'solicitation', 'naics', 'notes'],
    },
    leads: {
      label: 'Leads', singular: 'Lead', icon: 'leads',
      statusField: 'status',
      fields: [
        { key: 'name', label: 'Contact name', type: 'text', required: true },
        { key: 'company', label: 'Company / Agency', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['New', 'Contacted', 'Qualified', 'Converted', 'Dead'] },
        { key: 'source', label: 'Source', type: 'select', options: ['Referral', 'Website', 'Thumbtack', 'SAM.gov', 'Prime contractor', 'Event', 'Cold outreach', 'Other'] },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'value', label: 'Potential value ($)', type: 'number' },
        { key: 'followUp', label: 'Next follow-up', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.name,
      sub: (r) => [r.company, r.source].filter(Boolean).join(' · '),
      value: (r) => r.value,
      meta: (r) => [['Follow-up', fmtDate(r.followUp)], ['Phone', r.phone], ['Email', r.email]],
      search: ['name', 'company', 'email', 'phone', 'notes', 'source'],
    },
    jobs: {
      label: 'Jobs', singular: 'Job', icon: 'jobs',
      statusField: 'status',
      fields: [
        { key: 'title', label: 'Job title', type: 'text', required: true, full: true },
        { key: 'client', label: 'Client / Agency', type: 'text' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'In Progress', 'On Hold', 'Complete'] },
        { key: 'value', label: 'Job value ($)', type: 'number' },
        { key: 'start', label: 'Start date', type: 'date' },
        { key: 'due', label: 'Due / Completion', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.title,
      sub: (r) => [r.client, r.location].filter(Boolean).join(' · '),
      value: (r) => r.value,
      meta: (r) => [['Start', fmtDate(r.start)], ['Due', fmtDate(r.due)]],
      search: ['title', 'client', 'location', 'notes'],
    },
    contracts: {
      label: 'Contracts', singular: 'Contract', icon: 'contracts',
      statusField: 'status',
      fields: [
        { key: 'title', label: 'Contract title', type: 'text', required: true, full: true },
        { key: 'agency', label: 'Agency / Prime', type: 'text' },
        { key: 'number', label: 'Contract #', type: 'text' },
        { key: 'type', label: 'Type', type: 'select', options: ['FFP', 'T&M', 'Cost-Plus', 'IDIQ', 'BPA', 'Subcontract', 'Commercial'] },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending', 'Closed'] },
        { key: 'value', label: 'Total value ($)', type: 'number' },
        { key: 'start', label: 'PoP start', type: 'date' },
        { key: 'end', label: 'PoP end', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.title,
      sub: (r) => [r.agency, r.number].filter(Boolean).join(' · '),
      value: (r) => r.value,
      meta: (r) => [['Type', r.type], ['PoP', [fmtDate(r.start), fmtDate(r.end)].filter(Boolean).join(' → ')]],
      search: ['title', 'agency', 'number', 'notes', 'type'],
    },
    messages: {
      label: 'Inbox', singular: 'Message', icon: 'messages',
      statusField: 'status',
      fields: [
        { key: 'subject', label: 'Subject', type: 'text', required: true, full: true },
        { key: 'from', label: 'From / To', type: 'text' },
        { key: 'channel', label: 'Channel', type: 'select', options: ['Email', 'Phone', 'Text', 'Portal', 'In person'] },
        { key: 'status', label: 'Status', type: 'select', options: ['Needs reply', 'Waiting', 'Done'] },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'regarding', label: 'Regarding', type: 'text' },
        { key: 'body', label: 'Message / Notes', type: 'textarea', full: true },
      ],
      title: (r) => r.subject,
      sub: (r) => [r.from, r.channel].filter(Boolean).join(' · '),
      value: () => null,
      meta: (r) => [['Date', fmtDate(r.date)], ['Re', r.regarding]],
      search: ['subject', 'from', 'regarding', 'body'],
    },
  };

  const STATUS_COLORS = {
    Identified: 'b-muted', Qualifying: 'b-blue', Capture: 'b-purple', Proposal: 'b-orange', Submitted: 'b-gold',
    Won: 'b-green', Lost: 'b-red', 'No-Bid': 'b-muted',
    New: 'b-blue', Contacted: 'b-purple', Qualified: 'b-gold', Converted: 'b-green', Dead: 'b-muted',
    Scheduled: 'b-blue', 'In Progress': 'b-gold', 'On Hold': 'b-orange', Complete: 'b-green',
    Active: 'b-green', Pending: 'b-orange', Closed: 'b-muted',
    'Needs reply': 'b-gold', Waiting: 'b-blue', Done: 'b-muted',
  };
  const STAGE_BAR = { Identified: '#8ea0bd', Qualifying: '#4c8dff', Capture: '#a77bff', Proposal: '#ff9f43', Submitted: '#f5b301' };

  const VIEWS = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'bids', label: 'Bids', icon: 'bids' },
    { id: 'leads', label: 'Leads', icon: 'leads' },
    { id: 'jobs', label: 'Jobs', icon: 'jobs' },
    { id: 'contracts', label: 'Contracts', icon: 'contracts' },
    { id: 'messages', label: 'Inbox', icon: 'messages' },
  ];

  // ---------- Utils ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const parseDate = (s) => (s ? new Date(s + 'T00:00:00') : null);
  const daysUntil = (s) => { const d = parseDate(s); if (!d) return null; const t = parseDate(todayISO()); return Math.round((d - t) / 86400000); };
  const fmtDate = (s) => { const d = parseDate(s); return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : ''; };
  const money = (n) => {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M';
    if (Math.abs(n) >= 1e4) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + n.toLocaleString();
  };
  const addDays = (n) => { const d = parseDate(todayISO()); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  // ---------- Storage ----------
  let state = load();

  function emptyState() { return { bids: [], leads: [], jobs: [], contracts: [], messages: [], sample: false }; }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return { ...emptyState(), ...JSON.parse(raw) };
    } catch (e) { /* storage unavailable */ }
    return seed();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save — storage unavailable'); }
  }

  function seed() {
    const s = emptyState();
    s.sample = true;
    const mk = (o) => ({ id: uid(), created: Date.now(), sample: true, ...o });
    s.bids = [
      mk({ title: 'Facilities Maintenance — Fort Example', agency: 'Dept. of the Army', solicitation: 'W912XX-26-R-0001', stage: 'Proposal', setAside: 'Small Business', naics: '561210', value: 1850000, due: addDays(5), pwin: 40 }),
      mk({ title: 'Janitorial Services BPA', agency: 'GSA Region 4', solicitation: '47PD0026Q0012', stage: 'Capture', setAside: 'WOSB', naics: '561720', value: 420000, due: addDays(18), pwin: 35 }),
      mk({ title: 'HVAC Repair IDIQ', agency: 'VA Medical Center', solicitation: '36C24726Q0101', stage: 'Qualifying', setAside: 'SDVOSB', naics: '238220', value: 2600000, due: addDays(26), pwin: 20 }),
      mk({ title: 'Grounds Maintenance', agency: 'USDA Forest Service', stage: 'Identified', setAside: 'Small Business', naics: '561730', value: 310000, due: addDays(40) }),
      mk({ title: 'Office Renovation — Sub to Prime', agency: 'Prime: Example Builders', stage: 'Submitted', setAside: 'None / Full & Open', naics: '236220', value: 275000, due: addDays(-3), pwin: 50 }),
      mk({ title: 'Snow Removal Services', agency: 'Air National Guard', stage: 'Won', setAside: 'Small Business', naics: '561790', value: 145000, due: addDays(-30) }),
      mk({ title: 'Painting Services', agency: 'Navy NAVFAC', stage: 'Lost', setAside: '8(a)', naics: '238320', value: 98000, due: addDays(-45) }),
    ];
    s.leads = [
      mk({ name: 'Jordan Reyes', company: 'Example Builders (Prime)', status: 'Qualified', source: 'Prime contractor', phone: '555-0101', value: 275000, followUp: addDays(1) }),
      mk({ name: 'Small Business Liaison', company: 'VA Network 7', status: 'Contacted', source: 'Event', value: 500000, followUp: addDays(3) }),
      mk({ name: 'Taylor Brooks', company: 'Brooks Property Mgmt', status: 'New', source: 'Thumbtack', phone: '555-0144', value: 12000, followUp: addDays(0) }),
    ];
    s.jobs = [
      mk({ title: 'Snow Removal — Season Start', client: 'Air National Guard', location: 'Base Example', status: 'Scheduled', value: 145000, start: addDays(9), due: addDays(120) }),
      mk({ title: 'Commercial Clean-out', client: 'Brooks Property Mgmt', location: 'Downtown', status: 'In Progress', value: 8500, start: addDays(-2), due: addDays(4) }),
    ];
    s.contracts = [
      mk({ title: 'Snow Removal Services', agency: 'Air National Guard', number: 'W50S-26-P-0042', type: 'FFP', status: 'Active', value: 145000, start: addDays(-10), end: addDays(170) }),
    ];
    s.messages = [
      mk({ subject: 'Q&A deadline — Facilities Maintenance', from: 'Contracting Officer', channel: 'Email', status: 'Needs reply', date: todayISO(), regarding: 'W912XX-26-R-0001' }),
      mk({ subject: 'Teaming agreement draft', from: 'Jordan Reyes', channel: 'Email', status: 'Waiting', date: addDays(-1), regarding: 'Office Renovation' }),
    ];
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    return s;
  }

  // ---------- Routing ----------
  const ui = { view: 'dashboard', filter: {}, query: {} };

  function go(view) {
    ui.view = view;
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignore */ }
    render();
    window.scrollTo({ top: 0 });
  }

  // ---------- Rendering ----------
  function renderNav() {
    const counts = {
      bids: state.bids.filter((b) => !['Won', 'Lost', 'No-Bid'].includes(b.stage)).length,
      leads: state.leads.filter((l) => !['Converted', 'Dead'].includes(l.status)).length,
      jobs: state.jobs.filter((j) => j.status !== 'Complete').length,
      contracts: state.contracts.filter((c) => c.status === 'Active').length,
      messages: state.messages.filter((m) => m.status === 'Needs reply').length,
    };
    $('#nav').innerHTML = VIEWS.map((v) => `
      <button data-go="${v.id}" class="${ui.view === v.id ? 'active' : ''}">${icon(v.icon)}<span>${v.label === 'Home' ? 'Dashboard' : v.label}</span>
      ${counts[v.id] ? `<span class="count">${counts[v.id]}</span>` : ''}</button>`).join('') +
      `<button data-go="settings" class="${ui.view === 'settings' ? 'active' : ''}">${icon('settings')}<span>Settings</span></button>`;
    $('#tabbar').innerHTML = VIEWS.map((v) => `
      <button data-go="${v.id}" class="${ui.view === v.id ? 'active' : ''}" aria-label="${v.label}">${icon(v.icon)}<span>${v.label}</span></button>`).join('');
  }

  function render() {
    renderNav();
    const coll = COLLECTIONS[ui.view];
    $('#view-title').textContent = ui.view === 'dashboard' ? 'GovCon Command Center' : ui.view === 'settings' ? 'Settings' : coll.label;
    $('#fab').hidden = ui.view === 'settings';
    const el = $('#view');
    if (ui.view === 'dashboard') el.innerHTML = renderDashboard();
    else if (ui.view === 'settings') el.innerHTML = renderSettings();
    else el.innerHTML = renderList(ui.view);
  }

  function renderDashboard() {
    const open = state.bids.filter((b) => !['Won', 'Lost', 'No-Bid'].includes(b.stage));
    const pipeline = open.reduce((a, b) => a + (+b.value || 0), 0);
    const weighted = open.reduce((a, b) => a + (+b.value || 0) * ((+b.pwin || 0) / 100), 0);
    const won = state.bids.filter((b) => b.stage === 'Won').length;
    const lost = state.bids.filter((b) => b.stage === 'Lost').length;
    const winRate = won + lost ? Math.round((won / (won + lost)) * 100) + '%' : '—';
    const active = state.contracts.filter((c) => c.status === 'Active');
    const backlog = active.reduce((a, c) => a + (+c.value || 0), 0);
    const openLeads = state.leads.filter((l) => !['Converted', 'Dead'].includes(l.status)).length;
    const needsReply = state.messages.filter((m) => m.status === 'Needs reply').length;
    const deadlines = collectDeadlines();
    const dueWeek = deadlines.filter((d) => d.days <= 7).length;

    const stages = ['Identified', 'Qualifying', 'Capture', 'Proposal', 'Submitted'];
    const byStage = stages.map((s) => {
      const items = open.filter((b) => b.stage === s);
      return { s, n: items.length, v: items.reduce((a, b) => a + (+b.value || 0), 0) };
    });
    const maxV = Math.max(1, ...byStage.map((x) => x.v));

    const activeJobs = state.jobs.filter((j) => j.status !== 'Complete');

    return `
      ${state.sample ? `<div class="panel" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <span style="color:var(--muted)">You're looking at <b style="color:var(--text)">sample data</b>. Add your own, then clear the samples.</span>
        <button class="btn" data-action="clear-sample">Clear sample data</button></div>` : ''}
      <div class="kpis">
        <div class="kpi accent"><div class="kpi-label">Open pipeline</div><div class="kpi-value">${money(pipeline)}</div><div class="kpi-sub">${open.length} bids · ${money(weighted)} weighted</div></div>
        <div class="kpi"><div class="kpi-label">Due in 7 days</div><div class="kpi-value" style="color:${dueWeek ? 'var(--orange)' : 'inherit'}">${dueWeek}</div><div class="kpi-sub">deadlines & follow-ups</div></div>
        <div class="kpi"><div class="kpi-label">Backlog</div><div class="kpi-value">${money(backlog)}</div><div class="kpi-sub">${active.length} active contract${active.length === 1 ? '' : 's'}</div></div>
        <div class="kpi"><div class="kpi-label">Win rate</div><div class="kpi-value">${winRate}</div><div class="kpi-sub">${won} won · ${lost} lost</div></div>
        <div class="kpi"><div class="kpi-label">Open leads</div><div class="kpi-value">${openLeads}</div><div class="kpi-sub">${activeJobs.length} active job${activeJobs.length === 1 ? '' : 's'}</div></div>
        <div class="kpi"><div class="kpi-label">Needs reply</div><div class="kpi-value" style="color:${needsReply ? 'var(--accent)' : 'inherit'}">${needsReply}</div><div class="kpi-sub">in inbox</div></div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <h2>Upcoming deadlines <span style="text-transform:none;letter-spacing:0;font-size:12.5px">next 30 days</span></h2>
          ${deadlines.length ? deadlines.slice(0, 8).map((d) => {
            const dt = parseDate(d.date);
            const cls = d.days < 0 ? 'overdue' : d.days <= 3 ? 'soon' : '';
            const when = d.days < 0 ? `${-d.days}d overdue` : d.days === 0 ? 'Today' : d.days === 1 ? 'Tomorrow' : `in ${d.days} days`;
            return `<div class="deadline" data-open="${d.coll}:${d.id}">
              <div class="date-chip ${cls}"><small>${dt.toLocaleDateString(undefined, { month: 'short' })}</small><b>${dt.getDate()}</b></div>
              <div class="deadline-main"><div class="deadline-title">${esc(d.title)}</div>
              <div class="deadline-sub">${esc(d.kind)} · ${when}</div></div></div>`;
          }).join('') : `<div class="empty">Nothing due in the next 30 days.</div>`}
        </div>

        <div class="panel">
          <h2>Bid pipeline <button data-go="bids">View all</button></h2>
          ${byStage.map((x) => `
            <div class="stage-row"><span>${x.s} <span style="color:var(--muted)">(${x.n})</span></span>
            <div class="stage-bar"><span style="width:${Math.max(x.v ? 4 : 0, (x.v / maxV) * 100)}%;background:${STAGE_BAR[x.s]}"></span></div>
            <span class="stage-val">${money(x.v)}</span></div>`).join('')}
          <h2 style="margin-top:22px">Active jobs <button data-go="jobs">View all</button></h2>
          ${activeJobs.length ? activeJobs.slice(0, 4).map((j) => `
            <div class="deadline" data-open="jobs:${j.id}"><div class="deadline-main">
              <div class="deadline-title">${esc(j.title)}</div><div class="deadline-sub">${esc(j.client || '')}</div></div>
              <span class="badge ${STATUS_COLORS[j.status] || 'b-muted'}">${esc(j.status || '')}</span></div>`).join('')
            : `<div class="empty">No active jobs.</div>`}
        </div>
      </div>`;
  }

  function collectDeadlines() {
    const out = [];
    const push = (coll, r, date, kind, title) => {
      const days = daysUntil(date);
      if (days !== null && days <= 30 && days >= -14) out.push({ coll, id: r.id, date, days, kind, title });
    };
    state.bids.filter((b) => !['Won', 'Lost', 'No-Bid', 'Submitted'].includes(b.stage)).forEach((b) => push('bids', b, b.due, 'Proposal due', b.title));
    state.leads.filter((l) => !['Converted', 'Dead'].includes(l.status)).forEach((l) => push('leads', l, l.followUp, 'Follow up', l.name + (l.company ? ' — ' + l.company : '')));
    state.jobs.filter((j) => j.status !== 'Complete').forEach((j) => {
      if (j.status === 'Scheduled') push('jobs', j, j.start, 'Job starts', j.title);
      push('jobs', j, j.due, 'Job due', j.title);
    });
    state.contracts.filter((c) => c.status === 'Active').forEach((c) => push('contracts', c, c.end, 'Contract ends', c.title));
    return out.sort((a, b) => a.days - b.days);
  }

  function renderList(key) {
    const c = COLLECTIONS[key];
    const items = state[key];
    const f = ui.filter[key] || 'All';
    const q = (ui.query[key] || '').toLowerCase();
    const statusOpts = c.fields.find((x) => x.key === c.statusField).options;
    const counts = Object.fromEntries(statusOpts.map((s) => [s, items.filter((i) => i[c.statusField] === s).length]));

    let list = items.filter((i) => (f === 'All' || i[c.statusField] === f) &&
      (!q || c.search.some((k) => String(i[k] || '').toLowerCase().includes(q))));
    const dateKey = { bids: 'due', leads: 'followUp', jobs: 'due', contracts: 'end', messages: 'date' }[key];
    list = list.slice().sort((a, b) => key === 'messages'
      ? String(b[dateKey] || '').localeCompare(String(a[dateKey] || ''))
      : String(a[dateKey] || '9999').localeCompare(String(b[dateKey] || '9999')));

    const total = list.reduce((a, r) => a + (+c.value(r) || 0), 0);

    return `
      <div class="toolbar">
        <input class="search" type="search" placeholder="Search ${c.label.toLowerCase()}…" value="${esc(ui.query[key] || '')}" data-search="${key}" />
        <div class="chips">
          <button class="chip ${f === 'All' ? 'active' : ''}" data-filter="${key}:All">All<span class="n">${items.length}</span></button>
          ${statusOpts.filter((s) => counts[s]).map((s) => `<button class="chip ${f === s ? 'active' : ''}" data-filter="${key}:${esc(s)}">${esc(s)}<span class="n">${counts[s]}</span></button>`).join('')}
        </div>
      </div>
      ${key !== 'messages' && list.length ? `<p style="color:var(--muted);margin:0 0 10px;font-size:13px">${list.length} shown · ${money(total)} total</p>` : ''}
      ${list.length ? `<div class="cards">${list.map((r) => renderCard(key, r)).join('')}</div>`
        : `<div class="empty">${items.length ? 'No matches.' : `No ${c.label.toLowerCase()} yet.`}<br /><button class="btn primary" data-action="new">Add ${c.singular.toLowerCase()}</button></div>`}`;
  }

  function renderCard(key, r) {
    const c = COLLECTIONS[key];
    const status = r[c.statusField];
    const v = c.value(r);
    const days = key === 'bids' ? daysUntil(r.due) : null;
    const urgent = days !== null && days >= 0 && days <= 7 && !['Won', 'Lost', 'No-Bid', 'Submitted'].includes(status);
    const meta = c.meta(r).filter(([, val]) => val);
    return `<article class="card" data-open="${key}:${r.id}" tabindex="0">
      <div class="card-top">
        <div style="min-width:0">
          <div class="card-title">${key === 'messages' && status === 'Needs reply' ? '<span class="unread"></span>' : ''}${esc(c.title(r))}</div>
          ${c.sub(r) ? `<div class="card-sub">${esc(c.sub(r))}</div>` : ''}
        </div>
        ${v ? `<div class="card-value">${money(v)}</div>` : ''}
      </div>
      <div class="card-meta">
        ${status ? `<span class="badge ${STATUS_COLORS[status] || 'b-muted'}">${esc(status)}</span>` : ''}
        ${urgent ? `<span class="badge b-red">Due ${days === 0 ? 'today' : `in ${days}d`}</span>` : ''}
        ${meta.map(([k, val]) => `<span>${esc(k)} <b>${esc(val)}</b></span>`).join('')}
      </div>
    </article>`;
  }

  function renderSettings() {
    const n = Object.keys(COLLECTIONS).reduce((a, k) => a + state[k].length, 0);
    return `<div class="settings">
      <div class="panel">
        <h2>Install on your phone</h2>
        <ol class="install-steps">
          <li><b>iPhone:</b> open this page in Safari → tap <b>Share</b> → <b>Add to Home Screen</b>.</li>
          <li><b>Android:</b> open in Chrome → tap <b>⋮</b> → <b>Install app</b> (or <b>Add to Home screen</b>).</li>
        </ol>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn primary" data-action="install" id="install-btn" ${deferredPrompt ? '' : 'hidden'}>Install app</button>
        </div>
      </div>
      <div class="panel">
        <h2>Your data</h2>
        <p>${n} records are stored privately on this device. Export a backup regularly, and import it to move your data to another device.</p>
        <div class="btn-row">
          <button class="btn" data-action="export">Export backup</button>
          <button class="btn" data-action="import">Import backup</button>
          ${state.sample ? '<button class="btn" data-action="clear-sample">Clear sample data</button>' : '<button class="btn" data-action="load-sample">Load sample data</button>'}
          <button class="btn danger" data-action="reset">Erase everything</button>
        </div>
        <input type="file" id="import-file" accept="application/json,.json" hidden />
      </div>
      ${location.hostname.endsWith('localhost') || location.protocol === 'file:' ? '' : `<div class="panel">
        <h2>Account</h2>
        <p>Sign out of the password gate on this device. Your data stays on the device.</p>
        <a class="btn" href="/__logout" style="display:inline-block;text-decoration:none">Sign out</a>
      </div>`}
    </div>`;
  }

  // ---------- Modal / CRUD ----------
  const modal = $('#modal');
  const form = $('#modal-form');
  let editing = null;

  function openForm(key, id) {
    const c = COLLECTIONS[key];
    const rec = id ? state[key].find((r) => r.id === id) : null;
    if (id && !rec) return;
    editing = { key, id };
    const defaults = { stage: 'Identified', status: c.fields.find((f) => f.key === c.statusField).options[0], date: todayISO(), setAside: 'Small Business' };
    const val = (f) => rec ? rec[f.key] ?? '' : (defaults[f.key] && c.fields.some((x) => x.key === f.key) ? defaults[f.key] : '');

    form.innerHTML = `
      <div class="modal-head"><h3>${rec ? 'Edit' : 'New'} ${esc(c.singular.toLowerCase())}</h3>
        <button type="button" class="icon-btn" data-action="close" aria-label="Close">✕</button></div>
      <div class="fields">
        ${c.fields.map((f) => {
          const v = val(f);
          const id_ = 'f-' + f.key;
          let input;
          if (f.type === 'select') input = `<select id="${id_}" name="${f.key}">${f.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
          else if (f.type === 'textarea') input = `<textarea id="${id_}" name="${f.key}">${esc(v)}</textarea>`;
          else input = `<input id="${id_}" name="${f.key}" type="${f.type}" ${f.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(v)}" ${f.required ? 'required' : ''} />`;
          return `<div class="field ${f.full ? 'full' : ''}"><label for="${id_}">${esc(f.label)}</label>${input}</div>`;
        }).join('')}
      </div>
      ${rec && rec.link ? `<p style="margin:12px 0 0"><a href="${esc(safeUrl(rec.link))}" target="_blank" rel="noopener" style="color:var(--blue)">Open link ↗</a></p>` : ''}
      <div class="modal-actions">
        ${rec ? '<button type="button" class="btn danger" data-action="delete">Delete</button>' : '<span></span>'}
        <div class="btn-row"><button type="button" class="btn" data-action="close">Cancel</button>
        <button type="submit" class="btn primary">Save</button></div>
      </div>`;
    modal.showModal();
    if (!rec) setTimeout(() => form.querySelector('input,select,textarea')?.focus(), 50);
  }

  function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\w+:/, ''); }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { key, id } = editing;
    const c = COLLECTIONS[key];
    const data = {};
    c.fields.forEach((f) => {
      const raw = form.elements[f.key].value.trim();
      data[f.key] = f.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw;
    });
    if (id) {
      const i = state[key].findIndex((r) => r.id === id);
      state[key][i] = { ...state[key][i], ...data, updated: Date.now() };
    } else {
      state[key].push({ id: uid(), created: Date.now(), ...data });
    }
    save(); modal.close(); render();
    toast(`${c.singular} saved`);
  });

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go],[data-open],[data-filter],[data-action]');
    if (!t) return;
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.open) { const [k, id] = t.dataset.open.split(':'); return openForm(k, id); }
    if (t.dataset.filter) { const i = t.dataset.filter.indexOf(':'); ui.filter[t.dataset.filter.slice(0, i)] = t.dataset.filter.slice(i + 1); return render(); }
    const a = t.dataset.action;
    if (a === 'close') modal.close();
    else if (a === 'new') openForm(ui.view);
    else if (a === 'delete') {
      if (!confirm('Delete this record? This cannot be undone.')) return;
      state[editing.key] = state[editing.key].filter((r) => r.id !== editing.id);
      save(); modal.close(); render(); toast('Deleted');
    } else if (a === 'clear-sample') {
      Object.keys(COLLECTIONS).forEach((k) => { state[k] = state[k].filter((r) => !r.sample); });
      state.sample = false; save(); render(); toast('Sample data cleared');
    } else if (a === 'load-sample') {
      const s = seed(); Object.keys(COLLECTIONS).forEach((k) => { state[k] = [...state[k], ...s[k]]; });
      state.sample = true; save(); render(); toast('Sample data loaded');
    } else if (a === 'reset') {
      if (!confirm('Erase ALL data on this device? Export a backup first if you need it.')) return;
      state = emptyState(); save(); render(); toast('All data erased');
    } else if (a === 'export') exportData();
    else if (a === 'import') $('#import-file').click();
    else if (a === 'install' && deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.card[data-open]')) e.target.click();
  });

  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-search]')) return;
    const key = e.target.dataset.search;
    ui.query[key] = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const s = $(`[data-search="${key}"]`); s.focus(); try { s.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id !== 'import-file' || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Object.keys(COLLECTIONS).some((k) => Array.isArray(data[k]))) throw new Error('bad file');
        state = { ...emptyState(), ...data };
        Object.keys(COLLECTIONS).forEach((k) => { if (!Array.isArray(state[k])) state[k] = []; });
        save(); render(); toast('Backup imported');
      } catch (err) { toast('That file is not a valid backup'); }
    };
    reader.readAsText(e.target.files[0]);
  });

  $('#fab').addEventListener('click', () => openForm(ui.view === 'dashboard' ? 'bids' : ui.view));
  $('#settings-btn').addEventListener('click', () => go('settings'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kcapex-backup-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ---------- PWA ----------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const b = $('#install-btn'); if (b) b.hidden = false;
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- Boot ----------
  $('#today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const initial = location.hash.slice(1);
  if (initial && (COLLECTIONS[initial] || initial === 'settings')) ui.view = initial;
  render();
})();
