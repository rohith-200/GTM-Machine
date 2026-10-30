# AI GTM Engine

Plain-language product description in, approved and sent outreach out. An autonomous, closed-loop go-to-market pipeline with a human approval gate, built on a Neo4j knowledge graph.

**Pipeline:** Product intake → ICP inference → lead & competitor discovery (with citations) → knowledge graph → contact enrichment → signal-personalized drafts → human approval → send → pipeline tracking & analytics.

## Stack

| Layer | Tool |
| --- | --- |
| App + API | Next.js (App Router, TypeScript) |
| UI | Tailwind CSS, shadcn/ui, dnd-kit, Recharts |
| LLM | Nebius Token Factory (OpenAI-compatible) |
| Search + citations | Tavily |
| Knowledge graph (only database) | Neo4j AuraDB |
| Enrichment | Hunter.io (+ Tavily LinkedIn fallback) |
| Sending | One (withone.ai) → Gmail |
| CI + code review | Tenki runners and Tenki Code Reviewer |

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run test-keys            # every line should say OK
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | What it is |
| --- | --- |
| `NEBIUS_API_KEY`, `NEBIUS_MODEL` | Token Factory key and a non-reasoning instruct model, e.g. `Qwen/Qwen3-30B-A3B-Instruct-2507` |
| `TAVILY_API_KEY` | Tavily search |
| `HUNTER_API_KEY` | Hunter.io |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | AuraDB credentials (user is the value of `NEO4J_USERNAME` in the Aura file) |
| `ONE_API_KEY` | One secret key (`sk_live_…`) |
| `ONE_GMAIL_CONNECTION_KEY` | Full Gmail connection key (`live::gmail::default::<32 chars>`) |
| `ONE_GMAIL_SEND_ACTION_ID`, `ONE_GMAIL_SEND_PATH` | One "Send Email" action (`conn_mod_def::…::…`) and its path (`/v1/gmail/send-email`) |
| `TEST_INBOX` | Every approved email is delivered here (safety default) |
| `SEND_TO_REAL` | Leave unset. `true` would email real prospects |
| `SENDER_NAME` | Sign-off name in drafts |
| `USE_FIXTURES` | `true` makes every route return sample data (emergency switch) |

## Architecture

```
Browser (Next.js pages)  ──►  /api routes (frozen contract: src/contract/types.ts)
                                 │
          ┌──────────────────────┼─────────────────────────────┐
          ▼                      ▼                             ▼
   Nebius (LLM)            Tavily (search)              Hunter / One→Gmail
   ICP, extraction,        sources + citations          enrichment / sending
   drafts, competitors
          └──────────────► Neo4j knowledge graph ◄────────────┘
                 (graph, leads, messages, audit events, agent logs)
```

### Graph ontology

Nodes: `ICP`, `Product`, `Company`, `Person`, `Lead`, `Signal`, `Competitor`, `Message`, `Event`, `AgentLog`, `DemoSnapshot`.

Edges: `WORKS_AT`, `PREVIOUSLY_EMPLOYED_AT`, `HAS_SIGNAL`, `MATCHED_TO`, `FOR_PERSON`, `COMPETES_WITH`, `CONTACTED_VIA`, `ABOUT`.

### Reasoning loops

1. **ICP** (`src/lib/icp.ts`): Nebius infers industries, size, personas, triggers and disqualifiers with per-field confidence; each expansion segment is backed by Tavily evidence.
2. **Discovery** (`src/lib/discover.ts`): ICP → 6 targeted searches → Nebius extracts companies, named buyers and dated signals, each tied to a source index (uncited signals are dropped) → second-pass buyer lookup → disqualifier and size filters → scoring → graph write.
3. **Scoring**: industry 30 + size 20 + persona 20 + signals 30 = 0–100. Tier A ≥ 75, B 50–74, C < 50.
4. **Warm paths** (`src/lib/network.ts`): multi-hop Cypher from a lead to your network through `WORKS_AT` / `PREVIOUSLY_EMPLOYED_AT` (up to 4 hops). Edit `src/data/network.json`.
5. **Outreach** (`src/lib/outreach.ts`): one email + one LinkedIn note per lead, opening with that lead's real trigger; tone adapts to seniority.
6. **Human-in-the-loop gate** (`/api/messages/review`): nothing is sent without a rep's approval. Approve → One → Gmail → lead moves to Contacted, attributed to the rep. Every action is an `Event` (AI vs rep attribution and audit log).

## API

All responses: `{ ok: true, data } | { ok: false, error: { code, message } }`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST / GET | `/api/icp` | Generate / read ICP |
| POST | `/api/icp/segment` | Accept or dismiss an expansion segment |
| POST | `/api/discover` | Run discovery |
| GET | `/api/leads`, `/api/competitors` | Read leads / competitors |
| POST | `/api/enrich` | Enrich contacts |
| POST | `/api/drafts` | Draft outreach |
| GET | `/api/messages?status=` | Approval queue |
| POST | `/api/messages/review` | Approve / edit / reject (HITL gate) |
| POST | `/api/leads/stage` | Move a lead on the Kanban |
| GET | `/api/graph/warm-paths?leadId=` | Warm intro paths |
| GET | `/api/activity`, `/api/agent-log?since=` | Audit log, Agent Thinking stream |
| GET | `/api/analytics` | Funnel, conversion, tiers, attribution |
| POST | `/api/demo/save`, `/api/demo/load` | Snapshot / restore a demo run |
| POST | `/api/graph/link-network` | Re-link `network.json` |

## Safety

Approved emails go to `TEST_INBOX` with a header naming the intended recipient. Enrichment fallbacks are labelled unverified. Every outbound action is logged with actor and timestamp.
