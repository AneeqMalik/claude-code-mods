import { expect, test } from 'claude-code/testing'

import { breakEvenTurns, decide, modelFor, tierOf } from './lib'

test('tierOf reads the family from an id', () => {
  expect([tierOf('claude-opus-5-5'), tierOf('claude-sonnet-5-5[1m]'), tierOf('claude-haiku-5-5'), tierOf('gpt')]).toEqual(['opus', 'sonnet', 'haiku', undefined])
})

test('first turn takes the target', () => {
  expect(decide({ target: 'haiku', ctx: 50_000, idleMs: 0, sinceSwitch: 99 }).tier).toBe('haiku')
})

test('upgrade is always allowed', () => {
  expect(decide({ target: 'opus', cur: 'haiku', ctx: 180_000, idleMs: 0, sinceSwitch: 0 }).tier).toBe('opus')
})

test('downgrade with a big warm cache is refused when it does not repay', () => {
  const d = decide({ target: 'sonnet', cur: 'opus', ctx: 200_000, idleMs: 1000, sinceSwitch: 99 })
  expect(d.tier).toBe('opus')
  expect(d.reason).toContain('costs more')
})

test('downgrade to haiku from opus repays on a big context', () => {
  expect(breakEvenTurns('opus', 'haiku', 200_000)).toBeLessThan(5)
  expect(decide({ target: 'haiku', cur: 'opus', ctx: 100_000, idleMs: 1000, sinceSwitch: 99 }).tier).toBe('haiku')
})

test('downgrade is free on a small or cold context', () => {
  expect(decide({ target: 'haiku', cur: 'opus', ctx: 5000, idleMs: 0, sinceSwitch: 99 }).tier).toBe('haiku')
  expect(decide({ target: 'sonnet', cur: 'opus', ctx: 190_000, idleMs: 2 * 3600_000, sinceSwitch: 99 }).tier).toBe('sonnet')
})

test('haiku is refused past its window headroom, and a recent switch holds', () => {
  expect(decide({ target: 'haiku', cur: 'sonnet', ctx: 160_000, idleMs: 3 * 3600_000, sinceSwitch: 99 }).tier).toBe('sonnet')
  expect(decide({ target: 'haiku', cur: 'opus', ctx: 1000, idleMs: 0, sinceSwitch: 1 }).tier).toBe('opus')
})

test('modelFor follows the session generation, honours overrides, and falls back', () => {
  expect(modelFor('haiku', 'claude-opus-6-0[1m]')).toBe('claude-haiku-6-0')
  expect(modelFor('opus', 'claude-opus-6-0[1m]')).toBe('claude-opus-6-0[1m]')
  expect(modelFor('sonnet', 'claude-opus-6-0', { sonnet: 'claude-sonnet-6-1' })).toBe('claude-sonnet-6-1')
  expect(modelFor('haiku', undefined)).toBe('claude-haiku-5-5')
  expect(modelFor('haiku', 'gpt-x')).toBe('claude-haiku-5-5')
})
