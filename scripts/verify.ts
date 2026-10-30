// 키, 토큰, 모델이 실제로 동작하는지 확인합니다. 카카오 메시지는 보내지 않습니다.
import { complete } from '../src/agent/openai.js';
import { models } from '../src/config.js';
import { getCommands } from '../src/kakao/client.js';

const checks: [string, () => Promise<unknown>][] = [
  ['카카오 봇 토큰', getCommands],
  [`OpenAI ${models.default}`, () => complete({ model: models.default, messages: [{ role: 'user', content: '안녕' }] })],
  [`OpenAI ${models.smart}`, () => complete({ model: models.smart, messages: [{ role: 'user', content: '안녕' }] })],
];

let failed = false;
for (const [name, check] of checks) {
  try {
    await check();
    console.log(`OK    ${name}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(failed ? 1 : 0);
