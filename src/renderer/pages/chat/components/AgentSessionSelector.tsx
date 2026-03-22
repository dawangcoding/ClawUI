import React, { useMemo, useCallback } from 'react'
import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { DownOutlined, LoadingOutlined, CheckOutlined } from '@ant-design/icons'
import { useAgentSessions } from '../hooks/useAgentSessions'
import { parseAgentSessionKey } from '../utils/sessionKeyUtils'
import type { GatewaySessionRow } from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('AgentSessionSelector')

interface AgentSessionSelectorProps {
   currentSessionKey: string
   onSessionChange: (key: string) => void
   connected: boolean
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>
   disabled?: boolean
}

/** 获取 session 的显示名称，优先 displayName，回退到 key 的 mainKey 部分 */
function getSessionDisplayName(session: { key: string; displayName?: string }) {
   if (session.displayName) return session.displayName
   const parsed = parseAgentSessionKey(session.key)
   return parsed?.rest ?? session.key
}

/** 获取 agent 的显示名称 */
function getAgentDisplayName(agent: { id: string; name?: string; identity?: { name?: string } }) {
   return agent.identity?.name ?? agent.name ?? agent.id
}

/** 渲染 session 菜单项的 label（含 lastMessagePreview 次行） */
function SessionLabel({
   session,
   isSelected,
}: {
   session: GatewaySessionRow
   isSelected: boolean
}) {
   const name = getSessionDisplayName(session)
   const preview = session.lastMessagePreview
   return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140, maxWidth: 260 }}>
         {isSelected && (
            <CheckOutlined style={{ fontSize: 12, color: 'var(--ant-color-primary)', flexShrink: 0 }} />
         )}
         <div style={{ flex: 1, overflow: 'hidden' }}>
            <div
               style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: isSelected ? 500 : 400,
                  maxWidth: 220,
               }}
            >
               {name}
            </div>
            {preview && (
               <div
                  style={{
                     fontSize: 11,
                     color: 'var(--ant-color-text-description)',
                     overflow: 'hidden',
                     textOverflow: 'ellipsis',
                     whiteSpace: 'nowrap',
                     maxWidth: 200,
                     lineHeight: '16px',
                  }}
               >
                  {preview}
               </div>
            )}
         </div>
      </div>
   )
}

/** 渲染 agent 菜单项的 label */
function AgentLabel({
   name,
   sessionCount,
}: {
   name: string
   sessionCount: number | null
}) {
   return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
         <span style={{ fontWeight: 500, fontSize: 14 }}>{name}</span>
         {sessionCount !== null && (
            <span
               style={{
                  fontSize: 11,
                  color: 'var(--ant-color-text-description)',
                  marginLeft: 'auto',
                  paddingLeft: 8,
               }}
            >
               {sessionCount}
            </span>
         )}
      </div>
   )
}

