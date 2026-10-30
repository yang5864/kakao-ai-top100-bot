export interface MessageData {
  id: string;
  content: string;
  timestamp: string;
  isChannelChatroom: boolean;
  botGroupKey: string;
  botUserKey: string;
  callbackToken?: string;
}

export interface Frame {
  op: number;
  t?: string;
  d?: unknown;
}

// id는 64비트 정수라서 JSON.parse 전에 문자열로 바꿔야 정밀도가 유지됩니다.
const BIG_ID = /"id"\s*:\s*(-?\d{16,})/g;

export function parseFrame(body: string): Frame | null {
  try {
    const frame = JSON.parse(body.replace(BIG_ID, '"id":"$1"')) as Frame;
    return typeof frame?.op === 'number' ? frame : null;
  } catch {
    return null;
  }
}

export function messageData(frame: Frame): MessageData | null {
  if (frame.op !== 0 || frame.t !== 'MESSAGE_CREATE') return null;
  const data = frame.d as MessageData | undefined;
  if (typeof data?.content !== 'string') return null;
  return { ...data, id: String(data.id) };
}
