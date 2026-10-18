import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import { decide, modelFor, tierFor, tierOf, type Complexity, type Decision, type Overrides, type Tier } from './lib'

type Mode = 'auto' | 'off' | Tier
const CFG = 'auto-model:mode'
const LOG = 'auto-model:log'
const IDS = 'auto-model:ids'
// The usage meter reads this: a store is private to each plugin, an atom can be read by its name.
const effective = atom({ plugin: 'auto-model', key: 'effective' } as const, '')
// The model the session itself named when auto-model last routed: the meter compares it with the live one to see a /model.
const base = atom({ plugin: 'auto-model', key: 'base' } as const, '')
const KEEP = 200
const TIERS: readonly string[] = ['haiku', 'sonnet', 'opus']

type Store = { store: { get: (k: string) => Promise<unknown>; set: (k: string, v: unknown) => Promise<unknown> } }
async function idsOf($: Store): Promise<Overrides> {
  return ((await $.store.get(IDS)) as Overrides | undefined) ?? {}
}
async function modeOf($: Store): Promise<Mode> {
  return ((await $.store.get(CFG)) as Mode | undefined) ?? 'auto'
}

export const register: Register = on => {
  let lastSent: Tier | undefined // the model whose cache is warm
  let sessionModel: string | undefined // what the session itself names, to notice /model
  let lastDoneAt = 0
  let sinceSwitch = 99
  let plan: (Decision & { turnId: string }) | undefined

  on('session.start', async ($, e, next) => {
    await update($, effective, () => '')
    await update($, base, () => '')
    await $.command.register({
      name: 'auto-model',
      description: 'Auto model routing: on, off, haiku, sonnet, opus (pin), status, set <tier> <id>, reset',
      argumentHint: '[on|off|haiku|sonnet|opus|status|set <tier> <model-id>|reset]',
    })
    return next(e)
  })

  on('command.run', { command: 'auto-model' }, async ($, e) => {
    const raw = e.args.trim()
    const arg = raw.toLowerCase()
    const setCmd = /^set\s+(haiku|sonnet|opus)\s+(\S+)$/i.exec(raw)
    if (setCmd) await $.store.set(IDS, { ...(await idsOf($)), [setCmd[1].toLowerCase()]: setCmd[2] })
    else if (arg === 'reset') await $.store.set(IDS, {})
    else if (arg === 'on') await $.store.set(CFG, 'auto')
    else if (arg === 'off' || TIERS.includes(arg)) await $.store.set(CFG, arg)
    else if (arg !== '' && arg !== 'status') return { text: 'Usage: /auto-model [on|off|haiku|sonnet|opus|status|set <tier> <model-id>|reset]' }

    const mode = await modeOf($)
    const log = ((await $.store.get(LOG)) as { to: Tier; reason: string; ctx: number }[] | undefined) ?? []
    const counts = { haiku: 0, sonnet: 0, opus: 0 }
    for (const l of log) counts[l.to] += 1
    const recent = log.slice(-5).map(l => `  ${l.to}  ${l.reason}  (ctx ${l.ctx})`)
    return {
      text: [
        `auto-model: ${mode === 'auto' ? 'on' : mode === 'off' ? 'off' : `pinned to ${mode}`}. Warm cache: ${lastSent ?? 'none yet'}.`,
        `Last ${log.length} turns: haiku ${counts.haiku}, sonnet ${counts.sonnet}, opus ${counts.opus}.`,
        ...(recent.length ? ['Recent:', ...recent] : []),
      ].join('\n'),
    }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const result = await next(e)

    const mode = await modeOf($)
    if (mode === 'off') {
      await update($, effective, () => '')
      return result
    }
    const current = await $.session.model()
    if (!tierOf(current)) {
      await update($, effective, () => '')
      return result // a model off the ladder is left alone
    }

    // The person ran /model: stand down rather than fight the choice.
    if (sessionModel !== undefined && sessionModel !== current) {
      sessionModel = current
      await $.store.set(CFG, 'off')
      await update($, effective, () => '')
      $.ui.toast('auto-model paused: you picked a model. /auto-model on to resume.')
      return result
    }
    sessionModel = current
    await update($, base, () => current)

    let target: Tier
    let why: string
    if (mode !== 'auto') {
      target = mode
      why = 'pinned'
    } else if (e.text.trim() === '') {
      if (!plan) return result
      target = plan.tier // a continuation keeps the last route
      why = 'continuation'
    } else {
      let c: Complexity
      try {
        const label = await $.model.classify(e.text.slice(0, 600), ['simple', 'moderate', 'complex'], { model: modelFor('haiku', sessionModel, await idsOf($)) })
        c = (label as Complexity | undefined) ?? 'moderate'
        why = 'classifier'
      } catch {
        c = 'moderate'
        why = 'classifier failed'
      }
      target = tierFor(c)
    }

    const { context } = await $.session.usage()
    const now = await $.clock.now()
    const d = mode === 'auto'
      ? decide({ target, cur: lastSent, ctx: context.tokens ?? 0, idleMs: lastDoneAt ? now - lastDoneAt : Infinity, sinceSwitch })
      : { tier: target, reason: why }
    plan = { ...d, turnId: e.turnId }

    if (lastSent !== undefined && d.tier !== lastSent) {
      sinceSwitch = 0
      $.ui.toast(`auto-model: ${d.tier} (${d.reason})`)
    } else sinceSwitch += 1

    const log = ((await $.store.get(LOG)) as object[] | undefined) ?? []
    await $.store.set(LOG, [...log, { to: d.tier, reason: `${why}: ${d.reason}`, ctx: context.tokens ?? 0 }].slice(-KEEP))
    return result
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined || !plan || plan.turnId !== e.turnId) return yield* next(e)
    lastSent = plan.tier
    const model = modelFor(plan.tier, sessionModel ?? e.model, await idsOf($))
    await update($, effective, () => model) // the usage meter shows what is really sent
    const send = (m: string) => (m === e.model ? e : { ...e, model: m })
    const fallback = modelFor(plan.tier, undefined)
    let started = false
    try {
      for await (const chunk of next(send(model))) {
        started = true
        yield chunk
      }
    } catch (err) {
      // A derived id the API refuses before any output: retry once on the built-in id.
      if (started || model === fallback) throw err
      await update($, effective, () => fallback)
      yield* next(send(fallback))
    }
    return
  })

  on('turn.complete', async ($, e, next) => {
    lastDoneAt = await $.clock.now()
    return next(e)
  })
}
