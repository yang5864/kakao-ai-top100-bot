import { describe, expect, it } from 'vitest';

import { appendSubmissions, readSubmissions, submissionKey } from '../src/agent/submissions.js';

describe('접수 중복 방지', () => {
  it('조회와 메모는 대상이 아니고 환불은 주문별로 구분한다', () => {
    expect(submissionKey({ method: 'GET', path: '/api/orders/1' })).toBeNull();
    expect(submissionKey({ method: 'POST', path: '/api/orders/1/memos' })).toBeNull();
    expect(submissionKey({ method: 'POST', path: '/api/refunds', body: { order_no: '1' } })).toBe('/api/refunds#1');
    expect(submissionKey({ method: 'POST', path: '/api/escalations' })).toBe('/api/escalations');
  });

  it('새 접수만 기록하고 이력에서 다시 읽는다', () => {
    const before = new Set(['/a']);
    const submitted = new Map([
      ['/a', 'HTTP 200 old'],
      ['/b', 'HTTP 200 {"id":"ESC-1"}\n끝'],
    ]);
    const content = appendSubmissions('답변입니다', before, submitted);

    expect(content.split('\n')).toHaveLength(2);
    expect(readSubmissions([{ role: 'assistant', content }]).get('/b')).toBe('HTTP 200 {"id":"ESC-1"} 끝');
  });
});
