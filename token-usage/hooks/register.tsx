import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { addTurn, EMPTY, fmt, pct, SERIES, sum } from './lib'

const PANE = 'token-usage'
const COLUMNS = 28 // a narrow dock beside the transcript
const BAR = 24 // cells per bar: the dock minus border and padding
const tally = atom({ plugin: 'token-usage', key: 'tally' } as const, EMPTY)

const ROWS = [
  { key: 'input', name: 'New input' },
  { key: 'cacheRead', name: 'Cache read' },
  { key: 'cacheWrite', name: 'Cache write' },
  { key: 'output', name: 'Output' },
] as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tokens', description: 'Show the token usage pane' })
    void $.ui.open({ id: PANE, title: 'Tokens', columns: COLUMNS })
    return next(e)
  })

  on('command.run', { command: 'tokens' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Tokens', columns: COLUMNS })
    return { text: 'Token pane opened.' }
  })

  // Every turn that made requests, the main loop's and each subagent's, counts toward the session.
  on('turn.complete', async ($, e, next) => {
    if (e.usage) {
      const u = e.usage
      await update($, tally, t => addTurn(t, u))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { total } = await read($, tally)
    const all = sum(total)
    const prompt = total.input + total.cacheRead + total.cacheWrite
    const hit = total.cacheRead / Math.max(1, prompt)
    const real = total.input + total.cacheWrite + total.output

    const bar = (share: number, color: string) => {
      const filled = Math.round(share * BAR)
      return (
        <Text>
          <Text color={color}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'─'.repeat(BAR - filled)}</Text>
        </Text>
      )
    }
    const rule = <Text dimColor>{'─'.repeat(BAR)}</Text>

    return (
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
        <Text bold>Where tokens went</Text>
        <Text dimColor>{fmt(all)} tokens, by type</Text>

        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Input served from cache</Text>
          <Text bold color={SERIES.cacheRead.color}>{pct(hit)}</Text>
          {bar(hit, SERIES.cacheRead.color)}
          <Text dimColor>{fmt(real)} tokens of real work</Text>
        </Box>

        {ROWS.map(r => {
          const share = total[r.key] / Math.max(1, all)
          return (
            <Box key={r.key} flexDirection="column" marginTop={1}>
              <Box justifyContent="space-between">
                <Text>
                  <Text color={SERIES[r.key].color}>● </Text>
                  <Text>{r.name}</Text>
                </Text>
                <Text>
                  <Text bold>{fmt(total[r.key])} </Text>
                  <Text dimColor>{pct(share)}</Text>
                </Text>
              </Box>
              {bar(share, SERIES[r.key].color)}
            </Box>
          )
        })}

        <Box flexDirection="column">
          {rule}
          <Box justifyContent="space-between">
            <Text dimColor>Total</Text>
            <Text>
              <Text bold>{fmt(all)} </Text>
              <Text dimColor>100%</Text>
            </Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
