import { useMemo } from 'react'
import { Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import type {
   CostUsageTotals,
   SessionsUsageAggregates,
   SessionUsageEntry,
} from '../../../../shared/types/gateway-protocol'
import type { UsageInsightStats } from '../usage-types'
import {
   formatTokens,
   formatCost,
   pct,
   formatDurationCompact,
   buildPeakErrorHours,
   buildPeakErrorDays,
} from '../usage-utils'
import css from '../UsagePage.module.css'

// ── Props ──

interface UsageOverviewProps {
   totals: CostUsageTotals | null
   aggregates: SessionsUsageAggregates | null
   insightStats: UsageInsightStats | null
   chartMode: 'tokens' | 'cost'
   sessions: SessionUsageEntry[]
   timeZone: 'local' | 'utc'
}

// ── Helpers ──

function TipIcon({ tip }: { tip: string }) {
   return (
      <Tooltip title={tip}>
         <QuestionCircleOutlined
            style={{ fontSize: 11, color: 'var(--ant-color-text-quaternary)', cursor: 'help' }}
         />
      </Tooltip>
   )
}

function errorRateColor(rate: number): string {
   if (rate < 0.01) return '#22c55e'
   if (rate < 0.05) return '#f59e0b'
   return '#ef4444'
}

function cacheHitColor(pctValue: number): string {
   if (pctValue > 50) return '#22c55e'
   if (pctValue > 10) return '#f59e0b'
   return 'var(--ant-color-text-quaternary)'
}

// ── Ranking panel (internal) ──

function RankingPanel({
   title,
   items,
   emptyText,
}: {
   title: string
   items: Array<{ label: string; value: string; sub: string }>
   emptyText?: string
}) {
   return (
      <div className={css.rankingPanel}>
         <div className={css.rankingTitle}>{title}</div>
         {items.length === 0 ? (
            <div className={css.rankingEmpty}>{emptyText || '暂无数据'}</div>
         ) : (
            items.map((item, i) => (
               <div key={i} className={css.rankingItem}>
                  <span className={css.rankingItemLabel}>{item.label}</span>
                  <span>
                     <span className={css.rankingItemValue}>{item.value}</span>
                     <span className={css.rankingItemSub}>{item.sub}</span>
                  </span>
               </div>
            ))
         )}
      </div>
   )
}

// ── Main ──

export default function UsageOverview({
   totals,
   aggregates,
   insightStats,
   chartMode: _chartMode,
   sessions,
   timeZone,
}: UsageOverviewProps) {
   // ── Computed stats ──

   const msgTotal = aggregates?.messages.total ?? 0
   const msgUser = aggregates?.messages.user ?? 0
   const msgAssistant = aggregates?.messages.assistant ?? 0
   const msgErrors = aggregates?.messages.errors ?? 0
   const toolCalls = aggregates?.tools.totalCalls ?? 0
   const uniqueTools = aggregates?.tools.uniqueTools ?? 0
   const toolResults = aggregates?.messages.toolResults ?? 0

   const avgTokensPerMsg = useMemo(() => {
      if (!totals) return 0
      return totals.totalTokens / Math.max(msgTotal, 1)
   }, [totals, msgTotal])

   const avgCostPerMsg = useMemo(() => {
      if (!totals) return 0
      return totals.totalCost / Math.max(msgTotal, 1)
   }, [totals, msgTotal])

   const cacheHitPct = useMemo(() => {
      if (!totals) return 0
      return pct(totals.cacheRead, totals.totalTokens)
   }, [totals])

   // ── Ranking data ──

   const topModels = useMemo(() => {
      if (!aggregates) return []
      return aggregates.byModel.slice(0, 5).map((entry) => ({
         label: `${entry.provider ?? 'unknown'}/${entry.model ?? 'unknown'}`,
         value: formatCost(entry.totals.totalCost),
         sub: `${formatTokens(entry.totals.totalTokens)} · ${entry.count} 消息`,
      }))
   }, [aggregates])

   const topProviders = useMemo(() => {
      if (!aggregates) return []
      return aggregates.byProvider.slice(0, 5).map((entry) => ({
         label: entry.provider ?? 'unknown',
         value: formatCost(entry.totals.totalCost),
         sub: `${formatTokens(entry.totals.totalTokens)} · ${entry.count} 消息`,
      }))
   }, [aggregates])

   const topTools = useMemo(() => {
      if (!aggregates) return []
      return aggregates.tools.tools.slice(0, 5).map((entry) => ({
         label: entry.name,
         value: `${entry.count}`,
         sub: '调用',
      }))
   }, [aggregates])

   const topAgents = useMemo(() => {
      if (!aggregates) return []
      return aggregates.byAgent.slice(0, 5).map((entry) => ({
         label: entry.agentId,
         value: formatCost(entry.totals.totalCost),
         sub: formatTokens(entry.totals.totalTokens),
      }))
   }, [aggregates])

   const topChannels = useMemo(() => {
      if (!aggregates) return []
      return aggregates.byChannel.slice(0, 5).map((entry) => ({
         label: entry.channel,
         value: formatCost(entry.totals.totalCost),
         sub: formatTokens(entry.totals.totalTokens),
      }))
   }, [aggregates])

   const peakErrorDays = useMemo(() => {
      if (!aggregates) return []
      return buildPeakErrorDays(aggregates)
   }, [aggregates])

   const peakErrorHours = useMemo(() => {
      return buildPeakErrorHours(sessions, timeZone)
   }, [sessions, timeZone])

   // ── Render ──

   return (
      <div className={css.overviewSection}>
         {/* ── Row 1: 3 Hero metrics ── */}
         <div className={css.heroMetrics}>
            <div className={`${css.heroCard} ${css.heroCardBlue}`}>
               <div className={css.heroLabel}>
                  消息 <TipIcon tip="所有消息总数，包括用户、助手及工具消息" />
               </div>
               <div className={css.heroValue}>
                  {msgTotal}
                  <span className={css.heroSuffix}>
                     {msgUser} user · {msgAssistant} assistant
                  </span>
               </div>
            </div>

            <div className={`${css.heroCard} ${css.heroCardGreen}`}>
               <div className={css.heroLabel}>
                  工具调用 <TipIcon tip="工具被调用的总次数及使用的工具种类" />
               </div>
               <div className={css.heroValue}>
                  {toolCalls}
                  <span className={css.heroSuffix}>{uniqueTools} 种工具</span>
               </div>
            </div>

            <div className={`${css.heroCard} ${msgErrors > 0 ? css.heroCardRed : css.heroCardAmber}`}>
               <div className={css.heroLabel}>
                  错误 <TipIcon tip="消息处理中产生的错误数量" />
               </div>
               <div className={css.heroValue}>
                  {msgErrors}
                  <span className={css.heroSuffix}>{toolResults} 工具结果</span>
               </div>
            </div>
         </div>

         {/* ── Row 2: 6 Secondary metrics (3×2) ── */}
         <div className={css.secondaryMetrics}>
            <div className={css.secondaryCard}>
               <div className={css.secondaryLabel}>
                  平均 Token/消息 <TipIcon tip="每条消息平均消耗的 Token 数量" />
               </div>
               <div className={css.secondaryValue}>
                  {formatTokens(Math.round(avgTokensPerMsg))}
                  <span className={css.secondarySuffix}>
                     共 {formatTokens(totals?.totalTokens ?? 0)} tokens
                  </span>
               </div>
            </div>

            <div className={css.secondaryCard}>
               <div className={css.secondaryLabel}>
                  平均费用/消息 <TipIcon tip="每条消息的平均费用" />
               </div>
               <div className={css.secondaryValue}>
                  {formatCost(avgCostPerMsg, 4)}
                  <span className={css.secondarySuffix}>
                     共 {formatCost(totals?.totalCost ?? 0)}
                  </span>
               </div>
            </div>

            <div className={css.secondaryCard}>
               <div className={css.secondaryLabel}>
                  会话数 <TipIcon tip="在当前查询时间范围内的会话总数" />
               </div>
               <div className={css.secondaryValue}>
                  {sessions.length}
                  <span className={css.secondarySuffix}>在查询范围内</span>
               </div>
            </div>

            <div className={css.secondaryCard}>
               <div className={css.secondaryLabel}>
                  吞吐量 <TipIcon tip="每分钟处理的 Token 数量与费用" />
               </div>
               <div className={css.secondaryValue}>
                  {insightStats?.throughputTokensPerMin != null
                     ? `${formatTokens(Math.round(insightStats.throughputTokensPerMin))} tok/min`
                     : '\u2014'}
                  <span className={css.secondarySuffix}>
                     ${insightStats?.throughputCostPerMin?.toFixed(4) ?? '0.0000'}/min
                  </span>
               </div>
            </div>

            <div className={css.secondaryCard}>
               <div className={css.secondaryLabel}>
                  错误率 <TipIcon tip="消息处理中的错误比例" />
               </div>
               <div
                  className={css.secondaryValue}
                  style={{ color: errorRateColor(insightStats?.errorRate ?? 0) }}
               >
                  {`${((insightStats?.errorRate ?? 0) * 100).toFixed(2)}%`}
                  <span className={css.secondarySuffix}>
                     {msgErrors} 错误 · {formatDurationCompact(insightStats?.avgDurationMs)}
                  </span>
               </div>
            </div>

            <div className={css.secondaryCard}>
               <div className={css.secondaryLabel}>
                  缓存命中率 <TipIcon tip="缓存读取 Token 占总 Token 的比例" />
               </div>
               <div
                  className={css.secondaryValue}
                  style={{ color: cacheHitColor(cacheHitPct) }}
               >
                  {`${cacheHitPct.toFixed(2)}%`}
                  <span className={css.secondarySuffix}>
                     {formatTokens(totals?.cacheRead ?? 0)} 缓存 ·{' '}
                     {formatTokens(totals?.totalTokens ?? 0)} 总计
                  </span>
               </div>
            </div>
         </div>

         {/* ── Row 3: Ranking lists (3 columns, stacked) ── */}
         <div className={css.rankingGrid}>
            {/* Column 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               <RankingPanel title="Top Models" items={topModels} />
               <RankingPanel title="Top Agents" items={topAgents} />
            </div>

            {/* Column 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               <RankingPanel title="Top Providers" items={topProviders} />
               <RankingPanel title="Top Channels" items={topChannels} />
            </div>

            {/* Column 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               <RankingPanel title="Top Tools" items={topTools} />
               <RankingPanel title="Peak Error Days" items={peakErrorDays} />
               <RankingPanel title="Peak Error Hours" items={peakErrorHours} />
            </div>
         </div>
      </div>
   )
}
