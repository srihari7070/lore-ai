# Lore AI

[![License: MIT](https://img.shields.io/badge/License-MIT-5ea9ff.svg)](https://opensource.org/licenses/MIT)

**See your codebase as a living, zoomable architecture map — then edit the map and let Claude build the code.**

Instead of clicking through folders and files, Lore AI shows your project as an interconnected node graph: backend, frontend, database, integrations. Drill into any block to see its real internals — modules and how they import each other, database tables with their fields and relations. Edit the map, hit **Build**, and the changes flow into Claude Code, which writes the actual code.

It runs locally as one NPM package. **Bring your own Claude** — it uses your Claude subscription (or an API key); nothing runs on our servers.

---

## Why this exists

Reading an unfamiliar codebase means opening file after file and holding the wiring in your head. AI coding tools are powerful but you steer them by typing prose into a box.

Lore AI replaces both with a **spatial, visual interface**: the architecture *is* the view, and the view *is* how you give instructions. You think and edit in structure; an interpreter layer turns your edits into precise instructions; Claude Code builds. The map stays the durable record of how your project fits together.

---

## Install & commands

```bash
npm install -g lore-map     # one-time install
```

Then, from inside any project:

```bash
lore plan         # new project — describe an idea, get a starting architecture
lore scan         # existing project — quick high-level map
lore deep-scan    # existing project — full map with real internals (tables, modules, relations)
lore sync         # update the map/blueprint against current code
```

Each command spins up a local UI at `http://localhost:3333`. First run asks once for your credentials (see below). Close the tab or `Ctrl+C` to stop.

---

## How it works

```
  Visual map (browser)            you edit here
        │
        ▼
  Interpreter (Haiku)             turns your edits into a precise instruction
        │
        ▼
  Builder (Claude Agent SDK)      reads files + writes the actual code
        │
        ▼
  Your project files              the result
```

- **The map is the interface.** Drill down with double-click, climb back with the breadcrumb. Database blocks render as ER views (tables → fields → relations); code blocks render as modules with their classes/functions and imports.
- **Any language.** `deep-scan` has Claude read your actual source, so it understands Python, JS/TS, Java, Go, SQL — whatever your project is. (Fast per-language parsers are a planned optimization for the common stacks.)
- **Two AI roles, kept separate.** A small, cheap **interpreter** (Haiku) translates intent; a user-selectable **builder** (Sonnet by default, Opus for hard work) writes code.
- **Nothing leaves your machine** except the calls to Claude, made with your own credentials.

---

## Bring your own Claude

Lore uses the **Claude Agent SDK**, which authenticates two ways:

| | How | When |
|---|---|---|
| **Subscription** (default) | `claude /login` (Pro/Max/Team/Enterprise) | Everyday use — draws from your plan's Agent SDK credit, no extra bill |
| **API key** (fallback) | set `ANTHROPIC_API_KEY` | Heavy/CI/production use, or when the monthly credit runs out |

If `ANTHROPIC_API_KEY` is set, it takes precedence. On first run Lore prompts you for whichever you prefer.

Optional environment overrides:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | API key (fallback to subscription) |
| `LORE_MODEL` | `claude-opus-4-8` | Model for scan/plan/compile reasoning |
| `LORE_BUILDER_MODEL` | `claude-sonnet-4-6` | Default builder model |
| `LORE_INTERPRETER_MODEL` | `claude-haiku-4-5` | Interpreter model |
| `LORE_PORT` | `3333` | Local port |

---

## What it writes into your project

Minimal and explainable:
- **`CLAUDE.md`** — your architecture as standing context Claude Code reads automatically (project root).
- **`lore.md`** — the human-readable blueprint (optional export).
- **`.lore/`** — internal state (gitignorable).

Nothing else.

---

## The four modes

- **Plan** — describe an idea (type or speak); Claude seeds a starting architecture you expand.
- **Scan** — quick high-level map of an existing codebase (file tree, deps, frameworks).
- **Deep-scan** — the full picture: Claude reads your real source to map database tables/fields/relations and code internals into the drill-down graph. Re-run anytime for more detail.
- **Sync** — diff the current code against your map and surface only what changed.

---

## Tech stack

Node.js + Commander (CLI) · Express (local server) · React + Vite + React Flow + Tailwind (UI) · `@anthropic-ai/claude-agent-sdk` (builder) · `@anthropic-ai/sdk` (scan/plan reasoning) · `@babel/parser` + `glob` (deterministic JS/TS extraction) · Web Speech API (voice).

## Local development

```bash
git clone https://github.com/srihari7070/lore-ai && cd lore-ai
npm install
npm run dev      # Vite client on :5173, API on :3333 (proxied) — full error messages, hot reload
npm run build    # builds dist/client (shipped in the published package)
```

## Contributing

Issues and PRs welcome. The philosophy is *frictionless over featureful* — if a change makes Lore feel heavier than not using it, it probably doesn't belong. A natural first contribution: a deterministic per-language structure parser (Python, Go, Java…) to make deep-scan cheaper on common stacks.

## License

[MIT](./LICENSE)
