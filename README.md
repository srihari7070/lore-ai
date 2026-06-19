# Lore Map

[![npm version](https://img.shields.io/npm/v/lore-map.svg?color=5ea9ff)](https://www.npmjs.com/package/lore-map)
[![License: MIT](https://img.shields.io/badge/License-MIT-5ea9ff.svg)](https://opensource.org/licenses/MIT)

**See your codebase as a living, zoomable map — then edit the map and let Claude build the code.**

You know the feeling of opening an unfamiliar project and clicking through folder after folder, trying to hold the whole thing in your head? Lore Map replaces that with a picture. Run **one command** inside any project and it opens a live, zoomable map of your architecture in the browser — backend, frontend, database, integrations — with the real wiring drawn out. **Double-click any box to go deeper:** actual database tables and how they relate, real files and how they import each other, the structure you'd otherwise have to reconstruct by hand.

Then it flips: the map isn't just to *look* at — it's how you *change* the code. Edit a box, jot a note, connect two things, and hit **Build**. Lore turns your edits into a precise instruction and **Claude writes the code** — either right there with a live progress bar, or handed off to your own Claude Code session to run while you watch. It runs entirely on your machine, on **your own Claude subscription** (no API key required). One install, four commands. **See your project. Edit the picture. Ship the code.**

```bash
npm install -g lore-map
cd your-project
lore deep-scan
```

---

## Commands

Install once, then from inside any project:

```bash
lore plan         # new idea → Claude proposes a starting architecture you expand
lore scan         # existing project → quick high-level map
lore deep-scan    # existing project → full map with real internals (tables, modules, relations)
lore sync         # update the map against the current code
```

Each opens a local UI at **`http://localhost:3333`** and runs on your machine. Close the tab or `Ctrl+C` to stop.

---

## What you can do with it

- **Explore visually.** A tree map with your project at the root and every part hanging off it. Double-click to drill in; breadcrumb to climb back out. Database blocks render as ER diagrams (tables → fields → relations); code blocks show files with their classes/functions and imports.
- **Works on any language.** `deep-scan` has Claude read your real source, so it maps Python, JS/TS, Java, Go, SQL — whatever you've got. (Database schemas and JS/TS structure are also parsed precisely and for free.)
- **Edit, then make it real — two ways:**
  - **▶ Build it for me** — Lore changes the code here, with a **live progress bar** showing each file it touches.
  - **→ Send to Claude Code** — copies a one-line prompt to paste into your *own* Claude Code session, so you run it there and watch.
- **Stays focused.** Every scan writes a small `.lore/map.md`, and builds read it first to jump straight to the relevant files instead of crawling the whole repo.
- **Private by default.** Nothing leaves your machine except the calls to Claude, made with your own credentials.

---

## How it works

```
  Visual map (browser)        ← you edit here
        │
        ▼
  Interpreter (Haiku)         turns your edits into a precise instruction
        │
        ▼
  Builder (Claude Agent SDK)  reads the map, opens the right files, writes code
        │
        ▼
  Your project files          the result
```

Two AI roles, kept separate: a small, cheap **interpreter** (Haiku) translates your intent, and a user-selectable **builder** (Sonnet by default, Opus for hard work) writes the code. Scanning and exploring are **read-only** — your code only changes when you press **Build**.

---

## Bring your own Claude

Lore uses the **Claude Agent SDK**, which authenticates two ways:

| | How | When |
|---|---|---|
| **Subscription** (default) | `claude /login` (Pro / Max / Team / Enterprise) | Everyday use — draws from your plan's Agent SDK credit, no extra bill |
| **API key** (fallback) | set `ANTHROPIC_API_KEY` | Heavy / CI use, or when the monthly credit runs out |

If `ANTHROPIC_API_KEY` is set it takes precedence; otherwise it uses your subscription.

Optional environment overrides:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | API key (otherwise subscription) |
| `LORE_MODEL` | `claude-opus-4-8` | Model for scan / plan / compile reasoning |
| `LORE_BUILDER_MODEL` | `claude-sonnet-4-6` | Default builder model |
| `LORE_INTERPRETER_MODEL` | `claude-haiku-4-5` | Interpreter model |
| `LORE_PORT` | `3333` | Local port |

---

## What it writes into your project

Minimal and explainable:
- **`.lore/map.md`** — a compact map of your architecture (so builds stay focused). Gitignorable.
- **`CLAUDE.md`** — your architecture as standing context Claude Code reads automatically (written when you Compile).
- **`lore.md`** — a human-readable blueprint (optional export).

Your real code changes only when you click **Build**.

---

## Get an Anthropic plan / key

You need either a **Claude subscription** (run `claude /login` once — recommended) or an **API key** from [console.anthropic.com](https://console.anthropic.com/settings/keys). Lore never forces a key; it defaults to your subscription.

---

## Tech stack

Node.js + Commander (CLI) · Express (local server) · React + Vite + React Flow + Tailwind (UI) · `@anthropic-ai/claude-agent-sdk` (reasoning + builder, subscription-aware) · `@babel/parser` + `glob` (deterministic JS/TS & schema extraction) · Web Speech API (voice input).

## Local development

```bash
git clone https://github.com/srihari7070/lore-ai && cd lore-ai
npm install
npm run dev      # Vite client on :5173, API on :3333 (proxied) — hot reload, full errors
npm run build    # builds dist/client (bundled into the published package)
```

## Limitations (honest)

- Exact, free parsing is **JS/TS + Prisma/SQL**; other languages are read by Claude as a **bounded sample**, so very large repos get a representative map, not every file.
- The map is a **snapshot** — re-run a scan to refresh after big code changes.
- `deep-scan` on a real project takes **~1–3 minutes** and uses credit/tokens.
- The local server has **no auth** — it's meant for your machine, not network exposure.

## Contributing

Issues and PRs welcome. The philosophy is *frictionless over featureful* — if a change makes Lore feel heavier than not using it, it probably doesn't belong. A great first contribution: a deterministic per-language structure parser (Python, Go, Java…) to make `deep-scan` cheaper and more complete on common stacks.

## License

[MIT](./LICENSE) © Srihari Ananthan
