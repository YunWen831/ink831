export const CHAT_RETENTION_MS = 30 * 60 * 1000;
export const CHAT_SWEEP_MS = 60 * 1000;
export const CHAT_LIMIT = 50;
export const freshMessages = (messages, now = Date.now()) => messages.filter(message => message.at > now - CHAT_RETENTION_MS).slice(-CHAT_LIMIT);
export const bubbleDuration = text => Math.min(15000, 5000 + Array.from(text).length * 85);

export function wrapMessage(text, measure, width, maxLines = 12) {
  const units = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), part => part.segment)
    : Array.from(text);
  const lines = [];let line = '';
  for (const unit of units) {
    if (line && measure(line + unit) > width) { lines.push(line);line = ''; }
    line += unit;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);let end = result.at(-1);
  while (end && measure(end + '…') > width) end = Array.from(end).slice(0, -1).join('');
  result[maxLines - 1] = end + '…';return result;
}
