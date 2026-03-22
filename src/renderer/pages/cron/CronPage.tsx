// ── 定时任务管理页面 ──

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button, Alert, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { RPC } from '../../../shared/types/gateway-rpc'
import type {
   CronJob,
   CronJobsListResult,
   CronRunLogEntry,
   CronRunsResult,
   CronStatus,
   CronDeliveryStatus,
} from '../../../shared/types/gateway-protocol'
import EmptyState from '../../components/EmptyState'
import { createLogger } from '../../../shared/logger'
import type {
   CronFormState,
   CronFieldErrors,
   CronJobsEnabledFilter,
   CronJobsScheduleKindFilter,
   CronJobsLastStatusFilter,
   CronJobsSortBy,
   CronSortDir,
   CronRunScope,
   CronRunsStatusValue,
} from './cron-types'
import { DEFAULT_CRON_FORM } from './cron-types'
import {
   validateCronForm,
   hasCronFormErrors,
   normalizeCronFormState,
   jobToForm,
   buildCronJobParams,
   buildCloneName,
   formatRelativeTime,
} from './cron-utils'
import CronJobList from './CronJobList'
import CronRunList from './CronRunList'
import CronJobForm from './CronJobForm'
import styles from './CronPage.module.css'

const log = createLogger('CronPage')

const JOBS_LIMIT = 50
const RUNS_LIMIT = 50

