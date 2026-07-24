/* ==========================================================================
   $PAM — POLICY ANALYSIS MARKET  |  front-end controller
   ========================================================================== */
(function () {
  "use strict";
  var E = window.PAM;
  var state = E.load();

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };
  var fmt2 = function (n) { return (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  var view = "markets";
  var modal = { marketId: null, outcomeIdx: 0, side: "buy" };

  /* ---- Starfield ---------------------------------------------------------*/
  (function stars() {
    var host = $("stars"), html = "";
    for (var i = 0; i < 120; i++) {
      var s = (Math.random() * 2 + 0.4).toFixed(1);
      var op = (Math.random() * 0.7 + 0.2).toFixed(2);
      html += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' +
        (Math.random() * 100).toFixed(1) + '%;width:' + s + 'px;height:' + s +
        'px;opacity:' + op + '"></i>';
    }
    host.innerHTML = html;
  })();

  /* ---- Clock + spot ------------------------------------------------------*/
  function tickClock() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    var ss = String(d.getSeconds()).padStart(2, "0");
    $("clock").textContent = hh + ":" + mm + ":" + ss + " ZULU";
  }
  setInterval(tickClock, 1000); tickClock();
  $("yr").textContent = new Date().getFullYear();

  /* ---- Live $PAM price (DexScreener, real on-chain data) -----------------*/
  var CA = "73Ldwtam8mZZALK4veHMDsnMBcsPJMQcapaYk8bHpump";
  function fmtUsdPrice(v) {
    if (!isFinite(v) || v <= 0) return "--";
    if (v >= 1) return "$" + v.toFixed(4);
    // sub-dollar meme prices: keep 4 significant figures
    return "$" + v.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
  }
  function fmtMcap(v) {
    if (!isFinite(v) || v <= 0) return "--";
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    return "$" + Math.round(v);
  }
  function fetchPrice() {
    fetch("https://api.dexscreener.com/latest/dex/tokens/" + CA)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var pairs = d && d.pairs ? d.pairs : [];
        if (!pairs.length) return;
        // prefer the most-liquid pair
        pairs.sort(function (a, b) {
          return (b.liquidity && b.liquidity.usd || 0) - (a.liquidity && a.liquidity.usd || 0);
        });
        var p = pairs[0];
        var usd = parseFloat(p.priceUsd);
        var chg = parseFloat((p.priceChange || {}).h24);
        var mc = p.marketCap || p.fdv;
        $("spot").textContent = fmtUsdPrice(usd);
        var chgEl = $("chg");
        if (isFinite(chg)) {
          chgEl.textContent = (chg >= 0 ? "▲ " : "▼ ") + Math.abs(chg).toFixed(0) + "%";
          chgEl.className = chg >= 0 ? "up" : "down";
        }
        $("mcap").textContent = fmtMcap(mc);
      })
      .catch(function () { /* offline / rate-limited: keep last value */ });
  }
  fetchPrice();
  setInterval(fetchPrice, 30000);

  /* ---- Copy contract address ---------------------------------------------*/
  $("caCopy").addEventListener("click", function () {
    var txt = $("caText").textContent.trim();
    var done = function () {
      var b = $("caCopy"); b.textContent = "COPIED ✔"; b.classList.add("done");
      setTimeout(function () { b.textContent = "COPY"; b.classList.remove("done"); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { legacyCopy(txt); done(); });
    } else { legacyCopy(txt); done(); }
  });
  function legacyCopy(txt) {
    var ta = document.createElement("textarea");
    ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---- Hit counter (fake, persisted-ish) ---------------------------------*/
  (function hits() {
    var n = parseInt(localStorage.getItem("pam_hits") || "0", 10);
    n += Math.floor(Math.random() * 7) + 1;
    if (n < 1337000) n += 1337042;
    localStorage.setItem("pam_hits", String(n));
    $("hits").textContent = String(n).padStart(7, "0").slice(-7);
  })();

  /* ---- Sparkline canvas --------------------------------------------------*/
  function drawSpark(canvas, hist, tint) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 188, h = canvas.clientHeight || 90;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    // grid
    ctx.strokeStyle = "rgba(80,120,170,.25)"; ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) {
      var y = (h - 8) * g / 4 + 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    var pts = hist.slice(-60);
    if (pts.length < 2) pts = [pts[0] || 0.5, pts[0] || 0.5];
    var n = pts.length;
    function X(i) { return i / (n - 1) * (w - 2) + 1; }
    function Y(v) { return (1 - v) * (h - 8) + 4; }
    // area
    ctx.beginPath(); ctx.moveTo(X(0), h);
    for (var i = 0; i < n; i++) ctx.lineTo(X(i), Y(pts[i]));
    ctx.lineTo(X(n - 1), h); ctx.closePath();
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, tint + "55"); grad.addColorStop(1, tint + "05");
    ctx.fillStyle = grad; ctx.fill();
    // line
    ctx.beginPath();
    for (i = 0; i < n; i++) { var fn = i ? "lineTo" : "moveTo"; ctx[fn](X(i), Y(pts[i])); }
    ctx.strokeStyle = tint; ctx.lineWidth = 1.8; ctx.stroke();
    // last dot
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(X(n - 1), Y(pts[n - 1]), 2.4, 0, 7); ctx.fill();
  }

  var TINTS = ["#3fae5f", "#e8564a", "#f0a832", "#4f8be6", "#9a6bd8"];

  /* ======================================================================
     VIEWS
     ====================================================================== */
  function renderMarkets() {
    var open = state.markets.filter(function (m) { return m.resolved === null; });
    var html = '<div class="section-head"><h1>OPEN CONTRACTS</h1>' +
      '<div class="sub">' + open.length + ' active markets &middot; prices = crowd-implied probability</div></div>';

    html += '<div class="intro"><span class="declassified">DECLASSIFIED</span>' +
      '<b>FUTUREMAP TERMINAL ONLINE.</b> The monetary value of a contract reflects the ' +
      'probability the crowd assigns to the event. Buy a contract you think is underpriced, ' +
      'sell one you think is overpriced. Each share pays <b>1 $PAM</b> if it resolves true, ' +
      '<b>0</b> if false. You were issued <b>' + fmt(E.STARTING_BALANCE) + ' $PAM</b> on arrival. ' +
      'The market maker always quotes a price. <i>The future is a tradeable asset.</i></div>';

    state.markets.forEach(function (m) {
      var p = E.prices(m);
      var resolved = m.resolved !== null;
      html += '<div class="market" data-mkt="' + m.id + '">';
      html += '<div class="head"><div><div class="q">' + esc(m.question) + '</div>' +
        '<div class="lore">' + esc(m.lore) + '</div></div>' +
        '<div class="closes">CLOSES<b>' + m.closes + '</b>VOL ' + fmt(m.volume) + '</div></div>';

      html += '<div class="grid">';
      html += '<div class="chartbox"><canvas data-spark="' + m.id + '"></canvas>' +
        '<div class="cap" data-cap="' + m.id + '">' + esc(m.outcomes[0]) + ' &rarr; ' + (p[0] * 100).toFixed(1) + '%</div></div>';

      html += '<div class="outcomes">';
      m.outcomes.forEach(function (o, i) {
        var held = E.positionShares(state, m.id, i);
        var winner = resolved && m.resolved === i;
        html += '<div class="outcome c' + (i % 5) + '">' +
          '<span class="name">' + esc(o) + (winner ? ' &#10004;' : '') + '</span>' +
          '<span class="bar"><i data-bar="' + m.id + '|' + i + '" style="width:' + (p[i] * 100).toFixed(1) + '%"></i></span>' +
          '<span class="pct" data-pct="' + m.id + '|' + i + '">' + (p[i] * 100).toFixed(1) + '%</span>' +
          '<span class="pos">' + (held > 0.001 ? fmt2(held) + ' sh' : '&mdash;') + '</span>';
        if (!resolved) {
          html += '<span class="acts">' +
            '<button class="btn buy" data-trade="' + m.id + '|' + i + '|buy">BUY</button>' +
            (held > 0.001 ? '<button class="btn sell" data-trade="' + m.id + '|' + i + '|sell">SELL</button>' : '') +
            '</span>';
        } else {
          html += '<span class="acts" style="color:#7a45c0;font-weight:bold;font-size:10px">' +
            (winner ? 'PAID 1.00' : 'EXPIRED') + '</span>';
        }
        html += '</div>';
      });
      html += '</div></div>';

      // Admin-style resolve controls (this is a sim; let the user settle markets)
      if (!resolved) {
        html += '<div style="padding:6px 10px;border-top:1px solid #c0c6cc;font-size:9.5px;color:#556">' +
          'SETTLE (simulate outcome): ';
        m.outcomes.forEach(function (o, i) {
          html += '<button class="btn" data-resolve="' + m.id + '|' + i + '" style="font-size:9px">' + esc(o) + '</button> ';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    return html;
  }

  function renderPortfolio() {
    var html = '<div class="section-head"><h1>MY POSITIONS</h1><div class="sub">marked to live market price</div></div>';
    var keys = Object.keys(state.positions);
    var pv = E.portfolioValue(state);
    html += '<div class="intro"><b>ACCOUNT SUMMARY.</b> Cash <b>' + fmt(state.balance) +
      ' $PAM</b> &nbsp;|&nbsp; Open positions marked at <b>' + fmt2(pv) + ' $PAM</b> &nbsp;|&nbsp; ' +
      'Net worth <b>' + fmt(state.balance + pv) + ' $PAM</b></div>';

    if (!keys.length) {
      html += '<div class="panel"><div class="body" style="text-align:center;color:#556;padding:26px">' +
        'No open positions. Head to <b>MARKETS</b> and take a view on the future.</div></div>';
      return html;
    }
    html += '<div class="panel"><h2>OPEN LOTS</h2><div class="body" style="padding:0">' +
      '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
      '<tr style="background:#d2d7dc;font-weight:bold"><td style="padding:5px 8px">MARKET</td>' +
      '<td style="padding:5px 8px">OUTCOME</td><td style="padding:5px 8px;text-align:right">SHARES</td>' +
      '<td style="padding:5px 8px;text-align:right">PRICE</td><td style="padding:5px 8px;text-align:right">VALUE</td>' +
      '<td style="padding:5px 8px;text-align:right">ACTION</td></tr>';
    keys.forEach(function (k) {
      var parts = k.split(":"); var m = E.marketById(state, parts[0]);
      if (!m) return;
      var i = +parts[1]; var sh = state.positions[k]; var pr = E.prices(m)[i];
      html += '<tr style="border-bottom:1px dotted #b0b7bf">' +
        '<td style="padding:5px 8px">' + esc(m.question.slice(0, 42)) + (m.question.length > 42 ? '&hellip;' : '') + '</td>' +
        '<td style="padding:5px 8px;font-weight:bold">' + esc(m.outcomes[i]) + '</td>' +
        '<td style="padding:5px 8px;text-align:right;font-family:monospace">' + fmt2(sh) + '</td>' +
        '<td style="padding:5px 8px;text-align:right;font-family:monospace">' + pr.toFixed(3) + '</td>' +
        '<td style="padding:5px 8px;text-align:right;font-family:monospace">' + fmt2(sh * pr) + '</td>' +
        '<td style="padding:5px 8px;text-align:right"><button class="btn sell" data-trade="' + m.id + '|' + i + '|sell">SELL</button></td>' +
        '</tr>';
    });
    html += '</table></div></div>';
    return html;
  }

  function renderAbout() {
    return '<div class="section-head"><h1>THE LORE</h1><div class="sub">a thwarted experiment, relisted</div></div>' +
    '<div class="panel"><h2>WHAT WAS THE POLICY ANALYSIS MARKET? <span class="pill">2001&ndash;2003</span></h2><div class="body">' +
    '<p>The <b>Policy Analysis Market (PAM)</b> was a real US government project. Part of the <b>FutureMAP</b> ' +
    'program inside DARPA\'s <b>Information Awareness Office</b>, it was proposed in May 2001 as a futures ' +
    'exchange &mdash; "a market in the future of the Middle East." The premise, borrowed from economist ' +
    '<b>Robin Hanson</b> and proven by the University of Iowa\'s election markets, was radical: the price of a ' +
    'contract is the crowd\'s probability estimate, and crowds routinely beat pundits and polls.</p>' +
    '<p>In July 2003, Senators <b>Ron Wyden</b> and <b>Byron Dorgan</b> held a press conference. On faded ' +
    'sample screens buried in the interface, someone had used lurid placeholder examples. Wyden called it ' +
    '"a federal betting parlor on atrocities and terrorism... ridiculous and grotesque." Dorgan called it ' +
    '"useless, offensive and unbelievably stupid." Within a day the Pentagon cancelled it. Within a week ' +
    '<b>John Poindexter</b> resigned, insisting to the end that the program was "largely misunderstood."</p>' +
    '<p>The idea did not die. Net Exchange planned a relaunch. Popular Science ran the PopSci Predictions ' +
    'Exchange. Intrade traded futures on the capture of bin Laden. The CIA\'s own Studies in Intelligence ' +
    'published a paper on using prediction markets to sharpen analysis. Today <b>Polymarket</b> and ' +
    '<b>Kalshi</b> clear enormous volume on exactly the mechanism PAM was killed for proposing.</p>' +
    '<p style="background:#0c1016;color:#8fc0ff;padding:10px;font-family:monospace;font-size:11px">' +
    '&gt; $PAM is a memecoin tribute to the market that was cancelled 20 years too early.<br>' +
    '&gt; Proposed 2001. Killed 2003. Vindicated by every prediction market since.<br>' +
    '&gt; This terminal is the experiment they wouldn\'t let run &mdash; in play money.</p>' +
    '<p style="font-size:10px;color:#556">Sources: <a href="https://en.wikipedia.org/wiki/Policy_Analysis_Market" target="_blank" rel="noopener">Wikipedia</a>, ' +
    'Robin Hanson (2007) <i>Innovations</i>, and the CIA Center for the Study of Intelligence. ' +
    'Historical account only; no endorsement of the original violent-event examples, which this project does not reproduce.</p>' +
    '</div></div>';
  }

  function renderHow() {
    return '<div class="section-head"><h1>HOW IT WORKS</h1><div class="sub">Logarithmic Market Scoring Rule</div></div>' +
    '<div class="panel"><h2>THE MARKET MAKER <span class="pill">LMSR</span></h2><div class="body">' +
    '<p>There is no order book and no counterparty needed. An <b>automated market maker</b> named after ' +
    'Robin Hanson quotes a price for every contract at all times using the ' +
    '<b>Logarithmic Market Scoring Rule</b>:</p>' +
    '<p style="text-align:center;background:#0c1016;color:#7fff9a;font-family:monospace;padding:12px;font-size:13px">' +
    'C(q) = b &middot; ln( &Sigma; e<sup>q&#8342;/b</sup> ) &nbsp;&nbsp;&nbsp; price&#8342; = e<sup>q&#8342;/b</sup> / &Sigma; e<sup>q&#8323;/b</sup></p>' +
    '<p>Buying shares of an outcome pushes its price up; selling pushes it down. Prices across a market ' +
    'always sum to 100%, so they read directly as probabilities. The liquidity parameter <b>b = ' + E.B +
    '</b> sets how much capital it takes to move the price &mdash; deeper markets resist manipulation.</p>' +
    '<ol style="font-size:11.5px;line-height:1.8">' +
    '<li><b>BUY</b> a contract you think the crowd has underpriced.</li>' +
    '<li>Each share pays <b>1 $PAM</b> if the outcome resolves true, <b>0</b> if false.</li>' +
    '<li><b>SELL</b> any time to take profit or cut a loss at the live price.</li>' +
    '<li>Hit <b>SETTLE</b> on a market to simulate an outcome and see your positions pay out.</li>' +
    '</ol>' +
    '<p style="font-size:10px;color:#556">Everything is play money stored in your browser (localStorage). ' +
    'Nothing is transmitted anywhere. RESET TERMINAL wipes it back to a fresh ' + fmt(E.STARTING_BALANCE) + ' $PAM.</p>' +
    '</div></div>';
  }

  /* ======================================================================
     RENDER + WIRING
     ====================================================================== */
  function render() {
    var c = $("content");
    if (view === "markets") c.innerHTML = renderMarkets();
    else if (view === "portfolio") c.innerHTML = renderPortfolio();
    else if (view === "about") c.innerHTML = renderAbout();
    else c.innerHTML = renderHow();

    // draw sparklines
    if (view === "markets") {
      document.querySelectorAll("canvas[data-spark]").forEach(function (cv) {
        var m = E.marketById(state, cv.getAttribute("data-spark"));
        drawSpark(cv, m.history, "#4f8be6");
      });
    }
    renderSidebar();
  }

  function renderSidebar() {
    var pv = E.portfolioValue(state);
    $("sideBal").textContent = fmt(state.balance);
    $("sidePos").textContent = fmt2(pv);
    $("sideNet").textContent = fmt(state.balance + pv);
    // tape
    var tape = $("tape");
    if (!state.log.length) { tape.innerHTML = "<li>Awaiting order flow...</li>"; return; }
    tape.innerHTML = state.log.slice(0, 12).map(function (e) {
      var cls = e.t === "BOUGHT" ? "buy" : e.t === "SOLD" ? "sell" : "res";
      var label = e.t === "RESOLVED"
        ? '<span class="t res">SETTLED</span> ' + esc(e.o) + ' &rarr; +' + fmt(e.c)
        : '<span class="t ' + cls + '">' + e.t + '</span> ' + fmt(e.n) + ' ' + esc(e.o) + ' @ ' + fmt(e.c);
      return '<li>' + label + '</li>';
    }).join("");
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---- Nav ---------------------------------------------------------------*/
  document.querySelectorAll(".nav a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      document.querySelectorAll(".nav a").forEach(function (x) { x.classList.remove("active"); });
      a.classList.add("active");
      view = a.getAttribute("data-view");
      render();
    });
  });

  /* ---- Delegated clicks (trade / resolve) --------------------------------*/
  $("content").addEventListener("click", function (e) {
    var t = e.target.closest("[data-trade]");
    if (t) { var p = t.getAttribute("data-trade").split("|"); openModal(p[0], +p[1], p[2]); return; }
    var r = e.target.closest("[data-resolve]");
    if (r) {
      var rp = r.getAttribute("data-resolve").split("|");
      var m = E.marketById(state, rp[0]);
      if (confirm('Settle "' + m.question + '"\n\nas: ' + m.outcomes[+rp[1]] +
        ' ?\n\nThis pays winning shares and expires the rest.')) {
        E.resolve(state, rp[0], +rp[1]);
        toast("Market settled: " + m.outcomes[+rp[1]] + " wins.");
        render();
      }
    }
  });

  /* ---- Modal -------------------------------------------------------------*/
  function openModal(marketId, outcomeIdx, side) {
    modal.marketId = marketId; modal.outcomeIdx = outcomeIdx; modal.side = side;
    var m = E.marketById(state, marketId);
    $("mTitle").textContent = "TRADE TICKET :: " + m.outcomes[outcomeIdx];
    $("mQ").innerHTML = "<b>" + esc(m.question) + "</b>";
    $("mOutLbl").textContent = "OUTCOME: " + m.outcomes[outcomeIdx];
    setSide(side);
    $("mShares").value = 100; $("mSlider").value = 100;
    updateQuote();
    $("modalBack").classList.add("open");
  }
  function closeModal() { $("modalBack").classList.remove("open"); }

  function setSide(side) {
    modal.side = side;
    document.querySelectorAll("[data-side]").forEach(function (b) {
      b.style.outline = b.getAttribute("data-side") === side ? "3px solid #16294f" : "none";
    });
  }
  document.querySelectorAll("[data-side]").forEach(function (b) {
    b.addEventListener("click", function () { setSide(b.getAttribute("data-side")); updateQuote(); });
  });

  function currentShares() {
    var v = parseFloat($("mShares").value); return isNaN(v) || v < 0 ? 0 : v;
  }
  function updateQuote() {
    var m = E.marketById(state, modal.marketId);
    var sh = currentShares();
    var signed = modal.side === "buy" ? sh : -sh;
    var held = E.positionShares(state, modal.marketId, modal.outcomeIdx);
    var p0 = E.prices(m)[modal.outcomeIdx];
    var box = $("mQuote");

    if (modal.side === "sell" && sh > held + 1e-9) {
      box.innerHTML = '<div class="warn">You only hold ' + fmt2(held) + ' shares of this outcome.</div>';
      $("mConfirm").disabled = true; return;
    }
    var cost = E.quote(m, modal.outcomeIdx, signed);
    // price after
    var q2 = m.q.slice(); q2[modal.outcomeIdx] += signed;
    var pAfter = window.PAM.prices({ q: q2 })[modal.outcomeIdx];
    var afford = modal.side === "buy" ? cost <= state.balance + 1e-9 : true;
    $("mConfirm").disabled = !afford || sh <= 0;

    box.innerHTML =
      'CURRENT PRICE &nbsp;<b>' + (p0 * 100).toFixed(1) + '%</b> &rarr; AFTER FILL <b>' + (pAfter * 100).toFixed(1) + '%</b><br>' +
      (modal.side === "buy" ? 'COST TO BUY' : 'PROCEEDS FROM SELL') +
      ' <span class="big">' + fmt2(Math.abs(cost)) + '</span> $PAM<br>' +
      '<span style="font-size:10px;color:#9fb4c8">Max payout if true: ' + fmt(sh) + ' $PAM &middot; ' +
      'Balance after: ' + fmt(state.balance - cost) + ' $PAM</span>' +
      (!afford ? '<div class="warn">Insufficient balance.</div>' : '');
  }
  $("mShares").addEventListener("input", function () {
    var v = Math.min(1000, Math.max(0, currentShares())); $("mSlider").value = v; updateQuote();
  });
  $("mSlider").addEventListener("input", function () {
    $("mShares").value = $("mSlider").value; updateQuote();
  });
  $("mClose").addEventListener("click", closeModal);
  $("modalBack").addEventListener("click", function (e) { if (e.target === $("modalBack")) closeModal(); });
  $("mConfirm").addEventListener("click", function () {
    var sh = currentShares(); if (sh <= 0) return;
    var signed = modal.side === "buy" ? sh : -sh;
    var res = E.trade(state, modal.marketId, modal.outcomeIdx, signed);
    if (res.ok) { toast(res.msg); closeModal(); render(); }
    else { toast(res.msg, true); }
  });

  /* ---- Reset -------------------------------------------------------------*/
  $("resetBtn").addEventListener("click", function () {
    if (confirm("Reset the terminal? This wipes all positions and restores " +
      fmt(E.STARTING_BALANCE) + " $PAM.")) {
      state = E.reset(); view = "markets";
      document.querySelectorAll(".nav a").forEach(function (x) { x.classList.remove("active"); });
      document.querySelector('.nav a[data-view="markets"]').classList.add("active");
      render(); toast("Terminal reset. Fresh " + fmt(E.STARTING_BALANCE) + " $PAM issued.");
    }
  });

  /* ---- Toast -------------------------------------------------------------*/
  var toastTimer;
  function toast(msg, err) {
    var el = $("toast"); el.textContent = msg;
    el.className = "toast show" + (err ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 2600);
  }

  /* ---- Ambient crowd -----------------------------------------------------
     Update the DOM in place so buttons/refs survive and nothing flickers.   */
  function updateMarketsInPlace() {
    state.markets.forEach(function (m) {
      if (m.resolved !== null) return;
      var p = E.prices(m);
      m.outcomes.forEach(function (o, i) {
        var bar = document.querySelector('[data-bar="' + m.id + '|' + i + '"]');
        var pct = document.querySelector('[data-pct="' + m.id + '|' + i + '"]');
        if (bar) bar.style.width = (p[i] * 100).toFixed(1) + "%";
        if (pct) pct.textContent = (p[i] * 100).toFixed(1) + "%";
      });
      var cap = document.querySelector('[data-cap="' + m.id + '"]');
      if (cap) cap.innerHTML = esc(m.outcomes[0]) + " &rarr; " + (p[0] * 100).toFixed(1) + "%";
      var cv = document.querySelector('canvas[data-spark="' + m.id + '"]');
      if (cv) drawSpark(cv, m.history, "#4f8be6");
    });
  }

  setInterval(function () {
    if (E.tick(state)) {
      E.save(state);
      if (view === "markets" && !$("modalBack").classList.contains("open")) updateMarketsInPlace();
      renderSidebar();
      // keep the live trade quote fresh if the ticket is open
      if ($("modalBack").classList.contains("open")) updateQuote();
    }
  }, 4500);

  /* ---- Go ----------------------------------------------------------------*/
  render();
})();
