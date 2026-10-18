import { expect, test } from 'claude-code/testing'

import { countdown, modelName, tokenCount } from './lib'

test('modelName', () => {
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5')
  expect(modelName('claude-fable-5-1')).toBe('Fable 5.1')
  expect(modelName('mystery[1m]')).toBe('mystery')
})

test('tokenCount', () => {
  expect([tokenCount(268123), tokenCount(1_000_000), tokenCount(1_500_000), tokenCount(900)]).toEqual(['268k', '1M', '1.5M', '900'])
})

test('countdown', () => {
  expect(countdown((4 * 60 + 29) * 60_000)).toBe('4h29m')
  expect(countdown((29 * 60 + 5) * 60_000)).toBe('1d5h')
  expect(countdown(12 * 60_000)).toBe('12m')
  expect(countdown(-5)).toBe('0m')
})
