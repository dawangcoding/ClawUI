import React from 'react'
import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { Button } from '@agentscope-ai/design'
import { SparkDeepThinkLine } from '@agentscope-ai/icons'
import {
   type ThinkingLevelValue,
   THINKING_LEVEL_OPTIONS,
} from '../hooks/useThinkingLevel'

interface ThinkingLevelButtonProps {
   level: ThinkingLevelValue
   onLevelChange: (level: ThinkingLevelValue) => void
   disabled?: boolean
   loading?: boolean
}

const LEVEL_LABEL_MAP: Record<ThinkingLevelValue, string> = {
   off: '关闭',
   minimal: '最低',
   low: '低',
   medium: '中',
   high: '高',
   xhigh: '超高',
   adaptive: '自适应',
}

export default function ThinkingLevelButton({
   level,
   onLevelChange,
   disabled,
   loading,
}: ThinkingLevelButtonProps) {
   const isActive = level !== 'off'

   const menuItems: MenuProps['items'] = THINKING_LEVEL_OPTIONS.map((opt) => ({
      key: opt.value,
      label: opt.label,
   }))

   const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
      onLevelChange(key as ThinkingLevelValue)
   }

   return (
      <Dropdown
         menu={{
            items: menuItems,
            onClick: handleMenuClick,
            selectedKeys: [level],
         }}
         trigger={['click']}
         disabled={disabled}
      >
         <Button
            className="thinking-level-btn"
            type="text"
            color="default"
            variant="text"
            icon={<SparkDeepThinkLine />}
            loading={loading}
            disabled={disabled}
            style={{
               padding: '0 6px',
               gap: 4,
               height: 28,
               fontSize: 12,
               whiteSpace: 'nowrap',
               flexShrink: 0,
            }}
         >
            {isActive ? LEVEL_LABEL_MAP[level] : null}
         </Button>
      </Dropdown>
   )
}
