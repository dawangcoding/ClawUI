// ── Chat 消息类型定义 ──

export interface ChatMessageUsage {
   inputTokens?: number
   outputTokens?: number
   cacheReadTokens?: number
   totalTokens?: number
}

export interface ToolCallItem {
   id: string
   name: string
   input: unknown
   inputText: string
   result?: unknown
   resultText?: string
   status: 'pending' | 'completed' | 'error'
}

export interface ModelChoice {
   id: string
   name: string
   provider: string
   contextWindow?: number
   reasoning?: boolean
}

export interface ChatMessageItem {
   id: string
   role: string
   content: string
   images?: string[]
   thinking?: string
   toolCalls?: ToolCallItem[]
   timestamp: number
   status?: 'sending' | 'streaming' | 'done' | 'error'
   usage?: ChatMessageUsage
   senderName?: string
   senderEmoji?: string
   model?: string
}
