import React from 'react'
import { Button, Tooltip } from 'antd'
import {
   MenuFoldOutlined,
   MenuUnfoldOutlined,
   QuestionCircleOutlined,
} from '@ant-design/icons'

interface TitleBarProps {
   sidebarCollapsed: boolean
   onToggleSidebar: () => void
}

export default React.memo(function TitleBar({ sidebarCollapsed, onToggleSidebar }: TitleBarProps) {
   return (
      <div
         style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px 0 80px',
            background: 'var(--ant-color-bg-container)',
            borderBottom: '1px solid var(--ant-color-border-secondary)',
            WebkitAppRegion: 'drag',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
         } as React.CSSProperties}
      >
         {/* 左侧区域 */}
         <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <Tooltip title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
               <Button
                  type="text"
                  icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={onToggleSidebar}
               />
            </Tooltip>
         </div>

         {/* 中间区域 - 留空 */}
         <div style={{ flex: 1 }} />

         {/* 右侧区域 */}
         <div
            style={{
               display: 'flex',
               alignItems: 'center',
               gap: 4,
               WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
         >
            <Tooltip title="问题反馈">
               <Button type="text" icon={<QuestionCircleOutlined />} />
            </Tooltip>
         </div>
      </div>
   )
})
