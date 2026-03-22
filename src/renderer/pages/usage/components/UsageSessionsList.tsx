import { useMemo, useCallback } from 'react'
import {
   Card,
   List,
   Select,
   Button,
   Tag,
   Tooltip,
   Flex,
   Typography,
   Segmented,
} from 'antd'
import {
   SortAscendingOutlined,
   SortDescendingOutlined,
   ClearOutlined,
} from '@ant-design/icons'
import type { SessionUsageEntry } from '../../../../shared/types/gateway-protocol'
import { formatTokens, formatCost, formatDurationCompact } from '../usage-utils'
import css from '../UsagePage.module.css'

interface UsageSessionsListProps {
   sessions: SessionUsageEntry[]
   selectedSessions: string[]
   chartMode: 'tokens' | 'cost'
   sessionSort: 'tokens' | 'cost' | 'recent' | 'messages' | 'errors'
   sessionSortDir: 'asc' | 'desc'
   sessionsTab: 'all' | 'recent'
   recentSessions: string[]
   sessionsLimitReached: boolean
   onSelectSession: (key: string, shiftKey: boolean) => void
   onClearSessions: () => void
   onSessionSortChange: (
      sort: 'tokens' | 'cost' | 'recent' | 'messages' | 'errors',
   ) => void
   onSessionSortDirChange: (dir: 'asc' | 'desc') => void
   onSessionsTabChange: (tab: 'all' | 'recent') => void
}

const sortOptions = [
   { label: '费用', value: 'cost' },
   { label: '错误', value: 'errors' },
   { label: '消息', value: 'messages' },
   { label: '最近', value: 'recent' },
   { label: 'Token', value: 'tokens' },
]

const DISPLAY_LIMIT = 50

export default function UsageSessionsList(props: UsageSessionsListProps) {
   const {
      sessions,
      selectedSessions,
      chartMode,
      sessionSort,
      sessionSortDir,
      sessionsTab,
      recentSessions,
      sessionsLimitReached,
      onSelectSession,
      onClearSessions,
      onSessionSortChange,
      onSessionSortDirChange,
      onSessionsTabChange,
   } = props

   const sortedSessions = useMemo(() => {
      const list =
         sessionsTab === 'recent'
            ? sessions.filter((s) => recentSessions.includes(s.key))
            : sessions
      const sorted = [...list].sort((a, b) => {
         let cmp = 0
         switch (sessionSort) {
            case 'cost':
               cmp = (a.usage?.totalCost ?? 0) - (b.usage?.totalCost ?? 0)
               break
            case 'tokens':
               cmp = (a.usage?.totalTokens ?? 0) - (b.usage?.totalTokens ?? 0)
               break
            case 'messages':
               cmp =
                  (a.usage?.messageCounts?.total ?? 0) -
                  (b.usage?.messageCounts?.total ?? 0)
               break
            case 'errors':
               cmp =
                  (a.usage?.messageCounts?.errors ?? 0) -
                  (b.usage?.messageCounts?.errors ?? 0)
               break
            case 'recent':
               cmp = (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
               break
         }
         return sessionSortDir === 'desc' ? -cmp : cmp
      })
      return sorted
   }, [sessions, sessionsTab, recentSessions, sessionSort, sessionSortDir])

   const displaySessions = useMemo(
      () => sortedSessions.slice(0, DISPLAY_LIMIT),
      [sortedSessions],
   )

   const overflowCount = sortedSessions.length - DISPLAY_LIMIT

   const handleSortDirToggle = useCallback(() => {
      onSessionSortDirChange(sessionSortDir === 'asc' ? 'desc' : 'asc')
   }, [sessionSortDir, onSessionSortDirChange])

   return (
      <Card
         size="small"
         title={
            <Flex align="center" gap={6}>
               <span>会话</span>
               <Tag style={{ marginLeft: 2 }}>{sortedSessions.length}</Tag>
            </Flex>
         }
         extra={
            <Flex align="center" gap={6}>
               <Segmented
                  size="small"
                  value={sessionsTab}
                  options={[
                     { label: '全部', value: 'all' },
                     { label: '最近', value: 'recent' },
                  ]}
                  onChange={onSessionsTabChange}
               />
               <Select
                  size="small"
                  value={sessionSort}
                  options={sortOptions}
                  onChange={onSessionSortChange}
                  style={{ width: 90 }}
                  popupMatchSelectWidth={false}
               />
               <Tooltip title={sessionSortDir === 'asc' ? '升序' : '降序'}>
                  <Button
                     size="small"
                     type="text"
                     icon={
                        sessionSortDir === 'asc' ? (
                           <SortAscendingOutlined />
                        ) : (
                           <SortDescendingOutlined />
                        )
                     }
                     onClick={handleSortDirToggle}
                  />
               </Tooltip>
               {selectedSessions.length > 0 && (
                  <Tooltip title="清除选择">
                     <Button
                        size="small"
                        type="text"
                        icon={<ClearOutlined />}
                        onClick={onClearSessions}
                     />
                  </Tooltip>
               )}
            </Flex>
         }
      >
         <List
            dataSource={displaySessions}
            locale={{ emptyText: '暂无会话数据' }}
            renderItem={(session) => {
               const isSelected = selectedSessions.includes(session.key)
               return (
                  <div
                     className={isSelected ? css.sessionItemSelected : css.sessionItem}
                     onClick={(e) => onSelectSession(session.key, e.shiftKey)}
                  >
                     <Flex justify="space-between" align="center">
                        <span className={css.sessionName}>
                           {session.label || session.key}
                        </span>
                        <span className={css.sessionValue}>
                           {chartMode === 'cost'
                              ? formatCost(session.usage?.totalCost ?? 0)
                              : formatTokens(session.usage?.totalTokens ?? 0)}
                        </span>
                     </Flex>
                     <div className={css.sessionTags}>
                        {session.channel && (
                           <Tag color="blue" style={{ fontSize: 11 }}>
                              {session.channel}
                           </Tag>
                        )}
                        {session.agentId && (
                           <Tag color="green" style={{ fontSize: 11 }}>
                              {session.agentId}
                           </Tag>
                        )}
                        {(session.modelProvider || session.providerOverride) && (
                           <Tag style={{ fontSize: 11 }}>
                              {session.modelProvider || session.providerOverride}
                           </Tag>
                        )}
                        {session.model && (
                           <Tag style={{ fontSize: 11 }}>{session.model}</Tag>
                        )}
                        {session.usage?.messageCounts && (
                           <Tag style={{ fontSize: 11 }}>
                              {session.usage.messageCounts.total} 消息
                           </Tag>
                        )}
                        {(session.usage?.toolUsage?.totalCalls ?? 0) > 0 && (
                           <Tag style={{ fontSize: 11 }}>
                              {session.usage!.toolUsage!.totalCalls} 工具
                           </Tag>
                        )}
                        {(session.usage?.messageCounts?.errors ?? 0) > 0 && (
                           <Tag color="red" style={{ fontSize: 11 }}>
                              {session.usage!.messageCounts!.errors} 错误
                           </Tag>
                        )}
                        {session.usage?.durationMs && (
                           <Tag style={{ fontSize: 11 }}>
                              {formatDurationCompact(session.usage.durationMs)}
                           </Tag>
                        )}
                     </div>
                  </div>
               )
            }}
         />
         {overflowCount > 0 && (
            <Typography.Text
               type="secondary"
               style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '8px 0',
                  fontSize: 12,
               }}
            >
               +{overflowCount} 更多会话
            </Typography.Text>
         )}
      </Card>
   )
}
