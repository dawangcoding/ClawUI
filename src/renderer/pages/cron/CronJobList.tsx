// ── 定时任务列表 ──

import React, { useState } from 'react'
import { Input, Select, Button, Popconfirm, Spin, Dropdown, Modal } from 'antd'
import {
   EditOutlined,
   CopyOutlined,
   PlayCircleOutlined,
   FieldTimeOutlined,
   HistoryOutlined,
   DeleteOutlined,
   EllipsisOutlined,
} from '@ant-design/icons'
import type { CronJob } from '../../../shared/types/gateway-protocol'
import type {
   CronJobsEnabledFilter,
   CronJobsScheduleKindFilter,
   CronJobsLastStatusFilter,
   CronJobsSortBy,
   CronSortDir,
} from './cron-types'
import { formatCronSchedule, formatCronPayload, formatRelativeTime } from './cron-utils'
import styles from './CronPage.module.css'

// ── 过滤器选项 ──

const ENABLED_FILTER_OPTIONS = [
   { value: 'all', label: '全部' },
   { value: 'enabled', label: '已启用' },
   { value: 'disabled', label: '已禁用' },
]

const SCHEDULE_KIND_FILTER_OPTIONS = [
   { value: 'all', label: '全部' },
   { value: 'every', label: '每隔' },
   { value: 'at', label: '指定时间' },
   { value: 'cron', label: 'Cron' },
]

const LAST_STATUS_FILTER_OPTIONS = [
   { value: 'all', label: '全部' },
   { value: 'ok', label: '成功' },
   { value: 'error', label: '失败' },
   { value: 'skipped', label: '跳过' },
]

const SORT_BY_OPTIONS = [
   { value: 'nextRunAtMs', label: '下次运行' },
   { value: 'updatedAtMs', label: '更新时间' },
   { value: 'name', label: '名称' },
]

const SORT_DIR_OPTIONS = [
   { value: 'asc', label: '升序' },
   { value: 'desc', label: '降序' },
]

// ── Props ──

interface CronJobListProps {
   jobs: CronJob[]
   jobsTotal: number
   jobsHasMore: boolean
   loading: boolean
   loadingMore: boolean
   editingJobId: string | null
   busy: boolean
   jobsQuery: string
   jobsEnabledFilter: CronJobsEnabledFilter
   jobsScheduleKindFilter: CronJobsScheduleKindFilter
   jobsLastStatusFilter: CronJobsLastStatusFilter
   jobsSortBy: CronJobsSortBy
   jobsSortDir: CronSortDir
   onEdit: (job: CronJob) => void
   onClone: (job: CronJob) => void
   onToggle: (job: CronJob, enabled: boolean) => void
   onRun: (job: CronJob, mode: 'force' | 'due') => void
   onRemove: (job: CronJob) => void
   onSelectJob: (jobId: string) => void
   onLoadMore: () => void
   onFiltersChange: (patch: Record<string, unknown>) => void
   onFiltersReset: () => void
}

// ── 行状态类名 ──

function jobRowClassName(job: CronJob, isSelected: boolean): string {
   const base = isSelected ? styles.jobRowSelected : styles.jobRow
   const lastStatus = job.state?.lastRunStatus ?? job.state?.lastStatus
   if (lastStatus === 'error' && job.enabled) return `${base} ${styles.jobRowError}`
   if (job.enabled) return `${base} ${styles.jobRowEnabled}`
   return `${base} ${styles.jobRowDisabled}`
}

function enabledBadge(enabled: boolean) {
   return (
      <span className={enabled ? styles.statusEnabled : styles.statusDisabled}>
         {enabled ? '启用' : '禁用'}
      </span>
   )
}

