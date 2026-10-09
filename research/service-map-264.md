# Pocket Network service map (all 264)

Compiled 2026-10-09 from `data.pocket.network` GraphQL.
Query: `services(first:300) { totalCount nodes { id name computeUnitsPerRelay ownerId
  supplierServiceConfigs { totalCount } relays { totalCount } } }`
Result: `totalCount 264`, `nodes 264`. This is a complete enumeration, not a sample.

## Verified headline numbers

| Measure | Value |
|---|---:|
| Total registered services | 264 |
| Blockchain RPC style (<= 8,000 CU) | 165 |
| Agent-facing style (> 8,000 CU) | 99 |
| Agent-facing with >= 1 supplier | 83 |
| Agent-facing with 0 suppliers | 16 |
| Agent-facing with >= 2 suppliers | 9 |
| Agent-facing single-owner (exactly 1) | 74 |
| Agent-facing naive/stub implementations | 11 |

## The 9 genuinely multi-supplier agent-facing services

This is effectively the entire live agent catalogue.

| Service ID | CU / relay | Suppliers | Name |
|---|---:|---:|---|
| `text-generation` | 300,000 | 4 | Text Generation - OpenAI compatible LLM inference |
| `ai-inference` | 400,000 | 3 | AI Inference |
| `qwen3-embedding-0-6b` | 10,000 | 3 | Qwen3 Embedding 06B - OpenAI API compatible |
| `text-to-image` | 65,123 | 3 | machine learning task of generating images from the input text and_or images - diffusers VAEs GANs are all included here |
| `vector-memory` | 25,000 | 3 | Vector Memory |
| `web-search` | 50,000 | 3 | Web Search |
| `meadow` | 100,000 | 2 | Meadow Protocol |
| `pretty-charts` | 10,000 | 2 | Pretty Charts |
| `taint-check` | 50,000 | 2 | TaintCheck |

## Stub or naive implementations (11)

Taken from their own registered names and descriptions. Not services that were built.

| Service ID | Suppliers | Registered name |
|---|---:|---|
| `audio-text-to-text` | 0 | machine learning task of taking audio and a text prompt and generating a text |
| `image-classification` | 0 | machine learning task of assigning a label or class to an entire image - Only one class per image is expected |
| `image-text-to-text` | 0 | machine learning task of taking an image and a text prompt and generating a text - Visual language models of medium size are included here |
| `image-to-text` | 0 | machine learning task of generating output text from an input image - this is used for image captioning |
| `mask-generation` | 0 | machine learning task of generating masks that identify a specific object or region of interest in a given image |
| `optical-character-recognition` | 0 | machine learning task of transcribing any text included in the input image - OCRs of any kind |
| `semantic-similarity` | 1 | Word Overlap Similarity |
| `sentence-similarity` | 0 | machine learning task of determining how similar two texts are - used in information retrieval |
| `text-embeddings` | 1 | Hashed Text Vectors |
| `text-ranking` | 0 | machine learning task of ranking a set of texts based on their relevance to a query - used in information retrieval and search engines |
| `text-to-image` | 3 | machine learning task of generating images from the input text and_or images - diffusers VAEs GANs are all included here |

## Registered but unserved (16 agent-facing, zero suppliers)

