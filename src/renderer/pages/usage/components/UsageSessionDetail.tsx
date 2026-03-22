import { useMemo } from 'react'
import {
   Flex,
   Tag,
   Spin,
   Segmented,
   Typography,
   Collapse,
   Checkbox,
   Input,
   Empty,
} from 'antd'
import { Line } from '@ant-design/charts'
import type {
   SessionUsageEntry,
   FullSessionUsageTimeSeries,
   UsageSessionLogEntry,
   SessionUsageTimePoint,
} from '../../../../shared/types/gateway-protocol'
import type { SessionLogRole } from '../usage-types'
import { formatTokens, formatCost, formatDurationCompact } from '../usage-utils'
import css from '../UsagePage.module.css'

interface UsageSessionDetailProps {
   session: SessionUsageEntry
   timeSeries: FullSessionUsageTimeSeries | null
   timeSeriesLoading: boolean
   timeSeriesMode: 'cumulative' | 'per-turn'
   timeSeriesBreakdownMode: 'total' | 'by-type'
   timeSeriesCursorStart: number | null
   timeSeriesCursorEnd: number | null
   sessionLogs: UsageSessionLogEntry[] | null
   sessionLogsLoading: boolean
   sessionLogsExpanded: boolean
   logFilterRoles: SessionLogRole[]
   logFilterTools: string[]
   logFilterHasTools: boolean
   logFilterQuery: string
   chartMode: 'tokens' | 'cost'
   onTimeSeriesModeChange: (mode: 'cumulative' | 'per-turn') => void
   onTimeSeriesBreakdownChange: (mode: 'total' | 'by-type') => void
   onTimeSeriesCursorChange: (
      start: number | null,
      end: number | null,
   ) => void
   onToggleSessionLogsExpanded: () => void
   onLogFilterRolesChange: (roles: SessionLogRole[]) => void
   onLogFilterToolsChange: (tools: string[]) => void
   onLogFilterHasToolsChange: (hasTools: boolean) => void
   onLogFilterQueryChange: (query: string) => void
   onClearLogFilters: () => void
}

// ── Role config ──

const ROLE_COLORS: Record<SessionLogRole, string> = {
   user: 'blue',
   assistant: 'green',
   tool: 'orange',
   toolResult: 'purple',
}

const ROLE_LABELS: Record<SessionLogRole, string> = {
   user: '用户',
   assistant: '助手',
   tool: '工具',
   toolResult: '工具结果',
}

const ROLE_FILTER_OPTIONS = [
   { label: '用户', value: 'user' as SessionLogRole },
   { label: '助手', value: 'assistant' as SessionLogRole },
   { label: '工具', value: 'tool' as SessionLogRole },
   { label: '工具结果', value: 'toolResult' as SessionLogRole },
]

const LOGS_DISPLAY_LIMIT = 100

function normalizeLogTimestamp(ts: number): number {
   return ts < 1e12 ? ts * 1000 : ts
}

