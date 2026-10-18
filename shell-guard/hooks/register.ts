import type { Register } from 'claude-code'

import { guard } from './lib'

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const why = guard(e.command)
    return why ? { deny: `${$.plugin.name}: ${why}` } : next(e)
  })
}
