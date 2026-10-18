import type { Counts, Tally } from '../types'

export const KEYS = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
export type Key = (typeof KEYS)[number]

// Colorblind-safe (Okabe-Ito) so the four series stay apart on dark and light themes.
export const SERIES: Record<Key, { label: string; glyph: string; color: string }> = {
  input: { label: 'in', glyph: '↓', color: '#56B4E9' },
  output: { label: 'out', glyph: '↑', color: '#E69F00' },
  cacheRead: { label: 'hit', glyph: '⟲', color: '#009E73' },
  cacheWrite: { label: 'new', glyph: '✎', color: '#CC79A7' },
}

export const EMPTY: Tally = { total: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, turns: [] }
const KEEP = 60

type ApiUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export function addTurn(t: Tally, u: ApiUsage): Tally {
  const turn: Counts = {
    input: u.input_tokens,
    output: u.output_tokens,
    cacheRead: u.cache_read_input_tokens,
    cacheWrite: u.cache_creation_input_tokens,
  }
  const total = { ...t.total }
  for (const k of KEYS) total[k] += turn[k]
  return { total, turns: [...t.turns, turn].slice(-KEEP) }
}

export const sum = (c: Counts): number => KEYS.reduce((n, k) => n + c[k], 0)

// 268123 -> "268k", 1234567 -> "1.2M": short enough for one line
export function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// 0.956 -> "96%"; a sliver under 1% keeps a decimal so it never reads "0%": 0.005 -> "0.5%"
export function pct(share: number): string {
  const p = share * 100
  return p > 0 && p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`
}