export default function UsageSessionDetail(props: UsageSessionDetailProps) {
   const {
      session,
      timeSeries,
      timeSeriesLoading,
      timeSeriesMode,
      timeSeriesBreakdownMode,
      sessionLogs,
      sessionLogsLoading,
      sessionLogsExpanded,
      logFilterRoles,
      logFilterQuery,
      chartMode,
      onTimeSeriesModeChange,
      onTimeSeriesBreakdownChange,
      onToggleSessionLogsExpanded,
      onLogFilterRolesChange,
      onLogFilterQueryChange,
      onClearLogFilters,
   } = props

   const usage = session.usage

   // ── Summary stats ──

   const msgCounts = usage?.messageCounts
   const toolUsage = usage?.toolUsage
   const modelUsage = usage?.modelUsage

   const topTools = useMemo(() => {
      if (!toolUsage?.tools?.length) return []
      return [...toolUsage.tools].sort((a, b) => b.count - a.count).slice(0, 5)
   }, [toolUsage])

   const maxToolCount = useMemo(
      () => (topTools.length > 0 ? topTools[0].count : 1),
      [topTools],
   )

   const topModels = useMemo(() => {
      if (!modelUsage?.length) return []
      return [...modelUsage]
         .sort((a, b) => b.totals.totalCost - a.totals.totalCost)
         .slice(0, 5)
   }, [modelUsage])

   // ── Time series chart data ──

   const chartData = useMemo(() => {
      if (!timeSeries?.points?.length) return []
      return timeSeries.points
         .map((p: SessionUsageTimePoint) => {
            if (timeSeriesMode === 'cumulative') {
               return {
                  time: new Date(p.timestamp).toLocaleTimeString(),
                  value:
                     chartMode === 'cost' ? p.cumulativeCost : p.cumulativeTokens,
               }
            }
            if (timeSeriesBreakdownMode === 'total') {
               return {
                  time: new Date(p.timestamp).toLocaleTimeString(),
                  value: chartMode === 'cost' ? p.cost : p.totalTokens,
               }
            }
            return null
         })
         .filter((d): d is { time: string; value: number } => d !== null)
   }, [timeSeries, timeSeriesMode, timeSeriesBreakdownMode, chartMode])

   const byTypeChartData = useMemo(() => {
      if (
         timeSeriesBreakdownMode !== 'by-type' ||
         !timeSeries?.points?.length
      )
         return []
      return timeSeries.points.flatMap((p: SessionUsageTimePoint) => {
         const time = new Date(p.timestamp).toLocaleTimeString()
         if (chartMode === 'cost') {
            return [{ time, type: '总计', value: p.cost }]
         }
         return [
            { time, type: '输出', value: p.output },
            { time, type: '输入', value: p.input },
            { time, type: '缓存写入', value: p.cacheWrite },
            { time, type: '缓存读取', value: p.cacheRead },
         ]
      })
   }, [timeSeries, timeSeriesBreakdownMode, chartMode])

   const useByTypeData =
      timeSeriesBreakdownMode === 'by-type' && timeSeriesMode !== 'cumulative'

   const lineChartConfig = useMemo(
      () => ({
         data: useByTypeData ? byTypeChartData : chartData,
         xField: 'time',
         yField: 'value',
         colorField: useByTypeData ? 'type' : undefined,
         height: 200,
         theme: 'classicDark' as const,
         smooth: true,
         point: { size: 2 },
      }),
      [useByTypeData, byTypeChartData, chartData],
   )

   // ── Session logs ──

   const filteredLogs = useMemo(() => {
      if (!sessionLogs) return []
      let logs = sessionLogs
      if (logFilterRoles.length > 0) {
         logs = logs.filter((l) => logFilterRoles.includes(l.role))
      }
      if (logFilterQuery.trim()) {
         const q = logFilterQuery.toLowerCase()
         logs = logs.filter((l) => l.content.toLowerCase().includes(q))
      }
      return logs
   }, [sessionLogs, logFilterRoles, logFilterQuery])

   const displayLogs = useMemo(
      () => filteredLogs.slice(0, LOGS_DISPLAY_LIMIT),
      [filteredLogs],
   )

   const logsOverflow = filteredLogs.length > LOGS_DISPLAY_LIMIT

   const collapseItems = useMemo(
      () => [
         {
            key: 'logs',
            label: (
               <Flex align="center" gap={6}>
                  <span>会话日志</span>
                  {sessionLogs && (
                     <Tag style={{ marginLeft: 2 }}>{sessionLogs.length}</Tag>
                  )}
               </Flex>
            ),
            children: (
               <Flex vertical gap={8}>
                  {sessionLogsLoading ? (
                     <Flex justify="center" style={{ padding: '24px 0' }}>
                        <Spin />
                     </Flex>
                  ) : !sessionLogs?.length ? (
                     <Empty description="暂无日志" />
                  ) : (
                     <>
                        {/* Filter bar */}
                        <Flex gap={8} wrap align="center">
                           <Checkbox.Group
                              options={ROLE_FILTER_OPTIONS}
                              value={logFilterRoles}
                              onChange={(vals) =>
                                 onLogFilterRolesChange(vals as SessionLogRole[])
                              }
                           />
                           <Input.Search
                              size="small"
                              placeholder="搜索日志内容"
                              value={logFilterQuery}
                              onChange={(e) => onLogFilterQueryChange(e.target.value)}
                              allowClear
                              onClear={onClearLogFilters}
                              style={{ width: 180 }}
                           />
                        </Flex>

                        {/* Log entries */}
                        {displayLogs.map((log, idx) => (
                           <div key={idx} className={css.logEntry}>
                              <div className={css.logHeader}>
                                 <Tag color={ROLE_COLORS[log.role]}>
                                    {ROLE_LABELS[log.role]}
                                 </Tag>
                                 <span className={css.logTimestamp}>
                                    {new Date(
                                       normalizeLogTimestamp(log.timestamp),
                                    ).toLocaleTimeString()}
                                    {log.tokens ? ` · ${formatTokens(log.tokens)}` : ''}
                                    {log.cost ? ` · ${formatCost(log.cost)}` : ''}
                                 </span>
                              </div>
                              <Typography.Paragraph
                                 ellipsis={{
                                    rows: 3,
                                    expandable: true,
                                    symbol: '展开',
                                 }}
                                 style={{
                                    margin: '4px 0 0',
                                    fontSize: 13,
                                 }}
                              >
                                 {log.content}
                              </Typography.Paragraph>
                           </div>
                        ))}

                        {logsOverflow && (
                           <Typography.Text
                              type="secondary"
                              style={{
                                 textAlign: 'center',
                                 fontSize: 12,
                                 padding: '4px 0',
                              }}
                           >
                              显示前 {LOGS_DISPLAY_LIMIT} 条
                           </Typography.Text>
                        )}
                     </>
                  )}
               </Flex>
            ),
         },
      ],
      [
         sessionLogs,
         sessionLogsLoading,
         logFilterRoles,
         logFilterQuery,
         displayLogs,
         logsOverflow,
         onLogFilterRolesChange,
         onLogFilterQueryChange,
         onClearLogFilters,
      ],
   )

   return (
      <div className={css.detailPanel}>
         {/* ── Header ── */}
         <div className={css.detailHeader}>
            <span className={css.detailTitle}>{session.label || session.key}</span>
            <span className={css.detailHint}>点击其他会话切换</span>
         </div>

         <div className={css.detailBody}>
            {/* ── Stat boxes with colored top accent ── */}
            <div className={css.detailStatRow}>
               <div className={`${css.detailStatBox} ${css.detailStatBoxBlue}`}>
                  <div className={css.detailStatLabel}>消息</div>
                  <div className={css.detailStatValue}>{msgCounts?.total ?? 0}</div>
                  {msgCounts && (
                     <div className={css.detailStatSub}>
                        {msgCounts.user} 用户 / {msgCounts.assistant} 助手
                     </div>
                  )}
               </div>
               <div className={`${css.detailStatBox} ${css.detailStatBoxGreen}`}>
                  <div className={css.detailStatLabel}>工具调用</div>
                  <div className={css.detailStatValue}>
                     {toolUsage?.totalCalls ?? 0}
                  </div>
                  {toolUsage?.uniqueTools ? (
                     <div className={css.detailStatSub}>
                        {toolUsage.uniqueTools} 工具
                     </div>
                  ) : null}
               </div>
               <div
                  className={`${css.detailStatBox} ${
                     (msgCounts?.errors ?? 0) > 0
                        ? css.detailStatBoxRed
                        : css.detailStatBoxAmber
                  }`}
               >
                  <div className={css.detailStatLabel}>错误</div>
                  <div
                     className={css.detailStatValue}
                     style={
                        (msgCounts?.errors ?? 0) > 0
                           ? { color: '#ef4444' }
                           : undefined
                     }
                  >
                     {msgCounts?.errors ?? 0}
                  </div>
               </div>
               <div className={`${css.detailStatBox} ${css.detailStatBoxPurple}`}>
                  <div className={css.detailStatLabel}>时长</div>
                  <div className={css.detailStatValue}>
                     {formatDurationCompact(usage?.durationMs)}
                  </div>
               </div>
            </div>

            {/* ── Metadata tags ── */}
            <div className={css.detailTags}>
               {session.channel && <Tag color="blue">{session.channel}</Tag>}
               {session.agentId && <Tag color="green">{session.agentId}</Tag>}
               {(session.modelProvider || session.providerOverride) && (
                  <Tag>{session.modelProvider || session.providerOverride}</Tag>
               )}
               {session.model && <Tag>{session.model}</Tag>}
            </div>

            {/* ── Top Tools with progress bar background ── */}
            {topTools.length > 0 && (
               <div className={css.detailSection}>
                  <div className={css.detailSectionLabel}>常用工具</div>
                  {topTools.map((tool) => {
                     const barPct = (tool.count / maxToolCount) * 100
                     return (
                        <div key={tool.name} className={css.detailToolRow}>
                           <div
                              className={css.detailToolBar}
                              style={{ width: `${barPct}%` }}
                           />
                           <span className={css.detailToolName}>{tool.name}</span>
                           <span className={css.detailToolCount}>
                              {tool.count}
                              <span style={{ fontWeight: 400, marginLeft: 2 }}>次</span>
                           </span>
                        </div>
                     )
                  })}
               </div>
            )}

            {/* ── Top Models ── */}
            {topModels.length > 0 && (
               <div className={css.detailSection}>
                  <div className={css.detailSectionLabel}>模型用量</div>
                  {topModels.map((entry) => (
                     <div
                        key={`${entry.provider ?? ''}-${entry.model ?? ''}`}
                        className={css.detailModelRow}
                     >
                        <span className={css.detailModelName}>
                           {entry.model ?? '未知模型'}
                        </span>
                        <span className={css.detailModelMeta}>
                           {formatCost(entry.totals.totalCost)},{' '}
                           {formatTokens(entry.totals.totalTokens)}
                        </span>
                     </div>
                  ))}
               </div>
            )}

            {/* ── Time Series Chart ── */}
            <div className={css.detailChartSection}>
               <Flex gap={8} align="center" style={{ marginBottom: 8 }}>
                  <Segmented
                     size="small"
                     value={timeSeriesMode}
                     options={[
                        { label: '累计', value: 'cumulative' },
                        { label: '单次', value: 'per-turn' },
                     ]}
                     onChange={onTimeSeriesModeChange}
                  />
                  <Segmented
                     size="small"
                     value={timeSeriesBreakdownMode}
                     options={[
                        { label: '总计', value: 'total' },
                        { label: '按类型', value: 'by-type' },
                     ]}
                     onChange={onTimeSeriesBreakdownChange}
                  />
               </Flex>

               {timeSeriesLoading ? (
                  <Flex justify="center" style={{ padding: '24px 0' }}>
                     <Spin />
                  </Flex>
               ) : timeSeries?.points?.length ? (
                  <Line {...lineChartConfig} />
               ) : (
                  <Empty description="暂无时序数据" style={{ padding: '16px 0' }} />
               )}
            </div>

            {/* ── Session Logs ── */}
            <Collapse
               size="small"
               activeKey={sessionLogsExpanded ? ['logs'] : []}
               onChange={onToggleSessionLogsExpanded}
               items={collapseItems}
            />
         </div>
      </div>
   )
}
