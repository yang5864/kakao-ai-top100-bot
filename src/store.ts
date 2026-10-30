import { Redis } from '@upstash/redis';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Store {
  /** 처음 보는 메시지 id면 true. 웹훅 재전송으로 답변이 두 번 나가는 것을 막습니다. */
  claim(id: string): Promise<boolean>;
  history(key: string): Promise<ChatMessage[]>;
  append(key: string, messages: ChatMessage[]): Promise<void>;
  clear(key: string): Promise<void>;
}

const MAX_MESSAGES = 20;
const HISTORY_TTL = 60 * 60 * 24 * 7;
const CLAIM_TTL = 60 * 10;

function redisStore(redis: Redis): Store {
  return {
    async claim(id) {
      return (await redis.set(`seen:${id}`, 1, { nx: true, ex: CLAIM_TTL })) === 'OK';
    },
    history(key) {
      return redis.lrange<ChatMessage>(`chat:${key}`, 0, -1);
    },
    async append(key, messages) {
      await redis
        .pipeline()
        .rpush(`chat:${key}`, ...messages)
        .ltrim(`chat:${key}`, -MAX_MESSAGES, -1)
        .expire(`chat:${key}`, HISTORY_TTL)
        .exec();
    },
    async clear(key) {
      await redis.del(`chat:${key}`);
    },
  };
}

// 로컬 개발용입니다. 배포 환경에서는 인스턴스가 바뀌면 대화가 사라집니다.
function memoryStore(): Store {
  const seen = new Set<string>();
  const chats = new Map<string, ChatMessage[]>();
  return {
    async claim(id) {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    },
    async history(key) {
      return chats.get(key) ?? [];
    },
    async append(key, messages) {
      chats.set(key, [...(chats.get(key) ?? []), ...messages].slice(-MAX_MESSAGES));
    },
    async clear(key) {
      chats.delete(key);
    },
  };
}

let store: Store | undefined;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    store = redisStore(new Redis({ url, token }));
  } else {
    if (process.env.VERCEL) console.warn('Redis가 연결되지 않아 대화 기록이 유지되지 않습니다.');
    store = memoryStore();
  }
  return store;
}
