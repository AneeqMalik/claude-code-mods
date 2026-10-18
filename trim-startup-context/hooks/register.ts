import type { EngineInterface, Register } from 'claude-code'

import { addDeny, candidates, removeDeny, usedIn, type Candidate, type McpTool } from './lib'

const SESSIONS = 30 // transcripts scanned, newest first
const MIN_SESSIONS = 5 // fewer than this is too little history to call a server unused

type Scan = { tools: McpTool[]; all: number; found: Candidate[]; scanned: number; skipped: number }

// MCP servers loaded now that the last sessions never called.
async function scan($: EngineInterface): Promise<Scan | undefined> {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const tools: McpTool[] = context.breakdown?.mcpTools ?? []
  const all = tools.filter(t => t.isLoaded).reduce((n, t) => n + t.tokens, 0)

  // Transcripts live under the active config folder, which is not always ~/.claude.
  const config = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  const base = config ?? (home ? `${home}/.claude` : undefined)
  if (!base) return undefined
  const root = `${base}/projects`
  const files: { path: string; mtimeMs: number }[] = []
  for (const dir of (await $.fs.list(root)).filter(d => d.kind === 'dir')) {
    for (const f of await $.fs.list(`${root}/${dir.name}`)) {
      if (f.kind === 'file' && f.name.endsWith('.jsonl')) {
        files.push({ path: `${root}/${dir.name}/${f.name}`, mtimeMs: f.mtimeMs })
      }
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs)
  const used = new Set<string>()
  let scanned = 0
  let skipped = 0
  for (const f of files.slice(0, SESSIONS)) {
    try {
      for (const s of usedIn((await $.fs.read(f.path)) as string).servers) used.add(s)
      scanned += 1
    } catch {
      skipped += 1 // over the 4 MiB read limit, or unreadable
    }
  }
  return { tools, all, found: candidates(tools, used), scanned, skipped }
}

async function files($: EngineInterface) {
  const cwd = await $.session.cwd()
  const local = `${cwd}/.claude/settings.local.json`
  return {
    cwd,
    local,
    rulesKey: `trim-context:${cwd}`,
    offKey: `trim-context:off:${cwd}`, // set by undo, so the automatic pass leaves this project alone
    read: async (): Promise<string> => ((await $.fs.exists(local)) ? ((await $.fs.read(local)) as string) : ''),
  }
}

// Denies the found servers in this project and remembers the rules it added.
async function apply($: EngineInterface, found: readonly Candidate[]): Promise<{ added: string[]; local: string }> {
  const f = await files($)
  const { text, added } = addDeny(await f.read(), found.map(c => c.rule))
  if (added.length > 0) {
    await $.fs.write(f.local, text)
    await $.store.set(f.rulesKey, [...(((await $.store.get(f.rulesKey)) as string[] | undefined) ?? []), ...added])
  }
  return { added, local: f.local }
}

// Automatic pass: deny servers that are loaded and unused across enough history, unless undo opted this project out.
async function auto($: EngineInterface) {
  try {
    const f = await files($)
    if (await $.store.get(f.offKey)) return
    const s = await scan($)
    if (!s || s.scanned < MIN_SESSIONS || s.found.length === 0) return
    const { added } = await apply($, s.found)
    if (added.length > 0) {
      const tokens = s.found.filter(c => added.includes(c.rule)).reduce((n, c) => n + c.tokens, 0)
      $.ui.toast(`trim-context: denied ${added.length} unused MCP server(s), ${tokens.toLocaleString()} tokens, from next session. /trim-context undo reverts.`)
    }
  } catch {}
}

export const register: Register = on => {
  let checked = false // the automatic pass has run once this session

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'trim-context',
      description: 'Unused MCP servers are denied automatically per project; this shows them, apply forces it, undo reverts and opts out',
      argumentHint: '[apply|undo]',
    })
    // The session may not be bound yet; if no MCP schemas are visible, the first turn tries again.
    try {
      const { context } = await $.session.usage({ breakdown: 'summary' })
      if ((context.breakdown?.mcpTools ?? []).length > 0) {
        checked = true
        await auto($)
      }
    } catch {}
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!checked && e.agentId === undefined) {
      checked = true
      await auto($)
    }
    return next(e)
  })

  on('command.run', { command: 'trim-context' }, async ($, e) => {
    const mode = e.args.trim()
    const f = await files($)

    if (mode === 'undo') {
      const rules = ((await $.store.get(f.rulesKey)) as string[] | undefined) ?? []
      await $.store.set(f.offKey, true)
      if (rules.length === 0) return { text: 'Nothing to undo: this mod has added no rules here. Automatic trimming is now off for this project.' }
      await $.fs.write(f.local, removeDeny(await f.read(), rules))
      await $.store.delete(f.rulesKey)
      return { text: `Removed ${rules.length} deny rule(s) from ${f.local}. Automatic trimming is off for this project; /trim-context apply turns it back on. Restart the session to load the servers again.` }
    }
    if (mode !== '' && mode !== 'apply') return { text: 'Usage: /trim-context [apply|undo]' }

    const s = await scan($)
    if (!s) return { text: 'Cannot find the home folder to read past sessions.' }
    const saved = s.found.reduce((n, c) => n + c.tokens, 0)
    const lines = [
      `MCP schemas in the window: ${s.all.toLocaleString()} tokens. Scanned ${s.scanned} past session(s)${s.skipped ? `, ${s.skipped} unreadable` : ''}.`,
      s.found.length === 0
        ? 'Every connected MCP server was used recently. Nothing to trim.'
        : `Unused MCP servers (${saved.toLocaleString()} tokens):\n` +
          s.found.map(c => `  ${c.rule}  ${c.tools} tools, ${c.tokens.toLocaleString()} tokens`).join('\n'),
    ]

    if (mode !== 'apply' || s.found.length === 0) {
      if (s.found.length > 0) lines.push('These are denied automatically at session start; /trim-context apply does it now.')
      return { text: lines.join('\n') }
    }
    if (s.scanned < MIN_SESSIONS) {
      lines.push(`Not applied: only ${s.scanned} session(s) of history, need ${MIN_SESSIONS} to call a server unused.`)
      return { text: lines.join('\n') }
    }

    await $.store.delete(f.offKey)
    const { added, local } = await apply($, s.found)
    lines.push(`Applied: denied ${added.length} server(s) in ${local}. Takes effect next session. /trim-context undo reverts.`)
    return { text: lines.join('\n') }
  })
}