| Service ID | CU / relay | Name |
|---|---:|---|
| `audio-text-to-text` | 400,000 | machine learning task of taking audio and a text prompt and generating a text |
| `code-execution-sandbox` | 50,000 | Code Execution Sandbox |
| `crypto-fx-market-data` | 50,000 | Crypto FX Market Data |
| `flight-schedules-status` | 50,000 | Flight Schedules Status |
| `hospital-price-transparency` | 50,000 | Hospital Price Transparency |
| `image-classification` | 25,000 | machine learning task of assigning a label or class to an entire image - Only one class per image is expected |
| `image-text-to-text` | 500,000 | machine learning task of taking an image and a text prompt and generating a text - Visual language models of medium size are included here |
| `image-to-text` | 65,123 | machine learning task of generating output text from an input image - this is used for image captioning |
| `ip-geolocation` | 50,000 | IP Geolocation |
| `llm-inference` | 50,000 | LLM Inference |
| `mask-generation` | 50,000 | machine learning task of generating masks that identify a specific object or region of interest in a given image |
| `optical-character-recognition` | 50,000 | machine learning task of transcribing any text included in the input image - OCRs of any kind |
| `patents-trademarks` | 50,000 | Patents and Trademarks Search |
| `sentence-similarity` | 50,000 | machine learning task of determining how similar two texts are - used in information retrieval |
| `text-ranking` | 50,000 | machine learning task of ranking a set of texts based on their relevance to a query - used in information retrieval and search engines |
| `web-search-serp` | 50,000 | Web Search SERP |

## Single-owner agent-facing services (74)

| Service ID | CU / relay | Name |
|---|---:|---|
| `address-standardization` | 100,000 | Address Standardization |
| `agentsearch-web-extract-v1` | 50,000 | AgentSearch Web Extract |
| `agentsearch-web-render-v1` | 50,000 | AgentSearch Web Render |
| `backtest-reconcile-v1` | 50,000 | Backtest Reconcile |
| `barcode-tools` | 25,000 | Barcode and QR Tools API |
| `chain-simulation` | 100,000 | Chain Simulation |
| `clinical-trials` | 100,000 | Clinical Trials Search |
| `contract-abi` | 100,000 | Contract ABI Lookup |
| `counterparty` | 100,000 | Counterparty Screening |
| `dart-correction-impact-v1` | 50,000 | DART Correction Impact |
| `dart-kr-events-v1` | 50,000 | DART KR Events |
| `debarment-exclusion` | 100,000 | Debarment and Exclusion Screening |
| `dns-whois-rdap` | 100,000 | DNS WHOIS and RDAP Lookup |
| `enforcement-actions` | 100,000 | Regulatory Enforcement Actions |
| `entity-registration` | 100,000 | Legal Entity Lookup LEI and SEC |
| `event-log-decoding` | 100,000 | Event Log Decoding |
| `export-control-screen` | 100,000 | Export Control Screening |
| `fda` | 100,000 | FDA Drug Labels and Adverse Events |
| `federal-contract-opps` | 100,000 | Federal Contract Opportunities |
| `federal-register` | 100,000 | Federal Register Search |
| `french-company-check-v1` | 50,000 | French Company Check |
| `fund-etf-holdings` | 100,000 | Fund N-PORT Filing Search |
| `gas-price-oracle` | 100,000 | Gas Price Oracle |
| `headless-browser-render` | 100,000 | Web Page HTML Fetch |
| `image-transform` | 500,000 | ImageOps Image Processing API |
| `insider-transactions` | 100,000 | Form 4 Insider Filings |
| `kr-apt-trades-v1` | 50,000 | KR Apartment Trades |
| `kr-export-pulse-v1` | 50,000 | KR Export Pulse |
| `kr-figure-check-v1` | 50,000 | KR Figure Check |
| `kr-law-v1` | 50,000 | KR Law |
| `kr-rates-fx-v1` | 50,000 | KR Rates and FX |
| `literature-search` | 100,000 | Academic Literature Search |
| `med-safety` | 100,000 | Medication Safety Lookup |
| `meme-watch` | 50,000 | Meme Watch |
| `name-resolution` | 100,000 | ENS Name Resolution |
| `named-entity-recognition` | 100,000 | Named Entity Recognition |
| `object-detection` | 35,000 | Object Detection in Images - Ultralytics compatible API |
| `occupational-wages` | 100,000 | Occupational Wage Data |
| `ocr-document-parsing` | 100,000 | Text Statistics |
| `package-advisories` | 100,000 | Package Security Advisories |
| `pii-redaction` | 100,000 | PII Redaction |
| `pmic-company-signals` | 100,000 | PMIC Company Fundamentals and Filing Risk |
| `pmic-crypto-signals` | 100,000 | PMIC Crypto Signals |
| `pmic-macro-signals` | 100,000 | PMIC Macro and Markets Signals |
| `pmic-pharma-signals` | 100,000 | PMIC Pharma Safety and Approval Signals |
| `pmic-public-sector-signals` | 100,000 | PMIC Public Sector Signals |
| `prediction-market-intel` | 100,000 | Prediction Market Intelligence |
| `prompt-injection-detect` | 100,000 | Prompt Injection Detection |
| `rate-benchmarks` | 100,000 | Interest Rate Benchmarks |
| `reranking` | 100,000 | Keyword Reranking |
| `routing-isochrones` | 100,000 | Routing Isochrones |
| `rss-atom-normalization` | 100,000 | RSS Atom Normalization |
| `sanctions-watchlist-screen` | 100,000 | Sanctions and Watchlist Screening |
| `sec-8k-event-stream` | 100,000 | SEC 8-K Filings |
| `sec-edgar-xbrl` | 100,000 | SEC EDGAR XBRL Data |
| `sec-holdings` | 100,000 | SEC Institutional Holdings |
| `semantic-similarity` | 100,000 | Word Overlap Similarity |
| `sentiment-classification` | 100,000 | Sentiment Classification |
| `structured-extraction` | 100,000 | Structured Extraction |
| `structured-web-extraction` | 100,000 | Structured Web Extraction |
| `table-extraction` | 100,000 | Table Extraction from Text |
| `text-embeddings` | 100,000 | Hashed Text Vectors |
| `token-metadata` | 100,000 | Token Metadata |
| `token-price-oracles` | 100,000 | Token Price Oracles |
| `trade-tariff-data` | 100,000 | Trade and Tariff Data |
| `treasury-capital-score` | 100,000 | D1 ranked public crypto-treasury-capital-score |
| `treasury-fiscal-data` | 100,000 | Treasury and Fiscal Data |
| `tx-decoding` | 100,000 | Transaction Decoding |
| `tx-explain` | 100,000 | EVM Transaction Explainer |
| `url-fetch-markdown` | 100,000 | URL Fetch Markdown |
| `url-phishing-reputation` | 100,000 | URL Phishing Reputation |
| `us-code-cfr` | 100,000 | US Code and CFR Regulations |
| `us-macro` | 100,000 | US Macroeconomic Series |
| `wallet-portfolio` | 100,000 | Wallet Portfolio Aggregation |

