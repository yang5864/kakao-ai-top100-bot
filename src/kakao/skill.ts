// 심사에서 500자를 넘는 말풍선은 평가에서 제외됩니다.
const MAX_TEXT = 450;

export function fitText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_TEXT) return trimmed;

  const head = trimmed.slice(0, MAX_TEXT);
  return (head.match(/^[\s\S]*[.!?\n]/)?.[0] ?? head).trim();
}

// 심사는 SimpleText가 아닌 응답에서 케이스를 종료하고, 말풍선 수가 적을수록 유리합니다.
export function textResponse(text: string) {
  return {
    version: '2.0',
    template: { outputs: [{ simpleText: { text: fitText(text) } }] },
  };
}

export type SkillResponse = ReturnType<typeof textResponse>;
