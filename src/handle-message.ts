import { FALLBACK_MESSAGE } from './agent/prompt.js';
import { runAgent } from './agent/run.js';
import { sendCallback } from './kakao/client.js';
import type { MessageData } from './kakao/event.js';
import { textResponse } from './kakao/skill.js';
import { getStore } from './store.js';

const RESET_COMMAND = '/reset';

async function createReply(chatKey: string, content: string) {
  const store = getStore();

  try {
    if (content.trim() === RESET_COMMAND) {
      await store.clear(chatKey);
      return '대화 기록을 초기화했습니다.';
    }

    const reply = await runAgent(await store.history(chatKey), content);
    await store.append(chatKey, [
      { role: 'user', content },
      { role: 'assistant', content: reply },
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
