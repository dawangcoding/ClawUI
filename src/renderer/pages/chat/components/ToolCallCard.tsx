// ── 单个工具调用卡片组件 ──

import React from 'react'
import { Accordion } from '@agentscope-ai/chat'
import { CodeBlock } from '@agentscope-ai/design'
import { Flex } from 'antd'
import type { ToolCallItem } from '../types'

/** 状态映射：将内部状态转换为 Accordion 的 status */
const STATUS_MAP: Record<ToolCallItem['status'], 'finished' | 'generating' | 'error'> = {
   completed: 'finished',
   pending: 'generating',
   error: 'error'
}

/** 状态标签：显示在标题右侧 */
const STATUS_LABEL: Record<ToolCallItem['status'], string> = {
   completed: '完成',
   pending: '执行中',
   error: '错误'
}

interface ToolCallCardProps {
   toolCall: ToolCallItem
}

function ToolCallCard({ toolCall }: ToolCallCardProps) {
   const status = STATUS_MAP[toolCall.status]
   const statusLabel = STATUS_LABEL[toolCall.status]

   /** 检测内容是否为有效的 JSON */
   const isValidJson = (text: string | undefined): boolean => {
      if (!text) return false
      try {
         JSON.parse(text)
         return true
      } catch {
         return false
      }
   }

   return (
      <Accordion
         title={toolCall.name}
         status={status}
         rightChildren={<span>{statusLabel}</span>}
         defaultOpen={false}
      >
         <Flex gap={8} vertical>
            {toolCall.inputText && (
               <Accordion.BodyContent headerLeft="参数">
                  <CodeBlock
                     language={isValidJson(toolCall.inputText) ? 'json' : 'text'}
                     value={toolCall.inputText}
                     readOnly
                  />
               </Accordion.BodyContent>
            )}
            <Accordion.BodyContent headerLeft="结果">
               {toolCall.resultText ? (
                  <CodeBlock
                     language={isValidJson(toolCall.resultText) ? 'json' : 'text'}
                     value={toolCall.resultText}
                     readOnly
                  />
               ) : (
                  <div style={{ padding: '8px 12px', color: 'var(--ant-color-text-secondary)' }}>
                     {toolCall.status === 'completed' ? '已完成（无输出）' : '等待结果...'}
                  </div>
               )}
            </Accordion.BodyContent>
         </Flex>
      </Accordion>
   )
}

export default React.memo(ToolCallCard)
