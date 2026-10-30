import { createHash, timingSafeEqual } from 'node:crypto';

import { waitUntil } from '@vercel/functions';
import { Hono } from 'hono';

import { handleMessage } from './handle-message.js';
import { messageData, parseFrame } from './kakao/event.js';

function sha256(value: string) {
  return createHash('sha256').update(value).digest();
}

function isAuthorized(received: string | undefined) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  return received !== undefined && timingSafeEqual(sha256(received), sha256(secret));
}

const app = new Hono();

app.get('/', (c) => c.json({ ok: true }));

// 카카오는 1초 안에 2xx를 받아야 하므로 먼저 응답하고, 답변은 콜백 API로 따로 보냅니다.
app.post('/webhook', async (c) => {
  const headerName = process.env.WEBHOOK_HEADER_NAME || 'X-Webhook-Secret';
  if (!isAuthorized(c.req.header(headerName))) return c.body(null, 401);

  const frame = parseFrame(await c.req.text());
  if (!frame) return c.body(null, 400);

  const message = messageData(frame);
  if (message) {
    waitUntil(handleMessage(message).catch((error) => console.error('메시지 처리 실패:', error)));
  }
  return c.body(null, 204);
});

export default app;
