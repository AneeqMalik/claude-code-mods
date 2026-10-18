// Each rule matches a command shape that failed or hung in past sessions.
const RULES: readonly { test: (c: string) => boolean; why: string }[] = [
  {
    // `cat > file` with no heredoc, pipe or input file waits on stdin forever.
    test: c => /(^|[;&]\s*)cat\s*>>?\s*\S+(\s+2>\S+)?\s*($|[;&|])/.test(c) && !c.includes('<<'),
    why: 'cat > file reads stdin and hangs here. Use the Write tool, or a heredoc.',
  },
  {
    // 'C:\x\' in a python literal: the final backslash escapes the closing quote.
    test: c => /\bpython\w*\b/.test(c) && /'(?:[^'\\\n]|\\\\)*\\'/.test(c),
    why: "A Python string ending in a backslash before the quote is a syntax error. Build it with chr(92) or use a raw string without a trailing backslash.",
  },
]

export const guard = (command: string): string | undefined => RULES.find(r => r.test(command))?.why
