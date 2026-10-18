# claude-code-mods

Mods for Claude Code: small plugins that change its interface and behaviour.

| Mod | What it does |
| --- | --- |
| **auto-model** | Routes each turn to Haiku, Sonnet or Opus by workload, and only switches when the prompt-cache re-write cost is worth it. |
| **usage-status** | A pill above the prompt showing model, context, cost and rate limits; auto-compacts at 250k tokens. |
| **token-usage** | A pane beside the transcript charting input, output and cache tokens. `/tokens` opens it. |
| **trim-startup-context** | `/trim-context` finds MCP servers whose tool schemas bloat startup context but are never used, and denies them per project. `/trim-context undo` reverts. |
| **shell-guard** | Denies Bash commands known to hang or fail on Windows, with the fix in the message. |

## Install

```
/plugin marketplace add AneeqMalik/claude-code-mods
/plugin install auto-model@claude-code-mods
```

Replace `auto-model` with any mod above. Install only the ones you want.

## auto-model

A classifier (Haiku) labels each prompt simple, moderate or complex and maps it to Haiku, Sonnet or Opus. Switching models invalidates the prompt cache, so a downgrade only happens when the cheaper model repays the cache re-write within a few turns. Upgrades are always allowed. If you pick a model with `/model`, auto-model pauses.

```
/auto-model                      show status and recent routing
/auto-model on | off             enable or pause routing
/auto-model haiku|sonnet|opus    pin one tier
/auto-model set <tier> <id>      use an exact model ID for a tier
/auto-model reset                clear ID overrides
```

**Model IDs.** Nothing is tied to one release. For each tier the ID is, in order: your `set` override; your session's current ID with the family swapped (`claude-opus-6-0` gives `claude-haiku-6-0`); a built-in default in `hooks/lib.ts`. If a derived ID is refused before any output, the turn retries once on the built-in ID.

The cost model (relative prices, expected turns per switch) uses assumptions in `hooks/lib.ts`, not billing data. Adjust them to your plan.

## usage-status

A pill above the prompt showing the current model, context used, session cost and rate-limit usage with time to reset. It turns to a warning state at 80%. It auto-compacts the conversation at 250k tokens. If auto-model is installed, the pill shows the model actually sent and notices when you change it with `/model`.

## token-usage

`/tokens` opens a narrow pane beside the transcript charting this session's tokens in four series: new input, cache read, cache write and output, with the last turns shown as they happen. Colours are colourblind-safe.

## trim-startup-context

MCP servers add their tool schemas to every session's startup context, used or not. This mod scans your last 30 session transcripts and finds servers that are loaded but never called. With at least 5 sessions of history it denies them for the current project automatically.

```
/trim-context           show unused servers and the tokens they cost
/trim-context apply     deny them in this project
/trim-context undo      revert, and stop auto-trimming this project
```

## shell-guard

Blocks Bash commands that are known to hang or fail on Windows, and says what to do instead. Current rules:

- `cat > file` with no heredoc or input waits on stdin forever. Use the Write tool or a heredoc.
- A Python string literal ending in a backslash before the closing quote is a syntax error. Use a raw string or `chr(92)`.

Rules live in `shell-guard/hooks/lib.ts`; add your own as `{ test, why }` entries.

## Develop

Each mod has tests: `claude plugin test <mod folder>` and `claude plugin validate <mod folder>`.

## License

MIT
