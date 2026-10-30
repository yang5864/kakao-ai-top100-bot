const MAX_TEXT = 1000;
const MAX_OUTPUTS = 3;

export function splitText(text: string): string[] {
  const chunks: string[] = [];
  let rest = text.trim();

  while (rest && chunks.length < MAX_OUTPUTS) {
    if (rest.length <= MAX_TEXT) {
      chunks.push(rest);
      rest = '';
      break;
    }
    const newline = rest.lastIndexOf('\n', MAX_TEXT);
    const end = newline > 0 ? newline : MAX_TEXT;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }

  if (rest) chunks[chunks.length - 1] = `${chunks.at(-1)!.slice(0, MAX_TEXT - 1)}…`;
  return chunks;
}

export function textResponse(text: string) {
  return {
    version: '2.0',
    template: { outputs: splitText(text).map((chunk) => ({ simpleText: { text: chunk } })) },
  };
}

export type SkillResponse = ReturnType<typeof textResponse>;
