# $PAM — Policy Analysis Market

A 2003-style revival of DARPA's cancelled **Policy Analysis Market**, rebuilt as a working
play-money prediction market and memecoin tribute site.

- **Aesthetic:** period-correct Information Awareness Office / FutureMAP styling — chrome `P A M`
  logo, starfield, prism beam, beveled panels, hit counter.
- **Engine:** a real Logarithmic Market Scoring Rule (LMSR) automated market maker. Prices are
  crowd-implied probabilities that always sum to 100%. Buy/sell/settle, mark-to-market positions,
  localStorage persistence, ambient crowd drift.
- **Live data:** the `$PAM` ticker pulls a real on-chain price from the DexScreener public API.

Pure static site — no build step, no dependencies. Just `index.html`, `styles.css`, `market.js`, `app.js`.

## Run locally

```bash
python3 -m http.server 8137
```

Then open <http://localhost:8137>.

## Links

- Contract address (Solana): `73Ldwtam8mZZALK4veHMDsnMBcsPJMQcapaYk8bHpump`
- [X community](https://x.com/i/communities/2037427340574429253)
- [Trade on DexScreener](https://dexscreener.com/solana/73Ldwtam8mZZALK4veHMDsnMBcsPJMQcapaYk8bHpump)

---

*Play-money simulation for entertainment and historical curiosity. Not affiliated with DARPA, the
IAO, or the US Government. $PAM is a memecoin tribute, not an investment. Not financial advice.*
