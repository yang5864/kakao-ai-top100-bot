import type { ChatMessage } from '../store.js';
import type { ActionRequest } from './action-api.js';

const NOTE_PREFIX = '[내부 접수 기록] ';
const MAX_RESULT_CHARS = 200;

// 이력에는 답변 문장만 남아 같은 접수를 다시 호출하기 쉬우므로 대화 단위로 막습니다.
export function submissionKey({ method, path, body }: ActionRequest) {
  if (method !== 'POST' || path.endsWith('/memos')) return null;
  const orderNo = (body as { order_no?: unknown } | undefined)?.order_no;
  return orderNo ? `${path}#${String(orderNo)}` : path;
}

export function readSubmissions(history: ChatMessage[]) {
  const submitted = new Map<string, string>();
  for (const { content } of history) {
    for (const line of content.split('\n')) {
      if (!line.startsWith(NOTE_PREFIX)) continue;
      const [key, result] = line.slice(NOTE_PREFIX.length).split(' => ');
      if (key && result) submitted.set(key, result);
    }
  }
  return submitted;
}

export function appendSubmissions(reply: string, before: Set<string>, submitted: Map<string, string>) {
  const notes = [...submitted]
    .filter(([key]) => !before.has(key))
    .map(([key, result]) => `${NOTE_PREFIX}${key} => ${result.replaceAll('\n', ' ').slice(0, MAX_RESULT_CHARS)}`);
  return [reply, ...notes].join('\n');
}