## Blockchain RPC services (165)

Legacy core. Listed for completeness.

| Service ID | CU / relay | Suppliers | Name |
|---|---:|---:|---|
| `agentsearch-web-search-v1` | 5,000 | 1 | AgentSearch Web Search |
| `agoric` | 5,000 | 0 | Agoric |
| `akash` | 6,310 | 2346 | Akash Network |
| `aleph-im` | 5,000 | 0 | Aleph Cloud |
| `alephzero` | 5,000 | 0 | AlephZero |
| `allora` | 5,000 | 0 | Allora Network |
| `arb-one` | 2,751 | 3805 | Arbitrum One |
| `arb-sepolia-testnet` | 2,071 | 583 | Arbitrum Sepolia Testnet |
| `arb_one` | 2,733 | 0 | Arbitrum One |
| `arb_sep_test` | 2,040 | 0 | Arbitrum Sepolia Testnet |
| `archway` | 5,000 | 0 | Archway Network |
| `arkeo` | 6,188 | 0 | Arkeo |
| `atomone` | 6,702 | 2948 | AtomOne |
| `avax` | 2,780 | 4037 | Avalanche |
| `avax-dfk` | 659 | 0 | DeFi Kingdoms |
| `avax-fuji-testnet` | 5,000 | 0 | Avalanche Fuji Testnet |
| `babylon` | 6,188 | 189 | Babylon Genesis |
| `base` | 1,232 | 3359 | Base |
| `base-sepolia-testnet` | 895 | 3031 | Base Sepolia Testnet |
| `base-test` | 886 | 0 | Base Testnet |
| `base-testnet` | 1 | 0 | Base Testnet |
| `bera` | 1,000 | 1400 | Berachain |
| `bitcoin` | 5,000 | 2 | Bitcoin |
| `bittensor` | 5,000 | 0 | Bittensor Mainnet |
| `bittensor-testnet` | 5,000 | 0 | Bittensor Testnet |
| `bitway` | 6,188 | 0 | Bitway |
| `blast` | 2,486 | 2774 | Blast |
| `blast-sepolia-testnet` | 5,000 | 0 | Blast Testnet |
| `boba` | 886 | 0 | Boba |
| `bsc` | 5,289 | 4034 | BNB Smart Chain |
| `celestia` | 6,188 | 1 | Celestia |
| `celo` | 912 | 308 | Celo |
| `centrifuge` | 5,000 | 0 | Centrifuge |
| `cere` | 5,000 | 0 | Cere Network |
| `cheqd` | 6,719 | 2948 | Cheqd |
| `chihuahua` | 6,586 | 3166 | Chihuahua Chain |
| `concordium` | 5,000 | 0 | Concordium |
| `cosmoshub` | 6,188 | 3162 | Cosmos Hub |
| `deepseek` | 5,000 | 0 | Deepseek V3 0324 |
| `dungeon-chain` | 6,188 | 0 | Dungeon Chain |
| `dymension` | 5,000 | 189 | Dymension |
| `e-money` | 5,000 | 0 | e-Money |
| `elys-network` | 6,188 | 0 | Elys Network |
| `eth` | 1,595 | 4298 | Ethereum |
| `eth-beacon` | 1,579 | 654 | Ethereum Beacon Chain |
| `eth-holesky-testnet` | 886 | 0 | Ethereum Holesky Testnet |
| `eth-sepolia-testnet` | 1,000 | 1183 | Ethereum Sepolia Testnet |
| `eth_hol_test` | 886 | 0 | Ethereum Holesky Testnet |
| `eth_sep_test` | 1,000 | 0 | Ethereum Sepolia Testnet |
| `evmos` | 1 | 0 | Evmos |
| `fantom` | 2,501 | 3166 | Fantom |
| `fetch` | 6,635 | 3048 | ASI Alliance |
| `filecoin` | 5,000 | 0 | Filecoin |
| `flare` | 5,000 | 0 | Flare Network |
| `flow` | 5,000 | 0 | Flow |
| `fraxtal` | 1,881 | 2858 | Fraxtal |
| `fuse` | 903 | 973 | Fuse |
| `giwa` | 5,000 | 0 | Global Infrastructure for Web3 Access |
| `giwa-sepolia` | 5,000 | 0 | Global Infrastructure for Web3 Access Sepolia Testnet |
| `giwa-sepolia-testnet` | 5,000 | 3107 | Global Infrastructure for Web3 Access Sepolia Testnet |
| `gnosis` | 1,125 | 3226 | Gnosis |
| `gpt-oss` | 5,000 | 0 | GPT OSS |
| `grok` | 5,000 | 0 | Grok |
| `harmony` | 5,033 | 0 | Harmony Shard 0 |
| `hedera` | 5,000 | 0 | Hedera |
| `hey` | 1 | 0 | Grove hey Service |
| `hopr` | 5,000 | 0 | HOPRnet |
| `hyperliquid` | 5,000 | 1503 | Hyperliquid |
| `initia` | 5,000 | 0 | Initia |
| `injective` | 5,000 | 100 | Injective Protocol |
| `ink` | 1,123 | 2860 | Ink |
| `iotex` | 1,433 | 3214 | IoTeX |
| `ixo` | 5,000 | 0 | IXO |
| `jackal` | 6,582 | 3137 | Jackal Protocol |
| `juno` | 6,442 | 3355 | Juno Network |
| `kaia` | 5,141 | 3166 | Kaia |
| `kava` | 3,744 | 3167 | Kava |
| `koii` | 5,000 | 0 | Koii Network |
| `kyve` | 6,188 | 0 | Kyve Network |
| `linea` | 1,131 | 2571 | Linea |
| `manta` | 5,000 | 407 | Manta Network |
| `mantle` | 1,232 | 2878 | Mantle |
| `mantra` | 5,000 | 189 | Mantra |
| `maya` | 5,000 | 0 | Maya Protocol |
| `metis` | 1,649 | 2640 | Metis |
| `mina` | 5,000 | 0 | Mina Protocol |
| `moonbeam` | 896 | 189 | Moonbeam |
| `moonriver` | 902 | 189 | Moonriver |
| `namada` | 6,188 | 189 | Namada |
| `near` | 5,677 | 3167 | NEAR |
| `neutron` | 6,188 | 189 | Neutron |
| `nibiru` | 5,000 | 0 | Nibiru Network |
| `nillion` | 6,188 | 0 | Nillion |
| `oasys` | 1,388 | 3319 | Oasys |
| `op` | 1,812 | 4036 | Optimism |
| `op-sepolia-testnet` | 1,841 | 260 | Optimism Sepolia Testnet |
| `op_sep_test` | 1,808 | 0 | Optimism Sepolia Testnet |
| `opbnb` | 6,860 | 3355 | opBNB |
| `osmosis` | 6,349 | 2971 | Osmosis |
| `paloma` | 5,000 | 0 | Paloma |
| `passage` | 6,188 | 189 | Passage |
| `penumbra` | 5,000 | 0 | Penumbra |
| `persistence` | 6,464 | 3266 | Persistence |
| `planq` | 5,000 | 0 | Planq Mainnet |
| `pocket` | 1,088 | 3139 | Pocket Network |
| `pocket-alpha` | 1 | 0 | Pocket Network Alpha TestNet |
| `pocket-beta` | 1 | 294 | Pocket Network Beta TestNet |
| `pokt-network-watch-v1` | 5,000 | 1 | POKT Network Watch |
| `pokt-settlement-agent-v1` | 5,000 | 1 | POKT Settlement Agent |
| `polkadex` | 5,000 | 0 | Polkadex |
| `poly` | 1,905 | 4036 | Polygon |
| `poly-amoy-testnet` | 1,118 | 1162 | Polygon Amoy Testnet |
| `poly-zkevm` | 1,579 | 193 | Polygon zkEVM |
| `poly_amoy_test` | 1,118 | 0 | Polygon Amoy Testnet |
| `poly_zkevm` | 1,579 | 0 | Polygon zkEVM |
| `provenance` | 6,188 | 957 | Provenance |
| `quicksilver` | 6,188 | 0 | Quicksilver Protocol |
| `qwen` | 5,000 | 0 | Qwen |
| `radix` | 886 | 0 | Radix |
| `robinhood` | 2,733 | 4061 | Robinhood |
| `router` | 6,188 | 0 | Router Protocol |
| `rpc1` | 13 | 0 | json-rpc endpoint |
| `scroll` | 1,269 | 1187 | Scroll |
| `scroll-sepolia-testnet` | 5,000 | 0 | Scroll Testnet |
| `secret` | 5,000 | 100 | Secret Network |
| `seda` | 6,601 | 3137 | Seda Protocol |
| `sei` | 1,826 | 2564 | Sei |
| `sei-testnet` | 5,000 | 0 | Sei Testnet |
| `selfchain` | 5,000 | 0 | Selfchain |
| `sentinel` | 5,000 | 0 | Sentinel |
| `shentu` | 6,469 | 3266 | Shentu Chain |
| `side-protocol` | 6,188 | 0 | Side Protocol |
| `sifchain` | 5,000 | 0 | Sifchain |
| `solana` | 5,065 | 1938 | Solana |
| `soneium` | 2,000 | 1 | Soneium |
| `sonic` | 1,011 | 2859 | Sonic |
| `sonieum` | 5,000 | 0 | Soneium |
| `stargaze` | 6,188 | 0 | Stargaze |
| `stellar-horizon` | 5,000 | 0 | Stellar Horizon Mainnet |
| `stellar-horizon-testnet` | 5,000 | 0 | Stellar Horizon Testnet |
| `stellar-soroban` | 5,000 | 0 | Stellar Soroban Mainnet |
| `stellar-soroban-testnet` | 5,000 | 0 | Stellar Soroban Testnet |
| `stride` | 6,188 | 190 | Stride |
| `strk` | 10 | 0 | Starknet JSON-RPC |
| `sui` | 2,770 | 2347 | Sui |
| `supra` | 5,000 | 0 | Supra |
| `svc-poktminer` | 1 | 0 | delete |
| `syscoin` | 5,000 | 0 | Syscoin |
| `taiko` | 2,832 | 3537 | Taiko |
| `taiko-hekla-testnet` | 495 | 4 | Taiko Hekla Testnet |
| `taiko_hek_test` | 495 | 0 | Taiko Hekla Testnet |
| `tron` | 1,347 | 1009 | TRON |
| `unichain` | 5,015 | 2585 | Unichain The DeFi Chain by Uniswap |
| `union` | 5,000 | 289 | Union |
| `uquad` | 1 | 1 | uquad-core-RPC |
| `xrpl_evm_dev` | 1,579 | 0 | XRPL EVM Devnet |
| `xrpl_evm_test` | 1,579 | 0 | XRPL EVM Testnet |
| `xrplevm` | 1,698 | 1281 | XRPLEVM |
| `xrplevm-grove-only` | 1,579 | 0 | XRPLEVM-Grove-Test |
| `xrplevm-testnet` | 1,671 | 973 | XRPLEVM Testnet |
| `zircuit` | 5,000 | 1 | Zircuit |
| `zklink-nova` | 2,054 | 294 | zkLink Nova |
| `zklink_nova` | 1,808 | 0 | zkLink Nova |
| `zksync-era` | 3,901 | 4034 | zkSync Era |
| `zksync_era` | 3,882 | 0 | zkSync Era |

