// ── 消息底部信息栏组件 ──

import React from 'react'
import { Tag, Typography } from 'antd'
import type { ChatMessageUsage } from '../types'
import {
   formatMessageTime,
   formatInputTokens,
   formatOutputTokens,
   formatCacheReadTokens,
   formatContextPercent,
} from '../utils/formatTokens'

const { Text } = Typography

interface MessageInfoBarProps {
   senderName: string
   timestamp: number
   role: string
   /** 仅 assistant done 状态展示 token 信息 */
   showTokens?: boolean
   usage?: ChatMessageUsage
   model?: string
   sessionTotalTokens?: number
   contextTokens?: number
}

function MessageInfoBar({
   senderName,
   timestamp,
   role,
   showTokens,
   usage,
   model,
   sessionTotalTokens,
   contextTokens,
}: MessageInfoBarProps) {
   const time = formatMessageTime(timestamp)

   const parts: string[] = [senderName, time]

   if (showTokens && usage) {
      const input = formatInputTokens(usage.inputTokens)
      const output = formatOutputTokens(usage.outputTokens)
      const cacheRead = formatCacheReadTokens(usage.cacheReadTokens)
      const ctxPct = formatContextPercent(sessionTotalTokens, contextTokens)

      if (input) parts.push(input)
      if (output) parts.push(output)
      if (cacheRead) parts.push(cacheRead)
      if (ctxPct) parts.push(ctxPct)
   }

   return (
      <div
         style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            flexDirection: role === 'user' ? 'row-reverse' : 'row',
         }}
      >
         <Text type="secondary" style={{ fontSize: 12 }}>
            {parts.join('  ')}
         </Text>
         {showTokens && model && (
            <Tag
               style={{
                  fontSize: 11,
                  lineHeight: '18px',
                  padding: '0 6px',
                  margin: 0,
                  borderRadius: 4,
               }}
            >
               {model}
            </Tag>
         )}
      </div>
   )
}

function areMessageInfoBarPropsEqual(
   prev: MessageInfoBarProps,
   next: MessageInfoBarProps,
): boolean {
   if (
      prev.senderName !== next.senderName ||
      prev.timestamp !== next.timestamp ||
      prev.role !== next.role ||
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

export default React.memo(MessageInfoBar, areMessageInfoBarPropsEqual)
