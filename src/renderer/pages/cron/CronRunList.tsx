// ── 定时任务运行历史 ──

import React from 'react'
import { Input, Select, Button } from 'antd'
import type { CronRunLogEntry, CronDeliveryStatus } from '../../../shared/types/gateway-protocol'
import type { CronRunScope, CronRunsStatusValue, CronSortDir } from './cron-types'
import { formatRelativeTime, formatTimestamp, formatDuration } from './cron-utils'
import styles from './CronPage.module.css'

// ── 选项 ──

const SCOPE_OPTIONS = [
   { value: 'all', label: '所有任务' },
   { value: 'job', label: '选定任务' },
]

const SORT_DIR_OPTIONS = [
   { value: 'desc', label: '最新优先' },
   { value: 'asc', label: '最旧优先' },
]

const STATUS_OPTIONS = [
   { value: 'ok', label: '成功' },
   { value: 'error', label: '失败' },
   { value: 'skipped', label: '跳过' },
]

const DELIVERY_STATUS_OPTIONS = [
   { value: 'delivered', label: '已投递' },
   { value: 'not-delivered', label: '未投递' },
   { value: 'unknown', label: '未知' },
   { value: 'not-requested', label: '未请求' },
]

// ── Props ──

interface CronRunListProps {
   runs: CronRunLogEntry[]
   runsTotal: number
   runsHasMore: boolean
   loadingMore: boolean
   runsJobId: string | null
   runsScope: CronRunScope
   runsStatuses: CronRunsStatusValue[]
   runsDeliveryStatuses: CronDeliveryStatus[]
   runsQuery: string
   runsSortDir: CronSortDir
   onLoadMore: () => void
   onFiltersChange: (patch: Record<string, unknown>) => void
}

// ── 状态徽章 ──

function runStatusBadge(status?: string) {
   if (!status) return null
   const map: Record<string, string> = {
      ok: styles.statusOk,
      error: styles.statusError,
      skipped: styles.statusSkipped,
   }
   const labelMap: Record<string, string> = {
      ok: '成功',
      error: '失败',
      skipped: '跳过',
   }
   return (
      <span className={map[status] ?? styles.statusBadge}>
         {labelMap[status] ?? status}
      </span>
   )
}

function deliveryBadge(status?: CronDeliveryStatus) {
   if (!status || status === 'not-requested') return null
   const map: Record<string, string> = {
      delivered: styles.statusOk,
      'not-delivered': styles.statusError,
      unknown: styles.statusSkipped,
   }
   const labelMap: Record<string, string> = {
      delivered: '已投递',
      'not-delivered': '未投递',
      unknown: '未知',
   }
   return (
      <span className={map[status] ?? styles.statusBadge}>
         {labelMap[status] ?? status}
      </span>
   )
}

// ── 组件 ──

