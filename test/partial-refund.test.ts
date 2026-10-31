import { describe, expect, it } from 'vitest';

import { calculatePartialRefund } from '../src/agent/partial-refund.js';

describe('calculatePartialRefund', () => {
  it.each([
    [14, 60, 45_000, 23.3, 10_500, false],
    [26, 60, 45_000, 43.3, 22_500, true],
    [4, 20, 13_000, 20, 2_600, false],
    [1, 2, 55_800, 50, 27_900, true],
  ])('문서 예시 %i/%i', (defective, total, paid, ratio, refund, canReship) => {
    expect(calculatePartialRefund({ defective, total, paid })).toMatchObject({ ratio, refund, canReship });
  });

  it('1,000원 미만은 1,000원으로 올린다', () => {
    expect(calculatePartialRefund({ defective: 1, total: 60, paid: 45_000 }).refund).toBe(1_000);
  });

  it('10원 단위로 절상한다', () => {
    expect(calculatePartialRefund({ defective: 1, total: 7, paid: 10_000 }).refund).toBe(1_430);
  });

  it('경계 30%와 70%는 중간 구간이고 반올림 값으로 판정한다', () => {
    expect(calculatePartialRefund({ defective: 3, total: 10, paid: 10_000 }).band).toBe('상당 부분 하자');
    expect(calculatePartialRefund({ defective: 7, total: 10, paid: 10_000 }).band).toBe('상당 부분 하자');
    expect(calculatePartialRefund({ defective: 2996, total: 10000, paid: 10_000 }).ratio).toBe(30);
  });

  it('70% 초과는 전액이고 5만원 초과는 승인이 필요하다', () => {
    expect(calculatePartialRefund({ defective: 8, total: 10, paid: 60_000 })).toMatchObject({
      refund: 60_000,
      needsApproval: true,
    });
  });
});
