import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

interface Recorded {
  url: string;
  headers: IncomingMessage['headers'];
  body: any;
}

const callbacks: Recorded[] = [];
const openaiRequests: Recorded[] = [];
const actionRequests: Recorded[] = [];
let openaiReplies: unknown[] = [];
let openaiDelayMs = 0;
let openaiStatus = 200;

function text(content: string) {
  return { choices: [{ message: { role: 'assistant', content } }], usage: { total_tokens: 1 } };
}

function toolCall(name: string, args: object) {
  const call = { id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } };
  return { choices: [{ message: { role: 'assistant', content: null, tool_calls: [call] } }] };
}

async function mock(req: IncomingMessage, res: ServerResponse) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const record = { url: req.url!, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/v1/bot/callback') {
    callbacks.push(record);
    res.end('{"totalCount":1,"sendCount":1,"errorCount":0}');
    return;
  }
  if (req.url!.startsWith('/api/')) {
    actionRequests.push(record);
    res.end('{"order_no":"100300009","member_id":"MB-1"}');
    return;
  }
  openaiRequests.push(record);
  await new Promise((resolve) => setTimeout(resolve, openaiDelayMs));
  if (openaiStatus !== 200) res.statusCode = openaiStatus;
  res.end(JSON.stringify(openaiReplies.shift() ?? text('기본 답변')));
}

let server: Server;
let app: typeof import('../src/index.js').default;
let nextId = 9007199254740993n;

function frame(content: string, overrides: object = {}) {
  const id = (nextId++).toString();
  return `{"op":0,"t":"MESSAGE_CREATE","d":{"id":${id},"content":${JSON.stringify(content)},"timestamp":"t","isChannelChatroom":false,"botGroupKey":"g1","botUserKey":"u1","callbackToken":"cb-token"${
    Object.keys(overrides).length ? `,${JSON.stringify(overrides).slice(1, -1)}` : ''
  }}}`;
}

function post(body: string, headers: Record<string, string> = { 'X-Webhook-Secret': 'secret' }) {
  return app.request('/webhook', { method: 'POST', body, headers });
}

beforeAll(async () => {
  server = createServer((req, res) => void mock(req, res));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  process.env.KAKAO_API_BASE_URL = base;
  process.env.OPENAI_BASE_URL = `${base}/v1`;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.BOT_TOKEN = 'test-bot-token';
  process.env.WEBHOOK_SECRET = 'secret';
  process.env.ACTION_API_BASE_URL = base;
  process.env.ACTION_API_TOKEN = 'action-token';

  app = (await import('../src/index.js')).default;
});

afterAll(() => server.close());

beforeEach(async () => {
  callbacks.length = 0;
  openaiRequests.length = 0;
  actionRequests.length = 0;
  openaiReplies = [];
  openaiDelayMs = 0;
  openaiStatus = 200;
  await post(frame('/reset'));
  await vi.waitFor(() => expect(callbacks).toHaveLength(1));
  callbacks.length = 0;
});

