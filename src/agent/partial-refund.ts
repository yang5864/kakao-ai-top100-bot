export interface PartialRefundInput {
  /** 하자 개체 수 */
  defective: number;
  /** 입수(구성 개수) */
  total: number;
  /** 실결제액 */
  paid: number;
}

const MIN_REFUND = 1_000;
const DISCRETION_LIMIT = 50_000;

// 부분환불 산식 제3조~제5조: R은 소수 첫째 자리로 반올림한 값으로 구간을 판정합니다.
export function calculatePartialRefund({ defective, total, paid }: PartialRefundInput) {
  if (!(total > 0) || !(defective > 0) || defective > total || !(paid > 0)) {
    throw new Error('하자 개체 수, 입수, 실결제액을 다시 확인해 주세요.');
  }

  const ratio = Math.round((defective / total) * 1000) / 10;
  const band = ratio < 30 ? '부분 하자' : ratio <= 70 ? '상당 부분 하자' : '사실상 전부 하자';
  const raw = ratio < 30 ? (paid * defective) / total : ratio <= 70 ? paid / 2 : paid;
  const refund = Math.max(Math.ceil(raw / 10) * 10, MIN_REFUND);

  return {
    ratio,
    band,
    refund,
    canReship: ratio >= 30,
    needsApproval: refund > DISCRETION_LIMIT,
  };
}
