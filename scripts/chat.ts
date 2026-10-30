// 카카오 연결 없이 터미널에서 에이전트와 대화합니다.
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { runAgent } from '../src/agent/run.js';
import type { ChatMessage } from '../src/store.js';

const readline = createInterface({ input, output });
const history: ChatMessage[] = [];

while (true) {
  const content = (await readline.question('\n나> ')).trim();
  if (!content || content === 'exit') break;
  const reply = await runAgent(history, content);
  console.log(`봇> ${reply}`);
  history.push({ role: 'user', content }, { role: 'assistant', content: reply });
}

readline.close();
