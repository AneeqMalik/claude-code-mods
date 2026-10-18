import { expect, test } from 'claude-code/testing'

import { addTurn, EMPTY, fmt, pct, sum } from './lib'

const u = (i: number, o: number, r: number, w: number) => ({
  input_tokens: i, output_tokens: o, cache_read_input_tokens: r, cache_creation_input_tokens: w,
})

test('addTurn sums totals and keeps the turn', () => {
  const t = addTurn(addTurn(EMPTY, u(10, 5, 100, 20)), u(1, 2, 3, 4))
  expect(t.total).toEqual({ input: 11, output: 7, cacheRead: 103, cacheWrite: 24 })
  expect(t.turns.length).toBe(2)
  expect(sum(t.total)).toBe(145)
})

test('pct', () => {
  expect([pct(0.956), pct(0.005), pct(0), pct(1)]).toEqual(['96%', '0.5%', '0%', '100%'])
})

test('fmt', () => {
  expect(fmt(950)).toBe('950')
  expect(fmt(1234)).toBe('1.2k')
  expect(fmt(196_600)).toBe('197k')
  expect(fmt(2_500_000)).toBe('2.5M')
  expect(fmt(1_100_000_000)).toBe('1.1B')
})
