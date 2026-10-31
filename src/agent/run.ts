import type { OpenAI } from 'openai';

import { models } from '../config.js';
import type { ChatMessage } from '../store.js';
import { complete } from './openai.js';
import { FALLBACK_MESSAGE, SYSTEM_PROMPT } from './prompt.js';
import { tools } from './tools.js';

const MAX_STEPS = 5;
// 심사는 60초 동안 응답이 없으면 케이스를 종료하므로 그 전에 안내를 보냅니다.
const TIME_LIMIT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 600;

async function runTool(call: OpenAI.Chat.ChatCompletionMessageFunctionToolCall, signal: AbortSignal) {
  try {
    const tool = tools.find((t) => t.name === call.function.name);
    if (!tool) return `알 수 없는 도구입니다: ${call.function.name}`;
    return await tool.run(JSON.parse(call.function.arguments || '{}'), signal);
  } catch (error) {
    if (signal.aborted) throw error;
    return `도구 실행 실패: ${String(error)}`;
  }
}

export async function runAgent(history: ChatMessage[], userMessage: string): Promise<string> {
  const signal = AbortSignal.timeout(TIME_LIMIT_MS);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await complete(
      {
        model: models.default,
        // gpt-6-luna는 Chat Completions에서 도구를 쓸 때 추론을 끄도록 요구합니다.
        reasoning_effort: 'none',
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages,
        tools: tools.map(({ name, description, parameters }) => ({
          type: 'function',
          function: { name, description, parameters },
        })),
        tool_choice: step === MAX_STEPS ? 'none' : 'auto',
      },
      signal,
    );

    const message = response.choices[0]?.message;
    const calls = message?.tool_calls?.filter((call) => call.type === 'function') ?? [];
    if (!message || calls.length === 0) return message?.content?.trim() || FALLBACK_MESSAGE;

    messages.push(message);
    for (const call of calls) {
      messages.push({ role: 'tool', tool_call_id: call.id, content: await runTool(call, signal) });
    }
  }

  return FALLBACK_MESSAGE;
}
