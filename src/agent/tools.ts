import { callActionApi, type ActionRequest } from './action-api.js';
import { calculatePartialRefund } from './partial-refund.js';
import { submissionKey } from './submissions.js';

export interface ToolContext {
  testCaseId?: string;
  submitted?: Map<string, string>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run(args: Record<string, unknown>, context: ToolContext): Promise<string>;
}

// 에이전트 기능을 추가할 때는 이 배열에 도구를 넣으면 됩니다.
export const tools: Tool[] = [
  {
    name: 'action_api',
    description: '교동마을 산지직송 액션 서버를 호출해 조회하거나 요청을 접수합니다. 경로는 지침의 액션 API 목록을 따릅니다.',
    parameters: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST'] },
        path: { type: 'string', description: '/api/로 시작하는 경로와 쿼리' },
        body: { type: 'object', description: 'POST 요청 본문. 본문이 없는 접수는 빈 객체' },
      },
      required: ['method', 'path'],
    },
    async run(args, context) {
      const request = args as unknown as ActionRequest;
      const key = submissionKey(request);
      const previous = key ? context.submitted?.get(key) : undefined;
      if (previous) return `이미 접수한 요청입니다. 다시 호출하지 말고 기존 접수 내용을 안내하세요. ${previous}`;

      const result = await callActionApi(request, context.testCaseId);
      if (key && result.startsWith('HTTP 2')) context.submitted?.set(key, result);
      return result;
    },
  },
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
];
