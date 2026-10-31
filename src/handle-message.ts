import { FALLBACK_MESSAGE } from './agent/prompt.js';
import { runAgent } from './agent/run.js';
import { appendSubmissions, readSubmissions } from './agent/submissions.js';
import { sendCallback } from './kakao/client.js';
import type { MessageData } from './kakao/event.js';
import { textResponse } from './kakao/skill.js';
import { getStore } from './store.js';

const RESET_COMMAND = '/reset';
// 평가는 대화로 TC ID를 전달하므로 메시지에서 찾아 대화 단위로 유지합니다.
const TEST_CASE_ID = /\b[A-Z]-\d{2}(?:-[a-z])?\b/;

// TC가 바뀌면 다른 케이스이므로 이전 대화를 이어가지 않습니다.
async function resolveTestCase(chatKey: string, content: string) {
  const store = getStore();
  const current = await store.testCase(chatKey);
  const found = content.match(TEST_CASE_ID)?.[0];
  if (!found || found === current) return current ?? undefined;

  await Promise.all([store.clear(chatKey), store.setTestCase(chatKey, found)]);
  return found;
}

async function createReply(chatKey: string, content: string) {
  const store = getStore();

  try {
    if (content.trim() === RESET_COMMAND) {
      await store.clear(chatKey);
      return '대화 기록을 초기화했습니다.';
    }

    const testCaseId = await resolveTestCase(chatKey, content);
    const history = await store.history(chatKey);
    const submitted = readSubmissions(history);
    const before = new Set(submitted.keys());
    const reply = await runAgent(history, content, { testCaseId, submitted });
    await store.append(chatKey, [
      { role: 'user', content },
      { role: 'assistant', content: appendSubmissions(reply, before, submitted) },
    ]);
    return reply;
  } catch (error) {
    console.error('에이전트 실행 실패:', error);
    return FALLBACK_MESSAGE;
  }
}

export async function handleMessage(message: MessageData) {
  if (!message.callbackToken) return;
  // 저장소 장애 때도 사용자에게 답이 가도록 처음 보는 메시지로 처리합니다.
  if (!(await getStore().claim(message.id).catch(() => true))) return;

  const chatKey = `${message.botGroupKey}:${message.botUserKey}`;
  const reply = await createReply(chatKey, message.content);
  await sendCallback(message.callbackToken, textResponse(reply));
}
