import React, { useState, useCallback, useMemo } from 'react'
import { Typography, Button, Tag, Space, Alert, Tooltip } from 'antd'
import {
   ReloadOutlined,
   EyeOutlined,
   EyeInvisibleOutlined,
} from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { useSnapshot } from '../../contexts/SnapshotContext'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { RPC } from '../../../shared/types/gateway-rpc'
import type { PresenceEntry } from '../../../shared/types/gateway-protocol'
import { formatRelativeTime } from '../../utils/formatRelativeTime'
import EmptyState from '../../components/EmptyState'
import styles from './InstancesPage.module.css'

const { Title, Text } = Typography

const MODE_CONFIG: Record<string, { accent: string; letter: string }> = {
   gateway: { accent: '#1677ff', letter: 'GW' },
   cli: { accent: '#52c41a', letter: 'CLI' },
   ui: { accent: '#8B5CF6', letter: 'UI' },
}
const DEFAULT_MODE = { accent: '#666', letter: '??' }

function MaskedText({ value, hidden }: { value: string; hidden: boolean }) {
   if (!hidden) return <>{value}</>
   return <span className={styles.masked}>{value}</span>
}

function renderTags(entry: PresenceEntry) {
   const tags: React.ReactNode[] = []

   const roles = Array.isArray(entry.roles) ? entry.roles.filter(Boolean) : []
   roles.forEach((role) => {
      tags.push(
         <Tag key={`role-${role}`} color="blue">
            {role}
         </Tag>,
      )
   })

   const scopes = Array.isArray(entry.scopes) ? entry.scopes.filter(Boolean) : []
   if (scopes.length > 3) {
      tags.push(<Tag key="scopes">{scopes.length} 个作用域</Tag>)
   } else {
      scopes.forEach((scope) => {
         tags.push(<Tag key={`scope-${scope}`}>{scope}</Tag>)
      })
   }

   if (entry.platform) {
      tags.push(
         <Tag key="platform" color="cyan">
            {entry.platform}
         </Tag>,
      )
   }
   if (entry.deviceFamily) {
      tags.push(<Tag key="deviceFamily">{entry.deviceFamily}</Tag>)
   }
   if (entry.modelIdentifier) {
      tags.push(<Tag key="model">{entry.modelIdentifier}</Tag>)
   }
   if (entry.version) {
      tags.push(
         <Tag key="version" color="green">
            v{entry.version}
         </Tag>,
      )
   }

   return tags.length > 0 ? tags : null
}

export default function InstancesPage() {
   const { rpc, connected } = useGateway()
   const { presence } = useSnapshot()
   const [hostsHidden, setHostsHidden] = useLocalStorage('clawui-instances-hide-hosts', true)
   const [refreshing, setRefreshing] = useState(false)
   const [lastError, setLastError] = useState<string | null>(null)

   const handleRefresh = useCallback(async () => {
      setRefreshing(true)
      setLastError(null)
      try {
         await rpc(RPC.SYSTEM_PRESENCE, {})
      } catch (err) {
         console.error('[InstancesPage] Refresh error:', err)
         setLastError(err instanceof Error ? err.message : String(err))
      } finally {
         setRefreshing(false)
      }
   }, [rpc])

   const summary = useMemo(() => {
      const counts: Record<string, number> = {}
      for (const entry of presence) {
         const mode = entry.mode ?? 'unknown'
         counts[mode] = (counts[mode] ?? 0) + 1
      }
      return { total: presence.length, counts }
   }, [presence])

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   return (
      <div className={styles.pageContainer}>
         {/* 页面头部 */}
         <div className={styles.pageHeader}>
            <div>
               <Title level={4} className={styles.pageTitle}>
                  在线实例
               </Title>
               <div className={styles.subtitle}>来自 Gateway 和客户端的在线信标</div>
            </div>
            <Space>
               <Tooltip title={hostsHidden ? '显示主机信息' : '隐藏主机信息'}>
                  <Button
                     icon={hostsHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                     onClick={() => setHostsHidden((prev) => !prev)}
                  />
               </Tooltip>
               <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  loading={refreshing}
               >
                  刷新
               </Button>
            </Space>
         </div>

         {/* 错误提示 */}
         {lastError && (
            <Alert
               type="error"
               message={lastError}
               closable
               onClose={() => setLastError(null)}
            />
         )}

         {/* 摘要条 */}
         <div className={styles.summaryBar}>
            <span className={styles.onlineDot} />
            <span>{summary.total} 个在线实例</span>
            {Object.entries(summary.counts).map(([mode, count]) => (
               <React.Fragment key={mode}>
                  <span className={styles.summarySep}>·</span>
                  <span>{mode} ×{count}</span>
               </React.Fragment>
            ))}
         </div>

         {/* 列表 */}
         <div className={styles.listContainer}>
            {/* 列表头 */}
            <div className={styles.listHeader}>
               <span>模式</span>
               <span>主机</span>
               <span className={styles.ipCol}>IP</span>
               <span>标签</span>
               <span>上线</span>
               <span className={styles.inputCol}>输入</span>
               <span className={styles.reasonCol}>原因</span>
            </div>

            {/* 列表行 */}
            {presence.length === 0 ? (
               <div className={styles.emptyList}>暂无在线实例</div>
            ) : (
               presence.map((entry, index) => {
                  const mode = entry.mode ?? 'unknown'
                  const cfg = MODE_CONFIG[mode] ?? DEFAULT_MODE
                  const tags = renderTags(entry)

                  return (
                     <div
                        key={entry.instanceId ?? entry.deviceId ?? index}
                        className={styles.listRow}
                        style={{ '--instance-accent': cfg.accent } as React.CSSProperties}
                     >
                        {/* 模式 */}
                        <span className={styles.modeBadge}>{cfg.letter}</span>

                        {/* 主机 */}
                        <span className={styles.hostName}>
                           <MaskedText
                              value={entry.host ?? '未知主机'}
                              hidden={hostsHidden}
                           />
                        </span>

                        {/* IP */}
                        <span className={`${styles.ipText} ${styles.ipCol}`}>
                           <MaskedText value={entry.ip ?? '-'} hidden={hostsHidden} />
                        </span>

                        {/* 标签 */}
                        <div className={styles.tagsCell}>
                           {tags ?? <span style={{ opacity: 0.3 }}>-</span>}
                        </div>

                        {/* 上线时间 */}
                        <Tooltip title={new Date(entry.ts).toLocaleString('zh-CN')}>
                           <span className={styles.timeCell}>
                              {formatRelativeTime(entry.ts)}
                           </span>
                        </Tooltip>

                        {/* 最后输入 */}
                        <span className={`${styles.timeCell} ${styles.inputCol}`}>
                           {entry.lastInputSeconds != null
                              ? `${entry.lastInputSeconds}s`
                              : '-'}
                        </span>

                        {/* 原因 */}
                        <span className={`${styles.reasonCell} ${styles.reasonCol}`}>
                           {entry.reason ?? '-'}
                        </span>
                     </div>
                  )
               })
            )}
         </div>
      </div>
   )
}
