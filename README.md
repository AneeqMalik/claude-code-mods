<div align="center">

# 🧩 claude-code-mods

**Five small mods that make Claude Code cheaper, clearer and safer on Windows.**

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Mods](https://img.shields.io/badge/mods-5-blue.svg)](#-the-mods)
[![Made for Claude Code](https://img.shields.io/badge/made%20for-Claude%20Code-D97757.svg)](https://claude.com/claude-code)
[![Stars](https://img.shields.io/github/stars/AneeqMalik/claude-code-mods?style=social)](https://github.com/AneeqMalik/claude-code-mods)

[Quick start](#-quick-start) · [The mods](#-the-mods) · [auto-model](#-auto-model) · [Develop](#-develop)

</div>

---

## ✨ Why

Claude Code is configurable, but the defaults leave money and context on the table. These mods fix the things I kept hitting:

- 💸 Every turn ran on one model, even when Haiku would do.
- 🔭 No live view of context, cost, rate limits or cache usage.
- 🗑️ MCP servers I never called still cost tokens at startup.
- 🪟 A few shell commands hang or fail on Windows, every time.

Each mod is independent. Install only the ones you want.

## 🚀 Quick start

```
/plugin marketplace add AneeqMalik/claude-code-mods
/plugin install auto-model@claude-code-mods
```

Swap `auto-model` for any mod below.

## 🧰 The mods

| | Mod | What it does | Command |
| :-: | --- | --- | --- |
| 🔀 | [**auto-model**](#-auto-model) | Routes each turn to Haiku, Sonnet or Opus by workload, switching only when the cache re-write pays off. | `/auto-model` |
| 📊 | [**usage-status**](#-usage-status) | A pill above the prompt: model, context, cost, rate limits. Auto-compacts at 250k. | |
| 🪙 | [**token-usage**](#-token-usage) | A live pane charting input, output and cache tokens. | `/tokens` |
| ✂️ | [**trim-startup-context**](#%EF%B8%8F-trim-startup-context) | Finds and denies MCP servers you never use. | `/trim-context` |
| 🛡️ | [**shell-guard**](#%EF%B8%8F-shell-guard) | Blocks Bash commands known to hang or fail on Windows, with the fix. | |

---

## 🔀 auto-model

Most turns don't need your biggest model. A Haiku classifier labels each prompt *simple*, *moderate* or *complex* and routes it to Haiku, Sonnet or Opus.

The catch: **switching models invalidates the prompt cache.** So a downgrade only happens when the cheaper model repays the cache re-write within a few turns. Upgrades are always allowed. If you pick a model with `/model`, auto-model steps aside.

| Command | Effect |
| --- | --- |
| `/auto-model` | Show status and recent routing |
| `/auto-model on` · `off` | Enable or pause routing |
| `/auto-model haiku` · `sonnet` · `opus` | Pin one tier |
| `/auto-model set <tier> <id>` | Use an exact model ID for a tier |
| `/auto-model reset` | Clear ID overrides |

<details>
<summary><b>Model IDs: nothing is tied to one release</b></summary>

For each tier the ID is, in order:

1. your `set` override;
2. your session's current ID with the family swapped (`claude-opus-6-0` becomes `claude-haiku-6-0`);
3. a built-in default in `hooks/lib.ts`.

If a derived ID is refused before any output, the turn retries once on the built-in ID.

The cost model (relative prices, expected turns per switch) uses assumptions in `hooks/lib.ts`, not billing data. Adjust them to your plan.
</details>

## 📊 usage-status

<p align="center"><img src="docs/usage-status.png" alt="usage-status pill: context, model, cost, 5-hour and 7-day limits" width="720"></p>

A pill above the prompt showing the current model, context used, session cost and rate-limit usage with time to reset. It turns to a warning state at 80% and auto-compacts the conversation at 250k tokens. With auto-model installed, it shows the model actually sent and notices when you change it with `/model`.

## 🪙 token-usage

<p align="center"><img src="docs/token-usage.png" alt="token-usage pane: new input, cache read, cache write, output" width="300"></p>

`/tokens` opens a narrow pane beside the transcript charting this session's tokens in four colourblind-safe series: **new input**, **cache read**, **cache write** and **output**, updated turn by turn.

## ✂️ trim-startup-context

MCP servers add their tool schemas to every session's startup context, used or not. This mod scans your last 30 session transcripts for servers that are loaded but never called. With at least 5 sessions of history, it denies them for the current project automatically.

```
/trim-context           show unused servers and the tokens they cost
/trim-context apply     deny them in this project
/trim-context undo      revert, and stop auto-trimming this project
```

## 🛡️ shell-guard

Blocks Bash commands that hang or fail on Windows, and says what to do instead.

| Blocked | Why | Use instead |
| --- | --- | --- |
| `cat > file` with no heredoc or input | Waits on stdin forever | The Write tool, or a heredoc |
| Python string ending in a backslash before the quote | Syntax error | A raw string, or `chr(92)` |

Add your own rules in `shell-guard/hooks/lib.ts` as `{ test, why }` entries.

---

## 🛠️ Develop

```
claude plugin validate <mod folder>
claude plugin test <mod folder>
```

Each mod keeps its logic in `hooks/lib.ts` with tests beside it, and the Claude Code wiring in `hooks/register.ts(x)`.

## 🤝 Contributing

Issues and PRs welcome. Keep each mod small, tested and independent.

## 📄 License

[MIT](LICENSE) © Aneeq Fayyaz Karim Malik