export default function CronPage() {
   const { rpc, connected } = useGateway()

   // ── Cron 全局状态 ──
   const [cronStatus, setCronStatus] = useState<CronStatus | null>(null)
   const [error, setError] = useState<string | null>(null)

   // ── 任务列表 ──
   const [jobs, setJobs] = useState<CronJob[]>([])
   const [jobsTotal, setJobsTotal] = useState(0)
   const [jobsHasMore, setJobsHasMore] = useState(false)
   const [jobsNextOffset, setJobsNextOffset] = useState<number | null>(null)
   const [jobsLoading, setJobsLoading] = useState(false)
   const [jobsLoadingMore, setJobsLoadingMore] = useState(false)

   // ── 任务过滤器 ──
   const [jobsQuery, setJobsQuery] = useState('')
   const [jobsEnabledFilter, setJobsEnabledFilter] = useState<CronJobsEnabledFilter>('all')
   const [jobsScheduleKindFilter, setJobsScheduleKindFilter] =
      useState<CronJobsScheduleKindFilter>('all')
   const [jobsLastStatusFilter, setJobsLastStatusFilter] =
      useState<CronJobsLastStatusFilter>('all')
   const [jobsSortBy, setJobsSortBy] = useState<CronJobsSortBy>('nextRunAtMs')
   const [jobsSortDir, setJobsSortDir] = useState<CronSortDir>('asc')

   // ── 运行历史 ──
   const [runs, setRuns] = useState<CronRunLogEntry[]>([])
   const [runsTotal, setRunsTotal] = useState(0)
   const [runsHasMore, setRunsHasMore] = useState(false)
   const [runsNextOffset, setRunsNextOffset] = useState<number | null>(null)
   const [runsLoadingMore, setRunsLoadingMore] = useState(false)

   // ── 运行过滤器 ──
   const [runsJobId, setRunsJobId] = useState<string | null>(null)
   const [runsScope, setRunsScope] = useState<CronRunScope>('all')
   const [runsStatuses, setRunsStatuses] = useState<CronRunsStatusValue[]>([])
   const [runsDeliveryStatuses, setRunsDeliveryStatuses] = useState<CronDeliveryStatus[]>([])
   const [runsQuery, setRunsQuery] = useState('')
   const [runsSortDir, setRunsSortDir] = useState<CronSortDir>('desc')

   // ── 表单 ──
   const [form, setForm] = useState<CronFormState>({ ...DEFAULT_CRON_FORM })
   const [fieldErrors, setFieldErrors] = useState<CronFieldErrors>({})
   const [editingJobId, setEditingJobId] = useState<string | null>(null)
   const [busy, setBusy] = useState(false)
   const [formTouched, setFormTouched] = useState(false)

   // ── 辅助 ──
   const [modelSuggestions, setModelSuggestions] = useState<string[]>([])

   // ── 防抖 ref ──
   const jobsQueryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   const runsQueryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

   // ── 数据加载 ──

   const loadStatus = useCallback(async () => {
      if (!connected) return
      try {
         const result = await rpc<CronStatus>(RPC.CRON_STATUS, {})
         setCronStatus(result)
      } catch (err) {
         log.error('loadStatus error:', err)
      }
   }, [rpc, connected])

   const loadJobs = useCallback(
      async (opts?: { append?: boolean }) => {
         if (!connected) return
         const append = opts?.append ?? false
         if (append) {
            setJobsLoadingMore(true)
         } else {
            setJobsLoading(true)
         }
         try {
            const offset = append ? (jobsNextOffset ?? jobs.length) : 0
            const result = await rpc<CronJobsListResult>(RPC.CRON_LIST, {
               includeDisabled: jobsEnabledFilter === 'all' ? true : undefined,
               enabled: jobsEnabledFilter !== 'all' ? jobsEnabledFilter : undefined,
               limit: JOBS_LIMIT,
               offset,
               query: jobsQuery.trim() || undefined,
               sortBy: jobsSortBy,
               sortDir: jobsSortDir,
            })
            const newJobs = result?.jobs ?? []
            if (append) {
               setJobs((prev) => [...prev, ...newJobs])
            } else {
               setJobs(newJobs)
            }
            setJobsTotal(result?.total ?? newJobs.length)
            setJobsHasMore(result?.hasMore ?? false)
            setJobsNextOffset(result?.nextOffset ?? null)
         } catch (err) {
            log.error('loadJobs error:', err)
            setError(err instanceof Error ? err.message : String(err))
         } finally {
            setJobsLoading(false)
            setJobsLoadingMore(false)
         }
      },
      [rpc, connected, jobsQuery, jobsEnabledFilter, jobsSortBy, jobsSortDir, jobsNextOffset, jobs.length],
   )

   const loadRuns = useCallback(
      async (jobId: string | null, opts?: { append?: boolean }) => {
         if (!connected) return
         const append = opts?.append ?? false
         setRunsLoadingMore(true)
         try {
            const offset = append ? (runsNextOffset ?? runs.length) : 0
            const scope = jobId ? 'job' : 'all'
            const params: Record<string, unknown> = {
               scope,
               limit: RUNS_LIMIT,
               offset,
               sortDir: runsSortDir,
            }
            if (jobId) params.id = jobId
            if (runsStatuses.length > 0) params.statuses = runsStatuses
            if (runsDeliveryStatuses.length > 0) params.deliveryStatuses = runsDeliveryStatuses
            if (runsQuery.trim()) params.query = runsQuery.trim()

            const result = await rpc<CronRunsResult>(RPC.CRON_RUNS, params)
            const newRuns = result?.entries ?? []
            if (append) {
               setRuns((prev) => [...prev, ...newRuns])
            } else {
               setRuns(newRuns)
            }
            setRunsTotal(result?.total ?? newRuns.length)
            setRunsHasMore(result?.hasMore ?? false)
            setRunsNextOffset(result?.nextOffset ?? null)
         } catch (err) {
            log.error('loadRuns error:', err)
         } finally {
            setRunsLoadingMore(false)
         }
      },
      [rpc, connected, runsSortDir, runsStatuses, runsDeliveryStatuses, runsQuery, runsNextOffset, runs.length],
   )

   const loadModelSuggestions = useCallback(async () => {
      if (!connected) return
      try {
         const result = await rpc<{ models: Array<{ id: string }> }>(RPC.MODELS_LIST, {})
         const ids = (result?.models ?? []).map((m) => m.id).sort()
         setModelSuggestions(ids)
      } catch (err) {
         log.error('loadModelSuggestions error:', err)
      }
   }, [rpc, connected])

   const refresh = useCallback(async () => {
      setError(null)
      await Promise.all([
         loadStatus(),
         loadJobs(),
         loadRuns(runsScope === 'job' ? runsJobId : null),
      ])
   }, [loadStatus, loadJobs, loadRuns, runsScope, runsJobId])

   // ── 初始加载 ──

   useEffect(() => {
      if (connected) {
         refresh()
         loadModelSuggestions()
      }
   }, [connected]) // eslint-disable-line react-hooks/exhaustive-deps

   // ── 表单验证（仅在用户提交过后才显示错误） ──

   useEffect(() => {
      if (formTouched) {
         setFieldErrors(validateCronForm(form))
      }
   }, [form, formTouched])

   // ── 搜索防抖 ──

   const debouncedJobsQueryRef = useRef(jobsQuery)
   useEffect(() => {
      debouncedJobsQueryRef.current = jobsQuery
      if (jobsQueryTimerRef.current) clearTimeout(jobsQueryTimerRef.current)
      jobsQueryTimerRef.current = setTimeout(() => {
         loadJobs()
      }, 300)
      return () => {
         if (jobsQueryTimerRef.current) clearTimeout(jobsQueryTimerRef.current)
      }
   }, [jobsQuery]) // eslint-disable-line react-hooks/exhaustive-deps

   const debouncedRunsQueryRef = useRef(runsQuery)
   useEffect(() => {
      debouncedRunsQueryRef.current = runsQuery
      if (runsQueryTimerRef.current) clearTimeout(runsQueryTimerRef.current)
      runsQueryTimerRef.current = setTimeout(() => {
         loadRuns(runsScope === 'job' ? runsJobId : null)
      }, 300)
      return () => {
         if (runsQueryTimerRef.current) clearTimeout(runsQueryTimerRef.current)
      }
   }, [runsQuery]) // eslint-disable-line react-hooks/exhaustive-deps

   // ── 非防抖过滤器变化时立即加载 ──

   useEffect(() => {
      if (connected) loadJobs()
   }, [jobsEnabledFilter, jobsSortBy, jobsSortDir]) // eslint-disable-line react-hooks/exhaustive-deps

   useEffect(() => {
      if (connected) loadRuns(runsScope === 'job' ? runsJobId : null)
   }, [runsSortDir, runsStatuses, runsDeliveryStatuses, runsScope]) // eslint-disable-line react-hooks/exhaustive-deps

   // ── 客户端过滤 ──

   const visibleJobs = useMemo(() => {
      let result = jobs
      if (jobsScheduleKindFilter !== 'all') {
         result = result.filter((j) => j.schedule.kind === jobsScheduleKindFilter)
      }
      if (jobsLastStatusFilter !== 'all') {
         result = result.filter((j) => {
            const status = j.state?.lastRunStatus ?? j.state?.lastStatus
            return status === jobsLastStatusFilter
         })
      }
      return result
   }, [jobs, jobsScheduleKindFilter, jobsLastStatusFilter])

   // ── 表单操作 ──

   const handleFormChange = useCallback((patch: Partial<CronFormState>) => {
      setForm((prev) => normalizeCronFormState({ ...prev, ...patch }))
   }, [])

   const handleCancelEdit = useCallback(() => {
      setEditingJobId(null)
      setForm({ ...DEFAULT_CRON_FORM })
      setFormTouched(false)
      setFieldErrors({})
   }, [])

   const handleEdit = useCallback(
      (job: CronJob) => {
         setEditingJobId(job.id)
         setRunsJobId(job.id)
         setRunsScope('job')
         const newForm = jobToForm(job, form)
         setForm(newForm)
         loadRuns(job.id)
      },
      [form, loadRuns],
   )

   const handleClone = useCallback(
      (job: CronJob) => {
         setEditingJobId(null)
         const existingNames = new Set(jobs.map((j) => j.name))
         const newForm = jobToForm(job, form)
         newForm.name = buildCloneName(job.name, existingNames)
         setForm(newForm)
      },
      [form, jobs],
   )

   const handleSelectJob = useCallback(
      (jobId: string) => {
         setRunsJobId(jobId)
         setRunsScope('job')
         loadRuns(jobId)
      },
      [loadRuns],
   )

   // ── CRUD ──

   const handleAdd = useCallback(async () => {
      setFormTouched(true)
      const normalized = normalizeCronFormState(form)
      const errors = validateCronForm(normalized)
      setFieldErrors(errors)
      if (hasCronFormErrors(errors)) return

      setBusy(true)
      try {
         const params = buildCronJobParams(normalized)
         if (editingJobId) {
            await rpc(RPC.CRON_UPDATE, { id: editingJobId, patch: params })
            message.success('任务已更新')
            setEditingJobId(null)
         } else {
            await rpc(RPC.CRON_ADD, params)
            message.success('任务已创建')
         }
         setForm({ ...DEFAULT_CRON_FORM })
         setFormTouched(false)
         setFieldErrors({})
         await Promise.all([loadStatus(), loadJobs()])
      } catch (err) {
         const errMsg = err instanceof Error ? err.message : String(err)
         message.error(`操作失败: ${errMsg}`)
         log.error('handleAdd error:', err)
      } finally {
         setBusy(false)
      }
   }, [form, editingJobId, rpc, loadStatus, loadJobs])

   const handleToggle = useCallback(
      async (job: CronJob, enabled: boolean) => {
         setBusy(true)
         try {
            await rpc(RPC.CRON_UPDATE, { id: job.id, patch: { enabled } })
            message.success(`任务已${enabled ? '启用' : '禁用'}`)
            await Promise.all([loadStatus(), loadJobs()])
         } catch (err) {
            message.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`)
         } finally {
            setBusy(false)
         }
      },
      [rpc, loadStatus, loadJobs],
   )

   const handleRun = useCallback(
      async (job: CronJob, mode: 'force' | 'due') => {
         setBusy(true)
         try {
            await rpc(RPC.CRON_RUN, { id: job.id, mode })
            message.success(mode === 'force' ? '任务已触发' : '到期运行已触发')
            // 延迟刷新历史，让服务端有时间生成记录
            setTimeout(() => {
               loadRuns(runsScope === 'job' ? runsJobId : null)
               loadStatus()
            }, 1000)
         } catch (err) {
            message.error(`触发失败: ${err instanceof Error ? err.message : String(err)}`)
         } finally {
            setBusy(false)
         }
      },
      [rpc, loadRuns, loadStatus, runsScope, runsJobId],
   )

   const handleRemove = useCallback(
      async (job: CronJob) => {
         setBusy(true)
         try {
            await rpc(RPC.CRON_REMOVE, { id: job.id })
            message.success('任务已删除')
            if (editingJobId === job.id) {
               setEditingJobId(null)
               setForm({ ...DEFAULT_CRON_FORM })
               setFormTouched(false)
               setFieldErrors({})
            }
            if (runsJobId === job.id) {
               setRunsJobId(null)
               setRunsScope('all')
            }
            await Promise.all([loadStatus(), loadJobs(), loadRuns(null)])
         } catch (err) {
            message.error(`删除失败: ${err instanceof Error ? err.message : String(err)}`)
         } finally {
            setBusy(false)
         }
      },
      [rpc, editingJobId, runsJobId, loadStatus, loadJobs, loadRuns],
   )

   // ── 过滤器处理 ──

   const handleJobsFiltersChange = useCallback((patch: Record<string, unknown>) => {
      if ('jobsQuery' in patch) setJobsQuery(patch.jobsQuery as string)
      if ('jobsEnabledFilter' in patch) setJobsEnabledFilter(patch.jobsEnabledFilter as CronJobsEnabledFilter)
      if ('jobsScheduleKindFilter' in patch) setJobsScheduleKindFilter(patch.jobsScheduleKindFilter as CronJobsScheduleKindFilter)
      if ('jobsLastStatusFilter' in patch) setJobsLastStatusFilter(patch.jobsLastStatusFilter as CronJobsLastStatusFilter)
      if ('jobsSortBy' in patch) setJobsSortBy(patch.jobsSortBy as CronJobsSortBy)
      if ('jobsSortDir' in patch) setJobsSortDir(patch.jobsSortDir as CronSortDir)
   }, [])

   const handleJobsFiltersReset = useCallback(() => {
      setJobsQuery('')
      setJobsEnabledFilter('all')
      setJobsScheduleKindFilter('all')
      setJobsLastStatusFilter('all')
      setJobsSortBy('nextRunAtMs')
      setJobsSortDir('asc')
   }, [])

   const handleRunsFiltersChange = useCallback(
      (patch: Record<string, unknown>) => {
         if ('runsScope' in patch) {
            const newScope = patch.runsScope as CronRunScope
            setRunsScope(newScope)
            if (newScope === 'all') {
               setRunsJobId(null)
            }
         }
         if ('runsQuery' in patch) setRunsQuery(patch.runsQuery as string)
         if ('runsSortDir' in patch) setRunsSortDir(patch.runsSortDir as CronSortDir)
         if ('runsStatuses' in patch) setRunsStatuses(patch.runsStatuses as CronRunsStatusValue[])
         if ('runsDeliveryStatuses' in patch) {
            setRunsDeliveryStatuses(patch.runsDeliveryStatuses as CronDeliveryStatus[])
         }
      },
      [],
   )

   // ── 未连接状态 ──

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   // ── 渲染 ──

   return (
      <div className={styles.pageContainer}>
         {/* 页面头部 */}
         <div className={styles.pageHeader}>
            <div>
               <h3 className={styles.pageTitle}>定时任务</h3>
               <div className={styles.subtitle}>唤醒和重复运行。</div>
            </div>
         </div>

         {/* 摘要指标条 */}
         <div className={styles.summaryStrip}>
            <div className={`${styles.summaryCard} ${styles.summaryCardGreen}`}>
               <div className={styles.summaryLabel}>已启用</div>
               <div className={cronStatus?.enabled ? styles.summaryValue : styles.summaryValueInactive}>
                  {cronStatus ? (cronStatus.enabled ? '是' : '否') : '--'}
               </div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardBlue}`}>
               <div className={styles.summaryLabel}>任务数</div>
               <div className={styles.summaryValue}>{cronStatus?.jobs ?? 0}</div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardAmber}`}>
               <div className={styles.summaryLabel}>下次唤醒</div>
               <div className={cronStatus?.nextWakeAtMs ? styles.summaryValue : styles.summaryValueInactive}>
                  {cronStatus?.nextWakeAtMs
                     ? formatRelativeTime(cronStatus.nextWakeAtMs)
                     : 'n/a'}
               </div>
            </div>
            <div className={styles.summaryActions}>
               <Button
                  icon={<ReloadOutlined />}
                  onClick={refresh}
                  loading={jobsLoading}
                  size="small"
               >
                  刷新
               </Button>
            </div>
         </div>

         {/* 错误 */}
         {error && (
            <Alert
               type="error"
               message={error}
               closable
               onClose={() => setError(null)}
               className={styles.errorBanner}
            />
         )}

         {/* 两列布局 */}
         <div className={styles.twoColumns}>
            {/* 左列 */}
            <div className={styles.leftColumn}>
               <CronJobList
                  jobs={visibleJobs}
                  jobsTotal={jobsTotal}
                  jobsHasMore={jobsHasMore}
                  loading={jobsLoading}
                  loadingMore={jobsLoadingMore}
                  editingJobId={editingJobId}
                  busy={busy}
                  jobsQuery={jobsQuery}
                  jobsEnabledFilter={jobsEnabledFilter}
                  jobsScheduleKindFilter={jobsScheduleKindFilter}
                  jobsLastStatusFilter={jobsLastStatusFilter}
                  jobsSortBy={jobsSortBy}
                  jobsSortDir={jobsSortDir}
                  onEdit={handleEdit}
                  onClone={handleClone}
                  onToggle={handleToggle}
                  onRun={handleRun}
                  onRemove={handleRemove}
                  onSelectJob={handleSelectJob}
                  onLoadMore={() => loadJobs({ append: true })}
                  onFiltersChange={handleJobsFiltersChange}
                  onFiltersReset={handleJobsFiltersReset}
               />

               <CronRunList
                  runs={runs}
                  runsTotal={runsTotal}
                  runsHasMore={runsHasMore}
                  loadingMore={runsLoadingMore}
                  runsJobId={runsJobId}
                  runsScope={runsScope}
                  runsStatuses={runsStatuses}
                  runsDeliveryStatuses={runsDeliveryStatuses}
                  runsQuery={runsQuery}
                  runsSortDir={runsSortDir}
                  onLoadMore={() =>
                     loadRuns(runsScope === 'job' ? runsJobId : null, { append: true })
                  }
                  onFiltersChange={handleRunsFiltersChange}
               />
            </div>

            {/* 右列 */}
            <div className={styles.rightColumn}>
               <CronJobForm
                  form={form}
                  fieldErrors={fieldErrors}
                  editingJobId={editingJobId}
                  busy={busy}
                  modelSuggestions={modelSuggestions}
                  onFormChange={handleFormChange}
                  onSubmit={handleAdd}
                  onCancel={handleCancelEdit}
               />
            </div>
         </div>
      </div>
   )
}
