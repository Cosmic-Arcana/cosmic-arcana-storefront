# Cosmic Arcana — Storefront

The face of Cosmic Arcana: the web application users interact with, and the Backend-for-Frontend (BFF) that stands between them and the rest of the system.

Gaps vs a finished product (auth not wired to readings, GDPR pages): `docs/completeness-audit.md` in the workspace.

## The idea

Cosmic Arcana is an AI-native fortune-telling experience.

A user asks a question — about a decision, a relationship, a career move, or simply what the coming week might bring — and an AI agent answers the way a digital fortune-teller would. It draws tarot cards, looks at what is happening in the sky, remembers previous readings, and weaves everything into a personal, entertaining prediction.

The predictions are **fictional and reflective** by design. They are an invitation to think, not a claim about the future. Real-world data such as NASA imagery or astronomical events is used as storytelling material — symbolism, themes, atmosphere — and is never presented as evidence that the future can be predicted. The product always keeps a visible line between what was *retrieved from the real world* and what was *imagined*.

The core loop:

```text
User question
    ↓
Prediction / tarot request
    ↓
AI agent
    ↓
Relevant tools and context
    ↓
Optional cosmic, historical or personal context
    ↓
AI interpretation
    ↓
Fictional prediction
    ↓
Saved reading
```

## How it is being built

Cosmic Arcana is also an experiment: how far can one software engineer push Claude Code as an engineering partner?

The project is **vibe-coded**. It is built through **Claude Code Remote Control** (a session on a development machine, driven from a smartphone) **and through Cursor**. After the hackathon, about **$190 of Cursor usage credits** remain. There is no fixed schedule and no desk required. Work happens wherever the engineer happens to be — in small pockets of free time (a commute, a queue, a quiet evening) and whenever there are tokens left that are worth spending. The roadmap is shaped as much by spontaneous ideas as by a plan. A feature often starts as a thought typed on a phone and ends as a reviewed commit.

That way of working shapes the engineering:

- **Claude implements, the engineer steers.** Most of the code is delegated; architecture, service boundaries and review stay in human hands.
- **Context lives in the repositories.** Any session must be able to pick up where the previous one stopped, so knowledge is kept in `CLAUDE.md` files, progress notes, conventions, skills and hooks — not in anyone's memory.
- **Small slices.** Tasks are cut small enough to plan, implement, review and commit from a phone screen.
- **Automated quality gates.** Tests, structured logging and consistent conventions catch what a small screen might miss.
- **Multi-repository by design.** Every service lives in its own repository, which makes cross-repository context sharing part of the experiment.
- **Deliberate context budgeting.** Short sessions reward tight prompts, focused tools and small outputs — the same discipline the product asks of its own AI agent.

## The system

Cosmic Arcana is split into independent services, each in its own repository:

| Service | Role |
| --- | --- |
| **cosmic-arcana-storefront** *(this repository)* | Web application and BFF — everything the user sees, and the only API the browser talks to |
| **ai-service-api** | The fortune-teller's mind — predictions, tarot readings and all AI-specific business logic |
| **nasa-service-api** | The window to the real sky — retrieves, normalizes and caches NASA and astronomical data |
| **mcp-service-api** | The AI agent's doorway — exposes application capabilities as MCP tools, with agent authentication and on-behalf-of access |

Around them sit a few parts that do not have their own repositories yet: a **CQRS command layer** that orchestrates use cases, a **Redis / BullMQ broker** that carries domain events, a **PostgreSQL read model** that stores readings, and a **PostgreSQL MCP server** that gives the agent restricted, user-scoped database access.

```text
User
  │
  ▼
Storefront (Next.js + BFF) ◄─────────────── queries ───────────────┐
  │                                                                │
  │ commands                                                       │
  ▼                                                                │
Command layer (NestJS CQRS)                                        │
  │                                                                │
  ├──► AI service ─────┐                                           │
  └──► NASA service ───┤                                           │
                       │ domain events                             │
                       ▼                                           │
             Broker (Redis / BullMQ) ──► Read model (PostgreSQL) ──┘


AI agent (Claude) ── MCP ──► MCP service ──┬──► Command layer
                                           └──► PostgreSQL MCP ──► cosmic_agent schema (RLS)
```

