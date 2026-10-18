export const KEYS = ['input', 'output', 'cacheRead', 'cacheWrite'];
// Colorblind-safe (Okabe-Ito) so the four series stay apart on dark and light themes.
export const SERIES = {
    input: { label: 'in', glyph: '↓', color: '#56B4E9' },
    output: { label: 'out', glyph: '↑', color: '#E69F00' },
    cacheRead: { label: 'hit', glyph: '⟲', color: '#009E73' },
    cacheWrite: { label: 'new', glyph: '✎', color: '#CC79A7' },
};
export const EMPTY = { total: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, turns: [] };
const KEEP = 60;
export function addTurn(t, u) {
    const turn = {
        input: u.input_tokens,
        output: u.output_tokens,
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
    };
    const total = { ...t.total };
    for (const k of KEYS)
        total[k] += turn[k];
    return { total, turns: [...t.turns, turn].slice(-KEEP) };
}
export const sum = (c) => KEYS.reduce((n, k) => n + c[k], 0);
// 268123 -> "268k", 1234567 -> "1.2M": short enough for one line
export function fmt(n) {
    if (n >= 1000000)
        return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 10000)
        return `${Math.round(n / 1000)}k`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}
