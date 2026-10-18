// "claude-opus-5-5[1m]" -> "Opus 5.5"; an unknown id is shown as it is.
export function modelName(id: string): string {
  const m = /(opus|sonnet|haiku|fable)-(\d+)(?:-(\d+))?/i.exec(id)
  if (!m) return id.replace(/\[.*\]$/, '')
  return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}${m[3] ? `.${m[3]}` : ''}`
}

// 268123 -> "268k", 1000000 -> "1M"
export function tokenCount(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`.replace('.0M', 'M')
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

// 4h29m, 1d5h, 12m
export function countdown(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  if (d > 0) return `${d}d${h}h`
  if (h > 0) return `${h}h${mins % 60}m`
  return `${mins}m`
}

export const isHigh = (percent: number): boolean => percent >= 80

export const limitLabel = (kind: string): string =>
  kind === 'five_hour' ? '5h' : kind === 'seven_day' ? '7d' : kind.replace(/_/g, ' ')
