// ── Assistant 身份默认值与规范化 ──
// 参考 openclaw/ui/src/ui/assistant-identity.ts
// 参考 openclaw/ui/src/ui/controllers/assistant-identity.ts

import { RPC } from './types/gateway-rpc'

const MAX_ASSISTANT_NAME = 50
const MAX_ASSISTANT_AVATAR = 200

export const DEFAULT_ASSISTANT_NAME = 'Assistant'
export const DEFAULT_ASSISTANT_AVATAR = 'A'

export interface AssistantIdentity {
   agentId?: string | null
   name: string
   avatar: string | null
}

function coerceIdentityValue(value: string | undefined, maxLength: number): string | undefined {
   if (typeof value !== 'string') return undefined
   const trimmed = value.trim()
   if (!trimmed) return undefined
   return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength)
}

export function normalizeAssistantIdentity(
   input?: Partial<AssistantIdentity> | null,
): AssistantIdentity {
   const name =
      coerceIdentityValue(input?.name ?? undefined, MAX_ASSISTANT_NAME) ?? DEFAULT_ASSISTANT_NAME
   const avatar = coerceIdentityValue(input?.avatar ?? undefined, MAX_ASSISTANT_AVATAR) ?? null
   const agentId =
      typeof input?.agentId === 'string' && input.agentId.trim() ? input.agentId.trim() : null
   return { agentId, name, avatar }
}

// ── 加载 Assistant 身份 ──

export interface LoadAssistantIdentityOptions {
   connected: boolean
   sessionKey: string
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>
}

/**
 * 从 Gateway 加载 Assistant 身份信息并规范化。
 * 模拟 openclaw/ui/src/ui/controllers/assistant-identity.ts 的 loadAssistantIdentity。
 * 返回规范化后的 AssistantIdentity，若未连接或请求失败则返回 null。
 */
export async function loadAssistantIdentity(
   opts: LoadAssistantIdentityOptions,
): Promise<AssistantIdentity | null> {
   if (!opts.connected) return null
   const sessionKey = opts.sessionKey.trim()
   const params = sessionKey ? { sessionKey } : {}
   try {
      const res = await opts.rpc<Record<string, unknown> | null>(RPC.AGENTS_IDENTITY, params)
      if (!res) return null
      return normalizeAssistantIdentity(res as Partial<AssistantIdentity>)
   } catch {
      // 忽略错误，保留上次已知身份
      return null
   }
}
