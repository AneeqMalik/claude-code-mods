export type Snapshot = {
  model: string
  percent?: number
  tokens?: number
  window: number
  costUsd?: number
  limits: { kind: string; percentUsed: number; resetsAt?: string }[]
}

declare module 'claude-code' {
  interface PluginState {
    'usage-status': { usage: Snapshot | null }
    'auto-model': { effective: string; base: string }
  }
}
