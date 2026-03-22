import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Row, Col } from 'antd'
import { useGateway } from '../../contexts/GatewayContext'
import { useSnapshot } from '../../contexts/SnapshotContext'
import { useNavigation } from '../../contexts/NavigationContext'
import { useGatewayRpc } from '../../hooks/useGatewayRpc'
import { useEventLog } from '../../stores/eventLogStore'
import { RPC } from '../../../shared/types/gateway-rpc'
import type {
   SessionsListResult,
   SessionsUsageResult,
   SkillStatusReport,
   CronStatus,
   CronJobsListResult,
   ChannelsStatusSnapshot,
} from '../../../shared/types/gateway-protocol'
import { createLogger } from '../../../shared/logger'
import AccessCard from './AccessCard'
import SnapshotCard from './SnapshotCard'
import StatCards from './StatCards'
import AttentionList, { type AttentionItem } from './AttentionList'
import EventLogPanel from './EventLogPanel'
import LogTailPanel from './LogTailPanel'

const log = createLogger('OverviewPage')

// ── RPC 参数常量（避免引用变化导致 useGatewayRpc 无限重渲染）──
const SESSIONS_LIST_PARAMS = { limit: 50 }
const SESSIONS_USAGE_PARAMS = { limit: 200 }
const CRON_LIST_PARAMS = { limit: 100 }
const CHANNELS_STATUS_PARAMS = { probe: false }
const MAX_LOG_LINES = 500

interface LogTailResult {
   cursor?: number
   lines?: string[]
}

export default function OverviewPage() {
   const {
      connected, connecting, connectionState,
      lastError, lastErrorCode,
      connect, disconnect, rpc,
   } = useGateway()
   const { snapshot, helloOk } = useSnapshot()
   const { navigate } = useNavigation()
   const eventLog = useEventLog()

   // ── RPC 数据加载 ──
   const sessionsRpc = useGatewayRpc<SessionsListResult>(
      RPC.SESSIONS_LIST, SESSIONS_LIST_PARAMS,
   )
   const usageRpc = useGatewayRpc<SessionsUsageResult>(
      RPC.SESSIONS_USAGE, SESSIONS_USAGE_PARAMS,
   )
   const skillsRpc = useGatewayRpc<SkillStatusReport>(RPC.SKILLS_STATUS)
   const cronStatusRpc = useGatewayRpc<CronStatus>(RPC.CRON_STATUS)
   const cronListRpc = useGatewayRpc<CronJobsListResult>(
      RPC.CRON_LIST, CRON_LIST_PARAMS,
   )
   const channelsRpc = useGatewayRpc<ChannelsStatusSnapshot>(
      RPC.CHANNELS_STATUS, CHANNELS_STATUS_PARAMS,
   )

   // ── 频道刷新时间戳 ──
   const [channelsRefreshTs, setChannelsRefreshTs] = useState<number | null>(null)
   useEffect(() => {
      if (channelsRpc.data) {
         setChannelsRefreshTs(Date.now())
      }
   }, [channelsRpc.data])

   // ── 日志加载（手动管理 cursor）──
   const [logLines, setLogLines] = useState<string[]>([])
   const logCursorRef = useRef<number | undefined>(undefined)

   const loadLogs = useCallback(async () => {
      if (!connected) return
      try {
         const result = await rpc<LogTailResult>(RPC.LOGS_TAIL, {
            cursor: logCursorRef.current,
            limit: 100,
            maxBytes: 50_000,
         })
         if (result?.lines?.length) {
            logCursorRef.current = result.cursor
            setLogLines((prev) => {
               const merged = [...prev, ...result.lines!]
               return merged.slice(-MAX_LOG_LINES)
            })
         }
      } catch (err) {
         log.warn('Failed to load logs: %s', err)
      }
   }, [connected, rpc])

   useEffect(() => {
      if (connected) {
         loadLogs()
      } else {
         setLogLines([])
         logCursorRef.current = undefined
      }
   }, [connected, loadLogs])

   // ── Attention Items 计算 ──
   const attentionItems = useMemo<AttentionItem[]>(() => {
      const items: AttentionItem[] = []

      // 1. Gateway 错误
      if (lastError) {
         items.push({
            severity: 'error',
            title: 'Gateway 错误',
            description: lastError,
         })
      }

      // 2. 缺少权限
      if (helloOk?.auth?.scopes && !helloOk.auth.scopes.includes('operator.read')) {
         items.push({
            severity: 'warning',
            title: '缺少 operator.read 权限',
            description: '当前连接未获得 operator.read 权限，部分功能可能不可用。',
         })
      }

      // 3. 技能问题
      const skills = skillsRpc.data?.skills ?? []
      const blockedSkills = skills.filter(
         (s) => !s.disabled && !s.eligible,
      )
      if (blockedSkills.length > 0) {
         const names = blockedSkills.slice(0, 3).map((s) => s.name)
         const suffix = blockedSkills.length > 3
            ? ` 等 ${blockedSkills.length} 个`
            : ''
         items.push({
            severity: 'warning',
            title: '技能存在问题',
            description: `${names.join('、')}${suffix} 技能被阻止，请检查技能配置。`,
         })
      }

      // 4. Cron 失败
      const cronJobs = cronListRpc.data?.jobs ?? []
      const failedJobs = cronJobs.filter(
         (j) => (j.state?.lastRunStatus ?? j.state?.lastStatus) === 'error',
      )
      if (failedJobs.length > 0) {
         items.push({
            severity: 'error',
            title: `${failedJobs.length} 个定时任务失败`,
            description: failedJobs.map((j) => j.name).join('、'),
         })
      }

      // 5. Cron 逾期
      const now = Date.now()
      const overdueJobs = cronJobs.filter(
         (j) => j.enabled && j.state?.nextRunAtMs && j.state.nextRunAtMs < now - 300_000,
      )
      if (overdueJobs.length > 0) {
         items.push({
            severity: 'warning',
            title: `${overdueJobs.length} 个任务逾期`,
            description: overdueJobs.map((j) => j.name).join('、'),
         })
      }

      return items
   }, [lastError, helloOk, skillsRpc.data, cronListRpc.data])

   // ── 数据加载中标识 ──
   const statsLoading = sessionsRpc.loading || usageRpc.loading
      || skillsRpc.loading || cronStatusRpc.loading

   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
         <Row gutter={[16, 16]}>
            <Col span={12}>
               <AccessCard
                  connected={connected}
                  connecting={connecting}
                  connectionState={connectionState}
                  lastError={lastError}
                  onConnect={connect}
                  onDisconnect={disconnect}
               />
            </Col>
            <Col span={12}>
               <SnapshotCard
                  connected={connected}
                  snapshot={snapshot}
                  helloOk={helloOk}
                  lastError={connected ? null : lastError}
                  channelsRefreshTs={channelsRefreshTs}
               />
            </Col>
         </Row>

         {connected && (
            <>
               <StatCards
                  usageResult={usageRpc.data}
                  sessionsResult={sessionsRpc.data}
                  skillsReport={skillsRpc.data}
                  cronStatus={cronStatusRpc.data}
                  cronJobs={cronListRpc.data?.jobs ?? []}
                  loading={statsLoading}
                  onNavigate={navigate}
               />

               <AttentionList items={attentionItems} />

               <Row gutter={[16, 16]}>
                  <Col span={12}>
                     <EventLogPanel events={eventLog} />
                  </Col>
                  <Col span={12}>
                     <LogTailPanel lines={logLines} onRefresh={loadLogs} />
                  </Col>
               </Row>
            </>
         )}
      </div>
   )
}
