// ── 消息行组件（memo 化，封装 Bubble + InfoBar） ──

import React from 'react'
import type { ChatMessageUsage, ToolCallItem } from '../types'
import MessageBubble from './MessageBubble'
import MessageInfoBar from './MessageInfoBar'
import ThinkingBlock from './ThinkingBlock'
import ToolCallList from './ToolCallList'

interface MessageRowProps {
   role: string
   content: string
   images?: string[]
   status: string | undefined
   thinking?: string
   toolCalls?: ToolCallItem[]
   showThinking?: boolean
   senderName: string
   timestamp: number
   showTokens: boolean
   usage: ChatMessageUsage | undefined
   model: string | undefined
   sessionTotalTokens: number | undefined
   contextTokens: number | undefined
}

function MessageRow({
   role,
   content,
   images,
   status,
   thinking,
   toolCalls,
   showThinking,
   senderName,
   timestamp,
   showTokens,
   usage,
   model,
   sessionTotalTokens,
   contextTokens,
}: MessageRowProps) {
   return (
      <div
         style={{
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: role === 'user' ? 'flex-end' : 'flex-start',
         }}
      >
         {/* 1. 思考过程 - 最先展示 */}
         {showThinking && thinking && (
            <ThinkingBlock thinking={thinking} />
         )}
         {/* 2. 工具调用列表 - 思考后展示 */}
         {toolCalls && toolCalls.length > 0 && (
            <ToolCallList toolCalls={toolCalls} />
         )}
         {/* 3. 最终内容 - 最后展示 */}
         {(content || images?.length || status === 'streaming') && (
            <MessageBubble role={role} content={content} images={images} status={status} />
         )}
         <MessageInfoBar
            role={role}
            senderName={senderName}
            timestamp={timestamp}
            showTokens={showTokens}
            usage={usage}
            model={model}
            sessionTotalTokens={sessionTotalTokens}
            contextTokens={contextTokens}
         />
      </div>
   )
}

function areMessageRowPropsEqual(
   prev: MessageRowProps,
   next: MessageRowProps,
): boolean {
   if (
      prev.role !== next.role ||
      prev.content !== next.content ||
      prev.images !== next.images ||
      prev.status !== next.status ||
      prev.thinking !== next.thinking ||
      prev.showThinking !== next.showThinking ||
      prev.toolCalls !== next.toolCalls ||
      prev.senderName !== next.senderName ||
      prev.timestamp !== next.timestamp ||
      prev.showTokens !== next.showTokens ||
      prev.model !== next.model ||
      prev.sessionTotalTokens !== next.sessionTotalTokens ||
      prev.contextTokens !== next.contextTokens
   ) return false
   if (prev.usage === next.usage) return true
   if (!prev.usage || !next.usage) return false
   return (
      prev.usage.inputTokens === next.usage.inputTokens &&
      prev.usage.outputTokens === next.usage.outputTokens &&
      prev.usage.cacheReadTokens === next.usage.cacheReadTokens &&
      prev.usage.totalTokens === next.usage.totalTokens
   )
}

export default React.memo(MessageRow, areMessageRowPropsEqual)
