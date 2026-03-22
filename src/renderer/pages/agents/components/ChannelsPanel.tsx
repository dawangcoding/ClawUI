import React, { useMemo } from 'react'
import { Alert, Button, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { AgentsPageState } from '../hooks/useAgentsPageState'
import type { AgentContext } from '../types'
import { formatRelativeTimestamp } from '../utils/agentHelpers'
import {
   resolveChannelEntries,
   summarizeChannelAccounts,
   resolveChannelExtras,
   CHANNEL_EXTRA_FIELDS
} from '../utils/channelUtils'
import styles from '../AgentsPage.module.css'

const { Text } = Typography

type Props = {
   state: AgentsPageState
   context: AgentContext | null
}

function AgentContextDetailCard({ context }: { context: AgentContext | null }) {
   return (
      <div className={styles.contextDetailCard}>
         <div className={styles.contextDetailTitle}>Agent 上下文</div>
         <div className={styles.contextDetailSub}>工作区、身份与模型配置。</div>
         {context ? (
            <div className={styles.contextDetailGrid}>
               <div className={styles.kvItem}>
                  <span className={styles.kvLabel}>工作区</span>
                  <span className={styles.kvValueMono}>{context.workspace}</span>
               </div>
               <div className={styles.kvItem}>
                  <span className={styles.kvLabel}>主模型</span>
                  <span className={styles.kvValueMono}>{context.model}</span>
               </div>
               <div className={styles.kvItem}>
                  <span className={styles.kvLabel}>身份名称</span>
                  <span className={styles.kvValue}>{context.identityName}</span>
               </div>
               <div className={styles.kvItem}>
                  <span className={styles.kvLabel}>身份头像</span>
                  <span className={styles.kvValue}>{context.identityAvatar}</span>
               </div>
               <div className={styles.kvItem}>
                  <span className={styles.kvLabel}>技能过滤</span>
                  <span className={styles.kvValue}>{context.skillsLabel}</span>
               </div>
               <div className={styles.kvItem}>
                  <span className={styles.kvLabel}>默认</span>
                  <span className={styles.kvValue}>{context.isDefault ? '是' : '否'}</span>
               </div>
            </div>
         ) : (
            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
               选择 Agent 查看上下文
            </Text>
         )}
      </div>
   )
}

export default function ChannelsPanel({ state, context }: Props) {
   const { channels, config } = state
   const snapshot = channels.snapshot

   const entries = useMemo(() => resolveChannelEntries(snapshot), [snapshot])

   const lastRefreshLabel = channels.lastSuccess
      ? formatRelativeTimestamp(channels.lastSuccess)
      : '从未'

   return (
      <div className={styles.channelsLayout}>
         {/* 左列: Agent 上下文 */}
         <AgentContextDetailCard context={context} />

         {/* 右列: 频道状态 */}
         <div className={styles.channelsStatusCard}>
            <div className={styles.channelsStatusHeader}>
               <div>
                  <div className={styles.channelsStatusTitle}>频道</div>
                  <div className={styles.channelsStatusSub}>Gateway 全局频道状态快照。</div>
               </div>
               <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={channels.loadChannels}
                  loading={channels.loading}
               >
                  {channels.loading ? '刷新中…' : '刷新'}
               </Button>
            </div>

            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
               上次刷新: {lastRefreshLabel}
            </Text>

            {channels.error && (
               <Alert type="error" message={channels.error} showIcon style={{ marginTop: 12 }} />
            )}

            {!snapshot && !channels.loading && !channels.error && (
               <Alert
                  type="info"
                  message="加载频道以查看实时状态。"
                  showIcon
                  style={{ marginTop: 12 }}
               />
            )}

            {snapshot && entries.length === 0 && (
               <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                  暂无频道
               </Text>
            )}

            {entries.length > 0 && (
               <div className={styles.channelEntryList}>
                  {entries.map((entry) => {
                     const summary = summarizeChannelAccounts(entry.accounts)
                     const extras = resolveChannelExtras({
                        configForm: config.form,
                        channelId: entry.id,
                        fields: CHANNEL_EXTRA_FIELDS
                     })

                     const statusLabel = summary.total
                        ? `${summary.connected}/${summary.total} 已连接`
                        : '无账户'
                     const configLabel = summary.configured
                        ? `${summary.configured} 已配置`
                        : '未配置'
                     const enabledLabel = summary.total ? `${summary.enabled} 已启用` : '已禁用'

                     return (
                        <div key={entry.id} className={styles.channelEntry}>
                           <div className={styles.channelEntryMain}>
                              <div className={styles.channelEntryLabel}>{entry.label}</div>
                              <div className={styles.channelEntryId}>{entry.id}</div>
                           </div>
                           <div className={styles.channelEntryMeta}>
                              <div className={styles.channelEntryMetaLine}>{statusLabel}</div>
                              <div className={styles.channelEntryMetaLine}>{configLabel}</div>
                              <div className={styles.channelEntryMetaLine}>{enabledLabel}</div>
                              {summary.configured === 0 && (
                                 <div className={styles.channelEntryMetaLine}>
                                    <a
                                       href="https://docs.openclaw.ai/channels"
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className={styles.channelSetupLink}
                                    >
                                       配置指南
                                    </a>
                                 </div>
                              )}
                              {extras.map((extra) => (
                                 <div key={extra.label} className={styles.channelEntryMetaLine}>
                                    {extra.label}: {extra.value}
                                 </div>
                              ))}
                           </div>
                        </div>
                     )
                  })}
               </div>
            )}
         </div>
      </div>
   )
}
