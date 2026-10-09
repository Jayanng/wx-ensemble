# wx-ensemble

**Descriptive multi-model temperature bands with honest uncertainty.**

A [Pocket Network](https://docs.pocket.network/) agentic service. It answers one
question well: given a latitude and longitude, how much do independent national
forecasting centres actually disagree about the temperature over the next
24 hours?

Most weather APIs hand you a single number and call it a forecast. An agent
acting on that number cannot tell the difference between "every model agrees"
and "the models are split by six degrees." wx-ensemble reports the disagreement
itself, and refuses to answer when there is not enough evidence to have one.

---

## Why this exists

An agent that consumes a forecast needs to know how much to trust it. A point
estimate hides exactly the information that matters.

wx-ensemble takes the opposite approach. Every member value is published next to
its source. The band is the observed spread between independent centres, and the
response says so in plain terms. Nothing is interpolated, back-filled, or
coerced to zero. When a source fails, the failure is reported as a failure.

When fewer than two models report a value, the service does not publish a band.
It returns `INSUFFICIENT_EVIDENCE` with the reason, because one model cannot
express uncertainty and pretending otherwise would be inventing data.

This is the design principle of the whole service: **a missing value is reported
as missing. It is never filled in.**

---

## What it returns

Request a coordinate and an optional hour horizon:

```json
{ "latitude": 51.5074, "longitude": -0.1278, "hours": 12 }
```

Get back one entry per hour, each with every member value named alongside its
source:

```
values[]         every model's reading, with source and label
min, max         the observed envelope
median, mean     the centre
sample stddev    dispersion across members
iqr              interquartile range
spread           max minus min
agreement_ratio  how tightly the members cluster
confidence       labelled "derived_from_spread", explicitly NOT a probability
```

The `method` block is embedded in every response so the numbers can be checked
rather than trusted:

```json
"method": {
  "min_members_required": 2,
  "interpolation": "none. A missing member value is reported as missing and excluded from statistics.",
  "confidence_basis": "derived_from_spread",
  "deterministic_aggregation": true
}
```

---

## The seven sources

Six arrive in a single Open-Meteo call, each from a different national centre:

| Model | Centre |
|---|---|
| `icon_seamless` | Deutscher Wetterdienst (Germany) |
| `gfs_seamless` | NOAA (United States) |
| `ecmwf_ifs025` | ECMWF (European Centre) |
| `gem_seamless` | Environment and Climate Change Canada |
| `meteofrance_seamless` | Meteo-France |
| `jma_seamless` | Japan Meteorological Agency |

Cross-checked against two more:

| Source | Centre |
|---|---|
| `metno` | Norwegian Meteorological Institute |
| `nws` | NOAA National Weather Service (United States only) |

They are genuinely independent. That is what makes the spread meaningful: when
seven national centres that run their own models on their own infrastructure
disagree, that disagreement is real information.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/ensemble` | The ensemble band for a coordinate |
| `GET` | `/v1/probe` | Health check that runs a real call and asserts the shape |
| `GET` | `/v1/identity` | Service identity and contract |
| `GET` | `/openapi.json` | Machine-readable contract |
| `GET` | `/healthz` | Liveness |

**How these are reached depends on how the service is running.** This distinction
matters and is easy to get wrong.

- **Run directly** (`node src/server.js`): every path above answers plain HTTP,
  with no authentication.
- **On Pocket Network**: `/v1/*` are reached by sending a **signed relay request**
  to a supplier, not by plain HTTP. A plain `GET https://<endpoint>/v1/identity`
  returns `invalid relay request: body must be a valid RelayRequest protobuf`,
  because the public endpoint is the RelayMiner's relayer, which accepts Pocket
  relay requests rather than ordinary web traffic. `/healthz` does answer plain
  HTTP there, and returns liveness only, with no service name in the body.

Signing a relay is documented in the RelayMiner's
[`examples/relay-signing`](https://github.com/pokt-network/pocket-relay-miner/tree/main/examples/relay-signing)
directory, which ships verified signers for Node.js, Python and Rust. The
[`pocket-ap`](https://github.com/pokt-network/pocket-ap) CLI does it for you:

```bash
pocket-ap call --config pocket-ap.yaml --network beta \
  --service wx-ensemble --rpc-type rest \
  -X POST --path /v1/ensemble \
  --data '{"latitude":51.5074,"longitude":-0.1278,"hours":2}'
```

---

## Running it

No dependencies beyond Node.js 22.

```bash
node src/server.js          # listens on PORT, default 8787
npm test                    # 27 tests
```

---

## On Pocket Network

`wx-ensemble` is registered as service ID **`wx-ensemble`** on Pocket Beta
TestNet.

| Role | Address |
|---|---|
| Service owner | `pokt1hs0p9ceh2dkw4h5lk555cjgjjft8ya45uamt7g` |
| Supplier operator | `pokt1ljj5y4huusjgfjafj6jtq6353uvu5v8u6fgpmr` |
| Test application | `pokt1e65tugn03k9035ez8hglvclq2ws7l5qfpp9pat` |

The service is served by a `pocket-relay-miner` running as two processes on one
Redis: a relayer that validates and serves relays, and a miner that builds the
sparse merkle sum tree and submits claims and proofs. The service card is stored
on chain and validates clean against `pocket-service-card/v1`.

Pocket separates what is served (a **service**, owned by a service owner and
served by **suppliers**) from who pays and routes (an **application**, delegated
to a **gateway**). wx-ensemble is a service. The application and gateway in this
repo exist only to prove the relay path end to end.

---

## Honest limits

These are stated because an agent needs to know them.

- **It is descriptive, not calibrated.** The spread says how much the models
  disagree. It does not say how likely the truth is to fall inside the band.
  `confidence` is explicitly labelled `derived_from_spread` for this reason.
- **It is temperature only.** Precipitation, wind and pressure are not modelled.
- **The NWS member is United States only.** Outside the US it reports as
  unavailable rather than guessing, so member counts vary by location.
- **Member counts vary over time.** An upstream returning fewer points reduces
  the member count at those hours, which is reported per point, never smoothed.
- **Upstream forecasts change continuously.** Aggregation is deterministic given
  the inputs, but two calls at different moments legitimately return different
  numbers. `results` is declared `variable` in the service card for that reason.

---

## License

MIT.
