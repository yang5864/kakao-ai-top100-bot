import { describe, expect, it } from 'vitest';

import { fitText, textResponse } from '../src/kakao/skill.js';

describe('fitText', () => {
  it('짧은 글은 그대로 둔다', () => {
    expect(fitText('  안녕  ')).toBe('안녕');
  });

  it('긴 글은 문장 끝에서 450자 이내로 자른다', () => {
    const text = fitText(`${'가'.repeat(300)}입니다. ${'나'.repeat(400)}입니다.`);

    expect(text).toBe(`${'가'.repeat(300)}입니다.`);
  });

  it('문장 끝이 없어도 450자를 넘지 않는다', () => {
    expect(fitText('가'.repeat(5000))).toHaveLength(450);
  });
});

describe('textResponse', () => {
  it('긴 답변도 SimpleText 말풍선 1개로 만든다', () => {
    const { version, template } = textResponse('가'.repeat(5000));

    expect(version).toBe('2.0');
    expect(template.outputs).toHaveLength(1);
    expect(Object.keys(template.outputs[0]!)).toEqual(['simpleText']);
  });
});
