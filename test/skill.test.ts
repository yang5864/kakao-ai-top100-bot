import { describe, expect, it } from 'vitest';

import { splitText, textResponse } from '../src/kakao/skill.js';

describe('splitText', () => {
  it('짧은 글은 그대로 둔다', () => {
    expect(splitText('  안녕  ')).toEqual(['안녕']);
  });

  it('줄바꿈 위치에서 1000자 이내로 나눈다', () => {
    const chunks = splitText(`${'가'.repeat(900)}\n${'나'.repeat(900)}`);

    expect(chunks).toEqual(['가'.repeat(900), '나'.repeat(900)]);
  });

  it('말풍선 3개를 넘으면 잘라서 표시한다', () => {
    const chunks = splitText('가'.repeat(5000));

    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.length <= 1000)).toBe(true);
    expect(chunks[2]!.endsWith('…')).toBe(true);
  });
});

describe('textResponse', () => {
  it('SkillResponse 2.0 형식을 만든다', () => {
    expect(textResponse('안녕')).toEqual({
      version: '2.0',
      template: { outputs: [{ simpleText: { text: '안녕' } }] },
    });
  });
});
