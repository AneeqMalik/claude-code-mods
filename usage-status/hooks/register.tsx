import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snapshot } from '../types'
import { countdown, isHigh, limitLabel, modelName, tokenCount } from './lib'

const AUTO_COMPACT_AT = 250_000 // tokens; the mod compacts here on each measure
const usage = atom({ plugin: 'usage-status', key: 'usage' } as const, null)
const routed = atom({ plugin: 'auto-model', key: 'effective' } as const, '') // the model auto-model last sent
const routedFrom = atom({ plugin: 'auto-model', key: 'base' } as const, '') // the session's own model when it did

type Reading = {
  context: { tokens?: number; percent?: number; window: number }
  cost?: { usd?: number }
  rateLimits?: { kind: string; percentUsed: number; resetsAt?: string }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function record($: any, r: Reading) {
  const snap: Snapshot = {
    model: (await read($, routed)) || (await $.session.model()),
    percent: r.context.percent,
    tokens: r.context.tokens,
    window: r.context.window,
    costUsd: r.cost?.usd,
    limits: (r.rateLimits ?? []).map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  }
  await update($, usage, () => snap)}

let stopWatching: (() => void) | undefined

// /model, the picker and the shortcut all change the session's model without any event the bar hears,
// so the bar would only catch up when something else redraws it. Watch it and redraw on a change.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function watchModel($: any) {
  stopWatching?.()
  let seen: string | undefined
  const timer = $.clock.every(1000, () => {
    $.session.model().then((m: string) => {
      if (seen !== undefined && m !== seen) $.ui.invalidate('ui.render')
      seen = m
    }, () => {})
  })
  stopWatching = () => timer.cancel()
}

export const register: Register = on => {
  let compacting = false

  // A fresh session has no measure until its first turn ends; seed the band now.
  on('session.start', async ($, e, next) => {
    watchModel($)
    try {
      await record($, await $.session.usage())
    } catch {
      // the next measure fills it in
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await record($, e)

    if (e.context.tokens !== undefined && e.context.tokens >= AUTO_COMPACT_AT && !compacting) {
      compacting = true
      try {
        await $.session.compact({ trigger: 'plugin', instructions: 'Keep open tasks, decisions and file paths.' })
      } catch {
        // rejects while a turn runs; the next measure tries again
      } finally {
        compacting = false
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, usage)
    if (e.props.hasSurvey || snap === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const pct = snap.percent
    // Read while drawing, so auto-model's switch (or /model) shows now, not at the next measure.
    const live = await $.session.model().catch(() => '')
    const sent = await read($, routed)
    const from = await read($, routedFrom)
    // The session's own model moved since auto-model routed: the person ran /model, so theirs wins.
    const model = (sent && (!from || !live || live === from) ? sent : live) || snap.model
    const below = await next(e) // other mods' rows in the band (the token card) stay too

    return (
      <Box flexDirection="column">
      <Box borderStyle="round" borderDimColor columnGap={2} paddingX={1} flexWrap="wrap">
        <Text>
          <Text dimColor>ctx </Text>
          <Text bold color={pct !== undefined && isHigh(pct) ? 'red' : undefined}>{pct ?? 0}%</Text>
          <Text dimColor> {tokenCount(snap.tokens ?? 0)}/{tokenCount(snap.window)}</Text>
        </Text>
        <Text bold>{modelName(model)}</Text>
        {snap.costUsd !== undefined && <Text color="#c2691e">${snap.costUsd.toFixed(2)}</Text>}
        {snap.limits.map(l => (
          <Text key={l.kind}>
            <Text dimColor>{limitLabel(l.kind)} </Text>
            <Text bold color={isHigh(l.percentUsed) ? 'red' : undefined}>{Math.round(l.percentUsed)}%</Text>
            {l.resetsAt && <Text dimColor> ({countdown(Date.parse(l.resetsAt) - now)})</Text>}
          </Text>
        ))}
      </Box>
      {below}
      </Box>
    )
  })
}
