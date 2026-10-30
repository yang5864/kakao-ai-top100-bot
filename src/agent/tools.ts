import { models } from '../config.js';
import { complete } from './openai.js';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run(args: Record<string, unknown>, signal?: AbortSignal): Promise<string>;
}

// 에이전트 기능을 추가할 때는 이 배열에 도구를 넣으면 됩니다.
export const tools: Tool[] = [
  {
    name: 'get_current_time',
    description: '현재 한국 시각을 확인합니다.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
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