## What this service does

### The web application

Everything the user experiences:

- asking a question and choosing the kind of reading;
- watching the reading unfold — the cards drawn, the cosmic context gathered, the prediction revealed;
- revisiting past readings and seeing how earlier predictions connect to new ones;
- signing in and managing their own account.

The storefront is responsible for making the line between fiction and fact obvious. A card's meaning and a NASA observation must never look like the same kind of information.

### The BFF

The Next.js API layer is the **only** API the frontend talks to. It exists exclusively for this frontend and is shaped around what the screens need, not around how the internal services are organized.

- **Authentication** — identifies the user before anything reaches the internal services.
- **Commands** — translates user actions ("ask a question", "draw cards") into commands for the command layer.
- **Queries** — reads finished readings and history from the read model, already shaped for the UI.
- **Correlation** — every user action starts its story here. The BFF assigns the correlation id that follows the request through every service, so a single reading can be traced end to end.
- **Shielding** — internal services, their protocols and their failures are never exposed directly to the browser.

### What it does not do

The storefront does not generate predictions, call NASA, talk to the AI model or expose tools to the agent. Those responsibilities belong to the other services; the storefront asks for them and presents the results.

## End-to-end tests

Playwright drives the real UI against the real backend (tarot, history, ai, nasa, mcp, their databases
and Redis). The scenarios are written Given / When / Then and live in `e2e/`.

```bash
# 1. the application, from cosmic-arcana-infrastructure
docker compose -f compose/application.yml -f compose/load.yml -f compose/e2e.yml up -d --wait

# 2. the tests (starts its own storefront on :3100 and two fault proxies on :4004 and :4005)
npx playwright install chromium          # once; or reuse the installed Chrome with the next line
E2E_BROWSER_CHANNEL=chrome npm run e2e
```

| Spec | What it protects |
| --- | --- |
| `core-flow` | ask, draw, loading state, the fiction and symbolic-sky notices |
| `ask-validation` | consent and length rules in the form and the endpoint, rate limit, markup stays text |
| `saved-readings` | list, paging past 20, deep links, a reading opened right after it is made, removal |
| `dependency-failures` | tarot or history down, failing, garbled or hanging: friendly text, right status, in time |
| `agent-activity` | what an agent did on the user's behalf, live and per session |
| `live-feed` | other people's cards appear, their question never does |
| `pages` | clean console, titles, 404, keyboard-only journey, crawlers, headers, axe |
| `mobile` | phone screen: ask on the first screen, no sideways scroll, tap targets |
| `production` | the real build (`E2E_PRODUCTION=1`): signed out, signed in as two users who must not see each other's readings, no accidental sign-out, strict CSP |

### The production-build project

```bash
E2E_BROWSER_CHANNEL=chrome npm run e2e:production    # next build, next start on :3101, then the tests
```

It is a separate run because it pays for a production build, and because development hides what it
tests: there is no demo user, no `AGENT_DASHBOARD_DEV_USER` shortcut and no React `eval()`. Signed-in
tests mint real Auth0 SDK session cookies (`@auth0/nextjs-auth0/testing`) for any account, against a
dummy tenant, so two users can be signed in at once and checked against each other.

How the tests stay independent: one worker, a client address and questions of their own per test, a
clean demo history at the start, and dummy Auth0 values so a test can never reach a real tenant. The
storefront under test calls tarot and history through **fault proxies**; a test flips one to
`down`, `hang`, `garbage`, `status` or `delay` to break that dependency on demand, because a
server-side fetch cannot be intercepted from the browser. `E2E_BASE_URL` points the suite at an
already running storefront, but the dependency-failure specs need the bundled one.

## On the horizon

Ideas that may shape the project next. In the spirit of spontaneous development, they are directions rather than commitments:

- **Smartwatch integration** — quick questions and short readings from the wrist.
- **Driver injection** — pluggable drivers injected into the system, some bringing AI features of their own, such as an MCP server.
