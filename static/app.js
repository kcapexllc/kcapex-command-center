(() => {
  'use strict';

  const $app = document.getElementById('app');
  const $sheet = document.getElementById('sheet-root');
  const $toast = document.getElementById('toast');

  const S = { schema: null, openStages: [], recs: {}, connector: null, q: '', status: 'All' };
  const TABS = ['today', 'opportunities', 'subs', 'contracts', 'more'];

  const ICONS = {
    today: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    board: '<rect x="3.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="9.75" y="4" width="4.5" height="11" rx="1.2"/><rect x="16" y="4" width="4.5" height="7" rx="1.2"/>',
    people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8"/><path d="M17.6 14.6c1.9.7 3.1 2.3 3.4 4.9"/>',
    send: '<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
    doc: '<path d="M6.5 3.5h7.5l4 4v13h-11.5z"/><path d="M14 3.5v4h4"/><path d="M9.5 12.5h5M9.5 16h5"/>',
    receipt: '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8.5h6M9 12h6"/>',
    tag: '<path d="M3.5 12.5v-9h9l8 8-9 9z"/><circle cx="8" cy="8" r="1.4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
  };

  // ---------- small helpers ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  function icon(name) {
    const span = document.createElement('span');
    span.className = 'ic';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONS[name] || '') + '</svg>';
    return span;
  }
  function toast(text) {
    $toast.textContent = text;
    $toast.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('on'), 2600);
  }
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  function money(n) {
    if (n === null || n === undefined || n === '') return '';
    return Number.isInteger(Number(n)) ? usd.format(n) : usdCents.format(n);
  }
  function shortMoney(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e4) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n || 0);
  }
  function parseDay(s) { return s && s.length === 10 ? new Date(s + 'T00:00') : new Date(s); }
  function niceDate(s) {
    if (!s) return '';
    const d = parseDay(s);
    if (isNaN(d)) return s;
    const opts = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    let out = d.toLocaleDateString('en-US', opts);
    if (s.length > 10) out += ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return out;
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function countdown(iso) {
    const ms = new Date(iso) - Date.now();
    const abs = Math.abs(ms);
    const d = Math.floor(abs / 864e5), hr = Math.floor((abs % 864e5) / 36e5), min = Math.floor((abs % 36e5) / 6e4);
    const text = d >= 2 ? d + 'd' : d === 1 ? '1d ' + hr + 'h' : hr >= 1 ? hr + 'h ' + min + 'm' : min + 'm';
    return { text, late: ms < 0, tone: ms < 0 ? 'red' : abs < 2 * 864e5 ? 'amber' : 'violet' };
  }
  function spec(name) { return S.schema[name]; }
  function field(name, key) { return spec(name).fields.find(f => f.key === key); }
  function tone(name, key, value) {
    const f = field(name, key);
    return (f && f.tones && f.tones[value]) || 'grey';
  }
  function pill(name, key, value) {
    return value ? h('span', { class: 'pill t-' + tone(name, key, value) }, value) : null;
  }
  function sum(list, key) { return list.reduce((t, r) => t + (Number(r.data[key]) || 0), 0); }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-KC': '1' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error("Can't reach the command center. Check your connection and try again.");
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (res.status === 401 && url !== '/api/login') { showLogin(true); throw new Error('Sign in again.'); }
    if (!res.ok) throw new Error((data && data.error) || 'That did not work. Try again.');
    return data;
  }

  // ---------- sign in ----------
  function showWait() {
    const note = h('p', {}, 'Loading your command center.');
    $app.replaceChildren(h('div', { class: 'gate' }, h('div', { class: 'wait' },
      h('img', { src: '/icons/icon-192.png', alt: '' }), h('h1', {}, 'KCAPEX'), note)));
    setTimeout(() => { if (note.isConnected) note.textContent = 'Waking the server. After a quiet spell the first load can take up to a minute.'; }, 4000);
  }
  function showLogin(configured = true) {
    $sheet.replaceChildren();
    const err = h('p', { class: 'err', role: 'alert' });
    const input = h('input', { type: 'password', id: 'pw', autocomplete: configured ? 'current-password' : 'new-password', required: true, minlength: configured ? null : 10 });
    const again = configured ? null : h('input', { type: 'password', id: 'pw2', autocomplete: 'new-password', required: true });
    const button = h('button', { class: 'btn', type: 'submit' }, configured ? 'Sign in' : 'Create password');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        if (again && again.value !== input.value) { err.textContent = 'Those two passwords do not match.'; return; }
        button.disabled = true;
        try { await api('POST', configured ? '/api/login' : '/api/setup', { password: input.value }); await load(); }
        catch (ex) { err.textContent = ex.message; button.disabled = false; input.select(); }
      },
    },
      h('img', { src: '/icons/icon-192.png', alt: '' }),
      h('h1', {}, configured ? 'KCAPEX Command Center' : 'Create your password'),
      h('p', {}, configured ? 'Private to KCAPEX LLC.' : 'This is the first visit. Choose the password you and your partner will sign in with. At least 10 characters.'),
      h('label', { for: 'pw' }, 'Password'), input,
      again ? [h('label', { for: 'pw2' }, 'Type it again'), again] : null,
      err, button);
    $app.replaceChildren(h('div', { class: 'gate' }, form));
    input.focus();
  }

  async function load() {
    const boot = await api('GET', '/api/bootstrap');
    S.schema = boot.schema; S.openStages = boot.open_stages; S.goals = boot.goals; S.fy = boot.fiscal_year; S.recs = boot.records; S.connector = boot.connector;
    render();
  }

  // ---------- routing and shell ----------
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'c' && S.schema[parts[1]]) return { view: 'list', name: parts[1] };
    if (parts[0] === 'more' || parts[0] === 'settings') return { view: parts[0] };
    return { view: 'today' };
  }
  function navItems() {
    return [{ key: 'today', href: '#/today', label: 'Today', icon: 'today' }]
      .concat(Object.entries(S.schema).map(([name, s]) => ({ key: name, href: '#/c/' + name, label: s.label, icon: s.icon, count: S.recs[name].length })));
  }
  function render() {
    const r = route();
    const key = r.view === 'list' ? r.name : r.view;
    const items = navItems();
    const title = r.view === 'list' ? spec(r.name).label : r.view === 'settings' ? 'Settings' : r.view === 'more' ? 'More' : 'Today';
    const open = S.recs.opportunities.filter(b => S.openStages.includes(b.data.stage) || b.data.stage === 'Submitted');

    const side = h('aside', { class: 'side' },
      h('div', { class: 'brand' }, h('img', { src: '/icons/icon-192.png', alt: '' }), h('div', {}, h('b', {}, 'KCAPEX'), h('span', {}, 'Command Center'))),
      h('nav', { 'aria-label': 'Sections' }, items.map(i => h('a', { href: i.href, class: i.key === key ? 'on' : '' }, icon(i.icon), i.label, i.count ? h('span', { class: 'count num' }, i.count) : null))),
      h('div', { class: 'foot' }, h('a', { href: '#/settings', class: key === 'settings' ? 'on' : '' }, icon('gear'), 'Settings')));

    const addTarget = r.view === 'list' ? r.name : 'opportunities';
    const top = h('header', { class: 'top' },
      h('h1', {}, title),
      h('button', { class: 'wallet num', title: 'Bids not yet decided', onclick: () => { location.hash = '#/c/opportunities'; } }, shortMoney(sum(open, 'our_price')), h('small', {}, 'pending')),
      h('button', { class: 'round', 'aria-label': 'Add ' + spec(addTarget).singular, onclick: () => openForm(addTarget) }, icon('plus')),
      h('a', { class: 'round ghost', href: '#/settings', 'aria-label': 'Settings' }, 'KC'));

    const view = h('main', { id: 'view' });
    if (r.view === 'list') (spec(r.name).view === 'board' ? viewBoard : viewList)(view, r.name);
    else if (r.view === 'settings') viewSettings(view);
    else if (r.view === 'more') viewMore(view);
    else viewToday(view);

    const tabKey = TABS.includes(key) ? key : 'more';
    const tabs = h('nav', { class: 'tabs', 'aria-label': 'Sections' }, TABS.map(t => {
      const i = t === 'more' ? { href: '#/more', label: 'More', icon: 'more' } : items.find(x => x.key === t);
      return h('a', { href: i.href, class: t === tabKey ? 'on' : '' }, icon(i.icon), i.label);
    }));
    $app.replaceChildren(h('div', { class: 'shell' }, side, h('div', { class: 'main' }, top, view), tabs));
  }

  // ---------- rows ----------
  function recordRow(name, rec, opts = {}) {
    const s = spec(name), d = rec.data;
    const sub = (s.subtitle || []).map(k => d[k]).filter(Boolean).join(', ');
    const amount = s.amount && d[s.amount] != null ? money(d[s.amount]) : (name === 'hours' && d.hours != null ? d.hours + ' h' : '');
    return h('button', { class: 'row', onclick: () => openForm(name, rec) },
      opts.lead || null,
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, d[s.title] || 'Untitled'), sub ? h('div', { class: 'row-sub' }, sub) : null),
      h('div', { class: 'row-side' },
        amount ? h('div', { class: 'row-amt' }, amount) : null,
        s.status && !opts.quiet ? pill(name, s.status, d[s.status]) : null,
        opts.quiet && d.submitted_on ? h('div', { class: 'row-when' }, 'Sent ' + niceDate(d.submitted_on)) : null,
        !opts.lead && !opts.quiet && s.when && d[s.when] ? h('div', { class: 'row-when' }, niceDate(d[s.when])) : null));
  }
  function emptyState(text, name) {
    return h('div', { class: 'empty' }, h('p', {}, text),
      name ? h('button', { class: 'btn small primary', onclick: () => openForm(name) }, 'Add ' + spec(name).singular) : null);
  }

  // ---------- Today ----------
  function viewToday(view) {
    const bids = S.recs.opportunities;
    const open = bids.filter(b => S.openStages.includes(b.data.stage));
    const due = open.filter(b => b.data.due).sort((a, b) => a.data.due.localeCompare(b.data.due));
    const picks = bids.filter(b => b.data.today && !due.includes(b));
    const submitted = bids.filter(b => b.data.stage === 'Submitted');
    const active = S.recs.contracts.filter(c => ['Active', 'Awaiting start'].includes(c.data.status));
    const unpaid = S.recs.invoices.filter(i => i.data.status === 'Submitted');
    const today = todayISO();
    const waiting = S.recs.outreach.filter(o => o.data.status === 'Sent' || (o.data.follow_up && o.data.follow_up <= today && !['Quoted', 'Declined'].includes(o.data.status)));

    view.append(h('p', { class: 'dateline' }, new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })));

    const dueList = h('div', { class: 'panel' });
    if (!due.length) dueList.append(emptyState('No open bids have a due date. Add a bid with its quote deadline and the countdown shows here.', 'opportunities'));
    due.slice(0, 8).forEach(b => {
      const c = countdown(b.data.due);
      dueList.append(recordRow('opportunities', b, { lead: h('div', { class: 'clock t-' + c.tone }, c.text, h('small', {}, c.late ? 'late' : 'left')) }));
    });
    view.append(h('section', { class: 'section' }, h('h2', {}, 'Quotes due', due.length ? h('small', {}, plural(due.length, 'open bid')) : null), dueList));

    if (picks.length) {
      view.append(h('section', { class: 'section' }, h('h2', {}, 'Picked for today'), h('div', { class: 'panel' }, picks.map(b => recordRow('opportunities', b)))));
    }

    if (submitted.length) {
      const byNewest = submitted.slice().sort((a, b) => (b.data.submitted_on || '').localeCompare(a.data.submitted_on || ''));
      view.append(h('section', { class: 'section' }, h('h2', {}, 'Awaiting award', h('small', {}, plural(submitted.length, 'bid') + ', ' + money(sum(submitted, 'our_price')))),
        h('div', { class: 'panel' }, byNewest.slice(0, 5).map(b => recordRow('opportunities', b, { quiet: true })),
          submitted.length > 5 ? h('a', { class: 'seeall', href: '#/c/opportunities' }, 'See all ' + submitted.length + ' in Pipeline') : null)));
    }

    const cell = (value, label, href) => h('button', { onclick: () => { location.hash = href; } }, h('b', {}, value), h('span', {}, label));
    view.append(h('section', { class: 'section' }, h('h2', {}, 'Money'), h('div', { class: 'panel ledger' },
      cell(shortMoney(sum(open, 'our_price')), plural(open.length, 'open bid'), '#/c/opportunities'),
      cell(shortMoney(sum(submitted, 'our_price')), submitted.length + ' awaiting award', '#/c/opportunities'),
      cell(shortMoney(sum(active, 'value')), plural(active.length, 'active contract'), '#/c/contracts'),
      cell(shortMoney(sum(unpaid, 'amount')), plural(unpaid.length, 'unpaid invoice'), '#/c/invoices'))));


    // progress against the yearly targets
    const g = S.goals;
    if (g) {
      const month = today.slice(0, 7);
      const sent = bids.filter(b => (b.data.submitted_on || '').slice(0, 7) === month).length;
      const won = bids.filter(b => b.data.stage === 'Won').length, lost = bids.filter(b => b.data.stage === 'Lost').length;
      const rate = won + lost ? Math.round(100 * won / (won + lost)) : null;
      const paid = sum(S.recs.invoices.filter(i => i.data.status === 'Paid' && (i.data.paid_date || '') >= S.fy.start), 'amount');
      const meter = (label, value, pct, note) => h('div', { class: 'meter' },
        h('div', { class: 'meter-top' }, h('span', {}, label), h('b', { class: 'num' }, value)),
        h('div', { class: 'bar', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(Math.min(100, pct)) }, h('i', { style: 'width:' + Math.max(0, Math.min(100, pct)) + '%' })),
        h('small', {}, note));
      view.append(h('section', { class: 'section' }, h('h2', {}, S.fy.label + ' goals'), h('div', { class: 'panel meters' },
        meter('Bids sent this month', sent + ' of ' + g.bids_per_month, 100 * sent / g.bids_per_month, sent >= g.bids_per_month ? 'Target met.' : (g.bids_per_month - sent) + ' to go this month.'),
        meter('Win rate', rate === null ? 'No results yet' : rate + '%', rate === null ? 0 : 100 * rate / g.win_rate, 'Goal ' + g.win_rate + '%. Counts bids marked Won or Lost: ' + won + ' won, ' + lost + ' lost.'),
        meter('Paid this fiscal year', shortMoney(paid), 100 * paid / g.revenue, 'Goal ' + shortMoney(g.revenue) + '. Counts invoices marked Paid since ' + niceDate(S.fy.start) + '.'))));
    }

    const subsPanel = h('div', { class: 'panel' }, waiting.length ? waiting.slice(0, 6).map(o => recordRow('outreach', o))
      : emptyState('No sub replies outstanding. Log a quote request and it stays here until they answer.', 'outreach'));
    const invPanel = h('div', { class: 'panel' }, unpaid.length ? unpaid.slice(0, 6).map(i => recordRow('invoices', i))
      : emptyState('Nothing is waiting on payment.', 'invoices'));
    view.append(h('div', { class: 'two-up' },
      h('section', { class: 'section' }, h('h2', {}, 'Waiting on subs'), subsPanel),
      h('section', { class: 'section' }, h('h2', {}, 'Invoices out'), invPanel)));
  }

  // ---------- Pipeline board ----------
  function matches(rec, q) { return !q || JSON.stringify(rec.data).toLowerCase().includes(q.toLowerCase()); }
  function searchBox(onInput, label) {
    return h('div', { class: 'search' }, icon('search'),
      h('input', { type: 'search', placeholder: label, 'aria-label': label, value: S.q, oninput: (e) => { S.q = e.target.value; onInput(); } }));
  }
  function viewBoard(view, name) {
    const stageField = field(name, 'stage');
    const board = h('div', { class: 'board' });
    const draw = () => {
      board.replaceChildren(...stageField.options.map(stage => {
        const items = S.recs[name].filter(r => (r.data.stage || 'New') === stage && matches(r, S.q))
          .sort((a, b) => (a.data.due || '9999').localeCompare(b.data.due || '9999'));
        const total = sum(items, 'our_price');
        return h('div', { class: 'col' + (items.length ? '' : ' thin'), id: 'col-' + stage.replace(/\W+/g, '-') },
          h('div', { class: 'col-head' }, h('b', {}, stage), h('i', { class: 'num' }, items.length), total ? h('span', {}, shortMoney(total)) : null),
          items.length ? items.map(r => {
            const d = r.data, open = S.openStages.includes(stage);
            const c = d.due ? countdown(d.due) : null;
            return h('button', { class: 'deal', onclick: () => openForm(name, r) },
              h('div', { class: 'deal-title' }, d.title || 'Untitled'),
              h('div', { class: 'deal-sub' }, [d.agency, d.solicitation].filter(Boolean).join(', ') || 'No agency yet'),
              h('div', { class: 'deal-foot' },
                open ? (c ? h('span', { class: 'pill t-' + c.tone }, c.late ? c.text + ' late' : c.text + ' left') : h('span', { class: 'row-when' }, 'No due date')) : h('span', { class: 'row-when' }, d.submitted_on ? 'Sent ' + niceDate(d.submitted_on) : ''),
                d.our_price != null ? h('b', {}, money(d.our_price)) : null));
          }) : h('div', { class: 'col-empty' }, 'Nothing here.'));
      }));
    };
    const jump = h('div', { class: 'chips' }, stageField.options.map(stage => {
      const n = S.recs[name].filter(r => (r.data.stage || 'New') === stage).length;
      return h('button', { class: 'chip', onclick: () => {
        const col = document.getElementById('col-' + stage.replace(/\W+/g, '-'));
        if (col) board.scrollTo({ left: col.offsetLeft - board.offsetLeft - 16, behavior: 'smooth' });
      } }, stage, h('i', { class: 'num' }, n));
    }));
    view.append(h('div', { class: 'tools' }, searchBox(draw, 'Search bids'), jump), board);
    draw();
  }

  // ---------- generic list ----------
  function viewList(view, name) {
    const s = spec(name);
    const statusField = s.status ? field(name, s.status) : null;
    const chips = h('div', { class: 'chips' });
    const tally = h('p', { class: 'tally num' });
    const panel = h('div', { class: 'panel' });
    if (statusField && S.status !== 'All' && !statusField.options.includes(S.status)) S.status = 'All';
    const draw = () => {
      const base = S.recs[name].filter(r => matches(r, S.q));
      const shown = base.filter(r => S.status === 'All' || r.data[s.status] === S.status)
        .sort((a, b) => s.when ? (b.data[s.when] || '').localeCompare(a.data[s.when] || '') : b.updated_at.localeCompare(a.updated_at));
      if (statusField) {
        chips.replaceChildren(...['All'].concat(statusField.options).map(o => {
          const n = o === 'All' ? base.length : base.filter(r => r.data[s.status] === o).length;
          return h('button', { class: 'chip' + (S.status === o ? ' on' : ''), onclick: () => { S.status = o; draw(); } }, o, h('i', { class: 'num' }, n));
        }));
      }
      let line = plural(shown.length, s.singular);
      if (s.amount) line += ', ' + money(sum(shown, s.amount)) + ' total';
      if (name === 'hours') line += ', ' + sum(shown, 'hours') + ' hours';
      tally.textContent = line;
      panel.replaceChildren(...(shown.length ? shown.map(r => recordRow(name, r))
        : [emptyState(S.recs[name].length ? 'Nothing matches that search.' : 'No ' + s.label.toLowerCase() + ' saved yet.', S.recs[name].length ? null : name)]));
    };
    view.append(h('div', { class: 'tools' }, searchBox(draw, 'Search ' + s.label.toLowerCase()), statusField ? chips : null), tally, panel);
    draw();
  }

  // ---------- More and Settings ----------
  function viewMore(view) {
    const rest = navItems().filter(i => !TABS.includes(i.key));
    view.append(h('div', { class: 'panel morelist' },
      rest.map(i => h('a', { href: i.href }, icon(i.icon), i.label, h('span', { class: 'count num' }, i.count))),
      h('a', { href: '#/settings' }, icon('gear'), 'Settings')));
  }
  function viewSettings(view) {
    const wrap = h('div', { class: 'settings' });

    wrap.append(h('div', { class: 'card' }, h('h2', {}, 'Put it on your home screen'),
      h('ol', {}, h('li', {}, 'Open this page in Safari.'), h('li', {}, 'Tap the Share button.'), h('li', {}, 'Tap Add to Home Screen, then Add.')),
      h('p', {}, 'It opens full screen from its own icon. On Android, use Install app in the Chrome menu.')));

    const claude = h('div', { class: 'card' }, h('h2', {}, 'Connect Claude'));
    if (S.connector) {
      const box = h('input', { readonly: true, value: S.connector, 'aria-label': 'Connector address', onfocus: (e) => e.target.select() });
      claude.append(h('p', {}, 'Add this address to Claude as a custom connector. Claude can then read and update your pipeline, subs, contracts and the rest from any chat.'),
        h('div', { class: 'copybox' }, box, h('button', { class: 'btn', onclick: async () => {
          try { await navigator.clipboard.writeText(S.connector); toast('Address copied'); } catch (e) { box.select(); toast('Press and hold to copy'); }
        } }, 'Copy')),
        h('p', {}, 'Treat this address like a password. Anyone who has it can read and change your data.'));
    } else {
      claude.append(h('p', {}, 'The connector is off. Set MCP_TOKEN in Render to turn it on.'));
    }
    wrap.append(claude);

    const gErr = h('p', { class: 'err', role: 'alert' });
    const gv = S.goals || {};
    const gIn = (id, value) => h('input', { id, type: 'number', inputmode: 'decimal', min: '0', step: 'any', required: true, value: value === undefined ? '' : value });
    const gRev = gIn('g_rev', gv.revenue), gBids = gIn('g_bids', gv.bids_per_month), gWin = gIn('g_win', gv.win_rate);
    wrap.append(h('div', { class: 'card' }, h('h2', {}, 'Yearly goals'),
      h('p', {}, 'Today tracks your progress against these for the fiscal year that starts October 1.'),
      h('form', { onsubmit: async (e) => {
        e.preventDefault(); gErr.textContent = '';
        try { S.goals = await api('POST', '/api/goals', { revenue: gRev.value, bids_per_month: gBids.value, win_rate: gWin.value }); toast('Goals saved'); }
        catch (ex) { gErr.textContent = ex.message; }
      } },
        h('div', { class: 'field' }, h('label', { for: 'g_rev' }, 'Revenue goal for the year, in dollars'), gRev),
        h('div', { class: 'field' }, h('label', { for: 'g_bids' }, 'Bids to send each month'), gBids),
        h('div', { class: 'field' }, h('label', { for: 'g_win' }, 'Win rate goal, percent'), gWin),
        gErr, h('button', { class: 'btn primary', type: 'submit' }, 'Save goals'))));

    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const out = await api('POST', '/api/import', JSON.parse(await f.text()));
        toast('Restored ' + out.added + ', skipped ' + out.skipped); await load();
      } catch (ex) { toast(ex.message || 'That file could not be read.'); }
      e.target.value = '';
    } });
    wrap.append(h('div', { class: 'card' }, h('h2', {}, 'Back up your data'),
      h('p', {}, 'Download everything as one file. Restoring adds back anything missing and never overwrites what is here.'),
      h('div', { class: 'actions' }, h('a', { class: 'btn', href: '/api/export', download: '' }, 'Download backup'),
        h('button', { class: 'btn', onclick: () => file.click() }, 'Restore from backup'), file)));

    const err = h('p', { class: 'err', role: 'alert' });
    const cur = h('input', { type: 'password', id: 'cur', autocomplete: 'current-password', required: true });
    const nw = h('input', { type: 'password', id: 'nw', autocomplete: 'new-password', required: true, minlength: 10 });
    wrap.append(h('div', { class: 'card' }, h('h2', {}, 'Change password'),
      h('form', { onsubmit: async (e) => {
        e.preventDefault(); err.textContent = '';
        try { await api('POST', '/api/password', { current: cur.value, new: nw.value }); cur.value = nw.value = ''; toast('Password changed'); }
        catch (ex) { err.textContent = ex.message; }
      } },
        h('div', { class: 'field' }, h('label', { for: 'cur' }, 'Current password'), cur),
        h('div', { class: 'field' }, h('label', { for: 'nw' }, 'New password, at least 10 characters'), nw),
        err, h('button', { class: 'btn primary', type: 'submit' }, 'Change password'))));

    wrap.append(h('div', { class: 'card' }, h('h2', {}, 'Sign out'),
      h('p', {}, 'You stay signed in on this device for 60 days.'),
      h('button', { class: 'btn', onclick: async () => { await api('POST', '/api/logout'); showLogin(true); } }, 'Sign out')));
    view.append(wrap);
  }

  // ---------- add / edit sheet ----------
  function closeSheet() { $sheet.replaceChildren(); document.body.style.overflow = ''; }
  function openForm(name, rec) {
    const s = spec(name), d = rec ? rec.data : {};
    const inputs = {};
    const err = h('p', { class: 'err', role: 'alert' });
    const body = h('div', { class: 'sheet-body' });

    // one-tap actions for an existing record
    if (rec) {
      const quick = h('div', { class: 'quick' });
      if (name === 'opportunities') {
        const stages = field(name, 'stage').options, at = stages.indexOf(d.stage);
        if (at > -1 && at < stages.indexOf('Submitted')) {
          const next = stages[at + 1];
          quick.append(h('button', { class: 'btn small primary', type: 'button', onclick: () => save({ stage: next }, 'Moved to ' + next) }, 'Move to ' + next));
        }
      }
      s.fields.forEach(f => {
        const v = d[f.key]; if (!v) return;
        if (f.type === 'tel') quick.append(h('a', { class: 'btn small', href: 'tel:' + v }, 'Call'));
        if (f.type === 'email') quick.append(h('a', { class: 'btn small', href: 'mailto:' + v }, 'Email'));
        if (f.type === 'url' && /^https?:\/\//i.test(v)) quick.append(h('a', { class: 'btn small', href: v, target: '_blank', rel: 'noopener noreferrer' }, 'Open link'));
      });
      if (quick.children.length) body.append(quick);
    }

    s.fields.forEach(f => {
      const id = 'f_' + f.key;
      let v = d[f.key];
      if (!rec && v === undefined && f.default) v = f.default === 'today' ? todayISO() : f.default;
      let input;
      if (f.type === 'checkbox') {
        input = h('input', { type: 'checkbox', id });
        input.checked = !!v;
        inputs[f.key] = input;
        body.append(h('div', { class: 'field check' }, input, h('label', { for: id }, f.label)));
        return;
      }
      if (f.type === 'select') {
        input = h('select', { id }, f.required || f.default ? null : h('option', { value: '' }, 'Not set'), f.options.map(o => h('option', { value: o }, o)));
        input.value = v || (f.default && f.default !== 'today' ? f.default : '');
      } else if (f.type === 'textarea') {
        input = h('textarea', { id, rows: 4 });
        input.value = v || '';
      } else {
        const types = { money: 'number', number: 'number', date: 'date', datetime: 'datetime-local', email: 'email', tel: 'tel', url: 'url' };
        input = h('input', { id, type: types[f.type] || 'text', required: f.required, autocomplete: 'off' });
        if (f.type === 'money') { input.step = '0.01'; input.inputMode = 'decimal'; input.placeholder = '0.00'; }
        if (f.type === 'number') { input.step = '0.25'; input.inputMode = 'decimal'; }
        if (f.suggest) {
          const [from, key] = f.suggest.split('.');
          const names = [...new Set(S.recs[from].map(r => r.data[key]).filter(Boolean))];
          input.setAttribute('list', id + '_list');
          body.append(h('datalist', { id: id + '_list' }, names.map(n => h('option', { value: n }))));
        }
        input.value = v === undefined || v === null ? '' : v;
      }
      inputs[f.key] = input;
      body.append(h('div', { class: 'field' }, h('label', { for: id }, f.label), input));
    });

    async function save(only, message) {
      err.textContent = '';
      const data = only || {};
      if (!only) s.fields.forEach(f => { data[f.key] = f.type === 'checkbox' ? inputs[f.key].checked : inputs[f.key].value; });
      saveBtn.disabled = true;
      try {
        if (rec) {
          const out = await api('PUT', '/api/records/' + name + '/' + rec.id, data);
          S.recs[name] = S.recs[name].map(r => r.id === rec.id ? out : r);
        } else {
          S.recs[name].unshift(await api('POST', '/api/records/' + name, data));
        }
        closeSheet(); render(); toast(message || 'Saved');
      } catch (ex) { err.textContent = ex.message; saveBtn.disabled = false; body.scrollTop = body.scrollHeight; }
    }

    const saveBtn = h('button', { class: 'btn primary', type: 'submit' }, rec ? 'Save changes' : 'Add ' + s.singular);
    let armed = false;
    const del = rec ? h('button', { class: 'btn danger', type: 'button', onclick: async () => {
      if (!armed) { armed = true; del.textContent = 'Tap again to delete'; setTimeout(() => { armed = false; del.textContent = 'Delete'; }, 3500); return; }
      try {
        await api('DELETE', '/api/records/' + name + '/' + rec.id);
        S.recs[name] = S.recs[name].filter(r => r.id !== rec.id);
        closeSheet(); render(); toast('Deleted');
      } catch (ex) { err.textContent = ex.message; }
    } }, 'Delete') : null;

    body.append(err);
    const form = h('form', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': rec ? 'Edit ' + s.singular : 'Add ' + s.singular,
      onsubmit: (e) => { e.preventDefault(); save(); } },
      h('div', { class: 'sheet-head' }, h('h2', {}, rec ? 'Edit ' + s.singular : 'Add ' + s.singular),
        h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: closeSheet }, icon('x'))),
      body, h('div', { class: 'sheet-foot' }, del, saveBtn));
    const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) closeSheet(); } }, form);
    $sheet.replaceChildren(scrim);
    document.body.style.overflow = 'hidden';
  }

  // ---------- start ----------
  window.addEventListener('hashchange', () => { if (S.schema) { S.q = ''; S.status = 'All'; closeSheet(); render(); window.scrollTo(0, 0); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  setInterval(() => { if (S.schema && route().view === 'today' && !$sheet.children.length) render(); }, 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  (async () => {
    showWait();
    try {
      const who = await api('GET', '/api/session');
      if (who.authed) await load(); else showLogin(who.configured);
    } catch (ex) {
      $app.replaceChildren(h('div', { class: 'gate' }, h('div', { class: 'wait' }, h('h1', {}, 'KCAPEX'), h('p', {}, ex.message),
        h('button', { class: 'btn', onclick: () => location.reload() }, 'Try again'))));
    }
  })();
})();
