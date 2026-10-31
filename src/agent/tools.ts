import { models } from '../config.js';
import { complete } from './openai.js';
import { calculatePartialRefund } from './partial-refund.js';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run(args: Record<string, unknown>, signal?: AbortSignal): Promise<string>;
}

// 에이전트 기능을 추가할 때는 이 배열에 도구를 넣으면 됩니다.
export const tools: Tool[] = [
  {
    name: 'calculate_partial_refund',
    description: '박스·세트 상품의 일부 개체 하자에 대한 하자 비율, 구간, 환불액을 계산합니다.',
    parameters: {
      type: 'object',
      properties: {
        defective: { type: 'number', description: '하자 개체 수' },
        total: { type: 'number', description: '입수(구성 개수)' },
        paid: { type: 'number', description: '해당 상품의 실결제액(원)' },
      },
      required: ['defective', 'total', 'paid'],
      additionalProperties: false,
    },
    async run(args) {
      const { defective, total, paid } = args as { defective: number; total: number; paid: number };
      return JSON.stringify(calculatePartialRefund({ defective, total, paid }));
    },
  },
  {
    name: 'think_deeply',
    description: '복잡한 추론이나 분석이 필요할 때만 상위 모델에 문제를 넘깁니다. 단순한 대화에는 쓰지 않습니다.',
    parameters: {
      type: 'object',
      properties: { problem: { type: 'string', description: '배경 정보를 포함한 문제 전체' } },
      required: ['problem'],
      additionalProperties: false,
    },
    async run(args, signal) {
      const response = await complete(
        { model: models.smart, messages: [{ role: 'user', content: String(args.problem) }] },
        signal,
      );
      return response.choices[0]?.message.content ?? '';
    },
  },
];
