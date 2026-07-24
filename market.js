/* ==========================================================================
   $PAM — POLICY ANALYSIS MARKET
   Client-side prediction-market engine (LMSR automated market maker).
   No server, no wallet, no real money. Everything lives in localStorage.
   ========================================================================== */

(function (global) {
  "use strict";

  var STORAGE_KEY = "pam_market_state_v1";
  var STARTING_BALANCE = 10000;      // $PAM credits gifted on first visit
  var LIQUIDITY_B = 250;             // LMSR liquidity parameter (bigger = deeper book)

  /* ---- Seed markets --------------------------------------------------------
     Themed on the PAM lore but kept satirical / crypto, never real-world harm.
     Each market: binary or categorical. Prices always sum to 1 (100%).        */
  var SEED_MARKETS = [
    {
      id: "shutdown-2027",
      question: "Will a sitting US Senator publicly denounce a prediction market before 2027?",
      lore: "Wyden called PAM a \"federal betting parlor.\" History does not repeat, but it rhymes.",
      closes: "DEC 31 2026",
      outcomes: ["YES", "NO"],
      q: [0, 0]
    },
    {
      id: "hanson-tweet",
      question: "Will Robin Hanson acknowledge $PAM on the record?",
      lore: "The economist whose idea was called \"grotesque\" in the Senate. Idea futures live on.",
      closes: "OPEN",
      outcomes: ["YES", "NO"],
      q: [0, 0]
    },
    {
      id: "next-polymarket",
      question: "Which venue posts the highest 2026 volume?",
      lore: "PAM was cancelled in a day. Its descendants clear billions. The wisdom of crowds, priced.",
      closes: "JAN 01 2027",
      outcomes: ["POLYMARKET", "KALSHI", "A NEW ENTRANT", "NONE / FLAT"],
      q: [0, 0, 0, 0]
    },
    {
      id: "pam-ath",
      question: "Does $PAM reclaim its all-time high this cycle?",
      lore: "Funded May 2001. Cancelled August 2003. Relisted on-chain, 20 years early to its own vindication.",
      closes: "OPEN",
      outcomes: ["YES", "NO"],
      q: [0, 0]
    },
    {
      id: "poindexter-vindicated",
      question: "Consensus that PAM was 'largely misunderstood' by 2030?",
      lore: "Poindexter resigned insisting the program was misread. The market is still deciding.",
      closes: "DEC 31 2029",
      outcomes: ["YES", "NO"],
      q: [0, 0]
    },
    {
      id: "crowds-beat-polls",
      question: "Do prediction markets out-call the polls in the next major election?",
      lore: "The Iowa Electronic Markets beat the pundits. That result is the whole thesis.",
      closes: "OPEN",
      outcomes: ["MARKETS", "POLLS", "TOO CLOSE"],
      q: [0, 0, 0]
    }
  ];

  /* ---- LMSR math -----------------------------------------------------------
     Cost function:  C(q) = b * ln( Σ exp(q_i / b) )
     Price of i:     p_i  = exp(q_i/b) / Σ exp(q_j/b)
     Cost to trade:  C(q + Δ) - C(q)
     Numerically stabilised by subtracting max(q)/b before exp().              */

  function cost(q, b) {
    var m = -Infinity, i;
    for (i = 0; i < q.length; i++) if (q[i] > m) m = q[i];
    var sum = 0;
    for (i = 0; i < q.length; i++) sum += Math.exp((q[i] - m) / b);
    return m + b * Math.log(sum);
  }

  function prices(q, b) {
    var m = -Infinity, i;
    for (i = 0; i < q.length; i++) if (q[i] > m) m = q[i];
    var exps = [], sum = 0;
    for (i = 0; i < q.length; i++) { var e = Math.exp((q[i] - m) / b); exps.push(e); sum += e; }
    var p = [];
    for (i = 0; i < q.length; i++) p.push(exps[i] / sum);
    return p;
  }

  // Cost (can be negative on a sell) to move outcome `idx` by `shares`.
  function tradeCost(q, b, idx, shares) {
    var q2 = q.slice();
    q2[idx] += shares;
    return cost(q2, b) - cost(q, b);
  }

  /* ---- Persistence ---------------------------------------------------------*/

  function freshState() {
    var markets = SEED_MARKETS.map(function (m) {
      return {
        id: m.id,
        question: m.question,
        lore: m.lore,
        closes: m.closes,
        outcomes: m.outcomes.slice(),
        q: m.q.slice(),
        resolved: null,          // index of winning outcome once resolved
        history: [prices(m.q, LIQUIDITY_B)[0]],  // track outcome[0] over time
        volume: 0
      };
    });
    return {
      balance: STARTING_BALANCE,
      positions: {},             // key `${marketId}:${outcomeIdx}` -> shares
      log: [],                   // recent trade ticker
      markets: markets,
      created: 0
    };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      var s = JSON.parse(raw);
      if (!s || !s.markets) return freshState();
      return s;
    } catch (e) {
      return freshState();
    }
  }

  function save(state) {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---- Engine API ----------------------------------------------------------*/

  var Engine = {
    B: LIQUIDITY_B,
    STARTING_BALANCE: STARTING_BALANCE,

    load: load,
    save: save,
    reset: function () { var s = freshState(); save(s); return s; },

    prices: function (market) { return prices(market.q, LIQUIDITY_B); },

    marketById: function (state, id) {
      for (var i = 0; i < state.markets.length; i++)
        if (state.markets[i].id === id) return state.markets[i];
      return null;
    },

    positionShares: function (state, marketId, outcomeIdx) {
      return state.positions[marketId + ":" + outcomeIdx] || 0;
    },

    // Quote the credit cost of buying/selling `shares` (may be fractional).
    quote: function (market, outcomeIdx, shares) {
      return tradeCost(market.q, LIQUIDITY_B, outcomeIdx, shares);
    },

    // Execute a buy (shares > 0) or sell (shares < 0). Returns {ok, msg, cost}.
    trade: function (state, marketId, outcomeIdx, shares) {
      var m = Engine.marketById(state, marketId);
      if (!m) return { ok: false, msg: "Market not found." };
      if (m.resolved !== null) return { ok: false, msg: "Market already resolved." };

      var key = marketId + ":" + outcomeIdx;
      var held = state.positions[key] || 0;

      if (shares < 0 && held + shares < -1e-9)
        return { ok: false, msg: "You cannot sell more shares than you hold." };

      var c = tradeCost(m.q, LIQUIDITY_B, outcomeIdx, shares);

      if (shares > 0 && c > state.balance + 1e-9)
        return { ok: false, msg: "Insufficient $PAM balance for this order." };

      // Commit
      m.q[outcomeIdx] += shares;
      state.balance -= c;
      state.positions[key] = held + shares;
      if (Math.abs(state.positions[key]) < 1e-9) delete state.positions[key];
      m.volume += Math.abs(c);
      m.history.push(prices(m.q, LIQUIDITY_B)[0]);
      if (m.history.length > 120) m.history.shift();

      var verb = shares > 0 ? "BOUGHT" : "SOLD";
      state.log.unshift({
        t: verb, m: m.question, o: m.outcomes[outcomeIdx],
        n: Math.abs(shares), c: Math.abs(c)
      });
      if (state.log.length > 25) state.log.pop();

      save(state);
      return { ok: true, msg: verb + " " + Math.abs(shares).toFixed(0) + " " +
               m.outcomes[outcomeIdx] + " for " + Math.abs(c).toFixed(0) + " $PAM", cost: c };
    },

    // Resolve a market to a winning outcome; pay 1 $PAM per winning share held.
    resolve: function (state, marketId, winIdx) {
      var m = Engine.marketById(state, marketId);
      if (!m || m.resolved !== null) return;
      m.resolved = winIdx;
      var payout = state.positions[marketId + ":" + winIdx] || 0;
      state.balance += payout;
      // Wipe all positions in this market (losers expire worthless).
      for (var i = 0; i < m.outcomes.length; i++) delete state.positions[marketId + ":" + i];
      state.log.unshift({
        t: "RESOLVED", m: m.question, o: m.outcomes[winIdx], n: payout, c: payout
      });
      save(state);
    },

    // Ambient "crowd" — nudges a random open market so prices drift like a
    // living order book. Uses tiny trades that touch neither the user's
    // balance nor positions (pure market-maker liquidity moves).
    tick: function (state) {
      var open = state.markets.filter(function (m) { return m.resolved === null; });
      if (!open.length) return false;
      var m = open[(Math.random() * open.length) | 0];
      var idx = (Math.random() * m.outcomes.length) | 0;
      var size = (Math.random() * 14 + 2);
      var dir = Math.random() < 0.5 ? 1 : -1;
      m.q[idx] += size * dir;
      m.volume += Math.abs(tradeCost(m.q, LIQUIDITY_B, idx, 0.0001)) * size;
      m.history.push(prices(m.q, LIQUIDITY_B)[0]);
      if (m.history.length > 120) m.history.shift();
      return true;
    },

    portfolioValue: function (state) {
      // Mark open positions to current market price.
      var v = 0;
      for (var key in state.positions) {
        if (!state.positions.hasOwnProperty(key)) continue;
        var parts = key.split(":");
        var m = Engine.marketById(state, parts[0]);
        if (!m || m.resolved !== null) continue;
        var p = prices(m.q, LIQUIDITY_B)[+parts[1]];
        v += state.positions[key] * p;
      }
      return v;
    }
  };

  global.PAM = Engine;
})(window);
