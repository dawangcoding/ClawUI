import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Layout, Typography, Space } from 'antd'
import { useGateway } from '../../contexts/GatewayContext'
import { useSnapshot } from '../../contexts/SnapshotContext'
import { useGatewayEvent } from '../../hooks/useGatewayEvent'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import type { ChatEventPayload, ChatContentBlock } from '../../../shared/types/gateway-events'
import type {
   GatewaySessionRow,
   SessionsListResult,
   AgentsListResult,
} from '../../../shared/types/gateway-protocol'
import { RPC } from '../../../shared/types/gateway-rpc'
import type { ChatMessageItem, ChatMessageUsage } from './types'
import {
   DEFAULT_ASSISTANT_NAME,
   loadAssistantIdentity,
} from '../../../shared/assistant-identity'
import type { AssistantIdentity } from '../../../shared/assistant-identity'
import { extractToolCalls, formatToolResultContent } from './utils/extractToolCalls'
import { parseAgentSessionKey, isSameSessionKey } from './utils/sessionKeyUtils'
import MessageRow from './components/MessageRow'
import ChatInputBar from './components/ChatInputBar'
import AgentSessionSelector from './components/AgentSessionSelector'
import { DEFAULT_THINKING_LEVEL } from './hooks/useThinkingLevel'
import { createLogger } from '../../../shared/logger'
import thinkingApng from '../../assets/dialog/thinking.apng'

const log = createLogger('ChatPage')

const { Header, Content } = Layout
const { Text } = Typography

function extractText(content?: ChatContentBlock[] | string): string {
   if (!content) return ''
   if (typeof content === 'string') return content
   if (!Array.isArray(content)) return ''
   return content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
}

/** 格式化 agent-event 中的工具结果（兼容 { content: [...] } 包装格式） */
function formatAgentToolResult(result: unknown): string {
   log.debug('formatAgentToolResult input: %o', result)
   if (!result || typeof result !== 'object') return formatToolResultContent(result)
   const record = result as Record<string, unknown>
   if (Array.isArray(record.content)) {
      const formatted = formatToolResultContent(record.content)
      log.debug('formatAgentToolResult from content array: %s', formatted)
      return formatted
   }
   const formatted = formatToolResultContent(result)
   log.debug('formatAgentToolResult direct: %s', formatted)
   return formatted
}

/** 从 content 数组中提取 thinking 内容块（历史消息可能以 {type:"thinking"} 存储） */
function extractThinking(content: unknown): string | undefined {
   if (!Array.isArray(content)) return undefined
   const parts: string[] = []
   for (const block of content) {
      if (
         typeof block === 'object' &&
         block !== null &&
         'type' in block &&
         (block as Record<string, unknown>).type === 'thinking' &&
         'thinking' in block &&
         typeof (block as Record<string, unknown>).thinking === 'string'
      ) {
         parts.push((block as Record<string, unknown>).thinking as string)
      }
   }
   return parts.length > 0 ? parts.join('\n') : undefined
}

/** 从历史消息中提取 usage（兼容不同字段名） */
function normalizeUsage(raw: unknown): ChatMessageUsage | undefined {
   if (!raw || typeof raw !== 'object') return undefined
   const u = raw as Record<string, unknown>
   const inputTokens = (u.inputTokens ?? u.input) as number | undefined
   const outputTokens = (u.outputTokens ?? u.output) as number | undefined
   const cacheReadTokens = (u.cacheReadTokens ?? u.cacheRead) as number | undefined
   const totalTokens = u.totalTokens as number | undefined
   if (
      inputTokens === undefined &&
      outputTokens === undefined &&
      totalTokens === undefined
   ) {
      return undefined
   }
   return { inputTokens, outputTokens, cacheReadTokens, totalTokens }
}