export default React.memo(function AgentSessionSelector({
   currentSessionKey,
   onSessionChange,
   connected,
   rpc,
   disabled,
}: AgentSessionSelectorProps) {
   const {
      agents,
      agentsLoading,
      sessionsByAgent,
      sessionsLoadingMap,
      fetchAllSessions,
      currentAgent,
      currentSession,
   } = useAgentSessions({ connected, rpc, currentSessionKey })

   // 构建分组菜单项（Agent 为分组标题，Sessions 平铺展示）
   const menuItems: MenuProps['items'] = useMemo(() => {
      if (agentsLoading) {
         return [
            {
               key: '__loading__',
               label: (
                  <span style={{ color: 'var(--ant-color-text-description)' }}>
                     <LoadingOutlined style={{ marginRight: 8 }} />
                     加载中...
                  </span>
               ),
               disabled: true,
            },
         ]
      }

      if (agents.length === 0) {
         return [
            {
               key: '__empty__',
               label: (
                  <span style={{ color: 'var(--ant-color-text-description)' }}>
                     无可用智能体
                  </span>
               ),
               disabled: true,
            },
         ]
      }

      const items: MenuProps['items'] = []

      agents.forEach((agent, index) => {
         const agentSessions = sessionsByAgent[agent.id]
         const isLoading = sessionsLoadingMap[agent.id]
         const name = getAgentDisplayName(agent)

         // Agent 之间加分割线
         if (index > 0) {
            items.push({ type: 'divider', key: `__divider_${agent.id}__` })
         }

         let children: MenuProps['items']
         if (isLoading || !agentSessions) {
            children = [
               {
                  key: `__loading_${agent.id}__`,
                  label: (
                     <span style={{ color: 'var(--ant-color-text-description)' }}>
                        <LoadingOutlined style={{ marginRight: 8 }} />
                        加载中...
                     </span>
                  ),
                  disabled: true,
               },
            ]
         } else if (agentSessions.length === 0) {
            children = [
               {
                  key: `__empty_${agent.id}__`,
                  label: (
                     <span style={{ color: 'var(--ant-color-text-description)' }}>
                        无会话
                     </span>
                  ),
                  disabled: true,
               },
            ]
         } else {
            children = agentSessions.map((session) => ({
               key: session.key,
               label: (
                  <SessionLabel
                     session={session}
                     isSelected={session.key === currentSessionKey}
                  />
               ),
            }))
         }

         items.push({
            type: 'group',
            key: `__agent_${agent.id}__`,
            label: (
               <AgentLabel
                  name={name}
                  sessionCount={agentSessions ? agentSessions.length : null}
               />
            ),
            children,
         })
      })

      return items
   }, [agents, agentsLoading, sessionsByAgent, sessionsLoadingMap, currentSessionKey])

   // 点击菜单项
   const handleMenuClick: MenuProps['onClick'] = useCallback(
      ({ key }: { key: string }) => {
         if (key.startsWith('__')) return
         log.log('Session selected: %s', key)
         onSessionChange(key)
      },
      [onSessionChange],
   )

   // 展开时拉取 sessions
   const handleOpenChange = useCallback(
      (open: boolean) => {
         if (open) {
            log.log('Dropdown opened, fetching all sessions...')
            fetchAllSessions()
         }
      },
      [fetchAllSessions],
   )

   // 触发器显示文本
   const triggerLabel = useMemo(() => {
      if (currentAgent) {
         const agentName = getAgentDisplayName(currentAgent)
         const sessionName = currentSession ? getSessionDisplayName(currentSession) : null
         return { agentName, sessionName }
      }
      return null
   }, [currentAgent, currentSession])

   const isDisabled = disabled || !connected

   // 未连接或数据未就绪时不展示选择器
   if (!connected || !triggerLabel) return null

   return (
      <Dropdown
         menu={{
            items: menuItems,
            onClick: handleMenuClick,
            selectedKeys: [currentSessionKey],
         }}
         overlayClassName="agent-session-dropdown"
         overlayStyle={{ minWidth: 180 }}
         trigger={['click']}
         disabled={isDisabled}
         onOpenChange={handleOpenChange}
         placement="bottomLeft"
      >
         <div
            style={{
               display: 'inline-flex',
               alignItems: 'center',
               gap: 6,
               padding: '2px 6px',
               borderRadius: 4,
               cursor: isDisabled ? 'not-allowed' : 'pointer',
               userSelect: 'none',
               maxWidth: 300,
               background: 'transparent',
               transition: 'all 0.2s',
               opacity: isDisabled ? 0.5 : 1,
               height: 28,
               fontSize: 14,
               lineHeight: '24px',
               color: '#1677ff',
            }}
            onMouseEnter={(e) => {
               if (!isDisabled) {
                  e.currentTarget.style.color = '#4096ff'
               }
            }}
            onMouseLeave={(e) => {
               e.currentTarget.style.color = '#1677ff'
            }}
         >
            {triggerLabel ? (
               <>
                  <span
                     style={{
                        fontWeight: 500,
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                     }}
                  >
                     {triggerLabel.agentName}
                  </span>
                  {triggerLabel.sessionName && (
                     <>
                        <span
                           style={{
                              margin: '0 2px',
                              flexShrink: 0,
                              opacity: 0.6,
                           }}
                        >
                           /
                        </span>
                        <span
                           style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: 500,
                           }}
                        >
                           {triggerLabel.sessionName}
                        </span>
                     </>
                  )}
               </>
            ) : (
               <span>{currentSessionKey}</span>
            )}
            <DownOutlined
               style={{
                  fontSize: 10,
                  flexShrink: 0,
                  marginLeft: 2,
               }}
            />
         </div>
      </Dropdown>
   )
})
