/**
 * Session key 解析工具函数
 */

/**
 * 解析 agent 作用域的 session key，如 "agent:default:main" → { agentId: "default", rest: "main" }
 * 非 agent: 前缀返回 null
 */
export function parseAgentSessionKey(
   sessionKey: string | undefined,
): { agentId: string; rest: string } | null {
   const raw = (sessionKey ?? '').trim().toLowerCase()
   if (!raw) return null
   const parts = raw.split(':').filter(Boolean)
   if (parts.length < 3 || parts[0] !== 'agent') return null
   const agentId = parts[1]?.trim()
   const rest = parts.slice(2).join(':')
   if (!agentId || !rest) return null
   return { agentId, rest }
}

/**
 * 比较两个 sessionKey 是否指向同一个会话
 * 兼容 "main" 与 "agent:default:main" 这类缩写 vs 全称的情况
 */
export function isSameSessionKey(left: string | undefined, right: string | undefined): boolean {
   const a = (left ?? '').trim().toLowerCase()
   const b = (right ?? '').trim().toLowerCase()
   if (!a || !b) return false
   if (a === b) return true
   const pa = parseAgentSessionKey(a)
   const pb = parseAgentSessionKey(b)
   if (pa && pb) return pa.agentId === pb.agentId && pa.rest === pb.rest
   if (pa) return pa.rest === b
   if (pb) return a === pb.rest
   return false
}

/**
 * 构建完整的 agent session key
 */
export function buildAgentSessionKey(agentId: string, rest: string): string {
   return `agent:${agentId}:${rest}`
}
