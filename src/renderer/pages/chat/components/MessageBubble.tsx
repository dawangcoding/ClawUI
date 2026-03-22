// ── 消息内容气泡组件 ──

import React from 'react'
import { Image } from 'antd'
import { Markdown } from '@agentscope-ai/chat'

interface MessageBubbleProps {
   role: string
   content: string
   images?: string[]
   status?: string
}

function getBubbleBackground(role: string, status?: string): string {
   if (role === 'user') return 'var(--ant-color-primary-bg, #e6f4ff)'
   if (role === 'system') return 'var(--ant-color-warning-bg, #fffbe6)'
   if (status === 'error') return 'var(--ant-color-error-bg, #fff2f0)'
   return 'var(--ant-color-bg-container, #fafafa)'
}

function MessageBubble({ role, content, images, status }: MessageBubbleProps) {
   const isStreaming = status === 'streaming'
   const displayContent = content || (isStreaming ? '...' : '')
   const hasImages = images && images.length > 0

   return (
      <div
         style={{
            maxWidth: '80%',
            padding: '8px 12px',
            borderRadius: 8,
            background: getBubbleBackground(role, status),
            wordBreak: 'break-word',
            lineHeight: 1.6,
         }}
      >
         {hasImages && (
            <div
               style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: displayContent ? 8 : 0,
               }}
            >
               <Image.PreviewGroup>
                  {images.map((url, index) => (
                     <Image
                        key={index}
                        src={url}
                        style={{
                           maxWidth: 200,
                           maxHeight: 200,
                           borderRadius: 8,
                           objectFit: 'cover',
                        }}
                        preview={{ mask: false }}
                     />
                  ))}
               </Image.PreviewGroup>
            </div>
         )}
         {displayContent && (
            <>
               {role === 'user' || role === 'system' ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</span>
               ) : (
                  <Markdown content={displayContent} cursor={isStreaming} />
               )}
            </>
         )}
      </div>
   )
}

export default React.memo(MessageBubble)
