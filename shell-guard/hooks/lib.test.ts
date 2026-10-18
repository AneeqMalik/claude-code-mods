import { expect, test } from 'claude-code/testing'

import { guard } from './lib'

test('denies a bare cat redirect', () => {
  expect(guard('cd x && cat > "$TMP/a.py" 2>/dev/null || true')).toContain('hangs')
  expect(guard('cat > out.txt')).toContain('hangs')
})

test('allows cat with a heredoc, a pipe or a file input', () => {
  expect(guard("cat > f <<'EOF'\nhi\nEOF")).toBeUndefined()
  expect(guard('echo hi | cat > f')).toBeUndefined()
  expect(guard('cat a.txt > b.txt')).toBeUndefined()
})

test('denies a python literal ending in a backslash', () => {
  expect(guard("python - <<'EOF'\nP='\\\\?\\'\nEOF")).toContain('chr(92)')
})

test('allows ordinary python and git commands', () => {
  expect(guard("python -c 'print(1)'")).toBeUndefined()
  expect(guard('git commit -m "fix it"')).toBeUndefined()
})
