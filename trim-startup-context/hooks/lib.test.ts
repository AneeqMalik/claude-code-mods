import { expect, test } from 'claude-code/testing'

import { addDeny, candidates, removeDeny, usedIn } from './lib'

const row = (name: string, input: object = {}) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } })

test('usedIn finds called servers and skills only', () => {
  const t = [row('mcp__context7__query-docs'), row('Skill', { skill: 'caveman' }), '{"type":"user","text":"mcp__ghost__x"}'].join('\n')
  const u = usedIn(t)
  expect([...u.servers]).toEqual(['context7'])
  expect([...u.skills]).toEqual(['caveman'])
})

test('candidates skips used servers and sums loaded tokens', () => {
  const tools = [
    { name: 'mcp__a__x', serverName: 'a', tokens: 100, isLoaded: true },
    { name: 'mcp__a__y', serverName: 'a', tokens: 50, isLoaded: false },
    { name: 'mcp__claude_ai_Gmail__z', serverName: 'claude.ai Gmail', tokens: 900, isLoaded: true },
    { name: 'mcp__b__x', serverName: 'b', tokens: 10, isLoaded: true },
  ]
  const c = candidates(tools, new Set(['b']))
  expect(c.map(x => [x.rule, x.tokens, x.tools])).toEqual([
    ['mcp__claude_ai_Gmail', 900, 1],
    ['mcp__a', 100, 2],
  ])
})

test('addDeny keeps existing settings and is idempotent; removeDeny reverts', () => {
  const start = JSON.stringify({ model: 'x', permissions: { allow: ['Bash'], deny: ['Read(.env)'] } })
  const a = addDeny(start, ['mcp__a'])
  expect(JSON.parse(a.text).permissions.deny).toEqual(['Read(.env)', 'mcp__a'])
  expect(addDeny(a.text, ['mcp__a']).added).toEqual([])
  expect(JSON.parse(removeDeny(a.text, ['mcp__a']))).toEqual(JSON.parse(start))
  expect(JSON.parse(removeDeny(addDeny('', ['mcp__a']).text, ['mcp__a']))).toEqual({})
})
