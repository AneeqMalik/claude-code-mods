export type Counts = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type Tally = { total: Counts; turns: Counts[] }

declare module 'claude-code' {
  interface PluginState {
    'token-usage': { tally: Tally }
  }
}
