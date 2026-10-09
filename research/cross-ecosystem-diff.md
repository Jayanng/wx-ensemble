# Cross-ecosystem diff: what other markets serve that Pocket does not

Compiled 2026-10-09. Four independent sources.

## Source 1: Composio (1,604 toolkits, 20 categories)

The decisive source. It is the largest agent-tool marketplace.

Thirteen of its twenty categories have **zero presence on Pocket**:

| Category | Toolkits | On Pocket |
|---|---:|---|
| Productivity & Project Management | 202 | none |
| Document & File Management | 124 | none |
| Collaboration & Communication | 80 | none |
| Analytics & Data | 84 | partial |
| CRM | 67 | none |
| Design & Creative Tools | 66 | none |
| Workflow Automation | 66 | none |
| E-commerce | 47 | none |
| Advertising & Marketing | 45 | none |
| Scheduling & Booking | 34 | none |
| Entertainment & Media | 31 | none |
| HR & Recruiting | 26 | none |
| Education & LMS | 19 | none |
| Social Media | 13 | none |
| Developer Tools & DevOps | 201 | partial |
| AI & Machine Learning | 139 | yes |
| Data & Analytics | 157 | yes |
| Finance & Accounting | 94 | partial |
| Sales & Customer Support | 98 | none |
| Marketing & Social Media | 130 | none |

Its twelve most popular toolkits: Gmail, Google Calendar, Google Drive, Outlook, Twitter,
Google Sheets, Supabase, Composio, Notion, Slack, Airtable, Google Docs, HubSpot.
**Pocket has none of them.**

## Source 2: RapidAPI taxonomy

Categories entirely absent from Pocket: Weather, Sports, Entertainment, Travel, Science,
Food, Agriculture & Farming, Music, Business, Gaming, SMS, Events, Cryptography, Movies,
Jobs, Energy, Monitoring.

Present on RapidAPI but barely on Pocket: Location (Pocket has `ip-geolocation`, 0 suppliers,
plus `routing-isochrones`), Transportation (routing only).

## Source 3: Official MCP Registry (registry.modelcontextprotocol.io)

The live "Recently Updated" frontier shows what builders are shipping to agents right now.
None of this exists on Pocket:

- **Agent-to-agent networking** — `com.swarmmemo/bulletin`: "The hub where AI agents talk, in
  public and in private, find work and each other, and build trust"
- **Web actions behind forms and logins** — `ai.bowmark/bowmark`: "Do things on live websites:
  prices, availability, quotes, bookings, anything behind a form or login"
- **Browser and device automation** — eight `com.zennolab/*` servers driving Android devices
  and browsers: screen, elements, apps, gestures
- **Social posting with human approval queue** — `ink.octopost/octopost`: posts, schedules,
  queues and threads on X
- **CRM** — `com.conduyt/mcp`: contacts, deals, pipelines, tasks, automations, messaging
- **Real estate** — `app.sallim/korea-realty` (10M+ MOLIT records, court auctions, loan/DSR
  rules), `cz.cenaodhad/cenaodhad` (Prague apartment prices from cadastral sales)
- **Mobility and transport** — `de.viafrei/mcp`: Autobahn traffic, trains, transit, fuel,
  charging, parking, weather
- **Task management for agents** — `com.taskhold/taskhold`
- **Speech-to-text** — `io.github.CyberPunk11147/cyberwarex-voice-stt`
- **Pre-sign wallet safety** — `cyberwarex-wallet-safety` (tx simulation, signature decoding,
  address risk, ABI, URL phishing), `cyberwarex-defi-oracle` (honeypot sim, rug checks)
- **Consumer reviews with private receipts** — `com.evidentagents/reviews`
- **Domain research** — `com.dakaio/domainscout`
- **User feedback flows** — `com.getuserfeedback/mcp`
- **LinkedIn outreach** — `io.github.D4umak/heylead`
- **Media stack automation** — `io.github.bardesss/arr-mcp` (39 tools, Jellyfin/Plex/Seerr)
- **Indian equity markets** — `com.tapetide/stock-research-mcp` (NSE/BSE, 55 tools)
- **Excel analytical dashboards** — `io.github.AlgForce/exceldashboard-ai`

## Source 4: Crypto-native peer networks

- **Akash Network** — GPU and raw compute marketplace. Providers bid per GPU-hour. Not API services.
- **The Graph** — 10,000+ subgraphs, decentralised web3 data indexing and query.
- **Bittensor** — 80+ permissionless subnets, decentralised AI intelligence marketplace.

## What Pocket uniquely owns that none of these have

- Blockchain RPC breadth across 100+ chains. Unrivalled in any API marketplace.
- Web3-native agent primitives: `tx-decoding`, `tx-explain`, `contract-abi`,
  `event-log-decoding`, `wallet-portfolio`, `name-resolution` (ENS), `token-metadata`,
  `chain-simulation`, `backtest-reconcile-v1`, `pokt-settlement-agent-v1`
- The deepest compliance and safety screening stack in any marketplace.
- Per-relay settlement with a 2.5% owner fee. No API marketplace offers this.

## The structural insight that explains all of the above

Pocket's service contract is: every response is a JSON object, all inputs arrive in the body,
no caller authentication, respond within the session. That is a **stateless query function**.

It cannot express state, identity, long-running work or side effects. This is why the Pocket
catalogue is almost entirely read-only data lookups and naive ML stubs, and why the entire
action, automation and agent-to-agent frontier that every other ecosystem is now building is
structurally absent from it.

## One-line conclusion

Pocket is dense where institutions and regulators care, thin to the point of stubs in ML, and
structurally unable to host the action, automation and agent-to-agent surface where the rest
of the ecosystem is now building.
