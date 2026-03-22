import { useMemo, useCallback } from 'react'
import { Segmented, Tooltip } from 'antd'
import { Column } from '@ant-design/charts'
import type {
   CostUsageTotals,
   CostUsageDailyEntry,
} from '../../../../shared/types/gateway-protocol'
import { formatTokens, formatCost, formatDayLabel } from '../usage-utils'
import css from '../UsagePage.module.css'

interface UsageDailyChartProps {
   daily: Array<{
      date: string
      tokens: number
      cost: number
      messages: number
      toolCalls: number
      errors: number
   }>
   costDaily: CostUsageDailyEntry[]
   chartMode: 'tokens' | 'cost'
   dailyChartMode: 'total' | 'by-type'
   selectedDays: string[]
   totals: CostUsageTotals | null
   onDailyChartModeChange: (mode: 'total' | 'by-type') => void
   onSelectDay: (day: string, shiftKey: boolean) => void
}

interface ChartDataItem {
   date: string
   rawDate: string
   value: number
   type?: string
}

export default function UsageDailyChart(props: UsageDailyChartProps) {
   const {
      daily,
      costDaily,
      chartMode,
      dailyChartMode,
      selectedDays,
      totals,
      onDailyChartModeChange,
      onSelectDay,
   } = props

   // ── Chart data ──

   const chartData = useMemo<ChartDataItem[]>(() => {
      if (dailyChartMode === 'by-type' && costDaily.length > 0) {
         return costDaily.flatMap((d) => [
            {
               date: formatDayLabel(d.date),
               rawDate: d.date,
               type: '输出',
               value: chartMode === 'tokens' ? d.output : d.outputCost,
            },
            {
               date: formatDayLabel(d.date),
               rawDate: d.date,
               type: '输入',
               value: chartMode === 'tokens' ? d.input : d.inputCost,
            },
            {
               date: formatDayLabel(d.date),
               rawDate: d.date,
               type: '缓存写入',
               value: chartMode === 'tokens' ? d.cacheWrite : d.cacheWriteCost,
            },
            {
               date: formatDayLabel(d.date),
               rawDate: d.date,
               type: '缓存读取',
               value: chartMode === 'tokens' ? d.cacheRead : d.cacheReadCost,
            },
         ])
      }

      return daily.map((d) => ({
         date: formatDayLabel(d.date),
         rawDate: d.date,
         value: chartMode === 'tokens' ? d.tokens : d.cost,
      }))
   }, [daily, costDaily, chartMode, dailyChartMode])

   // ── Click handler ──

   const handleChartReady = useCallback(
      (chart: Record<string, unknown>) => {
         const bindOn = chart as { on?: (event: string, cb: (evt: unknown) => void) => void }
         bindOn.on?.('element:click', (evt: unknown) => {
            const record = evt as { data?: { data?: ChartDataItem } } | undefined
            const rawDate = record?.data?.data?.rawDate
            if (rawDate) {
               const syntheticEvent = window.event as MouseEvent | undefined
               onSelectDay(rawDate, syntheticEvent?.shiftKey ?? false)
            }
         })
      },
      [onSelectDay],
   )

   // ── Chart config ──

   const chartConfig = useMemo(
      () => ({
         data: chartData,
         xField: 'date',
         yField: 'value',
         colorField: dailyChartMode === 'by-type' ? 'type' : undefined,
         stack: dailyChartMode === 'by-type',
         height: 200,
         theme: 'classicDark' as const,
         tooltip: { title: 'date' },
         onReady: handleChartReady,
         style: {
            radiusTopLeft: 2,
            radiusTopRight: 2,
         },
         interaction: {
            tooltip: { shared: true },
         },
      }),
      [chartData, dailyChartMode, handleChartReady],
   )

   // ── Breakdown bar ──

   const breakdown = useMemo(() => {
      if (!totals) return []
      const total = totals.totalTokens || 1
      return [
         {
            label: '输出',
            value: totals.output,
            color: '#5B8FF9',
            pct: (totals.output / total) * 100,
         },
         {
            label: '输入',
            value: totals.input,
            color: '#5AD8A6',
            pct: (totals.input / total) * 100,
         },
         {
            label: '缓存写入',
            value: totals.cacheWrite,
            color: '#F6BD16',
            pct: (totals.cacheWrite / total) * 100,
         },
         {
            label: '缓存读取',
            value: totals.cacheRead,
            color: '#E86452',
            pct: (totals.cacheRead / total) * 100,
         },
      ].filter((d) => d.value > 0)
   }, [totals])

   return (
      <div className={css.chartCard}>
         <div className={css.chartHeader}>
            <span className={css.chartTitle}>每日用量</span>
            <Segmented
               size="small"
               value={dailyChartMode}
               options={[
                  { label: '总计', value: 'total' },
                  { label: '按类型', value: 'by-type' },
               ]}
               onChange={onDailyChartModeChange}
            />
         </div>
         <div className={css.chartBody}>
            <Column {...chartConfig} />

            {breakdown.length > 0 && (
               <>
                  <div className={css.breakdownBar}>
                     {breakdown.map((b) => (
                        <Tooltip
                           key={b.label}
                           title={`${b.label}: ${formatTokens(b.value)} (${b.pct.toFixed(1)}%)`}
                        >
                           <div
                              style={{
                                 width: `${b.pct}%`,
                                 background: b.color,
                                 height: '100%',
                              }}
                           />
                        </Tooltip>
                     ))}
                  </div>
                  <div className={css.breakdownLegend}>
                     {breakdown.map((b) => (
                        <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center' }}>
                           <span className={css.legendDot} style={{ background: b.color }} />
                           {b.label}
                        </span>
                     ))}
                  </div>
               </>
            )}
         </div>
      </div>
   )
}
