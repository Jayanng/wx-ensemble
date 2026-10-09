# Feasibility probes: top three candidates

Gate 1 capability probes, run live 2026-10-09. Every source tested with a real request.
No API keys used anywhere.

## Verdict summary

| Candidate | Verdict | Free sources found | Needs a key? |
|---|---|---|---|
| `wx-ensemble` | FEASIBLE, strongest | 8 | no |
| `presign-safety` | FEASIBLE | 4 | no |
| `claim-verify` | FEASIBLE | 4 | no |

---

## `wx-ensemble` — weather with calibrated uncertainty

**Result: FEASIBLE. Best evidence on the board.**

- `api.open-meteo.com` returns **six independent national weather models in one free call**:
  `icon_seamless` (Germany DWD), `gfs_seamless` (US NOAA), `ecmwf_ifs025` (ECMWF),
  `gem_seamless` (Canada), `meteofrance_seamless` (France), `jma_seamless` (Japan).
- No API key. No auth. No rate-limit hit during probing.
- `api.met.no` (Norwegian) returns 200, free, needs only a User-Agent.
- `api.weather.gov` (US NOAA) returns 200, free, needs only a User-Agent.

**The models genuinely disagree**, which is the whole product. Same hour, London, six models:

| Model | Temperature |
|---|---|
| icon_seamless | 11.7 C |
| gfs_seamless | 12.2 C |
| ecmwf_ifs025 | 10.7 C |
| gem_seamless | 10.5 C |
| meteofrance_seamless | 11.7 C |
| jma_seamless | 10.4 C |

Spread of 1.8 C across six national forecasting services for the same place and hour. A single
number would be a guess. A calibrated band is the honest answer, and it is demo-able in one glance.

---

## `presign-safety` — pre-sign transaction safety

**Result: FEASIBLE.**

All of the following worked free, no key:

- `ethereum-rpc.publicnode.com` `eth_call` simulation. A deliberately malformed ERC20 transfer
  returned `execution reverted: ERC20: transfer from the zero address` with the full ABI-encoded
  revert reason. **That decoded revert is exactly the product.**
- `eth_getCode` returns contract bytecode (contract detection).
- `eth_estimateGas` returns a value.
- `www.4byte.directory` `hex_signature` lookup returns candidate function signatures free
  (selector `0xa9059cbb` resolved to 6 candidate signatures).

Failed: `eth.llamarpc.com` returned HTTP 525 (SSL). Use publicnode or another mirror.

Note for the card: honeypot heuristics and allowance-exposure checks are derivable from these
same free primitives (trace, storage reads, ABI decode). No paid feed required.

---

## `claim-verify` — claim verification with citation integrity

**Result: FEASIBLE.**

All free, no key:

- `en.wikipedia.org/api/rest_v1/page/summary/{title}` returns a clean summary for citation binding.
- `api.crossref.org/works/{doi}` returns title and publication date
  (tested `10.1038/nature14539` -> "Deep learning", 2015-05-28).
- `efts.sec.gov` full-text search returns 200.
- `export.arxiv.org/api/query` returns 200 with a full Atom feed.

Limitation: there is no single free "is this true" oracle. The service has to be designed as
source-retrieval plus entailment and contradiction detection against the retrieved text, not as
a lookup. That is a design constraint, not a blocker, and it is also what makes it technically
complex enough to score.

---

## Implications for the ranking

Feasibility does not change the top three ordering, but it does change the risk profile:

1. `wx-ensemble` moves up in confidence. Six free models with real disagreement is a better
   evidence base than I assumed when I ranked it third.
2. `presign-safety` is proven to produce a crisp, decodable failure signal for free. The demo
   beat is not hypothetical.
3. `claim-verify` has no free oracle, so it is the most engineering-heavy of the three. It stays
   first on rubric score but it is the one most likely to need scope discipline.

Candidates 4 to 10 were not probed. Their upstream data is the open risk, and several
(sports odds, real estate comparables) are commonly paid feeds.