export default function CronRunList({
   runs,
   runsTotal,
   runsHasMore,
   loadingMore,
   runsJobId,
   runsScope,
   runsStatuses,
   runsDeliveryStatuses,
   runsQuery,
   runsSortDir,
   onLoadMore,
   onFiltersChange,
}: CronRunListProps) {
   return (
      <div className={styles.panel}>
         {/* 面板头部 */}
         <div className={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
               <span className={styles.panelTitle}>运行历史</span>
               <span className={styles.panelSubtitle}>所有任务的最新运行记录</span>
            </div>
            <span className={styles.panelCount}>
               {runs.length} / {runsTotal}
            </span>
         </div>

         {/* 过滤器（单行紧凑布局） */}
         <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>范围</span>
               <Select
                  size="small"
                  value={runsScope}
                  options={
                     runsJobId
                        ? SCOPE_OPTIONS
                        : [{ value: 'all', label: '所有任务' }]
                  }
                  onChange={(v) => onFiltersChange({ runsScope: v })}
                  style={{ width: 90 }}
                  disabled={!runsJobId}
               />
            </div>
            <div className={styles.filterGroup}>
               <Input.Search
                  size="small"
                  placeholder="摘要、错误或任务"
                  value={runsQuery}
                  onChange={(e) => onFiltersChange({ runsQuery: e.target.value })}
                  allowClear
                  style={{ width: 150 }}
               />
            </div>
            <div className={styles.filterSep} />
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>状态</span>
               <Select
                  size="small"
                  mode="multiple"
                  placeholder="全部"
                  value={runsStatuses}
                  options={STATUS_OPTIONS}
                  onChange={(v) => onFiltersChange({ runsStatuses: v })}
                  style={{ width: 140 }}
                  allowClear
                  maxTagCount="responsive"
               />
            </div>
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>投递</span>
               <Select
                  size="small"
                  mode="multiple"
                  placeholder="全部"
                  value={runsDeliveryStatuses}
                  options={DELIVERY_STATUS_OPTIONS}
                  onChange={(v) => onFiltersChange({ runsDeliveryStatuses: v })}
                  style={{ width: 150 }}
                  allowClear
                  maxTagCount="responsive"
               />
            </div>
            <div className={styles.filterSep} />
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>排序</span>
               <Select
                  size="small"
                  value={runsSortDir}
                  options={SORT_DIR_OPTIONS}
                  onChange={(v) => onFiltersChange({ runsSortDir: v })}
                  style={{ width: 88 }}
               />
            </div>
         </div>

         {/* 列表 */}
         <div className={styles.panelBody}>
            {runs.length === 0 ? (
               <div className={styles.emptyState}>没有匹配的运行记录。</div>
            ) : (
               <>
                  {runs.map((run, idx) => (
                     <div
                        key={`${run.jobId}-${run.ts}-${idx}`}
                        className={styles.runItem}
                     >
                        {/* 标题行 */}
                        <div className={styles.runHeader}>
                           <div className={styles.runNameGroup}>
                              <span className={styles.runJobName}>
                                 {run.jobName ?? run.jobId}
                              </span>
                              {runStatusBadge(run.status)}
                              {deliveryBadge(run.deliveryStatus)}
                           </div>
                           <span className={styles.runTimestamp}>
                              {formatTimestamp(run.ts)}
                           </span>
                        </div>

                        {/* 摘要/错误 */}
                        {run.summary && (
                           <div className={styles.runSummary}>
                              {run.summary.length > 120
                                 ? run.summary.slice(0, 120) + '...'
                                 : run.summary}
                           </div>
                        )}
                        {run.error && (
                           <div className={styles.runError}>{run.error}</div>
                        )}
                        {run.deliveryError && (
                           <div className={styles.runError}>
                              投递错误: {run.deliveryError}
                           </div>
                        )}

                        {/* 元数据 */}
                        <div className={styles.runMeta}>
                           {run.durationMs != null && (
                              <span className={styles.runMetaItem}>
                                 耗时: {formatDuration(run.durationMs)}
                              </span>
                           )}
                           {run.model && (
                              <span className={styles.runMetaItem}>
                                 模型: {run.model}
                              </span>
                           )}
                           {run.provider && (
                              <span className={styles.runMetaItem}>
                                 提供商: {run.provider}
                              </span>
                           )}
                           {run.usage && (
                              <span className={styles.runMetaItem}>
                                 tokens:{' '}
                                 {run.usage.total_tokens?.toLocaleString() ??
                                    `${run.usage.input_tokens?.toLocaleString() ?? 0} + ${run.usage.output_tokens?.toLocaleString() ?? 0}`}
                              </span>
                           )}
                           {run.nextRunAtMs && (
                              <span className={styles.runMetaItem}>
                                 下次: {formatRelativeTime(run.nextRunAtMs)}
                              </span>
                           )}
                           {run.sessionKey && (
                              <span className={styles.runMetaItem}>
                                 session: {run.sessionKey}
                              </span>
                           )}
                        </div>
                     </div>
                  ))}
               </>
            )}
         </div>

         {/* 加载更多 */}
         {runsHasMore && (
            <div className={styles.loadMoreRow}>
               <Button size="small" onClick={onLoadMore} loading={loadingMore}>
                  加载更多
               </Button>
            </div>
         )}
      </div>
   )
}
