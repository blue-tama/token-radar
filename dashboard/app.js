// Token Radar's dashboard, radar-2. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, the filters, a per-protocol detail view with the
// model's own inputs and the protocol's farm plan, and the live-token set. No network: every
// byte it shows is in data.js. The page recomputes each row's implied value and farm plan
// from the same derivation main.ts writes to board.json, so the page and the board agree.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var state = { q: '', category: 'all', chain: 'all', sort: 'implied', tab: 'pre-token', selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model, recomputed in the page from the snapshot figures: the same arithmetic as
  // lib/model.ts, so the detail view can check the number board.json carries.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity));
  }

  // The farm plan, re-derived in the page from the same inputs main.ts uses: category, chains,
  // TVL and age decide the action, the capital, the weeks and every cost and time.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 300;
    if (p.tvl_usd >= 1e9) return 200;
    if (p.tvl_usd >= 1e8) return 120;
    return 60;
  }
  function weeksFor(age) {
    if (age === null || age === undefined) return 6;
    if (age < 180) return 8;
    if (age < 365) return 6;
    return 4;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + capital + ' of USDC through ' + name + ' on ' + chain + ' and leave the loan open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Add $' + capital + ' of liquidity to ' + name + "'s deepest pool on " + chain + ' and keep the position in range.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC into ' + chain + ' through ' + name + ', then use the bridged funds inside its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Post $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s highest-yield vault on " + chain + ' and leave it compounding.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of ' + name + "'s yield-bearing asset on " + chain + ' and hold it in your wallet.';
    if (c.indexOf('prediction') >= 0) return 'Fund ' + name + ' with $' + capital + ' and take one small position on an outcome you have researched.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('launchpad') >= 0) return 'Lock $' + capital + ' through ' + name + ' on ' + chain + ' to qualify for its launch allocations.';
    if (c.indexOf('nft') >= 0) return 'Make one trade of about $' + capital + ' on ' + name + "'s marketplace on " + chain + '.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of payments through ' + name + ' on ' + chain + ' and keep the receipts.';
    if (c.indexOf('ai') >= 0 || c.indexOf('agent') >= 0) return 'Spend $' + capital + ' using ' + name + "'s service on " + chain + ' and keep the usage on record.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var weeks = weeksFor(p.age_days);
    return [
      { text: 'Open a fresh wallet for this farm only, keep its seed phrase offline, and fund it with $10 of gas money on ' + chain + '.', cost: 'about $10 of gas money plus $2 of gas', time: '10 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 200 ? 10 : 5) + ' of gas', time: '20 minutes to set up' },
      { text: 'Do one qualifying action every week for ' + weeks + ' weeks, such as a deposit, a swap, a vote or a claim, so the wallet shows steady use.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: "Open the protocol's own points, quests or rewards page once a week and finish every task it lists for your wallet.", cost: 'no fee to check', time: '10 minutes a week' },
      { text: 'When you claim, use only the link the protocol itself publishes, then write the wallet, dates and every transaction in a farm log.', cost: 'never pay to claim', time: '15 minutes' }
    ].map(stepText);
  }

  // -- state in the hash, so a view can be linked and screenshotted --------------------------
  // Every field resets to its default first: a hash that names no field clears it, so going
  // back and forth in history never leaves a stale filter or detail behind.
  function readHash() {
    state.q = ''; state.category = 'all'; state.chain = 'all';
    state.sort = 'implied'; state.tab = 'pre-token'; state.selected = null;
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // -- filtering and sorting -------------------------------------------------------------------
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -Infinity : a.age_days; bv = b.age_days === null ? -Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      var desc = key !== 'name';
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // -- rendering ---------------------------------------------------------------------------------
  var boardWrap = document.getElementById('boardWrap');
  var detailWrap = document.getElementById('detailWrap');
  var modelWrap = document.getElementById('modelWrap');

  function growthCell(r) {
    if (r.change_7d === null) return '<td class="num">n/a</td>';
    var cls = r.change_7d >= 0 ? 'pos' : 'neg';
    return '<td class="num ' + cls + '">' + esc(fmtPct(r.change_7d)) + '</td>';
  }

  function renderBoard() {
    var list = sortedRows(filteredRows());
    var count = document.getElementById('count');
    if (state.tab === 'live') {
      count.textContent = DATA.live.length + ' live-token protocols';
      var liveRows = DATA.live.map(function (r) {
        return '<tr><td class="num">live</td><td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' +
          esc(r.category || 'Other') + ' on ' + esc((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') +
          '</span></div></td><td class="num">' + esc(fmtUsd(r.tvl_usd)) + '</td>' + growthCell(r) +
          '<td class="num">' + esc(fmtUsd(r.mcap_usd)) + '</td><td><span class="status live">already trades</span></td></tr>';
      }).join('');
      boardWrap.innerHTML = '<div class="panel"><div class="table-wrap"><table>' +
        '<caption>Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.</caption>' +
        '<thead><tr><th scope="col">Status</th><th scope="col">Protocol</th><th scope="col" class="num">TVL</th><th scope="col" class="num">7d</th><th scope="col" class="num">Market cap</th><th scope="col">Token</th></tr></thead>' +
        '<tbody>' + liveRows + '</tbody></table></div></div>';
      return;
    }
    count.textContent = list.length + ' of ' + DATA.board_size + ' rows shown';
    if (list.length === 0) {
      boardWrap.innerHTML = '<div class="panel"><div class="empty"><h2>No protocol matches that filter</h2>' +
        '<p>Clear the search or pick another category or chain to see the board again.</p>' +
        '<button class="button" type="button" id="clearFilters">Clear filters</button></div></div>';
      document.getElementById('clearFilters').addEventListener('click', function () {
        state.q = ''; state.category = 'all'; state.chain = 'all';
        document.getElementById('q').value = '';
        document.getElementById('category').value = 'all';
        document.getElementById('chain').value = 'all';
        writeHash(); render();
      });
      return;
    }
    var max = list[0].implied_value_usd || 1;
    var rows = list.map(function (r) {
      var badge = r.on_watchlist ? '<span class="badge">watchlist</span>' : '<span class="badge">early</span>';
      var pct = Math.max(3, Math.round((r.implied_value_usd / max) * 100));
      return '<tr data-slug="' + esc(r.slug) + '" tabindex="0"' + (state.selected === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><div class="name"><b>' + esc(r.name) + badge + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' +
        esc((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') + '</span></div></td>' +
        '<td class="num">' + esc(fmtUsd(r.tvl_usd)) + '</td>' + growthCell(r) +
        '<td class="num">' + esc(fmtAge(r.age_days)) + '</td>' +
        '<td><div class="implied"><div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
        '<span class="num">' + esc(fmtUsd(r.implied_value_usd)) + '</span></div></td>' +
        '<td><span class="status">no token</span></td></tr>';
    }).join('');
    boardWrap.innerHTML = '<div class="panel"><div class="table-wrap"><table>' +
      '<caption>Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.</caption>' +
      '<thead><tr><th scope="col" class="num">Rank</th><th scope="col">Protocol</th><th scope="col" class="num">TVL</th>' +
      '<th scope="col" class="num">7d</th><th scope="col" class="num">Age</th><th scope="col">Implied value</th><th scope="col">Token</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
    boardWrap.querySelectorAll('tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); }
      });
    });
  }

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    renderBoard();
    var recomputed = impliedOf(row, DATA.model);
    var match = recomputed === row.implied_value_usd;
    var steps = farmSteps(row);
    var items = steps.map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return '<li><b>' + esc(action) + '</b><span class="cost">' + esc(tail) + '</span></li>';
    }).join('');
    detailWrap.innerHTML = '<article class="panel detail" id="detail">' +
      '<div class="detail-head"><div><span class="sub">Rank ' + row.rank + ' of ' + DATA.board_size +
      (row.on_watchlist ? ' · on the watchlist' : ' · early find below the floor') + '</span>' +
      '<h2>' + esc(row.name) + '</h2><p class="sub">' + esc(row.category || 'Other') + ' on ' +
      esc((row.chains || []).join(', ') || 'an unnamed chain') + '</p></div>' +
      '<button class="button ghost" type="button" id="closeDetail">Close</button></div>' +
      '<div class="facts">' +
      '<div class="fact"><span>TVL</span><b>' + esc(fmtUsd(row.tvl_usd)) + '</b></div>' +
      '<div class="fact"><span>Seven-day growth</span><b>' + esc(fmtPct(row.change_7d)) + '</b></div>' +
      '<div class="fact"><span>Age with no token</span><b>' + esc(fmtAge(row.age_days)) + '</b></div>' +
      '<div class="fact"><span>Growth multiplier</span><b>' + row.growth_multiplier + '</b></div>' +
      '<div class="fact"><span>Maturity multiplier</span><b>' + row.maturity_multiplier + '</b></div>' +
      '<div class="fact"><span>Implied value</span><b>' + esc(fmtUsd(row.implied_value_usd)) + '</b></div>' +
      '</div>' +
      '<div class="detail-sec"><p class="note">Model ' + esc(DATA.model_version) + ': the page recomputes this row as ' +
      esc(fmtUsd(recomputed)) + (match ? ', the same number board.json carries.' : ', which differs from the board — the data would be stale.') +
      ' This is an estimate, not a price.</p></div>' +
      '<div class="detail-sec"><h3>Farm plan</h3><ol class="steps">' + items + '</ol></div>' +
      '</article>';
    document.getElementById('closeDetail').addEventListener('click', function () {
      state.selected = null; writeHash(); render();
    });
    document.getElementById('detail').scrollIntoView({ block: 'nearest' });
  }

  function renderModel() {
    var m = DATA.model;
    modelWrap.innerHTML = '<section class="panel model"><h2>How implied value is computed</h2>' +
      '<p>Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.</p>' +
      '<div class="formula">implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )</div>' +
      '<p>TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. The board covers the whole watchlist and adds every rankable pre-token protocol below the floor; protocols whose token already trades are set aside with their market caps shown.</p></section>';
  }

  function renderMeta() {
    document.getElementById('topmeta').innerHTML = '<span>Snapshot ' + esc(DATA.as_of) + '</span><span>DefiLlama protocol index</span><span>' + esc(DATA.model_version) + ' model</span>';
    document.getElementById('asof').textContent = DATA.as_of;
    document.getElementById('lede').textContent = 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Implied value is a model, not a promise.';
    document.getElementById('stats').innerHTML =
      '<div class="stat"><span>Watchlist covered</span><b>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</b><small>every slug on the list</small></div>' +
      '<div class="stat"><span>Pre-token rows scored</span><b>' + DATA.board_size + '</b><small>ranked by implied value</small></div>' +
      '<div class="stat"><span>Early rows below the floor</span><b>' + DATA.early_size + '</b><small>the radar&rsquo;s own finds</small></div>' +
      '<div class="stat"><span>Live-token protocols set aside</span><b>' + DATA.live_size + '</b><small>market cap, not a model</small></div>';
  }

  function populateFilters() {
    var cats = [];
    DATA.rows.forEach(function (r) { var c = r.category || 'Other'; if (cats.indexOf(c) < 0) cats.push(c); });
    cats.sort();
    var chains = [];
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
    chains.sort();
    var catSel = document.getElementById('category');
    cats.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      if (c === state.category) o.selected = true;
      catSel.appendChild(o);
    });
    var chainSel = document.getElementById('chain');
    chains.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      if (c === state.chain) o.selected = true;
      chainSel.appendChild(o);
    });
    document.getElementById('q').value = state.q;
    document.getElementById('sort').value = state.sort;
  }

  function render() {
    // Keep the controls in step with the state: a hash navigation (back, forward, a link)
    // changes the state without rebuilding the selects, so sync them here.
    document.getElementById('q').value = state.q;
    document.getElementById('category').value = state.category;
    document.getElementById('chain').value = state.chain;
    document.getElementById('sort').value = state.sort;
    document.getElementById('tab-pre').setAttribute('aria-selected', state.tab === 'pre-token' ? 'true' : 'false');
    document.getElementById('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
    renderBoard();
    if (state.tab !== 'pre-token') detailWrap.innerHTML = '';
    if (state.selected && state.tab === 'pre-token') {
      var row = null;
      DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
      if (row) openDetail(state.selected);
    } else {
      detailWrap.innerHTML = '';
    }
  }

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; writeHash(); render(); });
  document.getElementById('category').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); render(); });
  document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); render(); });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; writeHash(); render(); });
  document.getElementById('tab-pre').addEventListener('click', function () { state.tab = 'pre-token'; writeHash(); render(); });
  document.getElementById('tab-live').addEventListener('click', function () { state.tab = 'live'; writeHash(); render(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.selected) { state.selected = null; writeHash(); render(); }
  });
  window.addEventListener('hashchange', function () { readHash(); render(); });

  readHash();
  renderMeta();
  populateFilters();
  renderModel();
  render();
})();
