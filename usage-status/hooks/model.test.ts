import { expect, mock, test } from 'claude-code/testing'

import { register } from './register'

const USAGE = { context: { tokens: 1000, percent: 1, window: 200_000 }, rateLimits: [] }

// The bar's text as the terminal draws it.
async function barText($: any): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'usage-status', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } })
  const texts = await ui.findAll({ type: 'Text' })
  return JSON.stringify(texts)
}

// Stands for auto-model: its turn.step and turn.start write this atom.
const autoModel = {
  name: 'auto-model',
  register: ((on: any) => {
    on('command.run', { command: 'route' }, async ($: any, e: any) => {
      const [sent, from] = e.args.split(' ')
      await $.state.set({ plugin: 'auto-model', key: 'effective' }, sent)
      await $.state.set({ plugin: 'auto-model', key: 'base' }, from ?? '')
      return { text: 'ok' }
    })
  }) as never,
}

test('the bar follows the session model, then auto-model, then /model', { plugins: [autoModel] }, async ($, on) => {
  mock.clock(on)
  // the rows beneath the bar: one empty line
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return (globalThis as any).h(Text, {}, '') as never
  })
  let session = 'claude-sonnet-5-5'
  const route = async (model: string, from = '') => {
    await $.command.run({ command: 'route', args: `${model} ${from}` } as never)
  }
  on('session.model', () => ({ value: session }))
  on('session.start', () => ({ cwd: '/work' }) as never)
  on('session.usage', () => ({ value: USAGE }) as never)

  await $.session.start({ cwd: '/work' } as never)
  expect(await barText($)).toContain('Sonnet 5.5')

  await route('claude-opus-5-5', 'claude-sonnet-5-5') // auto-model routes a turn to opus
  expect(await barText($)).toContain('Opus 5.5')

  await route('claude-haiku-5-5', 'claude-sonnet-5-5')
  expect(await barText($)).toContain('Haiku 5.5')

  await route('') // auto-model off, or the person ran /model
  session = 'claude-opus-5-5'
  expect(await barText($)).toContain('Opus 5.5')
  expect(await barText($)).not.toContain('Haiku')

  // auto-model still on and routing to haiku, then the person runs /model opus: the bar shows opus at once.
  await route('claude-haiku-5-5', 'claude-sonnet-5-5')
  session = 'claude-sonnet-5-5'
  expect(await barText($)).toContain('Haiku 5.5')
  session = 'claude-fable-5-1'
  expect(await barText($)).toContain('Fable 5.1')
  expect(await barText($)).not.toContain('Haiku')
})

test('the bar repaints by itself when the model changes between turns (/model)', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return (globalThis as any).h(Text, {}, '') as never
  })
  let session = 'claude-sonnet-5-5'
  on('session.model', () => ({ value: session }))
  on('session.start', () => ({ cwd: '/work' }) as never)
  on('session.usage', () => ({ value: USAGE }) as never)

  await $.session.start({ cwd: '/work' } as never)
  const ui = await $.ui.mount({ plugin: 'usage-status', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } })
  const shown = async () => JSON.stringify(await ui.findAll({ type: 'Text' }))

  await clock.advance(1000) // the watcher notes the starting model
  expect(await shown()).toContain('Sonnet 5.5')

  session = 'claude-opus-5-5' // the person runs /model; no event, no keystroke, only time passes
  await clock.advance(1000)
  await clock.settle()
  expect(await shown()).toContain('Opus 5.5')
})
