import { requireEnv } from '../config.js';

const MAX_RESULT_CHARS = 6_000;
const TIMEOUT_MS = 10_000;
// 공개 TC 연습용 기본값입니다. 평가에서는 대화로 받은 TC ID를 씁니다.
const DEFAULT_TEST_CASE_ID = 'L-03';

export interface ActionRequest {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

export async function callActionApi({ method, path, body }: ActionRequest, testCaseId?: string) {
  if (!path.startsWith('/api/') || path.startsWith('/api/action-data')) {
    return '허용되지 않은 경로입니다.';
  }

  const baseUrl = process.env.ACTION_API_BASE_URL || 'https://gyodong-mall-action.aitop100.org';
  const send = () =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${requireEnv('ACTION_API_TOKEN')}`,
        'X-Aitop100-Test-Case-Id': testCaseId || DEFAULT_TEST_CASE_ID,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let response = await send();
  if (response.status === 429) {
    const seconds = Number(response.headers.get('retry-after'));
    if (seconds > 0 && seconds <= 5) {
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      response = await send();
    }
  }

  const text = (await response.text()).slice(0, MAX_RESULT_CHARS);
  console.log(`[action] ${method} ${path} ${response.status}`);
  return `HTTP ${response.status}${text ? ` ${text}` : ' (본문 없음)'}`;
}