function lastStatusBadge(status: string | undefined) {
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

// ── 组件 ──

export default function CronJobList({
   jobs,
   jobsTotal,
   jobsHasMore,
   loading,
   loadingMore,
   editingJobId,
   busy,
   jobsQuery,
   jobsEnabledFilter,
   jobsScheduleKindFilter,
   jobsLastStatusFilter,
   jobsSortBy,
   jobsSortDir,
   onEdit,
   onClone,
   onToggle,
   onRun,
   onRemove,
   onSelectJob,
   onLoadMore,
   onFiltersChange,
   onFiltersReset,
}: CronJobListProps) {
   const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

   function handleRowClick(job: CronJob) {
      setExpandedJobId((prev) => (prev === job.id ? null : job.id))
      onSelectJob(job.id)
   }

   return (
      <div className={styles.panel}>
         {/* 面板头部 */}
         <div className={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
               <span className={styles.panelTitle}>任务列表</span>
               <span className={styles.panelSubtitle}>网关中存储的所有定时任务</span>
            </div>
            <span className={styles.panelCount}>
               {jobs.length} / {jobsTotal}
            </span>
         </div>

         {/* 过滤器（单行紧凑布局） */}
         <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
               <Input.Search
                  size="small"
                  placeholder="名称、描述或..."
                  value={jobsQuery}
                  onChange={(e) => onFiltersChange({ jobsQuery: e.target.value })}
                  allowClear
                  style={{ width: 150 }}
               />
            </div>
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>状态</span>
               <Select
                  size="small"
                  value={jobsEnabledFilter}
                  options={ENABLED_FILTER_OPTIONS}
                  onChange={(v) => onFiltersChange({ jobsEnabledFilter: v })}
                  style={{ width: 80 }}
               />
            </div>
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>调度</span>
               <Select
                  size="small"
                  value={jobsScheduleKindFilter}
                  options={SCHEDULE_KIND_FILTER_OPTIONS}
                  onChange={(v) => onFiltersChange({ jobsScheduleKindFilter: v })}
                  style={{ width: 80 }}
               />
            </div>
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>最后运行</span>
               <Select
                  size="small"
                  value={jobsLastStatusFilter}
                  options={LAST_STATUS_FILTER_OPTIONS}
                  onChange={(v) => onFiltersChange({ jobsLastStatusFilter: v })}
                  style={{ width: 72 }}
               />
            </div>
            <div className={styles.filterSep} />
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>排序</span>
               <Select
                  size="small"
                  value={jobsSortBy}
                  options={SORT_BY_OPTIONS}
                  onChange={(v) => onFiltersChange({ jobsSortBy: v })}
                  style={{ width: 88 }}
               />
               <Select
                  size="small"
                  value={jobsSortDir}
                  options={SORT_DIR_OPTIONS}
                  onChange={(v) => onFiltersChange({ jobsSortDir: v })}
                  style={{ width: 64 }}
               />
            </div>
            <Button
               size="small"
               onClick={onFiltersReset}
               className={styles.filterResetBtn}
            >
               重置
            </Button>
         </div>

         {/* 列表头 */}
         <div className={styles.jobListHeader}>
            <span>名称</span>
            <span>调度</span>
            <span>状态</span>
            <span>下次运行</span>
            <span />
         </div>

         {/* 列表 */}
         {loading && jobs.length === 0 ? (
            <div className={styles.loadingState}>
               <Spin />
            </div>
         ) : jobs.length === 0 ? (
            <div className={styles.emptyState}>没有匹配的任务。</div>
         ) : (
            <>
               {jobs.map((job) => {
                  const lastStatus = job.state?.lastRunStatus ?? job.state?.lastStatus
                  const isSelected = editingJobId === job.id
                  const isExpanded = expandedJobId === job.id

                  const actionMenuItems = [
                     {
                        key: 'edit',
                        icon: <EditOutlined />,
                        label: '编辑',
                        onClick: () => onEdit(job),
                        disabled: busy,
                     },
                     {
                        key: 'clone',
                        icon: <CopyOutlined />,
                        label: '复制',
                        onClick: () => onClone(job),
                        disabled: busy,
                     },
                     {
                        key: 'toggle',
                        label: job.enabled ? '禁用' : '启用',
                        onClick: () => onToggle(job, !job.enabled),
                        disabled: busy,
                     },
                     { type: 'divider' as const },
                     {
                        key: 'run',
                        icon: <PlayCircleOutlined />,
                        label: '立即运行',
                        onClick: () => onRun(job, 'force'),
                        disabled: busy,
                     },
                     {
                        key: 'due',
                        icon: <FieldTimeOutlined />,
                        label: '到期运行',
                        onClick: () => onRun(job, 'due'),
                        disabled: busy,
                     },
                     {
                        key: 'history',
                        icon: <HistoryOutlined />,
                        label: '查看历史',
                        onClick: () => onSelectJob(job.id),
                     },
                     { type: 'divider' as const },
                     {
                        key: 'delete',
                        icon: <DeleteOutlined />,
                        label: '删除',
                        danger: true,
                        disabled: busy,
                        onClick: () => {
                           Modal.confirm({
                              title: '确认删除此任务？',
                              okText: '删除',
                              cancelText: '取消',
                              okButtonProps: { danger: true },
                              onOk: () => onRemove(job),
                           })
                        },
                     },
                  ]

                  return (
                     <React.Fragment key={job.id}>
                        <div
                           className={jobRowClassName(job, isSelected)}
                           onClick={() => handleRowClick(job)}
                        >
                           {/* 名称 */}
                           <div className={styles.jobNameCell}>
                              <span className={styles.jobName}>{job.name}</span>
                              {job.description && (
                                 <span className={styles.jobDesc}>{job.description}</span>
                              )}
                           </div>

                           {/* 调度 */}
                           <div className={styles.jobScheduleCell}>
                              {formatCronSchedule(job)}
                           </div>

                           {/* 状态 */}
                           <div className={styles.jobStatusCell}>
                              {enabledBadge(job.enabled)}
                              {lastStatusBadge(lastStatus)}
                           </div>

                           {/* 下次运行 */}
                           <div className={styles.jobTimeCell}>
                              {job.state?.nextRunAtMs
                                 ? formatRelativeTime(job.state.nextRunAtMs)
                                 : '--'}
                           </div>

                           {/* 操作 */}
                           <div
                              className={styles.jobActionsCell}
                              onClick={(e) => e.stopPropagation()}
                           >
                              <Dropdown
                                 menu={{ items: actionMenuItems }}
                                 trigger={['click']}
                              >
                                 <Button
                                    type="text"
                                    size="small"
                                    icon={<EllipsisOutlined />}
                                 />
                              </Dropdown>
                           </div>
                        </div>

                        {/* 展开详情 */}
                        {isExpanded && (
                           <>
                              <div className={styles.jobExpandedMeta}>
                                 <span className={styles.jobMetaItem}>
                                    <span className={styles.jobMetaLabel}>载荷:</span>
                                    {formatCronPayload(job)}
                                 </span>
                                 {job.agentId && (
                                    <span className={styles.jobMetaItem}>
                                       <span className={styles.jobMetaLabel}>代理:</span>
                                       {job.agentId}
                                    </span>
                                 )}
                                 <span className={styles.jobMetaItem}>
                                    <span className={styles.jobMetaLabel}>会话:</span>
                                    {job.sessionTarget}
                                 </span>
                                 <span className={styles.jobMetaItem}>
                                    <span className={styles.jobMetaLabel}>唤醒:</span>
                                    {job.wakeMode}
                                 </span>
                                 {job.state?.lastRunAtMs && (
                                    <span className={styles.jobMetaItem}>
                                       <span className={styles.jobMetaLabel}>上次运行:</span>
                                       {formatRelativeTime(job.state.lastRunAtMs)}
                                    </span>
                                 )}
                              </div>
                              <div className={styles.jobExpandedActions}>
                                 <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => onEdit(job)}
                                    disabled={busy}
                                 >
                                    编辑
                                 </Button>
                                 <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => onClone(job)}
                                    disabled={busy}
                                 >
                                    复制
                                 </Button>
                                 <Button
                                    type="text"
                                    size="small"
                                    onClick={() => onToggle(job, !job.enabled)}
                                    disabled={busy}
                                 >
                                    {job.enabled ? '禁用' : '启用'}
                                 </Button>
                                 <Button
                                    type="text"
                                    size="small"
                                    icon={<PlayCircleOutlined />}
                                    onClick={() => onRun(job, 'force')}
                                    disabled={busy}
                                 >
                                    运行
                                 </Button>
                                 <Button
                                    type="text"
                                    size="small"
                                    icon={<FieldTimeOutlined />}
                                    onClick={() => onRun(job, 'due')}
                                    disabled={busy}
                                 >
                                    到期运行
                                 </Button>
                                 <Popconfirm
                                    title="确认删除此任务？"
                                    onConfirm={() => onRemove(job)}
                                    okText="删除"
                                    cancelText="取消"
                                 >
                                    <Button
                                       type="text"
                                       size="small"
                                       danger
                                       icon={<DeleteOutlined />}
                                       disabled={busy}
                                    >
                                       删除
                                    </Button>
                                 </Popconfirm>
                              </div>
                           </>
                        )}
                     </React.Fragment>
                  )
               })}
            </>
         )}

         {/* 加载更多 */}
         {jobsHasMore && (
            <div className={styles.loadMoreRow}>
               <Button size="small" onClick={onLoadMore} loading={loadingMore}>
                  加载更多
               </Button>
            </div>
         )}
      </div>
   )
}
