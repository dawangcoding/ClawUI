// ── 工具调用列表容器组件 ──

import React from 'react'
import { Flex } from 'antd'
import type { ToolCallItem } from '../types'
import ToolCallCard from './ToolCallCard'

interface ToolCallListProps {
   toolCalls: ToolCallItem[]
}

function ToolCallList({ toolCalls }: ToolCallListProps) {
   if (!toolCalls.length) return null

   return (
      <Flex vertical gap={6} style={{ maxWidth: '80%', marginTop: 6 }}>
         {toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
         ))}
      </Flex>
   )
}

export default React.memo(ToolCallList)
