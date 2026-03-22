import React from 'react'
import { Card, Badge, Alert, Typography } from 'antd'
import type { Snapshot, HelloOkPayload } from '../../../shared/types/gateway-protocol'
import { formatDurationHuman, formatRelativeTime } from './overview-utils'

const { Text } = Typography

interface SnapshotCardProps {
   connected: boolean
   snapshot: Snapshot | null
   helloOk: HelloOkPayload | null
   lastError: string | null
   channelsRefreshTs: number | null
}

const statGridStyle: React.CSSProperties = {
   display: 'grid',
   gridTemplateColumns: 'repeat(2, 1fr)',
   gap: 16,
}

const statItemStyle: React.CSSProperties = {
   display: 'flex',
   flexDirection: 'column',
   gap: 4,
   padding: '8px 10px',
   borderRadius: 6,
   background: 'var(--ant-color-fill-quaternary)',
}

const statLabelStyle: React.CSSProperties = {
   fontSize: 11,
   color: 'var(--ant-color-text-tertiary)',
   textTransform: 'uppercase',
   letterSpacing: 0.5,
   lineHeight: 1,
}

const statValueStyle: React.CSSProperties = {
   fontSize: 18,
   fontWeight: 600,
   letterSpacing: -0.3,
   lineHeight: 1.3,
}

export default function SnapshotCard({
   connected,
   snapshot,
   helloOk,
   lastError,
   channelsRefreshTs,
}: SnapshotCardProps) {
   const uptime = snapshot?.uptimeMs ? formatDurationHuman(snapshot.uptimeMs) : '-'
   const tickMs = helloOk?.policy?.tickIntervalMs
   const tick = tickMs
      ? `${(tickMs / 1000).toFixed(tickMs % 1000 === 0 ? 0 : 1)}s`
      : '-'
   const channelsRefresh = channelsRefreshTs
      ? formatRelativeTime(channelsRefreshTs)
      : '-'

   return (
      <Card title="快照" size="small" style={{ height: '100%' }}>
         <div style={statGridStyle}>
            <div style={statItemStyle}>
               <span style={statLabelStyle}>连接状态</span>
               <span style={statValueStyle}>
                  <Badge
                     status={connected ? 'success' : 'error'}
                     text={
                        <Text
                           strong
                           style={{
                              fontSize: 18,
                              color: connected
                                 ? 'var(--ant-color-success)'
                                 : 'var(--ant-color-error)',
                           }}
                        >
                           {connected ? '正常' : '离线'}
                        </Text>
                     }
                  />
               </span>
            </div>
            <div style={statItemStyle}>
               <span style={statLabelStyle}>运行时间</span>
               <span style={statValueStyle}>{uptime}</span>
            </div>
            <div style={statItemStyle}>
               <span style={statLabelStyle}>心跳间隔</span>
               <span style={statValueStyle}>{tick}</span>
            </div>
            <div style={statItemStyle}>
               <span style={statLabelStyle}>频道刷新</span>
               <span style={statValueStyle}>{channelsRefresh}</span>
            </div>
         </div>

         {lastError && (
            <Alert
               type="error"
               message={lastError}
               style={{ marginTop: 14 }}
               showIcon
            />
         )}

         {connected && !lastError && (
            <div
               style={{
                  marginTop: 14,
                  padding: '8px 12px',
                  background: 'var(--ant-color-fill-quaternary)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--ant-color-text-tertiary)',
                  borderLeft: '3px solid var(--ant-color-primary)',
               }}
            >
               频道连接由 Gateway 自动管理，无需手动操作。
            </div>
         )}
      </Card>
   )
}
