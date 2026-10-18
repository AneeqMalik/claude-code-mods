export type Tier = 'haiku' | 'sonnet' | 'opus'
export type Complexity = 'simple' | 'moderate' | 'complex'
export type Decision = { tier: Tier; reason: string }

// Fallback ids, used only when neither an override nor the session's own generation gives one.
export const MODEL_ID: Record<Tier, string> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
}
const RANK: Record<Tier, number> = { haiku: 0, sonnet: 1, opus: 2 }

// Tunable assumptions, not billing data. Prices are relative input prices per tier;
// a cache write costs 1.25x and a cache read 0.1x the base input price.
export const RELATIVE_PRICE: Record<Tier, number> = { haiku: 1, sonnet: 3, opus: 5 }
const WRITE = 1.25
const READ = 0.1
const TURN_TOKENS = 3000 // new input plus output per turn, in full-price token equivalents
const EXPECTED_TURNS = 5 // how long a switch is expected to hold
const MIN_HOLD = 3 // turns before a downgrade may follow another switch
const FREE_CTX = 20_000 // re-writing a prefix this small costs next to nothing
const COLD_MS = 60 * 60_000 // idle this long: the cache has lapsed whatever its lifetime
const HAIKU_MAX_CTX = 150_000 // keeps headroom under a 200k window

export const tierOf = (model: string): Tier | undefined => /haiku|sonnet|opus/i.exec(model)?.[0].toLowerCase() as Tier | undefined

export const tierFor = (c: Complexity): Tier => (c === 'simple' ? 'haiku' : c === 'moderate' ? 'sonnet' : 'opus')

// Turns a downgrade must stay to repay the cache re-write on the cheaper model.
export function breakEvenTurns(cur: Tier, target: Tier, ctx: number): number {
  const saved = (ctx * READ + TURN_TOKENS) * (RELATIVE_PRICE[cur] - RELATIVE_PRICE[target])
  return saved <= 0 ? Infinity : (ctx * WRITE * RELATIVE_PRICE[target]) / saved
}

export type DecideInput = { target: Tier; cur?: Tier; ctx: number; idleMs: number; sinceSwitch: number }

export function decide({ target, cur, ctx, idleMs, sinceSwitch }: DecideInput): Decision {
  if (cur === undefined) return { tier: target, reason: 'first turn' }
  if (target === cur) return { tier: cur, reason: 'same tier' }
  const isFree = ctx < FREE_CTX || idleMs > COLD_MS
  if (RANK[target] > RANK[cur]) return { tier: target, reason: isFree ? 'upgrade, cache cheap' : 'upgrade for hard task' }
  if (target === 'haiku' && ctx > HAIKU_MAX_CTX) return { tier: cur, reason: 'context too big for haiku' }
  if (sinceSwitch < MIN_HOLD) return { tier: cur, reason: 'holding recent switch' }
  if (isFree) return { tier: target, reason: 'downgrade, cache cheap' }
  const n = breakEvenTurns(cur, target, ctx)
  return n <= EXPECTED_TURNS
    ? { tier: target, reason: `downgrade, repays in ~${Math.ceil(n)} turns` }
    : { tier: cur, reason: 'switch costs more than it saves' }
}

export type Overrides = Partial<Record<Tier, string>>

// The id to send for a tier: a person's override, else the session's own id with the
// family swapped (so a new generation is followed), else the built-in default.
export function modelFor(tier: Tier, sessionModel: string | undefined, overrides: Overrides = {}): string {
  if (overrides[tier]) return overrides[tier]!
  const cur = sessionModel === undefined ? undefined : tierOf(sessionModel)
  if (sessionModel !== undefined && cur === tier) return sessionModel
  if (sessionModel !== undefined && cur) return sessionModel.replace(/\[.*\]$/, '').replace(/haiku|sonnet|opus/i, tier)
  return MODEL_ID[tier]
}
