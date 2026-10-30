import { requireEnv } from '../config.js';
import type { SkillResponse } from './skill.js';

function baseUrl() {
  return process.env.KAKAO_API_BASE_URL || 'https://kapi.kakao.com';
}

function headers(extra: Record<string, string> = {}) {
  return { Authorization: `KakaoAK ${requireEnv('BOT_TOKEN')}`, ...extra };
}

// 콜백 토큰은 발급 후 5분간, 한 번만 쓸 수 있습니다.
export async function sendCallback(callbackToken: string, skillResponse: SkillResponse) {
  const res = await fetch(`${baseUrl()}/v1/bot/callback`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', 'X-Bot-Callback-Token': callbackToken }),
    body: JSON.stringify({ skillResponse }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`카카오 콜백 실패 ${res.status}: ${await res.text()}`);
}

export async function getCommands() {
  const res = await fetch(`${baseUrl()}/v1/bot/commands`, {
    headers: headers(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`카카오 API 실패 ${res.status}: ${await res.text()}`);
  return res.json();
}