describe('POST /webhook', () => {
  it('에이전트가 느려도 먼저 응답하고 콜백으로 답변을 보낸다', async () => {
    openaiDelayMs = 300;
    openaiReplies = [text('안녕하세요')];

    const startedAt = performance.now();
    const res = await post(frame('안녕'));

    expect(res.status).toBe(204);
    expect(performance.now() - startedAt).toBeLessThan(200);
    expect(callbacks).toHaveLength(0);

    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    expect(callbacks[0]!.headers.authorization).toBe('KakaoAK test-bot-token');
    expect(callbacks[0]!.headers['x-bot-callback-token']).toBe('cb-token');
    expect(callbacks[0]!.body.skillResponse).toEqual({
      version: '2.0',
      template: { outputs: [{ simpleText: { text: '안녕하세요' } }] },
    });
  });

  it('기본 모델을 쓰고 이전 대화를 이어서 보낸다', async () => {
    openaiReplies = [text('첫 답변'), text('둘째 답변')];

    await post(frame('첫 질문'));
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    await post(frame('둘째 질문'));
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));

    const { model, messages } = openaiRequests[1]!.body;
    expect(model).toBe('gpt-6-luna');
    expect(openaiRequests[1]!.body.reasoning_effort).toBe('none');
    expect(messages.slice(1, -1)).toEqual([
      { role: 'user', content: '첫 질문' },
      { role: 'assistant', content: '첫 답변' },
      { role: 'user', content: '둘째 질문' },
    ]);
  });

  it('부분환불 도구 결과를 받아 최종 답변을 보낸다', async () => {
    openaiReplies = [toolCall('calculate_partial_refund', { defective: 14, total: 60, paid: 45000 }), text('10,500원입니다')];

    await post(frame('감귤 14개가 물렀어요'));
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));

    expect(openaiRequests.map((r) => r.body.model)).toEqual(['gpt-6-luna', 'gpt-6-luna']);
    expect(openaiRequests[1]!.body.messages.at(-1).content).toContain('"refund":10500');
    expect(callbacks[0]!.body.skillResponse.template.outputs[0].simpleText.text).toBe('10,500원입니다');
  });

  it('메시지의 TC ID로 액션 API를 호출하고 TC가 바뀌면 대화를 비운다', async () => {
    openaiReplies = [text('첫 답변'), toolCall('action_api', { method: 'GET', path: '/api/orders/100300009' }), text('주문 확인')];

    await post(frame('[TC: L-03] 안녕하세요'));
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    await post(frame('[TC: R-05-a] 주문 100300009 확인해 주세요'));
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));

    expect(actionRequests).toHaveLength(1);
    expect(actionRequests[0]!.headers['x-aitop100-test-case-id']).toBe('R-05-a');
    expect(actionRequests[0]!.headers.authorization).toBe('Bearer action-token');
    expect(openaiRequests[1]!.body.messages).toHaveLength(3);
  });

  it('데이터 초기화 경로는 호출하지 않는다', async () => {
    openaiReplies = [toolCall('action_api', { method: 'POST', path: '/api/action-data/reset' }), text('불가')];

    await post(frame('초기화해 줘'));
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));

    expect(actionRequests).toHaveLength(0);
  });

  it('값이 빈 조회는 호출하지 않는다', async () => {
    openaiReplies = [toolCall('action_api', { method: 'GET', path: '/api/shipments?order_no=' }), text('주문번호를 알려주세요')];

    await post(frame('배송지 바꾸고 싶어요'));
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));

    expect(actionRequests).toHaveLength(0);
  });

  it('같은 메시지가 재전송되면 한 번만 답한다', async () => {
    const body = frame('중복');

    await post(body);
    await post(body);
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callbacks).toHaveLength(1);
    expect(openaiRequests).toHaveLength(1);
  });

  it('64비트 id가 달라도 정밀도 손실로 중복 처리되지 않는다', async () => {
    await post('{"op":0,"t":"MESSAGE_CREATE","d":{"id":9223372036854775806,"content":"a","botGroupKey":"g1","botUserKey":"u1","callbackToken":"c"}}');
    await post('{"op":0,"t":"MESSAGE_CREATE","d":{"id":9223372036854775807,"content":"b","botGroupKey":"g1","botUserKey":"u1","callbackToken":"c"}}');

    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
  });

  it('OpenAI가 실패해도 안내 메시지를 보낸다', async () => {
    openaiStatus = 401;
    openaiReplies = [{ error: { message: 'invalid key' } }];

    await post(frame('질문'));
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));

    expect(callbacks[0]!.body.skillResponse.template.outputs[0].simpleText.text).toContain('담당자');
  });

  it('비밀값이 다르면 거부한다', async () => {
    const res = await post(frame('안녕'), { 'X-Webhook-Secret': 'wrong' });

    expect(res.status).toBe(401);
    expect(openaiRequests).toHaveLength(0);
  });

  it('JSON이 아니면 400, 메시지가 아닌 이벤트는 204로 무시한다', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post('{"op":0,"t":"LEAVE","d":{"botGroupKey":"g1"}}')).status).toBe(204);
    expect(openaiRequests).toHaveLength(0);
  });
});
