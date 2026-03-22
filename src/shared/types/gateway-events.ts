// ── Gateway 事件类型定义 ──

import type { StateVersion } from './gateway-protocol'

// 标准事件帧 (主进程转发到渲染进程的格式)
export interface GatewayEventFrame {
   event: string
   payload?: unknown
   seq?: number
   stateVersion?: StateVersion
}

// ── Chat 事件 ──

export type ChatEventState = 'delta' | 'final' | 'aborted' | 'error'

export interface ChatEventPayload {
   runId: string
   sessionKey: string
   seq: number
   state: ChatEventState
   message?: ChatMessage
   errorMessage?: string
   usage?: ChatUsage
   stopReason?: string
}

export interface ChatMessage {
   role?: string
   content?: ChatContentBlock[]
   thinking?: string
   metadata?: Record<string, unknown>
}

export type ChatContentBlock =
   | { type: 'text'; text: string }
   | { type: 'thinking'; thinking: string }
   | { type: 'image'; url: string }
   | { type: 'image'; source: { type: 'base64'; data: string; media_type: string } }
   | { type: 'image_url'; image_url: { url: string } }
   | { type: 'tool_use'; id: string; name: string; input: unknown }
   | { type: 'tool_result'; tool_use_id: string; content: unknown }

export interface ChatUsage {
   inputTokens?: number
   outputTokens?: number
   cacheCreationTokens?: number
   cacheReadTokens?: number
   totalTokens?: number
}

// ── Agent 事件 ──

export interface AgentEventPayload {
   runId: string
   seq: number
   stream: string
   ts: number
   sessionKey?: string
   data: Record<string, unknown>
}

// ── Tick 事件 ──

export interface TickEventPayload {
   ts: number
}

// ── Shutdown 事件 ──

export interface ShutdownEventPayload {
   reason?: string
   expectedRestartMs?: number
}

// ── Exec Approval 事件 ──

export interface ExecApprovalRequestedPayload {
   id: string
   request: {
      command: string
      cwd?: string | null
      host?: string | null
      security?: string | null
      ask?: string | null
      agentId?: string | null
      resolvedPath?: string | null
      sessionKey?: string | null
   }
   createdAtMs: number
   expiresAtMs: number
}

export interface ExecApprovalResolvedPayload {
   id: string
   decision?: string | null
   resolvedBy?: string | null
   ts?: number | null
}

// ── Node 事件 ──

export interface NodePairRequestedPayload {
   id: string
   deviceId: string
   publicKey: string
   displayName?: string
   platform?: string
   requestedAt: number
}

export interface NodePairResolvedPayload {
   id: string
   approved: boolean
}

export interface NodeInvokeRequestPayload {
   id: string
   nodeId: string
   command: string
   params?: unknown
   timeoutMs?: number
}

// ── Device 事件 ──

export interface DevicePairRequestedPayload {
   id: string
   deviceId: string
   displayName?: string
   platform?: string
}

export interface DevicePairResolvedPayload {
   id: string
   approved: boolean
}

// ── Update Available 事件 ──

export interface UpdateAvailablePayload {
   currentVersion: string
   latestVersion: string
   channel?: string
}

// ── 连接错误事件 ──

export interface ConnectionErrorPayload {
   code: number
   reason: string
   error?: import('./gateway-protocol').GatewayErrorInfo
   formattedMessage: string
}

// ── 事件序列 Gap ──

export interface EventGapPayload {
   expected: number
   received: number
}

// ── 事件名常量 ──

export const GATEWAY_EVENTS = {
   TICK: 'tick',
   SHUTDOWN: 'shutdown',
   CHAT: 'chat',
   AGENT_EVENT: 'agent',
   EXEC_APPROVAL_REQUESTED: 'exec-approval-requested',
   EXEC_APPROVAL_RESOLVED: 'exec-approval-resolved',
   NODE_PAIR_REQUESTED: 'node-pair-requested',
   NODE_PAIR_RESOLVED: 'node-pair-resolved',
   NODE_INVOKE_REQUEST: 'node-invoke-request',
   DEVICE_PAIR_REQUESTED: 'device-pair-requested',
   DEVICE_PAIR_RESOLVED: 'device-pair-resolved',
   UPDATE_AVAILABLE: 'update-available',
   SYSTEM_PRESENCE: 'system-presence',
   CONNECTION_ERROR: 'connection-error',
   EVENT_GAP: 'event-gap',
} as const