## Zero-coverage categories across all 264

- Weather and climate
- Sports, odds, fixtures, live events
- Travel, flights, hotels
- Food, recipes, nutrition
- Music, TTS, voice, audio generation
- Video understanding or generation
- SMS, notifications, email, webhook delivery
- Payments, invoicing, micropayments
- Jobs, hiring, HR
- Energy
- Real estate
- Logistics, shipping, tracking
- Timezone, calendar, scheduling
- Translation and localisation
- Fact-checking, claim verification, citation integrity
- File / blob storage and content addressing

## Already crowded, avoid

Agent safety and compliance screening is unusually deep here:
`sanctions-watchlist-screen`, `export-control-screen`, `debarment-exclusion`,
`enforcement-actions`, `prompt-injection-detect`, `pii-redaction`, `taint-check`,
`counterparty`, `med-safety`. Plus the regulatory data cluster: SEC EDGAR, FDA,
CFR, Federal Register, clinical trials, patents, and a Korean DART / K-law suite.

## Honest limitation

The public indexer does not expose per-service relay counts. The `relays { totalCount }`
field returns 0 for every service. Nothing in this map is ranked by actual traffic.
Registration and supplier counts are what the data supports.

## Structural finding

The service contract is: every response is a JSON object, all inputs arrive in the body,
no caller authentication, respond within the session. That is a stateless query function.
It cannot express state, identity, long-running work or side effects. This explains why
the catalogue is almost entirely read-only data lookups and naive ML stubs, and why the
action, automation and agent-to-agent surface that other ecosystems are building is
structurally absent.
