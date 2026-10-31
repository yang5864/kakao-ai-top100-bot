import { OpenAI } from 'openai';

import { requireEnv } from '../config.js';

const MAX_RETRIES = 6;

let client: OpenAI | undefined;

export async function complete(params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, signal?: AbortSignal) {
  // 토큰 한도에 걸려도 대부분 1초 안에 풀리므로 안내 메시지로 빠지기 전에 다시 시도합니다.
  client ??= new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY'), maxRetries: MAX_RETRIES });
  const response = await client.chat.completions.create(params, { signal });
  console.log(`[openai] ${params.model} tokens=${response.usage?.total_tokens ?? '?'}`);
  return response;
}
