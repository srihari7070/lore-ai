# Lore Map — Full Overview

A plain-language but complete guide to what this package is, how every piece
works, and what it can and can't do.

---

## 1. What it is, in one breath

Lore Map is a command-line tool you install once (`npm i -g lore-map`). You run
it inside any project and it opens a **visual map of that project's architecture
in your browser** — boxes for backend/frontend/database/etc., connected by
lines, that you can zoom into. You edit the map, and it turns your edits into
instructions that **Claude carries out to change the actual code**. It runs
entirely on your machine and uses your own Claude (subscription or API key).

**Core idea:** instead of reading code as folders and files, you *see* it as a
map; instead of typing prompts, you *edit the map*.

---

## 2. The big-picture flow

```
You run `lore deep-scan`
   → a small web server starts on your computer (localhost:3333)
   → it opens your browser to a visual UI
   → you click "Start" → it reads your code → Claude builds the map
   → you explore (zoom into boxes) and edit
   → you click "Build" (or "→ Claude Code")
   → Claude writes the actual code changes
```

There are two programs in one package:
- **A back-end** (runs in your terminal): the command, a small server, the
  code-readers, and the calls to Claude.
- **A front-end** (runs in your browser): the visual map you click around in.

They talk over `http://localhost:3333`.

---

## 3. The back-end, piece by piece

- **The command (`bin/lore.js`)** — runs when you type `lore`. Picks the mode
  (`plan` / `scan` / `deep-scan` / `sync`), checks how you'll reach Claude
  (subscription by default; API key if set — never forces a key), starts the
  local server, opens the browser.
- **The server (Express)** — a tiny local web server. Serves the browser UI and
  answers `/api/...` requests. Listens only on your machine.
- **The reasoning layer (`anthropic.js`)** — every call where Claude has to
  *think* (build a map, format a blueprint). Routes through the **Claude Agent
  SDK** so it can use your **subscription**, not just an API key.
- **The interpreter (`interpreter.js`)** — a small, cheap model (**Haiku**) that
  translates your messy map-edits/notes into one clean instruction. Does not
  write code.
- **The builder (`builder.js`)** — the part that actually *changes your code*,
  via the Agent SDK with file tools. Only runs when you ask it to.
- **The readers/scanners** (local, free, no AI):
  - `fileTree.js` — lists files/folders (respects `.gitignore`).
  - `dependencies.js` — reads `package.json` / Python requirements.
  - `frameworks.js` — detects frameworks; reads env-var **names** only.
  - `imports.js` + `codeStructure.js` — JS/TS: classes, functions, imports.
  - `dbSchema.js` — Prisma/SQL: tables, fields, relations.
  - `sources.js` — everything else: a **bounded sample of raw source** for Claude
    to read (since we don't have a parser for every language).

---

## 4. The front-end (browser UI)

Built with **React + Vite + React Flow** (graph) + **Tailwind** (style) +
**Zustand** (state).

- **The canvas** — the map. Double-click a node to **drill in**; a breadcrumb
  climbs back out. Abstract on top, detail on click.
- **Node types** — a "block" card, a **table** card (DB columns, ER-style), and a
  **module** card (a file's classes/functions). A bold **project root** node sits
  at the top and everything connects to it (tree view).
- **The side panel** — notes, "Structure", stack picker, etc.
- **Toolbar buttons:**
  - **Compile to Lore** → writes `lore.md` + `CLAUDE.md`.
  - **▶ Build** → Claude changes the code itself, with a live progress bar.
  - **→ Claude Code** → writes the instruction to `.lore/next-prompt.md` and
    copies a one-line pointer to your clipboard, so you paste it into your own
    Claude Code session and watch it work.
- **The store (`graphStore.js`)** — holds the whole map as a **tree** (every node
  can contain its own sub-map), tracks what changed since the last build.

---

## 5. The four modes

| Mode | What it does | AI used? |
|---|---|---|
| `plan` | Describe an idea → Claude proposes a starting architecture + decisions | Yes |
| `scan` | Quick high-level map of an existing project | Yes (light) |
| `deep-scan` | Full drill-down map with real internals (tables, modules, functions) | Readers (free) + Claude |
| `sync` | Compares code to the blueprint, shows only what changed | Yes (light) |

`scan` / `deep-scan` / `sync` are **read-only**. Only **Build** changes code.

---

## 6. How a change becomes code

- **Build (autonomous):** edits → interpreter (Haiku) → builder (Agent SDK)
  edits files → live progress bar shows each action.
- **→ Claude Code (hand-off):** same instruction saved to
  `.lore/next-prompt.md`, pointer copied to clipboard; you paste it into your own
  Claude Code session and watch it run. (Can't auto-type into a live session —
  Claude Code limitation — so you paste one line.)

---

## 7. Auth & billing

Uses the **Claude Agent SDK**, which authenticates two ways:
- **Subscription** (default, via `claude /login`) — draws from your plan's
  monthly Agent-SDK credit. No separate bill.
- **API key** (fallback, `ANTHROPIC_API_KEY`) — pay-as-you-go; takes precedence
  if both are present.

Model roles: interpreter = **Haiku**; builder = your pick (**Sonnet** default,
**Opus** for hard work); map reasoning = **Opus** by default (`LORE_MODEL`).

---

## 8. What it writes into your project

- **`CLAUDE.md`** — architecture as context Claude Code auto-reads.
- **`lore.md`** — human-readable blueprint (optional).
- **`.lore/`** — internal state (gitignorable).

Nothing else. Real code changes only on **Build**.

---

## 9. What it can do

- Turn any codebase into a zoomable architecture map.
- Show exact DB tables/fields/relations (Prisma/SQL) and JS/TS code structure.
- Map *any* language at a high level (Claude reads the source).
- Plan new projects visually.
- Apply edits to real code via Claude — autonomously or handed to your Claude Code.
- Run on your subscription, no API key required.

## 10. What it can't do (yet)

- **Exact deep parsing is JS/TS + Prisma/SQL only.** Other languages are read by
  Claude as a **bounded sample** → representative map, not every file/table.
- **No real-time sync** — the map is a snapshot; re-run `deep-scan` to refresh.
- **Can't inject into a live Claude Code session** — hand-off needs one paste.
- **Progress % is an activity estimate**, not exact.
- **Big repos = slower + cost tokens/credit** (deep-scan ~1–3 min).
- **Local server has no auth** — fine for your machine, not for network exposure.
- **Build changes real files** — review/commit before big builds. (Scan is safe.)
- **No automated tests; Windows-tested first.**

---

## 11. How it's shipped

npm package `lore-map`. Published bundle is small (~129 KB): the command, server
code, and the **pre-built** browser UI (users never build anything). Source on
GitHub (`srihari7070/lore-ai`), MIT-licensed. Monetization kept open (open-core:
free tool, paid hosted/team features later).
