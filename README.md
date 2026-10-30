# AI_TOP_100 카카오톡 봇

카카오톡 봇 웹훅을 받아 OpenAI 에이전트로 답변하는 서버입니다. Vercel(서울 리전)에 배포합니다.

```
[카카오톡 봇]
     │ (1) MESSAGE_CREATE 이벤트 (웹훅)
     ▼
[Vercel 함수] ── (2) 204 즉시 응답 (1초 제한)
     │
     │ (3) 백그라운드에서 에이전트 실행 ──► [OpenAI: gpt-6-luna]
     │                                      └ think_deeply 도구 ──► [gpt-6.1-sol]
     │
     │ (4) POST /v1/bot/callback (SkillResponse + 콜백 토큰)
     ▼
[사용자 카카오톡]
```

웹훅 응답 본문으로 답장하는 구조가 아닙니다. 1초 안에 2xx를 돌려준 뒤 콜백 API로 따로 답장합니다.
콜백 토큰은 5분간 한 번만 쓸 수 있습니다.

## 대회 당일 수정할 파일

| 파일 | 내용 |
|------|------|
| [src/agent/prompt.ts](src/agent/prompt.ts) | 시스템 프롬프트. 인터뷰 내용을 여기에 반영 |
| [src/agent/tools.ts](src/agent/tools.ts) | 에이전트 도구. `tools` 배열에 추가 |
| [src/kakao/skill.ts](src/kakao/skill.ts) | 말풍선 형식. 카드나 퀵리플라이가 필요할 때 |

## 처음 설정

```bash
npm install
```

```bash
cp .env.example .env.local
```

`.env.local`에 `OPENAI_API_KEY`와 `BOT_TOKEN`을 넣고 확인합니다. 메시지는 보내지 않습니다.

```bash
npm run verify
```

## 명령어

| 명령어 | 용도 |
|--------|------|
| `npm run chat` | 카카오 없이 터미널에서 에이전트와 대화 (프롬프트 조정용) |
| `npm run dev` | 로컬 서버 실행 (`http://localhost:3000/webhook`) |
| `npm run verify` | 봇 토큰, OpenAI 키, 두 모델 호출 확인 |
| `npm test` | 테스트 실행 |

카카오톡에서 `/reset`을 보내면 그 대화의 기록이 지워집니다.

## 배포

```bash
vercel link --yes
```

```bash
npx vercel@latest integration add upstash/upstash-kv --non-interactive --no-claim --no-env-pull --name kakao-bot-redis
```

아래 값을 프로덕션 환경변수로 등록합니다. 명령을 실행하면 값을 입력하라고 나옵니다.

```bash
vercel env add OPENAI_API_KEY production
```

```bash
vercel env add BOT_TOKEN production
```

```bash
vercel env add WEBHOOK_SECRET production
```

```bash
vercel deploy --prod
```

카카오 콘솔의 웹훅 URL에 `https://<프로덕션 도메인>/webhook`을 등록하고, 커스텀 헤더를
`X-Webhook-Secret: <WEBHOOK_SECRET 값>`으로 설정합니다. 헤더 이름을 바꾸면 `WEBHOOK_HEADER_NAME`도 같이 바꿉니다.

웹훅 URL을 등록한 앱은 게이트웨이(WebSocket)에 연결할 수 없습니다.

## 공식 가이드 확인 결과

공식 문서는 참가 계정으로 로그인해야 볼 수 있습니다. 아래 항목은 문서와 실제 호출로 확인했습니다.

- [x] 인증 헤더가 `Authorization: KakaoAK <봇 토큰>`인지 (`npm run verify`로 확인 완료)
- [x] 웹훅 본문이 `{ "op": 0, "t": "MESSAGE_CREATE", "d": { ... } }` 형식인지 (공식 문서 확인)
- [x] 콜백 주소가 `POST https://kapi.kakao.com/v1/bot/callback`이고 헤더가 `X-Bot-Callback-Token`인지 (가짜 토큰으로 `-881` 응답 확인)
- [x] 웹훅 등록 때 URL 검증 요청이 따로 오는지 (공식 문서에 별도 검증 요청 없음)

봇은 카카오톡에서 이름이나 검색용 ID로 검색하거나, 채팅방 메뉴(☰) > [챗봇 beta]에서 초대해 대화합니다.
나와의채팅과 비밀채팅은 지원하지 않습니다.

## 대회 일정 체크리스트

제출 전

- [ ] 실제 카카오톡에서 메시지를 보내 답변이 오는지 확인
- [ ] 두 번째 메시지에서 이전 대화를 기억하는지 확인 (Redis 연결 확인)
- [ ] `vercel logs`로 오류와 `[openai]` 토큰 사용량 확인
- [ ] 제출물 정보 재확인 (결과물은 **1회만 제출**, 제출 후 수정 불가)
- [ ] **15:00 자동 마감** 전에 제출

제출 후

- [ ] **심사 기간(10/31 16:00 ~ 11/1 24:00)에는 봇과 배포 상태를 수정·삭제하지 않기**
- [ ] 심사 기간에 OpenAI 크레딧이 남아 있는지 확인. 소진되면 봇이 실패 안내만 보냅니다.
