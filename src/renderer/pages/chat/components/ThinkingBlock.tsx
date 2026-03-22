// ── 思考过程可折叠展示组件 ──

import React from 'react'
import { DeepThinking } from '@agentscope-ai/chat'

interface ThinkingBlockProps {
   thinking: string
}

function ThinkingBlock({ thinking }: ThinkingBlockProps) {
   return (
      <div style={{ marginBottom: 6, maxWidth: '80%' }}>
         <DeepThinking
            title="思考过程"
            content={thinking}
            loading={false}
            defaultOpen={false}
         />
      </div>
   )
}

export default React.memo(ThinkingBlock)
