export type McpTool = { name: string; serverName: string; tokens: number; isLoaded: boolean }

export type Candidate = { server: string; rule: string; tools: number; tokens: number }

// The wire name an MCP server goes by in `mcp__<server>__<tool>`.
export const wireName = (server: string): string => server.replace(/[^a-zA-Z0-9_-]/g, '_')

// Servers and skills the assistant actually called in one transcript's text.
export function usedIn(transcript: string): { servers: Set<string>; skills: Set<string> } {
  const servers = new Set<string>()
  const skills = new Set<string>()
  for (const line of transcript.split('\n')) {
    if (!line.includes('"tool_use"')) continue
    let row: any
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    const blocks = row?.message?.content
    if (row?.type !== 'assistant' || !Array.isArray(blocks)) continue
    for (const b of blocks) {
      if (b?.type !== 'tool_use') continue
      const m = /^mcp__(.+?)__/.exec(b.name)
      if (m) servers.add(m[1])
      if (b.name === 'Skill' && typeof b.input?.skill === 'string') skills.add(b.input.skill)
    }
  }
  return { servers, skills }
}

// MCP servers loaded this session and never called: biggest schema cost first.
export function candidates(tools: readonly McpTool[], used: ReadonlySet<string>): Candidate[] {
  const by = new Map<string, Candidate>()
  for (const t of tools) {
    const wire = wireName(t.serverName)
    if (used.has(wire)) continue
    const c = by.get(wire) ?? { server: t.serverName, rule: `mcp__${wire}`, tools: 0, tokens: 0 }
    c.tools += 1
    if (t.isLoaded) c.tokens += t.tokens
    by.set(wire, c)
  }
  // A server whose schemas cost nothing now (deferred) saves nothing to deny.
  return [...by.values()].filter(c => c.tokens > 0).sort((a, b) => b.tokens - a.tokens)
}

type Json = Record<string, any>
const parse = (text: string): Json => {
  if (!text.trim()) return {}
  const v = JSON.parse(text)
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('settings is not a JSON object')
  return v
}

// Adds deny rules to a settings.local.json text; `added` is only the new ones.
export function addDeny(text: string, rules: readonly string[]): { text: string; added: string[] } {
  const s = parse(text)
  const deny: string[] = Array.isArray(s.permissions?.deny) ? s.permissions.deny : []
  const added = rules.filter(r => !deny.includes(r))
  s.permissions = { ...s.permissions, deny: [...deny, ...added] }
  return { text: JSON.stringify(s, null, 2) + '\n', added }
}

export function removeDeny(text: string, rules: readonly string[]): string {
  const s = parse(text)
  if (Array.isArray(s.permissions?.deny)) {
    s.permissions.deny = s.permissions.deny.filter((r: string) => !rules.includes(r))
    if (s.permissions.deny.length === 0) delete s.permissions.deny
    if (Object.keys(s.permissions).length === 0) delete s.permissions
  }
  return JSON.stringify(s, null, 2) + '\n'
}
