# Pocket Network Agentic Services

Services built for the [Pocket Network Agentic Services
Hackathon](https://docs.pocket.network/).

Pocket's catalogue is large but almost entirely RPC. Of the 264 services
enumerated during research for this build, the overwhelming majority serve chain
data, and 98 had no supplier at all. Weather, energy, transport, fact-checking,
payments, and most of what an agent actually needs from the real world were
absent. The research in [`research/`](research/) maps that gap.

This repository builds into it.

---

## Services

| Service | ID | Status | What it does |
|---|---|---|---|
| [wx-ensemble](wx-ensemble/) | `wx-ensemble` | Live on Beta TestNet | Descriptive multi-model temperature bands with honest uncertainty |

Each service is registered separately on Pocket Beta TestNet and is submitted as
its own entry.

---

## wx-ensemble

The first service. Given a coordinate, it returns how much seven independent
national forecasting centres disagree about the temperature over the next
24 hours.

```json
POST /v1/ensemble
{ "latitude": 51.5074, "longitude": -0.1278, "hours": 12 }
```

It reports every member value next to its source, and refuses to publish a band
when fewer than two models report at all. Missing data is reported as missing.
Nothing is interpolated, back-filled, or coerced to zero.

See [`wx-ensemble/README.md`](wx-ensemble/README.md) for the full contract.

**Verified on chain, Beta TestNet (`pocket-lego-testnet`):**

| Item | Value |
|---|---|
| Service ID | `wx-ensemble` |
| Service owner | `pokt1hs0p9ceh2dkw4h5lk555cjgjjft8ya45uamt7g` |
| Supplier operator | `pokt1ljj5y4huusjgfjafj6jtq6353uvu5v8u6fgpmr` |
| Supplier stake | 60,000 POKT, activated height 718381 |
| Test application | `pokt1e65tugn03k9035ez8hglvclq2ws7l5qfpp9pat`, 2,500 POKT |
| Service card | `pocket-service-card/v1`, 3,538 bytes, validates clean |
| Test transaction | `9B2A4E88DD292C990EDF4D8431A1EF91C9C51B608DC1BCAC2E9B9E47DF8E7A8D` |
| Test transaction | height 718413, code 0, `/pocket.proof.MsgCreateClaim` |
| Endpoint | `https://43-157-25-53.sslip.io` |

---

## Research

The gap analysis that selected these services:

- [`service-map-264.md`](research/service-map-264.md) maps every service in the
  Pocket catalogue at time of research and what is genuinely missing
- [`cross-ecosystem-diff.md`](research/cross-ecosystem-diff.md) compares that
  against RapidAPI, the MCP Registry, Composio, Akash, The Graph and Bittensor,
  to find what is unique to Pocket and still unbuilt
- [`feasibility-probes.md`](research/feasibility-probes.md) records which
  upstreams were actually probed, and which failed

---

## Design principle

Every service here follows one rule: **a missing value is reported as missing. It
is never filled in.**

Agents act on what these services return. An invented number is worse than no
number, because it looks like evidence. Refusal states, per-point source
provenance, and explicit labelling of what a number does and does not mean are
not polish. They are the product.
