import React, { useMemo } from 'react'
import { Spin, Alert, Button, Typography } from 'antd'
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { AgentsPageState } from '../hooks/useAgentsPageState'
import type { AgentContext } from '../types'
import {
   formatCronSchedule,
   formatCronPayload,
   formatCronState,
   formatNextWake,
} from '../../cron/cron-utils'
import styles from '../AgentsPage.module.css'

const { Text } = Typography

type Props = {
   state: AgentsPageState
   context: AgentContext | null
}

/* ── Agent 上下文卡片（与 ChannelsPanel 复用同一套样式） ── */
function AgentContextDetailCard({ context }: { context: AgentContext | null }) {
   return (
      <div className={styles.contextDetailCard}>
         <div className={styles.contextDetailTitle}>Agent 上下文</div>
         <div className={styles.contextDetailSub}>工作区与调度目标。</div>
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

export default function CronPanel({ state, context }: Props) {
   const { agents, cron } = state
   const agentId = agents.selectedAgentId

   // 过滤当前 agent 的 cron jobs
   const filteredJobs = useMemo(() => {
      if (!agentId) return cron.jobs
      return cron.jobs.filter(
         (job) => !job.agentId || job.agentId === agentId || job.agentId === '*',
      )
   }, [cron.jobs, agentId])

   return (
      <div>
         {/* ── 上部: Agent Context（左）+ Scheduler（右）两列 ── */}
         <div className={styles.cronTopGrid}>
            {/* 左列: Agent 上下文 */}
            <AgentContextDetailCard context={context} />

            {/* 右列: 调度器状态 */}
            <div className={styles.cronSchedulerCard}>
               <div className={styles.cronSchedulerHeader}>
                  <div>
                     <div className={styles.cronSchedulerTitle}>调度器</div>
                     <div className={styles.cronSchedulerSub}>
                        Gateway 定时任务状态。
                     </div>
                  </div>
                  <Button
                     size="small"
                     icon={<ReloadOutlined />}
                     onClick={cron.loadCron}
                     loading={cron.loading}
                  >
                     刷新
                  </Button>
               </div>

               <div className={styles.cronSchedulerStats}>
                  <div className={styles.kvItem}>
                     <span className={styles.kvLabel}>已启用</span>
                     <span className={styles.kvValue}>
                        {cron.status
                           ? cron.status.enabled
                              ? '是'
                              : '否'
                           : '—'}
                     </span>
                  </div>
                  <div className={styles.kvItem}>
                     <span className={styles.kvLabel}>任务数</span>
                     <span className={styles.kvValue}>
                        {cron.status?.jobs ?? '—'}
                     </span>
                  </div>
                  <div className={styles.kvItem}>
                     <span className={styles.kvLabel}>下次唤醒</span>
                     <span className={styles.kvValueMono}>
                        {formatNextWake(cron.status?.nextWakeAtMs)}
                     </span>
                  </div>
               </div>

               {cron.error && (
                  <Alert
                     type="error"
                     message={cron.error}
                     showIcon
                     style={{ marginTop: 12 }}
                  />
               )}
            </div>
         </div>

         {/* ── 下部: Agent 定时任务列表 ── */}
         <div className={styles.contextDetailCard}>
            <div className={styles.contextDetailTitle}>Agent 定时任务</div>
            <div className={styles.contextDetailSub}>该 Agent 的计划任务。</div>

            {cron.loading && filteredJobs.length === 0 ? (
               <Spin
                  size="small"
                  style={{
                     padding: 24,
                     display: 'block',
                     textAlign: 'center',
                  }}
               />
            ) : filteredJobs.length === 0 ? (
               <Text
                  type="secondary"
                  style={{ display: 'block', marginTop: 16 }}
               >
                  暂无分配的定时任务
               </Text>
            ) : (
               <div className={styles.cronList} style={{ marginTop: 16 }}>
                  {filteredJobs.map((job) => (
                     <div key={job.id} className={styles.cronItem}>
                        <div className={styles.cronItemMain}>
                           <div className={styles.cronItemName}>
                              {job.name || job.id}
                           </div>
                           {job.description && (
                              <div className={styles.cronItemDesc}>
                                 {job.description}
                              </div>
                           )}
                           <div className={styles.cronChipRow}>
                              <span className={styles.cronChip}>
                                 {formatCronSchedule(job)}
                              </span>
                              <span
                                 className={
                                    job.enabled
                                       ? styles.cronChipOk
                                       : styles.cronChipWarn
                                 }
                              >
                                 {job.enabled ? '已启用' : '已禁用'}
                              </span>
                              <span className={styles.cronChip}>
                                 {job.sessionTarget}
                              </span>
                           </div>
                        </div>
                        <div className={styles.cronItemMeta}>
                           <div className={styles.cronItemState}>
                              {formatCronState(job)}
                           </div>
                           <div className={styles.cronItemPayload}>
                              {formatCronPayload(job)}
                           </div>
                           <div className={styles.cronItemActions}>
                              <Button
                                 size="small"
                                 icon={<PlayCircleOutlined />}
                                 onClick={() => cron.runNow(job.id)}
                                 disabled={!job.enabled}
                              >
                                 立即运行
                              </Button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
   )
}