export default function ChatPage() {
   const { rpc, connected } = useGateway()
   const { sessionDefaults } = useSnapshot()
   const [sessionKey, setSessionKey] = useLocalStorage('clawui.sessionKey', 'main')
   const [messages, setMessages] = useState<ChatMessageItem[]>([])
   const [inputValue, setInputValue] = useState('')
   const [sending, setSending] = useState(false)
   const [streaming, setStreaming] = useState(false)
   const [activeRunId, setActiveRunId] = useState<string | null>(null)
   const [generationPhase, setGenerationPhase] = useState<'idle' | 'thinking' | 'generating'>(
      'idle',
   )
   const messagesEndRef = useRef<HTMLDivElement>(null)
   const messagesContainerRef = useRef<HTMLDivElement>(null)
   const activeRunIdRef = useRef<string | null>(null)
   const streamingContentRef = useRef<string>('')
   const streamingThinkingRef = useRef<string | undefined>(undefined)
   const [streamTick, setStreamTick] = useState(0)
   const rafIdRef = useRef<number>(0)
   const isInitialLoadRef = useRef<boolean>(true)

   // ── 会话信息 & Agent 身份 ──
   const [sessionInfo, setSessionInfo] = useState<GatewaySessionRow | null>(null)
   const [assistantIdentity, setAssistantIdentity] = useState<AssistantIdentity | null>(null)
   const sessionInfoRef = useRef<GatewaySessionRow | null>(null)
   const assistantIdentityRef = useRef<AssistantIdentity | null>(null)

   // 获取会话信息（通过 sessions.list 获取完整会话条目，包含已解析的 model/modelProvider）
   const fetchSessionInfo = useCallback(async () => {
      if (!connected) return
      try {
         log.log('Fetching session info via sessions.list: key=%s', sessionKey)

         // 解析 agentId 用于过滤
         const parsed = parseAgentSessionKey(sessionKey)
         const listAgentId = parsed?.agentId ?? undefined

         const result = await rpc<SessionsListResult>(RPC.SESSIONS_LIST, {
            includeGlobal: false,
            includeUnknown: false,
            agentId: listAgentId,
         })

         if (!result?.sessions) return

         // 查找匹配当前 sessionKey 的会话条目
         const normalizeMatchKey = (key: string) => parseAgentSessionKey(key)?.rest ?? key
         const currentMatchKey = normalizeMatchKey(sessionKey)
         const entry = result.sessions.find((row) => {
            if (row.key === sessionKey) return true
            return normalizeMatchKey(row.key) === currentMatchKey
         })

         if (entry) {
            log.log(
               'Session info loaded: model=%s, modelProvider=%s, contextTokens=%s, verboseLevel=%s',
               entry.model,
               entry.modelProvider,
               entry.contextTokens,
               entry.verboseLevel,
            )
            setSessionInfo(entry)
            sessionInfoRef.current = entry

            // 确保 verboseLevel 为 full，以便接收工具调用事件并显示输出
            const verbose = entry.verboseLevel
            if (verbose !== 'full') {
               log.log(
                  'Enabling verbose level for tool events with output: full (current=%s)',
                  verbose,
               )
               await rpc(RPC.SESSIONS_PATCH, { key: sessionKey, verboseLevel: 'full' })
               log.log('verboseLevel set to full')
            }

            // 确保 thinkingLevel 为默认值（medium），便于开箱即用
            const thinkLevel = entry.thinkingLevel
            if (thinkLevel !== DEFAULT_THINKING_LEVEL) {
               log.log(
                  'Setting default thinking level: %s -> %s',
                  thinkLevel ?? '(unset)',
                  DEFAULT_THINKING_LEVEL,
               )
               await rpc(RPC.SESSIONS_PATCH, {
                  key: sessionKey,
                  thinkingLevel: DEFAULT_THINKING_LEVEL,
               })
               log.log('thinkingLevel set to %s', DEFAULT_THINKING_LEVEL)
            }

            // 确保 reasoningLevel 为 stream，以获取流式推理输出
            const reasoning = entry.reasoningLevel
            if (reasoning !== 'stream') {
               log.log(
                  'Setting default reasoning level: %s -> stream',
                  reasoning ?? '(unset)',
               )
               await rpc(RPC.SESSIONS_PATCH, {
                  key: sessionKey,
                  reasoningLevel: 'stream',
               })
               log.log('reasoningLevel set to stream')
            }
         }
      } catch (err) {
         log.error('Failed to fetch session info:', err)
      }
   }, [connected, sessionKey, rpc])

   // 加载 Assistant 身份
   const fetchAssistantIdentity = useCallback(async () => {
      log.log('Loading assistant identity: sessionKey=%s', sessionKey)
      const identity = await loadAssistantIdentity({ connected, sessionKey, rpc })
      if (identity) {
         log.log(
            'Assistant identity loaded: name=%s, agentId=%s',
            identity.name,
            identity.agentId,
         )
         setAssistantIdentity(identity)
         assistantIdentityRef.current = identity
      }
   }, [connected, sessionKey, rpc])

   useEffect(() => {
      if (connected) {
         log.log('Connected, fetching session info and assistant identity...')
         fetchSessionInfo()
         fetchAssistantIdentity()
      } else {
         log.log('Disconnected, clearing session state')
         setSessionInfo(null)
         setAssistantIdentity(null)
         sessionInfoRef.current = null
         assistantIdentityRef.current = null
      }
   }, [connected, sessionKey, fetchSessionInfo, fetchAssistantIdentity])

   // 派生 sender 名称：优先使用已加载的 identity，其次回退到 sessionInfo.displayName
   const resolvedSenderName =
      assistantIdentity?.name ?? sessionInfo?.displayName ?? DEFAULT_ASSISTANT_NAME

   // 加载历史
   useEffect(() => {
      if (!connected) return
      isInitialLoadRef.current = true
      log.log('Loading chat history: sessionKey=%s', sessionKey)
      rpc<{ messages?: unknown[] }>(RPC.CHAT_HISTORY, {
         sessionKey,
         limit: 100,
      })
         .then((result) => {
            if (result?.messages) {
               log.log('History loaded: %d messages', result.messages.length)
               // Pass 1: 构建消息列表，跳过 toolResult 消息
               const items: ChatMessageItem[] = []
               const rawMessages = result.messages as Array<Record<string, unknown>>
               for (let i = 0; i < rawMessages.length; i++) {
                  const m = rawMessages[i]
                  const role = (m.role as string) ?? 'unknown'
                  const content = m.content as ChatContentBlock[] | string | undefined

                  // toolResult 消息合并到前一个 assistant 消息的 toolCalls
                  if (role === 'toolResult' || role === 'tool') {
                     // 兼容多种字段名: toolCallId / tool_call_id / tool_use_id
                     const toolCallId =
                        (m.toolCallId as string | undefined) ??
                        (m.tool_call_id as string | undefined) ??
                        (m.tool_use_id as string | undefined)
                     // 从后向前查找有 toolCalls 的 assistant 消息
                     for (let j = items.length - 1; j >= 0; j--) {
                        if (items[j].role === 'assistant' && items[j].toolCalls?.length) {
                           const tc = items[j].toolCalls!.find((t) => t.id === toolCallId)
                           if (tc) {
                              tc.result = content
                              tc.resultText = formatToolResultContent(content)
                              tc.status = m.isError ? 'error' : 'completed'
                           }
                           break
                        }
                     }
                     continue
                  }

                  items.push({
                     id: `history-${i}`,
                     role,
                     content: extractText(content),
                     thinking:
                        extractThinking(content) ?? (m.thinking as string | undefined),
                     toolCalls: extractToolCalls(content),
                     timestamp:
                        typeof m.timestamp === 'number' && Number.isFinite(m.timestamp)
                           ? (m.timestamp as number)
                           : Date.now(),
                     status: 'done' as const,
                     usage: normalizeUsage(m.usage),
                  })
               }
               setMessages(items)
            } else {
               log.log('History loaded: empty')
            }
         })
         .catch((err) => {
            log.error('Failed to load history:', err)
         })
   }, [connected, sessionKey, rpc])

   // 清理流式状态的公共函数
   const clearStreamingState = useCallback(() => {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
      streamingContentRef.current = ''
      streamingThinkingRef.current = undefined
      setStreamTick(0)
      setStreaming(false)
      setSending(false)
      setActiveRunId(null)
      activeRunIdRef.current = null
      setGenerationPhase('idle')
   }, [])

   // 组件卸载时取消 rAF（保底清理）
   useEffect(() => () => cancelAnimationFrame(rafIdRef.current), [])

   // 回填 usage：Gateway final 事件不携带 usage，需从历史消息中获取
   const backfillUsageFromHistory = useCallback(
      async (runId: string) => {
         if (!connected) return
         try {
            log.log('Backfilling usage from history: runId=%s', runId)
            const result = await rpc<{ messages?: unknown[] }>(RPC.CHAT_HISTORY, {
               sessionKey,
               limit: 5,
            })
            if (!result?.messages?.length) return
            const rawMessages = result.messages as Array<Record<string, unknown>>
            // 从后向前查找最后一条 assistant 消息的 usage
            for (let i = rawMessages.length - 1; i >= 0; i--) {
               const m = rawMessages[i]
               if (m.role === 'assistant') {
                  const usage = normalizeUsage(m.usage)
                  if (usage) {
                     log.log(
                        'Backfill usage found: in=%s, out=%s',
                        usage.inputTokens,
                        usage.outputTokens,
                     )
                     setMessages((prev) =>
                        prev.map((msg) =>
                           msg.id === runId && !msg.usage ? { ...msg, usage } : msg,
                        ),
                     )
                  }
                  break
               }
            }
         } catch (err) {
            log.error('Failed to backfill usage from history:', err)
         }
      },
      [connected, sessionKey, rpc],
   )

   // 确保指定 runId 的 assistant 消息气泡已创建
   const ensureAssistantMessage = useCallback((runId: string) => {
      if (activeRunIdRef.current === runId) return
      log.log('Creating assistant message bubble: runId=%s', runId)
      setActiveRunId(runId)
      activeRunIdRef.current = runId
      setStreaming(true)
      streamingContentRef.current = ''
      streamingThinkingRef.current = undefined
      setMessages((prev) => {
         if (prev.some((m) => m.id === runId)) return prev
         return [
            ...prev,
            {
               id: runId,
               role: 'assistant',
               content: '',
               timestamp: Date.now(),
               status: 'streaming' as const,
               senderName:
                  assistantIdentityRef.current?.name ??
                  sessionInfoRef.current?.displayName ??
                  DEFAULT_ASSISTANT_NAME,
               senderEmoji: undefined,
               model: sessionInfoRef.current?.model,
            },
         ]
      })
   }, [])

   // 监听 chat 事件（协议仅定义 delta / final / aborted / error）
   useGatewayEvent('chat', (payload) => {
      const evt = payload as ChatEventPayload
      if (!isSameSessionKey(evt.sessionKey, sessionKey)) {
         log.debug(
            'Chat event ignored: sessionKey mismatch (event=%s, current=%s)',
            evt.sessionKey,
            sessionKey,
         )
         return
      }

      log.log(
         'Chat event: state=%s, runId=%s, sessionKey=%s',
         evt.state,
         evt.runId,
         evt.sessionKey,
      )

      switch (evt.state) {
         case 'delta': {
            ensureAssistantMessage(evt.runId)
            const deltaText = extractText(evt.message?.content as ChatContentBlock[] | string)
            const deltaThinking =
               extractThinking(evt.message?.content as ChatContentBlock[] | string) ??
               evt.message?.thinking
            if (deltaThinking) {
               streamingThinkingRef.current = deltaThinking
            }
            if (deltaText) {
               // delta 事件携带的是累积快照（完整文本），直接替换而非追加
               // 参考 openclaw/ui: state.chatStream = next
               streamingContentRef.current = deltaText
            }
            if (deltaText || deltaThinking) {
               log.debug(
                  'Delta: contentLen=%d, hasThinking=%s',
                  streamingContentRef.current.length,
                  !!streamingThinkingRef.current,
               )
               // rAF 节流：同一帧内多个 delta 只触发一次 re-render
               if (!rafIdRef.current) {
                  rafIdRef.current = requestAnimationFrame(() => {
                     setStreamTick((t) => t + 1)
                     rafIdRef.current = 0
                  })
               }
            }
            break
         }

         case 'final': {
            ensureAssistantMessage(evt.runId)
            const finalText = extractText(evt.message?.content as ChatContentBlock[] | string)
            const thinkingText = evt.message?.thinking
            const contentToolCalls = extractToolCalls(evt.message?.content as ChatContentBlock[] | string | undefined)
            // usage 可能在顶层 evt.usage 或嵌套在 evt.message.usage 中
            // Gateway 实际实现将 usage 放在 message 内部
            const rawUsage =
               evt.usage ??
               (evt.message as Record<string, unknown> | undefined)?.usage
            const usage = normalizeUsage(rawUsage)
            log.log(
               'Final: runId=%s, contentLen=%d, hasThinking=%s, toolCalls=%d, usage=%s',
               evt.runId,
               finalText.length,
               !!thinkingText,
               contentToolCalls.length,
               usage ? `in=${usage.inputTokens},out=${usage.outputTokens}` : 'none',
            )
            setMessages((prev) =>
               prev.map((m) => {
                  if (m.id !== evt.runId) return m
                  // 合并工具调用：agent 事件已填充结果的优先，final content 中的作为补充
                  // final message 的 content 通常只有 tool_use（无 tool_result），
                  // 而 agent 事件提供的 toolCalls 包含实际执行结果
                  const existingToolCalls = m.toolCalls
                  let mergedToolCalls = existingToolCalls
                  if (contentToolCalls.length > 0) {
                     if (existingToolCalls?.length) {
                        // 逐个合并：已有结果的保留，新发现的补充
                        const existingById = new Map(existingToolCalls.map((tc) => [tc.id, tc]))
                        mergedToolCalls = contentToolCalls.map((tc) => {
                           const existing = existingById.get(tc.id)
                           // agent 事件已填充了结果，优先使用
                           if (existing && existing.status !== 'pending') return existing
                           return tc
                        })
                     } else {
                        mergedToolCalls = contentToolCalls
                     }
                  }
                  return {
                     ...m,
                     content: finalText || streamingContentRef.current,
                     thinking: thinkingText ?? streamingThinkingRef.current ?? m.thinking,
                     toolCalls: mergedToolCalls,
                     status: 'done' as const,
                     usage,
                  }
               }),
            )
            clearStreamingState()
            // 刷新会话信息以更新上下文占用量
            fetchSessionInfo()
            // Gateway final 事件通常不携带 usage，从历史消息中回填
            if (!usage) {
               backfillUsageFromHistory(evt.runId)
            }
            break
         }

         case 'aborted':
            log.log('Aborted: runId=%s, contentLen=%d', evt.runId, streamingContentRef.current.length)
            setMessages((prev) =>
               prev.map((m) =>
                  m.id === evt.runId
                     ? {
                          ...m,
                          content: streamingContentRef.current || m.content,
                          thinking: streamingThinkingRef.current ?? m.thinking,
                          status: 'done' as const,
                       }
                     : m,
               ),
            )
            clearStreamingState()
            break

         case 'error':
            log.error(
               'Error: runId=%s, message=%s',
               evt.runId,
               evt.errorMessage,
            )
            ensureAssistantMessage(evt.runId)
            setMessages((prev) =>
               prev.map((m) =>
                  m.id === evt.runId
                     ? {
                          ...m,
                          content: evt.errorMessage ?? '发生错误',
                          status: 'error' as const,
                       }
                     : m,
               ),
            )
            clearStreamingState()
            break
      }
   })

   // 监听 agent 事件（工具调用实时流）
   useGatewayEvent('agent', (payload) => {
      const evt = payload as {
         runId?: string
         stream?: string
         data?: Record<string, unknown>
      }
      log.log('Agent event: runId=%s, stream=%s, phase=%s', evt.runId, evt.stream, evt.data?.phase)
      if (!evt.runId) return

      // ── thinking 流：实时思考过程 ──
      if (evt.stream === 'thinking') {
         ensureAssistantMessage(evt.runId)
         const thinkingText = typeof evt.data?.text === 'string' ? evt.data.text : undefined
         if (thinkingText) {
            streamingThinkingRef.current = thinkingText
            // rAF 节流触发重渲染
            if (!rafIdRef.current) {
               rafIdRef.current = requestAnimationFrame(() => {
                  setStreamTick((t) => t + 1)
                  rafIdRef.current = 0
               })
            }
         }
         return
      }

      // ── lifecycle 流：agent 生命周期事件 ──
      if (evt.stream === 'lifecycle') {
         const phase = String(evt.data?.phase ?? '')
         if (phase === 'start') {
            log.log('Agent lifecycle start: runId=%s', evt.runId)
            setGenerationPhase('generating')
         }
         return
      }

      if (evt.stream !== 'tool') return

      const data = evt.data ?? {}
      const phase = String(data.phase ?? '')
      const toolCallId = String(data.toolCallId ?? '')
      log.log('Tool event: phase=%s, toolCallId=%s', phase, toolCallId)
      if (!toolCallId) return

      const toolName = String(data.name ?? 'tool')

      // 确保 assistant 消息已创建（tool 事件可能先于 delta 到达）
      ensureAssistantMessage(evt.runId)

      setMessages((prev) => {
         // 查找匹配 runId 的 assistant 消息
         const msgIndex = prev.findIndex((m) => m.id === evt.runId && m.role === 'assistant')
         if (msgIndex === -1) {
            log.warn('Tool event: no matching assistant message for runId=%s', evt.runId)
            return prev
         }

         const msg = prev[msgIndex]
         const toolCalls = [...(msg.toolCalls ?? [])]

         if (phase === 'start') {
            // 避免重复添加
            if (toolCalls.some((tc) => tc.id === toolCallId)) return prev
            let inputText = ''
            try {
               inputText = data.args ? JSON.stringify(data.args, null, 2) : ''
            } catch {
               inputText = String(data.args ?? '')
            }
            log.log('Tool start: id=%s, name=%s, args=%o', toolCallId, toolName, data.args)
            toolCalls.push({
               id: toolCallId,
               name: toolName,
               input: data.args,
               inputText,
               status: 'pending',
            })
         } else if (phase === 'result') {
            const idx = toolCalls.findIndex((tc) => tc.id === toolCallId)
            log.log('Tool result: id=%s, idx=%d, result=%o, isError=%s', toolCallId, idx, data.result, data.isError)
            if (idx === -1) {
               log.warn('Tool result: toolCallId=%s not found in toolCalls', toolCallId)
               return prev
            }
            toolCalls[idx] = {
               ...toolCalls[idx],
               result: data.result,
               resultText: formatAgentToolResult(data.result),
               status: data.isError ? 'error' : 'completed',
            }
         } else {
            log.log('Tool event: unknown phase=%s', phase)
            return prev
         }

         const updated = [...prev]
         updated[msgIndex] = { ...msg, toolCalls }
         return updated
      })
   })

   // 历史加载时，在浏览器绘制前直接定位到底部，用户不会看到从顶部滚到底部的过程
   useLayoutEffect(() => {
      if (isInitialLoadRef.current && messages.length > 0) {
         const container = messagesContainerRef.current
         if (container) {
            container.scrollTop = container.scrollHeight
         }
         isInitialLoadRef.current = false
      }
   }, [messages])

   // 非初始加载时（新消息）- 平滑滚动到底部
   useEffect(() => {
      if (!isInitialLoadRef.current) {
         messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
   }, [messages])

   // 流式更新时 - 瞬时滚动（rAF 已节流，不会堆叠动画）
   useEffect(() => {
      if (streaming && streamTick > 0) {
         messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      }
   }, [streamTick, streaming])

   // 发送消息（支持附件）
   const handleSendWithAttachments = useCallback(async (text: string, attachments?: unknown[]) => {
      const hasAttachments = Array.isArray(attachments) && attachments.length > 0
      if ((!text && !hasAttachments) || !connected || sending) return

      // 斜杠命令处理
      if (text.startsWith('/')) {
         log.log('Slash command: %s', text)
         setInputValue('')
         await handleSlashCommand(text)
         return
      }

      log.log(
         'Sending message: sessionKey=%s, length=%d, attachments=%d, attachmentKeys=%s, contentLen=%d',
         sessionKey,
         text.length,
         attachments?.length ?? 0,
         hasAttachments ? Object.keys(attachments![0] as Record<string, unknown>).join(',') : 'none',
         hasAttachments
            ? ((attachments![0] as Record<string, unknown>).content as string)?.length ?? -1
            : 0,
      )

      const imageUrls = hasAttachments
         ? (attachments as Array<{ type: string; mimeType: string; content: string }>)
              .filter((a) => a.type === 'image' && a.content)
              .map((a) => `data:${a.mimeType};base64,${a.content}`)
         : []

      const userMsg: ChatMessageItem = {
         id: `user-${Date.now()}`,
         role: 'user',
         content: text,
         images: imageUrls.length > 0 ? imageUrls : undefined,
         timestamp: Date.now(),
         status: 'done',
      }
      setMessages((prev) => [...prev, userMsg])
      setInputValue('')
      setSending(true)

      try {
         const idempotencyKey = crypto.randomUUID()
         log.log('RPC chat.send: idempotencyKey=%s', idempotencyKey)
         await rpc(RPC.CHAT_SEND, {
            sessionKey,
            message: text,
            deliver: true,
            attachments: attachments?.length ? attachments : undefined,
            idempotencyKey,
         })
         log.log('chat.send success, waiting for streaming events...')
         setGenerationPhase('thinking')
      } catch (err) {
         log.error('chat.send failed:', err)
         setSending(false)
         setMessages((prev) => [
            ...prev,
            {
               id: `error-${Date.now()}`,
               role: 'system',
               content: `发送失败: ${err instanceof Error ? err.message : String(err)}`,
               timestamp: Date.now(),
               status: 'error',
            },
         ])
      }
   }, [connected, sending, sessionKey, rpc])

   // ── 辅助函数 ──

   const addSystemMessage = (content: string) => {
      setMessages((prev) => [
         ...prev,
         {
            id: `sys-${Date.now()}`,
            role: 'system',
            content,
            timestamp: Date.now(),
            status: 'done',
         },
      ])
   }

   const fmtTokens = (n: number): string => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
      if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
      return String(n)
   }

   /** 将命令作为普通消息发送给 Agent */
   const sendAsAgentMessage = async (text: string) => {
      const userMsg: ChatMessageItem = {
         id: `user-${Date.now()}`,
         role: 'user',
         content: text,
         timestamp: Date.now(),
         status: 'done',
      }
      setMessages((prev) => [...prev, userMsg])
      setInputValue('')
      setSending(true)
      try {
         const idempotencyKey = crypto.randomUUID()
         log.log('Forwarding command to agent: %s, idempotencyKey=%s', text, idempotencyKey)
         await rpc(RPC.CHAT_SEND, {
            sessionKey,
            message: text,
            deliver: true,
            idempotencyKey,
         })
         setGenerationPhase('thinking')
      } catch (err) {
         log.error('Failed to forward command to agent:', err)
         setSending(false)
         addSystemMessage(`命令发送失败: ${err instanceof Error ? err.message : String(err)}`)
      }
   }

   // 斜杠命令
   const handleSlashCommand = async (text: string) => {
      const parts = text.split(/\s+/)
      const cmd = parts[0].toLowerCase()
      const arg = parts.slice(1).join(' ')
      log.log('Executing slash command: cmd=%s, arg=%s', cmd, arg)

      try {
         switch (cmd) {
            // ── 会话命令 ──
            case '/new':
            case '/reset':
               log.log('Resetting session: reason=%s', cmd === '/new' ? 'new' : 'reset')
               await rpc(RPC.SESSIONS_RESET, {
                  key: sessionKey,
                  reason: cmd === '/new' ? 'new' : 'reset',
               })
               setMessages([])
               break
            case '/clear':
               log.log('Clearing local messages')
               setMessages([])
               break
            case '/stop':
               if (activeRunId) {
                  log.log('Aborting run: runId=%s', activeRunId)
                  await rpc(RPC.CHAT_ABORT, { sessionKey, runId: activeRunId })
               } else {
                  log.log('/stop: no active run to abort')
               }
               break
            case '/compact':
               log.log('Compacting session context: key=%s', sessionKey)
               await rpc(RPC.SESSIONS_COMPACT, { key: sessionKey })
               addSystemMessage('上下文压缩成功')
               fetchSessionInfo()
               break

            // ── 模型命令 ──
            case '/model':
               if (arg) {
                  log.log('Switching model: %s', arg)
                  await rpc(RPC.SESSIONS_PATCH, { key: sessionKey, model: arg })
                  addSystemMessage(`模型已切换为 ${arg}`)
                  fetchSessionInfo()
               } else {
                  const [sessions, models] = await Promise.all([
                     rpc<SessionsListResult>(RPC.SESSIONS_LIST, {}),
                     rpc<{ models: Array<{ id: string }> }>(RPC.MODELS_LIST, {}),
                  ])
                  const currentModel =
                     sessionInfo?.model || sessions?.defaults?.model || 'default'
                  const available = models?.models?.map((m) => m.id) ?? []
                  const lines = [`**当前模型:** \`${currentModel}\``]
                  if (available.length > 0) {
                     lines.push(
                        `**可用模型:** ${available
                           .slice(0, 10)
                           .map((m) => `\`${m}\``)
                           .join(', ')}${available.length > 10 ? ` +${available.length - 10} 更多` : ''}`,
                     )
                  }
                  addSystemMessage(lines.join('\n'))
               }
               break
            case '/think':
               if (arg) {
                  log.log('Setting thinking level: %s', arg)
                  await rpc(RPC.SESSIONS_PATCH, { key: sessionKey, thinkingLevel: arg })
                  addSystemMessage(`思考级别已设置为 ${arg}`)
               } else {
                  const level = sessionInfo?.thinkingLevel ?? 'off'
                  addSystemMessage(
                     `**当前思考级别:** ${level}\n可选值: off, low, medium, high`,
                  )
               }
               break
            case '/fast':
               if (!arg || arg === 'status') {
                  const mode = sessionInfo?.fastMode ? 'on' : 'off'
                  addSystemMessage(`**当前快速模式:** ${mode}\n可选值: on, off`)
               } else {
                  const on = arg !== 'off'
                  log.log('Setting fast mode: %s', on)
                  await rpc(RPC.SESSIONS_PATCH, { key: sessionKey, fastMode: on })
                  addSystemMessage(`快速模式 ${on ? '已开启' : '已关闭'}`)
               }
               break
            case '/verbose':
               if (arg) {
                  log.log('Setting verbose level: %s', arg)
                  await rpc(RPC.SESSIONS_PATCH, { key: sessionKey, verboseLevel: arg })
                  addSystemMessage(`冗长级别已设置为 ${arg}`)
               } else {
                  const level = sessionInfo?.verboseLevel ?? 'off'
                  addSystemMessage(
                     `**当前冗长级别:** ${level}\n可选值: on, off, full`,
                  )
               }
               break

            // ── 工具命令 ──
            case '/help': {
               const commands = [
                  ['会话', [
                     ['`/new`', '启动新会话'],
                     ['`/reset`', '重置当前会话'],
                     ['`/compact`', '压缩会话上下文'],
                     ['`/stop`', '停止当前运行'],
                     ['`/clear`', '清除聊天历史'],
                  ]],
                  ['模型', [
                     ['`/model <name>`', '显示或设置模型'],
                     ['`/think <level>`', '设置思考级别'],
                     ['`/verbose <on|off|full>`', '切换冗长模式'],
                     ['`/fast <on|off>`', '切换快速模式'],
                  ]],
                  ['工具', [
                     ['`/help`', '显示可用命令'],
                     ['`/status`', '显示会话状态 *(agent)*'],
                     ['`/export`', '导出会话为 Markdown'],
                     ['`/usage`', '显示令牌用量'],
                  ]],
                  ['Agent', [
                     ['`/agents`', '列出所有 Agent'],
                     ['`/kill <id|all>`', '中止子 Agent'],
                     ['`/skill <name>`', '运行 Skill *(agent)*'],
                     ['`/steer <id> <msg>`', '操纵子 Agent *(agent)*'],
                  ]],
               ] as const
               const lines = ['**可用命令**\n']
               for (const [category, cmds] of commands) {
                  lines.push(`**${category}**`)
                  for (const [name, desc] of cmds) {
                     lines.push(`${name} — ${desc}`)
                  }
                  lines.push('')
               }
               lines.push('输入 `/` 开头使用命令。')
               addSystemMessage(lines.join('\n'))
               break
            }
            case '/export': {
               log.log('Exporting session to Markdown')
               if (messages.length === 0) {
                  addSystemMessage('当前没有可导出的消息')
                  break
               }
               const mdLines: string[] = [`# 会话导出\n`, `会话: ${sessionKey}\n`]
               for (const msg of messages) {
                  const roleName =
                     msg.role === 'user'
                        ? '用户'
                        : msg.role === 'assistant'
                          ? (msg.senderName ?? '助手')
                          : msg.role === 'system'
                            ? '系统'
                            : msg.role
                  mdLines.push(`## ${roleName}\n`)
                  if (msg.content) {
                     mdLines.push(msg.content)
                     mdLines.push('')
                  }
                  if (msg.toolCalls?.length) {
                     for (const tc of msg.toolCalls) {
                        mdLines.push(`### 工具调用: ${tc.name}`)
                        if (tc.inputText) mdLines.push(`\`\`\`\n${tc.inputText}\n\`\`\``)
                        if (tc.resultText) mdLines.push(`**结果:**\n${tc.resultText}`)
                        mdLines.push('')
                     }
                  }
               }
               const mdContent = mdLines.join('\n')
               const blob = new Blob([mdContent], { type: 'text/markdown' })
               const url = URL.createObjectURL(blob)
               const a = document.createElement('a')
               a.href = url
               a.download = `session-${sessionKey}-${new Date().toISOString().slice(0, 10)}.md`
               a.click()
               URL.revokeObjectURL(url)
               addSystemMessage('会话已导出为 Markdown')
               break
            }
            case '/usage': {
               log.log('Showing token usage')
               await fetchSessionInfo()
               const info = sessionInfoRef.current
               if (!info) {
                  addSystemMessage('无法获取会话信息')
                  break
               }
               const input = info.inputTokens ?? 0
               const output = info.outputTokens ?? 0
               const total = info.totalTokens ?? input + output
               const ctx = info.contextTokens ?? 0
               const pct = ctx > 0 ? Math.round((input / ctx) * 100) : null
               const lines = [
                  '**会话用量**',
                  `输入: **${fmtTokens(input)}** tokens`,
                  `输出: **${fmtTokens(output)}** tokens`,
                  `总计: **${fmtTokens(total)}** tokens`,
               ]
               if (pct !== null) {
                  lines.push(`上下文: **${pct}%** / ${fmtTokens(ctx)}`)
               }
               if (info.model) {
                  lines.push(`模型: \`${info.model}\``)
               }
               addSystemMessage(lines.join('\n'))
               break
            }

            // ── Agent 命令 ──
            case '/agents': {
               log.log('Listing agents')
               const result = await rpc<AgentsListResult>(RPC.AGENTS_LIST, {})
               const agents = result?.agents ?? []
               if (agents.length === 0) {
                  addSystemMessage('未配置任何 Agent')
                  break
               }
               const lines = [`**Agent 列表** (${agents.length})\n`]
               for (const agent of agents) {
                  const isDefault = agent.id === result?.defaultId
                  const name = agent.identity?.name || agent.name || agent.id
                  const marker = isDefault ? ' *(默认)*' : ''
                  lines.push(`- \`${agent.id}\` — ${name}${marker}`)
               }
               addSystemMessage(lines.join('\n'))
               break
            }
            case '/kill': {
               const target = arg.trim()
               if (!target) {
                  addSystemMessage('用法: `/kill <id|all>`')
                  break
               }
               log.log('Kill sub-agents: target=%s', target)
               const sessions = await rpc<SessionsListResult>(RPC.SESSIONS_LIST, {})
               const allSessions = sessions?.sessions ?? []
               // 查找子 Agent 会话（包含 "subagent:" 的 key）
               const subSessions = allSessions.filter((s) => {
                  if (!s.key.includes('subagent:')) return false
                  if (target.toLowerCase() === 'all') return true
                  return (
                     s.key.toLowerCase().includes(target.toLowerCase()) ||
                     s.agentId?.toLowerCase() === target.toLowerCase()
                  )
               })
               if (subSessions.length === 0) {
                  addSystemMessage(
                     target.toLowerCase() === 'all'
                        ? '没有找到活跃的子 Agent 会话'
                        : `没有找到匹配 \`${target}\` 的子 Agent 会话`,
                  )
                  break
               }
               const results = await Promise.allSettled(
                  subSessions.map((s) =>
                     rpc<{ aborted?: boolean }>(RPC.CHAT_ABORT, { sessionKey: s.key }),
                  ),
               )
               const successCount = results.filter(
                  (r) =>
                     r.status === 'fulfilled' &&
                     (r.value as { aborted?: boolean })?.aborted !== false,
               ).length
               if (successCount === 0) {
                  addSystemMessage(
                     target.toLowerCase() === 'all'
                        ? '没有正在运行的子 Agent 可中止'
                        : `没有匹配 \`${target}\` 的运行中子 Agent`,
                  )
               } else {
                  addSystemMessage(`已中止 ${successCount} 个子 Agent 会话`)
               }
               break
            }

            // ── Agent 转发命令（发送给 Agent 处理） ──
            case '/status':
            case '/skill':
            case '/steer':
               await sendAsAgentMessage(text)
               break

            default:
               log.warn('Unknown command: %s', cmd)
               addSystemMessage(`未知命令: ${cmd}`)
         }
      } catch (err) {
         log.error('Slash command error: cmd=%s', cmd, err)
         addSystemMessage(`命令执行失败: ${err instanceof Error ? err.message : String(err)}`)
      }
   }

   // 中止
   const handleAbort = useCallback(async () => {
      if (activeRunId) {
         log.log('Aborting: runId=%s', activeRunId)
         try {
            await rpc(RPC.CHAT_ABORT, { sessionKey, runId: activeRunId })
            log.log('Abort request sent')
         } catch {}
      }
   }, [activeRunId, sessionKey, rpc])

   return (
      <Layout style={{ height: '100%' }}>
         <Header
            style={{
               background: 'transparent',
               padding: '0 16px',
               height: 48,
               lineHeight: '48px',
               display: 'flex',
               alignItems: 'center',
               borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
            }}
         >
            <Space align="center">
               <Text strong>对话</Text>
               <AgentSessionSelector
                  currentSessionKey={sessionKey}
                  onSessionChange={setSessionKey}
                  connected={connected}
                  rpc={rpc}
                  disabled={streaming}
               />
               {generationPhase === 'thinking' && (
                  <img
                     src={thinkingApng}
                     alt="思考中"
                     style={{ height: 24, verticalAlign: 'middle' }}
                  />
               )}
               {generationPhase === 'generating' && (
                  <svg
                     width="1em"
                     height="1em"
                     viewBox="0 0 1024 1024"
                     overflow="hidden"
                     fill="currentColor"
                     aria-hidden="true"
                     style={{
                        fontSize: 20,
                        verticalAlign: 'middle',
                        animation: 'spin 1s linear infinite',
                     }}
                  >
                     <path d="M628.7424 669.184a40.416 40.416 0 0 0 11.8496 28.5888l85.7472 85.7472a40.4256 40.4256 0 0 0 68.1856-17.8112 40.4224 40.4224 0 0 0-11.0048-39.3152l-85.6928-85.8016a40.416 40.416 0 0 0-57.2352 0 40.416 40.416 0 0 0-11.8496 28.592zM240.48 240.48c-15.7632 15.7792-15.7632 41.344 0 57.1264l85.6896 85.8016c15.792 15.8048 41.408 15.8176 57.2096 0.0256 15.808-15.7888 15.8176-41.4016 0.0288-57.2096L297.6608 240.48a40.4224 40.4224 0 0 0-57.184 0z m142.928 400.112a40.4192 40.4192 0 0 1 0 57.1808L297.6608 783.52a40.4256 40.4256 0 1 1-57.184-57.1264l85.696-85.8016a40.416 40.416 0 0 1 57.2352 0zM783.52 240.48c15.7632 15.7792 15.7632 41.344 0 57.1264l-85.6928 85.8016c-15.7888 15.8048-41.4016 15.8176-57.2096 0.0256-15.8048-15.7888-15.8176-41.4016-0.0256-57.2096l85.7472-85.744a40.416 40.416 0 0 1 57.1808 0zM330.1056 512c0 22.3232-18.0992 40.4192-40.4224 40.4192H168.4224C146.096 552.4192 128 534.3232 128 512s18.096-40.4224 40.4224-40.4224h121.2608c22.3264 0 40.4224 18.0992 40.4224 40.4224zM896 512c0 22.3232-18.096 40.4192-40.4224 40.4192h-121.2608c-22.3264 0-40.4224-18.096-40.4224-40.4192s18.096-40.4224 40.4224-40.4224h121.2608c22.3264 0 40.4224 18.0992 40.4224 40.4224z m-384 181.8944c26.9472 0 40.4192 13.4752 40.4192 40.4224v121.2608c0 26.9472-13.472 40.4224-40.4192 40.4224s-40.4224-13.4752-40.4224-40.4224v-121.2608c0-26.9472 13.4752-40.4224 40.4224-40.4224zM512 128c26.9472 0 40.4192 13.472 40.4192 40.4224v121.2608c0 26.9472-13.472 40.4224-40.4192 40.4224s-40.4224-13.472-40.4224-40.4224V168.4224C471.5776 141.472 485.0528 128 512 128z" />
                  </svg>
               )}
            </Space>
         </Header>

         <Content
            style={{
               display: 'flex',
               flexDirection: 'column',
               height: '100%',
               overflow: 'hidden',
            }}
         >
            {/* 消息列表 */}
            <div
               ref={messagesContainerRef}
               style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '16px 24px',
               }}
            >
               {messages.length === 0 && (
                  <div
                     style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        opacity: 0.5,
                     }}
                  >
                     <Text type="secondary">开始一段新对话吧</Text>
                  </div>
               )}
               {messages.map((msg) => {
                  const isStreamingMsg = msg.id === activeRunId && streaming
                  const showTokens = msg.role === 'assistant' && msg.status === 'done'
                  return (
                     <MessageRow
                        key={msg.id}
                        role={msg.role}
                        content={isStreamingMsg ? streamingContentRef.current : msg.content}
                        images={msg.images}
                        status={msg.status}
                        thinking={isStreamingMsg ? (streamingThinkingRef.current ?? msg.thinking) : msg.thinking}
                        toolCalls={msg.toolCalls}
                        showThinking={false}
                        senderName={
                           msg.role === 'user'
                              ? '你'
                              : msg.role === 'system'
                                ? '系统'
                                : (msg.senderName ?? resolvedSenderName)
                        }
                        timestamp={msg.timestamp}
                        showTokens={showTokens}
                        usage={msg.usage}
                        model={msg.model ?? sessionInfo?.model}
                        sessionTotalTokens={showTokens ? sessionInfo?.totalTokens : undefined}
                        contextTokens={showTokens ? sessionInfo?.contextTokens : undefined}
                     />
                  )
               })}
               <div ref={messagesEndRef} />
            </div>

            {/* 输入区 */}
            <ChatInputBar
               value={inputValue}
               onChange={setInputValue}
               onSubmit={handleSendWithAttachments}
               onCancel={handleAbort}
               loading={streaming}
               disabled={!connected}
               sessionKey={sessionKey}
               sessionInfo={sessionInfo}
               connected={connected}
               rpc={rpc}
               onSessionInfoRefresh={fetchSessionInfo}
            />
         </Content>
      </Layout>
   )
}
