import { OpenAI } from 'openai';

import { requireEnv } from '../config.js';

let client: OpenAI | undefined;

export async function complete(params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, signal?: AbortSignal) {
  client ??= new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const response = await client.chat.completions.create(params, { signal });
  console.log(`[openai] ${params.model} tokens=${response.usage?.total_tokens ?? '?'}`);
  return response;
}
