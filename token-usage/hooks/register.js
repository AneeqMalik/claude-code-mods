import { atom, read, update } from 'claude-code';
import { addTurn, EMPTY, fmt, KEYS, SERIES, sum } from './lib';
const tally = atom({ plugin: 'token-usage', key: 'tally' }, EMPTY);
const hidden = atom({ plugin: 'token-usage', key: 'hidden' }, false);
export const register = on => {
    on('session.start', async ($, e, next) => {
        await $.command.register({ name: 'tokens', description: 'Show or hide the token count above the prompt' });
        return next(e);
    });
    on('command.run', { command: 'tokens' }, async ($) => {
        const now = await update($, hidden, h => !h);
        return { text: now ? 'Token count hidden.' : 'Token count shown.' };
    });
    // Every turn that made requests, the main loop's and each subagent's, counts toward the session.
    on('turn.complete', async ($, e, next) => {
        if (e.usage) {
            const u = e.usage;
            await update($, tally, t => addTurn(t, u));
        }
        return next(e);
    });
    // One borderless line at the top-left of the band above the prompt, on the
    // terminal's own background; whatever else draws the band stays below it.
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        if (e.props.hasSurvey || (await read($, hidden)))
            return next(e);
        const t = await read($, tally);
        if (sum(t.total) === 0)
            return next(e);
        const { Box, Text } = $.ui.resolve(e);
        const below = await next(e);
        return (<Box flexDirection="column">
        {tokenLine(Text, t)}
        {below}
      </Box>);
    });
};
// ◆ 1.2M ↓12k ↑30k ⟲1.1M ✎80k 92%
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tokenLine(Text, t) {
    const prompt = t.total.input + t.total.cacheRead + t.total.cacheWrite;
    return (<Text wrap="truncate" dimColor>
      <Text color="#c2691e">◆</Text>
      <Text bold> {fmt(sum(t.total))}</Text>
      {KEYS.map(k => (<Text key={k}>
          {' '}<Text color={SERIES[k].color}>{SERIES[k].glyph}</Text>{fmt(t.total[k])}
        </Text>))}
      <Text color={SERIES.cacheRead.color}> {Math.round((t.total.cacheRead / Math.max(1, prompt)) * 100)}%</Text>
    </Text>);
}
